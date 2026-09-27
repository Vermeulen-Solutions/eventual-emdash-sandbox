import { isDateOnly } from "./date-time";
import type { EventRecurrence, WeekdayName } from "./event";

export const WEEKDAYS: WeekdayName[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function validRecurrence(value: unknown): value is EventRecurrence {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  if (typeof rule.until !== "string" || !isDateOnly(rule.until)) return false;
  if (rule.interval !== undefined && (typeof rule.interval !== "number" || !Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 52)) return false;
  if (rule.frequency === "daily") return rule.weekdays === undefined;
  if (rule.frequency === "weekly") return rule.weekdays === undefined || Array.isArray(rule.weekdays) &&
    rule.weekdays.length >= 1 && rule.weekdays.length <= 7 && new Set(rule.weekdays).size === rule.weekdays.length &&
    rule.weekdays.every((day) => WEEKDAYS.includes(day));
  if (rule.frequency !== "monthly" || !rule.pattern || typeof rule.pattern !== "object") return false;
  const pattern = rule.pattern as Record<string, unknown>;
  if (pattern.type === "dayOfMonth") return Number.isInteger(pattern.dayOfMonth) && Number(pattern.dayOfMonth) >= 1 && Number(pattern.dayOfMonth) <= 31 && (pattern.missingDayBehavior === "skip" || pattern.missingDayBehavior === "lastDay");
  return pattern.type === "weekdayOfMonth" && WEEKDAYS.includes(pattern.weekday as WeekdayName) &&
    (pattern.position === "last" || Number.isInteger(pattern.position) && Number(pattern.position) >= 1 && Number(pattern.position) <= 5);
}

export function recurrenceSummary(rule: EventRecurrence): string {
  const interval = rule.interval ?? 1;
  if (rule.frequency === "weekly" && rule.weekdays) {
    return `every ${interval === 1 ? "week" : `${interval} weeks`} on ${rule.weekdays.map((day) => day[0]!.toUpperCase() + day.slice(1)).join(", ")}`;
  }
  if (interval === 1) return rule.frequency;
  const unit = rule.frequency === "daily" ? "days" : rule.frequency === "weekly" ? "weeks" : "months";
  return `every ${interval} ${unit}`;
}

export function normalizeWeekdays(days: WeekdayName[]): WeekdayName[] {
  return [...days].sort((a, b) => (WEEKDAYS.indexOf(a) + 6) % 7 - (WEEKDAYS.indexOf(b) + 6) % 7);
}
