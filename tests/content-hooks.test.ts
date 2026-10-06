import { describe, expect, it, vi } from "vitest";
import {
  handleContentBeforeSave,
  handleContentBeforePublish,
  handleContentBeforeDelete,
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
});
