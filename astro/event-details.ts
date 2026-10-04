/** Shared output rules for sandbox feeds and headless consumers. */
export function safeWebUrl(value: string, base?: string): string {
	if (!value.trim()) return "";
	try {
		const url = base ? new URL(value, base) : new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
	} catch {
		return "";
	}
}

type EventDetails = { location: string; locationType?: string; virtualUrl?: string; status?: string };

export function calendarLocation(event: EventDetails): string {
	const online = safeWebUrl(event.virtualUrl ?? "");
	if (event.locationType === "virtual") return online || event.location;
	if (event.locationType === "hybrid") return [event.location, online].filter(Boolean).join(" · ");
	return event.location;
}

export function calendarEventUrl(event: Pick<EventDetails, "locationType" | "virtualUrl"> & { externalUrl: string }): string {
	return safeWebUrl(event.externalUrl) || (event.locationType === "virtual" || event.locationType === "hybrid" ? safeWebUrl(event.virtualUrl ?? "") : "");
}

export function calendarStatus(event: Pick<EventDetails, "status">): string {
	return event.status === "cancelled" ? "CANCELLED" : event.status === "postponed" ? "TENTATIVE" : "CONFIRMED";
}
