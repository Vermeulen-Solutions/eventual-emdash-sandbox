import type { EventRecurrence } from "./domain/event";
import { isDateOnly } from "./domain/date-time";
import { validRecurrence } from "./domain/recurrence-rule";

// Deliberately restricted to the vocabulary supported by matches() below.
// Adding a schema keyword requires adding its runtime validation here as well.
interface JsonSchema {
	type?: "object" | "string" | "integer" | "number" | "boolean" | "array" | "null";
	properties?: Record<string, JsonSchema>;
	required?: string[];
	additionalProperties?: boolean | JsonSchema;
	maxProperties?: number;
	minLength?: number;
	maxLength?: number;
	minimum?: number;
	maximum?: number;
	minItems?: number;
	maxItems?: number;
	items?: JsonSchema;
	enum?: readonly string[];
	const?: string | number;
	anyOf?: JsonSchema[];
	oneOf?: JsonSchema[];
}

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
const monthlyPosition: JsonSchema = {
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
	organizerId: str(0, 200),
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
	locationType,
	virtualUrl: str(0, 2048),
	status: eventStatus,
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
const organizerFields = { name: str(1, 200), website: str(0, 2048), contactUrl: str(0, 2048) };
const createOrganizer = obj(organizerFields, ['name']);
const updateOrganizer = obj({ id: str(1, 200), expectedUpdatedAt: str(1, 32), patch: obj(organizerFields) }, ['id', 'expectedUpdatedAt', 'patch']);
const timestamps = { id: str(1, 200), createdAt: str(1, 32), updatedAt: str(1, 32) };
const history = obj({ start: str(1, 32), end: str(1, 32), allDay: bool, timezone: str(1, 100), changedAt: str(1, 32) }, ['start', 'end', 'allDay', 'timezone', 'changedAt']);
const savedException = obj({ recurrenceId: str(1, 16), status: enm(['cancelled', 'modified']), overrides: obj({ ...exceptionOverride.properties, imageMediaId: str(0, 200) }) }, ['recurrenceId', 'status']);
const savedEvent = obj({ ...eventFields, ...timestamps, published: bool, exceptions: arr(savedException, 500), scheduleHistory: arr(history, 10), previousStartDate: str(1, 32) }, ['id', 'title', 'description', 'start', 'end', 'allDay', 'timezone', 'location', 'organizer', 'externalUrl', 'imageUrl', 'categories', 'published', 'exceptions', 'createdAt', 'updatedAt']);
const savedSchemas = { events: savedEvent, venues: obj({ ...venueFields, ...timestamps }, Object.keys({ ...venueFields, ...timestamps })), organizers: obj({ ...organizerFields, ...timestamps }, Object.keys({ ...organizerFields, ...timestamps })) };
// Record payloads come from exportRecords or the host converters. Advertise an
// opaque object to avoid repeating the entire storage schema in the manifest;
// validate each against the complete collection-specific schema below.
const transferInput = obj({ collection: enm(['events', 'venues', 'organizers']), source: str(1, 200), mode: enm(['copy', 'restore']), records: arr(obj({ sourceId: str(1, 200), data: { type: 'object', additionalProperties: true } }, ['sourceId', 'data']), 10, 1) }, ['collection', 'source', 'records']);
const exportRecords = obj({ collection: enm(['events', 'venues', 'organizers']), cursor: str(1, 2000), limit: int(1, 10) }, ['collection']);
const migrateToNative = obj({
	locale: str(1, 20),
	venueCollection: str(1, 100),
	dryRun: bool,
	cursor: str(1, 4000),
	limit: int(1, 100),
	venueMapping: { type: "object", additionalProperties: str(1,200), maxProperties:1000 },
});

// EmDash 1.0.1's declaration only lists Zod, but the installed CLI and host
// also accept JSON Schema. Keep this compatibility assertion at the boundary;
// these objects do not pretend to implement Zod's safeParse API.
const mcpInput = (schema: JsonSchema) => schema as unknown as import("zod").ZodType;

export const mcpSchemas = {
	listEvents, getEvent: eventId, listOccurrences, createEvent: event, updateEvent,
	publishEvent: eventId, unpublishEvent: eventId, deleteEvent: eventId,
	setOccurrenceException: exceptionSet, removeOccurrenceException: exceptionRemove,
	listVenues: noInput, createVenue: venue, updateVenue, deleteVenue: venueId,
	getSettings: noInput, updateSettings,
	listOrganizers: noInput, createOrganizer, updateOrganizer,
	previewImport: transferInput, importRecords: transferInput, exportRecords,
	migrateToNative,
};

/** Validate the JSON Schema vocabulary used by our tool definitions. */
function matches(schema: JsonSchema, value: unknown): boolean {
	if (schema.anyOf) return schema.anyOf.some((item) => matches(item, value));
	if (schema.oneOf) return schema.oneOf.filter((item) => matches(item, value)).length === 1;
	if ("const" in schema && value !== schema.const) return false;
	if (schema.enum && !schema.enum.some((item) => item === value)) return false;
	switch (schema.type) {
		case "null": return value === null;
		case "boolean": return typeof value === "boolean";
		case "number": case "integer":
			return typeof value === "number" && Number.isFinite(value) && (schema.type !== "integer" || Number.isInteger(value))
				&& (schema.minimum === undefined || value >= Number(schema.minimum)) && (schema.maximum === undefined || value <= Number(schema.maximum));
		case "string": return typeof value === "string" && value.length >= Number(schema.minLength ?? 0) && value.length <= Number(schema.maxLength ?? Infinity);
		case "array": return Array.isArray(value) && value.length >= Number(schema.minItems ?? 0) && value.length <= Number(schema.maxItems ?? Infinity)
			&& value.every((item) => !!schema.items && matches(schema.items, item));
		case "object": {
			if (!value || typeof value !== "object" || Array.isArray(value)) return false;
			const record = value as Record<string, unknown>;
			if (schema.maxProperties !== undefined && Object.keys(record).length > schema.maxProperties) return false;
			const properties = schema.properties;
			if (!properties) return schema.additionalProperties === true || typeof schema.additionalProperties==='object' && Object.values(record).every(value=>matches(schema.additionalProperties as JsonSchema,value));
			return (schema.required ?? []).every((key) => Object.hasOwn(record, key) && record[key] !== undefined)
				&& Object.keys(record).every((key) => Object.hasOwn(properties, key) && (record[key] === undefined || matches(properties[key]!, record[key])));
		}
		default: return false;
	}
}

export function validateMcpInput(name: keyof typeof mcpSchemas, value: unknown): boolean {
	if (!matches(mcpSchemas[name], value)) return false;
	const record = value as Record<string, unknown>;
	if (["listEvents", "listOccurrences"].includes(name)) {
		if ([record.from, record.through].some((date) => date !== undefined && !isDateOnly(date as string))) return false;
	}
	const fields = name === "createEvent" ? record : name === "updateEvent" ? record.patch as Record<string, unknown> : undefined;
	if (fields?.recurrence != null && !validRecurrence(fields.recurrence)) return false;
	return true;
}

/** Transfer envelopes are validated separately so bad records have row errors. */
export function validateSavedRecord(collection: keyof typeof savedSchemas, data: unknown): boolean {
	return matches(savedSchemas[collection], data);
}

export const mcpTools = {
	previewImport: { description: 'Validate up to 10 JSON records without writing. Reports errors and existing IDs per row; imported events are always drafts. Restore preserves IDs; copy uses stable source IDs.', route: 'mcp/transfer/preview', input: mcpInput(transferInput), destructive: false },
	importRecords: { description: 'Import up to 10 validated records as drafts, inserting only absent IDs atomically. Existing records are skipped, never overwritten. Import venues and organizers before events. Preview first.', route: 'mcp/transfer/import', input: mcpInput(transferInput), destructive: false },
	exportRecords: { description: 'Export a page of stored JSON event, venue, or organizer records, including drafts and recurrence exceptions. Follow nextCursor until absent. This is a data export, not a media or site backup.', route: 'mcp/transfer/export', input: mcpInput(exportRecords), destructive: false },
	listOrganizers: { description: 'List saved organizers and their public website and contact URL.', route: 'mcp/organizers/list', input: mcpInput(noInput), destructive: false },
	createOrganizer: { description: 'Create a saved organizer with public HTTP(S) URLs. Do not include private contact details.', route: 'mcp/organizers/create', input: mcpInput(createOrganizer), destructive: false },
	updateOrganizer: { description: 'Update an organizer using its expectedUpdatedAt version to prevent lost edits.', route: 'mcp/organizers/update', input: mcpInput(updateOrganizer), destructive: true },
	listEvents: { description: "List published Eventual occurrences in a date range; set includeDrafts to include drafts.", route: "mcp/events/list", input: mcpInput(listEvents), destructive: false },
	getEvent: { description: "Get an Eventual event series, including recurrence rules and occurrence exceptions.", route: "mcp/events/get", input: mcpInput(eventId), destructive: false },
	listOccurrences: { description: "Inspect saved event occurrences, including cancellations and moved dates, in up to 366 inclusive dates. Returns original recurrenceIds for exception tools, local schedules, and truncation metadata; drafts are included.", route: "mcp/events/occurrences", input: mcpInput(listOccurrences), destructive: false },
	createEvent: { description: "Create an unpublished Eventual event. Timed values use local YYYY-MM-DDTHH:mm in the supplied IANA timezone.", route: "mcp/events/create", input: mcpInput(event), destructive: false },
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
	migrateToNative: {
		description: "Migrate legacy Eventual plugin storage records (venues, events, recurrence rules, exceptions) to native EmDash collections with Portable Text and target locale. Supports dryRun preview.",
		route: "mcp/transfer/migrateToNative",
		input: mcpInput(migrateToNative),
		destructive: true,
	},
};

export type McpEventInput = {
	title: string; description?: string; start: string; end: string; allDay: boolean; timezone?: string;
	location?: string; locationType?: "physical" | "virtual" | "hybrid"; virtualUrl?: string;
	status?: "draft" | "published" | "cancelled" | "postponed" | "rescheduled";
	organizer?: string; organizerId?: string; externalUrl?: string; imageUrl?: string; imageMediaId?: string;
	categories?: string[]; venueId?: string; recurrence?: EventRecurrence | null;
};
