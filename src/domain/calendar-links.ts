export interface CalendarLinks {
	google: string;
	outlook: string;
	office365: string;
	ics: string;
}

export interface CalendarEventInput {
	id: string;
	title: string;
	description?: string;
	start: string;
	end: string;
	allDay: boolean;
	timezone?: string;
	location?: string;
	locationType?: "physical" | "virtual" | "hybrid";
	virtualUrl?: string;
}

function safeHttpUrl(value: string): string {
	if (typeof value !== "string" || !value.trim()) return "";
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
	} catch {
		return "";
	}
}

/**
 * Builds standard 1-click web calendar links for Google Calendar, Outlook Web,
 * Office 365, and Apple/desktop iCal (.ics) download.
 */
export function buildCalendarLinks(event: CalendarEventInput, siteUrl = ""): CalendarLinks {
	const title = event.title || "Event";
	const onlineUrl = safeHttpUrl(event.virtualUrl ?? "");
	const details = [event.description || "", onlineUrl].filter(Boolean).join("\n\n");
	
	let loc = event.location || "";
	if (event.locationType === "virtual") {
		loc = onlineUrl || loc;
	} else if (event.locationType === "hybrid" && onlineUrl && loc) {
		loc = `${loc} · ${onlineUrl}`;
	}

	let googleDates: string;
	let outlookStart: string;
	let outlookEnd: string;
	let isAllDayParam = "";

	if (event.allDay) {
		const startDate = event.start.slice(0, 10).replace(/-/g, "");
		// In iCalendar/Google, the end date for all-day is exclusive (next day)
		const endObj = new Date(event.end.slice(0, 10) + "T00:00:00Z");
		endObj.setUTCDate(endObj.getUTCDate() + 1);
		const endDate = endObj.toISOString().slice(0, 10).replace(/-/g, "");
		googleDates = `${startDate}/${endDate}`;
		outlookStart = event.start.slice(0, 10);
		outlookEnd = endObj.toISOString().slice(0, 10);
		isAllDayParam = "&allday=true";
	} else {
		const startUtc = new Date(event.start).toISOString();
		const endUtc = new Date(event.end).toISOString();
		const startCompact = startUtc.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
		const endCompact = endUtc.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
		googleDates = `${startCompact}/${endCompact}`;
		outlookStart = startUtc;
		outlookEnd = endUtc;
	}

	const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${googleDates}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(loc)}`;
	const outlookBase = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&body=${encodeURIComponent(details)}&location=${encodeURIComponent(loc)}&startdt=${encodeURIComponent(outlookStart)}&enddt=${encodeURIComponent(outlookEnd)}${isAllDayParam}`;
	const office365 = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(title)}&body=${encodeURIComponent(details)}&location=${encodeURIComponent(loc)}&startdt=${encodeURIComponent(outlookStart)}&enddt=${encodeURIComponent(outlookEnd)}${isAllDayParam}`;

	const eventBaseId = event.id.split("#")[0]!;
	const icsPath = `/_emdash/api/plugins/eventual/calendar?eventId=${encodeURIComponent(eventBaseId)}`;
	const ics = siteUrl ? new URL(icsPath, siteUrl).href : icsPath;

	return {
		google,
		outlook: outlookBase,
		office365,
		ics,
	};
}
