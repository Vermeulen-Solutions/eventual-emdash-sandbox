import type { EventRecord } from './event';

export function withScheduleHistory(previous: EventRecord | null, next: EventRecord): EventRecord {
  if (!previous) return { ...next, calendarSequence: next.calendarSequence ?? Math.floor(Date.now()/1000) };
  const sequence = Math.max(previous.calendarSequence ?? (Math.floor(Date.parse(previous.updatedAt)/1000) || 0), next.calendarSequence ?? 0) + 1;
  if(sequence > 2147483647) throw new Error('Calendar sequence exhausted.');
  const changed = previous.start !== next.start || previous.end !== next.end || previous.allDay !== next.allDay || previous.timezone !== next.timezone;
  const history = changed ? [
    { start: previous.start, end: previous.end, allDay: previous.allDay, timezone: previous.timezone, changedAt: next.updatedAt },
    ...(previous.scheduleHistory ?? []),
  ].slice(0, 10) : previous.scheduleHistory;
  return { ...next, calendarSequence: sequence, ...(history ? { scheduleHistory: history } : {}), ...(changed ? { previousStartDate: previous.start } : previous.previousStartDate ? { previousStartDate: previous.previousStartDate } : {}) };
}
