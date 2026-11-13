import { safeHttpUrl } from "./venue";
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

	const enc = encodeURIComponent;
	const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${enc(title)}&dates=${googleDates}&details=${enc(details)}&location=${enc(loc)}`;
	const q = `path=/calendar/action/compose&rru=addevent&subject=${enc(title)}&body=${enc(details)}&location=${enc(loc)}&startdt=${enc(outlookStart)}&enddt=${enc(outlookEnd)}${isAllDayParam}`;
	const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?${q}`;
	const office365 = `https://outlook.office.com/calendar/0/deeplink/compose?${q}`;

	const eventBaseId = event.id.split("#")[0]!;
	const icsPath = `/_emdash/api/plugins/eventual/calendar?eventId=${enc(eventBaseId)}`;
	const ics = siteUrl ? new URL(icsPath, siteUrl).href : icsPath;

	return {
		google,
		outlook,
		office365,
		ics,
	};
}
