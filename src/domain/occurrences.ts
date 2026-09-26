import { instantToLocalDateTime, isDateOnly } from "./date-time";
import type { EventRecord } from "./event";
import { expandEventsInDateRange, scheduledOccurrence } from "./recurrence";

export function validOccurrenceRange(from: string, through: string): boolean {
  return isDateOnly(from) && isDateOnly(through) && from <= through &&
    Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) < 366 * 86_400_000;
}

export interface InspectedOccurrence {
  id: string;
  recurrenceId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledLocalStart: string;
  scheduledLocalEnd: string;
  scheduledTimezone: string;
  start: string;
  end: string;
  localStart: string;
  localEnd: string;
  timezone: string;
  allDay: boolean;
  status: "scheduled" | "cancelled" | "modified";
}

function local(value: string, event: EventRecord): string {
  return event.allDay ? value : instantToLocalDateTime(value, event.timezone);
}

/** Editor/agent inspection includes cancelled dates; the public expansion stays unchanged. */
export function inspectOccurrences(event: EventRecord, from: string, through: string, limit = 100, offset = 0) {
  if (!validOccurrenceRange(from, through) || !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isInteger(offset) || offset < 0) throw new Error("Invalid occurrence range or limit.");
  const visible = expandEventsInDateRange([{
    ...event, exceptions: event.exceptions.filter((item) => item.status !== "cancelled"),
  }], from, through);
  const occurrences: InspectedOccurrence[] = visible.slice(offset, offset + limit).map((effective) => {
    const recurrenceId = event.recurrence ? effective.id.slice(event.id.length + 1) : null;
    const scheduled = recurrenceId ? scheduledOccurrence(event, recurrenceId)! : event;
    const exception = event.exceptions.find((item) => item.recurrenceId === recurrenceId);
    return {
      id: effective.id, recurrenceId,
      scheduledStart: scheduled.start, scheduledEnd: scheduled.end,
      scheduledLocalStart: local(scheduled.start, scheduled), scheduledLocalEnd: local(scheduled.end, scheduled),
      scheduledTimezone: scheduled.timezone,
      start: effective.start, end: effective.end,
      localStart: local(effective.start, effective), localEnd: local(effective.end, effective),
      timezone: effective.timezone, allDay: effective.allDay, status: exception?.status ?? "scheduled",
    };
  });
  return { from, through, occurrences, total: visible.length, truncated: offset + occurrences.length < visible.length };
}
