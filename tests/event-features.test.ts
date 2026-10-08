import { expect, it } from "vitest";
import { createPluginRuntimeTestHost } from "@emdash-cms/plugin-test";
import { validateMcpInput, mcpSchemas } from "../src/mcp-schemas";
import { type EventRecord, EMPTY_EVENT_DRAFT } from "../src/domain/event";
import { prepareEventData, normalizeEventStatus } from "../src/domain/event-data";
import { formatCalendarFeed } from "../src/domain/icalendar";
import { eventToJsonLd, serializeJsonLd } from "../astro/schema";
import { formatPublicEvent } from "../src/public-event";
// Includes D1 migrations and multiple independent sandbox invocations. Allow
// hosted Windows runners the same wall-time budget as other runtime workflows.
it("updates new fields, clears URLs, and normalizes publication transitions through MCP", async () => {
	const h = await createPluginRuntimeTestHost();
	try {
		const created = await h.transport.invokeRoute("mcp/events/create", { title: "Meetup", start: "2026-10-10", end: "2026-10-10", allDay: true, recurrence: { frequency: "daily", until: "2026-10-12" } }) as {
			event: EventRecord;
		};
		const id = created.event.id;
		await expect(h.transport.invokeRoute("mcp/events/publish", { id })).resolves.toMatchObject({ event: { published: true, status: "published" } });
		await expect(h.transport.invokeRoute("mcp/events/update", { id, patch: { locationType: "hybrid", virtualUrl: "https://example.com/join", status: "cancelled" } }))
			.resolves.toMatchObject({ ok: true, event: { locationType: "hybrid", virtualUrl: "https://example.com/join", status: "cancelled" } });
		await expect(h.transport.invokeRoute("mcp/events/publish", { id })).resolves.toMatchObject({ event: { status: "cancelled" } });
		for (const overrides of [{ virtualUrl: "javascript:alert(1)" }, { locationType: "invalid" }, { status: "invalid" }, { published: true }]) {
			await expect(h.transport.invokeRoute("mcp/events/exception/set", { eventId: id, recurrenceId: "2026-10-10", status: "modified", overrides })).resolves.toMatchObject({ ok: false });
		}
		await expect(h.transport.invokeRoute("mcp/events/exception/set", { eventId: id, recurrenceId: "2026-10-10", status: "modified", overrides: { locationType: "virtual", virtualUrl: "https://example.com/replacement", status: "rescheduled" } }))
			.resolves.toMatchObject({ ok: true, event: { exceptions: [{ overrides: { locationType: "virtual", virtualUrl: "https://example.com/replacement", status: "rescheduled" } }] } });
		const feed = await h.transport.invokeRoute("publicEvents", { from: "2026-10-10", through: "2026-10-12" }, { method: "GET" }) as {
			events: EventRecord[];
		};
		expect(feed.events[0]).toMatchObject({ locationType: "virtual", virtualUrl: "https://example.com/replacement", status: "rescheduled" });
		// Read-back is independent of the save result and catches dropped patches.
		await expect(h.transport.invokeRoute("mcp/events/get", { id })).resolves.toMatchObject({ event: { virtualUrl: "https://example.com/join", status: "cancelled" } });
		await expect(h.transport.invokeRoute("mcp/events/update", { id, patch: { virtualUrl: "" } })).resolves.toMatchObject({ ok: true });
		expect((await h.inspect.storage.get<EventRecord>("events", id))?.virtualUrl).toBeUndefined();
		await expect(h.transport.invokeRoute("mcp/events/unpublish", { id })).resolves.toMatchObject({ event: { published: false, status: "draft" } });
		await expect(h.transport.invokeRoute("mcp/events/publish", { id })).resolves.toMatchObject({ event: { published: true, status: "published" } });
	}
	finally {
		await h.dispose();
	}
}, 60_000);
it("rejects invalid inputs using real shared validation rather than fake safeParse", () => {
	expect(validateMcpInput("getEvent", null)).toBe(false);
	expect(validateMcpInput("getEvent", { id: "x", unexpected: true })).toBe(false);
	expect(validateMcpInput("createEvent", { title: "X", start: "x", end: "x", allDay: true, virtualUrl: 42 })).toBe(false);
	expect(validateMcpInput("listOccurrences", { id: "x", from: "2026-02-31" })).toBe(false);
	expect(mcpSchemas.createEvent).not.toHaveProperty("safeParse");
});
it("validates URL schemes and normalizes admin/domain save statuses", () => {
	const draft = { ...EMPTY_EVENT_DRAFT, title: "X", start: "2026-10-10", end: "2026-10-10", allDay: true };
	for (const virtualUrl of ["javascript:alert(1)", "data:text/html,x", "ftp://example.com", "https://", "not a URL"]) {
		expect(prepareEventData({ ...draft, virtualUrl }).error).toBe("Virtual URL must use HTTP or HTTPS.");
	}
	expect(prepareEventData({ ...draft, published: true, status: "draft" }).data?.status).toBe("published");
	expect(prepareEventData({ ...draft, published: false, status: "cancelled" }).data?.status).toBe("draft");
	expect(normalizeEventStatus(true, "postponed")).toBe("postponed");
});
it("preserves hybrid URLs without physical locations and maps calendar lifecycle statuses", () => {
	const data = prepareEventData({ ...EMPTY_EVENT_DRAFT, title: "X", start: "2026-10-10", end: "2026-10-10", allDay: true, published: true, locationType: "hybrid", virtualUrl: "https://example.com/join" }).data!;
	const event: EventRecord = { ...data, id: "x", createdAt: "", updatedAt: "" };
	for (const [status, expected] of [["published", "CONFIRMED"], ["cancelled", "CANCELLED"], ["postponed", "TENTATIVE"], ["rescheduled", "CONFIRMED"]] as const) {
		const calendar = formatCalendarFeed([{ ...event, status }], [], "example.com");
		expect(calendar).toContain(`STATUS:${expected}`);
		expect(calendar).toContain("LOCATION:https://example.com/join");
		expect(calendar).toContain("URL:https://example.com/join");
	}
	expect(eventToJsonLd(formatPublicEvent(event, undefined)).location).toEqual({ "@type": "VirtualLocation", url: "https://example.com/join" });
});
it("resolves safe relative schema URLs and safely serializes script-closing content", () => {
	const data = prepareEventData({ ...EMPTY_EVENT_DRAFT, title: "</script><script>alert(1)</script>", start: "2026-10-10", end: "2026-10-10", allDay: true }).data!;
	const event = formatPublicEvent({ ...data, id: "x", createdAt: "", updatedAt: "" }, undefined);
	const record = eventToJsonLd({ ...event, imageUrl: "/image.jpg", externalUrl: "/events/x" }, { siteUrl: "https://example.com" });
	expect(record.image).toBe("https://example.com/image.jpg");
	expect(record.url).toBe("https://example.com/events/x");
	const json = serializeJsonLd(record);
	expect(json).not.toContain("<");
	expect(JSON.parse(json)).toEqual(record);
	expect(eventToJsonLd({ ...event, imageUrl: "javascript:alert(1)" })).not.toHaveProperty("image");
});
