import type { PublicEvent } from "./feed";
import { safeWebUrl } from "./event-details";
export function civilDate(value: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}
export function displayEventDate(event: PublicEvent, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: event.allDay ? "UTC" : event.timezone,
      dateStyle: "long",
      ...(event.allDay ? {} : { timeStyle: "short" }),
    }).format(
      new Date(event.allDay ? event.start + "T00:00:00Z" : event.start),
    );
  } catch {
    return event.start;
  }
}
export function eventPageUrl(event: PublicEvent, basePath = "/events"): string {
  const supplied =
    event.publicUrl &&
    (safeWebUrl(event.publicUrl) ||
      (event.publicUrl.startsWith("/") && !event.publicUrl.startsWith("//")
        ? event.publicUrl
        : ""));
  const url = new URL(
    supplied ||
      basePath.replace(/\/$/, "") +
        "/" +
        encodeURIComponent(event.slug ?? event.id.split("#")[0]!),
    "https://eventual.invalid",
  );
  try {
    url.searchParams.set(
      "from",
      event.allDay ? event.start : civilDate(event.start, event.timezone),
    );
    url.searchParams.set(
      "through",
      event.allDay ? event.end : civilDate(event.end, event.timezone),
    );
  } catch {}
  return url.origin === "https://eventual.invalid"
    ? url.pathname + url.search + url.hash
    : url.href;
}
