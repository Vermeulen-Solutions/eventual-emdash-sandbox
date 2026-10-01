import { afterEach, describe, expect, it } from "vitest";
import { createPluginRuntimeTestHost, type PluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import type { EventRecord } from "../src/domain/event";
import { mcpTools } from "../src/mcp-schemas";
import { addDays } from "../src/domain/recurrence";

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
  it("keeps an event with 500 exceptions within the host's Block Kit response limits", async () => {
    const h = await seed();
    const previous = (await h.inspect.storage.get<EventRecord>("events", "practice"))!;
    const from = addDays(new Date().toISOString().slice(0, 10), 1);
    await h.fixtures.plugin.storage("events", "practice", {
      ...previous, start: from, end: from, allDay: true,
      recurrence: { frequency: "daily", until: addDays(from, 499) },
      exceptions: Array.from({ length: 500 }, (_, i) => ({ recurrenceId: addDays(from, i), status: "cancelled" })),
    });
    const details = await h.admin.act("/events", "edit-event", { value: "practice" });
    expect(JSON.stringify(details)).toContain("500 saved occurrence exceptions");
    const manage = details.blocks.flatMap((block) => block.type === "accordion" ? block.blocks : [block])
      .flatMap((block) => block.type === "actions" ? block.elements : [])
      .find((button) => button.type === "button" && button.label === "Manage occurrence dates");
    const editor = await h.admin.act("/events", "occurrences-page", { value: manage?.type === "button" ? manage.value : undefined });
    expect(JSON.stringify(editor)).toContain("Showing the first 25 exceptions");
    expect(editor.blocks.filter((block) => block.type === "section")).toHaveLength(35);
    const exception = await h.admin.act("/events", "edit-exception", { value: JSON.stringify({ eventId: "practice", recurrenceId: from }) });
    expect(exception.blocks.some((block) => block.type === "form" && block.block_id?.startsWith("exception-form:"))).toBe(true);
  }, 15000);

  it("shares multi-day rules across admin, MCP, public routes, and calendar cancellations", async () => {
    const h = await seed();
    let from = addDays(new Date().toISOString().slice(0, 10), 1);
    while (new Date(`${from}T00:00:00Z`).getUTCDay() !== 2) from = addDays(from, 1);
    const until = addDays(from, 30);
    const created = await h.transport.invokeRoute("mcp/events/create", {
      title: "Training", start: `${from}T18:00`, end: `${from}T19:00`, allDay: false, timezone: "Europe/Paris",
      recurrence: { frequency: "weekly", interval: 2, until, weekdays: ["thursday", "tuesday"] },
    }) as { ok: boolean; event: EventRecord };
    expect(created.ok).toBe(true);
    expect(created.event.recurrence).toMatchObject({ weekdays: ["tuesday", "thursday"] });
    const id = created.event.id;
    const editor = await h.admin.act("/events", "edit-event", { value: id });
    const form = editor.blocks.find((block) => block.type === "form" && block.block_id?.startsWith(`event-form:${id}:updated:`));
    expect(form?.type === "form" && form.fields.find((field) => field.action_id === "weeklyWeekdays"))
      .toMatchObject({ type: "checkbox", initial_value: ["tuesday", "thursday"] });
    // Submit actual saved values through the validated host to catch conversion losses.
    const draftValues = form?.type === "form" ? Object.fromEntries(form.fields.map((field) => [field.action_id, "initial_value" in field ? field.initial_value : undefined])) : {};
    await h.admin.submit("/events", "save-event", { ...draftValues, title: "Training updated" }, { blockId: form?.type === "form" ? form.block_id : undefined });
    expect(await h.inspect.storage.get<EventRecord>("events", id)).toMatchObject({ title: "Training updated", recurrence: created.event.recurrence });
    await h.transport.invokeRoute("mcp/events/publish", { id });
    const publicFeed = await h.transport.invokeRoute("publicEvents", { from, through: until }, { method: "GET" }) as { events: EventRecord[] };
    expect(publicFeed.events.filter((row) => row.id.startsWith(`${id}#`))).toHaveLength(6);
    const widget = await h.admin.loadWidget("upcoming-events");
    expect(JSON.stringify(widget)).toContain("Training updated");
    const thursday = `${addDays(from, 2)}T18:00`;
    await h.transport.invokeRoute("mcp/events/exception/set", { eventId: id, recurrenceId: thursday, status: "cancelled" });
    await expect(h.transport.invokeRoute("mcp/events/update", { id, patch: { recurrence: { frequency: "weekly", interval: 2, until, weekdays: ["tuesday"] } } }))
      .resolves.toMatchObject({ ok: false, error: "INVALID_EVENT" });
    await h.transport.invokeRoute("mcp/events/exception/remove", { eventId: id, recurrenceId: thursday });
    await expect(h.transport.invokeRoute("mcp/events/update", { id, patch: { recurrence: { frequency: "weekly", interval: 2, until, weekdays: ["tuesday"] } } }))
      .resolves.toMatchObject({ ok: true });
    expect(await h.inspect.storage.get("calendar_cancellations", `${id}#${thursday}`)).toMatchObject({ eventId: id });
    expect(mcpTools.createEvent.input.safeParse({ title: "Invalid", start: from, end: from, allDay: true, recurrence: { frequency: "weekly", until, weekdays: ["tuesday", "tuesday"] } }).success).toBe(false);
  }, 15000);

  it("validates and retains recurrence intervals and monthly days across unrelated MCP edits", async () => {
    const h = await seed();
    const create = (recurrence: unknown) => h.transport.invokeRoute("mcp/events/create", {
      title: "Month end", start: "2026-02-28", end: "2026-02-28", allDay: true, timezone: "Europe/Paris", recurrence,
    });
    await expect(create({ frequency: "monthly", until: "2026-12-31", interval: 0, pattern: { type: "dayOfMonth", dayOfMonth: 31, missingDayBehavior: "lastDay" } }))
      .resolves.toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    const rule = { frequency: "monthly", until: "2026-12-31", interval: 2, pattern: { type: "dayOfMonth", dayOfMonth: 31, missingDayBehavior: "lastDay" } };
    const created = await create(rule) as { event: EventRecord };
    expect(created.event.recurrence).toEqual(rule);
    await expect(h.transport.invokeRoute("mcp/events/update", { id: created.event.id, patch: { title: "Updated title" } }))
      .resolves.toMatchObject({ ok: true, event: { recurrence: rule } });
    const form = await h.admin.act("/events", "edit-event", { value: created.event.id });
    expect(JSON.stringify(form)).toContain("every 2 months");
    const eventForm = form.blocks.find((block) => block.type === "form" && block.block_id?.startsWith(`event-form:${created.event.id}:updated:`));
    expect(eventForm?.type === "form" && eventForm.fields.find((field) => field.action_id === "recurrenceInterval")).toMatchObject({ type: "number_input", initial_value: 2 });
    expect(eventForm?.type === "form" && eventForm.fields.find((field) => field.action_id === "monthlyDayOfMonth")).toMatchObject({ initial_value: 31 });
  }, 15000);
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
    await expect(call({ id: "practice", from: ["2026-10-06"] })).resolves.toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
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
