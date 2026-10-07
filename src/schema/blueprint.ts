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
  widget?: string;
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
  organizerCollection?: string;
  bindRelations?: boolean;
}
function field(
  slug: string,
  type: BlueprintField["type"],
  translatable = false,
  extra: Partial<BlueprintField> = {},
): BlueprintField {
  return {
    slug,
    label:
      (
        {
          title: "Title",
          start:"Start",end:"End",start_date:"Start date",end_date:"Last day",all_day:"All-day event",timezone:"Time zone",
          recurrence:"Repeat",exceptions:"Changed dates",occurrence_content:"Announcements for individual dates",categories:"Categories",
          description: "Description",
          excerpt: "Short summary",
          featured_image: "Event image",
          image_url: "External image URL",
          location_type: "Where the event takes place",
          location: "Location note for this language",
          virtual_url: "Online meeting or stream URL",
          external_url: "Registration or event website",
          organizer: "Organizer display name for this language",
          event_status: "Event status",
          name: "Name",
          street: "Street address",
          street2: "Address line 2",
          locality: "Town or city",
          region: "Region",
          postal_code: "Postal code",
          country: "Country",
          directions: "Directions",
          website: "Website",
          contact_url: "Contact page",
        } as Record<string, string>
      )[slug] ?? slug.replaceAll("_", " "),
    type,
    translatable,
    ...([
      "start",
      "end",
      "start_date",
      "end_date",
      "all_day",
      "timezone",
      "venue",
      "venue_id",
      "organizer_ref",
      "organizer_id",
      "organizer_details",
      "categories",
      "recurrence",
      "exceptions",
      "occurrence_content",
      "previous_start_date",
      "schedule_history",
      "legacy_id",
      "legacy_metadata",
      "calendar_uid",
    ].includes(slug)
      ? { widget: "eventual-editor:managed" }
      : {}),
    ...extra,
    options: { ...extra.options, eventualEditor: true },
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
      field("excerpt", "text", true, {
        widget: "eventual-editor:optional-text",
      }),
      field("featured_image", "image"),
      field("image_url", "url", false, {
        widget: "eventual-editor:optional-text",
      }),
      // All-day dates are Gregorian civil dates, inclusive at both ends.
      field("start", "datetime", false, { indexed: true }),
      field("end", "datetime"),
      field("start_date", "string"),
      field("end_date", "string"),
      field("all_day", "boolean", false, { defaultValue: false }),
      field("timezone", "string", false, { defaultValue: "Europe/Zurich" }),
      field("location_type", "select", false, {
        widget: "eventual-editor:location-type",
        defaultValue: "physical",
        validation: { options: ["physical", "virtual", "hybrid"] },
      }),
      field("venue", "reference", false, {
        label: "Saved venue",
        options: { collection: options.venueCollection ?? "venues" },
        ...(options.bindRelations
          ? {
              validation: {
                relation: "events_venue",
                targetCollection: options.venueCollection ?? "venues",
                relationSide: "parent",
                multiple: false,
              },
            }
          : {}),
      }),
      field("location", "string", true, {
        widget: "eventual-editor:optional-text",
      }),
      ...(options.bindRelations
        ? [
            field("venue_id", "reference", false, {
              label: "Saved venue",
              options: { collection: options.venueCollection ?? "venues" },
            }),
          ]
        : []),
      field("virtual_url", "url", false, {
        widget: "eventual-editor:optional-text",
      }),
      field("external_url", "url", false, {
        widget: "eventual-editor:optional-text",
      }),
      field("organizer", "string", true, {
        widget: "eventual-editor:optional-text",
      }),
      field("organizer_ref", "reference", false, {
        label: "Saved organizer",
        options: { collection: options.organizerCollection ?? "organizers" },
        ...(options.bindRelations
          ? {
              validation: {
                relation: "events_organizer",
                targetCollection: options.organizerCollection ?? "organizers",
                relationSide: "parent",
                multiple: false,
              },
            }
          : {}),
      }),
      field("organizer_details", "json"),
      ...(options.bindRelations
        ? [
            field("organizer_id", "reference", false, {
              label: "Saved organizer",
              options: {
                collection: options.organizerCollection ?? "organizers",
              },
            }),
          ]
        : []),
      field("categories", "json"),
      field("event_status", "select", false, {
        widget: "eventual-editor:event-status",
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

export function createOrganizersCollectionBlueprint(): CollectionBlueprint {
  return {
    slug: "organizers",
    label: "Organizers",
    labelSingular: "Organizer",
    supports: ["search"],
    routable: false,
    fields: [
      field("name", "string", false, { required: true, searchable: true }),
      field("website", "url"),
      field("contact_url", "url"),
      field("legacy_id", "string", false, { unique: true, indexed: true }),
      field("legacy_metadata", "json"),
    ],
  };
}

export interface BlueprintRelation {
  slug: string;
  parentCollection: string;
  childCollection: string;
  parentLabel: string;
  childLabel: string;
  parentLabelSingular?: string;
  childLabelSingular?: string;
  maxChildrenPerParent?: number;
  maxParentsPerChild?: number;
}

export function createEventRelations(
  options: SchemaBlueprintOptions = {},
): BlueprintRelation[] {
  const venueCollection = options.venueCollection ?? "venues";
  const organizerCollection = options.organizerCollection ?? "organizers";
  return [
    {
      slug: "events_venue",
      parentCollection: "events",
      childCollection: venueCollection,
      parentLabel: "Events",
      childLabel:
        venueCollection.charAt(0).toUpperCase() + venueCollection.slice(1),
      parentLabelSingular: "Event",
      childLabelSingular: "Venue",
      maxChildrenPerParent: 1,
    },
    {
      slug: "events_organizer",
      parentCollection: "events",
      childCollection: organizerCollection,
      parentLabel: "Events",
      childLabel:
        organizerCollection.charAt(0).toUpperCase() +
        organizerCollection.slice(1),
      parentLabelSingular: "Event",
      childLabelSingular: "Organizer",
      maxChildrenPerParent: 1,
    },
  ];
}
