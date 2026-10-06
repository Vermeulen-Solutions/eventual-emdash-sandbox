import { calendarLocation, calendarStatus, calendarEventUrl } from "../../astro/event-details";
import type { EventRecord } from "./event";
import type { CalendarCancellation } from "../storage";
import { portableTextToPlainText } from "./portable-text";

export function formatCalendarFeed(
	events: EventRecord[],
	cancellations: CalendarCancellation[],
	host: string,
	generatedAt = new Date(),
	calendarName?: string,
): string {
	const activeUids = new Set(events.map((event) => eventUid(event, host)));
	const uniqueCancellations = new Map<string,CalendarCancellation>();
	for (const item of cancellations) {
		const uid=eventUid(item,host); const old=uniqueCancellations.get(uid);
		if (!activeUids.has(uid) && (!old || item.cancelledAt>old.cancelledAt)) uniqueCancellations.set(uid,item);
	}
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Vermeulen Solutions//Eventual Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeText(calendarName || "Eventual events")}`,
		...events.flatMap((event) => eventLines(event, host, generatedAt)),
		...[...uniqueCancellations.values()].flatMap((item) => cancellationLines(item, host, generatedAt)),
		"END:VCALENDAR",
	];
	const result = `${lines.flatMap(foldLine).join("\r\n")}\r\n`;
	if (utf8Encoder.encode(result).length > 4*1024*1024) throw new Error('Calendar output exceeds 4 MiB; narrow the subscription.');
	return result;
}

const utf8Encoder = new TextEncoder();

function eventLines(event: EventRecord, host: string, generatedAt: Date): string[] {
	const modifiedAt = parseDate(event.updatedAt) ?? generatedAt;
	const statusLine = `STATUS:${calendarStatus(event)}`;
	const locationText = calendarLocation(event);
	const eventUrl = calendarEventUrl({...event,externalUrl:event.publicUrl || event.externalUrl});
	const description = portableTextToPlainText(event.description);
	return [
		"BEGIN:VEVENT",
		`UID:${escapeText(eventUid(event, host))}`,
		`DTSTAMP:${formatUtc(generatedAt)}`,
		`LAST-MODIFIED:${formatUtc(modifiedAt)}`,
		`SEQUENCE:${sequence(event.calendarSequence, modifiedAt)}`,
		statusLine,
		`SUMMARY:${escapeText(event.title)}`,
		...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
		...(locationText ? [`LOCATION:${escapeText(locationText)}`] : []),
		...(eventUrl ? [`URL:${eventUrl}`] : []),
		...(event.categories.length ? [`CATEGORIES:${event.categories.map(escapeText).join(",")}`] : []),
		`X-EVENTUAL-TIMEZONE:${escapeText(event.timezone)}`,
		...dateLines(event.start, event.end, event.allDay),
		"END:VEVENT",
	];
}

function cancellationLines(item: CalendarCancellation, host: string, generatedAt: Date): string[] {
	const modifiedAt = parseDate(item.cancelledAt) ?? generatedAt;
	return [
		"BEGIN:VEVENT",
		`UID:${escapeText(eventUid(item, host))}`,
		`DTSTAMP:${formatUtc(generatedAt)}`,
		`LAST-MODIFIED:${formatUtc(modifiedAt)}`,
		`SEQUENCE:${sequence(item.calendarSequence, modifiedAt)}`,
		"STATUS:CANCELLED",
		"SUMMARY:Cancelled event",
		`X-EVENTUAL-TIMEZONE:${escapeText(item.timezone)}`,
		...dateLines(item.start, item.end, item.allDay),
		"END:VEVENT",
	];
}

function dateLines(start: string, end: string, allDay: boolean): string[] {
	if (allDay) {
		const exclusiveEnd = addDay(end.slice(0, 10));
		return [
			`DTSTART;VALUE=DATE:${start.slice(0, 10).replaceAll("-", "")}`,
			`DTEND;VALUE=DATE:${exclusiveEnd.replaceAll("-", "")}`,
		];
	}
	const startDate = parseDate(start);
	const endDate = parseDate(end);
	return startDate && endDate
		? [`DTSTART:${formatUtc(startDate)}`, ...(endDate>startDate ? [`DTEND:${formatUtc(endDate)}`] : [])]
		: [];
}

export function eventUid(
	item: string | { id: string; translationGroup?: string; eventId?: string; calendarUid?: string },
	host: string,
): string {
	let id = typeof item === "string" ? item : item.id;
	if (typeof item !== "string" && item.id.startsWith("cancellation_") && item.eventId) {
		id = item.eventId;
	}
	const translationGroup = typeof item === "string" ? undefined : item.translationGroup;

	let stableId = id;
	if (translationGroup) {
		const hashIndex = id.indexOf("#");
		const recurrencePart = hashIndex >= 0 ? id.slice(hashIndex) : "";
		stableId = `eventual-${translationGroup}${recurrencePart}`;
	}
	const safeHost = host.trim().replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase() || "eventual.invalid";
	if (typeof item !== 'string' && item.calendarUid) {
		const split = item.calendarUid.lastIndexOf('@');
		if (split < 1 || /[\r\n\u0000-\u0020]/.test(item.calendarUid)) throw new Error('Invalid stored calendar UID.');
		const recurrencePart = id.includes('#') ? encodeURIComponent(id.slice(id.indexOf('#'))) : '';
		return item.calendarUid.slice(0,split) + recurrencePart + item.calendarUid.slice(split);
	}
	return `${encodeURIComponent(stableId)}@${safeHost}`;
}

function sequence(value: number | undefined, date: Date): number {
	const result = value ?? Math.floor(date.getTime()/1000);
	return Math.min(2147483647, Math.max(0, Math.floor(result)));
}

function escapeText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/\r\n|\r|\n/g, "\\n")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function parseDate(value: string): Date | undefined {
	const milliseconds = Date.parse(value);
	return Number.isFinite(milliseconds) ? new Date(milliseconds) : undefined;
}

function formatUtc(date: Date): string {
	return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function addDay(value: string): string {
	const date = new Date(`${value}T00:00:00Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime())) return value;
	date.setUTCDate(date.getUTCDate() + 1);
	return date.toISOString().slice(0, 10);
}

function foldLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let bytes = 0;
	for (const character of line) {
		const size = utf8Encoder.encode(character).length;
		if (bytes + size > 75) {
			result.push(current);
			current = " ";
			bytes = 1;
		}
		current += character;
		bytes += size;
	}
	result.push(current);
	return result;
}
