import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPublicFeed, FeedError } from "./feed";

const publicEvent = {
	id: "event-1",
	updatedAt: "2026-10-01T10:20:30.000Z",
	title: "Community run",
	description: "",
	start: "2026-10-10T16:00:00.000Z",
	end: "2026-10-10T17:00:00.000Z",
	allDay: false,
	timezone: "Europe/Paris",
	location: "Town hall",
	organizer: "",
	externalUrl: "",
	imageUrl: "",
	categories: ["community"],
	venue: null,
	directionsUrl: "",
};

afterEach(() => vi.unstubAllGlobals());

describe("Eventual public route adapter", () => {
	it("unwraps EmDash's response envelope and requests a bounded visible month", async () => {
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			success: true,
			data: { ok: true, from: "2026-09-28", through: "2026-11-01", events: [publicEvent] },
		}), { status: 200, headers: { "content-type": "application/json" } }));
		vi.stubGlobal("fetch", fetch);

		const feed = await fetchPublicFeed("https://cms.example", "2026-09-28", "2026-11-01", "community");
		expect(feed.events).toEqual([publicEvent]);
		const request = new URL(fetch.mock.calls[0]![0] as URL);
		expect(request.pathname).toBe("/_emdash/api/plugins/eventual/publicEvents");
		expect(request.searchParams.get("category")).toBe("community");
		expect(fetch.mock.calls[0]![1]).toMatchObject({ cache: "no-store" });
	});

	it("reports API application errors even when the HTTP envelope succeeded", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
			success: true,
			data: { ok: false, error: "DATE_RANGE_TOO_LARGE" },
		}), { status: 200 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-01-01", "2027-01-01"))
			.rejects.toMatchObject({ name: "FeedError", message: "DATE_RANGE_TOO_LARGE" });
	});

	it("rejects invalid JSON, failed envelopes, and malformed event records", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toBeInstanceOf(FeedError);

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, data: {} }), { status: 200 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("unsuccessful response");

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
			success: true,
			data: { ok: true, from: "2026-10-01", through: "2026-10-31", events: [{ ...publicEvent, start: 12 }] },
		}), { status: 200 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("invalid event list");

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
			success: true,
			data: { ok: true, from: "2026-10-01", through: "2026-10-31", events: [{ ...publicEvent, timezone: "Mars/Phobos" }] },
		}), { status: 200 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("invalid event list");

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
			success: true,
			data: { ok: true, from: "2026-10-01", through: "2026-10-31", events: [{ ...publicEvent, updatedAt: "tomorrow" }] },
		}), { status: 200 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("invalid event list");
	});

	it("surfaces network and HTTP errors as stable feed failures", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("could not be reached");

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
		await expect(fetchPublicFeed("https://cms.example", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("HTTP 503");
	});

	it("rejects unsupported API origins before making a request", async () => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		await expect(fetchPublicFeed("javascript:alert(1)", "2026-10-01", "2026-10-31"))
			.rejects.toThrow("HTTP(S) EmDash site");
		expect(fetch).not.toHaveBeenCalled();
	});
});
