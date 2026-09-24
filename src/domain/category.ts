/** Normalize category labels while retaining the first label's display casing. */
export function normalizeCategories(values: string | string[]): string[] {
	const labels = typeof values === "string" ? values.split(/[,\r\n]+/) : values;
	const result: string[] = [];
	const seen = new Set<string>();
	for (const value of labels) {
		const label = value.trim().replace(/\s+/g, " ");
		if (!label) continue;
		const key = label.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(label);
	}
	return result;
}

/** Match category filters independent of outer spacing and letter case. */
export function categoryKey(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}
