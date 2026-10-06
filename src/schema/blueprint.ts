/** Native schemas. Slugs and publication state are EmDash metadata, not fields. */
import type { SeedCollection } from "emdash/seed";
export interface BlueprintField {
  slug: string;
  label: string;
  type:
    | "string"
    | "text"
    | "url"
    | "number"
    | "integer"
    | "boolean"
    | "datetime"
    | "select"
    | "multiSelect"
    | "portableText"
    | "image"
    | "file"
    | "reference"
    | "json"
    | "slug"
    | "repeater";
  required?: boolean;
  unique?: boolean;
  searchable?: boolean;
  indexed?: boolean;
  translatable?: boolean;
  defaultValue?: unknown;
  description?: string;
  options?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  sortOrder?: number;
}
export interface CollectionBlueprint {
  slug: string;
  label: string;
  labelSingular: string;
  supports?: SeedCollection["supports"];
  routable?: boolean;
  urlPattern?: string;
  fields: BlueprintField[];
}
export interface SchemaBlueprintOptions {
  venueCollection?: string;
}
function field(
  slug: string,
  type: BlueprintField["type"],
  translatable = false,
  extra: Partial<BlueprintField> = {},
): BlueprintField {
  return {
    slug,
    label: slug.replaceAll("_", " "),
    type,
    translatable,
    ...extra,
  };
}
export function createEventsCollectionBlueprint(
  options: SchemaBlueprintOptions = {},
): CollectionBlueprint {
  return {
    slug: "events",
    label: "Events",
    labelSingular: "Event",
    supports: ["drafts", "revisions", "scheduling", "search"],
    routable: true,
    urlPattern: "/events/{slug}",
    fields: [
      field("title", "string", true, { required: true, searchable: true }),
      field("description", "portableText", true, { searchable: true }),
      field("excerpt", "text", true),
      field("featured_image", "image"),
      field("image_url", "url"),
      // All-day dates are Gregorian civil dates, inclusive at both ends.
      field("start", "datetime", false, { indexed: true }),
      field("end", "datetime"),
      field("start_date", "string"),
      field("end_date", "string"),
      field("all_day", "boolean", false, { defaultValue: false }),
      field("timezone", "string", false, { defaultValue: "Europe/Zurich" }),
      field("location_type", "select", false, {
        defaultValue: "physical",
        validation: { options: ["physical", "virtual", "hybrid"] },
      }),
      field("venue", "reference", false, {
        options: { collection: options.venueCollection ?? "venues" },
      }),
      field("location", "string", true),
      field("virtual_url", "url"),
      field("external_url", "url"),
      field("organizer", "string", true),
      field("organizer_details", "json"),
      field("categories", "json"),
      field("event_status", "select", false, {
        defaultValue: "published",
        validation: {
          options: ["published", "cancelled", "postponed", "rescheduled"],
        },
      }),
      field("recurrence", "json"),
      field("exceptions", "json", false, {
        description:
          "Schedule overrides only; translated occurrence copy belongs in occurrence_content.",
      }),
      field("occurrence_content", "json", true),
      field("previous_start_date", "string"),
      field("schedule_history", "json"),
      field("legacy_id", "string", false, { unique: true, indexed: true }),
      field("legacy_metadata", "json"),
      field("calendar_uid", "string"),
    ],
  };
}
export function createVenuesCollectionBlueprint(): CollectionBlueprint {
  return {
    slug: "venues",
    label: "Venues",
    labelSingular: "Venue",
    supports: ["search"],
    routable: false,
    fields: [
      field("name", "string", false, { required: true, searchable: true }),
      ...[
        "street",
        "street2",
        "locality",
        "region",
        "postal_code",
        "country",
      ].map((slug) => field(slug, "string")),
      field("directions", "portableText", true),
      field("legacy_id", "string", false, { unique: true, indexed: true }),
      field("legacy_metadata", "json"),
    ],
  };
}
