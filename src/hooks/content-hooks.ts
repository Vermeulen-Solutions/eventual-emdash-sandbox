import type {
  PluginContext,
  ContentHookEvent,
  ContentDeleteEvent,
  ContentPolicyEvent,
} from "emdash/plugin";
import {
  normalizeNativeSchedule,
  scheduleKeys,
} from "../domain/native-validation";
import { reconcileNativeCalendar } from "../domain/native-calendar";
export type { ContentHookEvent, ContentDeleteEvent } from "emdash/plugin";

export async function handleContentBeforeSave(
  event: ContentHookEvent,
  ctx: PluginContext,
): Promise<Record<string, unknown> | void> {
  if (event.collection !== "events") return;
  // EmDash passes patches and inherits shared fields for new translations AFTER this hook.
  if (!scheduleKeys.some((key) => Object.hasOwn(event.content, key)))
    return event.content;
  // Translation creates inherit dates after this hook. Full publication policy
  // checks also cover incomplete new drafts, which core intentionally permits.
  if (
    event.isNew &&
    !["start", "end", "start_date", "end_date"].some(
      (key) => event.content[key] != null && event.content[key] !== "",
    )
  )
    return event.content;
  try {
    let previous: Record<string, unknown> = {};
    if (event.id) {
      const current = await ctx.content?.get("events", event.id);
      if (current) previous = current.data;
      // Validate against the latest editable draft, not the live publication.
      const revisions = await ctx.content?.listRevisions?.("events", event.id, {
        limit: 1,
      });
      if (revisions?.[0]) previous = revisions[0].data;
    }
    for (const key of ["calendar_uid", "legacy_id"])
      if (
        event.id &&
        Object.hasOwn(event.content, key) &&
        event.content[key] !== previous[key]
      )
        throw new Error(key + " cannot be changed after creation.");
    const normalized = normalizeNativeSchedule(
      {
        ...previous,
        ...event.content,
      },
      {
        allowStaleOccurrenceCopy: !Object.hasOwn(
          event.content,
          "occurrence_content",
        ),
      },
    );
    const patch = { ...event.content };
    for (const key of [
      "start",
      "end",
      "start_date",
      "end_date",
      "all_day",
      "timezone",
    ]) {
      if (key in normalized) patch[key] = normalized[key];
    }
    if (event.id && Object.hasOwn(event.content, "all_day")) {
      for (const key of normalized.all_day
        ? ["start", "end"]
        : ["start_date", "end_date"])
        patch[key] = null;
    }
    return patch;
  } catch (error) {
    return {
      __emdashSandboxHookResult: true,
      version: 1,
      error: {
        code: "SAVE_REJECTED",
        reason: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
export async function handleContentBeforePublish(
  event: ContentPolicyEvent,
  ctx?: PluginContext,
): Promise<void | { cancel: true; reason: string }> {
  if (event.collection !== "events") return;
  try {
    const data =
      event.content.data && typeof event.content.data === "object"
        ? (event.content.data as Record<string, unknown>)
        : event.content;
    // A shared schedule change can orphan another locale's editorial override.
    // Preserve that copy for restoration; expansion ignores unmatched IDs.
    normalizeNativeSchedule(data, { allowStaleOccurrenceCopy: true });
    if (ctx && data.venue) {
      const schema = (await ctx.schema?.listCollections())?.find(
        (item) => item.slug === "events",
      );
      const target = schema?.fields.find((field) => field.slug === "venue")
        ?.options?.collection;
      const id =
        typeof data.venue === "string"
          ? data.venue
          : typeof data.venue === "object"
            ? (data.venue as Record<string, unknown>).id
            : undefined;
      if (
        typeof target !== "string" ||
        typeof id !== "string" ||
        (await ctx.content?.get(target, id))?.status !== "published"
      )
        throw new Error(
          "Publish a valid referenced venue before publishing or scheduling this event.",
        );
    }
  } catch (error) {
    return {
      cancel: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
// Snapshot while live data exists; cancellations are written only after a committed change.
export async function handleContentBeforeDelete(
  event: ContentDeleteEvent,
  ctx: PluginContext,
): Promise<void> {
  if (event.collection === "events") await reconcileNativeCalendar(ctx);
}
