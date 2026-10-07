import { afterEach, describe, expect, it } from "vitest";
import {
  createPluginTestHost,
  type PluginTestHost,
} from "@emdash-cms/plugin-test";
import plugin from "../src/plugin";
let host: PluginTestHost | undefined;
afterEach(async () => {
  await host?.dispose();
  host = undefined;
});
// Real workerd/D1 startup plus several policy RPCs exceeds 15s on cold Windows
// runners. Keep the domain-test deadline unchanged; allow this integration suite
// a bounded minute without retries or weaker assertions.
describe("Eventual compatibility routes", { timeout: 60_000 }, () => {
  it("keeps legacy MCP publication and cancellation feeds usable without native collections", async () => {
    host = await createPluginTestHost();
    const created = (await host.invokeRoute("mcp/events/create", {
      title: "Legacy calendar event",
      description: "**Readable** copy",
      start: "2026-11-15",
      end: "2026-11-15",
      allDay: true,
      timezone: "UTC",
    })) as any;
    expect(created.ok).toBe(true);
    const id = created.event.id;
    expect(await host.invokeRoute("mcp/events/publish", { id })).toMatchObject({
      ok: true,
    });
    const response = (await host.invokeRoute(
      "calendar",
      {},
      {
        method: "GET",
        url: "https://audit.example.com/_emdash/api/plugins/eventual/calendar",
      },
    )) as any;
    expect(response.body.value).toContain("SUMMARY:Legacy calendar event");
    expect(response.body.value).toContain("DESCRIPTION:Readable copy");
    const uid = /UID:([^\r\n]+)/.exec(response.body.value)?.[1];
    expect(
      await host.invokeRoute("mcp/events/unpublish", { id }),
    ).toMatchObject({ ok: true });
    const cancelled = (await host.invokeRoute(
      "calendar",
      {},
      {
        method: "GET",
        url: "https://audit.example.com/_emdash/api/plugins/eventual/calendar",
      },
    )) as any;
    expect(cancelled.body.value).toContain("STATUS:CANCELLED");
    expect(cancelled.body.value).toContain("UID:" + uid);
  });
  it("allows EmDash Editors to use Eventual admin while keeping MCP management admin-only", () => {
    const admin = plugin.routes?.admin as unknown as { permission?: string };
    const createEvent = plugin.routes?.["mcp/events/create"] as unknown as {
      permission?: string;
    };
    expect(admin.permission).toBe("content:edit_any");
    expect(createEvent.permission).toBe("plugins:manage");
  });
  it("rejects malformed admin interactions and public feed query values", async () => {
    host = await createPluginTestHost();
    await expect(
      host.invokeRoute("admin", {
        type: "form_submit",
        action_id: "save-event",
        values: "invalid",
      }),
    ).resolves.toMatchObject({
      blocks: [
        expect.objectContaining({
          type: "banner",
          title: "Invalid admin request",
        }),
      ],
    });
    await expect(
      host.invokeRoute("publicEvents", { from: 20261001 }, { method: "GET" }),
    ).resolves.toEqual({ ok: false, error: "INVALID_QUERY" });
  });
  it("rejects a public date range wider than one year", async () => {
    host = await createPluginTestHost();
    await expect(
      host.invokeRoute(
        "publicEvents",
        {
          from: "2026-01-01",
          through: "2027-01-02",
        },
        { method: "GET" },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "DATE_RANGE_TOO_LARGE",
      maxDays: 366,
    });
  });
  it("accepts exactly 366 inclusive dates in the public event range", async () => {
    host = await createPluginTestHost();
    await expect(
      host.invokeRoute(
        "publicEvents",
        {
          from: "2026-01-01",
          through: "2027-01-01",
        },
        { method: "GET" },
      ),
    ).resolves.toMatchObject({
      ok: true,
      from: "2026-01-01",
      through: "2027-01-01",
      events: [],
    });
  });
  it("validates MCP input and creates an ordinary timezone-aware one-off event", async () => {
    host = await createPluginTestHost();
    await expect(
      host.invokeRoute("mcp/events/create", {
        title: "",
        start: "2026-10-15T18:30",
        end: "2026-10-15T19:30",
        allDay: false,
      }),
    ).resolves.toMatchObject({ ok: false, error: "VALIDATION_ERROR" });
    const created = await host.invokeRoute("mcp/events/create", {
      title: "Paris one-off",
      start: "2026-10-15T18:30",
      end: "2026-10-15T19:30",
      allDay: false,
      timezone: "Europe/Paris",
      location: "Town hall",
      categories: ["Community"],
    });
    const event = (
      created as {
        event: {
          id: string;
          start: string;
          end: string;
          allDay: boolean;
          recurrence?: unknown;
          published: boolean;
        };
      }
    ).event;
    expect(created).toMatchObject({ ok: true });
    expect(event).toMatchObject({
      start: "2026-10-15T16:30:00.000Z",
      end: "2026-10-15T17:30:00.000Z",
      allDay: false,
      published: false,
    });
    expect(event).not.toHaveProperty("recurrence");
    await expect(
      host.invokeRoute("mcp/events/get", { id: event.id }),
    ).resolves.toMatchObject({ ok: true, event: { id: event.id } });
    const invalidZone = await host.invokeRoute("mcp/events/create", {
      title: "Bad timezone",
      start: "2026-10-15T18:30",
      end: "2026-10-15T19:30",
      allDay: false,
      timezone: "Not/A_Timezone",
    });
    expect(invalidZone).toMatchObject({ ok: false, error: "INVALID_EVENT" });
  });
  it("safely manages recurrence exceptions, unpublishing, and assigned venues through MCP", async () => {
    host = await createPluginTestHost();
    const venueResult = await host.invokeRoute("mcp/venues/create", {
      name: "Clubhouse",
      locality: "Paris",
      country: "France",
    });
    const venue = (venueResult as { venue: { id: string; street: string } })
      .venue;
    expect(venue).toMatchObject({
      name: "Clubhouse",
      locality: "Paris",
      street: "",
    });
    const created = await host.invokeRoute("mcp/events/create", {
      title: "Daily practice",
      start: "2026-10-10T09:00",
      end: "2026-10-10T10:00",
      allDay: false,
      timezone: "Europe/Paris",
      venueId: venue.id,
      recurrence: { frequency: "daily", until: "2026-10-12" },
    });
    const event = (created as { event: { id: string } }).event;
    await expect(
      host.invokeRoute("mcp/events/exception/set", {
        eventId: event.id,
        recurrenceId: "2026-10-11T09:00",
        status: "cancelled",
      }),
    ).resolves.toMatchObject({
      ok: true,
      event: { exceptions: [{ status: "cancelled" }] },
    });
    await expect(
      host.invokeRoute("mcp/events/update", {
        id: event.id,
        patch: { recurrence: { frequency: "weekly", until: "2026-10-12" } },
      }),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_EVENT" });
    await expect(
      host.invokeRoute("mcp/venues/delete", { id: venue.id }),
    ).resolves.toMatchObject({ ok: false, error: "VENUE_IN_USE" });
    await expect(
      host.invokeRoute("mcp/events/unpublish", { id: event.id }),
    ).resolves.toMatchObject({ ok: true, event: { published: false } });
    await expect(
      host.invokeRoute("mcp/events/exception/remove", {
        eventId: event.id,
        recurrenceId: "2026-10-11T09:00",
      }),
    ).resolves.toMatchObject({ ok: true, event: { exceptions: [] } });
    await expect(
      host.invokeRoute("mcp/venues/list", {}),
    ).resolves.toMatchObject({
      ok: true,
      venues: [expect.objectContaining({ id: venue.id })],
    });
  });
});
