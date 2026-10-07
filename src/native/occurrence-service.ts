import { instantToLocalDateTime, isDateOnly } from "../domain/date-time";
import type {
  EventException,
  EventOverride,
  EventRecord,
} from "../domain/event";
import {
  addDays,
  expandRecurringEvent,
  scheduledOccurrence,
} from "../domain/recurrence";
import { validOccurrenceRange } from "../domain/occurrences";
import { parseJson } from "../domain/native-validation";

export interface OccurrenceCopy {
  recurrenceId: string;
  overrides: Record<string, unknown>;
}

export interface NativeInspectedOccurrence {
  id: string;
  recurrenceId: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduledLocalStart: string;
  scheduledLocalEnd: string;
  effectiveStart: string;
  effectiveEnd: string;
  effectiveLocalStart: string;
  effectiveLocalEnd: string;
  timezone: string;
  allDay: boolean;
  status: "scheduled" | "cancelled" | "modified";
  hasLocalizedCopy: boolean;
  localizedCopy?: Record<string, unknown>;
}

export interface OccurrenceInspectionResult {
  from: string;
  through: string;
  occurrences: NativeInspectedOccurrence[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

/** Inspects all occurrences in a date range, including cancelled dates. */
export function inspectNativeOccurrences(
  fields: Record<string, unknown>,
  from: string,
  through: string,
  limit = 10,
  offset = 0,
): OccurrenceInspectionResult {
  if (!validOccurrenceRange(from, through)) {
    throw new Error("Invalid occurrence date range. Must be <= 366 days.");
  }

  const recurrence = parseJson(fields.recurrence);
  if (!recurrence || typeof recurrence !== "object") {
    return {
      from,
      through,
      occurrences: [],
      total: 0,
      offset,
      limit,
      hasMore: false,
    };
  }

  const allDay = Boolean(fields.all_day);
  const timezone = String(fields.timezone || "Europe/Zurich");
  const start = allDay
    ? String(fields.start_date || "")
    : String(fields.start || "");
  const end = allDay
    ? String(fields.end_date || start)
    : String(fields.end || start);

  const parsedExceptions = parseJson(fields.exceptions);
  const rawExceptions = Array.isArray(parsedExceptions)
    ? (parsedExceptions as EventException[])
    : [];
  const exceptionMap = new Map<string, EventException>();
  for (const ex of rawExceptions) {
    if (ex && typeof ex.recurrenceId === "string") {
      exceptionMap.set(ex.recurrenceId, ex);
    }
  }

  const parsedCopy = parseJson(fields.occurrence_content);
  const rawCopy = new Map(
    (Array.isArray(parsedCopy) ? (parsedCopy as OccurrenceCopy[]) : []).map(
      (item) => [item.recurrenceId, item.overrides],
    ),
  );

  // Expand unconstrained series without cancellations to find every scheduled occurrence
  const baseEvent: EventRecord = {
    id: "series",
    title: String(fields.title || ""),
    description: "",
    start,
    end,
    allDay,
    timezone,
    location: "",
    organizer: "",
    externalUrl: "",
    imageUrl: "",
    categories: [],
    published: true,
    recurrence: recurrence as any,
    exceptions: [], // pure series expansion
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const rawSeries = expandRecurringEvent(baseEvent, from, through);

  const allRows: NativeInspectedOccurrence[] = rawSeries.map((item) => {
    const recurrenceId = item.id.slice("series#".length);
    const scheduled = scheduledOccurrence(baseEvent, recurrenceId) ?? item;
    const exception = exceptionMap.get(recurrenceId);

    const isCancelled = exception?.status === "cancelled";
    const isModified = exception?.status === "modified";
    const status: "scheduled" | "cancelled" | "modified" = isCancelled
      ? "cancelled"
      : isModified
        ? "modified"
        : "scheduled";

    const effective =
      isModified && exception?.overrides
        ? { ...item, ...exception.overrides }
        : item;

    const local = (val: string, day: boolean, zone: string) =>
      day ? val : instantToLocalDateTime(val, zone);

    return {
      id: recurrenceId,
      recurrenceId,
      scheduledStart: scheduled.start,
      scheduledEnd: scheduled.end,
      scheduledLocalStart: local(scheduled.start, allDay, timezone),
      scheduledLocalEnd: local(scheduled.end, allDay, timezone),
      effectiveStart: isCancelled ? scheduled.start : effective.start,
      effectiveEnd: isCancelled ? scheduled.end : effective.end,
      effectiveLocalStart: local(
        isCancelled ? scheduled.start : effective.start,
        effective.allDay,
        effective.timezone || timezone,
      ),
      effectiveLocalEnd: local(
        isCancelled ? scheduled.end : effective.end,
        effective.allDay,
        effective.timezone || timezone,
      ),
      timezone: effective.timezone || timezone,
      allDay: effective.allDay,
      status,
      hasLocalizedCopy: rawCopy.has(recurrenceId),
      localizedCopy: rawCopy.get(recurrenceId),
    };
  });

  const sliced = allRows.slice(offset, offset + limit);

  return {
    from,
    through,
    occurrences: sliced,
    total: allRows.length,
    offset,
    limit,
    hasMore: offset + limit < allRows.length,
  };
}

/** Cancels a single occurrence date by adding/updating a cancellation exception. */
export function cancelNativeOccurrence(
  exceptions: EventException[] = [],
  recurrenceId: string,
): EventException[] {
  const result = exceptions.filter((ex) => ex.recurrenceId !== recurrenceId);
  result.push({
    recurrenceId,
    status: "cancelled",
  });
  return result;
}

/** Reschedules an occurrence with custom start/end/timezone overrides. */
export function rescheduleNativeOccurrence(
  exceptions: EventException[] = [],
  recurrenceId: string,
  overrides: EventOverride,
): EventException[] {
  const result = exceptions.filter((ex) => ex.recurrenceId !== recurrenceId);
  result.push({
    recurrenceId,
    status: "modified",
    overrides,
  });
  return result;
}

/** Restores an occurrence by removing any exceptions for this recurrence ID. */
export function restoreNativeOccurrence(
  exceptions: EventException[] = [],
  recurrenceId: string,
): EventException[] {
  return exceptions.filter((ex) => ex.recurrenceId !== recurrenceId);
}

/** Sets localized copy (announcement title/notes) for a specific occurrence date. */
export function setNativeOccurrenceCopy(
  copy: OccurrenceCopy[] = [],
  recurrenceId: string,
  localizedFields: Record<string, unknown>,
): OccurrenceCopy[] {
  return [
    ...copy.filter((item) => item.recurrenceId !== recurrenceId),
    {
      recurrenceId,
      overrides: {
        ...copy.find((item) => item.recurrenceId === recurrenceId)?.overrides,
        ...localizedFields,
      },
    },
  ];
}

/** Clears localized copy for a specific occurrence date. */
export function clearNativeOccurrenceCopy(
  copy: OccurrenceCopy[] = [],
  recurrenceId: string,
): OccurrenceCopy[] {
  return copy.filter((item) => item.recurrenceId !== recurrenceId);
}
