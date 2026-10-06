import { afterEach, describe, expect, it } from "vitest";
import {
  createPluginRuntimeTestHost,
  type PluginRuntimeTestHost,
} from "@emdash-cms/plugin-test";
import type { EventRecord } from "../src/domain/event";
import { mcpTools, validateMcpInput } from "../src/mcp-schemas";
import { addDays } from "../src/domain/recurrence";

let host: PluginRuntimeTestHost | undefined;
afterEach(async () => {
  await host?.dispose();
  host = undefined;
});

async function seed() {
  host = await createPluginRuntimeTestHost();
  const event: EventRecord = {
    id: "practice",
    title: "Practice",
    description: "",
    start: "2026-10-06T16:00:00.000Z",
    end: "2026-10-06T17:00:00.000Z",
    allDay: false,
    timezone: "Europe/Paris",
    location: "",
    organizer: "",
    externalUrl: "",
    imageUrl: "",
    categories: [],
    published: false,
    recurrence: { frequency: "daily", until: "2026-12-31" },
    exceptions: [],
    createdAt: "",
    updatedAt: "",
  };
  await host.fixtures.plugin.storage("events", event.id, event);
  return host;
}

describe("legacy occurrence MCP compatibility", () => {
  it("retains large exception lists and directs editing toward migration", async () => {
    const h = await seed();
    const previous = (await h.inspect.storage.get<EventRecord>(
      "events",
      "practice",
    ))!;
    const from = addDays(new Date().toISOString().slice(0, 10), 1);
    await h.fixtures.plugin.storage("events", "practice", {
      ...previous,
      start: from,
      end: from,
      allDay: true,
      recurrence: { frequency: "daily", until: addDays(from, 499) },
      exceptions: Array.from({ length: 500 }, (_, i) => ({
        recurrenceId: addDays(from, i),
        status: "cancelled",
      })),
    });
    const details = (await h.transport.invokeRoute("mcp/events/get", {
      id: "practice",
    })) as { event: EventRecord };
    expect(details.event.exceptions).toHaveLength(500);
    const page = await h.admin.loadPage("/events");
    expect(JSON.stringify(page)).toContain("Legacy event data is retained");
  }, 15000);

  it("shares multi-day rules across MCP, public routes, widgets and calendar cancellations", async () => {
    const h = await seed();
    let from = addDays(new Date().toISOString().slice(0, 10), 1);
    while (new Date(`${from}T00:00:00Z`).getUTCDay() !== 2)
      from = addDays(from, 1);
    const until = addDays(from, 30);
    const created = (await h.transport.invokeRoute("mcp/events/create", {
      title: "Training",
      start: `${from}T18:00`,
      end: `${from}T19:00`,
      allDay: false,
      timezone: "Europe/Paris",
      recurrence: {
        frequency: "weekly",
        interval: 2,
        until,
        weekdays: ["thursday", "tuesday"],
      },
    })) as { ok: boolean; event: EventRecord };
    expect(created.ok).toBe(true);
    expect(created.event.recurrence).toMatchObject({
      weekdays: ["tuesday", "thursday"],
    });
    const id = created.event.id;
    await expect(
      h.transport.invokeRoute("mcp/events/update", {
        id,
        patch: { title: "Training updated" },
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await h.inspect.storage.get<EventRecord>("events", id),
    ).toMatchObject({
      title: "Training updated",
      recurrence: created.event.recurrence,
    });
    await h.transport.invokeRoute("mcp/events/publish", { id });
    const publicFeed = (await h.transport.invokeRoute(
      "publicEvents",
      { from, through: until },
      { method: "GET" },
    )) as { events: EventRecord[] };
    expect(
      publicFeed.events.filter((row) => row.id.startsWith(`${id}#`)),
    ).toHaveLength(6);
    const widget = await h.admin.loadWidget("upcoming-events");
    expect(JSON.stringify(widget)).toContain("Training updated");
    const thursday = `${addDays(from, 2)}T18:00`;
    await h.transport.invokeRoute("mcp/events/exception/set", {
      eventId: id,
      recurrenceId: thursday,
      status: "cancelled",
    });
    await expect(
      h.transport.invokeRoute("mcp/events/update", {
        id,
        patch: {
          recurrence: {
            frequency: "weekly",
            interval: 2,
            until,
            weekdays: ["tuesday"],
          },
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_EVENT" });
    await h.transport.invokeRoute("mcp/events/exception/remove", {
      eventId: id,
      recurrenceId: thursday,
    });
    await expect(
      h.transport.invokeRoute("mcp/events/update", {
        id,
        patch: {
          recurrence: {
            frequency: "weekly",
            interval: 2,
            until,
            weekdays: ["tuesday"],
          },
        },
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await h.inspect.storage.get(
        "calendar_cancellations",
        `${id}#${thursday}`,
      ),
    ).toMatchObject({ eventId: id });
    expect(
      validateMcpInput("createEvent", {
        title: "Invalid",
        start: from,
        end: from,
        allDay: true,
        recurrence: {
          frequency: "weekly",
          until,
          weekdays: ["tuesday", "tuesday"],
        },
      }),
    ).toBe(false);
  }, 15000);

  it("validates and retains recurrence intervals and monthly days across unrelated MCP edits", async () => {
    const h = await seed();
    const create = (recurrence: unknown) =>
      h.transport.invokeRoute("mcp/events/create", {
        title: "Month end",
        start: "2026-02-28",
        end: "2026-02-28",
        allDay: true,
        timezone: "Europe/Paris",
        recurrence,
      });
    await expect(
      create({
        frequency: "monthly",
        until: "2026-12-31",
        interval: 0,
        pattern: {
          type: "dayOfMonth",
          dayOfMonth: 31,
          missingDayBehavior: "lastDay",
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    const rule = {
      frequency: "monthly",
      until: "2026-12-31",
      interval: 2,
      pattern: {
        type: "dayOfMonth",
        dayOfMonth: 31,
        missingDayBehavior: "lastDay",
      },
    };
    const created = (await create(rule)) as { event: EventRecord };
    expect(created.event.recurrence).toEqual(rule);
    await expect(
      h.transport.invokeRoute("mcp/events/update", {
        id: created.event.id,
        patch: { title: "Updated title" },
      }),
    ).resolves.toMatchObject({ ok: true, event: { recurrence: rule } });
    const occurrences = (await h.transport.invokeRoute(
      "mcp/events/occurrences",
      { id: created.event.id, from: "2026-02-01", through: "2026-12-31" },
    )) as { occurrences: unknown[] };
    expect(occurrences.occurrences).toHaveLength(6);
  }, 15000);
  it("validates MCP dates and limits and inspects drafts with explicit truncation", async () => {
    const h = await seed();
    expect(mcpTools.listOccurrences.destructive).toBe(false);
    expect(
      validateMcpInput("listOccurrences", {
        id: "practice",
        from: "2026-02-31",
      }),
    ).toBe(false);
    const call = (input: unknown) =>
      h.transport.invokeRoute("mcp/events/occurrences", input);
    await expect(
      call({
        id: "practice",
        from: "2026-10-06",
        through: "2026-10-31",
        limit: 2,
      }),
    ).resolves.toMatchObject({
      ok: true,
      published: false,
      total: 26,
      truncated: true,
      occurrences: [
        expect.objectContaining({ recurrenceId: "2026-10-06T18:00" }),
        expect.objectContaining({ recurrenceId: "2026-10-07T18:00" }),
      ],
    });
    await expect(call({ id: "practice", limit: 101 })).resolves.toMatchObject({
      ok: false,
      error: "VALIDATION_ERROR",
    });
    await expect(
      call({ id: "practice", from: ["2026-10-06"] }),
    ).resolves.toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    await expect(
      call({ id: "practice", from: "2026-01-01", through: "2027-01-02" }),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_DATE_RANGE" });
    await expect(call({ id: "missing" })).resolves.toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });
  });

  it("validates occurrence selection and cancels/restores one date through MCP", async () => {
    const h = await seed();
    await expect(
      h.transport.invokeRoute("mcp/events/occurrences", {
        id: "practice",
        from: "2026-10-06",
        limit: 10,
      }),
    ).resolves.toMatchObject({
      total: 87,
      truncated: true,
      occurrences: [
        expect.objectContaining({ recurrenceId: "2026-10-06T18:00" }),
        ...Array.from({ length: 9 }, () => expect.any(Object)),
      ],
    });
    await expect(
      h.transport.invokeRoute("mcp/events/exception/set", {
        eventId: "practice",
        recurrenceId: "2026-10-06T18:00",
        status: "cancelled",
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await h.inspect.storage.get<EventRecord>("events", "practice"),
    ).toMatchObject({
      exceptions: [{ recurrenceId: "2026-10-06T18:00", status: "cancelled" }],
    });
    await expect(
      h.transport.invokeRoute("mcp/events/exception/remove", {
        eventId: "practice",
        recurrenceId: "2026-10-06T18:00",
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(
      await h.inspect.storage.get<EventRecord>("events", "practice"),
    ).toMatchObject({ exceptions: [] });
    await expect(
      h.transport.invokeRoute("mcp/events/exception/set", {
        eventId: "practice",
        recurrenceId: "2026-10-06T19:00",
        status: "cancelled",
      }),
    ).resolves.toMatchObject({ ok: false, error: "OCCURRENCE_NOT_FOUND" });
    await expect(
      h.transport.invokeRoute("mcp/events/occurrences", {
        id: "practice",
        from: "2027-01-01",
      }),
    ).resolves.toMatchObject({ total: 0, occurrences: [] });
  }, 15000);
});
