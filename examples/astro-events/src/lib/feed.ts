export interface PublicVenue {
	id: string;
	name: string;
	address: string;
}

export interface PublicEvent {
	id: string;
	updatedAt?: string;
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
	venue: PublicVenue | null;
	directionsUrl: string;
}

export interface PublicFeed {
	ok: true;
	from: string;
	through: string;
	events: PublicEvent[];
}

export class FeedError extends Error {
	constructor(message: string, readonly status = 502) {
		super(message);
		this.name = "FeedError";
	}
}

export async function fetchPublicFeed(
	apiOrigin: string,
	from: string,
	through: string,
	category = "",
): Promise<PublicFeed> {
	let url: URL;
	try {
		url = new URL("/_emdash/api/plugins/eventual/publicEvents", apiOrigin);
	} catch {
		throw new FeedError("Set EVENTUAL_API_ORIGIN to a reachable HTTP(S) EmDash site.", 502);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new FeedError("Set EVENTUAL_API_ORIGIN to a reachable HTTP(S) EmDash site.", 502);
	}
	url.searchParams.set("from", from);
	url.searchParams.set("through", through);
	if (category) url.searchParams.set("category", category);

	let response: Response;
	try {
		response = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
	} catch {
		throw new FeedError("The Eventual API could not be reached.", 502);
	}
	if (!response.ok) throw new FeedError(`The Eventual API returned HTTP ${response.status}.`, 502);

	let envelope: unknown;
	try {
		envelope = await response.json();
	} catch {
		throw new FeedError("The Eventual API returned invalid JSON.", 502);
	}
	if (!isRecord(envelope) || envelope.success !== true || !isRecord(envelope.data)) {
		throw new FeedError("The Eventual API returned an unsuccessful response.", 502);
	}
	if (envelope.data.ok !== true) {
		const error = typeof envelope.data.error === "string" ? envelope.data.error : "The event feed could not be loaded.";
		throw new FeedError(error, 502);
	}
	if (!Array.isArray(envelope.data.events) || !envelope.data.events.every(isPublicEvent)) {
		throw new FeedError("The Eventual API returned an invalid event list.", 502);
	}
	if (typeof envelope.data.from !== "string" || typeof envelope.data.through !== "string") {
		throw new FeedError("The Eventual API returned an invalid date range.", 502);
	}
	return {
		ok: true,
		from: envelope.data.from,
		through: envelope.data.through,
		events: envelope.data.events,
	};
}

function isPublicEvent(value: unknown): value is PublicEvent {
	if (!isRecord(value)) return false;
	if (!(typeof value.id === "string"
		&& typeof value.title === "string"
		&& typeof value.description === "string"
		&& typeof value.start === "string"
		&& typeof value.end === "string"
		&& typeof value.allDay === "boolean"
		&& typeof value.timezone === "string"
		&& typeof value.location === "string"
		&& typeof value.organizer === "string"
		&& typeof value.externalUrl === "string"
		&& typeof value.imageUrl === "string"
		&& Array.isArray(value.categories)
		&& value.categories.every((category) => typeof category === "string")
		&& (value.venue === null || (isRecord(value.venue)
			&& typeof value.venue.id === "string"
			&& typeof value.venue.name === "string"
			&& typeof value.venue.address === "string"))
		&& typeof value.directionsUrl === "string")) return false;
	if (value.updatedAt !== undefined && (typeof value.updatedAt !== "string" || !isInstant(value.updatedAt))) return false;
	if (value.allDay) {
		if (!isDateOnly(value.start) || !isDateOnly(value.end) || value.end < value.start) return false;
	} else {
		if (!isInstant(value.start) || !isInstant(value.end) || !isTimeZone(value.timezone)) return false;
		if (Date.parse(value.end) < Date.parse(value.start)) return false;
	}
	return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInstant(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return false;
	return Number.isFinite(Date.parse(value));
}

function isDateOnly(value: unknown): value is string {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTimeZone(value: string): boolean {
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return true;
	} catch {
		return false;
	}
}
