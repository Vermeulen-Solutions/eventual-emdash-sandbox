import { addMonths, isMonthKey } from "./calendar";

export type EventBrowserView = "list" | "month";

export interface EventBrowserState {
	month: string;
	view: EventBrowserView;
	category: string;
}

export function eventBrowserState(params: URLSearchParams, currentMonth: string): EventBrowserState {
	const requestedMonth = params.get("month");
	return {
		month: isMonthKey(requestedMonth) ? requestedMonth : currentMonth,
		view: params.get("view") === "month" ? "month" : "list",
		category: (params.get("category") ?? "").trim(),
	};
}

export function eventBrowserUrl(
	state: EventBrowserState,
	view: EventBrowserView = state.view,
	month = state.month,
): string {
	const params = new URLSearchParams({ month, view });
	if (state.category) params.set("category", state.category);
	return `?${params.toString()}`;
}

export function adjacentMonth(state: EventBrowserState, offset: -1 | 1): string {
	return addMonths(state.month, offset);
}
