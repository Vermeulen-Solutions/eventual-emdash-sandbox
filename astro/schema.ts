import type { PublicEvent } from "./feed";

export interface EventJsonLdOptions {
	siteUrl?: string;
}

/**
 * Generates Schema.org JSON-LD structured data for an Eventual event.
 * Follows schema.org/Event with attendance modes, event statuses, and locations.
 */
export function eventToJsonLd(event: PublicEvent, _options?: EventJsonLdOptions): Record<string, unknown> {
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

	let location: Record<string, unknown> | undefined;
	if (event.locationType === "virtual") {
		if (event.virtualUrl) {
			location = { "@type": "VirtualLocation", url: event.virtualUrl };
		}
	} else if (event.venue) {
		location = {
			"@type": "Place",
			name: event.venue.name,
			...(event.venue.address ? { address: { "@type": "PostalAddress", streetAddress: event.venue.address } } : {}),
		};
	} else if (event.location) {
		location = { "@type": "Place", name: event.location };
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
	if (event.imageUrl) record.image = event.imageUrl;
	if (event.externalUrl) record.url = event.externalUrl;
	if (location) record.location = location;
	if (event.organizer) record.organizer = { "@type": "Organization", name: event.organizer };

	return record;
}
