import { normalizeEventStatus } from "./domain/event-data";
import type { EventRecord, VenueRecord, OrganizerRecord } from "./domain/event";
import { normalizeCategories } from "./domain/category";
import { publicEventImageUrl } from "./domain/image";
import { directionsUrl, eventLocation, formatVenueAddress, safeHttpUrl } from "./domain/venue";

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
	locationType?: "physical" | "virtual" | "hybrid";
	virtualUrl?: string;
	status?: "draft" | "published" | "cancelled" | "postponed" | "rescheduled";
	organizer: string;
	organizerDetails?: { id: string; name: string; website: string; contactUrl: string };
	previousStartDate?: string;
	externalUrl: string;
	imageUrl: string;
	categories: string[];
	venue: { id: string; name: string; address: string; addressParts?: Omit<VenueRecord, "id" | "name" | "createdAt" | "updatedAt"> } | null;
	directionsUrl: string;
}

export function formatPublicEvent(
	event: EventRecord,
	venue: VenueRecord | undefined,
	pluginId = "eventual",
	organizer?: OrganizerRecord,
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
		locationType: event.locationType ?? "physical",
		...(safeHttpUrl(event.virtualUrl ?? "") ? { virtualUrl: safeHttpUrl(event.virtualUrl ?? "") } : {}),
		status: normalizeEventStatus(event.published, event.status),
		organizer: organizer?.name ?? event.organizer,
		...(organizer ? { organizerDetails: { id: organizer.id, name: organizer.name, website: safeHttpUrl(organizer.website), contactUrl: safeHttpUrl(organizer.contactUrl) } } : {}),
		...(event.status === 'rescheduled' && event.previousStartDate ? { previousStartDate: event.previousStartDate } : {}),
		externalUrl: event.externalUrl,
		imageUrl: event.imageUrl || (event.imageMediaId ? publicEventImageUrl(pluginId, baseEventId) : ""),
		categories: normalizeCategories(event.categories),
		venue: venue ? { id: venue.id, name: venue.name, address: formatVenueAddress(venue), addressParts: { street: venue.street, street2: venue.street2, locality: venue.locality, region: venue.region, postalCode: venue.postalCode, country: venue.country } } : null,
		directionsUrl: directionsUrl(location),
	};
	return result;
}
