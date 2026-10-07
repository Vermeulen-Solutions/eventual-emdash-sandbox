/**
 * Flexible Venue Adapter for Eventual.
 * Normalizes venue data whether sourced from a native `venues` collection,
 * an existing `locations` collection, or legacy plugin storage.
 */

import { portableTextToPlainText } from "./portable-text";
const text = (value: unknown) => (typeof value === "string" ? value : "");
export function localizedVenue(
  venues: Map<string, NormalizedVenue> | undefined,
  event: { venueId?: string; locale?: string },
) {
  return event.venueId
    ? (venues?.get(event.venueId + "|" + (event.locale ?? "").toLowerCase()) ??
        venues?.get(event.venueId))
    : undefined;
}
export interface NormalizedVenue {
  id: string;
  name: string;
  address: string;
  street?: string;
  street2?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  directions?: string;
}

/**
 * Normalizes any venue/location raw record into a standard NormalizedVenue shape.
 */
export function normalizeVenueRecord(raw: unknown): NormalizedVenue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const data = (
    record.data && typeof record.data === "object" ? record.data : record
  ) as Record<string, unknown>;

  const id = text(
    record.type ? record.id : (data.id ?? record.id ?? record._id ?? ""),
  );
  if (!id) return null;

  const name = text(
    data.name ?? data.title ?? record.name ?? record.title ?? "",
  ).trim();
  const street = text(
    data.street ??
      data.address ??
      data.streetAddress ??
      record.street ??
      record.address ??
      record.streetAddress ??
      "",
  ).trim();
  const street2 = text(data.street2 ?? record.street2 ?? "").trim();
  const locality = text(
    data.locality ?? data.city ?? record.locality ?? record.city ?? "",
  ).trim();
  const region = text(
    data.region ?? data.state ?? record.region ?? record.state ?? "",
  ).trim();
  const postalCode = text(
    data.postal_code ??
      data.postalCode ??
      data.zip ??
      record.postal_code ??
      record.postalCode ??
      record.zip ??
      "",
  ).trim();
  const country = text(data.country ?? record.country ?? "").trim();
  const directions =
    portableTextToPlainText(data.directions ?? record.directions) || undefined;

  // Build human-readable full address string
  const addressParts = [
    [street, street2].filter(Boolean).join(" "),
    [postalCode, locality].filter(Boolean).join(" "),
    region,
    country,
  ].filter(Boolean);

  const fullAddress = addressParts.join(", ");

  return {
    id,
    name: name || fullAddress || "Event Venue",
    address: fullAddress,
    street: street || undefined,
    street2: street2 || undefined,
    locality: locality || undefined,
    region: region || undefined,
    postalCode: postalCode || undefined,
    country: country || undefined,
    directions,
  };
}
