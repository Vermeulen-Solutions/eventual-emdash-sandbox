import { describe, it, expect } from "vitest";
import { buildCalendarLinks } from "../src/domain/calendar-links";

describe("buildCalendarLinks", () => {
  it("builds correct Google, Outlook, and iCal URLs for timed events", () => {
    const links = buildCalendarLinks(
      {
        id: "evt-123#2026-11-15T10:00:00Z",
        title: "Hockey Clinic",
        description: "Youth skills practice",
        start: "2026-11-15T10:00:00.000Z",
        end: "2026-11-15T12:00:00.000Z",
        allDay: false,
        timezone: "Europe/Zurich",
        location: "Centre Sportif, Geneva",
        locationType: "physical",
      },
      "https://example.com"
    );

    expect(links.google).toContain("calendar.google.com/calendar/render");
    expect(links.google).toContain("text=Hockey%20Clinic");
    expect(links.google).toContain("dates=20261115T100000Z/20261115T120000Z");
    expect(links.google).toContain("location=Centre%20Sportif%2C%20Geneva");

    expect(links.outlook).toContain("outlook.live.com/calendar/0/deeplink/compose");
    expect(links.outlook).toContain("subject=Hockey%20Clinic");
    expect(links.outlook).toContain("startdt=2026-11-15T10%3A00%3A00.000Z");
    expect(links.outlook).toContain("enddt=2026-11-15T12%3A00%3A00.000Z");

    expect(links.office365).toContain("outlook.office.com/calendar/0/deeplink/compose");
    expect(links.ics).toBe("https://example.com/_emdash/api/plugins/eventual/calendar?eventId=evt-123");
  });

  it("handles all-day events with exclusive end-date addition for Google and Outlook", () => {
    const links = buildCalendarLinks({
      id: "evt-camp-1",
      title: "Weekend Camp",
      start: "2026-11-20",
      end: "2026-11-22",
      allDay: true,
      timezone: "Europe/Zurich",
      location: "Patinoire des Vernets",
    });

    // 2026-11-20 through 2026-11-22 (inclusive) means end date exclusive is 2026-11-23
    expect(links.google).toContain("dates=20261120/20261123");
    expect(links.outlook).toContain("allday=true");
    expect(links.outlook).toContain("startdt=2026-11-20");
    expect(links.outlook).toContain("enddt=2026-11-23");
  });

  it("formats virtual and hybrid event locations cleanly", () => {
    const virtualLinks = buildCalendarLinks({
      id: "evt-zoom",
      title: "Strategy Webinar",
      start: "2026-11-15T14:00:00Z",
      end: "2026-11-15T15:00:00Z",
      allDay: false,
      locationType: "virtual",
      virtualUrl: "https://zoom.us/j/123456789",
    });
    expect(virtualLinks.google).toContain(encodeURIComponent("https://zoom.us/j/123456789"));

    const hybridLinks = buildCalendarLinks({
      id: "evt-hybrid",
      title: "Annual General Meeting",
      start: "2026-11-15T14:00:00Z",
      end: "2026-11-15T15:00:00Z",
      allDay: false,
      location: "Clubhouse",
      locationType: "hybrid",
      virtualUrl: "https://meet.google.com/abc-defg-hij",
    });
    expect(hybridLinks.google).toContain(encodeURIComponent("Clubhouse · https://meet.google.com/abc-defg-hij"));
  });
});
