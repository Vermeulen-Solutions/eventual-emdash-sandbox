import type { EventRecurrence } from "./domain/event";
import { isDateOnly } from "./domain/date-time";
import { validRecurrence } from "./domain/recurrence-rule";

type JsonSchema = Record<string, unknown>;

const obj = (properties: Record<string, JsonSchema>, required?: string[]): JsonSchema => ({
	type: "object",
	properties,
	...(required && required.length > 0 ? { required } : {}),
	additionalProperties: false,
});
const str = (min = 0, max = 12000): JsonSchema => ({
	type: "string",
	...(min > 0 ? { minLength: min } : {}),
	maxLength: max,
});
const dateStr: JsonSchema = { type: "string" };
const int = (min?: number, max?: number): JsonSchema => ({
	type: "integer",
	...(min !== undefined ? { minimum: min } : {}),
	...(max !== undefined ? { maximum: max } : {}),
});
const bool: JsonSchema = { type: "boolean" };
const enm = (values: readonly string[]): JsonSchema => ({
	type: "string",
	enum: values,
});
const arr = (items: JsonSchema, maxItems?: number, minItems?: number): JsonSchema => ({
	type: "array",
	items,
	...(maxItems !== undefined ? { maxItems } : {}),
	...(minItems !== undefined ? { minItems } : {}),
});

const weekday = enm(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
const monthlyPosition = {
	anyOf: [
		{ type: "number", const: 1 },
		{ type: "number", const: 2 },
		{ type: "number", const: 3 },
		{ type: "number", const: 4 },
		{ type: "number", const: 5 },
		{ type: "string", const: "last" },
	],
};
const recurrence: JsonSchema = {
	oneOf: [
		obj({ frequency: { type: "string", const: "daily" }, until: dateStr, interval: int(1, 52) }, ["frequency", "until"]),
		obj({
			frequency: { type: "string", const: "weekly" },
			until: dateStr,
			interval: int(1, 52),
			weekdays: arr(weekday, 7, 1),
		}, ["frequency", "until"]),
		obj({
			frequency: { type: "string", const: "monthly" },
			until: dateStr,
			interval: int(1, 52),
			pattern: {
				oneOf: [
					obj({
						type: { type: "string", const: "dayOfMonth" },
						dayOfMonth: int(1, 31),
						missingDayBehavior: enm(["skip", "lastDay"]),
					}, ["type", "dayOfMonth", "missingDayBehavior"]),
					obj({
						type: { type: "string", const: "weekdayOfMonth" },
						weekday,
						position: monthlyPosition,
					}, ["type", "weekday", "position"]),
				],
			},
		}, ["frequency", "until", "pattern"]),
	],
};

const locationType = enm(["physical", "virtual", "hybrid"]);
const eventStatus = enm(["draft", "published", "cancelled", "postponed", "rescheduled"]);
const categories = arr(str(0, 100), 30);
const eventFields = {
	title: str(1, 200),
	description: str(0, 12000),
	start: str(1, 32),
	end: str(1, 32),
	allDay: bool,
	timezone: str(1, 100),
	location: str(0, 500),
	locationType,
	virtualUrl: str(0, 2048),
	status: eventStatus,
	organizer: str(0, 300),
	externalUrl: str(0, 2048),
	imageUrl: str(0, 2048),
	imageMediaId: str(0, 200),
	categories,
	venueId: str(0, 200),
	recurrence,
};

const eventId = obj({ id: str(1, 200) }, ["id"]);
const event = obj(eventFields, ["title", "start", "end", "allDay"]);
const eventPatch = obj({
	...eventFields,
	recurrence: { anyOf: [recurrence, { type: "null" }] },
});

const venueFields = {
	name: str(1, 200),
	street: str(0, 300),
	street2: str(0, 300),
	locality: str(0, 150),
	region: str(0, 150),
	postalCode: str(0, 40),
	country: str(0, 100),
};
const venue = obj(venueFields, ["name"]);
const venueId = obj({ id: str(1, 200) }, ["id"]);
const venuePatch = obj(venueFields);
const updateEvent = obj({ id: str(1, 200), patch: eventPatch }, ["id", "patch"]);
const updateVenue = obj({ id: str(1, 200), patch: venuePatch }, ["id", "patch"]);

const exceptionOverride = obj({
	title: str(1, 200),
	description: str(0, 12000),
	start: str(1, 32),
	end: str(1, 32),
	allDay: bool,
	timezone: str(1, 100),
	location: str(0, 500),
	organizer: str(0, 300),
	externalUrl: str(0, 2048),
	imageUrl: str(0, 2048),
	categories,
});
const exceptionSet = obj({
	eventId: str(1, 200),
	recurrenceId: str(0, 16),
	status: enm(["cancelled", "modified"]),
	overrides: exceptionOverride,
}, ["eventId", "recurrenceId", "status"]);
const exceptionRemove = obj({
	eventId: str(1, 200),
	recurrenceId: str(0, 16),
}, ["eventId", "recurrenceId"]);
const noInput = obj({});
const listEvents = obj({
	from: dateStr,
	through: dateStr,
	includeDrafts: bool,
	limit: int(1, 100),
});
const listOccurrences = obj({
	id: str(1, 200),
	from: dateStr,
	through: dateStr,
	limit: int(1, 100),
}, ["id"]);
const updateSettings = obj({ defaultTimezone: str(1, 100) }, ["defaultTimezone"]);

const validateEventInput = (val: any): boolean => {
	if (!val || typeof val !== "object") return false;
	if (typeof val.title !== "string" || val.title.length < 1 || val.title.length > 200) return false;
	if (typeof val.start !== "string" || !val.start) return false;
	if (typeof val.end !== "string" || !val.end) return false;
	if (typeof val.allDay !== "boolean") return false;
	if (val.recurrence !== undefined && val.recurrence !== null && !validRecurrence(val.recurrence)) return false;
	return true;
};

const validateListOccurrences = (val: any): boolean => {
	if (!val || typeof val !== "object") return false;
	if (typeof val.id !== "string" || !val.id) return false;
	if (val.from !== undefined && (typeof val.from !== "string" || !isDateOnly(val.from))) return false;
	if (val.through !== undefined && (typeof val.through !== "string" || !isDateOnly(val.through))) return false;
	if (val.limit !== undefined && (typeof val.limit !== "number" || !Number.isInteger(val.limit) || val.limit < 1 || val.limit > 100)) return false;
	return true;
};

const mcpInput = (schema: JsonSchema, validator?: (val: any) => boolean) => ({
	...schema,
	safeParse: (val: any) => {
		if (validator && !validator(val)) {
			return { success: false, error: new Error("Validation error") };
		}
		return { success: true, data: val };
	},
}) as any;

export const mcpTools = {
	listEvents: { description: "List published Eventual occurrences in a date range; set includeDrafts to include drafts.", route: "mcp/events/list", input: mcpInput(listEvents), destructive: false },
	getEvent: { description: "Get an Eventual event series, including recurrence rules and occurrence exceptions.", route: "mcp/events/get", input: mcpInput(eventId), destructive: false },
	listOccurrences: { description: "Inspect saved event occurrences, including cancellations and moved dates, in up to 366 inclusive dates. Returns original recurrenceIds for exception tools, local schedules, and truncation metadata; drafts are included.", route: "mcp/events/occurrences", input: mcpInput(listOccurrences, validateListOccurrences), destructive: false },
	createEvent: { description: "Create an unpublished Eventual event. Timed values use local YYYY-MM-DDTHH:mm in the supplied IANA timezone.", route: "mcp/events/create", input: mcpInput(event, validateEventInput), destructive: false },
	updateEvent: { description: "Update event fields while retaining valid recurrence exceptions. Timed values use local YYYY-MM-DDTHH:mm in the event timezone.", route: "mcp/events/update", input: mcpInput(updateEvent), destructive: true },
	publishEvent: { description: "Publish an Eventual event and its active occurrences.", route: "mcp/events/publish", input: mcpInput(eventId), destructive: true },
	unpublishEvent: { description: "Unpublish an Eventual event while retaining its data and calendar cancellation tombstones.", route: "mcp/events/unpublish", input: mcpInput(eventId), destructive: true },
	deleteEvent: { description: "Permanently delete an Eventual event and retain calendar cancellation tombstones.", route: "mcp/events/delete", input: mcpInput(eventId), destructive: true },
	setOccurrenceException: { description: "Cancel or modify one scheduled occurrence. recurrenceId is the original local date or local datetime; replacement times use the replacement timezone.", route: "mcp/events/exception/set", input: mcpInput(exceptionSet), destructive: true },
	removeOccurrenceException: { description: "Restore one occurrence by removing its cancellation or modification exception.", route: "mcp/events/exception/remove", input: mcpInput(exceptionRemove), destructive: true },
	listVenues: { description: "List saved Eventual venues and their structured addresses.", route: "mcp/venues/list", input: mcpInput(noInput), destructive: false },
	createVenue: { description: "Create a saved Eventual venue.", route: "mcp/venues/create", input: mcpInput(venue), destructive: false },
	updateVenue: { description: "Update a saved Eventual venue.", route: "mcp/venues/update", input: mcpInput(updateVenue), destructive: true },
	deleteVenue: { description: "Delete an unassigned Eventual venue. Assigned venues cannot be deleted.", route: "mcp/venues/delete", input: mcpInput(venueId), destructive: true },
	getSettings: { description: "Read Eventual settings, including the default timezone for new events.", route: "mcp/settings/get", input: mcpInput(noInput), destructive: false },
	updateSettings: { description: "Set Eventual's default IANA timezone for new events.", route: "mcp/settings/update", input: mcpInput(updateSettings), destructive: true },
};

export type McpEventInput = {
	title: string; description?: string; start: string; end: string; allDay: boolean; timezone?: string;
	location?: string; locationType?: "physical" | "virtual" | "hybrid"; virtualUrl?: string;
	status?: "draft" | "published" | "cancelled" | "postponed" | "rescheduled";
	organizer?: string; externalUrl?: string; imageUrl?: string; imageMediaId?: string;
	categories?: string[]; venueId?: string; recurrence?: EventRecurrence | null;
};
