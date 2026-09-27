import type { BlockResponse } from "@emdash-cms/blocks";
import { instantToLocalDateTime, isDateOnly } from "./domain/date-time";
import type { EventRecord } from "./domain/event";
import { inspectOccurrences, validOccurrenceRange } from "./domain/occurrences";
import { addDays } from "./domain/recurrence";

export interface OccurrenceWindow { from: string; offset: number }

export function defaultOccurrenceWindow(event: EventRecord): OccurrenceWindow {
  return { from: instantToLocalDateTime(new Date().toISOString(), event.timezone).slice(0, 10), offset: 0 };
}

export function occurrenceWindowValue(value: unknown): (OccurrenceWindow & { eventId: string }) | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed.eventId === "string" && typeof parsed.from === "string" && isDateOnly(parsed.from) && validOccurrenceRange(parsed.from, addDays(parsed.from, 89)) &&
      Number.isInteger(parsed.offset) && parsed.offset >= 0 && parsed.offset <= 1000
      ? { eventId: parsed.eventId, from: parsed.from, offset: parsed.offset } : null;
  } catch { return null; }
}

export function occurrenceBlocks(event: EventRecord, window?: OccurrenceWindow): BlockResponse["blocks"] {
  const from = window?.from ?? defaultOccurrenceWindow(event).from;
  const offset = window?.offset ?? 0;
  const through = addDays(from, 89);
  const result = inspectOccurrences(event, from, through, 10, offset);
  const blocks: BlockResponse["blocks"] = [
    { type: "header", text: "Upcoming occurrences" },
    { type: "context", text: `Saved schedule from ${from} through ${through}. Original times use ${event.timezone}. Unsaved event edits are not reflected here.` },
    { type: "form", block_id: `occurrence-window:${event.id}`, fields: [
      { type: "date_input", action_id: "from", label: "Show occurrences from", initial_value: from },
    ], submit: { label: "Show dates", action_id: "show-occurrences" } },
  ];
  if (!result.occurrences.length) blocks.push({ type: "context", text: "No occurrences in this window. Choose another start date or add an exception manually below." });
  for (const row of result.occurrences) {
    const value = JSON.stringify({ eventId: event.id, recurrenceId: row.recurrenceId, from, offset });
    const changedSchedule = row.localStart !== row.scheduledLocalStart || row.timezone !== row.scheduledTimezone;
    const state = row.status === "cancelled" ? "Cancelled" : row.status === "modified" ? "Changed" : "Scheduled";
    const when = row.allDay ? `${row.localStart} through ${row.localEnd} (all day, inclusive)`
      : `${row.localStart.replace("T", " ")} – ${row.localEnd.replace("T", " ")} (${row.timezone})`;
    blocks.push({ type: "section", text: `${when} · ${state}${changedSchedule ? `\nOriginally ${row.scheduledLocalStart.replace("T", " ")} (${row.scheduledTimezone})` : ""}` });
    blocks.push({ type: "actions", elements: [
      { type: "button", label: "Change", action_id: "change-occurrence", value },
      ...(row.status !== "cancelled" ? [{
        type: "button" as const, label: "Cancel", action_id: "cancel-occurrence", value, style: "danger" as const,
        confirm: { title: "Cancel this occurrence?", text: "Only this date will be cancelled. Calendar subscribers receive a cancellation for published occurrences.", confirm: "Cancel occurrence", deny: "Keep occurrence", style: "danger" as const },
      }] : []),
      ...(row.status !== "scheduled" ? [{
        type: "button" as const, label: "Restore", action_id: "remove-exception", value,
        confirm: { title: "Restore the original occurrence?", text: "Remove this date's exception and use the series schedule and details again.", confirm: "Restore", deny: "Keep exception" },
      }] : []),
    ] });
  }
  if (result.occurrences.length) blocks.push({ type: "context", text: `Showing ${offset + 1}–${offset + result.occurrences.length} of ${result.total} occurrences.` });
  const page = (label: string, start: string, skip: number) => ({
    type: "button" as const, label, action_id: "occurrences-page", value: JSON.stringify({ eventId: event.id, from: start, offset: skip }),
  });
  blocks.push({ type: "actions", elements: [
    ...(offset > 0 ? [page("Previous dates", from, Math.max(0, offset - 10))] : []),
    ...(result.truncated ? [page("More dates", from, offset + 10)] : []),
    page("Previous 90 days", addDays(from, -90), 0), page("Next 90 days", addDays(from, 90), 0),
  ] });
  return blocks;
}
