import { describe, expect, it } from "vitest";
import {
	expandEventOccurrences,
	nativeEntryToEventRecord,
	eventRecordToPublicEvent,
} from "../src/domain/event-expansion";

describe("nativeEntryToEventRecord", () => {
  it("reads friendly categories and older JSON arrays without losing filter labels", () => {
    const entry = {id:"categories",status:"published",type:"events",data:{title:"Meeting",start:"2026-10-10T14:00:00Z",end:"2026-10-10T16:00:00Z",all_day:false,timezone:"UTC",categories:" Music, Community, music "}};
    expect(nativeEntryToEventRecord(entry)?.categories).toEqual(["Music","Community"]);
    entry.data.categories = '["Music","Community"]';
    expect(nativeEntryToEventRecord(entry)?.categories).toEqual(["Music","Community"]);
    entry.data.categories = '["Music",7]';
    expect(nativeEntryToEventRecord(entry)).toBeNull();
  });
	it("converts a native EmDash content entry into an EventRecord", () => {
		const nativeEntry = {
			id: "match-servette",
			data: {
				id: "01M3MATCH01",
				slug: "match-servette",
				title: "Match vs Servette HC",
				description: [
					{
						_type: "block",
						style: "normal",
						children: [{ text: "Championnat suisse de hockey sur gazon." }],
					},
				],
				start: "2026-10-10T14:00:00.000Z",
				end: "2026-10-10T16:00:00.000Z",
				all_day: false,
				timezone: "Europe/Zurich",
				status: "published",
				venue: "venue_richemont",
				categories: ["Championnat", "LNA"],
			},
		};

		const record = nativeEntryToEventRecord(nativeEntry);
		expect(record).not.toBeNull();
		expect(record?.id).toBe("01M3MATCH01");
		expect(record?.title).toBe("Match vs Servette HC");
		expect(record?.start).toBe("2026-10-10T14:00:00.000Z");
		expect(record?.venueId).toBe("venue_richemont");
		expect(record?.published).toBe(true);
		expect(record?.categories).toEqual(["Championnat", "LNA"]);
	});
});

describe("expandEventOccurrences", () => {
	it("expands a recurring weekly event into individual occurrences within the window", () => {
		const nativeEntries = [
			{
				id: "initiation-hockey",
				data: {
					id: "rec_event_1",
					title: "Initiation Hockey",
					start: "2026-10-07T14:00:00.000Z", // Wednesday
					end: "2026-10-07T16:00:00.000Z",
					timezone: "Europe/Zurich",
					all_day: false,
					status: "published",
					recurrence: {
						frequency: "weekly",
						until: "2026-10-28",
						weekdays: ["wednesday"],
					},
					venue: "venue_1",
				},
			},
		];

		const venues = [
			{
				id: "venue_1",
				name: "Stade de Richemont",
				street: "Route de Frontenex 70",
				locality: "Genève",
				postal_code: "1208",
				country: "Switzerland",
			},
		];

		const occurrences = expandEventOccurrences(nativeEntries, {
			from: "2026-10-01",
			through: "2026-10-31",
			venues,
		});

		// Oct 7, Oct 14, Oct 21, Oct 28 -> 4 occurrences
		expect(occurrences).toHaveLength(4);
		expect(occurrences[0]!.title).toBe("Initiation Hockey");
		expect(occurrences[0]!.venue?.name).toBe("Stade de Richemont");
		expect(occurrences[0]!.venue?.address).toContain("Route de Frontenex 70");
		expect(occurrences[0]!.id).toContain("rec_event_1#");
	});

	it("respects cancelled exceptions", () => {
		const nativeEntries = [
			{
				id: "weekly-training",
				data: {
					id: "training_1",
					title: "Weekly Training",
					start: "2026-10-07T14:00:00.000Z",
					end: "2026-10-07T16:00:00.000Z",
					timezone: "UTC",
					all_day: false,
					status: "published",
					recurrence: {
						frequency: "weekly",
						until: "2026-10-21",
					},
					// Cancel the Oct 14 session
					exceptions: [
						{
							recurrenceId: "2026-10-14T14:00",
							status: "cancelled",
						},
					],
				},
			},
		];

		const occurrences = expandEventOccurrences(nativeEntries, {
			from: "2026-10-01",
			through: "2026-10-31",
		});

		// Oct 7 and Oct 21 (Oct 14 is cancelled) -> 2 occurrences
		expect(occurrences).toHaveLength(2);
		expect(occurrences.map((o) => o.start.slice(0, 10))).toEqual(["2026-10-07", "2026-10-21"]);
	});

	it("filters out unpublished draft events", () => {
		const nativeEntries = [
			{
				id: "draft-event",
				data: {
					id: "draft_1",
					title: "Draft Tournament",
					start: "2026-10-15T10:00:00.000Z",
					end: "2026-10-15T12:00:00.000Z",
					status: "draft",
					published: false,
				},
			},
		];

		const occurrences = expandEventOccurrences(nativeEntries, {
			from: "2026-10-01",
			through: "2026-10-31",
		});

		expect(occurrences).toHaveLength(0);
	});

	it("hydrates featured media to publicEventImage endpoint", () => {
		const entry = {
			id: "evt-with-image",
			data: {
				id: "evt-with-image",
				title: "Event With Poster",
				start: "2026-10-15T10:00:00.000Z",
				end: "2026-10-15T12:00:00.000Z",
				all_day: false,
				timezone: "UTC",
				status: "published",
				featured_image: { id: "media_poster_123" },
			},
		};
		const record = nativeEntryToEventRecord(entry);
		expect(record).not.toBeNull();
		expect(record?.featuredMediaId).toBe("media_poster_123");
		expect(record?.imageMediaId).toBe("media_poster_123");

		const publicEvent = eventRecordToPublicEvent(record!, undefined, "https://example.com");
		expect(publicEvent.imageUrl).toBe(
			"https://example.com/_emdash/api/plugins/eventual/publicEventImage?eventId=evt-with-image",
		);

		const relativeEvent = eventRecordToPublicEvent(record!);
		expect(relativeEvent.imageUrl).toBe(
			"/_emdash/api/plugins/eventual/publicEventImage?eventId=evt-with-image",
		);
	});
});

