export const TIME_ENTRY_HELP = "Use 24-hour time (18:30) or 12-hour time (6:30 PM).";

/** Converts common administrator-entered clock values to canonical HH:mm. */
export function normalizeTimeEntry(value: string): { time: string } | { error: string } {
	const input = value.trim();
	const twentyFourHour = /^(\d{1,2}):([0-5]\d)$/.exec(input);
	if (twentyFourHour) {
		const hour = Number(twentyFourHour[1]);
		if (hour <= 23) return { time: `${String(hour).padStart(2, "0")}:${twentyFourHour[2]}` };
	}

	const twelveHour = /^(\d{1,2})(?::([0-5]\d))?\s*([ap])\.?m\.?$/i.exec(input);
	if (twelveHour) {
		const enteredHour = Number(twelveHour[1]);
		if (enteredHour >= 1 && enteredHour <= 12) {
			const meridiem = twelveHour[3]!.toLowerCase();
			const hour = (enteredHour % 12) + (meridiem === "p" ? 12 : 0);
			return { time: `${String(hour).padStart(2, "0")}:${twelveHour[2] ?? "00"}` };
		}
	}

	return { error: TIME_ENTRY_HELP };
}
