import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { env } from "node:process";

import {
	createPluginRuntimeTestHost,
	createPluginTestHost,
	type PluginRuntimeTestHost,
	type PluginTestHost,
} from "@emdash-cms/plugin-test";

// Runtime-host secret-setting tests need a disposable encryption key. Keep it
// process-local; it is never written to the project or reused for deployments.
env.EMDASH_ENCRYPTION_KEY ??= `emdash_enc_v1_${randomBytes(32).toString("base64url")}`;

let host: PluginTestHost | undefined;
let runtimeHost: PluginRuntimeTestHost | undefined;

afterEach(async () => {
	await host?.dispose();
	host = undefined;
	await runtimeHost?.dispose();
	runtimeHost = undefined;
});

type AdminEventValues = Record<string, unknown>;

async function createEventThroughAdmin(testHost: PluginTestHost, overrides: AdminEventValues): Promise<string> {
	const values = {
		title: "Test event",
		description: "",
		startDate: "2026-10-10",
		startTime: "",
		endDate: "2026-10-10",
		endTime: "",
		allDay: true,
		timezone: "UTC",
		location: "",
		organizer: "",
		externalUrl: "",
		imageUrl: "",
		imageMediaId: "",
		categories: "",
		venueId: "",
		published: false,
		repeatFrequency: "none",
		recurrenceUntil: "",
		monthlyPattern: "dayOfMonth",
		missingDayBehavior: "skip",
		monthlyWeekday: "monday",
		monthlyPosition: "1",
		...overrides,
	};
	await testHost.invokeRoute("admin", {
		type: "form_submit",
		action_id: "save-event",
		block_id: "event-form:new",
		values,
	});
	const row = (await testHost.storage("events").list())
		.find((item) => (item.data as { title?: string }).title === values.title);
	if (!row) throw new Error(`Admin did not create event: ${String(values.title)}`);
	return row.id;
}

async function createVenueThroughAdmin(testHost: PluginTestHost, name: string, address: AdminEventValues = {}): Promise<string> {
	await testHost.invokeRoute("admin", { type: "block_action", action_id: "new-venue" });
	await testHost.invokeRoute("admin", {
		type: "form_submit",
		action_id: "save-venue",
		block_id: "venue-form:new",
		values: { name, street: "", street2: "", locality: "", region: "", postalCode: "", country: "", ...address },
	});
	const row = (await testHost.storage("venues").list())
		.find((item) => (item.data as { name?: string }).name === name);
	if (!row) throw new Error(`Admin did not create venue: ${name}`);
	return row.id;
}

describe("sandboxed Eventual plugin", () => {
	it("keeps the registry MVP admin focused on event management", async () => {
		host = await createPluginTestHost();
		const page = await host.invokeRoute("admin", { type: "page_load", page: "/events" });
		const content = JSON.stringify(page);
		expect(content).not.toContain("Import events from CSV");
		expect(content).not.toContain("Import events from iCalendar");
	});

	it("rejects malformed admin interactions and public feed query values", async () => {
		host = await createPluginTestHost();
		await expect(host.invokeRoute("admin", { type: "form_submit", action_id: "save-event", values: "invalid" }))
			.resolves.toMatchObject({ blocks: [expect.objectContaining({ type: "banner", title: "Invalid admin request" })] });
		await expect(host.invokeRoute("publicEvents", { from: 20261001 }, { method: "GET" }))
			.resolves.toEqual({ ok: false, error: "INVALID_QUERY" });
	});

	it("starts an unpublished, editable event copy without changing its source", async () => {
		host = await createPluginTestHost();
		const originalId = await createEventThroughAdmin(host, {
			title: "Summer concert",
			description: "Bring a picnic",
			startDate: "2026-08-14",
			startTime: "18:30",
			endDate: "2026-08-14",
			endTime: "21:00",
			allDay: false,
			timezone: "Europe/Amsterdam",
			organizer: "Local Arts Club",
			externalUrl: "https://example.org/concert",
			categories: "music",
			published: true,
		});
		const result = await host.invokeRoute("admin", { type: "block_action", action_id: "duplicate-event", value: originalId });
		const blocks = (result as { blocks: Array<Record<string, unknown>> }).blocks;
		const form = blocks.find((block) => block.type === "form") as { block_id: string; fields: Array<Record<string, unknown>> };
		expect(form.block_id).toBe("event-form:new:duplicate");
		expect(JSON.stringify(blocks)).toContain("This is an unpublished copy");
		expect(form.fields.find((field) => field.action_id === "title")).toMatchObject({ initial_value: "Copy of Summer concert" });
		expect(form.fields.find((field) => field.action_id === "published")).toMatchObject({ initial_value: false });

		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-event",
			block_id: form.block_id,
			values: {
				title: "Copy of Summer concert",
				description: "Bring a picnic",
				startDate: "2026-08-14",
				startTime: "18:30",
				endDate: "2026-08-14",
				endTime: "21:00",
				allDay: false,
				timezone: "Europe/Amsterdam",
				location: "",
				organizer: "Local Arts Club",
				externalUrl: "https://example.org/concert",
				imageUrl: "",
				categories: "music",
				venueId: "",
				published: false,
				repeatFrequency: "none",
				recurrenceUntil: "",
				monthlyPattern: "dayOfMonth",
				missingDayBehavior: "skip",
				monthlyWeekday: "friday",
				monthlyPosition: "2",
			},
		});

		const events = (await host.storage("events").list()).map((row) => row.data as { id: string; title: string; published: boolean; recurrence?: unknown });
		expect(events).toHaveLength(2);
		expect(events.find((event) => event.id === originalId)).toMatchObject({ title: "Summer concert", published: true });
		expect(events.find((event) => event.id !== originalId)).toMatchObject({ title: "Copy of Summer concert", published: false });
		expect(events.find((event) => event.id !== originalId)?.recurrence).toBeUndefined();
	});

	it("manages saved venues and publishes expanded events through the read route", async () => {
		host = await createPluginTestHost();

		await host.invokeRoute("admin", { type: "block_action", action_id: "new-venue" });
		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-venue",
			block_id: "venue-form:new",
			values: {
				name: "Clubhouse",
				street: "10 Green Lane",
				street2: "",
				locality: "Utrecht",
				region: "",
				postalCode: "3511 AA",
				country: "Netherlands",
			},
		});
		const venue = (await host.storage("venues").list())[0]?.data as { id: string } | undefined;
		expect(venue).toBeDefined();

		await host.invokeRoute("admin", { type: "block_action", action_id: "new-event" });
		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-event",
			block_id: "event-form:new",
			values: {
				title: "Monday training",
				description: "Open to all club members",
				startDate: "2026-10-05",
				startTime: "6:30 PM",
				endDate: "2026-10-05",
				endTime: "8:00 PM",
				allDay: false,
				timezone: "Europe/Amsterdam",
				location: "Meet by the east entrance",
				organizer: "Utrecht Sports Club",
				externalUrl: "https://example.org/training",
				imageUrl: "",
				categories: "Training, training, club",
				venueId: venue!.id,
				published: true,
				repeatFrequency: "weekly",
				recurrenceUntil: "2026-10-19",
				monthlyPattern: "dayOfMonth",
				missingDayBehavior: "skip",
				monthlyWeekday: "monday",
				monthlyPosition: "1",
			},
		});

		let records = await host.storage("events").list();
		expect(records).toHaveLength(1);
		const eventId = (records[0]?.data as { id: string }).id;
		const editPage = await host.invokeRoute("admin", { type: "block_action", action_id: "edit-event", value: eventId });
		const editBlocks = (editPage as { blocks: Array<Record<string, unknown>> }).blocks;
		expect(JSON.stringify(editBlocks)).not.toContain("exceptionsJson");
		expect(editBlocks.some((block) => block.type === "header" && block.text === "Occurrence exceptions")).toBe(true);

		await host.invokeRoute("admin", { type: "block_action", action_id: "add-exception", value: eventId });
		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-exception",
			block_id: `exception-form:${eventId}:new`,
			values: { recurrenceDate: "2026-10-12", recurrenceTime: "18:30", status: "cancelled" },
		});

		records = await host.storage("events").list();
		expect(records[0]?.data).toMatchObject({
			title: "Monday training",
			published: true,
			timezone: "Europe/Amsterdam",
			venueId: venue!.id,
			recurrence: { frequency: "weekly", until: "2026-10-19" },
			exceptions: [{ recurrenceId: "2026-10-12T18:30", status: "cancelled" }],
		});

		const response = await host.invokeRoute("publicEvents", {
			from: "2026-10-05",
			through: "2026-10-19",
		}, { method: "GET" });
		expect(response).toMatchObject({ ok: true, from: "2026-10-05", through: "2026-10-19" });
		const events = (response as { events: Array<Record<string, unknown>> }).events;
		expect(events).toHaveLength(2);
		expect(events[0]?.categories).toEqual(["Training", "club"]);
		const filteredResponse = await host.invokeRoute("publicEvents", {
			from: "2026-10-05",
			through: "2026-10-19",
			category: "  TRAINING  ",
		}, { method: "GET" });
		expect((filteredResponse as { events: Array<Record<string, unknown>> }).events).toHaveLength(2);
		expect(events[0]).toMatchObject({
			title: "Monday training",
			updatedAt: expect.any(String),
			start: "2026-10-05T16:30:00.000Z",
			location: "Clubhouse · 10 Green Lane, Utrecht, 3511 AA, Netherlands · Meet by the east entrance",
			directionsUrl: expect.stringContaining("google.com/maps/dir"),
			venue: { name: "Clubhouse" },
		});
		expect(events[1]?.start).toBe("2026-10-19T16:30:00.000Z");
	});

	it("edits and removes modified occurrence exceptions through structured fields", async () => {
		host = await createPluginTestHost();
		const eventId = await createEventThroughAdmin(host, {
			title: "Tuesday training",
			startDate: "2026-10-06",
			startTime: "18:00",
			endDate: "2026-10-06",
			endTime: "19:00",
			allDay: false,
			timezone: "Europe/Amsterdam",
			published: true,
			repeatFrequency: "weekly",
			recurrenceUntil: "2026-10-27",
		});

		const editPage = await host.invokeRoute("admin", { type: "block_action", action_id: "edit-event", value: eventId });
		const editBlocks = (editPage as { blocks: Array<Record<string, unknown>> }).blocks;
		const eventForm = editBlocks.find((block) => block.type === "form" && block.block_id === `event-form:${eventId}`) as { fields: Array<Record<string, unknown>> };
		expect(eventForm.fields.some((field) => field.action_id === "exceptionsJson")).toBe(false);

		const addPage = await host.invokeRoute("admin", { type: "block_action", action_id: "add-exception", value: eventId });
		const addBlocks = (addPage as { blocks: Array<Record<string, unknown>> }).blocks;
		const exceptionForm = addBlocks.find((block) => block.type === "form" && block.block_id === `exception-form:${eventId}:new`) as { fields: Array<Record<string, unknown>> };
		expect(addBlocks.some((block) => block.type === "form" && block.block_id === `event-form:${eventId}`)).toBe(false);
		expect(exceptionForm.fields.some((field) => field.type === "date_input" && field.action_id === "recurrenceDate")).toBe(true);
		expect(exceptionForm.fields.some((field) => field.action_id === "recurrenceTime")).toBe(true);
		expect(exceptionForm.fields.some((field) => field.type === "date_input" && field.action_id === "overrideStartDate")).toBe(true);
		expect(exceptionForm.fields.some((field) => field.type === "text_input" && field.action_id === "overrideStartTime")).toBe(true);
		expect(exceptionForm.fields.find((field) => field.action_id === "overrideStartTime")).toMatchObject({ placeholder: "18:30 or 6:30 PM" });
		expect(exceptionForm.fields.find((field) => field.action_id === "overrideTimezone")).toMatchObject({ type: "combobox" });

		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-exception",
			block_id: `exception-form:${eventId}:new`,
			values: {
				recurrenceDate: "2026-10-13",
				recurrenceTime: "6:00 PM",
				status: "modified",
				overrideTitle: "Club awards night",
				overrideDescription: "An updated description",
				overrideStartDate: "2026-10-13",
				overrideStartTime: "7:00 PM",
				overrideEndDate: "2026-10-13",
				overrideEndTime: "8:30 PM",
				overrideAllDay: "timed",
				overrideTimezone: "Europe/Amsterdam",
				overrideLocation: "Clubhouse",
				overrideOrganizer: "",
				overrideExternalUrl: "",
				overrideImageUrl: "",
				overrideCategories: "community\nawards",
			},
		});

		let record = (await host.storage("events").list())[0]?.data as { exceptions: Array<Record<string, unknown>> };
		expect(record.exceptions).toHaveLength(1);
		expect(record.exceptions[0]).toMatchObject({
			recurrenceId: "2026-10-13T18:00",
			status: "modified",
			overrides: {
				title: "Club awards night",
				description: "An updated description",
				start: "2026-10-13T17:00:00.000Z",
				end: "2026-10-13T18:30:00.000Z",
				location: "Clubhouse",
				categories: ["community", "awards"],
			},
		});

		const currentForm = {
			title: "Tuesday training",
			description: "",
			startDate: "2026-10-06",
			startTime: "18:00",
			endDate: "2026-10-06",
			endTime: "19:00",
			allDay: false,
			timezone: "Europe/Amsterdam",
			location: "",
			organizer: "",
			externalUrl: "",
			imageUrl: "",
			categories: "",
			venueId: "",
			published: true,
			repeatFrequency: "weekly",
			recurrenceUntil: "2026-10-27",
			monthlyPattern: "dayOfMonth",
			missingDayBehavior: "skip",
			monthlyWeekday: "monday",
			monthlyPosition: "1",
		};
		await host.invokeRoute("admin", {
			type: "form_submit", action_id: "save-event", block_id: `event-form:${eventId}`, values: currentForm,
		});
		record = (await host.storage("events").list())[0]?.data as { exceptions: Array<Record<string, unknown>> };
		expect(record.exceptions).toHaveLength(1);

		await host.invokeRoute("admin", {
			type: "block_action",
			action_id: "remove-exception",
			value: JSON.stringify({ eventId, recurrenceId: "2026-10-13T18:00" }),
		});
		record = (await host.storage("events").list())[0]?.data as { exceptions: Array<Record<string, unknown>> };
		expect(record.exceptions).toEqual([]);

		await host.invokeRoute("admin", { type: "block_action", action_id: "add-exception", value: eventId });
		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-exception",
			block_id: `exception-form:${eventId}:new`,
			values: {
				recurrenceDate: "2026-10-20",
				recurrenceTime: "18:00",
				status: "modified",
				overrideAllDay: "allDay",
				overrideStartDate: "2026-10-21",
				overrideEndDate: "2026-10-22",
				overrideTimezone: "Europe/Amsterdam",
				overrideTitle: "Awards day",
			},
		});
		record = (await host.storage("events").list())[0]?.data as { exceptions: Array<Record<string, unknown>> };
		expect(record.exceptions[0]).toMatchObject({
			recurrenceId: "2026-10-20T18:00",
			overrides: { allDay: true, start: "2026-10-21", end: "2026-10-22", title: "Awards day" },
		});
	});

	it("rejects a public date range wider than one year", async () => {
		host = await createPluginTestHost();
		await expect(host.invokeRoute("publicEvents", {
			from: "2026-01-01",
			through: "2027-01-02",
		}, { method: "GET" })).resolves.toEqual({ ok: false, error: "DATE_RANGE_TOO_LARGE", maxDays: 366 });
	});

	it("accepts exactly 366 inclusive dates in the public event range", async () => {
		host = await createPluginTestHost();
		await expect(host.invokeRoute("publicEvents", {
			from: "2026-01-01",
			through: "2027-01-01",
		}, { method: "GET" })).resolves.toMatchObject({
			ok: true,
			from: "2026-01-01",
			through: "2027-01-01",
			events: [],
		});
	});

	it("uses date pickers and a searchable timezone selector for event entry", async () => {
		host = await createPluginTestHost();
		const page = await host.invokeRoute("admin", { type: "block_action", action_id: "new-event" });
		const blocks = (page as { blocks: Array<Record<string, unknown>> }).blocks;
		const form = blocks.find((block) => block.type === "form" && block.block_id === "event-form:new") as { fields: Array<Record<string, unknown>> };
		expect(form.fields.some((field) => field.type === "date_input" && field.action_id === "startDate")).toBe(true);
		expect(form.fields.some((field) => field.type === "date_input" && field.action_id === "endDate")).toBe(true);
		expect(form.fields.some((field) => field.type === "text_input" && field.action_id === "startTime" && field.condition !== undefined)).toBe(true);
		expect(form.fields.find((field) => field.action_id === "startTime")).toMatchObject({ placeholder: "18:30 or 6:30 PM" });
		const timezone = form.fields.find((field) => field.action_id === "timezone");
		expect(timezone).toMatchObject({ type: "combobox", initial_value: "UTC" });
		expect((timezone?.options as Array<{ value: string }>).some((option) => option.value === "Europe/Amsterdam")).toBe(true);
		expect(form.fields.find((field) => field.action_id === "monthlyPattern"))
			.toMatchObject({ condition: { field: "repeatFrequency", eq: "monthly" } });
		expect(form.fields.find((field) => field.action_id === "recurrenceUntil"))
			.toMatchObject({ condition: { field: "repeatFrequency", neq: "none" } });
		expect(form.fields.find((field) => field.action_id === "missingDayBehavior"))
			.toMatchObject({ condition: { field: "monthlyPattern", eq: "dayOfMonth" } });
		expect(form.fields.find((field) => field.action_id === "monthlyWeekday"))
			.toMatchObject({ condition: { field: "monthlyPattern", eq: "weekdayOfMonth" } });
		expect(form.fields.find((field) => field.action_id === "monthlyPosition"))
			.toMatchObject({ condition: { field: "monthlyPattern", eq: "weekdayOfMonth" } });
		expect(form.fields.find((field) => field.action_id === "categories"))
			.toMatchObject({ type: "text_input", multiline: true, label: "Categories (one per line or comma-separated)" });

		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-event",
			block_id: "event-form:new",
			values: {
				title: "Community picnic",
				description: "",
				startDate: "2026-10-10",
				endDate: "2026-10-11",
				allDay: true,
				timezone: "UTC",
				location: "",
				organizer: "",
				externalUrl: "",
				imageUrl: "",
				categories: "Community\nSports",
				venueId: "",
				published: true,
				repeatFrequency: "none",
				recurrenceUntil: "",
				monthlyPattern: "dayOfMonth",
				missingDayBehavior: "skip",
				monthlyWeekday: "monday",
				monthlyPosition: "1",
			},
		});
		const event = (await host.storage("events").list())[0]?.data as { start: string; end: string; allDay: boolean; categories: string[] };
		expect(event).toMatchObject({ start: "2026-10-10", end: "2026-10-11", allDay: true, categories: ["Community", "Sports"] });
	});

	it("keeps an invalid time entry visible and explains accepted formats", async () => {
		host = await createPluginTestHost();
		const response = await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-event",
			block_id: "event-form:new",
			values: {
				title: "Time entry check",
				description: "",
				startDate: "2026-10-05",
				startTime: "6 PM-ish",
				endDate: "2026-10-05",
				endTime: "8:00 PM",
				allDay: false,
				timezone: "Europe/Amsterdam",
				location: "",
				organizer: "",
				externalUrl: "",
				imageUrl: "",
				imageMediaId: "",
				categories: "",
				venueId: "",
				published: false,
				repeatFrequency: "none",
				recurrenceUntil: "",
				monthlyPattern: "dayOfMonth",
				missingDayBehavior: "skip",
				monthlyWeekday: "monday",
				monthlyPosition: "1",
			},
		});
		const blocks = (response as { blocks: Array<Record<string, unknown>> }).blocks;
		const banner = blocks.find((block) => block.type === "banner");
		const form = blocks.find((block) => block.type === "form" && block.block_id === "event-form:new") as { fields: Array<Record<string, unknown>> };
		expect(banner?.description).toContain("Use 24-hour time (18:30) or 12-hour time (6:30 PM).");
		expect(form.fields.find((field) => field.action_id === "startTime")).toMatchObject({ initial_value: "6 PM-ish" });
		expect(await host.storage("events").list()).toHaveLength(0);
	});

	it("shows an assigned saved venue with its label in the event editor", async () => {
		host = await createPluginTestHost();
		const venueId = await createVenueThroughAdmin(host, "Riverside Pavilion", {
			street: "5 River Road",
			locality: "Utrecht",
		});
		const eventId = await createEventThroughAdmin(host, {
			title: "Community day",
			startDate: "2026-10-10",
			endDate: "2026-10-10",
			allDay: true,
			timezone: "Europe/Amsterdam",
			venueId,
		});

		const page = await host.invokeRoute("admin", {
			type: "block_action",
			action_id: "edit-event",
			value: eventId,
		});
		const blocks = (page as { blocks: Array<Record<string, unknown>> }).blocks;
		const form = blocks.find((block) => block.type === "form" && block.block_id === `event-form:${eventId}`) as { fields: Array<Record<string, unknown>> };
		expect(JSON.stringify(blocks)).toContain("Schedule preview: all day, 2026-10-10 through 2026-10-10 (inclusive).");
		expect(form.fields.find((field) => field.action_id === "venueId")).toMatchObject({
			type: "combobox",
			placeholder: "Search saved venues",
			initial_value: venueId,
			options: expect.arrayContaining([
				{ label: "Riverside Pavilion", value: venueId },
			]),
		});

		const timedId = await createEventThroughAdmin(host, {
			title: "Evening practice",
			startDate: "2026-10-10",
			startTime: "18:30",
			endDate: "2026-10-10",
			endTime: "19:30",
			allDay: false,
			timezone: "Europe/Amsterdam",
		});
		const timedPage = await host.invokeRoute("admin", { type: "block_action", action_id: "edit-event", value: timedId });
		expect(JSON.stringify((timedPage as { blocks: Array<Record<string, unknown>> }).blocks))
			.toContain("Schedule preview: 2026-10-10 18:30–2026-10-10 19:30 (Europe/Amsterdam).");

		const recurringId = await createEventThroughAdmin(host, {
			title: "Tuesday practice",
			startDate: "2026-10-06",
			startTime: "18:00",
			endDate: "2026-10-06",
			endTime: "19:00",
			allDay: false,
			timezone: "Europe/Amsterdam",
			repeatFrequency: "weekly",
			recurrenceUntil: "2026-10-27",
		});
		const recurringPage = await host.invokeRoute("admin", { type: "block_action", action_id: "edit-event", value: recurringId });
		expect(JSON.stringify((recurringPage as { blocks: Array<Record<string, unknown>> }).blocks))
			.toContain("Repeats weekly through 2026-10-27. Sample occurrences: 2026-10-06 18:00, 2026-10-13 18:00, 2026-10-20 18:00 (showing up to 3).");
	});

	it("uses the configured default timezone for new events", async () => {
		host = await createPluginTestHost();
		const settingsPage = await host.invokeRoute("admin", { type: "page_load", page: "/settings" });
		const settingsBlocks = (settingsPage as { blocks: Array<Record<string, unknown>> }).blocks;
		const settingsForm = settingsBlocks.find((block) => block.type === "form" && block.block_id === "settings-form") as { fields: Array<Record<string, unknown>> };
		expect(settingsForm.fields.find((field) => field.action_id === "defaultTimezone"))
			.toMatchObject({ type: "combobox", initial_value: "UTC", label: "Default timezone for new events" });

		await host.invokeRoute("admin", {
			type: "form_submit",
			action_id: "save-settings",
			block_id: "settings-form",
			values: { defaultTimezone: "Europe/Amsterdam" },
		});

		const newEvent = await host.invokeRoute("admin", { type: "block_action", action_id: "new-event" });
		const eventBlocks = (newEvent as { blocks: Array<Record<string, unknown>> }).blocks;
		const eventForm = eventBlocks.find((block) => block.type === "form" && block.block_id === "event-form:new") as { fields: Array<Record<string, unknown>> };
		expect(eventForm.fields.find((field) => field.action_id === "timezone"))
			.toMatchObject({ type: "combobox", initial_value: "Europe/Amsterdam" });
	});

	it("renders host-validated Block Kit pages and saves the default timezone", async () => {
		runtimeHost = await createPluginRuntimeTestHost();
		const page = await runtimeHost.admin.loadPage("/events");
		expect(page.blocks.some((block) => block.type === "header" && block.text === "Events")).toBe(true);
		const form = await runtimeHost.admin.act("/events", "new-event");
		const newEventForm = form.blocks.find((block) => block.type === "form" && block.block_id === "event-form:new");
		expect(newEventForm).toBeDefined();
		if (newEventForm?.type === "form") {
			expect(newEventForm.fields.some((field) => field.type === "date_input" && field.action_id === "startDate")).toBe(true);
			expect(newEventForm.fields.some((field) => field.type === "combobox" && field.action_id === "timezone")).toBe(true);
			expect(newEventForm.fields.some((field) => field.type === "combobox" && field.action_id === "imageMediaId")).toBe(true);
			expect(newEventForm.fields.find((field) => field.action_id === "monthlyPattern"))
				.toMatchObject({ condition: { field: "repeatFrequency", eq: "monthly" } });
		}
		const settingsPage = await runtimeHost.admin.loadPage("/settings");
		expect(settingsPage.blocks.some((block) => block.type === "form" && block.block_id === "settings-form")).toBe(true);
		await runtimeHost.admin.submit("/settings", "save-settings", {
			defaultTimezone: "Europe/Amsterdam",
		}, { blockId: "settings-form" });
		expect(settingsPage.blocks.some((block) => JSON.stringify(block).includes("Google Maps Embed API key"))).toBe(false);
		const timezoneForm = await runtimeHost.admin.act("/events", "new-event");
		const configuredEventForm = timezoneForm.blocks.find((block) => block.type === "form" && block.block_id === "event-form:new");
		if (configuredEventForm?.type === "form") {
			expect(configuredEventForm.fields.find((field) => field.action_id === "timezone"))
				.toMatchObject({ type: "combobox", initial_value: "Europe/Amsterdam" });
		}

		await runtimeHost.fixtures.plugin.storage("events", "runtime-weekly", {
			id: "runtime-weekly",
			title: "Runtime weekly event",
			description: "",
			start: "2026-10-06T16:00:00.000Z",
			end: "2026-10-06T17:00:00.000Z",
			allDay: false,
			timezone: "Europe/Amsterdam",
			location: "",
			organizer: "",
			externalUrl: "",
			imageUrl: "",
			categories: [],
			published: true,
			recurrence: { frequency: "weekly", until: "2026-10-27" },
			exceptions: [],
			createdAt: "2026-09-01T00:00:00.000Z",
			updatedAt: "2026-09-01T00:00:00.000Z",
		});
		const editEvent = await runtimeHost.admin.act("/events", "edit-event", { value: "runtime-weekly" });
		expect(editEvent.blocks.some((block) => block.type === "header" && block.text === "Occurrence exceptions")).toBe(true);
		const addException = await runtimeHost.admin.act("/events", "add-exception", { value: "runtime-weekly" });
		expect(addException.blocks.some((block) => block.type === "form" && block.block_id === "exception-form:runtime-weekly:new")).toBe(true);
		await runtimeHost.admin.submit("/events", "save-exception", {
			recurrenceDate: "2026-10-13",
			recurrenceTime: "18:00",
			status: "cancelled",
		}, { blockId: "exception-form:runtime-weekly:new" });
		expect(await runtimeHost.inspect.storage.get<{ exceptions: Array<{ recurrenceId: string; status: string }> }>("events", "runtime-weekly"))
			.toMatchObject({ exceptions: [{ recurrenceId: "2026-10-13T18:00", status: "cancelled" }] });

	});

	it("selects EmDash media for events and serves images only while their event is published", async () => {
		runtimeHost = await createPluginRuntimeTestHost();
		const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
		for (let index = 0; index < 99; index += 1) {
			await runtimeHost.fixtures.media({
				filename: `other-poster-${index}.png`,
				mimeType: "image/png",
				bytes: imageBytes,
			});
		}
		const image = await runtimeHost.fixtures.media({
			filename: "fundraiser-poster.png",
			mimeType: "image/png",
			bytes: imageBytes,
			width: 800,
			height: 1200,
		});

		const newEvent = await runtimeHost.admin.act("/events", "new-event");
		const form = newEvent.blocks.find((block) => block.type === "form" && block.block_id === "event-form:new");
		expect(form?.type).toBe("form");
		if (form?.type !== "form") throw new Error("Expected an event form");
		expect(form.fields.find((field) => field.action_id === "imageMediaId")).toMatchObject({
			type: "combobox",
			options: expect.arrayContaining([
				expect.objectContaining({ label: "fundraiser-poster.png (800 × 1200)", value: image.id }),
			]),
		});

		const savedPage = await runtimeHost.admin.submit("/events", "save-event", {
			title: "Fundraiser",
			description: "Community fundraiser",
			startDate: "2026-10-10",
			endDate: "2026-10-10",
			allDay: true,
			timezone: "Europe/Amsterdam",
			location: "Community hall",
			organizer: "Local group",
			externalUrl: "",
			imageMediaId: image.id,
			categories: "community",
			venueId: "",
			published: true,
			repeatFrequency: "none",
			recurrenceUntil: "",
			monthlyPattern: "dayOfMonth",
			missingDayBehavior: "skip",
			monthlyWeekday: "monday",
			monthlyPosition: "1",
		}, { blockId: "event-form:new" });
		expect(savedPage.blocks.some((block) => block.type === "image" && block.title === "Selected image: fundraiser-poster.png")).toBe(true);

		const [event] = await runtimeHost.inspect.storage.list<{
			id: string;
			imageUrl: string;
			imageMediaId?: string;
		}>("events");
		expect(event?.data).toMatchObject({ imageUrl: "", imageMediaId: image.id });
		const eventId = event!.data.id;

		const publicFeed = await runtimeHost.actions.routes.request("publicEvents", {
			method: "GET",
			url: "http://localhost/_emdash/api/plugins/eventual/publicEvents?from=2026-10-01&through=2026-10-31",
		});
		const feedEnvelope = await publicFeed.json() as { success: boolean; data: { events: Array<{ imageUrl: string }> } };
		expect(feedEnvelope.data.events[0]?.imageUrl).toContain(`eventId=${eventId}`);

		const imageResponse = await runtimeHost.actions.routes.request("publicEventImage", {
			method: "GET",
			url: `http://localhost/_emdash/api/plugins/eventual/publicEventImage?eventId=${encodeURIComponent(eventId)}`,
		});
		expect(imageResponse.status).toBe(200);
		expect(imageResponse.headers.get("content-type")).toBe("image/png");
		expect(imageResponse.headers.get("cache-control")).toContain("no-store");
		expect(new Uint8Array(await imageResponse.arrayBuffer())).toEqual(imageBytes);

		await runtimeHost.admin.submit("/events", "save-event", {
			title: "Fundraiser",
			description: "Community fundraiser",
			startDate: "2026-10-10",
			endDate: "2026-10-10",
			allDay: true,
			timezone: "Europe/Amsterdam",
			location: "Community hall",
			organizer: "Local group",
			externalUrl: "",
			imageUrl: "",
			imageMediaId: image.id,
			categories: "community",
			venueId: "",
			published: false,
			repeatFrequency: "none",
			recurrenceUntil: "",
			monthlyPattern: "dayOfMonth",
			missingDayBehavior: "skip",
			monthlyWeekday: "monday",
			monthlyPosition: "1",
		}, { blockId: `event-form:${eventId}` });
		const hiddenImageResponse = await runtimeHost.actions.routes.request("publicEventImage", {
			method: "GET",
			url: `http://localhost/_emdash/api/plugins/eventual/publicEventImage?eventId=${encodeURIComponent(eventId)}`,
		});
		expect(hiddenImageResponse.status).toBe(404);
	});

	it("serves a raw calendar subscription feed and retains cancellation tombstones", async () => {
		runtimeHost = await createPluginRuntimeTestHost();
		const eventValues = {
			title: "Subscription test",
			description: "Secret description should not remain after cancellation",
			startDate: "2026-10-06",
			startTime: "18:00",
			endDate: "2026-10-06",
			endTime: "19:00",
			allDay: false,
			timezone: "Europe/Amsterdam",
			location: "",
			organizer: "",
			externalUrl: "",
			imageUrl: "",
			imageMediaId: "",
			categories: "",
			venueId: "",
			published: true,
			repeatFrequency: "daily",
			recurrenceUntil: "2026-10-08",
			monthlyPattern: "dayOfMonth",
			missingDayBehavior: "skip",
			monthlyWeekday: "monday",
			monthlyPosition: "1",
		};
		await runtimeHost.admin.submit("/events", "save-event", eventValues, { blockId: "event-form:new" });
		const [created] = await runtimeHost.inspect.storage.list<{ id: string }>("events");
		const eventId = created!.data.id;
		const requestFeed = () => runtimeHost!.actions.routes.request("calendar", {
			method: "GET",
			url: "http://localhost/_emdash/api/plugins/eventual/calendar",
		});
		const activeResponse = await requestFeed();
		const activeText = await activeResponse.text();
		expect(activeResponse.status).toBe(200);
		expect(activeResponse.headers.get("content-type")).toContain("text/calendar");
		expect(activeText).toContain("BEGIN:VCALENDAR");
		expect(activeText).toContain(`UID:${eventId}%232026-10-06T18%3A00@localhost`);
		expect(activeText.match(/STATUS:CONFIRMED/g)).toHaveLength(3);
		expect(activeText).toContain("Secret description should not remain after cancellation");

		await runtimeHost.admin.submit("/events", "save-event", { ...eventValues, published: false }, { blockId: `event-form:${eventId}` });
		const cancelledResponse = await requestFeed();
		const cancelledText = await cancelledResponse.text();
		expect(cancelledText.match(/STATUS:CANCELLED/g)).toHaveLength(3);
		expect(cancelledText).not.toContain("Secret description should not remain after cancellation");

		await runtimeHost.admin.submit("/events", "save-event", eventValues, { blockId: `event-form:${eventId}` });
		const restored = await requestFeed();
		const restoredText = await restored.text();
		expect(restoredText.match(/STATUS:CONFIRMED/g)).toHaveLength(3);
		expect(restoredText).not.toContain("STATUS:CANCELLED");

		await runtimeHost.admin.submit("/events", "save-event", {
			...eventValues,
			startDate: "2026-10-07",
			endDate: "2026-10-07",
		}, { blockId: `event-form:${eventId}` });
		const rescheduled = await requestFeed();
		const rescheduledText = await rescheduled.text();
		expect(rescheduledText.match(/STATUS:CONFIRMED/g)).toHaveLength(2);
		expect(rescheduledText.match(/STATUS:CANCELLED/g)).toHaveLength(1);
		expect(rescheduledText).toContain(`UID:${eventId}%232026-10-06T18%3A00@localhost`);

		await runtimeHost.admin.act("/events", "delete-event", { value: eventId });
		const deleted = await requestFeed();
		const deletedText = await deleted.text();
		expect(deletedText.match(/STATUS:CANCELLED/g)).toHaveLength(3);
		expect(deletedText).not.toContain("Secret description should not remain after cancellation");
	});
});
