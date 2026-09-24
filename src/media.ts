import type { EventualContext } from "./storage";
import { isPublicEventImageType, MAX_PUBLIC_EVENT_IMAGE_BYTES } from "./domain/image";

export interface EventImageOption {
	id: string;
	filename: string;
	mimeType: string;
	url: string;
	alt?: string | null;
	width?: number | null;
	height?: number | null;
	size: number | null;
}

export interface EventImageOptions {
	items: EventImageOption[];
	hasMore: boolean;
}

export async function listEventImages(ctx: EventualContext, selectedId = ""): Promise<EventImageOptions> {
	if (!ctx.media) return { items: [], hasMore: false };
	const page = await ctx.media.list({ mimeType: "image/", limit: 100 });
	const items = page.items
		.filter((item) => isPublicEventImageType(item.mimeType) && (item.size === null || item.size <= MAX_PUBLIC_EVENT_IMAGE_BYTES))
		.map((item) => ({
			id: item.id,
			filename: item.filename,
			mimeType: item.mimeType,
			url: item.url,
			alt: item.alt,
			width: item.width,
			height: item.height,
			size: item.size,
		}));
	if (selectedId && !items.some((item) => item.id === selectedId)) {
		const selected = await ctx.media.get(selectedId);
		if (selected && isPublicEventImageType(selected.mimeType) && (selected.size === null || selected.size <= MAX_PUBLIC_EVENT_IMAGE_BYTES)) {
			items.unshift({
				id: selected.id,
				filename: selected.filename,
				mimeType: selected.mimeType,
				url: selected.url,
				alt: selected.alt,
				width: selected.width,
				height: selected.height,
				size: selected.size,
			});
		}
	}
	return { items, hasMore: page.hasMore };
}

export async function isUsableEventImage(ctx: EventualContext, id: string): Promise<boolean> {
	const media = await ctx.media?.get(id);
	if (!media || !isPublicEventImageType(media.mimeType)) return false;
	if (media.size !== null) return media.size <= MAX_PUBLIC_EVENT_IMAGE_BYTES;
	if (!ctx.media?.readBytes) return false;
	try {
		const file = await ctx.media.readBytes(id, { maxBytes: MAX_PUBLIC_EVENT_IMAGE_BYTES });
		return file.mimeType === media.mimeType && isPublicEventImageType(file.mimeType) && file.bytes.byteLength <= MAX_PUBLIC_EVENT_IMAGE_BYTES;
	} catch {
		return false;
	}
}
