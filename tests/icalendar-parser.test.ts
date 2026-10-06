import { describe, it, expect } from "vitest";
import ICAL from "ical.js";
import { formatCalendarFeed, eventUid } from "../src/domain/icalendar";
import type { EventRecord } from "../src/domain/event";
const event: EventRecord = {
  id: "native#2026-11-15T10:00",
  translationGroup: "group",
  title: "Fête 🎉, Genève; 日本語 ".repeat(8),
  description: "**Welcome**\n\n[Register](https://example.com/register)",
  start: "2026-11-15T10:00:00Z",
  end: "2026-11-15T11:00:00Z",
  allDay: false,
  timezone: "UTC",
  location: "Hall, west; door",
  organizer: "",
  externalUrl: "",
  imageUrl: "",
  categories: ["Art, music", "A;B"],
  published: true,
  exceptions: [],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  calendarSequence: 7,
};
describe("Independent RFC 5545 parser round trips", () => {
  it("preserves Unicode, escaped text, categories, stable identity and bounded sequence", () => {
    const feed = formatCalendarFeed(
      [event],
      [],
      "example.com",
      new Date("2026-11-01T12:00:00Z"),
    );
    for (const line of feed.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const calendar = new ICAL.Component(ICAL.parse(feed));
    const item = calendar.getFirstSubcomponent("vevent")!;
    expect(item.getFirstPropertyValue("summary")).toBe(event.title);
    expect(item.getFirstPropertyValue("uid")).toBe(
      eventUid(event, "example.com"),
    );
    expect(item.getFirstPropertyValue("sequence")).toBe(7);
    expect(item.getFirstPropertyValue("description")).toBe(
      "Welcome\n\nRegister (https://example.com/register)",
    );
    expect(item.getFirstProperty("categories")!.getValues()).toEqual(
      event.categories,
    );
    expect(new ICAL.Event(item).startDate.toJSDate().toISOString()).toBe(
      "2026-11-15T10:00:00.000Z",
    );
  });
  it("encodes inclusive all-day ends as exclusive calendar dates and omits zero-duration DTEND", () => {
    const allDay = {
      ...event,
      id: "day",
      allDay: true,
      start: "2026-11-15",
      end: "2026-11-16",
    };
    const parsed = new ICAL.Component(
      ICAL.parse(
        formatCalendarFeed(
          [allDay, { ...event, id: "instant", end: event.start }],
          [],
          "example.com",
        ),
      ),
    );
    const [day, instant] = parsed.getAllSubcomponents("vevent");
    expect(new ICAL.Event(day!).endDate.toString()).toBe("2026-11-17");
    expect(instant!.hasProperty("dtend")).toBe(false);
  });
  it("does not alias translation groups that differ by an eventual prefix", () => {
    expect(
      eventUid({ id: "a", translationGroup: "x" }, "example.com"),
    ).not.toBe(
      eventUid({ id: "b", translationGroup: "eventual-x" }, "example.com"),
    );
  });
});
