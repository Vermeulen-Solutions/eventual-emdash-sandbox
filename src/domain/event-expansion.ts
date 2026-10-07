import { expandEventsInDateRange, scheduledOccurrence } from "./recurrence";
import type { EventRecord, EventException } from "./event";
import { portableTextToPlainText } from "./portable-text";
import {
  normalizeVenueRecord,
  localizedVenue,
  type NormalizedVenue,
} from "./venue-adapter";
import { normalizeNativeSchedule, parseJson } from "./native-validation";
import { formatPublicEvent } from "../public-event";
import { categoryKey, readCategories } from "./category";
import type { PublicEvent } from "../../astro/feed";

export interface ExpandOccurrencesOptions {
  from: string;
  through: string;
  category?: string;
  venues?: unknown[] | Map<string, unknown>;
  siteUrl?: string;
}
const text = (value: unknown) => (typeof value === "string" ? value : "");
const timestamp = (value: unknown) =>
  value instanceof Date ? value.toISOString() : text(value);
export function nativeEntryToEventRecord(entry: unknown): EventRecord | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const outer = entry as Record<string, unknown>;
  const nested =
    !!outer.data &&
    typeof outer.data === "object" &&
    !Array.isArray(outer.data);
  const data = (nested ? outer.data : outer) as Record<string, unknown>;
  // LiveCollection entry IDs are slugs; the loader keeps the CMS ID in data.id.
  const id = text(nested && outer.type ? outer.id : (data.id ?? outer.id));
  if (!id) return null;
  try {
    const parsedExceptions = (parseJson(data.exceptions) ??
      []) as EventException[];
    if (!Array.isArray(parsedExceptions)) return null;
    const native =
      Object.hasOwn(data, "all_day") ||
      (nested &&
        (typeof outer.type === "string" || !Object.hasOwn(data, "published")));
    const sharedExceptions = native
      ? parsedExceptions
      : parsedExceptions
          .map((ex) => ({
            ...ex,
            overrides: ex.overrides
              ? Object.fromEntries(
                  Object.entries(ex.overrides).filter(
                    ([key]) =>
                      ![
                        "title",
                        "description",
                        "location",
                        "organizer",
                        "locale",
                      ].includes(key),
                  ),
                )
              : undefined,
          }))
          .filter(
            (ex) =>
              ex.status === "cancelled" ||
              Object.keys(ex.overrides ?? {}).length,
          );
    const normalized = normalizeNativeSchedule(
      {
        ...data,
        all_day: data.all_day ?? data.allDay,
        exceptions: sharedExceptions,
      },
      { allowStaleOccurrenceCopy: true },
    );
    const allDay = normalized.all_day as boolean;
    const start = text(allDay ? normalized.start_date : normalized.start);
    const end = text(allDay ? normalized.end_date : normalized.end);
    const recurrence = parseJson(data.recurrence) as EventRecord["recurrence"];
    const exceptions = parsedExceptions.map((ex) => ({
      ...ex,
      overrides: ex.overrides ? { ...ex.overrides } : undefined,
    }));
    const editorial = (parseJson(data.occurrence_content) ?? []) as Array<{
      recurrenceId: string;
      overrides: Record<string, unknown>;
    }>;
    for (const copy of editorial) {
      if (
        !recurrence ||
        !scheduledOccurrence(
          {
            id,
            start,
            end,
            allDay,
            timezone: text(normalized.timezone),
            recurrence,
          } as EventRecord,
          copy.recurrenceId,
        )
      )
        continue;
      const existing = exceptions.find(
        (item) => item.recurrenceId === copy.recurrenceId,
      );
      if (existing?.status === "cancelled") continue;
      if (existing)
        existing.overrides = { ...existing.overrides, ...copy.overrides };
      else
        exceptions.push({
          recurrenceId: copy.recurrenceId,
          status: "modified",
          overrides: copy.overrides,
        });
    }
    const coreStatus = native
      ? nested && typeof outer.status === "string"
        ? outer.status
        : data.status
      : undefined;
    const published = coreStatus
      ? coreStatus === "published"
      : data.published === true;
    const status = (data.event_status ??
      (["cancelled", "postponed", "rescheduled"].includes(text(data.status))
        ? data.status
        : published
          ? "published"
          : "draft")) as EventRecord["status"];
    const image = data.featured_image as Record<string, unknown> | undefined;
    const venue = Object.hasOwn(data, "venue_id")
      ? data.venue_id
      : (data.venue ?? data.venueId);
    const reference =
      typeof venue === "string"
        ? venue
        : venue && typeof venue === "object"
          ? text((venue as Record<string, unknown>).id)
          : "";
    const categories = readCategories(data.categories);
    return {
      id,
      title: text(data.title).trim(),
      description:
        typeof data.description === "string"
          ? data.description
          : JSON.stringify(data.description ?? []),
      descriptionBlocks: Array.isArray(data.description)
        ? data.description
        : undefined,
      start,
      end,
      allDay,
      timezone: text(normalized.timezone),
      published,
      status,
      recurrence,
      exceptions,
      location: text(data.location),
      locationType: (data.location_type ??
        data.locationType ??
        "physical") as EventRecord["locationType"],
      virtualUrl: text(data.virtual_url ?? data.virtualUrl),
      externalUrl: text(data.external_url ?? data.externalUrl),
      organizer: text(data.organizer),
      organizerId: text(
        Object.hasOwn(data, "organizer_id")
          ? data.organizer_id
          : typeof data.organizer_ref === "object"
            ? (data.organizer_ref as Record<string, unknown> | null)?.id
            : (data.organizer_ref ?? data.organizerId),
      ),
      organizerDetails: parseJson(
        data.organizer_details,
      ) as EventRecord["organizerDetails"],
      venueId: reference,
      imageUrl: text(
        image?.src ?? image?.url ?? data.image_url ?? data.imageUrl,
      ),
      imageMediaId: text(image?.id ?? data.imageMediaId),
      categories,
      createdAt:
        timestamp(outer.createdAt ?? data.created_at ?? data.createdAt) ||
        "1970-01-01T00:00:00.000Z",
      updatedAt:
        timestamp(outer.updatedAt ?? data.updated_at ?? data.updatedAt) ||
        "1970-01-01T00:00:00.000Z",
      locale: text(outer.locale ?? data.locale) || undefined,
      translationGroup:
        text(
          outer.translationGroup ??
            data.translation_group ??
            data.translationGroup ??
            outer.translation_group,
        ) || undefined,
      calendarUid: text(data.calendar_uid ?? data.calendarUid) || undefined,
      calendarSequence:
        typeof data.calendarSequence === "number"
          ? data.calendarSequence
          : undefined,
      previousStartDate:
        text(data.previous_start_date ?? data.previousStartDate) || undefined,
      scheduleHistory: parseJson(
        data.schedule_history ?? data.scheduleHistory,
      ) as EventRecord["scheduleHistory"],
      slug: text(outer.slug ?? data.slug) || undefined,
      publicUrl:
        text(outer.publicUrl ?? outer.url ?? data.publicUrl ?? data.url) ||
        undefined,
    };
  } catch {
    return null;
  }
}
export function eventRecordToPublicEvent(
  record: EventRecord,
  venueMap?: Map<string, NormalizedVenue>,
  siteUrl?: string,
): PublicEvent {
  const venue = localizedVenue(venueMap, record);
  const normalized = venue
    ? {
        ...venue,
        street: venue.street ?? "",
        street2: venue.street2 ?? "",
        locality: venue.locality ?? "",
        region: venue.region ?? "",
        postalCode: venue.postalCode ?? "",
        country: venue.country ?? "",
        createdAt: "",
        updatedAt: "",
      }
    : undefined;
  let imageUrl = record.imageUrl;
  if (siteUrl && imageUrl) {
    try {
      imageUrl = new URL(imageUrl, siteUrl).href;
    } catch {
      imageUrl = "";
    }
  }
  return {
    ...formatPublicEvent(record, normalized),
    description: portableTextToPlainText(record.description),
    ...(record.descriptionBlocks
      ? { descriptionBlocks: record.descriptionBlocks }
      : {}),
    imageUrl,
    organizerDetails: record.organizerDetails,
    previousStartDate: record.previousStartDate,
    locale: record.locale,
    translationGroup: record.translationGroup,
    slug: record.slug,
    publicUrl: record.publicUrl,
  };
}
export function expandEventOccurrences(
  entries: unknown[],
  options: ExpandOccurrencesOptions,
): PublicEvent[] {
  if (!Array.isArray(entries) || !options?.from || !options.through) return [];
  const records = entries
    .map(nativeEntryToEventRecord)
    .filter((record): record is EventRecord => !!record && record.published);
  const venues = new Map<string, NormalizedVenue>();
  if (options.venues instanceof Map) {
    for (const [key, value] of options.venues) {
      const venue = normalizeVenueRecord(value);
      if (venue) venues.set(key, venue);
    }
  } else if (Array.isArray(options.venues)) {
    for (const value of options.venues) {
      const venue = normalizeVenueRecord(value);
      if (venue) venues.set(venue.id, venue);
    }
  }
  const expanded = expandEventsInDateRange(
    records,
    options.from,
    options.through,
  );
  if (expanded.length > 10000)
    throw new Error("Too many expanded occurrences; narrow the date range.");
  const category = options.category ? categoryKey(options.category) : "";
  const visible = category
    ? expanded.filter((record) =>
        record.categories.some((value) => categoryKey(value) === category),
      )
    : expanded;
  return visible.map((record) =>
    eventRecordToPublicEvent(record, venues, options.siteUrl),
  );
}
