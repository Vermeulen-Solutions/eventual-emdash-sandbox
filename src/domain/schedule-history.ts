import type { EventRecord } from './event';

export function withScheduleHistory(previous: EventRecord | null, next: EventRecord): EventRecord {
  if (!previous) return next;
  const changed = previous.start !== next.start || previous.end !== next.end || previous.allDay !== next.allDay || previous.timezone !== next.timezone;
  const history = changed ? [
    { start: previous.start, end: previous.end, allDay: previous.allDay, timezone: previous.timezone, changedAt: next.updatedAt },
    ...(previous.scheduleHistory ?? []),
  ].slice(0, 10) : previous.scheduleHistory;
  return { ...next, ...(history ? { scheduleHistory: history } : {}), ...(changed ? { previousStartDate: previous.start } : previous.previousStartDate ? { previousStartDate: previous.previousStartDate } : {}) };
}
