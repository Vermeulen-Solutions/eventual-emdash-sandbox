export type WeekdayName =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type MonthlyPosition = 1 | 2 | 3 | 4 | 5 | "last";

export type EventRecurrence = (
  | { frequency: "daily"; until: string }
  | { frequency: "weekly"; until: string; weekdays?: WeekdayName[] }
  | {
      frequency: "monthly";
      until: string;
      pattern:
        | {
            type: "dayOfMonth";
            dayOfMonth: number;
            missingDayBehavior: "skip" | "lastDay";
          }
        | {
            type: "weekdayOfMonth";
            weekday: WeekdayName;
            position: MonthlyPosition;
          };
    }) & { interval?: number };

export type EventLocationType = "physical" | "virtual" | "hybrid";
export type EventStatus = "draft" | "published" | "cancelled" | "postponed" | "rescheduled";

export interface EventFields {
  title: string;
  description: string;
  /** Date-only for all-day events; an ISO instant for timed events. */
  start: string;
  /** Inclusive date-only end for all-day events; an ISO instant otherwise. */
  end: string;
  allDay: boolean;
  timezone: string;
  location: string;
  locationType?: EventLocationType;
  virtualUrl?: string;
  status?: EventStatus;
  organizer: string;
  organizerId?: string;
  externalUrl: string;
  imageUrl: string;
  imageMediaId?: string;
  categories: string[];
  venueId?: string;
  published: boolean;
  locale?: string;
}

export type EventOverride = Partial<
  Pick<
    EventFields,
    | "title"
    | "description"
    | "start"
    | "end"
    | "allDay"
    | "timezone"
    | "location"
    | "locationType"
    | "virtualUrl"
    | "status"
    | "organizer"
    | "externalUrl"
    | "imageUrl"
    | "imageMediaId"
    | "categories"
    | "locale"
  >
>;

export interface EventException {
  /** Original local wall time (`YYYY-MM-DDTHH:mm`) or all-day date. */
  recurrenceId: string;
  status: "cancelled" | "modified";
  overrides?: EventOverride;
}

export interface EventRecord extends EventFields {
  /** Built-in manual translations in standalone mode; schedule stays on this one record. */
  translations?: Record<string, { title: string; description: string; location: string; organizer: string }>;
  id: string;
  recurrence?: EventRecurrence;
  exceptions: EventException[];
  createdAt: string;
  updatedAt: string;
  /** Up to ten previous series schedules, newest first; never copied to duplicates. */
  scheduleHistory?: Array<{ start: string; end: string; allDay: boolean; timezone: string; changedAt: string }>;
  previousStartDate?: string;
  translationGroup?: string;
  calendarUid?: string;
  calendarSequence?: number;
  slug?: string;
  publicUrl?: string;
  organizerDetails?: { id: string; name: string; website: string; contactUrl: string };
  descriptionBlocks?: unknown[];
}

export interface EventDraft {
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
  location: string;
  locationType?: EventLocationType;
  virtualUrl?: string;
  status?: EventStatus;
  organizer: string;
  organizerId?: string;
  externalUrl: string;
  imageUrl: string;
  imageMediaId: string;
  categories: string;
  venueId: string;
  published: boolean;
  repeatFrequency: "none" | "daily" | "weekly" | "monthly";
  recurrenceUntil: string;
  recurrenceInterval?: number;
  weeklyWeekdays?: WeekdayName[];
  monthlyDayOfMonth?: number;
  monthlyPattern: "dayOfMonth" | "weekdayOfMonth";
  missingDayBehavior: "skip" | "lastDay";
  monthlyWeekday: WeekdayName;
  monthlyPosition: MonthlyPosition;
  exceptions: EventException[];
}

export interface VenueFields {
  name: string;
  street: string;
  street2: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface VenueRecord extends VenueFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizerRecord {
  id: string;
  name: string;
  website: string;
  /** Public contact URL; do not store private addresses here. */
  contactUrl: string;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_EVENT_DRAFT: EventDraft = {
  title: "",
  description: "",
  start: "",
  end: "",
  allDay: false,
  timezone: "UTC",
  location: "",
  locationType: "physical",
  virtualUrl: "",
  status: "draft",
  organizer: "",
  externalUrl: "",
  imageUrl: "",
  imageMediaId: "",
  categories: "",
  venueId: "",
  published: false,
  repeatFrequency: "none",
  recurrenceUntil: "",
  recurrenceInterval: 1,
  monthlyPattern: "dayOfMonth",
  missingDayBehavior: "skip",
  monthlyWeekday: "monday",
  monthlyPosition: 1,
  exceptions: [],
};
