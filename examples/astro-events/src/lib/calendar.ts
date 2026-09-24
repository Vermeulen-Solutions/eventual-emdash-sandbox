import type { PublicEvent } from "./feed";

const SUNDAY_FIRST_REGIONS = new Set(["US", "CA", "JP", "KR", "TW", "IL", "SA", "PH"]);

export interface CalendarCell {
	date: string;
	inMonth: boolean;
	dayNumber: number;
	events: PublicEvent[];
}

export function normalizeLocale(value: string): string {
	try {
		return Intl.getCanonicalLocales(value)[0] ?? "en-GB";
	} catch {
		return "en-GB";
	}
}

export function normalizeTimeZone(value: string): string {
	try {
		new Intl.DateTimeFormat("en", { timeZone: value });
		return value;
	} catch {
		return "UTC";
	}
}

export function isMonthKey(value: string | null): value is string {
	return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1000);
}

export function addMonths(value: string, amount: number): string {
	const [year, month] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year!, month! - 1 + amount, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calendarRange(month: string, locale: string): { from: string; through: string } {
	const [year, monthNumber] = month.split("-").map(Number);
	const first = new Date(Date.UTC(year!, monthNumber! - 1, 1));
	const last = new Date(Date.UTC(year!, monthNumber!, 0));
	const offset = (first.getUTCDay() - firstDayOfWeek(locale) + 7) % 7;
	const from = new Date(Date.UTC(year!, monthNumber! - 1, 1 - offset));
	const cells = Math.ceil((offset + last.getUTCDate()) / 7) * 7;
	const through = new Date(from);
	through.setUTCDate(through.getUTCDate() + cells - 1);
	return { from: dateKey(from), through: dateKey(through) };
}

export function monthDateRange(month: string): { from: string; through: string } {
	const [year, monthNumber] = month.split("-").map(Number);
	const last = new Date(Date.UTC(year!, monthNumber!, 0));
	return {
		from: `${month}-01`,
		through: `${month}-${String(last.getUTCDate()).padStart(2, "0")}`,
	};
}

export function firstDayOfWeek(locale: string): number {
	try {
		const localeObject = new Intl.Locale(locale) as Intl.Locale & {
			getWeekInfo?: () => { firstDay: number };
			weekInfo?: { firstDay: number };
		};
		const firstDay = localeObject.getWeekInfo?.().firstDay ?? localeObject.weekInfo?.firstDay;
		if (firstDay && firstDay >= 1 && firstDay <= 7) return firstDay % 7;
		const region = localeObject.region?.toUpperCase();
		if (region && SUNDAY_FIRST_REGIONS.has(region)) return 0;
	} catch {
		// Invalid locales use the documented Monday-first fallback.
	}
	return 1;
}

export function weekdayHeadings(locale: string): string[] {
	const first = firstDayOfWeek(locale);
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(Date.UTC(2023, 0, 1 + first + index));
		return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date);
	});
}

export function fullWeekdayHeadings(locale: string): string[] {
	const first = firstDayOfWeek(locale);
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(Date.UTC(2023, 0, 1 + first + index));
		return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
	});
}

export function buildCalendar(month: string, locale: string, events: PublicEvent[]): CalendarCell[][] {
	const range = calendarRange(month, locale);
	const [year, monthNumber] = month.split("-").map(Number);
	const first = new Date(`${range.from}T00:00:00Z`);
	const last = new Date(`${range.through}T00:00:00Z`);
	const days = Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
	const cells: CalendarCell[] = [];
	for (let index = 0; index < days; index += 1) {
		const date = new Date(first);
		date.setUTCDate(first.getUTCDate() + index);
		const key = dateKey(date);
		cells.push({
			date: key,
			inMonth: date.getUTCMonth() === monthNumber! - 1 && date.getUTCFullYear() === year,
			dayNumber: date.getUTCDate(),
			events: events.filter((event) => eventTouchesDate(event, key)),
		});
	}
	const weeks: CalendarCell[][] = [];
	for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
	return weeks;
}

export function eventTouchesDate(event: PublicEvent, date: string): boolean {
	const start = event.allDay ? event.start.slice(0, 10) : localDate(event.start, event.timezone);
	const end = event.allDay ? event.end.slice(0, 10) : localDate(event.end, event.timezone);
	return Boolean(start && end && start <= date && end >= date);
}

export function displayDate(value: string, locale: string, timeZone: string, allDay: boolean): string {
	const date = allDay ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : new Date(value);
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: allDay ? "UTC" : timeZone,
	}).format(date);
}

export function eventTimeRange(event: PublicEvent, locale: string): string {
	if (event.allDay) return "";
	const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: event.timezone });
	const timeZoneName = new Intl.DateTimeFormat(locale, { timeZone: event.timezone, timeZoneName: "short" });
	const start = new Date(event.start);
	const end = new Date(event.end);
	const zoneName = (date: Date) => timeZoneName.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? event.timezone;
	const startZone = zoneName(start);
	const endZone = zoneName(end);
	return startZone === endZone
		? `${time.format(start)}–${time.format(end)} ${startZone}`
		: `${time.format(start)} ${startZone}–${time.format(end)} ${endZone}`;
}

export function eventStartDate(event: PublicEvent): string {
	return event.allDay ? event.start.slice(0, 10) : localDate(event.start, event.timezone);
}

export function eventEndDate(event: PublicEvent): string {
	return event.allDay ? event.end.slice(0, 10) : localDate(event.end, event.timezone);
}

export function eventDetailsUrl(event: PublicEvent, originPath = "/events", extension = ""): string {
	const url = new URL(`${originPath.replace(/\/$/, "")}/${encodeURIComponent(event.id)}${extension}`, "https://eventual.invalid");
	url.searchParams.set("from", eventStartDate(event));
	url.searchParams.set("through", eventEndDate(event));
	return `${url.pathname}${url.search}`;
}

export function addCalendarDay(value: string): string {
	const date = new Date(`${value}T00:00:00Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime())) return "";
	date.setUTCDate(date.getUTCDate() + 1);
	return dateKey(date);
}

export function formatICalendar(event: PublicEvent, siteHost: string, generatedAt = new Date()): string {
	const modifiedAt = event.updatedAt && Number.isFinite(Date.parse(event.updatedAt))
		? new Date(event.updatedAt)
		: undefined;
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Eventual//Event export//EN",
		"CALSCALE:GREGORIAN",
		`X-EVENTUAL-TIMEZONE:${escapeICalendarText(event.timezone)}`,
		"BEGIN:VEVENT",
		`UID:${escapeICalendarText(event.id)}@${escapeICalendarText(siteHost)}`,
		`DTSTAMP:${formatUtcDateTime(generatedAt)}`,
		...(modifiedAt ? [`LAST-MODIFIED:${formatUtcDateTime(modifiedAt)}`, `SEQUENCE:${modifiedAt.getTime()}`] : []),
		`SUMMARY:${escapeICalendarText(event.title)}`,
		...(event.description ? [`DESCRIPTION:${escapeICalendarText(event.description)}`] : []),
		...(event.location ? [`LOCATION:${escapeICalendarText(event.location)}`] : []),
		...(safeHttpUrl(event.externalUrl) ? [`URL:${safeHttpUrl(event.externalUrl)}`] : []),
		...(event.allDay
			? [`DTSTART;VALUE=DATE:${event.start.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${addCalendarDay(event.end).replaceAll("-", "")}`]
			: [`DTSTART:${formatUtcDateTime(new Date(event.start))}`, `DTEND:${formatUtcDateTime(new Date(event.end))}`]),
		"END:VEVENT",
		"END:VCALENDAR",
	];
	return `${lines.flatMap(foldICalendarLine).join("\r\n")}\r\n`;
}

export function monthLabel(month: string, locale: string): string {
	const [year, monthNumber] = month.split("-").map(Number);
	return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
		.format(new Date(Date.UTC(year!, monthNumber! - 1, 1)));
}

export function safeHttpUrl(value: string, base?: string): string {
	if (!value.trim()) return "";
	try {
		const url = base ? new URL(value, base) : new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
	} catch {
		return "";
	}
}

export function safeImageUrl(value: string, base: string): string {
	try {
		const url = new URL(value, base);
		const site = new URL(base);
		if (url.protocol === "https:") return url.href;
		if (url.protocol === "http:" && site.protocol === "http:" && url.origin === site.origin) return url.href;
		return "";
	} catch {
		return "";
	}
}

function localDate(instant: string, timezone: string): string {
	const date = new Date(instant);
	if (!Number.isFinite(date.getTime())) return "";
	try {
		const parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			calendar: "gregory",
			numberingSystem: "latn",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(date);
		const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
		return `${part("year")}-${part("month")}-${part("day")}`;
	} catch {
		return "";
	}
}

function dateKey(date: Date): string {
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function escapeICalendarText(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatUtcDateTime(date: Date): string {
	return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldICalendarLine(line: string): string[] {
	const folded: string[] = [];
	let current = "";
	let bytes = 0;
	for (const character of line) {
		const size = new TextEncoder().encode(character).length;
		if (bytes + size > 75) {
			folded.push(current);
			current = " ";
			bytes = 1;
		}
		current += character;
		bytes += size;
	}
	folded.push(current);
	return folded;
}
