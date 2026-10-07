import { describe, expect, it, vi } from "vitest";
import {
  handleContentBeforeSave,
  handleContentBeforePublish,
  handleContentBeforeDelete,
  handleContentBeforeUnpublish,
} from "../src/hooks/content-hooks";
import type { PluginContext } from "emdash/plugin";
const schedule = {
  start: "2026-11-01T10:00:00Z",
  end: "2026-11-01T11:00:00Z",
  timezone: "UTC",
  all_day: false,
};
const context = () =>
  ({
    content: {
      get: vi.fn().mockResolvedValue({ data: schedule }),
      listRevisions: vi.fn().mockResolvedValue([]),
    },
  }) as unknown as PluginContext;
describe("Native content validation", () => {
  it("checks dependencies beyond the first page, including scheduled changes to live events", async () => {
    const ctx: any = {
      schema: {
        listCollections: vi
          .fn()
          .mockResolvedValue([
            {
              slug: "events",
              fields: [{ slug: "venue", options: { collection: "locations" } }],
            },
          ]),
      },
      content: {
        get: vi.fn().mockResolvedValue(null),
        list: vi
          .fn()
          .mockResolvedValueOnce({
            items: [{ id: "other", status: "draft", data: {} }],
            hasMore: true,
            cursor: "second",
          })
          .mockResolvedValueOnce({
            items: [
              {
                id: "scheduled",
                status: "published",
                scheduledAt: "2027-01-01",
                draftRevisionId: "pending",
                data: { title: "Scheduled concert", venue_id: "old" },
              },
            ],
            hasMore: false,
          }),
        getRevision: vi.fn().mockResolvedValue({ data: { venue_id: "new" } }),
      },
    };
    const result = await handleContentBeforeUnpublish(
      {
        collection: "locations",
        content: { id: "new" },
        origin: { source: "system" },
      } as any,
      ctx,
    );
    expect(result).toMatchObject({
      cancel: true,
      reason: expect.stringContaining("Scheduled concert"),
    });
    expect(ctx.content.list.mock.calls[1][1].cursor).toBe("second");
    expect(ctx.content.getRevision).toHaveBeenCalledWith(
      "events",
      "scheduled",
      "pending",
    );
  });
  it("fails closed when checking a dependency fails", async () => {
    const ctx: any = {
      schema: {
        listCollections: vi
          .fn()
          .mockResolvedValue([
            {
              slug: "events",
              fields: [{ slug: "venue", options: { collection: "locations" } }],
            },
          ]),
      },
      content: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockRejectedValue(new Error("Content query failed")),
      },
    };
    expect(
      await handleContentBeforeUnpublish(
        {
          collection: "locations",
          content: { id: "venue" },
          origin: { source: "system" },
        } as any,
        ctx,
      ),
    ).toMatchObject({ cancel: true, reason: "Content query failed" });
  });
  it("keeps occurrence categories shared rather than localized", async () => {
    const content = {
      ...schedule,
      recurrence: { frequency: "daily", until: "2026-11-03" },
      occurrence_content: [
        {
          recurrenceId: "2026-11-02T10:00",
          overrides: { categories: ["Changed"] },
        },
      ],
    };
    expect(
      await handleContentBeforeSave(
        { collection: "events", isNew: true, content },
        context(),
      ),
    ).toMatchObject({ error: { code: "SAVE_REJECTED" } });
  });
  it("ignores non-event collections", async () =>
    expect(
      await handleContentBeforeSave(
        { collection: "posts", isNew: true, content: { start: "bad" } },
        context(),
      ),
    ).toBeUndefined());
  it("allows editorial-only patches and translation creates before inheritance", async () => {
    const content = { title: "Translated" };
    expect(
      await handleContentBeforeSave(
        { collection: "events", isNew: true, content },
        context(),
      ),
    ).toEqual(content);
  });
  it("validates schedule patches against existing content", async () => {
    const result = await handleContentBeforeSave(
      {
        collection: "events",
        isNew: false,
        id: "event",
        content: { end: "2026-11-01T12:00:00+01:00" },
      },
      context(),
    );
    expect(result?.end).toBe("2026-11-01T11:00:00.000Z");
  });
  it.each([
    { timezone: "Mars/Olympus" },
    { end: "2026-10-01T12:00:00Z" },
    { recurrence: "false" },
    { exceptions: "{}" },
    { start: "2026-02-30T10:00:00Z" },
  ])("returns a sandbox rejection for invalid schedules %j", async (patch) => {
    const result = await handleContentBeforeSave(
      { collection: "events", isNew: true, content: { ...schedule, ...patch } },
      context(),
    );
    expect(result).toMatchObject({
      __emdashSandboxHookResult: true,
      error: { code: "SAVE_REJECTED" },
    });
  });
  it("blocks incomplete publication and scheduled publication", async () => {
    expect(
      await handleContentBeforePublish({
        collection: "events",
        content: { data: { title: "Missing schedule" } },
        origin: { source: "system" },
      }),
    ).toMatchObject({ cancel: true });
  });
  it("never writes tombstones for unrelated collections", async () => {
    await handleContentBeforeDelete(
      { collection: "posts", id: "post", permanent: false },
      context(),
    );
  });

  it("blocks deleting a venue referenced by a published event", async () => {
    const ctx = {
      schema: {
        listCollections: vi
          .fn()
          .mockResolvedValue([
            {
              slug: "events",
              fields: [{ slug: "venue", options: { collection: "venues" } }],
            },
          ]),
      },
      content: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue({
          items: [
            {
              id: "ev-1",
              status: "published",
              data: { title: "Concert", venue: "venue-1" },
            },
          ],
        }),
      },
    } as unknown as PluginContext;

    await expect(
      handleContentBeforeDelete(
        { collection: "venues", id: "venue-1", permanent: false },
        ctx,
      ),
    ).rejects.toThrow('used by published or scheduled event "Concert"');
  });

  it("blocks unpublishing a venue referenced by a published event", async () => {
    const ctx = {
      schema: {
        listCollections: vi
          .fn()
          .mockResolvedValue([
            {
              slug: "events",
              fields: [{ slug: "venue", options: { collection: "venues" } }],
            },
          ]),
      },
      content: {
        get: vi.fn().mockResolvedValue(null),
        list: vi.fn().mockResolvedValue({
          items: [
            {
              id: "ev-1",
              status: "published",
              data: { title: "Concert", venue: "venue-1" },
            },
          ],
        }),
      },
    } as unknown as PluginContext;

    const result = await handleContentBeforeUnpublish(
      {
        collection: "venues",
        content: { id: "venue-1" } as any,
        origin: { source: "system" },
      },
      ctx,
    );

    expect(result).toMatchObject({
      cancel: true,
      reason: expect.stringContaining(
        'used by published or scheduled event "Concert"',
      ),
    });
  });

  it("derives schedule history and previous_start_date when modifying a published event schedule", async () => {
    const livePublished = {
      status: "published",
      data: {
        start: "2026-11-01T10:00:00Z",
        end: "2026-11-01T11:00:00Z",
        timezone: "UTC",
        all_day: false,
        title: "Original",
      },
    };
    const ctx = {
      content: {
        get: vi.fn().mockResolvedValue(livePublished),
        listRevisions: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PluginContext;

    // Save with changed schedule
    const patch = await handleContentBeforeSave(
      {
        collection: "events",
        id: "ev-1",
        isNew: false,
        content: {
          start: "2026-11-02T14:00:00Z",
          end: "2026-11-02T15:00:00Z",
          timezone: "UTC",
          all_day: false,
        },
      },
      ctx,
    );

    expect(patch).toMatchObject({
      previous_start_date: "2026-11-01T10:00:00Z",
      event_status: "rescheduled",
    });
    const history = JSON.parse((patch as any).schedule_history);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      start: "2026-11-01T10:00:00Z",
      end: "2026-11-01T11:00:00Z",
      allDay: false,
      timezone: "UTC",
    });
  });

  it("does not duplicate schedule history entry on title-only edit", async () => {
    const livePublished = {
      status: "published",
      data: {
        start: "2026-11-01T10:00:00Z",
        end: "2026-11-01T11:00:00Z",
        timezone: "UTC",
        all_day: false,
        title: "Original",
      },
    };
    const ctx = {
      content: {
        get: vi.fn().mockResolvedValue(livePublished),
        listRevisions: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PluginContext;

    // Title-only save without schedule change
    const patch = await handleContentBeforeSave(
      {
        collection: "events",
        id: "ev-1",
        isNew: false,
        content: {
          title: "New Title Only",
        },
      },
      ctx,
    );

    // No schedule history added
    expect((patch as any).schedule_history).toBeUndefined();
    expect((patch as any).previous_start_date).toBeUndefined();
  });

  it("accepts up to 500 exceptions without error", async () => {
    const exceptions = Array.from({ length: 500 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 2 + i));
      return {
        recurrenceId: d.toISOString().slice(0, 10),
        status: "cancelled",
      };
    });

    const content = {
      start_date: "2026-11-01",
      end_date: "2026-11-01",
      all_day: true,
      timezone: "UTC",
      recurrence: { frequency: "daily", until: "2028-11-01" },
      exceptions,
    };

    const ctx = {
      content: {
        get: vi.fn().mockResolvedValue(null),
        listRevisions: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PluginContext;

    const result = await handleContentBeforeSave(
      { collection: "events", isNew: true, content },
      ctx,
    );

    expect(result).not.toHaveProperty("error");
  });

  it("rejects more than 500 exceptions", async () => {
    const exceptions = Array.from({ length: 501 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 10, 2 + i));
      return {
        recurrenceId: d.toISOString().slice(0, 10),
        status: "cancelled",
      };
    });

    const content = {
      start_date: "2026-11-01",
      end_date: "2026-11-01",
      all_day: true,
      timezone: "UTC",
      recurrence: { frequency: "daily", until: "2028-11-01" },
      exceptions,
    };

    const ctx = {
      content: {
        get: vi.fn().mockResolvedValue(null),
        listRevisions: vi.fn().mockResolvedValue([]),
      },
    } as unknown as PluginContext;

    const result = await handleContentBeforeSave(
      { collection: "events", isNew: true, content },
      ctx,
    );

    expect(result).toMatchObject({
      error: {
        code: "SAVE_REJECTED",
        reason: "Exceptions must be an array of at most 500 items.",
      },
    });
  });
});
