import { describe, it, expect, vi } from "vitest";
import type { SandboxedRouteContext } from "emdash/plugin";
import {
  validateBlockResponse,
  validateEditorDraftPatchEffect,
} from "@emdash-cms/blocks/server";
import { handleScheduleEditorPanel } from "../src/native/schedule-panel";
import {
  compileRecurrenceFromForm,
  recurrenceToFormValues,
  prepareNativeDuplicate,
} from "../src/native/event-commands";
import type { RecurrenceFormInput } from "../src/native/event-commands";
import { normalizeNativeSchedule } from "../src/domain/native-validation";
import { nativeEntryToEventRecord } from "../src/domain/event-expansion";
import { handleContentBeforeSave } from "../src/hooks/content-hooks";
const fields = {
  title: "Workshop",
  start: "2026-11-02T10:00:00Z",
  end: "2026-11-02T12:00:00Z",
  all_day: false,
  timezone: "UTC",
  recurrence: {
    frequency: "weekly",
    weekdays: ["monday"],
    until: "2026-11-30",
  },
  exceptions: [],
  occurrence_content: [],
};
const ui: SandboxedRouteContext["ui"] = {
  surface: "content-editor-panel",
  extensionId: "event-schedule",
  locale: "en",
  direction: "ltr",
  entry: { collection: "events", id: "evt", locale: "en", version: 1 },
};
async function run(
  action: string,
  values: Record<string, unknown> = {},
  value?: string,
  data: Record<string, unknown> = fields,
  ctx: any = {},
) {
  const response = await handleScheduleEditorPanel(
    {
      ui,
      request: {url:"https://site.example/_emdash/api/plugins/eventual/admin/editor/schedule",method:"POST",headers:{}},
      input: {
        type: "form_submit",
        action_id: action,
        values,
        value,
        draft: { fields: data },
      },
    },
    ctx,
  );
  const validation = validateBlockResponse(response, {});
  expect(validation.valid, JSON.stringify(validation)).toBe(true);
  if (response.patch)
    expect(validateEditorDraftPatchEffect(response.patch)).toMatchObject({
      valid: true,
    });
  return response;
}
function applied(
  response: Awaited<ReturnType<typeof run>>,
  data: Record<string, unknown> = fields,
) {
  const next = { ...data };
  for (const op of response.patch!.operations)
    next[op.field] = op.op === "clear" ? null : op.value;
  expect(() => normalizeNativeSchedule(next)).not.toThrow();
  return next;
}
describe("Friendly editor uses host context and round-trips through save and expansion", () => {
  it("bounds directory choices and finds venues outside the first page using the schema target", async () => {
    const rows = Array.from({ length: 250 }, (_, index) => ({
      id: "location-" + index,
      status: "published",
      locale: "fr",
      data: { name: "Hall " + String(index).padStart(3, "0") },
    }));
    const ctx: any = {
      schema: {
        listCollections: async () => [
          {
            slug: "events",
            fields: [
              {
                slug: "venue",
                type: "reference",
                options: { collection: "locations" },
              },
              { slug: "organizer_ref", options: { collection: "organizers" } },
            ],
          },
          { slug: "locations" },
        ],
      },
      content: {
        list: vi.fn(async (target: string, options: any) => {
          expect(target).toBe("locations");
          const offset = Number(options.cursor ?? 0);
          return {
            items: rows.slice(offset, offset + 100),
            hasMore: offset + 100 < rows.length,
            cursor: String(offset + 100),
          };
        }),
      },
    };
    const response = await run(
      "search-directories",
      { directory_search: "Hall 249" },
      undefined,
      fields,
      ctx,
    );
    expect(response.patch).toBeUndefined();
    const details = response.blocks.flatMap((block: any) => block.blocks ?? [block]).find(
      (block: any) => block.block_id === "apply-details",
    ) as any;
    expect(
      details.fields.find((field: any) => field.action_id === "venue").options,
    ).toEqual([
      { value: "", label: "No saved venue" },
      { value: "location-249", label: "Hall 249 [FR]" },
    ]);
    expect(ctx.content.list).toHaveBeenCalledTimes(3);
  });
  it("writes column-backed aliases on bound schemas and keeps unrelated selections untouched", async () => {
    const data = { ...fields, venue_id: "old", organizer_id: "organizer" };
    const ctx: any = {
      schema: {
        listCollections: async () => [
          {
            slug: "events",
            fields: [
              {
                slug: "venue",
                validation: {
                  relation: "events_venue",
                  targetCollection: "locations",
                },
              },
              { slug: "venue_id" },
              {
                slug: "organizer_ref",
                validation: {
                  relation: "events_organizer",
                  targetCollection: "organizers",
                },
              },
              { slug: "organizer_id" },
            ],
          },
        ],
      },
      content: {
        get: async (target: string, id: string) => ({
          id,
          status: "published",
          data: { name: target },
        }),
      },
    };
    const response = await run(
      "apply-details",
      { venue: "new", organizer_ref: "organizer", categories: "" },
      undefined,
      data,
      ctx,
    );
    expect(response.patch?.operations).toEqual(
      expect.arrayContaining([{ op: "set", field: "venue_id", value: "new" }]),
    );
    expect(
      response.patch?.operations.some((op) =>
        ["venue", "organizer_ref", "organizer_id"].includes(op.field),
      ),
    ).toBe(false);
  });
  it("loads a saved pending draft even when panel_load has no snapshot", async () => {
    const ctx: any = {
      content: {
        get: vi.fn().mockResolvedValue({ data: {}, draftRevisionId: "draft" }),
        getRevision: vi
          .fn()
          .mockResolvedValue({
            data: { ...fields, recurrence: JSON.stringify(fields.recurrence) },
          }),
      },
    };
    const response = await handleScheduleEditorPanel(
      { ui, request: {url:"https://site.example/editor",method:"POST",headers:{}}, input: { type: "panel_load" } },
      ctx,
    );
    expect(validateBlockResponse(response, {})).toMatchObject({ valid: true });
    expect(JSON.stringify(response.blocks)).toContain("weekly");
    expect(ctx.content.getRevision).toHaveBeenCalledWith(
      "events",
      "evt",
      "draft",
    );
  });
  it("uses live core numeric identity, and rejects body-forged identity", async () => {
    const response = await handleScheduleEditorPanel(
      { input: { ui, draft: { fields } } } as any,
      {} as any,
    );
    expect(response.patch).toBeUndefined();
    expect(JSON.stringify(response)).toContain("Open this panel");
  });
  it("compiles weekly and both monthly patterns and rejects invalid choices", () => {
    const patterns: RecurrenceFormInput[] = [
      { frequency: "weekly", weekdays: ["friday", "monday"] },
      {
        frequency: "monthly",
        monthlyPatternType: "dayOfMonth",
        dayOfMonth: 31,
        missingDayBehavior: "lastDay",
      },
      {
        frequency: "monthly",
        monthlyPatternType: "weekdayOfMonth",
        position: "last",
        weekday: "friday",
      },
    ];
    for (const values of patterns) {
      const result = compileRecurrenceFromForm({
        ...values,
        until: "2027-12-31",
      });
      expect(result.error).toBeUndefined();
      expect(
        compileRecurrenceFromForm(recurrenceToFormValues(result.rule!)).rule,
      ).toEqual(result.rule);
    }
    expect(
      compileRecurrenceFromForm({
        frequency: "weekly",
        weekdays: ["bogus"],
        until: "2027-12-31",
      }).error,
    ).toBeTruthy();
  });
  it("cancels and restores a real local recurrence ID without clearing translated copy", async () => {
    const id = "2026-11-09T10:00";
    const cancelled = applied(await run("cancel-occurrence", {}, id));
    expect(cancelled.exceptions).toEqual([
      { recurrenceId: id, status: "cancelled" },
    ]);
    const saved = await handleContentBeforeSave(
      { collection: "events", isNew: true, content: cancelled },
      {} as any,
    );
    expect(saved).not.toHaveProperty("error");
    const restored = applied(
      await run("restore-occurrence", {}, id, cancelled),
      cancelled,
    );
    expect(restored.exceptions).toEqual([]);
  });
  it("rejects IDs from another schedule and legacy compact UTC identifiers", async () => {
    for (const id of ["20261109T100000Z", "2026-11-10T10:00"])
      expect((await run("cancel-occurrence", {}, id)).patch).toBeUndefined();
  });
  it("reschedules using local date/time controls, retaining identity", async () => {
    const response = await run("reschedule-occurrence", {
      recurrence_id: "2026-11-16T10:00",
      override_start_date: "2026-11-17",
      override_end_date: "2026-11-17",
      override_start_time: "14:00",
      override_end_time: "16:00",
      override_timezone: "Europe/Paris",
      override_all_day: false,
    });
    const next = applied(response);
    expect(next.exceptions).toEqual([
      {
        recurrenceId: "2026-11-16T10:00",
        status: "modified",
        overrides: {
          start: "2026-11-17T13:00:00.000Z",
          end: "2026-11-17T15:00:00.000Z",
          allDay: false,
          timezone: "Europe/Paris",
        },
      },
    ]);
  });
  it("uses a copy array with explicit empty values and preserves siblings", async () => {
    const data = {
      ...fields,
      occurrence_content: [
        {
          recurrenceId: "2026-11-09T10:00",
          overrides: { title: "Other date" },
        },
      ],
    };
    const next = applied(
      await run(
        "set-occurrence-copy",
        {
          recurrence_id: "2026-11-16T10:00",
          use_title: true,
          copy_title: "Special",
          use_location: true,
          copy_location: "",
        },
        undefined,
        data,
      ),
      data,
    );
    expect(next.occurrence_content).toEqual([
      { recurrenceId: "2026-11-09T10:00", overrides: { title: "Other date" } },
      {
        recurrenceId: "2026-11-16T10:00",
        overrides: { title: "Special", location: "" },
      },
    ]);
    const saved = await handleContentBeforeSave(
      { collection: "events", isNew: true, content: next },
      {} as any,
    );
    expect(saved).not.toHaveProperty("error");
    expect(
      nativeEntryToEventRecord({
        id: "evt",
        status: "published",
        data: next,
      } as any),
    ).not.toBeNull();
  });
  it("preserves rich announcement blocks when editing another announcement field", async () => {
    const blocks = [
      {
        _type: "block",
        _key: "b",
        style: "normal",
        markDefs: [],
        children: [
          { _type: "span", _key: "s", marks: ["strong"], text: "Bold" },
        ],
      },
    ];
    const data = {
      ...fields,
      occurrence_content: [
        {
          recurrenceId: "2026-11-16T10:00",
          overrides: { description: blocks },
        },
      ],
    };
    const next = applied(
      await run(
        "set-occurrence-copy",
        {
          recurrence_id: "2026-11-16T10:00",
          use_title: true,
          copy_title: "Changed",
          use_description: true,
          copy_description: "Bold",
        },
        undefined,
        data,
      ),
      data,
    );
    expect((next.occurrence_content as any)[0].overrides.description).toEqual(
      blocks,
    );
  });
  it("rejects DST gaps without applying a draft patch", async () => {
    const response = await run("apply-schedule", {
      start_date: "2027-03-28",
      end_date: "2027-03-28",
      start_time: "02:30",
      end_time: "04:30",
      timezone: "Europe/Paris",
      all_day: false,
    });
    expect(response.patch).toBeUndefined();
  });
  it("clears recurrence through the same friendly form", async () => {
    expect(
      applied(await run("apply-recurrence", { frequency: "none" })).recurrence,
    ).toBeNull();
  });
  it("creates an isolated content payload without identity, state, or unknown metadata", () => {
    const source = {
      ...fields,
      calendar_uid: "shared",
      legacy_id: "old",
      status: "published",
      event_status: "cancelled",
      schedule_history: [{}],
      unknown: "do not copy",
    };
    const duplicate = prepareNativeDuplicate(source);
    expect(duplicate).not.toHaveProperty("calendar_uid");
    expect(duplicate).not.toHaveProperty("status");
    expect(duplicate).not.toHaveProperty("unknown");
    expect(duplicate.event_status).toBe("published");
    expect(duplicate.exceptions).toBeUndefined();
    (duplicate.recurrence as any).until = "2028-01-01";
    expect(source.recurrence.until).toBe("2026-11-30");
  });
});
