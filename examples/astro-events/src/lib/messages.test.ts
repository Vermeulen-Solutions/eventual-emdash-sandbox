import { describe, expect, it } from "vitest";
import { messagesForLocale } from "./messages";

describe("event browser copy", () => {
	it("selects localized labels by language and falls back to English", () => {
		expect(messagesForLocale("nl-NL").listView).toBe("Lijst");
		expect(messagesForLocale("fr-CA").monthView).toBe("Mois");
		expect(messagesForLocale("de-DE").listView).toBe("List");
	});

	it("formats event counts for supported languages", () => {
		expect(messagesForLocale("en-GB").eventCount(1)).toBe("1 event");
		expect(messagesForLocale("en-GB").eventCount(4)).toBe("4 events");
		expect(messagesForLocale("nl-NL").eventCount(2)).toBe("2 evenementen");
		expect(messagesForLocale("fr-FR").eventCount(2)).toBe("2 événements");
	});

	it("localizes the skip link with the rest of the visitor-facing copy", () => {
		expect(messagesForLocale("en-GB").skipToContent).toBe("Skip to event content");
		expect(messagesForLocale("nl-NL").skipToContent).toBe("Ga naar de evenementen");
		expect(messagesForLocale("fr-FR").skipToContent).toBe("Aller au contenu des événements");
	});
});
