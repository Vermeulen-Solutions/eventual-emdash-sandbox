import { describe, expect, it } from "vitest";
import type { EventRecord } from "../src/domain/event";
import { inspectOccurrences } from "../src/domain/occurrences";
import { expandRecurringEvent, scheduledOccurrence } from "../src/domain/recurrence";

const event: EventRecord = {
  id: "practice", title: "Practice", description: "", start: "2026-10-06T16:00:00.000Z", end: "2026-10-06T17:00:00.000Z",
  allDay: false, timezone: "Europe/Paris", location: "", organizer: "", externalUrl: "", imageUrl: "", categories: [],
  published: false, recurrence: { frequency: "weekly", until: "2026-11-30" }, exceptions: [], createdAt: "", updatedAt: "",
};

describe("saved occurrence inspection", () => {
  it("includes cancelled dates and keeps moved identity when its original date is outside the window", () => {
    const changed: EventRecord = { ...event, exceptions: [
      { recurrenceId: "2026-10-06T18:00", status: "modified", overrides: { start: "2026-10-27T18:00:00.000Z", end: "2026-10-27T19:00:00.000Z" } },
      { recurrenceId: "2026-10-27T18:00", status: "cancelled" },
    ] };
    const rows = inspectOccurrences(changed, "2026-10-27", "2026-10-27").occurrences;
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.status === "modified")).toMatchObject({
      id: "practice#2026-10-06T18:00", recurrenceId: "2026-10-06T18:00",
      scheduledLocalStart: "2026-10-06T18:00", localStart: "2026-10-27T19:00",
    });
    expect(rows.find((row) => row.status === "cancelled")).toMatchObject({ recurrenceId: "2026-10-27T18:00", localStart: "2026-10-27T18:00" });
    expect(expandRecurringEvent(changed, "2026-10-27", "2026-10-27").map((row) => row.id)).toEqual(["practice#2026-10-06T18:00"]);
    expect(inspectOccurrences(changed, "2026-10-01", "2026-10-31").occurrences.filter((row) => row.recurrenceId === "2026-10-06T18:00")).toHaveLength(1);
  });

  it("reports truncation, supports pages, and bounds inclusive ranges to 366 dates", () => {
    const daily = { ...event, recurrence: { frequency: "daily" as const, until: "2027-10-06" } };
    const first = inspectOccurrences(daily, "2026-10-06", "2026-10-31", 10);
    expect(first).toMatchObject({ total: 26, truncated: true });
    expect(inspectOccurrences(daily, "2026-10-06", "2026-10-31", 10, 20)).toMatchObject({ total: 26, truncated: false });
    expect(inspectOccurrences(daily, "2026-10-06", "2027-10-06", 100).total).toBe(366);
    expect(() => inspectOccurrences(daily, "2026-10-06", "2027-10-07")).toThrow();
    expect(() => inspectOccurrences(daily, "2026-02-31", "2026-03-01")).toThrow();
  });

  it("inspects one-off all-day events without creating a recurrence ID", () => {
    const single = { ...event, recurrence: undefined, allDay: true, start: "2026-10-06", end: "2026-10-08" };
    expect(inspectOccurrences(single, "2026-10-07", "2026-10-07").occurrences[0]).toMatchObject({
      id: "practice", recurrenceId: null, localStart: "2026-10-06", localEnd: "2026-10-08", allDay: true, status: "scheduled",
    });
    expect(scheduledOccurrence(event, "2026-10-07T18:00")).toBeNull();
    expect(scheduledOccurrence(event, "2026-10-06T19:00")).toBeNull();
  });
});
