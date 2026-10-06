import { describe, expect, it } from "vitest";
import { eventToJsonLd, serializeJsonLd } from "../astro/schema";
import type { PublicEvent } from "../astro/feed";

describe("Schema.org JSON-LD generation", () => {
	const baseEvent: PublicEvent = {
		id: "event-1",
		title: "Annual Tech Conference",
		description: "A great tech conference with inspiring talks.",
		start: "2026-10-15T09:00:00.000Z",
		end: "2026-10-15T17:00:00.000Z",
		allDay: false,
		timezone: "Europe/Amsterdam",
		location: "Hall A, Main Center",
		locationType: "physical",
		organizer: "Tech Foundation",
		externalUrl: "https://example.com/conference",
		imageUrl: "https://example.com/banner.png",
		categories: ["tech", "conference"],
		venue: {
			id: "venue-1",
			name: "Main Center",
			address: "10 Innovation Way, Amsterdam",
		},
		directionsUrl: "https://maps.google.com/?q=Main+Center",
	};

	it("generates valid Schema.org Event for physical events", () => {
		const jsonLd = eventToJsonLd(baseEvent);
		expect(jsonLd).toEqual({
			"@context": "https://schema.org",
			"@type": "Event",
			name: "Annual Tech Conference",
			description: "A great tech conference with inspiring talks.",
			startDate: "2026-10-15T09:00:00.000Z",
			endDate: "2026-10-15T17:00:00.000Z",
			eventStatus: "https://schema.org/EventScheduled",
			eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
			location: {
				"@type": "Place",
				name: "Main Center",
				address: "10 Innovation Way, Amsterdam",
			},
			organizer: {
				"@type": "Organization",
				name: "Tech Foundation",
			},
			url: "https://example.com/conference",
			image: "https://example.com/banner.png",
		});
	});

	it("generates VirtualLocation and OnlineEventAttendanceMode for virtual events", () => {
		const virtualEvent: PublicEvent = {
			...baseEvent,
			locationType: "virtual",
			virtualUrl: "https://meet.jit.si/annual-tech",
			venue: null,
		};
		const jsonLd = eventToJsonLd(virtualEvent);
		expect(jsonLd["eventAttendanceMode"]).toBe("https://schema.org/OnlineEventAttendanceMode");
		expect(jsonLd["location"]).toEqual({
			"@type": "VirtualLocation",
			url: "https://meet.jit.si/annual-tech",
		});
	});

	it("generates MixedEventAttendanceMode for hybrid events", () => {
		const hybridEvent: PublicEvent = {
			...baseEvent,
			locationType: "hybrid",
			virtualUrl: "https://stream.example.com/live",
		};
		const jsonLd = eventToJsonLd(hybridEvent);
		expect(jsonLd["eventAttendanceMode"]).toBe("https://schema.org/MixedEventAttendanceMode");
		expect(jsonLd["location"]).toEqual([{
			"@type": "Place",
			name: "Main Center",
			address: "10 Innovation Way, Amsterdam",
		}, { "@type": "VirtualLocation", url: hybridEvent.virtualUrl }]);
	});

	it("maps cancelled, postponed, and rescheduled statuses to Schema.org statuses", () => {
		expect(eventToJsonLd({ ...baseEvent, status: "cancelled" })["eventStatus"])
			.toBe("https://schema.org/EventCancelled");
		expect(eventToJsonLd({ ...baseEvent, status: "postponed" })["eventStatus"])
			.toBe("https://schema.org/EventPostponed");
		expect(eventToJsonLd({ ...baseEvent, status: "rescheduled" })["eventStatus"])
			.toBe("https://schema.org/EventRescheduled");
		expect(eventToJsonLd({ ...baseEvent, status: "published" })["eventStatus"])
			.toBe("https://schema.org/EventScheduled");
	});

	it("omits empty optional fields cleanly", () => {
		const minimalEvent: PublicEvent = {
			id: "min-1",
			title: "Quick Chat",
			description: "",
			start: "2026-10-15T10:00:00.000Z",
			end: "2026-10-15T10:30:00.000Z",
			allDay: false,
			timezone: "UTC",
			location: "",
			organizer: "",
			externalUrl: "",
			imageUrl: "",
			categories: [],
			venue: null,
			directionsUrl: "",
		};
		const jsonLd = eventToJsonLd(minimalEvent);
		expect(jsonLd).toEqual({
			"@context": "https://schema.org",
			"@type": "Event",
			name: "Quick Chat",
			startDate: "2026-10-15T10:00:00.000Z",
			endDate: "2026-10-15T10:30:00.000Z",
			eventStatus: "https://schema.org/EventScheduled",
			eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
		});
		expect(jsonLd).not.toHaveProperty("location");
		expect(jsonLd).not.toHaveProperty("organizer");
		expect(jsonLd).not.toHaveProperty("image");
		expect(jsonLd).not.toHaveProperty("url");
	});

	it("converts Portable Text description into plain text for Schema.org", () => {
		const ptEvent: PublicEvent = {
			...baseEvent,
			description: JSON.stringify([
				{
					_type: "block",
					style: "normal",
					children: [{ text: "Session details with " }, { text: "Link", marks: ["l1"] }],
					markDefs: [{ _key: "l1", _type: "link", href: "https://example.com" }],
				},
			]),
		};
		const jsonLd = eventToJsonLd(ptEvent);
		expect(jsonLd["description"]).toBe("Session details with Link (https://example.com)");
	});
	it('preserves already extracted literal text in JSON-LD',()=>{
		const description='Keep **literal notation** and <a> symbols.';
		expect(eventToJsonLd({...baseEvent,description}).description).toBe(description);
		expect(eventToJsonLd({...baseEvent,description:'["Literal JSON example"]'}).description).toBe('["Literal JSON example"]');
	});
});
