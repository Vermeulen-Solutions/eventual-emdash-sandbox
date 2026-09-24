import { pluginResponse } from "emdash/plugin";

import { isPublicEventImageType, MAX_PUBLIC_EVENT_IMAGE_BYTES } from "../domain/image";
import { getEvent, type EventualContext } from "../storage";

function notFound() {
	return pluginResponse({
		status: 404,
		headers: { "content-type": "text/plain; charset=utf-8" },
		body: { kind: "text", value: "Not found" },
	});
}

export async function handlePublicEventImage(input: unknown, ctx: EventualContext) {
	if (typeof input !== "object" || input === null || Array.isArray(input)) return notFound();
	const eventId = (input as { eventId?: unknown }).eventId;
	if (typeof eventId !== "string" || eventId.length < 1 || eventId.length > 128) return notFound();
	const event = await getEvent(ctx, eventId);
	if (!event?.published || !event.imageMediaId || !ctx.media?.readBytes) return notFound();
	const media = await ctx.media.get(event.imageMediaId);
	if (!media || !isPublicEventImageType(media.mimeType)) return notFound();
	if (media.size !== null && media.size > MAX_PUBLIC_EVENT_IMAGE_BYTES) {
		return pluginResponse({
			status: 413,
			headers: { "content-type": "text/plain; charset=utf-8" },
			body: { kind: "text", value: "Event image is too large" },
		});
	}

	try {
		const file = await ctx.media.readBytes(event.imageMediaId, { maxBytes: MAX_PUBLIC_EVENT_IMAGE_BYTES });
		if (!isPublicEventImageType(file.mimeType) || file.mimeType !== media.mimeType) return notFound();
		return pluginResponse({
			status: 200,
			headers: { "content-type": file.mimeType },
			body: { kind: "bytes", value: file.bytes },
		});
	} catch {
		return notFound();
	}
}
