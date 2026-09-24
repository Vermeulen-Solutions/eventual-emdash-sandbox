import { describe, expect, it } from "vitest";
import { adjacentMonth, eventBrowserState, eventBrowserUrl } from "./browser-state";

describe("event browser navigation", () => {
	it("accepts valid month, view, and category query values and falls back safely", () => {
		expect(eventBrowserState(new URLSearchParams("month=2026-10&view=month&category=Community"), "2026-09"))
			.toEqual({ month: "2026-10", view: "month", category: "Community" });
		expect(eventBrowserState(new URLSearchParams("month=2026-99&view=grid"), "2026-09"))
			.toEqual({ month: "2026-09", view: "list", category: "" });
	});

	it("keeps the selected month and category when switching views", () => {
		const state = eventBrowserState(new URLSearchParams("month=2026-10&view=list&category=Youth%20sport"), "2026-09");
		expect(new URLSearchParams(eventBrowserUrl(state, "month").slice(1))).toEqual(new URLSearchParams({
			month: "2026-10",
			view: "month",
			category: "Youth sport",
		}));
	});

	it("moves one month at a time across year boundaries while preserving the view filter", () => {
		const state = eventBrowserState(new URLSearchParams("month=2026-01&view=month&category=community"), "2026-09");
		expect(adjacentMonth(state, -1)).toBe("2025-12");
		expect(adjacentMonth(state, 1)).toBe("2026-02");
		expect(eventBrowserUrl(state, state.view, adjacentMonth(state, 1)))
			.toBe("?month=2026-02&view=month&category=community");
	});
});
