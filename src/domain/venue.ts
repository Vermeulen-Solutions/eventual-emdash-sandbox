import type { VenueFields } from "./event";

export function formatVenueAddress(venue: VenueFields): string {
  return [
    venue.street,
    venue.street2,
    venue.locality,
    venue.region,
    venue.postalCode,
    venue.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function eventLocation(
  venue: VenueFields | undefined,
  locationNote: string,
): string {
  return [venue?.name, venue ? formatVenueAddress(venue) : "", locationNote.trim()]
    .filter(Boolean)
    .join(" · ");
}

export function directionsUrl(destination: string): string {
  const place = destination.trim();
  if (!place) return "";
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
  return url.length <= 2048 ? url : "";
}

export function safeHttpUrl(value: string): string {
  if (!value.trim()) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
