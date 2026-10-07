import { describe, expect, it } from "vitest";
import {
	createEventsCollectionBlueprint,
	createVenuesCollectionBlueprint,
	createOrganizersCollectionBlueprint,
} from "../src/schema/blueprint";
import { normalizeVenueRecord } from "../src/domain/venue-adapter";
import {validateSeed,type SeedFile} from 'emdash/seed';

describe("Schema Blueprints", () => {
	it('exports valid, typed EmDash seeds with scheduling support',()=>{
		const seed:SeedFile={version:'1',defaultLocale:'fr',collections:[createEventsCollectionBlueprint(),createVenuesCollectionBlueprint(),createOrganizersCollectionBlueprint()]};
		expect(validateSeed(seed)).toMatchObject({valid:true,errors:[]});
		expect(seed.collections?.[0]?.supports).toContain('scheduling');
	});
	it("creates events blueprint with non-translatable schedule invariants", () => {
		const blueprint = createEventsCollectionBlueprint();
		expect(blueprint.slug).toBe("events");

		const startField = blueprint.fields.find((f) => f.slug === "start");
		expect(startField?.translatable).toBe(false);
		expect(startField?.type).toBe("datetime");

		const recurrenceField = blueprint.fields.find((f) => f.slug === "recurrence");
		expect(recurrenceField?.translatable).toBe(false);
		expect(recurrenceField?.type).toBe("json");

		const exceptionsField = blueprint.fields.find((f) => f.slug === "exceptions");
		expect(exceptionsField?.translatable).toBe(false);

		const titleField = blueprint.fields.find((f) => f.slug === "title");
		expect(titleField?.translatable).toBe(true);

		const descField = blueprint.fields.find((f) => f.slug === "description");
		expect(descField?.translatable).toBe(true);
		expect(descField?.type).toBe("portableText");
	});

	it("supports custom venue collection slug (e.g. locations)", () => {
		const blueprint = createEventsCollectionBlueprint({ venueCollection: "locations" });
		const venueField = blueprint.fields.find((f) => f.slug === "venue");
		expect(venueField?.options?.collection).toBe("locations");
		expect(venueField?.validation?.relation).toBeUndefined();
	});

	it("binds relations when bindRelations: true is requested", () => {
		const blueprint = createEventsCollectionBlueprint({
			venueCollection: "locations",
			organizerCollection: "hosts",
			bindRelations: true,
		});
		const venueField = blueprint.fields.find((f) => f.slug === "venue");
		expect(venueField?.validation?.relation).toBe("events_venue");
		expect(venueField?.validation?.targetCollection).toBe("locations");
		const organizerField = blueprint.fields.find((f) => f.slug === "organizer_ref");
		expect(organizerField?.validation?.relation).toBe("events_organizer");
		expect(organizerField?.validation?.targetCollection).toBe("hosts");
	});

	it("creates venues blueprint with localized directions", () => {
		const blueprint = createVenuesCollectionBlueprint();
		expect(blueprint.slug).toBe("venues");

		const nameField = blueprint.fields.find((f) => f.slug === "name");
		expect(nameField?.translatable).toBe(false);

		const directionsField = blueprint.fields.find((f) => f.slug === "directions");
		expect(directionsField?.translatable).toBe(true);
		expect(directionsField?.type).toBe("portableText");
	});
});

describe("normalizeVenueRecord", () => {
	it("normalizes a standard venues record", () => {
		const normalized = normalizeVenueRecord({
			id: "v1",
			name: "Stade de Genève",
			street: "Route des Jeunes 10",
			locality: "Lancy",
			postal_code: "1212",
			country: "Switzerland",
		});

		expect(normalized).not.toBeNull();
		expect(normalized?.name).toBe("Stade de Genève");
		expect(normalized?.address).toBe("Route des Jeunes 10, 1212 Lancy, Switzerland");
	});

	it("normalizes an existing locations record with title and address", () => {
		const normalized = normalizeVenueRecord({
			id: "loc1",
			title: "Centre Sportif",
			address: "Rue du Stand 5",
			city: "Genève",
			zip: "1204",
		});

		expect(normalized).not.toBeNull();
		expect(normalized?.name).toBe("Centre Sportif");
		expect(normalized?.address).toBe("Rue du Stand 5, 1204 Genève");
	});
});
