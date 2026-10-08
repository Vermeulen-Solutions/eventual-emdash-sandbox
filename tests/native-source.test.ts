import { describe, it, expect, vi } from "vitest";
import {
  listNative,
  readEventSource,
  selectEventLocales,
  nativeSchema,
  resolveEventVenues,
  hydrateNativeAssets,
} from "../src/domain/native-source";
import { nativeEntryToEventRecord } from "../src/domain/event-expansion";
import { expandRecurringEvent } from "../src/domain/recurrence";
import { createEventsCollectionBlueprint } from "../src/schema/blueprint";
import type { EventualContext } from "../src/storage";

describe("Native pagination and source authority", () => {
  it("keeps fallback language prefixes on localized occurrence titles and never mutates stored copy", () => {
    const event = nativeEntryToEventRecord({
      id: "series",
      locale: "fr",
      status: "published",
      data: {
        title: "Série",
        start: "2026-11-15T10:00:00Z",
        end: "2026-11-15T11:00:00Z",
        all_day: false,
        timezone: "UTC",
        recurrence: { frequency: "daily", until: "2026-11-17" },
        occurrence_content: [
          {
            recurrenceId: "2026-11-16T10:00",
            overrides: { title: "Date spéciale" },
          },
        ],
      },
    })!;
    const fallback = selectEventLocales([event], "en")[0]!;
    const occurrences = expandRecurringEvent(
      fallback,
      "2026-11-15",
      "2026-11-17",
    );
    expect(occurrences.map((item) => item.title)).toEqual([
      "[FR] Série",
      "[FR] Date spéciale",
      "[FR] Série",
    ]);
    expect(event.exceptions[0]!.overrides!.title).toBe("Date spéciale");
    expect(selectEventLocales([event], "en", true)).toEqual([]);
  });
  it("reads beyond the first 100 published native entries", async () => {
    const rows = Array.from({ length: 130 }, (_, index) => ({
      id: String(index),
      type: "events",
      status: "published",
      locale: "fr",
      data: {
        title: "Event " + index,
        start: "2026-11-15T10:00:00Z",
        end: "2026-11-15T11:00:00Z",
        all_day: 0,
        timezone: "UTC",
      },
    }));
    const list = vi.fn(
      async (
        _collection: string,
        options: { limit: number; cursor?: string; where: unknown },
      ) => {
        expect(options.limit).toBeLessThanOrEqual(100);
        expect(options.where).toEqual({ status: "published" });
        const offset = Number(options.cursor ?? 0);
        const end = offset + options.limit;
        return {
          items: rows.slice(offset, end),
          hasMore: end < rows.length,
          cursor: end < rows.length ? String(end) : undefined,
        };
      },
    );
    const ctx = {
      schema: {
        listCollections: async () => [createEventsCollectionBlueprint()],
      },
      content: { list },
    } as unknown as EventualContext;
    const source = await readEventSource(ctx);
    expect(source.native).toBe(true);
    expect(source.events).toHaveLength(130);
    expect(list).toHaveBeenCalledTimes(2);
  });
  it.each([undefined, "repeated"])(
    "fails on incomplete/repeating cursors (%s)",
    async (cursor) => {
      const ctx = {
        content: { list: async () => ({ items: [], hasMore: true, cursor }) },
      } as unknown as EventualContext;
      await expect(listNative(ctx, "events")).rejects.toThrow("cursor");
    },
  );
  it("propagates schema lookup failures without reading legacy storage", async () => {
    const query = vi.fn();
    const ctx = {
      schema: {
        listCollections: async () => {
          throw new Error("Schema unavailable");
        },
      },
      content: {},
      storage: { events: { query } },
    } as unknown as EventualContext;
    await expect(readEventSource(ctx)).rejects.toThrow("Schema unavailable");
    expect(query).not.toHaveBeenCalled();
  });

  it("resolves localized venues in bulk via content.list without N+1 get or getTranslations calls", async () => {
    const venueRows = [
      {
        id: "venue-1",
        locale: "en",
        status: "published",
        translationGroup: "tg-v1",
        data: { name: "English Venue", address: "123 Main St" },
      },
      {
        id: "venue-1-fr",
        locale: "fr",
        status: "published",
        translationGroup: "tg-v1",
        data: { name: "Lieu Français", address: "123 Rue Principale" },
      },
    ];

    const listSpy = vi.fn().mockResolvedValue({ items: venueRows, hasMore: false });
    const getSpy = vi.fn();
    const getTranslationsSpy = vi.fn();

    const ctx = {
      content: {
        list: listSpy,
        get: getSpy,
        getTranslations: getTranslationsSpy,
      },
      settings: { get: async () => ({ events: "events", venues: "venues", organizers: "organizers" }) },
      schema: {
        listCollections: async () => [
          createEventsCollectionBlueprint(),
          {
            slug: "venues",
            fields: [{ slug: "name", type: "string" }],
          },
        ],
      },
    } as unknown as EventualContext;

    const events = [
      {
        ...nativeEntryToEventRecord({
          id: "e1",
          locale: "en",
          status: "published",
          data: {
            title: "Event EN",
            start: "2026-11-15T10:00:00Z",
            end: "2026-11-15T11:00:00Z",
            all_day: false,
            timezone: "UTC",
            venue: "venue-1",
          },
        })!,
        venueId: "venue-1",
      },
      {
        ...nativeEntryToEventRecord({
          id: "e2",
          locale: "fr",
          status: "published",
          data: {
            title: "Event FR",
            start: "2026-11-16T10:00:00Z",
            end: "2026-11-16T11:00:00Z",
            all_day: false,
            timezone: "UTC",
            venue: "venue-1",
          },
        })!,
        venueId: "venue-1",
      },
    ];

    const venues = await resolveEventVenues(ctx, events, createEventsCollectionBlueprint() as any);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).not.toHaveBeenCalled();
    expect(getTranslationsSpy).not.toHaveBeenCalled();

    expect(venues.get("venue-1")?.name).toBe("English Venue");
    expect(venues.get("venue-1|fr")?.name).toBe("Lieu Français");
  });

  it("uses authoritative URLs and resolves each base event only once per invocation", async () => {
    const getPublicUrlSpy = vi.fn(async (_collection: string, id: string) => id === 'event-1' ? 'https://example.org/events/music-fest' : 'https://example.org/french/events/fete-musique/');
    const blueprint = createEventsCollectionBlueprint();
    const ctx = {
      site: { url: "https://example.org", locale: "en" },
      plugin: { id: "eventual" },
      schema: {
        listCollections: vi.fn().mockResolvedValue([blueprint]),
      },
      settings: {
        get: vi.fn().mockResolvedValue(undefined),
      },
      content: {
        getPublicUrl: getPublicUrlSpy,
      },
    } as unknown as EventualContext;

    const events = [
      nativeEntryToEventRecord({
        id: "event-1",
        slug: "music-fest",
        locale: "en",
        status: "published",
        data: {
          title: "Music Fest",
          start: "2026-11-15T10:00:00Z",
          end: "2026-11-15T11:00:00Z",
          all_day: false,
          timezone: "UTC",
        },
      })!,
      nativeEntryToEventRecord({
        id: "event-2",
        slug: "fete-musique",
        locale: "fr",
        status: "published",
        data: {
          title: "Fête de la Musique",
          start: "2026-11-15T10:00:00Z",
          end: "2026-11-15T11:00:00Z",
          all_day: false,
          timezone: "UTC",
        },
      })!,
    ];

    const hydrated = await hydrateNativeAssets(ctx, events);
    expect(getPublicUrlSpy).toHaveBeenCalledTimes(2);
    expect(hydrated[0].publicUrl).toBe("https://example.org/events/music-fest");
    expect(hydrated[1].publicUrl).toBe("https://example.org/french/events/fete-musique/");
    const repeated = await hydrateNativeAssets(ctx, [{...events[0]!, id:'event-1#2026-11-16T10:00'}]);
    expect(repeated[0]!.publicUrl).toBe(hydrated[0]!.publicUrl);
    expect(getPublicUrlSpy).toHaveBeenCalledTimes(2);
  });

  it("memoizes collectionBindings and eventSchema per context instance", async () => {
    const listCollectionsSpy = vi.fn().mockResolvedValue([createEventsCollectionBlueprint()]);
    const settingsGetSpy = vi.fn().mockResolvedValue(undefined);

    const ctx = {
      schema: { listCollections: listCollectionsSpy },
      settings: { get: settingsGetSpy },
      content: {},
    } as unknown as EventualContext;

    const s1 = await nativeSchema(ctx);
    const s2 = await nativeSchema(ctx);
    expect(s1).toBe(s2);
    expect(listCollectionsSpy).toHaveBeenCalledTimes(1);
    expect(settingsGetSpy).toHaveBeenCalledTimes(1);
  });
});
