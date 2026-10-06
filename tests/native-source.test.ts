import { describe, it, expect, vi } from "vitest";
import { listNative, readEventSource } from "../src/domain/native-source";
import { createEventsCollectionBlueprint } from "../src/schema/blueprint";
import type { EventualContext } from "../src/storage";

describe("Native pagination and source authority", () => {
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
});
