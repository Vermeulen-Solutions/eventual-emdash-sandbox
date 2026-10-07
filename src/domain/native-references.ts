import type { CollectionSchemaInfo } from "emdash";
import type { EventualContext } from "../storage";
import { collectionBindings } from './collections';

export function referenceId(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value && typeof value === "object" && !Array.isArray(value))
    return referenceId((value as Record<string, unknown>).id);
}

/** The schema, not a plugin setting, defines what a saved reference means. */
export function referenceTarget(
  schema: CollectionSchemaInfo | undefined,
  field: "venue" | "organizer_ref",
): string {
  const definition = schema?.fields.find((item) => item.slug === field);
  const target =
    definition?.validation?.targetCollection ?? definition?.options?.collection;
  return typeof target === "string" && target
    ? target
    : field === "venue"
      ? "venues"
      : "organizers";
}

/** Bound references are storage-less in core 1.0.1; the upgrade supplies a column-backed selection. */
export function referenceField(
  schema: CollectionSchemaInfo | undefined,
  field: "venue" | "organizer_ref",
): string {
  const definition = schema?.fields.find((item) => item.slug === field);
  return definition?.validation?.relation
    ? field === "venue"
      ? "venue_id"
      : "organizer_id"
    : field;
}

export async function eventSchema(ctx: EventualContext) {
  return (await collectionBindings(ctx)).schema;
}
