import { describe, expect, it } from "vitest";

import { localDateTimeToInstant, normalizeEventDates } from "../src/domain/date-time";
import { normalizeTimeEntry } from "../src/domain/time-entry";
import { duplicateEventDraft, monthlyPositionForDate, prepareEventData } from "../src/domain/event-data";
import { categoryKey, normalizeCategories } from "../src/domain/category";
import { exceptionIdsMatchRecurrence, expandRecurringEvent } from "../src/domain/recurrence";
import { EMPTY_EVENT_DRAFT, type EventRecord } from "../src/domain/event";
import { directionsUrl, eventLocation, formatVenueAddress, safeHttpUrl } from "../src/domain/venue";
import { formatCalendarFeed } from "../src/domain/icalendar";

describe("event date and timezone rules", () => {
	it("duplicates event fields into an unpublished draft without occurrence exceptions", () => {
		const source: EventRecord = {
			id: "weekly-series",
			title: "Community practice",
			description: "Bring water",
			start: "2026-10-10T16:00:00.000Z",
			end: "2026-10-10T17:30:00.000Z",
			allDay: false,
			timezone: "Europe/Paris",
			location: "Sports hall",
			organizer: "Club",
			externalUrl: "https://example.org/event",
			imageUrl: "",
			categories: ["sport"],
			published: true,
			recurrence: { frequency: "weekly", until: "2026-12-31" },
			exceptions: [{ recurrenceId: "2026-10-17T18:00", status: "cancelled" }],
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
		};
		const draft = duplicateEventDraft(source);
		expect(draft).toMatchObject({
			title: "Copy of Community practice",
			start: "2026-10-10T18:00",
			end: "2026-10-10T19:30",
			timezone: "Europe/Paris",
			repeatFrequency: "weekly",
			recurrenceUntil: "2026-12-31",
			published: false,
			exceptions: [],
		});
	});

	it("normalizes 12-hour and 24-hour time entries to canonical wall time", () => {
		expect(normalizeTimeEntry("18:30")).toEqual({ time: "18:30" });
		expect(normalizeTimeEntry("8:05")).toEqual({ time: "08:05" });
		expect(normalizeTimeEntry("6:30 PM")).toEqual({ time: "18:30" });
		expect(normalizeTimeEntry("6:30 p.m.")).toEqual({ time: "18:30" });
		expect(normalizeTimeEntry("12 AM")).toEqual({ time: "00:00" });
		expect(normalizeTimeEntry("12:15 PM")).toEqual({ time: "12:15" });
		expect(normalizeTimeEntry("25:00")).toHaveProperty("error");
		expect(normalizeTimeEntry("0:30 AM")).toHaveProperty("error");
	});

	it("converts local event times and rejects a nonexistent daylight-saving time", () => {
		expect(localDateTimeToInstant("2026-10-25T02:30", "Europe/Paris").value)
			.toBe("2026-10-25T00:30:00.000Z");
		expect(localDateTimeToInstant("2026-03-29T02:30", "Europe/Paris").error)
			.toContain("does not exist");
	});

	it("recognizes fifth-weekday dates and permits last-weekday series starts", () => {
		expect(monthlyPositionForDate("2026-10-28")).toBe(4);
		expect(monthlyPositionForDate("2026-12-30")).toBe(5);
		const prepared = prepareEventData({
			...EMPTY_EVENT_DRAFT,
			title: "Last Wednesday meeting",
			start: "2026-10-28T18:00",
			end: "2026-10-28T19:00",
			timezone: "UTC",
			repeatFrequency: "monthly",
			recurrenceUntil: "2026-12-31",
			monthlyPattern: "weekdayOfMonth",
			monthlyWeekday: "wednesday",
			monthlyPosition: "last",
		});
		expect(prepared.data?.recurrence).toMatchObject({
			frequency: "monthly",
			pattern: { type: "weekdayOfMonth", weekday: "wednesday", position: "last" },
		});
	});

	it("keeps one-off events non-recurring and validates inclusive all-day dates", () => {
		const prepared = prepareEventData({
			title: "Fundraiser",
			description: "",
			start: "2026-10-12T10:00",
			end: "2026-10-12T12:00",
			allDay: false,
			timezone: "Europe/Amsterdam",
			location: "",
			organizer: "",
			externalUrl: "",
			imageUrl: "https://example.org/fundraiser.png",
			imageMediaId: "",
			categories: "community, community",
			venueId: "",
			published: false,
			repeatFrequency: "none",
			recurrenceUntil: "",
			monthlyPattern: "dayOfMonth",
			missingDayBehavior: "skip",
			monthlyWeekday: "monday",
			monthlyPosition: 1,
			exceptions: [],
		});
		expect(prepared.data).toMatchObject({
			start: "2026-10-12T08:00:00.000Z",
			end: "2026-10-12T10:00:00.000Z",
			imageUrl: "https://example.org/fundraiser.png",
			categories: ["community"],
		});
		expect(prepared.data?.recurrence).toBeUndefined();
		expect(normalizeEventDates({ start: "2026-12-24", end: "2026-12-25", allDay: true, timezone: "Invalid/Zone" }).dates)
			.toEqual({ start: "2026-12-24", end: "2026-12-25" });
	});
});

describe("iCalendar subscription formatting", () => {
	it("keeps stable UIDs, escapes text, and uses exclusive all-day ends", () => {
		const event: EventRecord = {
			id: "event#2026-10-10",
			title: "Fundraiser,\nFamily day",
			description: "Bring a chair;\nthen enjoy the show",
			start: "2026-10-10",
			end: "2026-10-11",
			allDay: true,
			timezone: "Europe/Amsterdam",
			location: "Community Hall",
			organizer: "Local group",
			externalUrl: "https://example.org/events/1",
			imageUrl: "",
			categories: ["community", "family day"],
			published: true,
			exceptions: [],
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-09-01T00:00:00.000Z",
		};
		const cancelled = {
			id: event.id,
			eventId: event.id,
			start: event.start,
			end: event.end,
			allDay: event.allDay,
			timezone: event.timezone,
			cancelledAt: "2026-09-02T00:00:00.000Z",
		};
		const feed = formatCalendarFeed([event], [cancelled], "events.example.org", new Date("2026-09-03T00:00:00Z"));
		expect(feed).toContain("UID:event%232026-10-10@events.example.org");
		expect(feed).toContain("SUMMARY:Fundraiser\\,\\nFamily day");
		expect(feed).toContain("DESCRIPTION:Bring a chair\\;\\nthen enjoy the show");
		expect(feed).toContain("DTSTART;VALUE=DATE:20261010");
		expect(feed).toContain("DTEND;VALUE=DATE:20261012");
		expect(feed).toContain("CATEGORIES:community,family day");
		expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(1);
		expect(feed).not.toContain("STATUS:CANCELLED");
		expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
	});

	it("emits minimal cancellation records without leaking unpublished event details", () => {
		const feed = formatCalendarFeed([], [{
			id: "event#date",
			eventId: "event",
			start: "2026-10-10T16:00:00.000Z",
			end: "2026-10-10T17:00:00.000Z",
			allDay: false,
			timezone: "Europe/Amsterdam",
			cancelledAt: "2026-09-02T00:00:00.000Z",
		}], "events.example.org", new Date("2026-09-03T00:00:00Z"));
		expect(feed).toContain("STATUS:CANCELLED");
		expect(feed).toContain("SUMMARY:Cancelled event");
		expect(feed).toContain("UID:event%23date@events.example.org");
		expect(feed).toContain("DTSTART:20261010T160000Z");
		expect(feed).not.toContain("eventId:event");
	});
});

describe("category labels", () => {
	it("normalizes spacing and duplicates without changing the first label's casing", () => {
		expect(normalizeCategories(" Community ,community\r\nFAMILY   day, family day\n, ,")).toEqual([
			"Community",
			"FAMILY day",
		]);
		expect(categoryKey("  family   DAY ")).toBe("family day");
	});
});

describe("recurrence and occurrence exceptions", () => {
	const series: EventRecord = {
		id: "weekly",
		title: "Training",
		description: "",
		start: "2026-10-05T16:30:00.000Z",
		end: "2026-10-05T18:00:00.000Z",
		allDay: false,
		timezone: "Europe/Amsterdam",
		location: "",
		organizer: "",
		externalUrl: "",
		imageUrl: "",
		categories: [],
		published: true,
		recurrence: { frequency: "weekly", until: "2026-10-19" },
		exceptions: [
			{ recurrenceId: "2026-10-12T18:30", status: "cancelled" },
			{ recurrenceId: "2026-10-19T18:30", status: "modified", overrides: { title: "Training at the park", location: "North field" } },
		],
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
	};

	it("expands weekly instances, omits cancellations, and applies modified fields", () => {
		const occurrences = expandRecurringEvent(series, "2026-10-05", "2026-10-19");
		expect(occurrences).toHaveLength(2);
		expect(occurrences.map((event) => event.start)).toEqual([
			"2026-10-05T16:30:00.000Z",
			"2026-10-19T16:30:00.000Z",
		]);
		expect(occurrences[1]).toMatchObject({ title: "Training at the park", location: "North field" });
	});

	it("keeps weekly wall time across the daylight-saving transition and matches exceptions", () => {
		const acrossClockChange: EventRecord = {
			...series,
			id: "dst-weekly",
			start: "2026-10-19T16:30:00.000Z",
			end: "2026-10-19T18:00:00.000Z",
			recurrence: { frequency: "weekly", until: "2026-11-02" },
			exceptions: [
				{ recurrenceId: "2026-10-26T18:30", status: "cancelled" },
				{
					recurrenceId: "2026-11-02T18:30",
					status: "modified",
					overrides: {
						title: "Training starts later",
						start: "2026-11-02T17:00:00.000Z",
						end: "2026-11-02T18:30:00.000Z",
					},
				},
			],
		};

		const occurrences = expandRecurringEvent(acrossClockChange, "2026-10-19", "2026-11-02");
		expect(occurrences).toHaveLength(2);
		expect(occurrences.map(({ start }) => start)).toEqual([
			"2026-10-19T16:30:00.000Z",
			"2026-11-02T17:00:00.000Z",
		]);
		expect(occurrences[1]).toMatchObject({
			title: "Training starts later",
			timezone: "Europe/Amsterdam",
		});
	});

	it("applies monthly last-day behavior to an all-day series", () => {
		const monthly: EventRecord = {
			...series,
			id: "month-end",
			start: "2026-01-31",
			end: "2026-01-31",
			allDay: true,
			recurrence: {
				frequency: "monthly",
				until: "2026-04-30",
				pattern: { type: "dayOfMonth", dayOfMonth: 31, missingDayBehavior: "lastDay" },
			},
			exceptions: [],
		};
		expect(expandRecurringEvent(monthly, "2026-01-31", "2026-04-30").map((event) => event.start))
			.toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
	});

	it("distinguishes fifth-weekday rules from last-weekday rules", () => {
		const fifthSaturday: EventRecord = {
			...series,
			id: "fifth-saturday",
			start: "2026-08-29T08:00:00.000Z",
			end: "2026-08-29T09:00:00.000Z",
			timezone: "UTC",
			recurrence: {
				frequency: "monthly",
				until: "2026-10-31",
				pattern: { type: "weekdayOfMonth", weekday: "saturday", position: 5 },
			},
			exceptions: [],
		};
		expect(expandRecurringEvent(fifthSaturday, "2026-08-01", "2026-10-31").map((event) => event.start))
			.toEqual(["2026-08-29T08:00:00.000Z", "2026-10-31T08:00:00.000Z"]);

		const lastWednesday = {
			...fifthSaturday,
			id: "last-wednesday",
			start: "2026-10-28T08:00:00.000Z",
			end: "2026-10-28T09:00:00.000Z",
			recurrence: {
				frequency: "monthly" as const,
				until: "2026-12-31",
				pattern: { type: "weekdayOfMonth" as const, weekday: "wednesday" as const, position: "last" as const },
			},
		};
		expect(expandRecurringEvent(lastWednesday, "2026-10-01", "2026-12-31").map((event) => event.start))
			.toEqual(["2026-10-28T08:00:00.000Z", "2026-11-25T08:00:00.000Z", "2026-12-30T08:00:00.000Z"]);
	});
});

describe("saved venue public links", () => {
	const venue = {
		name: "Clubhouse",
		street: "10 Green Lane",
		street2: "",
		locality: "Utrecht",
		region: "",
		postalCode: "3511 AA",
		country: "Netherlands",
	};

	it("formats the address and directions without accepting unsafe URLs", () => {
		expect(formatVenueAddress(venue)).toBe("10 Green Lane, Utrecht, 3511 AA, Netherlands");
		expect(eventLocation(venue, "East entrance")).toBe("Clubhouse · 10 Green Lane, Utrecht, 3511 AA, Netherlands · East entrance");
		expect(directionsUrl("Clubhouse, Utrecht")).toContain("google.com/maps/dir");
		expect(safeHttpUrl("javascript:alert(1)")).toBe("");
	});

	it("formats incomplete international addresses without empty separators", () => {
		const partial = {
			name: "Riverside field",
			street: "  ",
			street2: "",
			locality: "Utrecht",
			region: "",
			postalCode: "",
			country: "Netherlands",
		};
		expect(formatVenueAddress(partial)).toBe("Utrecht, Netherlands");
		expect(eventLocation(partial, "Use the east entrance")).toBe("Riverside field · Utrecht, Netherlands · Use the east entrance");
		expect(directionsUrl("")).toBe("");
	});
});

describe("recurrence exception references", () => {
	it("accepts exceptions for scheduled occurrences and rejects IDs orphaned by rule changes", () => {
		const series: EventRecord = {
			id: "weekly-series", title: "Practice", description: "", start: "2026-10-10T07:00:00.000Z",
			end: "2026-10-10T08:00:00.000Z", allDay: false, timezone: "UTC", location: "", organizer: "",
			externalUrl: "", imageUrl: "", categories: [], published: true,
			recurrence: { frequency: "daily", until: "2026-10-12" },
			exceptions: [{ recurrenceId: "2026-10-11T07:00", status: "cancelled" }],
			createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
		};
		expect(exceptionIdsMatchRecurrence(series)).toBe(true);
		expect(exceptionIdsMatchRecurrence({
			...series,
			recurrence: { frequency: "weekly", until: "2026-10-12" },
		})).toBe(false);
	});
});
