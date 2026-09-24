import type { EventRecord } from "./event";
import type { CalendarCancellation } from "../storage";
import { safeHttpUrl } from "./venue";

export function formatCalendarFeed(
	events: EventRecord[],
	cancellations: CalendarCancellation[],
	host: string,
	generatedAt = new Date(),
): string {
	const activeIds = new Set(events.map((event) => event.id));
	const uniqueCancellations = new Map(
		cancellations
			.filter((item) => !activeIds.has(item.id))
			.map((item) => [item.id, item]),
	);
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Vermeulen Solutions//Eventual Calendar//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:Eventual events",
		...events.flatMap((event) => eventLines(event, host, generatedAt)),
		...[...uniqueCancellations.values()].flatMap((item) => cancellationLines(item, host, generatedAt)),
		"END:VCALENDAR",
	];
	return `${lines.flatMap(foldLine).join("\r\n")}\r\n`;
}

const utf8Encoder = new TextEncoder();

function eventLines(event: EventRecord, host: string, generatedAt: Date): string[] {
	const modifiedAt = parseDate(event.updatedAt) ?? generatedAt;
	return [
		"BEGIN:VEVENT",
		`UID:${eventUid(event.id, host)}`,
		`DTSTAMP:${formatUtc(generatedAt)}`,
		`LAST-MODIFIED:${formatUtc(modifiedAt)}`,
		`SEQUENCE:${Math.max(0, modifiedAt.getTime())}`,
		"STATUS:CONFIRMED",
		`SUMMARY:${escapeText(event.title)}`,
		...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
		...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
		...(event.externalUrl && safeHttpUrl(event.externalUrl) ? [`URL:${safeHttpUrl(event.externalUrl)}`] : []),
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
		`UID:${eventUid(item.id, host)}`,
		`DTSTAMP:${formatUtc(generatedAt)}`,
		`LAST-MODIFIED:${formatUtc(modifiedAt)}`,
		`SEQUENCE:${Math.max(0, modifiedAt.getTime())}`,
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
		? [`DTSTART:${formatUtc(startDate)}`, `DTEND:${formatUtc(endDate)}`]
		: [];
}

function eventUid(id: string, host: string): string {
	const safeHost = host.trim().replace(/[^a-zA-Z0-9.-]/g, "-").toLowerCase() || "eventual.invalid";
	return `${encodeURIComponent(id)}@${safeHost}`;
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
