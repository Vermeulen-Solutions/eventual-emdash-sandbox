const PUBLIC_EVENT_IMAGE_TYPES = new Set([
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
]);

export const MAX_PUBLIC_EVENT_IMAGE_BYTES = 8 * 1024 * 1024;

export function isPublicEventImageType(mimeType: string): boolean {
	return PUBLIC_EVENT_IMAGE_TYPES.has(mimeType.toLowerCase());
}

export function publicEventImageUrl(pluginId: string, eventId: string): string {
	const query = new URLSearchParams({ eventId });
	return `/_emdash/api/plugins/${encodeURIComponent(pluginId)}/publicEventImage?${query}`;
}
