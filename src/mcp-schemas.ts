import { z } from "../node_modules/zod/mini/index.js";
import type { EventRecurrence } from "./domain/event";

const str = (min = 0, max = 12000, pattern?: RegExp) => z.string().check(
	...(min ? [z.minLength(min)] : []), z.maxLength(max), ...(pattern ? [z.regex(pattern)] : []),
);
const optional = (schema: any) => z.optional(schema);
const date = z.string().check(z.refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), { error: "Use a valid YYYY-MM-DD date." }));
const weekday = z.enum(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
const monthlyPosition = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal("last")]);
const recurrence = z.discriminatedUnion("frequency", [
	z.object({ frequency: z.enum(["daily", "weekly"]), until: date }),
	z.object({
		frequency: z.literal("monthly"), until: date,
		pattern: z.discriminatedUnion("type", [
			z.object({ type: z.literal("dayOfMonth"), dayOfMonth: z.number().check(z.int(), z.minimum(1), z.maximum(31)), missingDayBehavior: z.enum(["skip", "lastDay"]) }),
			z.object({ type: z.literal("weekdayOfMonth"), weekday, position: monthlyPosition }),
		]),
	}),
]);
const categories = z.array(str(0, 100)).check(z.maxLength(30));
const eventFields = {
	title: str(1, 200), description: optional(str()), start: str(1, 32), end: str(1, 32), allDay: z.boolean(),
	timezone: optional(str(1, 100)), location: optional(str(0, 500)), organizer: optional(str(0, 300)),
	externalUrl: optional(str(0, 2048)), imageUrl: optional(str(0, 2048)), imageMediaId: optional(str(0, 200)),
	categories: optional(categories), venueId: optional(str(0, 200)), recurrence: optional(recurrence),
};
const eventId = z.object({ id: str(1, 200) });
const event = z.object(eventFields);
const eventPatch = z.object({
	title: optional(eventFields.title), description: optional(str()), start: optional(str(1, 32)), end: optional(str(1, 32)),
	allDay: optional(z.boolean()), timezone: optional(str(1, 100)), location: optional(str(0, 500)), organizer: optional(str(0, 300)),
	externalUrl: optional(str(0, 2048)), imageUrl: optional(str(0, 2048)), imageMediaId: optional(str(0, 200)),
	categories: optional(categories), venueId: optional(str(0, 200)), recurrence: optional(z.nullable(recurrence)),
});
const venue = z.object({
	name: str(1, 200), street: optional(str(0, 300)), street2: optional(str(0, 300)), locality: optional(str(0, 150)),
	region: optional(str(0, 150)), postalCode: optional(str(0, 40)), country: optional(str(0, 100)),
});
const venueId = z.object({ id: str(1, 200) });
const venuePatch = z.object({
	name: optional(str(1, 200)), street: optional(str(0, 300)), street2: optional(str(0, 300)), locality: optional(str(0, 150)),
	region: optional(str(0, 150)), postalCode: optional(str(0, 40)), country: optional(str(0, 100)),
});
const updateEvent = z.object({ id: str(1, 200), patch: eventPatch });
const updateVenue = z.object({ id: str(1, 200), patch: venuePatch });
const exceptionOverride = z.object({
	title: optional(str(1, 200)), description: optional(str()), start: optional(str(1, 32)), end: optional(str(1, 32)),
	allDay: optional(z.boolean()), timezone: optional(str(1, 100)), location: optional(str(0, 500)), organizer: optional(str(0, 300)),
	externalUrl: optional(str(0, 2048)), imageUrl: optional(str(0, 2048)), categories: optional(categories),
});
const exceptionSet = z.object({ eventId: str(1, 200), recurrenceId: str(0, 16), status: z.enum(["cancelled", "modified"]), overrides: optional(exceptionOverride) });
const exceptionRemove = z.object({ eventId: str(1, 200), recurrenceId: str(0, 16) });
const noInput = z.object({});
const listEvents = z.object({ from: optional(date), through: optional(date), includeDrafts: optional(z.boolean()), limit: optional(z.number().check(z.int(), z.gte(1), z.lte(100))) });
const updateSettings = z.object({ defaultTimezone: str(1, 100) });
const mcpInput = (schema: unknown) => schema as import("zod").ZodType;

export const mcpTools = {
	listEvents: { description: "List published Eventual occurrences in a date range; set includeDrafts to include drafts.", route: "mcp/events/list", input: mcpInput(listEvents), destructive: false },
	getEvent: { description: "Get an Eventual event series, including recurrence rules and occurrence exceptions.", route: "mcp/events/get", input: mcpInput(eventId), destructive: false },
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
};

export type McpEventInput = {
	title: string; description?: string; start: string; end: string; allDay: boolean; timezone?: string;
	location?: string; organizer?: string; externalUrl?: string; imageUrl?: string; imageMediaId?: string;
	categories?: string[]; venueId?: string; recurrence?: EventRecurrence | null;
};
