import { describe, expect, it } from "vitest";
import type { EventRecord } from "../src/domain/event";
import { inspectOccurrences } from "../src/domain/occurrences";
import { exceptionIdsMatchRecurrence, expandRecurringEvent, scheduledOccurrence } from "../src/domain/recurrence";
import { eventToDraft, prepareEventData } from "../src/domain/event-data";
import { validRecurrence } from "../src/domain/recurrence-rule";

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

describe("recurrence intervals", () => {
  it("selects multiple weekdays in alternate Monday-based weeks and preserves exceptions", () => {
    const multi: EventRecord = { ...event, recurrence: { frequency: "weekly", interval: 2, until: "2026-11-06", weekdays: ["tuesday", "thursday"] },
      exceptions: [{ recurrenceId: "2026-10-08T18:00", status: "cancelled" }] };
    expect(inspectOccurrences(multi, "2026-10-01", "2026-11-06").occurrences.map((row) => row.recurrenceId))
      .toEqual(["2026-10-06T18:00", "2026-10-08T18:00", "2026-10-20T18:00", "2026-10-22T18:00", "2026-11-03T18:00", "2026-11-05T18:00"]);
    expect(exceptionIdsMatchRecurrence(multi)).toBe(true);
    expect(exceptionIdsMatchRecurrence({ ...multi, recurrence: { ...multi.recurrence!, frequency: "weekly", weekdays: ["tuesday"] } })).toBe(false);
    expect(prepareEventData(eventToDraft({ ...multi, recurrence: { frequency: "weekly", until: "2026-11-06", weekdays: ["thursday", "tuesday"] } })).data?.recurrence)
      .toMatchObject({ weekdays: ["tuesday", "thursday"] });
    expect(prepareEventData({ ...eventToDraft(multi), weeklyWeekdays: ["monday"] }).error).toContain("first event");
    expect(validRecurrence({ frequency: "weekly", until: "2026-11-06", weekdays: [] })).toBe(false);
    expect(validRecurrence({ frequency: "weekly", until: "2026-11-06", weekdays: ["tuesday", "tuesday"] })).toBe(false);
  });

  it("anchors a Sunday start to its containing week and never emits earlier selected weekdays", () => {
    const sunday: EventRecord = { ...event, start: "2026-10-04T16:00:00.000Z", end: "2026-10-04T17:00:00.000Z",
      recurrence: { frequency: "weekly", interval: 2, until: "2026-10-31", weekdays: ["monday", "sunday"] } };
    expect(inspectOccurrences(sunday, "2026-10-01", "2026-10-31").occurrences.map((row) => row.localStart))
      .toEqual(["2026-10-04T18:00", "2026-10-12T18:00", "2026-10-18T18:00", "2026-10-26T18:00"]);
  });

  it("skips nonexistent selected wall times and missing fifth weekdays with intervals", () => {
    const gap: EventRecord = { ...event, start: "2026-03-22T01:30:00.000Z", end: "2026-03-22T02:30:00.000Z",
      recurrence: { frequency: "weekly", until: "2026-04-05", weekdays: ["sunday"] } };
    expect(inspectOccurrences(gap, "2026-03-22", "2026-04-05").occurrences.map((row) => row.localStart))
      .toEqual(["2026-03-22T02:30", "2026-04-05T02:30"]);
    expect(scheduledOccurrence(gap, "2026-03-29T02:30")).toBeNull();
    const fifth: EventRecord = { ...event, allDay: true, start: "2026-08-29", end: "2026-08-29", recurrence: {
      frequency: "monthly", interval: 2, until: "2026-12-31", pattern: { type: "weekdayOfMonth", weekday: "saturday", position: 5 },
    } };
    expect(expandRecurringEvent(fifth, "2026-08-01", "2026-12-31").map((row) => row.start)).toEqual(["2026-08-29", "2026-10-31"]);
  });

  it("retains legacy schedules and weekly wall time through DST", () => {
    const everyWeek = expandRecurringEvent(event, "2026-10-01", "2026-11-30");
    expect(expandRecurringEvent({ ...event, recurrence: { ...event.recurrence!, interval: 1 } }, "2026-10-01", "2026-11-30")).toEqual(everyWeek);
    const alternate: EventRecord = { ...event, recurrence: { frequency: "weekly", interval: 2, until: "2026-11-10" } };
    expect(inspectOccurrences(alternate, "2026-10-01", "2026-11-30").occurrences.map((row) => row.localStart))
      .toEqual(["2026-10-06T18:00", "2026-10-20T18:00", "2026-11-03T18:00"]);
    expect(expandRecurringEvent(alternate, "2026-11-01", "2026-11-10")[0]?.start).toBe("2026-11-03T17:00:00.000Z");
    expect(exceptionIdsMatchRecurrence({ ...alternate, exceptions: [{ recurrenceId: "2026-10-13T18:00", status: "cancelled" }] })).toBe(false);
  });

  it("anchors daily and monthly intervals to local dates and preserves the monthly day", () => {
    const daily: EventRecord = { ...event, recurrence: { frequency: "daily", interval: 3, until: "2026-10-15" } };
    expect(inspectOccurrences(daily, "2026-10-01", "2026-10-15").occurrences.map((row) => row.localStart.slice(0, 10)))
      .toEqual(["2026-10-06", "2026-10-09", "2026-10-12", "2026-10-15"]);
    const monthEnd: EventRecord = { ...event, allDay: true, start: "2026-02-28", end: "2026-03-01", recurrence: {
      frequency: "monthly", interval: 2, until: "2026-08-31", pattern: { type: "dayOfMonth", dayOfMonth: 31, missingDayBehavior: "lastDay" },
    } };
    expect(expandRecurringEvent(monthEnd, "2026-02-01", "2026-08-31").map((row) => [row.start, row.end]))
      .toEqual([["2026-02-28", "2026-03-01"], ["2026-04-30", "2026-05-01"], ["2026-06-30", "2026-07-01"], ["2026-08-31", "2026-09-01"]]);
    expect(prepareEventData(eventToDraft(monthEnd)).data?.recurrence).toEqual(monthEnd.recurrence);
    expect(validRecurrence({ ...daily.recurrence, interval: 0 })).toBe(false);
    expect(validRecurrence({ ...daily.recurrence, interval: 1.5 })).toBe(false);
    expect(validRecurrence({ ...daily.recurrence, interval: 53 })).toBe(false);
    expect(validRecurrence({ ...daily.recurrence, interval: "2" })).toBe(false);
  });
});
