export interface DateValidationError {
  start?: string;
  end?: string;
  timezone?: string;
}

export interface NormalizedDates {
  start: string;
  end: string;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function daysInMonth(year: number, month: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month, 0);
  return date.getUTCDate();
}

function parseDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day, hour: 0, minute: 0 };
}

function parseWallDateTime(value: string): DateParts | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  const date = match ? parseDate(match[1]!) : null;
  if (!date || !match) return null;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23 || minute > 59) return null;
  return { ...date, hour, minute };
}

function partsInZone(instant: Date, timezone: string): DateParts | null {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const result = {
      year: get("year"),
      month: get("month"),
      day: get("day"),
      hour: get("hour"),
      minute: get("minute"),
    };
    return Object.values(result).every(Number.isFinite) ? result : null;
  } catch {
    return null;
  }
}

function utcEpoch(parts: DateParts): number {
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCHours(parts.hour, parts.minute, 0, 0);
  return date.getTime();
}

function sameParts(left: DateParts, right: DateParts): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function isDateOnly(value: string): boolean {
  return parseDate(value) !== null;
}

export function isValidTimeZone(timezone: string): boolean {
  if (!timezone.trim()) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Converts a local wall-clock value to an ISO instant in an IANA timezone. */
export function localDateTimeToInstant(
	value: string,
	timezone: string,
): { value?: string; error?: string } {
  const desired = parseWallDateTime(value);
  if (!desired) return { error: "Enter a valid date and time." };
  if (!isValidTimeZone(timezone)) {
    return { error: "Enter a valid IANA timezone, such as Europe/Paris." };
  }

	const wantedEpoch = utcEpoch(desired);
	const possibleInstants = new Set<number>();
	let timezoneWorked = false;
	// Sampling on both sides of a transition discovers either valid offset in a
	// repeated wall-clock hour. Choosing the earliest exact match preserves
	// Eventual's fall-back rule without treating clock-gap times as valid.
	for (let hours = -36; hours <= 36; hours += 3) {
		const probe = wantedEpoch + hours * 3_600_000;
		const actual = partsInZone(new Date(probe), timezone);
		if (!actual) continue;
		timezoneWorked = true;
		const offset = utcEpoch(actual) - probe;
		const candidate = wantedEpoch - offset;
		const candidateParts = partsInZone(new Date(candidate), timezone);
		if (candidateParts && sameParts(candidateParts, desired)) possibleInstants.add(candidate);
	}
	if (!timezoneWorked) {
		return { error: "The selected timezone could not be applied." };
	}
	if (possibleInstants.size) {
		return { value: new Date(Math.min(...possibleInstants)).toISOString() };
	}
	{
		return {
			error: "That local time does not exist because of a daylight-saving change.",
		};
	}
}

export function instantToLocalDateTime(value: string, timezone: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime()) || !isValidTimeZone(timezone)) return "";
  const parts = partsInZone(instant, timezone);
  if (!parts) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function calendarDateKey(
  value: string,
  allDay: boolean,
  timezone: string,
): string {
  if (allDay) return isDateOnly(value) ? value : "";
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = partsInZone(instant, isValidTimeZone(timezone) ? timezone : "UTC");
  if (!parts) return "";
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function normalizeEventDates(input: {
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
}): { dates?: NormalizedDates; errors: DateValidationError } {
  const errors: DateValidationError = {};
  if (input.allDay) {
    if (!isDateOnly(input.start)) errors.start = "Choose a valid start date.";
    if (!isDateOnly(input.end)) errors.end = "Choose a valid end date.";
    if (!errors.start && !errors.end && input.end < input.start) {
      errors.end = "The end date must be the same as or after the start date.";
    }
    return Object.keys(errors).length
      ? { errors }
      : { dates: { start: input.start, end: input.end }, errors };
  }

  if (!isValidTimeZone(input.timezone)) {
    errors.timezone = "Enter a valid IANA timezone, such as Europe/Paris.";
    return { errors };
  }
  const start = localDateTimeToInstant(input.start, input.timezone);
  const end = localDateTimeToInstant(input.end, input.timezone);
  if (!start.value) errors.start = start.error;
  if (!end.value) errors.end = end.error;
  if (start.value && end.value && Date.parse(end.value) < Date.parse(start.value)) {
    errors.end = "The end must be the same as or after the start.";
  }
  return Object.keys(errors).length
    ? { errors }
    : { dates: { start: start.value!, end: end.value! }, errors };
}
