import type {
  EventRecurrence,
  WeekdayName,
  MonthlyPosition,
} from "../domain/event";
import {
  validRecurrence,
  WEEKDAYS,
  recurrenceSummary,
  normalizeWeekdays,
} from "../domain/recurrence-rule";
import { isDateOnly, instantToLocalDateTime } from "../domain/date-time";
import { expandRecurringEvent } from "../domain/recurrence";
import type { EventRecord } from "../domain/event";
import { parseJson } from "../domain/native-validation";

export interface RecurrenceFormInput {
  frequency?: string;
  interval?: number | string;
  weekdays?: string[] | string;
  until?: string;
  monthlyPatternType?: "dayOfMonth" | "weekdayOfMonth";
  dayOfMonth?: number | string;
  missingDayBehavior?: "skip" | "lastDay";
  weekday?: string;
  position?: string | number;
}

/** Compiles friendly form input into a valid EventRecurrence object or null. */
export function compileRecurrenceFromForm(input: RecurrenceFormInput): {
  rule: EventRecurrence | null;
  error?: string;
} {
  const failure = (error: string) => ({rule:null, error});
  const frequency = String(input.frequency || '').trim().toLowerCase();
  if (!frequency || frequency === 'none') return {rule:null};
  const until = String(input.until || '').trim();
  if (!isDateOnly(until)) return failure('Repeat until must be a valid YYYY-MM-DD date.');
  const interval = input.interval === undefined || String(input.interval).trim() === '' ? 1 : Number(input.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 52) return failure('Interval must be an integer between 1 and 52.');
  const rule: Record<string, unknown> = {frequency, until, ...(interval > 1 ? {interval} : {})};
  if (frequency === 'weekly' && input.weekdays) {
    const days = Array.isArray(input.weekdays) ? input.weekdays : String(input.weekdays).split(',').map(value => value.trim());
    if (days.some(day => !WEEKDAYS.includes(day as WeekdayName))) return failure('Choose valid weekdays.');
    if (days.length) rule.weekdays = normalizeWeekdays(days as WeekdayName[]);
  } else if (frequency === 'monthly') {
    const type = input.monthlyPatternType ?? 'dayOfMonth';
    if (type === 'dayOfMonth') {
      const dayOfMonth = Number(input.dayOfMonth ?? 1);
      if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return failure('Day of month must be between 1 and 31.');
      rule.pattern = {type, dayOfMonth, missingDayBehavior:input.missingDayBehavior === 'lastDay' ? 'lastDay' : 'skip'};
    } else if (type === 'weekdayOfMonth') {
      const weekday = String(input.weekday || 'monday').toLowerCase();
      if (!WEEKDAYS.includes(weekday as WeekdayName)) return failure('Choose a valid weekday.');
      const position = input.position === 'last' ? 'last' : Number(input.position ?? 1);
      if (position !== 'last' && (!Number.isInteger(position) || position < 1 || position > 5)) return failure('Choose first, second, third, fourth, fifth or last.');
      rule.pattern = {type, weekday, position};
    } else return failure('Choose a monthly pattern.');
  }
  if (!['daily','weekly','monthly'].includes(frequency)) return failure('Unsupported recurrence frequency: '+frequency);
  return validRecurrence(rule) ? {rule} : failure('Invalid '+frequency+' recurrence.');
}

/** Deconstructs stored canonical recurrence rule into form fields. */
export function recurrenceToFormValues(rule: unknown): RecurrenceFormInput {
  rule = parseJson(rule);
  if (!validRecurrence(rule)) {
    return { frequency: "none", interval: 1 };
  }
  const base: RecurrenceFormInput = {
    frequency: rule.frequency,
    interval: rule.interval ?? 1,
    until: rule.until,
  };
  if (rule.frequency === "weekly" && rule.weekdays) {
    base.weekdays = [...rule.weekdays];
  }
  if (rule.frequency === "monthly" && rule.pattern) {
    if (rule.pattern.type === "dayOfMonth") {
      base.monthlyPatternType = "dayOfMonth";
      base.dayOfMonth = rule.pattern.dayOfMonth;
      base.missingDayBehavior = rule.pattern.missingDayBehavior;
    } else {
      base.monthlyPatternType = "weekdayOfMonth";
      base.weekday = rule.pattern.weekday;
      base.position = rule.pattern.position;
    }
  }
  return base;
}

/** Formats a human readable summary of a recurrence rule. */
export function formatHumanRecurrence(rule: unknown): string {
  rule = parseJson(rule);
  if (!validRecurrence(rule)) {
    return "Does not repeat";
  }
  let summary = recurrenceSummary(rule);
  if (rule.frequency === "monthly") {
    const pattern = rule.pattern;
    summary += pattern.type === "dayOfMonth"
      ? ` on day ${pattern.dayOfMonth} (${pattern.missingDayBehavior === "skip" ? "skip missing months" : "use last day if missing"})`
      : ` on ${pattern.position === "last" ? "last" : ["first", "second", "third", "fourth", "fifth"][pattern.position - 1]} ${pattern.weekday}`;
  }
  return `${summary} through ${rule.until}`;
}

/** Generates up to `count` upcoming occurrence dates from draft schedule fields. */
export function previewOccurrencesFromDraft(
  fields: Record<string, unknown>,
  count = 3,
): Array<{ start: string; end: string; status: string }> {
  const recurrence = parseJson(fields.recurrence);
  if (!validRecurrence(recurrence)) {
    return [];
  }

  const allDay = Boolean(fields.all_day);
  const timezone = String(fields.timezone || "Europe/Zurich");
  const start = allDay
    ? String(fields.start_date || "")
    : String(fields.start || "");
  const end = allDay
    ? String(fields.end_date || start)
    : String(fields.end || start);

  if (!start) return [];

  const syntheticEvent: EventRecord = {
    id: "draft-preview",
    title: String(fields.title || "Preview"),
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
    recurrence,
    exceptions: Array.isArray(fields.exceptions)
      ? (fields.exceptions as any)
      : undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const today = new Date().toISOString().slice(0, 10);
  const searchStart = isDateOnly(start) ? start : start.slice(0, 10);
  const from = searchStart < today ? searchStart : today;
  // Look ahead up to 1 year (bounded to MAX_EXPANSION_RANGE_DAYS)
  const through = new Date(Date.now() + 180 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  try {
    const occurrences = expandRecurringEvent(syntheticEvent, from, through);
    return occurrences.slice(0, count).map((occ) => ({
      start: occ.allDay ? occ.start : occ.start.replace("T", " "),
      end: occ.allDay ? occ.end : occ.end.replace("T", " "),
      status: occ.status || "scheduled",
    }));
  } catch {
    return [];
  }
}

/** Creates a clean duplicate of a native event with stripped IDs and reset schedule history. */
export function prepareNativeDuplicate(
  item: Record<string, unknown>,
): Record<string, unknown> {
  const editable = new Set([
    "title",
    "description",
    "excerpt",
    "featured_image",
    "image_url",
    "start",
    "end",
    "start_date",
    "end_date",
    "all_day",
    "timezone",
    "location_type",
    "venue",
    "venue_id",
    "location",
    "virtual_url",
    "external_url",
    "organizer",
    "organizer_ref",
    "organizer_id",
    "organizer_details",
    "categories",
    "recurrence",
  ]);
  const copy = structuredClone(
    Object.fromEntries(
      Object.entries(item).filter(([key]) => editable.has(key)),
    ),
  );
  // The allowlist excludes identity, publication, history and date-specific changes.
  copy.event_status = "published";
  return copy;
}
