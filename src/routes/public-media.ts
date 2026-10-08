import { pluginResponse } from "emdash/plugin";

import {
  isPublicEventImageType,
  MAX_PUBLIC_EVENT_IMAGE_BYTES,
} from "../domain/image";
import { getEvent, type EventualContext } from "../storage";
import { nativeSchema } from "../domain/native-source";
import { nativeEntryToEventRecord } from "../domain/event-expansion";
import { withInvocationBudget } from '../domain/invocation-budget';

const textResponse = (status: number, value: string) =>
  pluginResponse({
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
    body: { kind: "text", value },
  });
const notFound = () => textResponse(404, "Not found");

export async function handlePublicEventImage(
  input: unknown,
  ctx: EventualContext,
) {
  ctx = withInvocationBudget(ctx);
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return notFound();
  const eventId = (input as { eventId?: unknown }).eventId;
  if (typeof eventId !== "string" || eventId.length < 1 || eventId.length > 128)
    return notFound();
  const [baseId, occ] = eventId.split("#");
  const schema = await nativeSchema(ctx);
  let record = schema ? await ctx.content!.get(schema.slug, baseId!) : undefined;
  if (schema && !record && schema.fields.some(field => field.slug === 'legacy_id' && field.indexed)) {
    const page = await ctx.content!.list(schema.slug, {limit: 2, where: {status: 'published', fieldFilters: {legacy_id: baseId!}}});
    if (page.hasMore || page.items.length > 1) return notFound();
    record = page.items[0];
  }
  let event = schema
    ? nativeEntryToEventRecord(record)
    : (await getEvent(ctx, eventId)) ?? (await getEvent(ctx, baseId!));
  if (event && occ) {
    const ex = event.exceptions?.find((e) => e.recurrenceId === occ);
    const m = ex?.overrides?.featuredMediaId || ex?.overrides?.imageMediaId;
    if (m) event = { ...event, featuredMediaId: m, imageMediaId: m };
  }
  const mediaId = event?.featuredMediaId || event?.imageMediaId;
  if (!event?.published || !mediaId || !ctx.media?.readBytes)
    return notFound();
  const media = await ctx.media.get(mediaId);
  if (!media || !isPublicEventImageType(media.mimeType)) return notFound();
  if (media.size !== null && media.size > MAX_PUBLIC_EVENT_IMAGE_BYTES) {
    return textResponse(413, "Event image is too large");
  }

  try {
    const file = await ctx.media.readBytes(mediaId, {
      maxBytes: MAX_PUBLIC_EVENT_IMAGE_BYTES,
    });
    if (
      !isPublicEventImageType(file.mimeType) ||
      file.mimeType !== media.mimeType
    )
      return notFound();
    return pluginResponse({
      status: 200,
      headers: { "content-type": file.mimeType },
      body: { kind: "bytes", value: file.bytes },
    });
  } catch {
    return notFound();
  }
}
