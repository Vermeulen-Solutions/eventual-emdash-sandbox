import { describe, it, expect } from "vitest";
import { civilDate, displayEventDate, eventPageUrl } from "../astro/event-list";
import {
  plainTextToPortableText,
  portableTextToPlainText,
} from "../src/domain/portable-text";
import {
  nativeEntryToEventRecord,
  expandEventOccurrences,
} from "../src/domain/event-expansion";
import type { PublicEvent } from "../astro/feed";
const event: PublicEvent = {
  id: "cms-id#2026-11-15T10:00",
  slug: "native-slug",
  title: "Title",
  description: "",
  start: "2026-11-15T10:00:00Z",
  end: "2026-11-15T11:00:00Z",
  allDay: false,
  timezone: "Europe/Paris",
  location: "",
  organizer: "",
  externalUrl: "",
  imageUrl: "",
  categories: [],
  venue: null,
  directionsUrl: "",
};
describe("Astro and Portable Text edge cases", () => {
  it("filters categories after occurrence overrides are applied", () => {
    const series = {
      ...event,
      id: "legacy",
      published: true,
      status: "published",
      allDay: false,
      categories: ["Music"],
      timezone: "UTC",
      recurrence: { frequency: "daily", until: "2026-11-17" },
      exceptions: [
        {
          recurrenceId: "2026-11-16T10:00",
          status: "modified",
          overrides: { categories: ["Community"] },
        },
      ],
    };
    const results = expandEventOccurrences([series], {
      from: "2026-11-15",
      through: "2026-11-17",
      category: " community ",
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toContain("2026-11-16");
  });
  it.each(["cancelled", "postponed", "rescheduled"])(
    "preserves a published legacy %s business status",
    (status) => {
      const legacy = {
        ...event,
        id: "legacy",
        published: true,
        status,
        allDay: false,
        exceptions: [],
      };
      expect(nativeEntryToEventRecord(legacy)).toMatchObject({
        published: true,
        status,
      });
      expect(
        nativeEntryToEventRecord({ id: "legacy", data: legacy }),
      ).toMatchObject({ published: true, status });
    },
  );
  it("keeps URLs Gregorian and ASCII for Arabic and Thai displays", () => {
    expect(civilDate(event.start, event.timezone)).toBe("2026-11-15");
    expect(displayEventDate(event, "ar")).not.toBe(event.start);
    expect(displayEventDate(event, "th")).not.toBe(event.start);
    expect(eventPageUrl(event)).toBe(
      "/events/native-slug?from=2026-11-15&through=2026-11-15",
    );
    expect(
      eventPageUrl({
        ...event,
        publicUrl: "https://site.example/fr/events/native-slug",
      }),
    ).toContain("/fr/events/native-slug?from=2026-11-15");
  });
  it("converts Markdown lists, emphasis and links deterministically and tolerates malformed trees", () => {
    const text =
      "# Heading\n\n- **First**\n- [Second](https://example.com)\n\nLiteral <example>.";
    const first = plainTextToPortableText(text);
    expect(first).toEqual(plainTextToPortableText(text));
    expect(first.filter((block) => block.listItem === "bullet")).toHaveLength(
      2,
    );
    expect(portableTextToPlainText(first)).toContain("First");
    expect(portableTextToPlainText(first)).toContain("Literal <example>.");
    expect(() =>
      portableTextToPlainText([
        {
          _type: "block",
          style: 42,
          children: [null, { text: "Safe" }],
          markDefs: [null],
        },
      ]),
    ).not.toThrow();
  });
  it("normalizes real ContentItems, LiveCollection slug IDs and flat legacy exceptions without mutating input", () => {
    const data = {
      ...event,
      published: true,
      allDay: false,
      recurrence: { frequency: "daily", until: "2026-11-17" },
      exceptions: [
        {
          recurrenceId: "2026-11-16T11:00",
          status: "modified",
          overrides: { title: "Local copy" },
        },
      ],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(nativeEntryToEventRecord(data)).not.toBeNull();
    const original = JSON.stringify(data);
    nativeEntryToEventRecord(data);
    expect(JSON.stringify(data)).toBe(original);
    expect(
      nativeEntryToEventRecord({
        id: "slug",
        data: {
          id: "cms-id",
          title: "Title",
          start: event.start,
          end: event.end,
          all_day: 0,
          timezone: "UTC",
          status: "published",
        },
      })?.id,
    ).toBe("cms-id");
    expect(
      nativeEntryToEventRecord({
        id: "real-id",
        type: "events",
        status: "published",
        data: {
          id: "untrusted-data-id",
          title: "Title",
          start: event.start,
          end: event.end,
          all_day: 0,
          timezone: "UTC",
        },
      })?.id,
    ).toBe("real-id");
  });
});
