## 0.17.0

Multi-locale UI dictionaries, universal 1-click calendar links, and single-event query hydration: Complete German (`de`), Dutch (`nl`), and Spanish (`es`) UI localization dictionaries with regional fallback. Universal 1-click links for Google Calendar, Outlook Web, Office 365, and direct Apple/desktop iCal downloads on all `PublicEvent` payloads and the `<EventList showCalendarLinks={true} />` Astro component. Targeted `eventId` query support on `publicEvents`. Full backwards compatibility and EmDash **>=1.2.0 <2.0.0** support preserved. [Release notes](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/release-notes-0.17.0.md).

## Earlier releases

- **0.16.0:** parallelized public feed resolution, cache headers for public media, and direct `imageMedia` metadata for responsive Astro `<Image>`.
- **0.15.0:** opt-in public feed cache evidence: actual collection dependencies, empty-list invalidation and absolute expiry.
- **0.14.1:** EmDash 1.4 editor compatibility; no runtime or permission changes.
- **0.14.0:** public legacy storage reads require explicit opt-in; native collections stay authoritative.
- **0.13.0:** native rich content, translations, drafts, directories and publication.

[Full changelog](https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/CHANGELOG.md).
