import {
  isDateOnly,
  isValidTimeZone,
  normalizeEventDates,
  instantToLocalDateTime,
} from "./date-time";
import { validRecurrence } from "./recurrence-rule";
import { exceptionIdsMatchRecurrence, scheduledOccurrence } from "./recurrence";
import type { EventRecord } from "./event";
import { safeWebUrl } from "../../astro/event-details";

function validInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return false;
  const clock = value.slice(11, 19).split(":");
  return (
    isDateOnly(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value)) &&
    Number(clock[0]) <= 23 &&
    Number(clock[1]) <= 59 &&
    (!clock[2] || Number(clock[2]) <= 59)
  );
}

export function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value ?? undefined;
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON.");
  }
}
export const scheduleKeys = [
  "start",
  "end",
  "start_date",
  "end_date",
  "all_day",
  "timezone",
  "recurrence",
  "exceptions",
  "occurrence_content",
  "venue",
  "location_type",
  "event_status",
  "calendar_uid",
  "legacy_id",
  "categories",
  "virtual_url",
  "external_url",
  "image_url",
  "organizer_details",
  "previous_start_date",
  "schedule_history",
];
export function normalizeNativeSchedule(
  data: Record<string, unknown>,
  options: { allowStaleOccurrenceCopy?: boolean } = {},
): Record<string, unknown> {
  const result = { ...data };
  const rawAllDay = data.all_day ?? data.allDay ?? false;
  const allDay = rawAllDay === 0 ? false : rawAllDay === 1 ? true : rawAllDay;
  if (typeof allDay !== "boolean")
    throw new Error("all_day must be a boolean.");
  const timezone = data.timezone ?? "Europe/Zurich";
  if (typeof timezone !== "string" || !isValidTimeZone(timezone))
    throw new Error("Invalid IANA timezone.");
  const rawStart = allDay ? (data.start_date ?? data.start) : data.start;
  const rawEnd = allDay ? (data.end_date ?? data.end) : data.end;
  if (
    typeof rawStart !== "string" ||
    typeof rawEnd !== "string" ||
    !rawStart ||
    !rawEnd
  )
    throw new Error("Start and end are required.");
  let start = rawStart;
  let end = rawEnd;
  if (allDay) {
    if (
      (data.start_date != null && !isDateOnly(start)) ||
      (data.end_date != null && !isDateOnly(end))
    )
      throw new Error("All-day date fields must use YYYY-MM-DD.");
    // Compatibility with ISO all-day records; new editing uses explicit civil-date fields.
    if (
      [start, end].some((value) => !isDateOnly(value) && !validInstant(value))
    )
      throw new Error("Invalid all-day date representation.");
    start = start.slice(0, 10);
    end = end.slice(0, 10);
    if (!isDateOnly(start) || !isDateOnly(end) || end < start)
      throw new Error("Invalid inclusive all-day dates.");
    result.start_date = start;
    result.end_date = end;
    delete result.start;
    delete result.end;
  } else {
    const instant = (s: string) => {
      if (!validInstant(s)) return undefined;
      return new Date(s).toISOString();
    };
    const first = instant(start);
    const last = instant(end);
    if (first && last) {
      start = first;
      end = last;
    } else {
      const normalized = normalizeEventDates({
        start,
        end,
        allDay: false,
        timezone,
      });
      if (!normalized.dates)
        throw new Error("Invalid local datetime or timezone.");
      ({ start, end } = normalized.dates);
    }
    if (Date.parse(end) < Date.parse(start))
      throw new Error("End must be at or after start.");
    result.start = start;
    result.end = end;
    delete result.start_date;
    delete result.end_date;
  }
  const recurrence = parseJson(data.recurrence);
  if (
    recurrence !== undefined &&
    recurrence !== null &&
    !validRecurrence(recurrence)
  )
    throw new Error("Invalid recurrence rule.");
  if (recurrence && validRecurrence(recurrence)) {
    const firstDate = allDay
      ? start
      : instantToLocalDateTime(start, timezone)?.slice(0, 10);
    if (!firstDate || recurrence.until < firstDate)
      throw new Error("Recurrence until precedes start.");
    if (
      !allDay &&
      (new Date(start).getUTCSeconds() || new Date(start).getUTCMilliseconds())
    )
      throw new Error("Recurring starts require minute precision.");
  }
  const exceptions = parseJson(data.exceptions) ?? [];
  if (!Array.isArray(exceptions) || exceptions.length > 366)
    throw new Error("Exceptions must be an array of at most 366 items.");
  const allowed = new Set([
    "start",
    "end",
    "allDay",
    "timezone",
    "locationType",
    "virtualUrl",
    "status",
    "externalUrl",
    "imageUrl",
    "imageMediaId",
    "categories",
  ]);
  const record = {
    id: "validation",
    start,
    end,
    allDay,
    timezone,
    recurrence,
    exceptions,
    published: true,
  } as EventRecord;
  for (const ex of exceptions) {
    if (
      !ex ||
      typeof ex !== "object" ||
      typeof ex.recurrenceId !== "string" ||
      !["cancelled", "modified"].includes(ex.status)
    )
      throw new Error("Invalid exception.");
    if (ex.status === "modified") {
      if (
        !ex.overrides ||
        typeof ex.overrides !== "object" ||
        Array.isArray(ex.overrides) ||
        !Object.keys(ex.overrides).length
      )
        throw new Error("Modified exceptions require overrides.");
      if (Object.keys(ex.overrides).some((k) => !allowed.has(k)))
        throw new Error(
          "Editorial exception overrides belong in occurrence_content.",
        );
      const original = scheduledOccurrence(record, ex.recurrenceId);
      if (!original)
        throw new Error("Exception is not a scheduled occurrence.");
      const effective = { ...original, ...ex.overrides };
      if (
        typeof effective.allDay !== "boolean" ||
        !isValidTimeZone(effective.timezone)
      )
        throw new Error("Invalid exception timezone or allDay.");
      if (
        effective.allDay
          ? !isDateOnly(effective.start) ||
            !isDateOnly(effective.end) ||
            effective.end < effective.start
          : !Number.isFinite(Date.parse(effective.start)) ||
            !Number.isFinite(Date.parse(effective.end)) ||
            Date.parse(effective.end) < Date.parse(effective.start)
      )
        throw new Error("Invalid exception schedule.");
      if (
        !effective.allDay &&
        [effective.start, effective.end].some((value) => !validInstant(value))
      )
        throw new Error("Timed exceptions require ISO instants.");
      for (const key of [
        "locationType",
        "virtualUrl",
        "status",
        "externalUrl",
        "imageUrl",
        "imageMediaId",
      ])
        if (key in ex.overrides && typeof ex.overrides[key] !== "string")
          throw new Error("Exception field must be text: " + key);
      if (
        ex.overrides.locationType !== undefined &&
        !["physical", "virtual", "hybrid"].includes(ex.overrides.locationType)
      )
        throw new Error("Invalid exception location type.");
      if (
        ex.overrides.status !== undefined &&
        !["published", "cancelled", "postponed", "rescheduled"].includes(
          ex.overrides.status,
        )
      )
        throw new Error("Invalid exception status.");
      for (const key of ["virtualUrl", "externalUrl", "imageUrl"])
        if (ex.overrides[key] && !safeWebUrl(ex.overrides[key]))
          throw new Error("Exception URLs must use HTTP(S).");
      if (
        ex.overrides.categories !== undefined &&
        (!Array.isArray(ex.overrides.categories) ||
          ex.overrides.categories.some(
            (value: unknown) => typeof value !== "string",
          ))
      )
        throw new Error("Exception categories must be an array of strings.");
    }
  }
  if (
    exceptions.length &&
    (!recurrence || !exceptionIdsMatchRecurrence(record))
  )
    throw new Error("Duplicate or invalid exception recurrence IDs.");
  const editorial = parseJson(data.occurrence_content) ?? [];
  if (
    !Array.isArray(editorial) ||
    editorial.length > 366 ||
    editorial.some(
      (ex) =>
        !ex ||
        typeof ex.recurrenceId !== "string" ||
        !ex.overrides ||
        Object.keys(ex.overrides).some(
          (k) => !["title", "description", "location", "organizer"].includes(k),
        ),
    )
  )
    throw new Error("Invalid occurrence_content.");
  if (
    new Set(editorial.map((ex) => ex.recurrenceId)).size !== editorial.length ||
    (!options.allowStaleOccurrenceCopy &&
      editorial.some(
        (ex) => !recurrence || !scheduledOccurrence(record, ex.recurrenceId),
      ))
  )
    throw new Error("Invalid editorial recurrence IDs.");
  for (const copy of editorial)
    for (const [key, value] of Object.entries(copy.overrides)) {
      if (
        key === "description"
          ? typeof value !== "string" && !Array.isArray(value)
          : typeof value !== "string"
      )
        throw new Error("Invalid occurrence copy field: " + key);
    }
  if (
    data.location_type != null &&
    !["physical", "virtual", "hybrid"].includes(String(data.location_type))
  )
    throw new Error("Invalid location type.");
  if (
    data.event_status != null &&
    !["published", "cancelled", "postponed", "rescheduled"].includes(
      String(data.event_status),
    )
  )
    throw new Error("Invalid event status.");
  for (const key of ["virtual_url", "external_url", "image_url"])
    if (
      data[key] &&
      (typeof data[key] !== "string" || !safeWebUrl(data[key] as string))
    )
      throw new Error("Public URLs must use HTTP(S): " + key);
  const organizer = parseJson(data.organizer_details);
  if (
    organizer != null &&
    (typeof organizer !== "object" ||
      Array.isArray(organizer) ||
      ["id", "name", "website", "contactUrl"].some(
        (key) =>
          typeof (organizer as Record<string, unknown>)[key] !== "string",
      ) ||
      ["website", "contactUrl"].some((key) => {
        const value = (organizer as Record<string, string>)[key];
        return value && !safeWebUrl(value);
      }))
  )
    throw new Error("Invalid organizer details.");
  if (
    data.previous_start_date &&
    !isDateOnly(data.previous_start_date as string) &&
    !validInstant(data.previous_start_date)
  )
    throw new Error("Invalid previous start date.");
  const history = parseJson(data.schedule_history);
  if (
    history != null &&
    (!Array.isArray(history) ||
      history.length > 10 ||
      history.some(
        (item) =>
          !item ||
          !validInstant(item.changedAt) ||
          !isValidTimeZone(item.timezone) ||
          typeof item.allDay !== "boolean" ||
          (item.allDay
            ? !isDateOnly(item.start) ||
              !isDateOnly(item.end) ||
              item.end < item.start
            : !validInstant(item.start) ||
              !validInstant(item.end) ||
              Date.parse(item.end) < Date.parse(item.start)),
      ))
  )
    throw new Error("Invalid schedule history.");
  result.all_day = allDay;
  result.timezone = timezone;
  const categories = parseJson(data.categories);
  if (
    categories != null &&
    (!Array.isArray(categories) ||
      categories.some((value) => typeof value !== "string"))
  )
    throw new Error("Categories must be an array of strings.");
  if (
    data.calendar_uid != null &&
    (typeof data.calendar_uid !== "string" ||
      !/^[A-Za-z0-9.!~*'()%_-]+@[A-Za-z0-9.-]+$/.test(data.calendar_uid))
  )
    throw new Error("Invalid calendar UID.");
  return result;
}
