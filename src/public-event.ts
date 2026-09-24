import type { EventRecord, VenueRecord } from "./domain/event";
import { normalizeCategories } from "./domain/category";
import { publicEventImageUrl } from "./domain/image";
import { directionsUrl, eventLocation, formatVenueAddress } from "./domain/venue";

export interface PublicEvent {
	id: string;
	updatedAt: string;
	title: string;
	description: string;
	start: string;
	end: string;
	allDay: boolean;
	timezone: string;
	location: string;
	organizer: string;
	externalUrl: string;
	imageUrl: string;
	categories: string[];
	venue: { id: string; name: string; address: string } | null;
	directionsUrl: string;
}

export function formatPublicEvent(
	event: EventRecord,
	venue: VenueRecord | undefined,
	pluginId = "eventual",
): PublicEvent {
	const location = eventLocation(venue, event.location);
	const baseEventId = event.id.split("#", 1)[0]!;
	const result: PublicEvent = {
		id: event.id,
		updatedAt: event.updatedAt,
		title: event.title,
		description: event.description,
		start: event.start,
		end: event.end,
		allDay: event.allDay,
		timezone: event.timezone,
		location,
		organizer: event.organizer,
		externalUrl: event.externalUrl,
		imageUrl: event.imageUrl || (event.imageMediaId ? publicEventImageUrl(pluginId, baseEventId) : ""),
		categories: normalizeCategories(event.categories),
		venue: venue ? { id: venue.id, name: venue.name, address: formatVenueAddress(venue) } : null,
		directionsUrl: directionsUrl(location),
	};
	return result;
}
