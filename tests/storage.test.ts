import { describe, expect, it } from "vitest";

import type { EventRecord } from "../src/domain/event";
import { handlePublicEvents } from "../src/routes/public-events";
import { EventScanLimitError, listEvents, type EventualContext } from "../src/storage";

function contextWithEvents(count: number): EventualContext {
	return {
		storage: {
			events: {
				query: async ({ cursor, limit }: { cursor?: string; limit: number }) => {
					const start = Number(cursor ?? 0);
					const end = Math.min(start + limit, count);
					return {
						items: Array.from({ length: end - start }, (_, index) => ({
							id: String(start + index),
							data: { id: String(start + index) } as EventRecord,
						})),
						hasMore: end < count,
						cursor: end < count ? String(end) : undefined,
					};
				},
			},
		},
	} as unknown as EventualContext;
}

describe("event scans", () => {
	it("returns every matching event beyond the former 5,000-record cutoff", async () => {
		const events = await listEvents(contextWithEvents(5_001), { published: true });
		expect(events).toHaveLength(5_001);
		expect(events.at(-1)?.id).toBe("5000");
	});

	it("fails explicitly when the scan budget would omit a record", async () => {
		await expect(listEvents(contextWithEvents(4), { maxItems: 3 }))
			.rejects.toMatchObject({ name: "EventScanLimitError", limit: 3 });
		await expect(listEvents(contextWithEvents(3), { maxItems: 3 })).resolves.toHaveLength(3);
		expect(new EventScanLimitError(3).message).toContain("More than 3 events");
	});

	it("returns an error instead of a partial public feed above the scan budget", async () => {
		await expect(handlePublicEvents({ from: "2026-10-01", through: "2026-10-31" }, contextWithEvents(10_001)))
			.resolves.toMatchObject({ ok: false, error: "EVENT_LIMIT_EXCEEDED", maxEvents: 10_000 });
	});

	it("selects a bounded start range while retaining earlier recurring series", async () => {
		let where: Record<string, unknown> | undefined;
		const ctx = {
			storage: { events: { query: async (options: { where: Record<string, unknown> }) => {
				where = options.where;
				return { items: [], hasMore: false };
			} } },
		} as unknown as EventualContext;
		await listEvents(ctx, { published: true, through: "2026-10-31" });
		expect(where).toEqual({ published: true, start: { lt: "2026-11-02" } });
	});
});
