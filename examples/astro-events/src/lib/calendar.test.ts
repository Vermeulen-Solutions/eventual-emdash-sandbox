import { describe, expect, it } from "vitest";
import {
	addMonths,
	addCalendarDay,
	buildCalendar,
	calendarRange,
	displayDate,
	eventDetailsUrl,
	eventEndDate,
	eventStartDate,
	eventTouchesDate,
	eventTimeRange,
	formatICalendar,
	firstDayOfWeek,
	isMonthKey,
	monthDateRange,
	normalizeLocale,
	normalizeTimeZone,
	safeHttpUrl,
	safeImageUrl,
	weekdayHeadings,
} from "./calendar";
import type { PublicEvent } from "./feed";

function event(overrides: Partial<PublicEvent> = {}): PublicEvent {
	return {
		id: "test-event",
		updatedAt: "2026-10-01T10:20:30.000Z",
		title: "Community event",
		description: "",
		start: "2026-10-10T16:00:00.000Z",
		end: "2026-10-10T17:00:00.000Z",
		allDay: false,
		timezone: "Europe/Paris",
		location: "Town hall",
		organizer: "",
		externalUrl: "",
		imageUrl: "",
		categories: ["community"],
		venue: null,
		directionsUrl: "",
		...overrides,
	};
}

describe("Astro event browser calendar", () => {
	it("uses locale week starts for headings and grid boundaries", () => {
		expect(firstDayOfWeek("en-GB")).toBe(1);
		expect(firstDayOfWeek("en-US")).toBe(0);
		expect(weekdayHeadings("en-US")[0]).toMatch(/Sun/i);
		expect(calendarRange("2026-09", "en-GB")).toEqual({ from: "2026-08-31", through: "2026-10-04" });
		expect(calendarRange("2026-08", "en-US")).toEqual({ from: "2026-07-26", through: "2026-09-05" });
		expect(monthDateRange("2026-02")).toEqual({ from: "2026-02-01", through: "2026-02-28" });
		expect(monthDateRange("2024-02")).toEqual({ from: "2024-02-01", through: "2024-02-29" });
	});

	it("builds five or six complete locale-aligned weeks and keeps adjacent dates marked", () => {
		const ordinaryMonth = buildCalendar("2026-09", "en-GB", []);
		const sixWeekMonth = buildCalendar("2026-08", "en-US", []);
		expect(ordinaryMonth).toHaveLength(5);
		expect(ordinaryMonth.flat()).toHaveLength(35);
		expect(ordinaryMonth[0]![0]).toMatchObject({ date: "2026-08-31", inMonth: false });
		expect(sixWeekMonth).toHaveLength(6);
		expect(sixWeekMonth.flat()).toHaveLength(42);
		expect(buildCalendar("2026-09", "en-GB", []).flat().every((cell) => cell.events.length === 0)).toBe(true);
	});

	it("places timed multi-day events by their local timezone dates", () => {
		const overnight = event({
			start: "2026-10-31T23:30:00.000Z",
			end: "2026-11-01T01:00:00.000Z",
			timezone: "Europe/Paris",
		});
		expect(eventTouchesDate(overnight, "2026-11-01")).toBe(true);
		expect(eventTouchesDate(overnight, "2026-10-31")).toBe(false);
	});

	it("treats all-day end dates as inclusive", () => {
		const camp = event({ start: "2026-10-10", end: "2026-10-12", allDay: true });
		expect(eventTouchesDate(camp, "2026-10-10")).toBe(true);
		expect(eventTouchesDate(camp, "2026-10-12")).toBe(true);
		expect(eventTouchesDate(camp, "2026-10-13")).toBe(false);
	});

	it("builds shareable detail URLs with stable occurrence IDs and local dates", () => {
		const occurrence = event({
			id: "series-1#2026-10-10T18:00",
			start: "2026-10-10T16:00:00.000Z",
			end: "2026-10-11T01:00:00.000Z",
		});
		expect(eventStartDate(occurrence)).toBe("2026-10-10");
		expect(eventEndDate(occurrence)).toBe("2026-10-11");
		expect(eventDetailsUrl(occurrence)).toBe("/events/series-1%232026-10-10T18%3A00?from=2026-10-10&through=2026-10-11");
		expect(eventDetailsUrl(occurrence, "/events", ".ics")).toContain("/events/series-1%232026-10-10T18%3A00.ics?");
	});

	it("exports stable ICS IDs, UTC timed instants, named timezone metadata and inclusive all-day ranges", () => {
		const timed = formatICalendar(event({
			id: "series#2026-10-10T18:00",
			title: "Club, meeting; \"today\"",
			description: "Line one\nLine two",
		}), "events.example", new Date("2026-10-01T12:30:00.000Z"));
		expect(timed).toContain("UID:series#2026-10-10T18:00@events.example");
		expect(timed).toContain("DTSTAMP:20261001T123000Z");
		expect(timed).toContain("LAST-MODIFIED:20261001T102030Z");
		expect(timed).toContain("SEQUENCE:1790850030000");
		expect(timed).toContain("DTSTART:20261010T160000Z");
		expect(timed).toContain("DTEND:20261010T170000Z");
		expect(timed).toContain("X-EVENTUAL-TIMEZONE:Europe/Paris");
		expect(timed).toContain('SUMMARY:Club\\, meeting\\; "today"');
		expect(timed).toContain("DESCRIPTION:Line one\\nLine two");

		const allDay = formatICalendar(event({ start: "2026-10-10", end: "2026-10-12", allDay: true }), "events.example");
		expect(allDay).toContain("DTSTART;VALUE=DATE:20261010");
		expect(allDay).toContain("DTEND;VALUE=DATE:20261013");
		expect(addCalendarDay("2024-02-29")).toBe("2024-03-01");
	});

	it("folds calendar lines at 75 UTF-8 octets", () => {
		const calendar = formatICalendar(event({ title: "é".repeat(50) }), "events.example");
		for (const line of calendar.split("\r\n")) {
			if (line) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
	});

	it("formats occurrence wall times and all-day dates without browser timezone shifts", () => {
		const timed = event({ start: "2026-10-10T16:00:00.000Z", end: "2026-10-10T17:30:00.000Z" });
		expect(eventTimeRange(timed, "en-GB")).toContain("18:00");
		expect(eventTimeRange(timed, "en-GB")).toContain("19:30");
		expect(eventTimeRange(timed, "en-GB")).toMatch(/CEST|GMT\+2|UTC\+2/);
		expect(displayDate("2026-10-10", "en-GB", "Europe/Paris", true)).toContain("10 Oct 2026");
	});

	it("validates month query values and keeps navigation on month boundaries", () => {
		expect(isMonthKey("2026-09")).toBe(true);
		expect(isMonthKey("2026-13")).toBe(false);
		expect(isMonthKey("0099-01")).toBe(false);
		expect(addMonths("2026-01", -1)).toBe("2025-12");
		expect(addMonths("2026-12", 1)).toBe("2027-01");
	});

	it("falls back safely for invalid presentation locale or timezone configuration", () => {
		expect(normalizeLocale("broken_locale")).toBe("en-GB");
		expect(normalizeTimeZone("Mars/Olympus_Mons")).toBe("UTC");
	});

	it("resolves relative EmDash image routes but rejects unsafe URLs", () => {
		expect(safeHttpUrl("/_emdash/image?id=123", "https://events.example/")).toBe("https://events.example/_emdash/image?id=123");
		expect(safeHttpUrl("javascript:alert(1)", "https://events.example/")).toBe("");
		expect(safeHttpUrl("data:image/png;base64,AAAA")).toBe("");
		expect(safeImageUrl("/_emdash/image?id=123", "http://127.0.0.1:4322")).toBe("http://127.0.0.1:4322/_emdash/image?id=123");
		expect(safeImageUrl("http://insecure.example/image.png", "https://events.example")).toBe("");
		expect(safeImageUrl("https://images.example/image.png", "https://events.example")).toBe("https://images.example/image.png");
	});
});
