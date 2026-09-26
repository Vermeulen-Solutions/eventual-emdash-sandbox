import {
  calendarDateKey,
  instantToLocalDateTime,
  isDateOnly,
  localDateTimeToInstant,
} from "./date-time";
import type {
  EventException,
  EventRecurrence,
  EventRecord,
  MonthlyPosition,
  WeekdayName,
} from "./event";

export const MAX_EXPANSION_RANGE_DAYS = 366;

const WEEKDAYS: WeekdayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function dateKey(value: Date): string {
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function addDays(value: string, count: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + count);
  return dateKey(date);
}

function dayDifference(start: string, end: string): number {
  return (dateFromKey(end).getTime() - dateFromKey(start).getTime()) / 86_400_000;
}

function positionInMonth(value: string): MonthlyPosition {
	const date = dateFromKey(value);
	return Math.ceil(date.getUTCDate() / 7) as MonthlyPosition;
}

function matchesMonthlyPattern(date: string, recurrence: EventRecurrence): boolean {
  if (recurrence.frequency !== "monthly") return false;
  const value = dateFromKey(date);
  if (recurrence.pattern.type === "dayOfMonth") {
    const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
    const target = recurrence.pattern.missingDayBehavior === "lastDay"
      ? Math.min(recurrence.pattern.dayOfMonth, last)
      : recurrence.pattern.dayOfMonth;
    return value.getUTCDate() === target;
  }
	if (WEEKDAYS[value.getUTCDay()] !== recurrence.pattern.weekday) return false;
	if (recurrence.pattern.position !== "last") return positionInMonth(date) === recurrence.pattern.position;
	const nextWeek = dateFromKey(addDays(date, 7));
	return nextWeek.getUTCMonth() !== value.getUTCMonth() || nextWeek.getUTCFullYear() !== value.getUTCFullYear();
}

function recurrenceStartDate(event: EventRecord): string {
  return event.allDay
    ? event.start.slice(0, 10)
    : instantToLocalDateTime(event.start, event.timezone).slice(0, 10);
}

function recurrenceIdForDate(date: string, wallTime: string, allDay: boolean): string {
  return allDay ? date : `${date}T${wallTime}`;
}

function exceptionInRange(
  exception: EventException,
  series: EventRecord,
  from: string,
  through: string,
): boolean {
  if (exception.status !== "modified" || !exception.overrides?.start) return false;
  const start = exception.overrides.start;
  const allDay = exception.overrides.allDay ?? series.allDay;
  const timezone = exception.overrides.timezone ?? series.timezone;
  const startDate = allDay ? start.slice(0, 10) : calendarDateKey(start, false, timezone);
  const endValue = exception.overrides.end ?? start;
  const endDate = allDay
    ? endValue.slice(0, 10)
    : calendarDateKey(endValue, false, timezone);
  return startDate <= through && endDate >= from;
}

function applyException(
  series: EventRecord,
  recurrenceId: string,
  exception?: EventException,
): EventRecord | null {
  if (exception?.status === "cancelled") return null;
  const { recurrence: _recurrence, exceptions: _exceptions, ...fields } = series;
  return {
    ...fields,
    ...exception?.overrides,
    id: `${series.id}#${recurrenceId}`,
    exceptions: [],
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
  };
}

function overlaps(event: EventRecord, from: string, through: string): boolean {
  const start = calendarDateKey(event.start, event.allDay, event.timezone);
  const end = calendarDateKey(event.end, event.allDay, event.timezone);
  return start <= through && end >= from;
}

export function expandRecurringEvent(
  event: EventRecord,
  from: string,
  through: string,
): EventRecord[] {
  const recurrence = event.recurrence;
  if (!recurrence || !isDateOnly(from) || !isDateOnly(through) || from > through) return [];
  const span = dayDifference(from, through);
  if (span > MAX_EXPANSION_RANGE_DAYS) return [];

  const firstDate = recurrenceStartDate(event);
  if (!isDateOnly(firstDate) || firstDate > recurrence.until) return [];
  const timedWallStart = event.allDay
    ? ""
    : instantToLocalDateTime(event.start, event.timezone).slice(11, 16);
  const baseDuration = Date.parse(event.end) - Date.parse(event.start);
  const allDaySpan = event.allDay
    ? dayDifference(event.start.slice(0, 10), event.end.slice(0, 10))
    : 0;
  const lookback = event.allDay ? allDaySpan : Math.ceil(baseDuration / 86_400_000);
  const lower = addDays(from, -Math.min(MAX_EXPANSION_RANGE_DAYS, lookback));
  const upper = through < recurrence.until ? through : recurrence.until;
  const exceptionMap = new Map(
    (event.exceptions ?? []).map((exception) => [exception.recurrenceId, exception]),
  );
  const result: EventRecord[] = [];

  for (let date = lower; date <= upper; date = addDays(date, 1)) {
    if (date < firstDate) continue;
    const weekdayMatches = dateFromKey(date).getUTCDay() === dateFromKey(firstDate).getUTCDay();
    const matches = recurrence.frequency === "daily"
      ? true
      : recurrence.frequency === "weekly"
        ? weekdayMatches
        : matchesMonthlyPattern(date, recurrence);
    if (!matches) continue;

    const recurrenceId = recurrenceIdForDate(date, timedWallStart, event.allDay);
    const exception = exceptionMap.get(recurrenceId);
    let start = date;
    let end = addDays(date, allDaySpan);
    if (!event.allDay) {
      const startInstant = localDateTimeToInstant(`${date}T${timedWallStart}`, event.timezone);
      if (!startInstant.value) continue;
      start = startInstant.value;
      end = new Date(Date.parse(start) + baseDuration).toISOString();
    }
    const occurrence = applyException(
      { ...event, start, end },
      recurrenceId,
      exception,
    );
    if (occurrence && overlaps(occurrence, from, through)) result.push(occurrence);
  }

  for (const exception of event.exceptions ?? []) {
    if (!exceptionInRange(exception, event, from, through)) continue;
    if (result.some((item) => item.id === `${event.id}#${exception.recurrenceId}`)) continue;
    const moved = applyException(event, exception.recurrenceId, exception);
    if (moved && overlaps(moved, from, through)) result.push(moved);
  }

  return result.sort((left, right) => left.start.localeCompare(right.start));
}

export function expandEventsInDateRange(
  events: EventRecord[],
  from: string,
  through: string,
): EventRecord[] {
  const expanded: EventRecord[] = [];
  for (const event of events) {
    if (event.recurrence) expanded.push(...expandRecurringEvent(event, from, through));
    else if (overlaps(event, from, through)) expanded.push(event);
  }
  return expanded.sort((left, right) => left.start.localeCompare(right.start));
}

/** Ensure stored exception IDs still refer to dates generated by the current series rule. */
export function exceptionIdsMatchRecurrence(event: EventRecord): boolean {
  const exceptions = event.exceptions ?? [];
  if (!exceptions.length) return true;
  if (!event.recurrence || new Set(exceptions.map((item) => item.recurrenceId)).size !== exceptions.length) return false;
  const days = new Set<string>();
  for (const exception of exceptions) {
    const day = exception.recurrenceId.slice(0, 10);
    if (!isDateOnly(day) || day > event.recurrence.until) return false;
    days.add(day);
  }
  for (const day of days) {
    const scheduled = expandEventsInDateRange([{ ...event, exceptions: [] }], day, day);
    if (exceptions.some((item) => item.recurrenceId.startsWith(day) &&
      !scheduled.some((occurrence) => occurrence.id === `${event.id}#${item.recurrenceId}`))) return false;
  }
  return true;
}
