import { describe, expect, it } from "vitest";
import { eventRange } from "./event-range";

describe("event route date ranges", () => {
	const now = new Date("2026-10-01T12:00:00.000Z");

	it("defaults to one year from today within the public route limit", () => {
		expect(eventRange(new URLSearchParams(), now)).toEqual({ from: "2026-10-01", through: "2027-10-01" });
	});

	it("accepts the exact occurrence date range and one-day events", () => {
		expect(eventRange(new URLSearchParams("from=2026-10-10&through=2026-10-12"), now))
			.toEqual({ from: "2026-10-10", through: "2026-10-12" });
		expect(eventRange(new URLSearchParams("from=2026-10-10&through=2026-10-10"), now))
			.toEqual({ from: "2026-10-10", through: "2026-10-10" });
	});

	it("rejects malformed, impossible, reversed, or oversized ranges", () => {
		for (const query of [
			"from=nope&through=2026-10-10",
			"from=2026-02-30&through=2026-03-01",
			"from=2026-10-11&through=2026-10-10",
			"from=2026-10-01&through=2027-10-02",
		]) expect(eventRange(new URLSearchParams(query), now)).toBeNull();
	});
});
