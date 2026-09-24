import { instantToLocalDateTime, isDateOnly, normalizeEventDates } from "./date-time";
import { normalizeCategories } from "./category";
import type {
  EventDraft,
  EventFields,
  EventRecurrence,
  EventRecord,
  MonthlyPosition,
  WeekdayName,
} from "./event";
import { safeHttpUrl } from "./venue";

const WEEKDAYS: WeekdayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function dateParts(value: string): [number, number, number] {
  return value.slice(0, 10).split("-").map(Number) as [number, number, number];
}

export function weekdayForDate(value: string): WeekdayName {
  const [year, month, day] = dateParts(value);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]!;
}

export function monthlyPositionForDate(value: string): MonthlyPosition {
	const [, , day] = dateParts(value);
	return Math.ceil(day / 7) as MonthlyPosition;
}

function isLastWeekdayOfMonth(value: string): boolean {
	const [year, month, day] = dateParts(value);
	const date = new Date(Date.UTC(year, month - 1, day + 7));
	return date.getUTCMonth() !== month - 1 || date.getUTCFullYear() !== year;
}

export function recurrenceForDraft(draft: EventDraft): EventRecurrence | undefined {
  if (draft.repeatFrequency === "none") return undefined;
  if (draft.repeatFrequency === "daily" || draft.repeatFrequency === "weekly") {
    return { frequency: draft.repeatFrequency, until: draft.recurrenceUntil };
  }
  return {
    frequency: "monthly",
    until: draft.recurrenceUntil,
    pattern:
      draft.monthlyPattern === "dayOfMonth"
        ? {
            type: "dayOfMonth",
            dayOfMonth: Number(draft.start.slice(8, 10)),
            missingDayBehavior: draft.missingDayBehavior,
          }
        : {
            type: "weekdayOfMonth",
            weekday: draft.monthlyWeekday,
            position: draft.monthlyPosition,
          },
  };
}

export function prepareEventData(
  draft: EventDraft,
): { data?: EventFields & { recurrence?: EventRecurrence; exceptions: EventRecord["exceptions"] }; error?: string } {
  const title = draft.title.trim();
  if (!title) return { error: "Event title is required." };
  if (draft.externalUrl.trim() && !safeHttpUrl(draft.externalUrl)) {
    return { error: "External URL must use HTTP or HTTPS." };
  }
  if (draft.imageUrl.trim() && !safeHttpUrl(draft.imageUrl)) {
    return { error: "Image URL must use HTTP or HTTPS." };
  }
  const normalized = normalizeEventDates({
    start: draft.start,
    end: draft.end,
    allDay: draft.allDay,
    timezone: draft.timezone,
  });
  if (!normalized.dates) {
    return { error: normalized.errors.start ?? normalized.errors.end ?? normalized.errors.timezone ?? "Check the event dates." };
  }

  const startDate = draft.start.slice(0, 10);
  const recurrence = recurrenceForDraft(draft);
  if (recurrence && (!isDateOnly(recurrence.until) || recurrence.until < startDate)) {
    return { error: "Choose a recurrence end date on or after the first event." };
  }
  if (
    recurrence?.frequency === "monthly" &&
    recurrence.pattern.type === "weekdayOfMonth" &&
    (weekdayForDate(startDate) !== recurrence.pattern.weekday ||
      (recurrence.pattern.position === "last"
			? !isLastWeekdayOfMonth(startDate)
			: monthlyPositionForDate(startDate) !== recurrence.pattern.position))
  ) {
    return { error: "The first event must match the selected monthly weekday pattern." };
  }

  const categories = normalizeCategories(draft.categories);
  return {
    data: {
      title,
      description: draft.description.trim(),
      ...normalized.dates,
      allDay: draft.allDay,
      timezone: draft.timezone.trim(),
      location: draft.location.trim(),
      organizer: draft.organizer.trim(),
      externalUrl: safeHttpUrl(draft.externalUrl),
      imageUrl: draft.imageMediaId.trim() ? "" : safeHttpUrl(draft.imageUrl),
      ...(draft.imageMediaId.trim() ? { imageMediaId: draft.imageMediaId.trim() } : {}),
      categories,
      ...(draft.venueId ? { venueId: draft.venueId } : {}),
      published: draft.published,
      ...(recurrence ? { recurrence } : {}),
      exceptions: draft.exceptions,
    },
  };
}

export function eventToDraft(event: EventRecord): EventDraft {
  const timezone = event.timezone || "UTC";
  const start = event.allDay
    ? event.start.slice(0, 10)
    : instantToLocalDateTime(event.start, timezone);
  const end = event.allDay
    ? event.end.slice(0, 10)
    : instantToLocalDateTime(event.end, timezone);
  const recurrence = event.recurrence;
  return {
    title: event.title,
    description: event.description,
    start,
    end,
    allDay: event.allDay,
    timezone,
    location: event.location,
    organizer: event.organizer,
    externalUrl: event.externalUrl,
    imageUrl: event.imageUrl,
    imageMediaId: event.imageMediaId ?? "",
    categories: event.categories.join(", "),
    venueId: event.venueId ?? "",
    published: event.published,
    repeatFrequency: recurrence?.frequency ?? "none",
    recurrenceUntil: recurrence?.until ?? "",
    monthlyPattern:
      recurrence?.frequency === "monthly" ? recurrence.pattern.type : "dayOfMonth",
    missingDayBehavior:
      recurrence?.frequency === "monthly" && recurrence.pattern.type === "dayOfMonth"
        ? recurrence.pattern.missingDayBehavior
        : "skip",
    monthlyWeekday:
      recurrence?.frequency === "monthly" && recurrence.pattern.type === "weekdayOfMonth"
        ? recurrence.pattern.weekday
        : weekdayForDate(start),
    monthlyPosition:
      recurrence?.frequency === "monthly" && recurrence.pattern.type === "weekdayOfMonth"
        ? recurrence.pattern.position
        : start
          ? monthlyPositionForDate(start)
          : 1,
    exceptions: event.exceptions ?? [],
  };
}

export function duplicateEventDraft(event: EventRecord): EventDraft {
	return {
		...eventToDraft(event),
		title: `Copy of ${event.title}`,
		published: false,
		exceptions: [],
	};
}
