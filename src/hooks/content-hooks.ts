import { reject } from '../domain/messages';
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
import { eventCollectionName, collectionSettings, collectionSchemas } from '../domain/collections';
import { withInvocationBudget } from '../domain/invocation-budget';
export type { ContentHookEvent, ContentDeleteEvent } from "emdash/plugin";

export async function handleContentBeforeSave(
  event: ContentHookEvent,
  ctx: PluginContext,
): Promise<Record<string, unknown> | void> {
  ctx = withInvocationBudget(ctx);
  if (event.collection !== await eventCollectionName(ctx)) return;
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
    let current: Awaited<ReturnType<NonNullable<PluginContext['content']>['get']>> | undefined;
    if (event.id) {
      current = await ctx.content?.get(event.collection, event.id);
      if (current) previous = current.data;
      // Validate against the latest editable draft, not the live publication.
      if (current?.draftRevisionId && ctx.content?.getRevision) {
        const revision = await ctx.content.getRevision(
          event.collection,
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
        reject(key + " cannot be changed after creation.");
    if (
      current?.status === "draft" &&
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

    if (current?.status === 'published') {
      const schedule = (data: Record<string, unknown>) => ({
        start: String(data[data.all_day ? 'start_date' : 'start'] || ''),
        end: String(data[data.all_day ? 'end_date' : 'end'] || ''),
        allDay: Boolean(data.all_day), timezone: String(data.timezone || 'UTC'),
      });
      const live = schedule(current.data), next = schedule(normalized);
      const same = (value: any) => value && Object.entries(live).every(([key, item]) => value[key] === item);
      if (live.start && live.end && !same(next)) {
        const schema = (await collectionSchemas(ctx)).find(item => item.slug === event.collection);
        const hasField = (slug: string) => schema?.fields.some(item => item.slug === slug);
        const raw = parseJson(current.data.schedule_history ?? patch.schedule_history);
        const history = Array.isArray(raw) ? raw : [];
        if (hasField('schedule_history') && !same(history[0]))
          patch.schedule_history = JSON.stringify([{...live, changedAt:new Date().toISOString()}, ...history].slice(0,10));
        if (hasField('previous_start_date')) patch.previous_start_date = live.start;
        if (current.data.event_status !== 'cancelled' && (!Object.hasOwn(event.content,'event_status') || event.content.event_status === current.data.event_status))
          patch.event_status = 'rescheduled';
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
  if (ctx) ctx = withInvocationBudget(ctx);
  if (event.collection !== (ctx ? await eventCollectionName(ctx) : 'events')) return;
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
        reject("Publish a valid referenced venue before publishing or scheduling this event.");
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
          reject("Publish the referenced organizer before publishing or scheduling this event.");
        }
      } else reject("Choose a valid saved organizer.");
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
  const bindings=await collectionSettings(ctx);
  if(bindings && ![bindings.venues,bindings.organizers].includes(collection)) return;
  const schema = await eventSchema(ctx);
  if (!schema) return;
  const venueTarget = referenceTarget(schema, "venue");
  const organizerTarget = referenceTarget(schema, "organizer_ref");
  if (collection !== venueTarget && collection !== organizerTarget) return;
  if (typeof id !== "string" || !id)
    reject("Cannot verify this dependency. Reload the entry.");
  const target = await ctx.content?.get(collection, id);
  const ids = new Set([id]);
  if (target && ctx.content?.getTranslations) {
    const siblings = await ctx.content.getTranslations(collection, id);
    for (const sibling of siblings.translations) ids.add(sibling.id);
  }
  for (const event of await listNative(ctx, schema.slug)) {
    if (event.status !== "published" && event.status !== "scheduled") continue;
    const variants = [event.data];
    if (
      (event.status === "scheduled" || event.scheduledAt) &&
      event.draftRevisionId &&
      ctx.content?.getRevision
    ) {
      const draft = await ctx.content.getRevision(
        schema.slug,
        event.id,
        event.draftRevisionId,
      );
      if (!draft) reject('Scheduled event revision could not be verified. Retry before changing this dependency.');
      variants.push(draft.data);
    }
    if ((event.status === 'scheduled' || event.scheduledAt) && event.draftRevisionId && !ctx.content?.getRevision)
      reject('Scheduled event revision access is required to verify this dependency.');
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
  ctx = withInvocationBudget(ctx);
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
  ctx = withInvocationBudget(ctx);
  if (event.collection === await eventCollectionName(ctx)) {
    await reconcileNativeCalendar(ctx);
    return;
  }
  const reason = await dependencyReason(event.collection, event.id, ctx);
  if (reason) reject(reason);
}
