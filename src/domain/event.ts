export type WeekdayName =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type MonthlyPosition = 1 | 2 | 3 | 4 | 5 | "last";

export type EventRecurrence =
  | { frequency: "daily" | "weekly"; until: string }
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
    };

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
  organizer: string;
  externalUrl: string;
  imageUrl: string;
  imageMediaId?: string;
  categories: string[];
  venueId?: string;
  published: boolean;
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
    | "organizer"
    | "externalUrl"
    | "imageUrl"
    | "imageMediaId"
    | "categories"
  >
>;

export interface EventException {
  /** Original local wall time (`YYYY-MM-DDTHH:mm`) or all-day date. */
  recurrenceId: string;
  status: "cancelled" | "modified";
  overrides?: EventOverride;
}

export interface EventRecord extends EventFields {
  id: string;
  recurrence?: EventRecurrence;
  exceptions: EventException[];
  createdAt: string;
  updatedAt: string;
}

export interface EventDraft {
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  timezone: string;
  location: string;
  organizer: string;
  externalUrl: string;
  imageUrl: string;
  imageMediaId: string;
  categories: string;
  venueId: string;
  published: boolean;
  repeatFrequency: "none" | "daily" | "weekly" | "monthly";
  recurrenceUntil: string;
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

export const EMPTY_EVENT_DRAFT: EventDraft = {
  title: "",
  description: "",
  start: "",
  end: "",
  allDay: false,
  timezone: "UTC",
  location: "",
  organizer: "",
  externalUrl: "",
  imageUrl: "",
  imageMediaId: "",
  categories: "",
  venueId: "",
  published: false,
  repeatFrequency: "none",
  recurrenceUntil: "",
  monthlyPattern: "dayOfMonth",
  missingDayBehavior: "skip",
  monthlyWeekday: "monday",
  monthlyPosition: 1,
  exceptions: [],
};
