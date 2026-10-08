import { describe, it, expect, vi } from "vitest";
import { handleCalendarFeed, filterAndDeduplicateEvents } from "../src/routes/calendar-feed";
import { formatCalendarFeed, eventUid } from "../src/domain/icalendar";
import type { EventRecord } from "../src/domain/event";
import type { EventualContext, CalendarCancellation } from "../src/storage";
import {memoryKv} from './native-test-helpers';
import {createEventsCollectionBlueprint} from '../src/schema/blueprint';

describe("Milestone 3: Multilingual Calendar Feeds & iCalendar", () => {
	describe("eventUid - cross-locale stable UIDs", () => {
		it("generates identical UIDs for French and English siblings of a non-recurring event", () => {
			const frEvent = { id: "evt-fr-1", translationGroup: "tg-concert" };
			const enEvent = { id: "evt-en-1", translationGroup: "tg-concert" };
			const host = "calendar.example.org";

			const frUid = eventUid(frEvent, host);
			const enUid = eventUid(enEvent, host);

			expect(frUid).toBe(enUid);
			expect(frUid).toBe("eventual-tg-concert@calendar.example.org");
		});

		it("generates identical UIDs for French and English occurrences of a recurring event", () => {
			const frOccurrence = { id: "evt-fr-1#2026-10-15T18:00", translationGroup: "tg-concert" };
			const enOccurrence = { id: "evt-en-1#2026-10-15T18:00", translationGroup: "tg-concert" };
			const host = "calendar.example.org";

			const frUid = eventUid(frOccurrence, host);
			const enUid = eventUid(enOccurrence, host);

			expect(frUid).toBe(enUid);
			expect(frUid).toBe("eventual-tg-concert%232026-10-15T18%3A00@calendar.example.org");
		});

		it("preserves legacy UID behavior for events without translationGroup", () => {
			const legacyEvent = { id: "legacy-event-123#2026-10-15T18:00" };
			const host = "calendar.example.org";

			const uid = eventUid(legacyEvent, host);
			expect(uid).toBe("legacy-event-123%232026-10-15T18%3A00@calendar.example.org");
		});

		it("resolves stable UIDs for cancellation tombstones", () => {
			const cancellation: CalendarCancellation = {
				id: "cancellation_evt-fr-1",
				eventId: "evt-fr-1",
				start: "2026-10-15T18:00:00.000Z",
				end: "2026-10-15T20:00:00.000Z",
				allDay: false,
				timezone: "Europe/Paris",
				cancelledAt: "2026-10-06T12:00:00.000Z",
				translationGroup: "tg-concert",
			};
			const host = "calendar.example.org";

			const uid = eventUid(cancellation, host);
			expect(uid).toBe("eventual-tg-concert@calendar.example.org");
		});
	});

	describe("filterAndDeduplicateEvents - locale filtering & untranslated fallbacks", () => {
		const bilingualFr: EventRecord = {
			id: "evt-1-fr",
			translationGroup: "tg-jazz",
			locale: "fr",
			title: "Concert de Jazz",
			description: "Une soirée musicale formidable.",
			start: "2026-10-15T19:00:00.000Z",
			end: "2026-10-15T21:00:00.000Z",
			allDay: false,
			timezone: "Europe/Paris",
			location: "Salle Pleyel",
			organizer: "Club Jazz",
			externalUrl: "",
			imageUrl: "",
			categories: ["music"],
			published: true,
			status: "published",
			exceptions: [],
			createdAt: "2026-10-01T00:00:00.000Z",
			updatedAt: "2026-10-01T00:00:00.000Z",
		};

		const bilingualEn: EventRecord = {
			...bilingualFr,
			id: "evt-1-en",
			locale: "en",
			title: "Jazz Concert",
			description: "A wonderful evening of live music.",
		};

		const enOnlyEvent: EventRecord = {
			id: "evt-2-en",
			translationGroup: "tg-board",
			locale: "en",
			title: "Annual General Meeting",
			description: "Members only meeting.",
			start: "2026-10-20T10:00:00.000Z",
			end: "2026-10-20T12:00:00.000Z",
			allDay: false,
			timezone: "Europe/Paris",
			location: "Main Hall",
			organizer: "Board",
			externalUrl: "",
			imageUrl: "",
			categories: ["business"],
			published: true,
			status: "published",
			exceptions: [],
			createdAt: "2026-10-01T00:00:00.000Z",
			updatedAt: "2026-10-01T00:00:00.000Z",
		};

		const allEvents = [bilingualFr, bilingualEn, enOnlyEvent];

		it("filters to requested locale with untranslated fallback prefixed with [EN] in default mode", () => {
			const result = filterAndDeduplicateEvents(allEvents, { locale: "fr", strict: false });

			expect(result).toHaveLength(2);
			// 1. Translated French event
			const frItem = result.find((e) => e.translationGroup === "tg-jazz");
			expect(frItem).toBeDefined();
			expect(frItem?.title).toBe("Concert de Jazz");
			expect(frItem?.locale).toBe("fr");

			// 2. Untranslated fallback event with [EN] tag
			const fallbackItem = result.find((e) => e.translationGroup === "tg-board");
			expect(fallbackItem).toBeDefined();
			expect(fallbackItem?.title).toBe("[EN] Annual General Meeting");
		});

		it("strictly excludes untranslated events when strict=true", () => {
			const result = filterAndDeduplicateEvents(allEvents, { locale: "fr", strict: true });

			expect(result).toHaveLength(1);
			expect(result[0]!.title).toBe("Concert de Jazz");
			expect(result[0]!.translationGroup).toBe("tg-jazz");
		});

		it("filters English feed cleanly without tagging English events", () => {
			const result = filterAndDeduplicateEvents(allEvents, { locale: "en", strict: false });

			expect(result).toHaveLength(2);
			const jazz = result.find((e) => e.translationGroup === "tg-jazz");
			const board = result.find((e) => e.translationGroup === "tg-board");

			expect(jazz?.title).toBe("Jazz Concert");
			expect(board?.title).toBe("Annual General Meeting");
		});

		it("deduplicates multiple siblings by translationGroup when no locale is requested", () => {
			const result = filterAndDeduplicateEvents(allEvents, {});

			expect(result).toHaveLength(2);
			const groups = result.map((e) => e.translationGroup);
			expect(groups).toContain("tg-jazz");
			expect(groups).toContain("tg-board");
		});
	});

	describe("formatCalendarFeed - Portable Text & RFC 5545 compliance", () => {
		it("serializes Portable Text descriptions to clean plain text in DESCRIPTION line", () => {
			const ptDescription = [
				{
					_type: "block",
					children: [
						{ _type: "span", text: "Join us for our annual gala." },
					],
					markDefs: [],
					style: "normal",
				},
				{
					_type: "block",
					children: [
						{ _type: "span", text: "Reserve tickets online", marks: ["link1"] },
					],
					markDefs: [
						{ _key: "link1", _type: "link", href: "https://example.org/tickets" },
					],
					style: "normal",
				},
			];

			const event: EventRecord = {
				id: "evt-gala",
				translationGroup: "tg-gala",
				locale: "en",
				title: "Annual Gala",
				description: JSON.stringify(ptDescription),
				start: "2026-11-05T19:00:00.000Z",
				end: "2026-11-05T23:00:00.000Z",
				allDay: false,
				timezone: "UTC",
				location: "Grand Ballroom",
				organizer: "Foundation",
				externalUrl: "",
				imageUrl: "",
				categories: [],
				published: true,
				status: "published",
				exceptions: [],
				createdAt: "2026-10-01T00:00:00.000Z",
				updatedAt: "2026-10-01T00:00:00.000Z",
			};

			const ical = formatCalendarFeed([event], [], "example.org");

			expect(ical).toContain("BEGIN:VCALENDAR");
			expect(ical).toContain("BEGIN:VEVENT");
			expect(ical).toContain("SUMMARY:Annual Gala");
			expect(ical).toContain("UID:eventual-tg-gala@example.org");
			// Check unfolded description per RFC 5545 line folding
			const unfolded = ical.replace(/\r\n /g, "");
			expect(unfolded).toContain("DESCRIPTION:Join us for our annual gala.\\n\\nReserve tickets online (https://example.org/tickets)");
			expect(ical).not.toContain("_type");
			expect(ical).not.toContain("children");
		});
	});

	describe("handleCalendarFeed - end-to-end multi-locale feed generation", () => {
		it("serves localized feed from native content collections", async () => {
			const mockEvents = [
				{
					id: "event-fr",
					status: "published",
					locale: "fr",
					translationGroup: "tg-symposium",
					data: {
						title: "Symposium International",
						description: "Conférence scientifique annuelle.",
						start: "2026-11-10T09:00:00.000Z",
						end: "2026-11-10T17:00:00.000Z",
						all_day: false,
						timezone: "Europe/Paris",
						location_type: "physical",
						venue: "venue-1",
						published: true,
					},
				},
				{
					id: "event-en",
					status: "published",
					locale: "en",
					translationGroup: "tg-symposium",
					data: {
						title: "International Symposium",
						description: "Annual scientific conference.",
						start: "2026-11-10T09:00:00.000Z",
						end: "2026-11-10T17:00:00.000Z",
						all_day: false,
						timezone: "Europe/Paris",
						location_type: "physical",
						venue: "venue-1",
						published: true,
					},
				},
				{
					id: "event-workshop-en",
					status: "published",
					locale: "en",
					translationGroup: "tg-workshop",
					data: {
						title: "Hands-on Workshop",
						description: "Coding session.",
						start: "2026-11-12T14:00:00.000Z",
						end: "2026-11-12T16:00:00.000Z",
						all_day: false,
						timezone: "Europe/Paris",
						location_type: "physical",
						venue: "venue-1",
						published: true,
					},
				},
			];

			const mockVenues = [
				{
					id: "venue-1",
					status: 'published',
					data: {
						name: "Palais des Congrès",
						address: "Place de Bordeaux, Strasbourg",
					},
				},
			];

			const mockCtx = {
				kv:memoryKv(),site:{url:'https://mysite.com'},
				schema: {
					listCollections: vi.fn().mockResolvedValue([
						createEventsCollectionBlueprint(),
						{ slug: "venues" },
					]),
				},
				content: {
					get:vi.fn().mockResolvedValue(mockVenues[0]),
					list: vi.fn().mockImplementation((collection: string) => {
						if (collection === "events") return Promise.resolve({ items: mockEvents });
						if (collection === "venues") return Promise.resolve({ items: mockVenues });
						return Promise.resolve({ items: [] });
					}),
				},
				storage: {
					events: { query: vi.fn().mockResolvedValue({ items: [] }) },
					calendar_cancellations: { query: vi.fn().mockResolvedValue({ items: [] }) },
				},
			} as unknown as EventualContext;

			// 1. Fetch French feed (default fallback mode)
			const frFeed = await handleCalendarFeed(mockCtx, "mysite.com", { locale: "fr" });
			expect(frFeed).toContain("SUMMARY:Symposium International");
			expect(frFeed).toContain("SUMMARY:[EN] Hands-on Workshop");
			expect(frFeed).toContain("UID:eventual-tg-symposium@mysite.com");
			expect(frFeed).toContain("UID:eventual-tg-workshop@mysite.com");
			expect(frFeed).toContain("LOCATION:Palais des Congrès · Place de Bordeaux\\, Strasbourg");

			// 2. Fetch French feed with strict=true
			const strictFrFeed = await handleCalendarFeed({...mockCtx}, "mysite.com", { locale: "fr", strict: true });
			expect(strictFrFeed).toContain("SUMMARY:Symposium International");
			expect(strictFrFeed).not.toContain("Hands-on Workshop");

			// 3. Fetch English feed
			const enFeed = await handleCalendarFeed({...mockCtx}, "mysite.com", { locale: "en" });
			expect(enFeed).toContain("SUMMARY:International Symposium");
			expect(enFeed).toContain("SUMMARY:Hands-on Workshop");
			expect(enFeed).not.toContain("Symposium International");
			// Stable UID verification between FR and EN feeds!
			expect(enFeed).toContain("UID:eventual-tg-symposium@mysite.com");
		});
	});
});
