import { addMonths, isMonthKey } from "./calendar";

export const EVENT_BROWSER_VIEWS = ["list", "timeline", "cards", "schedule", "dates", "month", "locations"] as const;

export type EventBrowserView = typeof EVENT_BROWSER_VIEWS[number];

export interface EventBrowserState {
	month: string;
	view: EventBrowserView;
	category: string;
}

export function eventBrowserState(params: URLSearchParams, currentMonth: string): EventBrowserState {
	const requestedMonth = params.get("month");
	const requestedView = params.get("view");
	return {
		month: isMonthKey(requestedMonth) ? requestedMonth : currentMonth,
		view: EVENT_BROWSER_VIEWS.includes(requestedView as EventBrowserView) ? requestedView as EventBrowserView : "list",
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
