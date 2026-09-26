import { afterEach, describe, expect, it } from "vitest";
import { createPluginRuntimeTestHost, type PluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import type { EventRecord } from "../src/domain/event";
import { mcpTools } from "../src/mcp-schemas";

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => { await host?.dispose(); host = undefined; });

async function seed() {
  host = await createPluginRuntimeTestHost();
  const event: EventRecord = {
    id: "practice", title: "Practice", description: "", start: "2026-10-06T16:00:00.000Z", end: "2026-10-06T17:00:00.000Z",
    allDay: false, timezone: "Europe/Paris", location: "", organizer: "", externalUrl: "", imageUrl: "", categories: [],
    published: false, recurrence: { frequency: "daily", until: "2026-12-31" }, exceptions: [], createdAt: "", updatedAt: "",
  };
  await host.fixtures.plugin.storage("events", event.id, event);
  return host;
}

describe("occurrence editor and MCP", () => {
  it("validates MCP dates and limits and inspects drafts with explicit truncation", async () => {
    const h = await seed();
    expect(mcpTools.listOccurrences.destructive).toBe(false);
    expect(mcpTools.listOccurrences.input.safeParse({ id: "practice", from: "2026-02-31" }).success).toBe(false);
    const call = (input: unknown) => h.transport.invokeRoute("mcp/events/occurrences", input);
    await expect(call({ id: "practice", from: "2026-10-06", through: "2026-10-31", limit: 2 })).resolves.toMatchObject({
      ok: true, published: false, total: 26, truncated: true,
      occurrences: [expect.objectContaining({ recurrenceId: "2026-10-06T18:00" }), expect.objectContaining({ recurrenceId: "2026-10-07T18:00" })],
    });
    await expect(call({ id: "practice", limit: 101 })).resolves.toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    await expect(call({ id: "practice", from: "2026-01-01", through: "2027-01-02" })).resolves.toMatchObject({ ok: false, error: "INVALID_DATE_RANGE" });
    await expect(call({ id: "missing" })).resolves.toMatchObject({ ok: false, error: "NOT_FOUND" });
  });

  it("renders validated date selection, prefills changes, cancels and restores one date", async () => {
    const h = await seed();
    const page = await h.admin.submit("/events", "show-occurrences", { from: "2026-10-06" }, { blockId: "occurrence-window:practice" });
    expect(JSON.stringify(page)).toContain("Showing 1–10 of 87 occurrences");
    const buttons = page.blocks.flatMap((block) => block.type === "actions" ? block.elements : []);
    const change = buttons.find((button) => button.type === "button" && button.action_id === "change-occurrence");
    const cancel = buttons.find((button) => button.type === "button" && button.action_id === "cancel-occurrence");
    const more = buttons.find((button) => button.type === "button" && button.label === "More dates");
    const next = await h.admin.act("/events", "occurrences-page", { value: more?.type === "button" ? more.value : undefined });
    expect(JSON.stringify(next)).toContain("Showing 11–20 of 87 occurrences");
    const editing = await h.admin.act("/events", "change-occurrence", { value: change?.type === "button" ? change.value : undefined });
    const form = editing.blocks.find((block) => block.type === "form" && block.block_id === "exception-form:practice:new");
    expect(form?.type === "form" && form.fields.find((field) => field.action_id === "recurrenceTime")).toMatchObject({ initial_value: "18:00" });
    expect(form?.type === "form" && form.fields.find((field) => field.action_id === "status")).toMatchObject({ initial_value: "modified" });
    const cancelled = await h.admin.act("/events", "cancel-occurrence", { value: cancel?.type === "button" ? cancel.value : undefined });
    expect(JSON.stringify(cancelled)).toContain("Cancelled");
    expect(await h.inspect.storage.get<EventRecord>("events", "practice")).toMatchObject({ exceptions: [{ recurrenceId: "2026-10-06T18:00", status: "cancelled" }] });
    const restore = cancelled.blocks.flatMap((block) => block.type === "actions" ? block.elements : []).find((button) => button.type === "button" && button.label === "Restore");
    await h.admin.act("/events", "remove-exception", { value: restore?.type === "button" ? restore.value : undefined });
    expect(await h.inspect.storage.get<EventRecord>("events", "practice")).toMatchObject({ exceptions: [] });
    const invalid = await h.admin.act("/events", "cancel-occurrence", { value: JSON.stringify({ eventId: "practice", recurrenceId: "2026-10-06T19:00" }) });
    expect(JSON.stringify(invalid)).toContain("Occurrence no longer exists");
    const empty = await h.admin.submit("/events", "show-occurrences", { from: "2027-01-01" }, { blockId: "occurrence-window:practice" });
    expect(JSON.stringify(empty)).toContain("No occurrences in this window");
  }, 15000);
});
