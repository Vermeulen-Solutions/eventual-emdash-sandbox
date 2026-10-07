// Generated from src/schema/blueprint.ts by scripts/build-host.mjs.
/** Native schemas. Slugs and publication state are EmDash metadata, not fields. */
import type { SeedCollection } from "emdash/seed";
export interface BlueprintField {
    slug: string;
    label: string;
    type: "string" | "text" | "url" | "number" | "integer" | "boolean" | "datetime" | "select" | "multiSelect" | "portableText" | "image" | "file" | "reference" | "json" | "slug" | "repeater";
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
    eventCollection?: string;
    venueCollection?: string;
    organizerCollection?: string;
    bindRelations?: boolean;
    /** Opt in only when importing private-storage records from older prototypes. */
    legacyCompatibility?: boolean;
}
export declare function createEventsCollectionBlueprint(options?: SchemaBlueprintOptions): CollectionBlueprint;
export declare function createVenuesCollectionBlueprint(options?: SchemaBlueprintOptions): CollectionBlueprint;
export declare function createOrganizersCollectionBlueprint(options?: SchemaBlueprintOptions): CollectionBlueprint;
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
export declare function createEventRelations(options?: SchemaBlueprintOptions): BlueprintRelation[];
