import type { BlockResponse } from "@emdash-cms/blocks";

import {
	EMPTY_EVENT_DRAFT,
	type EventDraft,
	type EventException,
	type EventOverride,
	type EventRecord,
	type MonthlyPosition,
	type VenueFields,
	type VenueRecord,
	type WeekdayName,
} from "./domain/event";
import { duplicateEventDraft, eventToDraft, prepareEventData } from "./domain/event-data";
import { normalizeCategories } from "./domain/category";
import { publicEventImageUrl } from "./domain/image";
import { normalizeTimeEntry, TIME_ENTRY_HELP } from "./domain/time-entry";
import {
	instantToLocalDateTime,
	isDateOnly,
	isValidTimeZone,
	localDateTimeToInstant,
} from "./domain/date-time";
import { exceptionIdsMatchRecurrence, expandEventsInDateRange, expandRecurringEvent } from "./domain/recurrence";
import { eventLocation } from "./domain/venue";
import {
	deleteEvent,
	deleteVenue,
	getEvent,
	getEventsById,
	getVenue,
	listEvents,
	listEventsByVenueId,
	listVenues,
	listVenuesById,
	putEvent,
	putVenue,
	type EventualContext,
} from "./storage";
import { isUsableEventImage, listEventImages, type EventImageOptions } from "./media";

type Interaction =
	| { type: "page_load"; page: string }
	| { type: "block_action"; action_id: string; block_id?: string; value?: unknown; page?: string }
	| { type: "form_submit"; action_id: string; block_id?: string; values: Record<string, unknown>; page?: string };

interface EventFormValues {
	title: string;
	description: string;
	startDate: string;
	startTime?: string;
	endDate: string;
	endTime?: string;
	allDay: boolean;
	timezone: string;
	location: string;
	organizer: string;
	externalUrl: string;
	imageUrl?: string;
	imageMediaId?: string;
	categories: string;
	venueId: string;
	published: boolean;
	repeatFrequency: "none" | "daily" | "weekly" | "monthly";
	recurrenceUntil: string;
	monthlyPattern: "dayOfMonth" | "weekdayOfMonth";
	missingDayBehavior: "skip" | "lastDay";
	monthlyWeekday: WeekdayName;
	monthlyPosition: MonthlyPosition;
}

interface ExceptionFormValues {
	recurrenceDate?: string;
	recurrenceTime?: string;
	status?: "cancelled" | "modified";
	overrideTitle?: string;
	overrideDescription?: string;
	overrideStartDate?: string;
	overrideStartTime?: string;
	overrideEndDate?: string;
	overrideEndTime?: string;
	overrideAllDay?: "allDay" | "timed";
	overrideTimezone?: string;
	overrideLocation?: string;
	overrideOrganizer?: string;
	overrideExternalUrl?: string;
	overrideImageUrl?: string;
	overrideCategories?: string;
}

interface ExceptionFormDraft {
	recurrenceDate: string;
	recurrenceTime: string;
	status: "cancelled" | "modified";
	overrideTitle: string;
	overrideDescription: string;
	overrideStartDate: string;
	overrideStartTime: string;
	overrideEndDate: string;
	overrideEndTime: string;
	overrideAllDay: "allDay" | "timed";
	overrideTimezone: string;
	overrideLocation: string;
	overrideOrganizer: string;
	overrideExternalUrl: string;
	overrideImageUrl: string;
	overrideCategories: string;
}

interface VenueFormValues {
	name: string;
	street: string;
	street2: string;
	locality: string;
	region: string;
	postalCode: string;
	country: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOptionalStringFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
	return fields.every((field) => value[field] === undefined || typeof value[field] === "string");
}

function isOneOf<const Values extends readonly string[]>(value: unknown, values: Values): value is Values[number] {
	return typeof value === "string" && values.includes(value);
}

function parseInteraction(input: unknown): Interaction | null {
	if (!isRecord(input)) return null;
	if (input.type === "page_load" && typeof input.page === "string") {
		return { type: "page_load", page: input.page };
	}
	if (input.type !== "block_action" && input.type !== "form_submit") return null;
	if (typeof input.action_id !== "string" || !hasOptionalStringFields(input, ["block_id", "page"])) return null;
	if (input.type === "block_action") {
		return { type: "block_action", action_id: input.action_id, block_id: input.block_id as string | undefined, value: input.value, page: input.page as string | undefined };
	}
	if (!isRecord(input.values)) return null;
	return { type: "form_submit", action_id: input.action_id, block_id: input.block_id as string | undefined, values: input.values, page: input.page as string | undefined };
}

function parseEventValues(value: unknown): EventFormValues | null {
	if (!isRecord(value)) return null;
	const requiredStrings = ["title", "description", "startDate", "endDate", "timezone", "location", "organizer", "externalUrl", "categories", "venueId", "recurrenceUntil"];
	const optionalStrings = ["startTime", "endTime", "imageUrl", "imageMediaId"];
	if (requiredStrings.some((key) => typeof value[key] !== "string") || !hasOptionalStringFields(value, optionalStrings)) return null;
	if (typeof value.allDay !== "boolean" || typeof value.published !== "boolean") return null;
	if (!isOneOf(value.repeatFrequency, ["none", "daily", "weekly", "monthly"])) return null;
	if (!isOneOf(value.monthlyPattern, ["dayOfMonth", "weekdayOfMonth"])) return null;
	if (!isOneOf(value.missingDayBehavior, ["skip", "lastDay"])) return null;
	if (!isOneOf(value.monthlyWeekday, ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"])) return null;
	if (!isOneOf(value.monthlyPosition, ["1", "2", "3", "4", "5", "last"])) return null;
	return value as unknown as EventFormValues;
}

function parseExceptionFormValues(value: unknown): ExceptionFormValues | null {
	if (!isRecord(value)) return null;
	const strings = [
		"recurrenceDate", "recurrenceTime", "overrideTitle", "overrideDescription", "overrideStartDate",
		"overrideStartTime", "overrideEndDate", "overrideEndTime", "overrideTimezone", "overrideLocation",
		"overrideOrganizer", "overrideExternalUrl", "overrideImageUrl", "overrideCategories",
	];
	if (!hasOptionalStringFields(value, strings)) return null;
	if (value.status !== undefined && !isOneOf(value.status, ["cancelled", "modified"])) return null;
	if (value.overrideAllDay !== undefined && !isOneOf(value.overrideAllDay, ["allDay", "timed"])) return null;
	return value as ExceptionFormValues;
}

function parseVenueValues(value: unknown): VenueFormValues | null {
	if (!isRecord(value)) return null;
	const fields = ["name", "street", "street2", "locality", "region", "postalCode", "country"] as const;
	if (fields.some((field) => typeof value[field] !== "string")) return null;
	return value as unknown as VenueFormValues;
}

function pageNav(): BlockResponse["blocks"] {
	return [
		{
			type: "actions",
			elements: [
				{ type: "link", label: "Events", target: { kind: "plugin-page", path: "/events" } },
				{ type: "link", label: "Venues", target: { kind: "plugin-page", path: "/venues" } },
				{ type: "link", label: "Settings", target: { kind: "plugin-page", path: "/settings" } },
			],
		},
		{ type: "divider" },
	];
}

function textField(actionId: string, label: string, initialValue = "", multiline = false) {
	return {
		type: "text_input" as const,
		action_id: actionId,
		label,
		initial_value: initialValue,
		...(multiline ? { multiline: true } : {}),
	};
}

function selectField(
	actionId: string,
	label: string,
	options: Array<{ label: string; value: string }>,
	initialValue: string,
	condition?:
		| { field: string; eq: string; neq?: never }
		| { field: string; neq: string; eq?: never },
) {
	return { type: "select" as const, action_id: actionId, label, options, initial_value: initialValue, ...(condition ? { condition } : {}) };
}

function comboboxField(
	actionId: string,
	label: string,
	options: Array<{ label: string; value: string }>,
	initialValue: string,
	placeholder = "Search options",
) {
	return {
		type: "combobox" as const,
		action_id: actionId,
		label,
		placeholder,
		options,
		initial_value: initialValue,
	};
}

function draftTime(value: string): string {
	const separator = value.indexOf("T");
	return separator === -1 ? "" : value.slice(separator + 1);
}

function schedulePreview(draft: EventDraft): string | null {
	let preview: string;
	if (draft.allDay) {
		if (!isDateOnly(draft.start.slice(0, 10)) || !isDateOnly(draft.end.slice(0, 10))) return null;
		preview = `Schedule preview: all day, ${draft.start.slice(0, 10)} through ${draft.end.slice(0, 10)} (inclusive).`;
	} else {
		if (!isValidTimeZone(draft.timezone)) return null;
		const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
		if (!localDateTime.test(draft.start) || !localDateTime.test(draft.end)) return null;
		preview = `Schedule preview: ${draft.start.replace("T", " ")}–${draft.end.replace("T", " ")} (${draft.timezone}).`;
	}
	if (draft.repeatFrequency === "none") return preview;
	const prepared = prepareEventData(draft);
	if (!prepared.data?.recurrence) return preview;
	const startDate = draft.start.slice(0, 10);
	const limit = new Date(`${startDate}T00:00:00.000Z`);
	limit.setUTCDate(limit.getUTCDate() + 365);
	const sampleThrough = prepared.data.recurrence.until < limit.toISOString().slice(0, 10)
		? prepared.data.recurrence.until
		: limit.toISOString().slice(0, 10);
	const previewEvent: EventRecord = {
		...prepared.data,
		id: "schedule-preview",
		createdAt: "",
		updatedAt: "",
	};
	const upcoming = expandRecurringEvent(previewEvent, startDate, sampleThrough).slice(0, 3);
	if (!upcoming.length) return preview;
	const dates = upcoming.map((event) => event.allDay
		? event.start.slice(0, 10)
		: instantToLocalDateTime(event.start, event.timezone).replace("T", " "));
	return `${preview} Repeats ${prepared.data.recurrence.frequency} through ${prepared.data.recurrence.until}. Sample occurrences: ${dates.join(", ")}${upcoming.length === 3 ? " (showing up to 3)" : ""}.`;
}

function timeZoneField(
	initialValue: string,
	actionId = "timezone",
	label = "Timezone",
	defaultOption?: { label: string; value: string },
) {
	const timeZones = Intl.supportedValuesOf("timeZone");
	const values = [...new Set(["UTC", ...timeZones, initialValue].filter(Boolean))].sort((left, right) => {
		if (left === "UTC") return -1;
		if (right === "UTC") return 1;
		return left.localeCompare(right);
	});
	return {
		type: "combobox" as const,
		action_id: actionId,
		label,
		placeholder: "Search IANA timezones, e.g. Europe/Paris",
		options: [
			...(defaultOption ? [defaultOption] : []),
			...values.map((value) => ({ label: value, value })),
		],
		initial_value: initialValue,
	};
}

function eventFormBlocks(
	draft: EventDraft,
	venues: VenueRecord[],
	id: string,
	error?: string,
	images: EventImageOptions = { items: [], hasMore: false },
	duplicate = false,
): BlockResponse["blocks"] {
	const recurrenceOptions = [
		{ label: "Does not repeat", value: "none" },
		{ label: "Daily", value: "daily" },
		{ label: "Weekly", value: "weekly" },
		{ label: "Monthly", value: "monthly" },
	];
	const formBlockId = `event-form:${id || (duplicate ? "new:duplicate" : "new")}`;
	const blocks: BlockResponse["blocks"] = [
		...pageNav(),
		{ type: "header", text: id ? "Edit event" : "Add event" },
		{ type: "context", text: `Choose dates from the date picker. For timed events, enter local time such as 18:30 or 6:30 PM. The selected timezone applies to both times.` },
	];
	if (duplicate) blocks.push({ type: "context", text: "This is an unpublished copy. Dates, times, recurrence, venue, and event details were copied; review the schedule before saving. Occurrence exceptions were not copied." });
	if (id) {
		const preview = schedulePreview(draft);
		if (preview) blocks.push({ type: "section", text: preview });
	}
	if (error) blocks.push({ type: "banner", title: "Event not saved", description: error, variant: "error" });
	if (id) {
		blocks.push({
			type: "actions",
			elements: [{
				type: "button",
				action_id: "delete-event",
				label: "Delete event",
				style: "danger",
				value: id,
				confirm: { title: "Delete event?", text: "This permanently removes the event and its occurrence exceptions.", confirm: "Delete", deny: "Cancel", style: "danger" },
			}],
		});
	}
	const selectedImage = images.items.find((image) => image.id === draft.imageMediaId);
	if (selectedImage) {
		blocks.push({
			type: "image",
			url: selectedImage.url,
			alt: selectedImage.alt || selectedImage.filename,
			title: `Selected image: ${selectedImage.filename}`,
		});
	}
	blocks.push({ type: "context", text: "For a library image, upload it first from EmDash Media, then search for its filename here. External image URLs remain available as a fallback." });
	blocks.push({
		type: "form",
		block_id: formBlockId,
		fields: [
			textField("title", "Title", draft.title),
			textField("description", "Description", draft.description, true),
			{ type: "date_input", action_id: "startDate", label: "Start date", initial_value: draft.start.slice(0, 10) },
			{ ...textField("startTime", "Start time", draft.allDay ? "" : draftTime(draft.start)), placeholder: "18:30 or 6:30 PM", condition: { field: "allDay", eq: false } },
			{ type: "date_input", action_id: "endDate", label: "End date (inclusive for all-day events)", initial_value: draft.end.slice(0, 10) },
			{ ...textField("endTime", "End time", draft.allDay ? "" : draftTime(draft.end)), placeholder: "20:00 or 8:00 PM", condition: { field: "allDay", eq: false } },
			{ type: "toggle", action_id: "allDay", label: "All-day event", initial_value: draft.allDay },
			timeZoneField(draft.timezone),
			textField("location", "Location note", draft.location),
			comboboxField("venueId", "Saved venue", [
				{ label: "No saved venue", value: "" },
				...venues.map((venue) => ({ label: venue.name, value: venue.id })),
			], draft.venueId, "Search saved venues"),
			textField("organizer", "Organizer", draft.organizer),
			textField("externalUrl", "External URL", draft.externalUrl),
			comboboxField("imageMediaId", "Image from EmDash media library", [
				{ label: "No library image", value: "" },
				...images.items.map((image) => ({
					label: `${image.filename}${image.width && image.height ? ` (${image.width} × ${image.height})` : ""}`,
					value: image.id,
				})),
			], draft.imageMediaId, "Search media library"),
			{ ...textField("imageUrl", "External image URL (optional)", draft.imageUrl), condition: { field: "imageMediaId", eq: "" } },
			textField("categories", "Categories (one per line or comma-separated)", draft.categories, true),
			{ type: "toggle", action_id: "published", label: "Published on the public events route", initial_value: draft.published },
			selectField("repeatFrequency", "Repeat", recurrenceOptions, draft.repeatFrequency),
			{ type: "date_input", action_id: "recurrenceUntil", label: "Repeat through (inclusive)", initial_value: draft.recurrenceUntil, condition: { field: "repeatFrequency", neq: "none" } },
			selectField("monthlyPattern", "Monthly pattern", [
				{ label: "Same day of the month", value: "dayOfMonth" },
				{ label: "Same weekday position (for example, first Tuesday)", value: "weekdayOfMonth" },
			], draft.monthlyPattern, { field: "repeatFrequency", eq: "monthly" }),
			selectField("missingDayBehavior", "If the month has no matching day", [
				{ label: "Skip that month", value: "skip" },
				{ label: "Use the last day of the month", value: "lastDay" },
			], draft.missingDayBehavior, { field: "monthlyPattern", eq: "dayOfMonth" }),
			selectField("monthlyWeekday", "Weekday", [
				"sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
			].map((value) => ({ label: value[0]!.toUpperCase() + value.slice(1), value })), draft.monthlyWeekday, { field: "monthlyPattern", eq: "weekdayOfMonth" }),
			selectField("monthlyPosition", "Weekday position in month", [
				{ label: "First", value: "1" }, { label: "Second", value: "2" },
				{ label: "Third", value: "3" }, { label: "Fourth", value: "4" },
				{ label: "Fifth", value: "5" }, { label: "Last", value: "last" },
			], String(draft.monthlyPosition), { field: "monthlyPattern", eq: "weekdayOfMonth" }),
		],
		submit: { label: "Save event", action_id: "save-event" },
	});
	if (images.hasMore) blocks.push({ type: "context", text: "Showing the latest 100 media library images. Upload or find other images in the EmDash Media page." });
	if (draft.repeatFrequency !== "none") {
		blocks.push({
			type: "context",
			text: "Save the event first, then add or edit individual occurrence exceptions below the event form.",
		});
	}
	return blocks;
}

function blankVenue(): VenueFields {
	return { name: "", street: "", street2: "", locality: "", region: "", postalCode: "", country: "" };
}

function emptyExceptionFormDraft(event: EventRecord, exception?: EventException): ExceptionFormDraft {
	const override = exception?.overrides;
	const timezone = override?.timezone ?? event.timezone;
	const allDay = override?.allDay ?? event.allDay;
	const start = override?.start
		? allDay ? override.start.slice(0, 10) : instantToLocalDateTime(override.start, timezone)
		: "";
	const end = override?.end
		? allDay ? override.end.slice(0, 10) : instantToLocalDateTime(override.end, timezone)
		: "";
	return {
		recurrenceDate: exception?.recurrenceId.slice(0, 10) ?? "",
		recurrenceTime: exception?.recurrenceId.includes("T") ? exception.recurrenceId.slice(11, 16) : "",
		status: exception?.status ?? "cancelled",
		overrideTitle: override?.title ?? "",
		overrideDescription: override?.description ?? "",
		overrideStartDate: start.slice(0, 10),
		overrideStartTime: start.includes("T") ? start.slice(11, 16) : "",
		overrideEndDate: end.slice(0, 10),
		overrideEndTime: end.includes("T") ? end.slice(11, 16) : "",
		overrideAllDay: allDay ? "allDay" : "timed",
		overrideTimezone: override?.timezone ?? "",
		overrideLocation: override?.location ?? "",
		overrideOrganizer: override?.organizer ?? "",
		overrideExternalUrl: override?.externalUrl ?? "",
		overrideImageUrl: override?.imageUrl ?? "",
		overrideCategories: override?.categories?.join(", ") ?? "",
	};
}

function exceptionFormDraftFromValues(values: Record<string, unknown>): ExceptionFormDraft {
	const value = parseExceptionFormValues(values) ?? {};
	return {
		recurrenceDate: value.recurrenceDate ?? "",
		recurrenceTime: value.recurrenceTime ?? "",
		status: value.status ?? "cancelled",
		overrideTitle: value.overrideTitle ?? "",
		overrideDescription: value.overrideDescription ?? "",
		overrideStartDate: value.overrideStartDate ?? "",
		overrideStartTime: value.overrideStartTime ?? "",
		overrideEndDate: value.overrideEndDate ?? "",
		overrideEndTime: value.overrideEndTime ?? "",
		overrideAllDay: value.overrideAllDay ?? "timed",
		overrideTimezone: value.overrideTimezone ?? "",
		overrideLocation: value.overrideLocation ?? "",
		overrideOrganizer: value.overrideOrganizer ?? "",
		overrideExternalUrl: value.overrideExternalUrl ?? "",
		overrideImageUrl: value.overrideImageUrl ?? "",
		overrideCategories: value.overrideCategories ?? "",
	};
}

function exceptionActionValue(eventId: string, recurrenceId: string): string {
	return JSON.stringify({ eventId, recurrenceId });
}

function exceptionIdentityFromValue(value: unknown): { eventId: string; recurrenceId: string } | null {
	if (typeof value !== "string") return null;
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed !== "object" || parsed === null) return null;
		const record = parsed as Record<string, unknown>;
		return typeof record.eventId === "string" && typeof record.recurrenceId === "string"
			? { eventId: record.eventId, recurrenceId: record.recurrenceId }
			: null;
	} catch {
		return null;
	}
}

function exceptionFormIdentity(blockId: string | undefined): { eventId: string; originalRecurrenceId?: string } | null {
	const prefix = "exception-form:";
	if (!blockId?.startsWith(prefix)) return null;
	const identity = blockId.slice(prefix.length);
	const separator = identity.indexOf(":");
	if (separator <= 0) return null;
	const eventId = identity.slice(0, separator);
	const encodedRecurrenceId = identity.slice(separator + 1);
	if (encodedRecurrenceId === "new") return { eventId };
	try {
		return { eventId, originalRecurrenceId: decodeURIComponent(encodedRecurrenceId) };
	} catch {
		return null;
	}
}

function exceptionFormBlocks(
	event: EventRecord,
	draft: ExceptionFormDraft,
	originalRecurrenceId?: string,
	error?: string,
): BlockResponse["blocks"] {
	const eventTimeLabel = event.allDay ? "date" : "date and start time";
	const blocks: BlockResponse["blocks"] = [
		{ type: "header", text: originalRecurrenceId ? "Edit occurrence exception" : "Add occurrence exception" },
		{ type: "context", text: `Choose the original scheduled ${eventTimeLabel} in ${event.timezone}. Cancelled occurrences are skipped. For a changed occurrence, fill in only the details that should differ. Replacement times are local to the selected replacement timezone.` },
	];
	if (error) blocks.push({ type: "banner", title: "Exception not saved", description: error, variant: "error" });
	blocks.push({
		type: "form",
		block_id: `exception-form:${event.id}:${originalRecurrenceId ? encodeURIComponent(originalRecurrenceId) : "new"}`,
		fields: [
			{ type: "date_input", action_id: "recurrenceDate", label: "Original occurrence date", initial_value: draft.recurrenceDate },
			...(!event.allDay ? [{ ...textField("recurrenceTime", `Original start time (${event.timezone})`, draft.recurrenceTime), placeholder: "18:30 or 6:30 PM" }] : []),
			selectField("status", "What happens to this occurrence?", [
				{ label: "Cancel this occurrence", value: "cancelled" },
				{ label: "Change this occurrence", value: "modified" },
			], draft.status),
			{ ...textField("overrideTitle", "Replacement title", draft.overrideTitle), condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideDescription", "Replacement description", draft.overrideDescription, true), condition: { field: "status", eq: "modified" } },
			{ ...selectField("overrideAllDay", "Replacement event type", [
				{ label: "All-day", value: "allDay" },
				{ label: "Timed", value: "timed" },
			], draft.overrideAllDay), condition: { field: "status", eq: "modified" } },
			{ type: "date_input", action_id: "overrideStartDate", label: "Replacement start date (optional)", initial_value: draft.overrideStartDate, condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideStartTime", "Replacement start time (timed events only)", draft.overrideStartTime), placeholder: "18:30 or 6:30 PM", condition: { field: "status", eq: "modified" } },
			{ type: "date_input", action_id: "overrideEndDate", label: "Replacement end date (optional)", initial_value: draft.overrideEndDate, condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideEndTime", "Replacement end time (timed events only)", draft.overrideEndTime), placeholder: "20:00 or 8:00 PM", condition: { field: "status", eq: "modified" } },
			{ ...timeZoneField(draft.overrideTimezone, "overrideTimezone", "Replacement timezone", {
				label: `Use series timezone (${event.timezone})`, value: "",
			}), condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideLocation", "Replacement location", draft.overrideLocation), condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideOrganizer", "Replacement organizer", draft.overrideOrganizer), condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideExternalUrl", "Replacement external URL", draft.overrideExternalUrl), condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideImageUrl", "Replacement image URL", draft.overrideImageUrl), condition: { field: "status", eq: "modified" } },
			{ ...textField("overrideCategories", "Replacement categories (one per line or comma-separated)", draft.overrideCategories, true), condition: { field: "status", eq: "modified" } },
		],
		submit: { label: originalRecurrenceId ? "Save exception" : "Add exception", action_id: "save-exception" },
	});
	return blocks;
}

function eventEditorBlocks(
	event: EventRecord,
	venues: VenueRecord[],
	draft = eventToDraft(event),
	eventError?: string,
	exceptionEditor?: { draft: ExceptionFormDraft; originalRecurrenceId?: string; error?: string },
	images: EventImageOptions = { items: [], hasMore: false },
): BlockResponse["blocks"] {
	const blocks: BlockResponse["blocks"] = exceptionEditor
		? [
			...pageNav(),
			{ type: "header", text: event.title },
			{ type: "context", text: "Edit the occurrence exception below. Close the exception editor to return to the event details." },
		]
		: eventFormBlocks(draft, venues, event.id, eventError, images);
	blocks.push({ type: "divider" }, { type: "header", text: "Occurrence exceptions" });
	if (!event.recurrence) {
		blocks.push({ type: "context", text: "Set a repeat pattern and save this event before managing occurrence exceptions." });
		return blocks;
	}
	blocks.push({ type: "context", text: "Cancel or change individual dates without changing the recurring series. Exceptions are saved separately from the event details above." });
	if (!event.exceptions.length) blocks.push({ type: "context", text: "No occurrence exceptions yet." });
	for (const exception of event.exceptions) {
		const occurrenceLabel = exception.recurrenceId.replace("T", " at ");
		blocks.push(
			{ type: "section", text: `${occurrenceLabel} · ${exception.status === "cancelled" ? "Cancelled" : "Changed"}` },
			{
				type: "actions",
				elements: [
					{ type: "button", action_id: "edit-exception", label: "Edit", value: exceptionActionValue(event.id, exception.recurrenceId) },
					{
						type: "button", action_id: "remove-exception", label: "Remove exception", style: "danger",
						value: exceptionActionValue(event.id, exception.recurrenceId),
						confirm: { title: "Remove this exception?", text: "The occurrence will use the recurring event details again.", confirm: "Remove", deny: "Cancel", style: "danger" },
					},
				],
			},
		);
	}
	blocks.push({ type: "actions", elements: [{ type: "button", action_id: "add-exception", label: "Add occurrence exception", value: event.id, style: "primary" }] });
	if (exceptionEditor) {
		blocks.push(...exceptionFormBlocks(event, exceptionEditor.draft, exceptionEditor.originalRecurrenceId, exceptionEditor.error));
		blocks.push({ type: "actions", elements: [{ type: "button", action_id: "cancel-exception-edit", label: "Close exception editor", value: event.id }] });
	}
	return blocks;
}

async function renderEventForm(ctx: EventualContext, draft: EventDraft, id: string, error?: string, duplicate = false): Promise<BlockResponse> {
	const [venues, images] = await Promise.all([
		listVenues(ctx),
		listEventImages(ctx, draft.imageMediaId),
	]);
	return { blocks: eventFormBlocks(draft, venues, id, error, images, duplicate) };
}

async function renderEventEditor(
	ctx: EventualContext,
	event: EventRecord,
	draft = eventToDraft(event),
	eventError?: string,
	exceptionEditor?: { draft: ExceptionFormDraft; originalRecurrenceId?: string; error?: string },
): Promise<BlockResponse> {
	if (exceptionEditor) {
		return { blocks: eventEditorBlocks(event, [], draft, eventError, exceptionEditor) };
	}
	const [venues, images] = await Promise.all([
		listVenues(ctx),
		listEventImages(ctx, draft.imageMediaId),
	]);
	return { blocks: eventEditorBlocks(event, venues, draft, eventError, exceptionEditor, images) };
}

function eventExceptionFromForm(
	event: EventRecord,
	values: Record<string, unknown>,
	originalRecurrenceId?: string,
): { exception?: EventException; error?: string } {
	const value = parseExceptionFormValues(values);
	if (!value) return { error: "Check the occurrence date and time." };
	const date = readString(value.recurrenceDate).trim();
	if (!isDateOnly(date)) return { error: "Choose a valid original occurrence date." };
	let recurrenceId = date;
	if (!event.allDay) {
		const time = normalizeTimeEntry(readString(value.recurrenceTime));
		if ("error" in time) return { error: `Original start time: ${TIME_ENTRY_HELP}` };
		const originalStart = localDateTimeToInstant(`${date}T${time.time}`, event.timezone);
		if (!originalStart.value) return { error: originalStart.error ?? "Enter a valid original start time." };
		recurrenceId = `${date}T${time.time}`;
	}
	if (event.exceptions.some((item) => item.recurrenceId === recurrenceId && item.recurrenceId !== originalRecurrenceId)) {
		return { error: "This occurrence already has an exception. Edit that exception instead." };
	}
	const baseSeries = {
		...event,
		exceptions: event.exceptions.filter((item) => item.recurrenceId !== originalRecurrenceId && item.recurrenceId !== recurrenceId),
	};
	const occurrenceExists = expandRecurringEvent(baseSeries, date, date)
		.some((occurrence) => occurrence.id === `${event.id}#${recurrenceId}`);
	if (!occurrenceExists) return { error: "Choose a date and time that belongs to this recurring series." };
	if (value.status !== "modified") return { exception: { recurrenceId, status: "cancelled" } };
	const originalOverride = event.exceptions.find((item) => item.recurrenceId === originalRecurrenceId)?.overrides;

	const overrideTimezone = readString(value.overrideTimezone).trim();
	if (overrideTimezone && !isValidTimeZone(overrideTimezone)) {
		return { error: "Enter a valid IANA timezone for the replacement occurrence." };
	}
	const allDayChoice = value.overrideAllDay ?? (event.allDay ? "allDay" : "timed");
	const effectiveAllDay = allDayChoice === "allDay";
	const effectiveTimezone = overrideTimezone || event.timezone;
	const startDate = readString(value.overrideStartDate).trim();
	const startTime = readString(value.overrideStartTime).trim();
	const endDate = readString(value.overrideEndDate).trim();
	const endTime = readString(value.overrideEndTime).trim();
	if (Boolean(startDate) !== Boolean(endDate)) {
		return { error: "Enter both a replacement start and end, or leave both blank." };
	}
	let normalizedStartTime = startTime;
	let normalizedEndTime = endTime;
	if (!effectiveAllDay && startDate) {
		const parsedStartTime = normalizeTimeEntry(startTime);
		if ("error" in parsedStartTime) return { error: `Replacement start time: ${TIME_ENTRY_HELP}` };
		const parsedEndTime = normalizeTimeEntry(endTime);
		if ("error" in parsedEndTime) return { error: `Replacement end time: ${TIME_ENTRY_HELP}` };
		normalizedStartTime = parsedStartTime.time;
		normalizedEndTime = parsedEndTime.time;
	}
	const startInput = startDate ? effectiveAllDay ? startDate : `${startDate}T${normalizedStartTime}` : "";
	const endInput = endDate ? effectiveAllDay ? endDate : `${endDate}T${normalizedEndTime}` : "";
	const overrides: EventOverride = {};
	const title = readString(value.overrideTitle).trim();
	const description = readString(value.overrideDescription).trim();
	const location = readString(value.overrideLocation).trim();
	const organizer = readString(value.overrideOrganizer).trim();
	const externalUrl = readString(value.overrideExternalUrl).trim();
	const imageUrl = readString(value.overrideImageUrl).trim();
	const categories = normalizeCategories(readString(value.overrideCategories));
	if (title || originalOverride && "title" in originalOverride) overrides.title = title || originalOverride!.title!;
	if (description || originalOverride && "description" in originalOverride) overrides.description = description || originalOverride!.description!;
	if (location || originalOverride && "location" in originalOverride) overrides.location = location || originalOverride!.location!;
	if (organizer || originalOverride && "organizer" in originalOverride) overrides.organizer = organizer || originalOverride!.organizer!;
	if (externalUrl || originalOverride && "externalUrl" in originalOverride) overrides.externalUrl = externalUrl || originalOverride!.externalUrl!;
	if (imageUrl || originalOverride && "imageUrl" in originalOverride) overrides.imageUrl = imageUrl || originalOverride!.imageUrl!;
	if (readString(value.overrideCategories).trim() || originalOverride && "categories" in originalOverride) {
		overrides.categories = readString(value.overrideCategories).trim() ? categories : originalOverride!.categories!;
	}
	if (effectiveAllDay !== event.allDay) overrides.allDay = effectiveAllDay;
	if (overrideTimezone && overrideTimezone !== event.timezone) overrides.timezone = overrideTimezone;
	if (startInput && endInput) {
		if (effectiveAllDay) {
			if (!isDateOnly(startInput) || !isDateOnly(endInput)) {
				return { error: "For an all-day replacement, enter dates as YYYY-MM-DD." };
			}
			if (endInput < startInput) return { error: "The replacement end date must be on or after the start date." };
			overrides.start = startInput;
			overrides.end = endInput;
		} else {
			const start = localDateTimeToInstant(startInput, effectiveTimezone);
			const end = localDateTimeToInstant(endInput, effectiveTimezone);
			if (!start.value) return { error: `Replacement start: ${start.error ?? "enter a valid date and time."}` };
			if (!end.value) return { error: `Replacement end: ${end.error ?? "enter a valid date and time."}` };
			if (Date.parse(end.value) < Date.parse(start.value)) return { error: "The replacement end must be on or after the start." };
			overrides.start = start.value;
			overrides.end = end.value;
		}
	}
	if (!Object.keys(overrides).length) return { error: "Add at least one replacement detail for a changed occurrence." };
	return { exception: { recurrenceId, status: "modified", overrides } };
}

function venueFormBlocks(venue: VenueFields, id: string, error?: string): BlockResponse["blocks"] {
	const blocks: BlockResponse["blocks"] = [
		...pageNav(),
		{ type: "header", text: id ? "Edit venue" : "Add venue" },
	];
	if (error) blocks.push({ type: "banner", title: "Venue not saved", description: error, variant: "error" });
	if (id) blocks.push({
		type: "actions",
		elements: [{
			type: "button", action_id: "delete-venue", label: "Delete venue", style: "danger", value: id,
			confirm: { title: "Delete venue?", text: "A venue assigned to an event cannot be deleted.", confirm: "Delete", deny: "Cancel", style: "danger" },
		}],
	});
	blocks.push({
		type: "form",
		block_id: `venue-form:${id || "new"}`,
		fields: [
			textField("name", "Venue name", venue.name),
			textField("street", "Street address", venue.street),
			textField("street2", "Address line 2", venue.street2),
			textField("locality", "Town or city", venue.locality),
			textField("region", "Region or state", venue.region),
			textField("postalCode", "Postal code", venue.postalCode),
			textField("country", "Country", venue.country),
		],
		submit: { label: "Save venue", action_id: "save-venue" },
	});
	return blocks;
}

async function renderEvents(ctx: EventualContext, cursor?: string): Promise<BlockResponse> {
	const page = await (ctx.storage.events as import("emdash").StorageCollection<EventRecord>).query({
		orderBy: { start: "desc" }, limit: 25, cursor,
	});
	const blocks = [
		...pageNav(),
		{ type: "header" as const, text: "Events" },
		{ type: "actions" as const, elements: [{ type: "button" as const, action_id: "new-event", label: "Add event", style: "primary" as const }] },
	];
	if (!page.items.length) blocks.push({ type: "context" as const, text: "No events yet. Add a one-off event or create a recurring series." });
	for (const { data: event } of page.items) {
		const dateLabel = event.allDay ? event.start : `${instantToLocalDateTime(event.start, event.timezone)} (${event.timezone})`;
		blocks.push({
			type: "section" as const,
			text: `${event.title}\n${dateLabel} · ${event.published ? "Published" : "Draft"}${event.recurrence ? ` · ${event.recurrence.frequency}` : ""}`,
			accessory: { type: "button" as const, action_id: "edit-event", label: "Edit", value: event.id },
		});
		blocks.push({
			type: "actions" as const,
			elements: [{ type: "button" as const, action_id: "duplicate-event", label: "Duplicate", value: event.id }],
		});
	}
	if (page.hasMore && page.cursor) blocks.push({
		type: "actions" as const,
		elements: [{ type: "button" as const, action_id: "events-next", label: "Load more", value: page.cursor }],
	});
	return { blocks };
}

async function renderUpcomingWidget(ctx: EventualContext): Promise<BlockResponse> {
	const today = new Date().toISOString().slice(0, 10);
	const throughDate = new Date(`${today}T00:00:00.000Z`);
	throughDate.setUTCDate(throughDate.getUTCDate() + 90);
	const through = throughDate.toISOString().slice(0, 10);
	const events = await listEvents(ctx, { published: true, order: "asc", maxItems: 5000 });
	const upcoming = expandEventsInDateRange(events, today, through).slice(0, 4);
	const venues = await listVenuesById(ctx, upcoming.flatMap((event) => event.venueId ? [event.venueId] : []));
	const blocks: BlockResponse["blocks"] = [];
	if (!upcoming.length) {
		blocks.push({ type: "empty", title: "No upcoming events", description: "Published events scheduled in the next 90 days will appear here." });
	} else {
		for (const event of upcoming) {
			const start = event.allDay
				? new Date(`${event.start.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })
				: new Date(event.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone });
			const endDate = event.end.slice(0, 10);
			const when = event.allDay && endDate !== event.start.slice(0, 10)
				? `${start} – ${new Date(`${endDate}T00:00:00.000Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })} (inclusive)`
				: event.allDay ? `${start} (all day)` : `${start} (${event.timezone})`;
			const venue = event.venueId ? venues.get(event.venueId) : undefined;
			const location = eventLocation(venue, event.location);
			blocks.push({ type: "section", text: `${event.title}\n${when}${location ? `\n${location}` : ""}` });
		}
	}
	blocks.push({
		type: "actions",
		elements: [{ type: "link", label: "Open Eventual events", target: { kind: "plugin-page", path: "/events" } }],
	});
	return { blocks };
}

async function renderVenues(ctx: EventualContext): Promise<BlockResponse> {
	const venues = await listVenues(ctx);
	const blocks: BlockResponse["blocks"] = [
		...pageNav(),
		{ type: "header", text: "Saved venues" },
		{ type: "actions", elements: [{ type: "button", action_id: "new-venue", label: "Add venue", style: "primary" }] },
	];
	if (!venues.length) blocks.push({ type: "context", text: "No saved venues yet." });
	for (const venue of venues.slice(0, 100)) {
		blocks.push({
			type: "section",
			text: `${venue.name}\n${[venue.street, venue.locality, venue.region, venue.postalCode, venue.country].filter(Boolean).join(", ")}`,
			accessory: { type: "button", action_id: "edit-venue", label: "Edit", value: venue.id },
		});
	}
	if (venues.length > 100) blocks.push({ type: "context", text: "Showing the first 100 saved venues." });
	return { blocks };
}

async function renderSettings(ctx: EventualContext, error?: string): Promise<BlockResponse> {
	const defaultTimezone = (await ctx.settings.get<string>("defaultTimezone")) ?? "UTC";
	const blocks: BlockResponse["blocks"] = [
			...pageNav(),
			{ type: "header", text: "Event settings" },
			{ type: "context", text: "Choose the timezone used for new events. Each event can still use a different timezone." },
			{ type: "context", text: "Calendar subscription URL: /_emdash/api/plugins/eventual/calendar. Add this URL to a calendar app that supports iCalendar subscriptions." },
		];
	if (error) blocks.push({ type: "banner", title: "Settings not saved", description: error, variant: "error" });
	return {
		blocks: [
			...blocks,
			{
				type: "form",
				block_id: "settings-form",
				fields: [
					timeZoneField(defaultTimezone, "defaultTimezone", "Default timezone for new events"),
				],
				submit: { label: "Save settings", action_id: "save-settings" },
			},
		],
	};
}

function idFromBlock(blockId: string | undefined, prefix: string): string | null {
	if (!blockId?.startsWith(prefix)) return null;
	const id = blockId.slice(prefix.length);
	return id === "new" || id === "new:duplicate" ? "" : id;
}

function isDuplicateForm(blockId: string | undefined): boolean {
	return blockId === "event-form:new:duplicate";
}

function readString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function valuesToDraft(values: Record<string, unknown>): { draft: EventDraft | null; error?: string } {
	const value = parseEventValues(values);
	if (!value) return { draft: null };
	let startTime = value.startTime ?? "";
	let endTime = value.endTime ?? "";
	let timeError: string | undefined;
	if (!value.allDay) {
		const parsedStartTime = normalizeTimeEntry(startTime);
		if ("error" in parsedStartTime) timeError = `Start time: ${TIME_ENTRY_HELP}`;
		else startTime = parsedStartTime.time;
		const parsedEndTime = normalizeTimeEntry(endTime);
		if ("error" in parsedEndTime) timeError ??= `End time: ${TIME_ENTRY_HELP}`;
		else endTime = parsedEndTime.time;
	}
	const start = value.allDay ? value.startDate : `${value.startDate}T${startTime}`;
	const end = value.allDay ? value.endDate : `${value.endDate}T${endTime}`;
	return { draft: {
		title: value.title,
		description: value.description,
		start,
		end,
		allDay: value.allDay,
		timezone: value.timezone,
		location: value.location,
		organizer: value.organizer,
		externalUrl: value.externalUrl,
		imageUrl: value.imageUrl ?? "",
		imageMediaId: value.imageMediaId ?? "",
		categories: value.categories,
		venueId: value.venueId,
		published: value.published,
		repeatFrequency: value.repeatFrequency,
		recurrenceUntil: value.recurrenceUntil,
		monthlyPattern: value.monthlyPattern,
		missingDayBehavior: value.missingDayBehavior,
		monthlyWeekday: value.monthlyWeekday as WeekdayName,
		monthlyPosition: value.monthlyPosition === "last" ? "last" : Number(value.monthlyPosition) as MonthlyPosition,
		exceptions: [],
	}, ...(timeError ? { error: timeError } : {}) };
}

function submittedVenue(values: Record<string, unknown>): VenueFields | null {
	const value = parseVenueValues(values);
	if (!value) return null;
	return {
		name: value.name.trim(),
		street: value.street.trim(),
		street2: value.street2.trim(),
		locality: value.locality.trim(),
		region: value.region.trim(),
		postalCode: value.postalCode.trim(),
		country: value.country.trim(),
	};
}

export async function handleAdmin(input: unknown, ctx: EventualContext): Promise<BlockResponse> {
	const interaction = parseInteraction(input);
	if (!interaction) return { blocks: [{ type: "banner", title: "Invalid admin request", variant: "error" }] };

	if (interaction.type === "page_load") {
		if (interaction.page === "widget:upcoming-events") return renderUpcomingWidget(ctx);
		if (interaction.page === "/venues") return renderVenues(ctx);
		if (interaction.page === "/settings") return renderSettings(ctx);
		return renderEvents(ctx);
	}

	if (interaction.type === "block_action") {
		if (interaction.action_id === "new-event") {
			const timezone = (await ctx.settings.get<string>("defaultTimezone")) ?? "UTC";
			return renderEventForm(ctx, { ...EMPTY_EVENT_DRAFT, timezone }, "");
		}
		if (interaction.action_id === "edit-event" && typeof interaction.value === "string") {
			const event = await getEvent(ctx, interaction.value);
			return event
				? renderEventEditor(ctx, event)
				: { blocks: [{ type: "banner", title: "Event no longer exists", variant: "error" }] };
		}
		if (interaction.action_id === "duplicate-event" && typeof interaction.value === "string") {
			const event = await getEvent(ctx, interaction.value);
			return event
				? renderEventForm(ctx, duplicateEventDraft(event), "", undefined, true)
				: { blocks: [{ type: "banner", title: "Event no longer exists", variant: "error" }] };
		}
		if (interaction.action_id === "add-exception" && typeof interaction.value === "string") {
			const event = await getEvent(ctx, interaction.value);
			if (!event) return { blocks: [{ type: "banner", title: "Event no longer exists", variant: "error" }] };
			return renderEventEditor(ctx, event, eventToDraft(event), undefined,
				event.recurrence ? { draft: emptyExceptionFormDraft(event) } : undefined);
		}
		if (interaction.action_id === "edit-exception") {
			const identity = exceptionIdentityFromValue(interaction.value);
			if (!identity) return { blocks: [{ type: "banner", title: "Invalid exception request", variant: "error" }] };
			const event = await getEvent(ctx, identity.eventId);
			const exception = event?.exceptions.find((item) => item.recurrenceId === identity.recurrenceId);
			if (!event || !exception) return { blocks: [{ type: "banner", title: "Occurrence exception no longer exists", variant: "error" }] };
			return {
				blocks: (await renderEventEditor(ctx, event, eventToDraft(event), undefined, {
					draft: emptyExceptionFormDraft(event, exception), originalRecurrenceId: exception.recurrenceId,
				})).blocks,
			};
		}
		if (interaction.action_id === "remove-exception") {
			const identity = exceptionIdentityFromValue(interaction.value);
			if (!identity) return { blocks: [{ type: "banner", title: "Invalid exception request", variant: "error" }] };
			const event = await getEvent(ctx, identity.eventId);
			if (!event || !event.exceptions.some((item) => item.recurrenceId === identity.recurrenceId)) {
				return { blocks: [{ type: "banner", title: "Occurrence exception no longer exists", variant: "error" }] };
			}
			const updated: EventRecord = {
				...event,
				exceptions: event.exceptions.filter((item) => item.recurrenceId !== identity.recurrenceId),
				updatedAt: new Date().toISOString(),
			};
			await putEvent(ctx, updated);
			return { ...(await renderEventEditor(ctx, updated)), toast: { message: "Occurrence exception removed", type: "success" } };
		}
		if (interaction.action_id === "cancel-exception-edit" && typeof interaction.value === "string") {
			const event = await getEvent(ctx, interaction.value);
			return event
				? renderEventEditor(ctx, event)
				: { blocks: [{ type: "banner", title: "Event no longer exists", variant: "error" }] };
		}
		if (interaction.action_id === "delete-event" && typeof interaction.value === "string") {
			await deleteEvent(ctx, interaction.value);
			return { ...(await renderEvents(ctx)), toast: { message: "Event deleted", type: "success" } };
		}
		if (interaction.action_id === "new-venue") return { blocks: venueFormBlocks(blankVenue(), "") };
		if (interaction.action_id === "edit-venue" && typeof interaction.value === "string") {
			const venue = await getVenue(ctx, interaction.value);
			return venue
				? { blocks: venueFormBlocks(venue, venue.id) }
				: { blocks: [{ type: "banner", title: "Venue no longer exists", variant: "error" }] };
		}
		if (interaction.action_id === "delete-venue" && typeof interaction.value === "string") {
			if (await listEventsByVenueId(ctx, interaction.value)) {
				return { blocks: venueFormBlocks((await getVenue(ctx, interaction.value)) ?? blankVenue(), interaction.value, "This venue is assigned to one or more events."), toast: { message: "Venue is still in use", type: "error" } };
			}
			await deleteVenue(ctx, interaction.value);
			return { ...(await renderVenues(ctx)), toast: { message: "Venue deleted", type: "success" } };
		}
		if (interaction.action_id === "events-next" && typeof interaction.value === "string") return renderEvents(ctx, interaction.value);
		return { blocks: [{ type: "context", text: "No action was taken." }] };
	}

	if (interaction.action_id === "save-exception") {
		const identity = exceptionFormIdentity(interaction.block_id);
		if (!identity) return { blocks: [{ type: "banner", title: "Invalid occurrence exception form", variant: "error" }] };
		const event = await getEvent(ctx, identity.eventId);
		if (!event || !event.recurrence) {
			return { blocks: [{ type: "banner", title: "Recurring event no longer exists", variant: "error" }] };
		}
		const result = eventExceptionFromForm(event, interaction.values, identity.originalRecurrenceId);
		if (!result.exception) {
			return renderEventEditor(ctx, event, eventToDraft(event), undefined, {
					draft: exceptionFormDraftFromValues(interaction.values),
					...(identity.originalRecurrenceId ? { originalRecurrenceId: identity.originalRecurrenceId } : {}),
					error: result.error,
			});
		}
		if (identity.originalRecurrenceId && !event.exceptions.some((item) => item.recurrenceId === identity.originalRecurrenceId)) {
			return { blocks: [{ type: "banner", title: "Occurrence exception no longer exists", variant: "error" }] };
		}
		const exceptions = event.exceptions
			.filter((item) => item.recurrenceId !== identity.originalRecurrenceId && item.recurrenceId !== result.exception!.recurrenceId)
			.concat(result.exception)
			.sort((left, right) => left.recurrenceId.localeCompare(right.recurrenceId));
		const updated: EventRecord = { ...event, exceptions, updatedAt: new Date().toISOString() };
		await putEvent(ctx, updated);
		return { ...(await renderEventEditor(ctx, updated)), toast: { message: "Occurrence exception saved", type: "success" } };
	}

	if (interaction.action_id === "save-event") {
		const id = idFromBlock(interaction.block_id, "event-form:");
		const duplicate = isDuplicateForm(interaction.block_id);
		if (id === null) return { blocks: [{ type: "banner", title: "Invalid event form", variant: "error" }] };
		const { draft, error } = valuesToDraft(interaction.values);
		if (!draft) return renderEventForm(ctx, EMPTY_EVENT_DRAFT, id, error ?? "Check each event field and its date, time, and recurrence settings.", duplicate);
		if (error) return renderEventForm(ctx, draft, id, error, duplicate);
		const prepared = prepareEventData(draft);
		if (!prepared.data) {
			const previous = id ? await getEvent(ctx, id) : null;
			return previous
				? renderEventEditor(ctx, previous, draft, prepared.error)
				: renderEventForm(ctx, draft, id, prepared.error, duplicate);
		}
		if (draft.imageMediaId) {
			if (!(await isUsableEventImage(ctx, draft.imageMediaId))) {
				return renderEventForm(ctx, draft, id, "Choose a ready JPEG, PNG, GIF, WebP, or AVIF image from the media library smaller than 8 MiB.", duplicate);
			}
		}
		if (draft.venueId && !(await getVenue(ctx, draft.venueId))) {
			return renderEventForm(ctx, draft, id, "Choose a saved venue that still exists.", duplicate);
		}
		const previous = id ? await getEvent(ctx, id) : null;
		const now = new Date().toISOString();
		const event: EventRecord = {
			...prepared.data,
			id: id || crypto.randomUUID(),
			exceptions: previous?.exceptions ?? [],
			createdAt: previous?.createdAt ?? now,
			updatedAt: now,
		};
		if (!exceptionIdsMatchRecurrence(event)) {
			return renderEventEditor(ctx, previous!, draft, "Changing this recurrence would invalidate saved occurrence exceptions. Remove or update those exceptions first.");
		}
		await putEvent(ctx, event);
		return { ...(await renderEventEditor(ctx, event)), toast: { message: previous ? "Event updated" : "Event created", type: "success" } };
	}

	if (interaction.action_id === "save-venue") {
		const id = idFromBlock(interaction.block_id, "venue-form:");
		const venue = submittedVenue(interaction.values);
		if (id === null) return { blocks: [{ type: "banner", title: "Invalid venue form", variant: "error" }] };
		if (!venue || !venue.name) return { blocks: venueFormBlocks(venue ?? blankVenue(), id, "Venue name is required.") };
		const previous = id ? await getVenue(ctx, id) : null;
		const now = new Date().toISOString();
		const record: VenueRecord = {
			...venue,
			id: id || crypto.randomUUID(),
			createdAt: previous?.createdAt ?? now,
			updatedAt: now,
		};
		await putVenue(ctx, record);
		return { ...(await renderVenues(ctx)), toast: { message: previous ? "Venue updated" : "Venue created", type: "success" } };
	}

	if (interaction.action_id === "save-settings") {
		const defaultTimezone = readString(interaction.values.defaultTimezone).trim();
		if (!isValidTimeZone(defaultTimezone)) {
			return { ...await renderSettings(ctx, "Choose a valid IANA timezone."), toast: { message: "Choose a valid timezone", type: "error" } };
		}
		await ctx.settings.set("defaultTimezone", defaultTimezone);
		return { ...(await renderSettings(ctx)), toast: { message: "Settings saved", type: "success" } };
	}

	return { blocks: [{ type: "context", text: "No action was taken." }] };
}
