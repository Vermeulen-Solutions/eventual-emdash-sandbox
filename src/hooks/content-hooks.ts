import type {
  PluginContext,
  ContentHookEvent,
  ContentDeleteEvent,
  ContentPolicyEvent,
} from "emdash/plugin";
import {
  normalizeNativeSchedule,
  parseJson,
  scheduleKeys,
} from "../domain/native-validation";
import { reconcileNativeCalendar } from "../domain/native-calendar";
import {
  eventSchema,
  referenceTarget,
  referenceId,
} from "../domain/native-references";
import { listNative } from "../domain/native-source";
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
    let currentStatus: string | undefined;
    if (event.id) {
      const current = await ctx.content?.get("events", event.id);
      currentStatus = current?.status;
      if (current) previous = current.data;
      // Validate against the latest editable draft, not the live publication.
      if (current?.draftRevisionId && ctx.content?.getRevision) {
        const revision = await ctx.content.getRevision(
          "events",
          event.id,
          current.draftRevisionId,
        );
        if (revision) previous = revision.data;
      }
    }
    for (const key of ["calendar_uid", "legacy_id"])
      if (
        event.id &&
        Object.hasOwn(event.content, key) &&
        event.content[key] !== previous[key]
      )
        throw new Error(key + " cannot be changed after creation.");
    if (
      currentStatus === "draft" &&
      !["start", "end", "start_date", "end_date"].some(
        (key) => ({ ...previous, ...event.content })[key],
      )
    )
      return event.content;
    const normalized = normalizeNativeSchedule(
      {
        ...previous,
        ...event.content,
      },
      {
        allowStaleOccurrenceCopy:
          !Object.hasOwn(event.content, "occurrence_content") ||
          JSON.stringify(parseJson(event.content.occurrence_content) ?? []) ===
            JSON.stringify(parseJson(previous.occurrence_content) ?? []),
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

    if (event.id) {
      const current = await ctx.content?.get("events", event.id);
      if (current && current.status === "published" && current.data) {
        const liveData = current.data as Record<string, unknown>;
        const liveAllDay = Boolean(liveData.all_day);
        const liveTz = String(liveData.timezone || "UTC");
        const liveStart = liveAllDay
          ? String(liveData.start_date || "")
          : String(liveData.start || "");
        const liveEnd = liveAllDay
          ? String(liveData.end_date || "")
          : String(liveData.end || "");

        const nextAllDay = Boolean(normalized.all_day);
        const nextTz = String(normalized.timezone || "UTC");
        const nextStart = nextAllDay
          ? String(normalized.start_date || "")
          : String(normalized.start || "");
        const nextEnd = nextAllDay
          ? String(normalized.end_date || "")
          : String(normalized.end || "");

        if (
          liveStart &&
          liveEnd &&
          (liveStart !== nextStart ||
            liveEnd !== nextEnd ||
            liveAllDay !== nextAllDay ||
            liveTz !== nextTz)
        ) {
          const rawHistory = parseJson(
            liveData.schedule_history ?? patch.schedule_history,
          );
          const historyList: any[] = Array.isArray(rawHistory)
            ? rawHistory
            : [];
          const isDuplicateTransition =
            historyList[0]?.start === liveStart &&
            historyList[0]?.end === liveEnd &&
            historyList[0]?.allDay === liveAllDay &&
            historyList[0]?.timezone === liveTz;

          if (!isDuplicateTransition) {
            const newEntry = {
              start: liveStart,
              end: liveEnd,
              allDay: liveAllDay,
              timezone: liveTz,
              changedAt: new Date().toISOString(),
            };
            patch.schedule_history = JSON.stringify(
              [newEntry, ...historyList].slice(0, 10),
            );
          }
          patch.previous_start_date = liveStart;
          if (
            liveData.event_status !== "cancelled" &&
            (!Object.hasOwn(event.content, "event_status") ||
              event.content.event_status === liveData.event_status)
          ) {
            patch.event_status = "rescheduled";
          }
        }
      }
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
    if (ctx && (data.venue_id ?? data.venue)) {
      const target = referenceTarget(await eventSchema(ctx), "venue");
      const id = referenceId(data.venue_id ?? data.venue);
      if (
        typeof target !== "string" ||
        typeof id !== "string" ||
        (await ctx.content?.get(target, id))?.status !== "published"
      )
        throw new Error(
          "Publish a valid referenced venue before publishing or scheduling this event.",
        );
    }
    if (ctx && (data.organizer_id ?? data.organizer_ref ?? data.organizerId)) {
      const orgId = referenceId(
        data.organizer_id ?? data.organizer_ref ?? data.organizerId,
      );
      if (orgId) {
        const orgTarget = referenceTarget(
          await eventSchema(ctx),
          "organizer_ref",
        );
        const org = await ctx.content?.get(orgTarget, orgId);
        if (!org || org.status !== "published") {
          throw new Error(
            "Publish the referenced organizer before publishing or scheduling this event.",
          );
        }
      } else throw new Error("Choose a valid saved organizer.");
    }
  } catch (error) {
    return {
      cancel: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function dependencyReason(
  collection: string,
  id: unknown,
  ctx: PluginContext,
): Promise<string | undefined> {
  const schema = await eventSchema(ctx);
  if (!schema) return;
  const venueTarget = referenceTarget(schema, "venue");
  const organizerTarget = referenceTarget(schema, "organizer_ref");
  if (collection !== venueTarget && collection !== organizerTarget) return;
  if (typeof id !== "string" || !id)
    throw new Error("Cannot verify this dependency. Reload the entry.");
  const target = await ctx.content?.get(collection, id);
  const ids = new Set([id]);
  if (target && ctx.content?.getTranslations) {
    const siblings = await ctx.content.getTranslations(collection, id);
    for (const sibling of siblings.translations) ids.add(sibling.id);
  }
  for (const event of await listNative(ctx, "events")) {
    if (event.status !== "published" && event.status !== "scheduled") continue;
    const variants = [event.data];
    if (
      (event.status === "scheduled" || event.scheduledAt) &&
      event.draftRevisionId &&
      ctx.content?.getRevision
    ) {
      const draft = await ctx.content.getRevision(
        "events",
        event.id,
        event.draftRevisionId,
      );
      if (draft) variants.push(draft.data);
    }
    if (
      variants.some(
        (data) =>
          (collection === venueTarget &&
            ids.has(referenceId(data.venue_id ?? data.venue) ?? "")) ||
          (collection === organizerTarget &&
            ids.has(
              referenceId(data.organizer_id ?? data.organizer_ref) ?? "",
            )),
      )
    )
      return (
        "This " +
        (collection === venueTarget ? "venue" : "organizer") +
        ' is used by published or scheduled event "' +
        String(event.data.title ?? event.id) +
        '". Reassign or unpublish the event first.'
      );
  }
}

export async function handleContentBeforeUnpublish(
  event: ContentPolicyEvent,
  ctx?: PluginContext,
): Promise<void | { cancel: true; reason: string }> {
  if (!ctx) return;
  try {
    const nested =
      event.content.data && typeof event.content.data === "object"
        ? (event.content.data as Record<string, unknown>)
        : {};
    const reason = await dependencyReason(
      event.collection,
      event.content.id ?? nested.id,
      ctx,
    );
    if (reason) return { cancel: true, reason };
  } catch (error) {
    return {
      cancel: true,
      reason:
        error instanceof Error
          ? error.message
          : "Dependencies could not be verified. Retry before unpublishing.",
    };
  }
}

// Snapshot while live data exists; only committed changes create cancellations.
export async function handleContentBeforeDelete(
  event: ContentDeleteEvent,
  ctx: PluginContext,
): Promise<void> {
  if (event.collection === "events") {
    await reconcileNativeCalendar(ctx);
    return;
  }
  const reason = await dependencyReason(event.collection, event.id, ctx);
  if (reason) throw new Error(reason);
}
