import { pluginResponse } from "emdash/plugin";

import {
  isPublicEventImageType,
  MAX_PUBLIC_EVENT_IMAGE_BYTES,
} from "../domain/image";
import { getEvent, type EventualContext } from "../storage";
import { nativeSchema, listNative } from "../domain/native-source";
import { nativeEntryToEventRecord } from "../domain/event-expansion";

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
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return notFound();
  const eventId = (input as { eventId?: unknown }).eventId;
  if (typeof eventId !== "string" || eventId.length < 1 || eventId.length > 128)
    return notFound();
  const [baseId, occ] = eventId.split("#");
  const schema = await nativeSchema(ctx);
  const record = schema
    ? (await listNative(ctx, schema.slug, true)).find(
        (i) => [eventId, baseId].includes(i.id) || [eventId, baseId].includes(i.data.legacy_id as string),
      )
    : undefined;
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
