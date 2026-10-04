import { safeWebUrl } from "./event-details";
import type { PublicEvent } from "./feed";

export interface EventJsonLdOptions {
	/** HTTP(S) base used to resolve relative image, event, and meeting URLs. */
	siteUrl?: string;
}

/**
 * Generates Schema.org JSON-LD structured data for an Eventual event.
 * Follows schema.org/Event with attendance modes, event statuses, and locations.
 */
export function eventToJsonLd(event: PublicEvent, options?: EventJsonLdOptions): Record<string, unknown> {
	const attendanceMode =
		event.locationType === "virtual"
			? "https://schema.org/OnlineEventAttendanceMode"
			: event.locationType === "hybrid"
				? "https://schema.org/MixedEventAttendanceMode"
				: "https://schema.org/OfflineEventAttendanceMode";

	const eventStatus =
		event.status === "cancelled"
			? "https://schema.org/EventCancelled"
			: event.status === "postponed"
				? "https://schema.org/EventPostponed"
				: event.status === "rescheduled"
					? "https://schema.org/EventRescheduled"
					: "https://schema.org/EventScheduled";

	const locations: Record<string, unknown>[] = [];
	const parts = event.venue?.addressParts;
	const address = parts ? {
		'@type': 'PostalAddress',
		...Object.fromEntries(Object.entries({ streetAddress: [parts.street, parts.street2].filter(Boolean).join(', '), addressLocality: parts.locality, addressRegion: parts.region, postalCode: parts.postalCode, addressCountry: parts.country }).filter(([, value]) => !!value)),
	} : undefined;
	if (event.locationType !== "virtual") {
		if (event.venue) locations.push({
			"@type": "Place", name: event.venue.name,
			...(address && Object.keys(address).length > 1 ? { address } : event.venue.address ? { address: event.venue.address } : {}),
		});
		else if (event.location) locations.push({ "@type": "Place", name: event.location });
	}
	const virtualUrl = safeWebUrl(event.virtualUrl ?? "", options?.siteUrl);
	if ((event.locationType === "virtual" || event.locationType === "hybrid") && virtualUrl) {
		locations.push({ "@type": "VirtualLocation", url: virtualUrl });
	}

	const record: Record<string, unknown> = {
		"@context": "https://schema.org",
		"@type": "Event",
		name: event.title,
		startDate: event.start,
		endDate: event.end,
		eventStatus,
		eventAttendanceMode: attendanceMode,
	};

	if (event.description) record.description = event.description;
	if (event.status === 'rescheduled' && event.previousStartDate) record.previousStartDate = event.previousStartDate;
	const image = safeWebUrl(event.imageUrl, options?.siteUrl);
	if (image) record.image = image;
	const url = safeWebUrl(event.externalUrl, options?.siteUrl);
	if (url) record.url = url;
	if (locations.length) record.location = locations.length === 1 ? locations[0] : locations;
	if (event.organizer) record.organizer = { "@type": "Organization", name: event.organizerDetails?.name ?? event.organizer, ...(safeWebUrl(event.organizerDetails?.website ?? '', options?.siteUrl) ? { url: safeWebUrl(event.organizerDetails!.website, options?.siteUrl) } : {}) };

	return record;
}

/** Safe JSON serialization for an HTML script element; preserves JSON values. */
export function serializeJsonLd(record: Record<string, unknown>): string {
	return JSON.stringify(record).replaceAll("<", "\\u003c");
}
