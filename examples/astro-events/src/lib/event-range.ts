export interface EventRange {
	from: string;
	through: string;
}

export function eventRange(searchParams: URLSearchParams, now = new Date()): EventRange | null {
	const from = searchParams.get("from") ?? now.toISOString().slice(0, 10);
	const through = searchParams.get("through") ?? addDays(from, 365);
	if (!isDateOnly(from) || !isDateOnly(through) || from > through) return null;
	const span = (Date.parse(`${through}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
	return Number.isInteger(span) && span < 366 ? { from, through } : null;
}

function isDateOnly(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(value: string, amount: number): string {
	const date = new Date(`${value}T00:00:00Z`);
	if (!isDateOnly(value)) return "";
	date.setUTCDate(date.getUTCDate() + amount);
	return date.toISOString().slice(0, 10);
}
