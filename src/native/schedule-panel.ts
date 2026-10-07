import type {
  BlockResponse,
  FormField,
  EditorDraftPatchEffect,
} from "@emdash-cms/blocks";
import type { SandboxedRouteContext } from "emdash/plugin";
import type { EventualContext } from "../storage";
import {
  compileRecurrenceFromForm,
  recurrenceToFormValues,
  formatHumanRecurrence,
} from "./event-commands";
import {
  inspectNativeOccurrences,
  cancelNativeOccurrence,
  rescheduleNativeOccurrence,
  restoreNativeOccurrence,
  setNativeOccurrenceCopy,
  clearNativeOccurrenceCopy,
  type OccurrenceCopy,
} from "./occurrence-service";
import { WEEKDAYS } from "../domain/recurrence-rule";
import { addDays, scheduledOccurrence } from "../domain/recurrence";
import {
  normalizeNativeSchedule,
  parseJson,
} from "../domain/native-validation";
import {
  instantToLocalDateTime,
  localDateTimeToInstant,
  isDateOnly,
} from "../domain/date-time";
import type { EventRecord, EventException } from "../domain/event";
import {
  eventSchema,
  referenceTarget,
  referenceId,
  referenceField,
} from "../domain/native-references";
import { listNative } from "../domain/native-source";
import { normalizeCategories } from "../domain/category";
import {
  plainTextToPortableText,
  portableTextToPlainText,
} from "../domain/portable-text";
import { directoryChoices } from "./directory";

const text = (value: unknown) => (typeof value === "string" ? value : "");
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const days = [...WEEKDAYS.slice(1), WEEKDAYS[0]!].map((day) => ({
  value: day,
  label: day[0]!.toUpperCase() + day.slice(1),
}));
const date = (
  id: string,
  label: string,
  value?: unknown,
): Extract<FormField, { type: "date_input" }> => ({
  type: "date_input",
  action_id: id,
  label,
  initial_value: text(value) || undefined,
});
const input = (
  id: string,
  label: string,
  value?: unknown,
  multiline = false,
): Extract<FormField, { type: "text_input" }> => ({
  type: "text_input",
  action_id: id,
  label,
  initial_value: text(value),
  multiline,
});
const select = (
  id: string,
  label: string,
  options: { value: string; label: string }[],
  value: unknown,
): Extract<FormField, { type: "combobox" }> => ({
  type: "combobox",
  action_id: id,
  label,
  options,
  initial_value: text(value),
});
const form = (
  id: string,
  label: string,
  fields: FormField[],
): BlockResponse["blocks"][number] => ({
  type: "form",
  block_id: id,
  fields,
  submit: { action_id: id, label },
});
const exceptions = (fields: Record<string, unknown>) =>
  (parseJson(fields.exceptions) ?? []) as EventException[];
const copy = (fields: Record<string, unknown>) =>
  (parseJson(fields.occurrence_content) ?? []) as OccurrenceCopy[];
const patch = (
  operations: EditorDraftPatchEffect["operations"],
): EditorDraftPatchEffect => ({ type: "editor-draft-patch", operations });
const set = (
  field: string,
  value: unknown,
): EditorDraftPatchEffect["operations"][number] => ({
  op: "set",
  field,
  value,
});
const clear = (
  field: string,
): EditorDraftPatchEffect["operations"][number] => ({ op: "clear", field });

function local(value: unknown, allDay: boolean, timezone: string) {
  const raw = text(value);
  try { return allDay
    ? raw
    : raw && Number.isFinite(Date.parse(raw))
      ? instantToLocalDateTime(raw, timezone)
      : raw; } catch { return raw; }
}
function displayDate(value: string, allDay: boolean, locale: string) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    ...(allDay ? {} : { timeStyle: "short" as const }),
    timeZone: "UTC",
  };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat(locale || "en", options);
  } catch {
    formatter = new Intl.DateTimeFormat("en", options);
  }
  return formatter.format(
    new Date(value.length === 10 ? value + "T00:00:00Z" : value + "Z"),
  );
}
function scheduleValues(fields: Record<string, unknown>) {
  const allDay = Boolean(fields.all_day);
  const timezone = text(fields.timezone) || "Europe/Zurich";
  return {
    allDay,
    timezone,
    start: local(allDay ? fields.start_date : fields.start, allDay, timezone),
    end: local(allDay ? fields.end_date : fields.end, allDay, timezone),
  };
}
function scheduleFields(
  fields: Record<string, unknown>,
  prefix = "",
  submitted?: Record<string, unknown>,
): FormField[] {
  const values = scheduleValues(fields);
  const controls: FormField[] = [
    {
      type: "toggle",
      action_id: prefix + "all_day",
      label: "All-day event",
      initial_value: values.allDay,
    },
    date(prefix + "start_date", "Start date", values.start.slice(0, 10)),
    {
      ...input(prefix + "start_time", "Start time", values.start.slice(11, 16)),
      placeholder: "18:30",
      condition: { field: prefix + "all_day", eq: false },
    },
    date(
      prefix + "end_date",
      "End date (last day for all-day events)",
      values.end.slice(0, 10),
    ),
    {
      ...input(prefix + "end_time", "End time", values.end.slice(11, 16)),
      placeholder: "20:00",
      condition: { field: prefix + "all_day", eq: false },
    },
    select(
      prefix + "timezone",
      "Time zone",
      [
        ...new Set([
          values.timezone,
          "UTC",
          "Europe/Paris",
          "Europe/Zurich",
          "Europe/London",
          "Europe/Berlin",
          "Europe/Brussels",
          "Europe/Amsterdam",
          "America/New_York",
          "America/Los_Angeles",
          "America/Toronto",
          "Asia/Tokyo",
          "Australia/Sydney",
        ]),
      ]
        .map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))
        .concat({ value: "custom", label: "Other time zone…" }),
      values.timezone,
    ),
    {
      ...input(prefix + "custom_timezone", "Other IANA time zone"),
      placeholder: "Pacific/Auckland",
      condition: { field: prefix + "timezone", eq: "custom" },
    },
  ];
  return controls.map((control) =>
    submitted && Object.hasOwn(submitted, control.action_id)
      ? ({
          ...control,
          initial_value: submitted[control.action_id],
        } as FormField)
      : control,
  );
}
function compileSchedule(values: Record<string, unknown>, prefix = "") {
  const allDay = values[prefix + "all_day"] === true;
  const timezone = text(
    values[prefix + "timezone"] === "custom"
      ? values[prefix + "custom_timezone"]
      : values[prefix + "timezone"],
  ).trim();
  const startDate = text(values[prefix + "start_date"]);
  const endDate = text(values[prefix + "end_date"]) || startDate;
  if (!isDateOnly(startDate) || !isDateOnly(endDate))
    throw new Error("Choose a valid start and end date.");
  if (allDay)
    return {
      all_day: true,
      timezone,
      start_date: startDate,
      end_date: endDate,
    };
  const start = localDateTimeToInstant(
    startDate + "T" + text(values[prefix + "start_time"]),
    timezone,
  );
  const end = localDateTimeToInstant(
    endDate + "T" + text(values[prefix + "end_time"]),
    timezone,
  );
  if (!start.value || !end.value)
    throw new Error(
      start.error ||
        end.error ||
        "Enter times as HH:MM in the selected time zone.",
    );
  return { all_day: false, timezone, start: start.value, end: end.value };
}

/** Only the host's editor identity is authoritative. Mutations patch the current draft. */
export async function handleScheduleEditorPanel(
  route: Pick<SandboxedRouteContext, "input" | "ui" | "request">,
  ctx: EventualContext,
): Promise<BlockResponse> {
  const entry = route.ui?.entry;
  if (!entry || entry.collection !== "events")
    return {
      blocks: [
        {
          type: "banner",
          variant: "error",
          title: "Open this panel from an event editor.",
        },
      ],
    };
  const request = object(route.input);
  let fields = object(object(request.draft).fields);
  if (!request.draft) {
    const item = await ctx.content?.get("events", entry.id);
    fields = item?.data ?? {};
    if (item?.draftRevisionId) {
      const revision = await ctx.content?.getRevision?.(
        "events",
        entry.id,
        item.draftRevisionId,
      );
      if (revision) fields = revision.data;
    }
  }
  try {
    fields = {
      ...fields,
      recurrence: parseJson(fields.recurrence),
      exceptions: parseJson(fields.exceptions),
      occurrence_content: parseJson(fields.occurrence_content),
    };
  } catch {
    return {
      blocks: [
        {
          type: "banner",
          variant: "error",
          title: "Stored event data needs repair",
          description:
            "The recurrence or date overrides could not be read. Ask an administrator to review this event.",
        },
      ],
    };
  }
  const values = object(request.values);
  let effect: EditorDraftPatchEffect | undefined;
  let message: string | undefined;
  let error: string | undefined;
  let selectedId = text(request.value) || text(values.recurrence_id);
  let offset = 0;
  let windowStart: string | undefined;
  try {
    if (request.type !== "panel_load" && !request.draft)
      throw new Error("Reload the editor before changing this event.");
    const action = text(request.action_id);
    if (action === "apply-recurrence") {
      const frequency = text(values.frequency);
      const compiled = compileRecurrenceFromForm(
        frequency.startsWith("monthly-")
          ? {
              ...values,
              frequency: "monthly",
              monthlyPatternType:
                frequency === "monthly-weekday"
                  ? "weekdayOfMonth"
                  : "dayOfMonth",
              interval: Number((frequency === "monthly-weekday" ? values.interval_months_weekday : values.interval_months) ?? values.interval ?? 1),
            }
          : { ...values, interval: Number(values["interval_" + (frequency === "daily" ? "days" : "weeks")] ?? values.interval ?? 1) },
      );
      if (compiled.error) throw new Error(compiled.error);
      effect = patch(
        compiled.rule
          ? [set("recurrence", compiled.rule)]
          : [clear("recurrence")],
      );
      message = "Repeat settings ready for review.";
    } else if (action === "apply-schedule") {
      const next = compileSchedule(values);
      effect = patch([
        ...Object.entries(next).map(([key, value]) => set(key, value)),
        ...(next.all_day
          ? [clear("start"), clear("end")]
          : [clear("start_date"), clear("end_date")]),
      ]);
      message = "Dates ready for review.";
    } else if (action === "apply-details") {
      const schema = await eventSchema(ctx);
      for (const field of ["venue", "organizer_ref"] as const) {
        if (
          schema &&
          !schema.fields.some(
            (item) => item.slug === referenceField(schema, field),
          )
        )
          throw new Error(
            "An administrator must upgrade the event reference schema before selecting a venue or organizer.",
          );
        const id = text(values[field]);
        if (id && !(await ctx.content?.get(referenceTarget(schema, field), id)))
          throw new Error(
            "The selected " +
              (field === "venue" ? "venue" : "organizer") +
              " no longer exists. Choose another.",
          );
      }
      effect = patch([
        set(
          "categories",
          normalizeCategories(text(values.categories).split(/[,\n]/)),
        ),
        ...(["venue", "organizer_ref"] as const).map((key) =>
          set(referenceField(schema, key), text(values[key])),
        ),
      ]);
      message = "Venue, organizer and categories ready for review.";
    } else if (action === "search-directories") {
      // Read-only search; the current draft remains untouched.
    } else if (action === "page-occurrences") {
      const page = object(JSON.parse(text(request.value) || "{}"));
      offset = Math.max(0, Math.min(500, Number(page.offset) || 0));
      windowStart = text(page.from);
    } else if (action === "inspect-window") {
      windowStart = text(values.from);
      selectedId = "";
    } else if (
      [
        "cancel-occurrence",
        "restore-occurrence",
        "reschedule-occurrence",
        "set-occurrence-copy",
        "clear-occurrence-copy",
        "edit-occurrence",
      ].includes(action)
    ) {
      const normalized = normalizeNativeSchedule(fields, {
        allowStaleOccurrenceCopy: true,
      });
      const series = {
        id: entry.id,
        start: normalized.all_day ? normalized.start_date : normalized.start,
        end: normalized.all_day ? normalized.end_date : normalized.end,
        allDay: normalized.all_day,
        timezone: normalized.timezone,
        recurrence: parseJson(fields.recurrence),
      } as EventRecord;
      const original = scheduledOccurrence(series, selectedId);
      if (!original)
        throw new Error(
          "This date no longer belongs to the repeat schedule. Reload the dates.",
        );
      windowStart = local(
        original.start,
        original.allDay,
        original.timezone,
      ).slice(0, 10);
      if (action === "cancel-occurrence")
        effect = patch([
          set(
            "exceptions",
            cancelNativeOccurrence(exceptions(fields), selectedId),
          ),
        ]);
      if (action === "restore-occurrence")
        effect = patch([
          set(
            "exceptions",
            restoreNativeOccurrence(exceptions(fields), selectedId),
          ),
        ]);
      if (action === "clear-occurrence-copy")
        effect = patch([
          set(
            "occurrence_content",
            clearNativeOccurrenceCopy(copy(fields), selectedId),
          ),
        ]);
      if (action === "reschedule-occurrence") {
        const replacement = compileSchedule(values, "override_");
        effect = patch([
          set(
            "exceptions",
            rescheduleNativeOccurrence(exceptions(fields), selectedId, {
              start: text(
                replacement.all_day
                  ? replacement.start_date
                  : replacement.start,
              ),
              end: text(
                replacement.all_day ? replacement.end_date : replacement.end,
              ),
              allDay: replacement.all_day,
              timezone: replacement.timezone,
            }),
          ),
        ]);
      }
      if (action === "set-occurrence-copy") {
        const overrides: Record<string, unknown> = {};
        for (const key of ["title", "location", "organizer"] as const)
          if (values["use_" + key] === true)
            overrides[key] = text(values["copy_" + key]);
        if (values.use_description === true) {
          const previous = copy(fields).find(
            (item) => item.recurrenceId === selectedId,
          )?.overrides.description;
          overrides.description =
            previous !== undefined &&
            portableTextToPlainText(previous) === text(values.copy_description)
              ? previous
              : plainTextToPortableText(text(values.copy_description));
        }
        const retained = copy(fields).filter(
          (item) => item.recurrenceId !== selectedId,
        );
        effect = patch([
          set(
            "occurrence_content",
            Object.keys(overrides).length
              ? setNativeOccurrenceCopy(retained, selectedId, overrides)
              : retained,
          ),
        ]);
      }
      if (effect) message = "Date changes ready for review.";
    } else if (action) throw new Error("Unknown action. Reload the panel.");
    if (effect) {
      const next = { ...fields };
      for (const operation of effect.operations)
        next[operation.field] =
          operation.op === "clear" ? null : operation.value;
      if (
        action !== "apply-details" ||
        ["start", "end", "start_date", "end_date"].some((key) => next[key])
      )
        normalizeNativeSchedule(next, { allowStaleOccurrenceCopy: true });
      effect.operations = effect.operations.filter((operation) => {
        const before = fields[operation.field];
        if (operation.op === "clear")
          return before !== null && before !== undefined && before !== "";
        let comparable = before;
        if (
          typeof before === "string" &&
          (Array.isArray(operation.value) ||
            typeof operation.value === "object")
        ) {
          try {
            comparable = JSON.parse(before);
          } catch {}
        }
        return (
          JSON.stringify(comparable ?? "") !== JSON.stringify(operation.value)
        );
      });
      fields = next;
      if (!effect.operations.length) {
        effect = undefined;
        message = "These settings already match the draft.";
      }
    }
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Changes could not be applied.";
    effect = undefined;
  }
  const response = await renderPanel(fields, ctx, {
    selectedId,
    offset,
    windowStart,
    search: text(values.directory_search),
    values: error ? values : undefined,
    locale: entry.locale ?? "",
    uiLocale: route.ui?.locale || "en",
    error,
    message,
    action: text(request.action_id),
    origin: ctx.site?.url || new URL(route.request.url).origin,
  });
  return {
    ...response,
    ...(effect
      ? {
          patch: effect,
        }
      : {}),
  };
}

async function renderPanel(
  fields: Record<string, unknown>,
  ctx: EventualContext,
  state: {
    selectedId: string;
    offset: number;
    windowStart?: string;
    search?: string;
    values?: Record<string, unknown>;
    locale: string;
    uiLocale: string;
    error?: string;
    message?: string;
    action?: string;
    origin: string;
  },
): Promise<BlockResponse> {
  const blocks: BlockResponse["blocks"] = [
    {
      type: "context",
      block_id: "eventual-ui",
      text: "Review and apply proposed changes in EmDash, then save the draft or publish. Dates and venue are shared by all languages.",
    },
  ];
  if (state.error || state.message)
    blocks.push({
      type: "banner",
      variant: state.error ? "error" : "default",
      title: state.error ? "Check these details" : "Review changes in EmDash",
      description: state.error ?? state.message,
    });
  blocks.push(
    { type: "header", text: "When" },
    form(
      "apply-schedule",
      "Apply dates to draft",
      scheduleFields(fields, "", state.values),
    ),
  );
  const existing = recurrenceToFormValues(fields.recurrence);
  const defaults: Record<string, unknown> = {
    ...existing,
    frequency:
      existing.frequency === "monthly"
        ? existing.monthlyPatternType === "weekdayOfMonth"
          ? "monthly-weekday"
          : "monthly-day"
        : existing.frequency,
    ...state.values,
  };
  const monthlyDay = { field: "frequency", eq: "monthly-day" };
  const monthlyWeekday = { field: "frequency", eq: "monthly-weekday" };
  blocks.push(
    { type: "header", text: "Repeat" },
    { type: "section", text: formatHumanRecurrence(fields.recurrence) },
    form("apply-recurrence", "Apply repeat settings", [
      {
        type: "radio",
        action_id: "frequency",
        label: "Repeat",
        options: [
          { value: "none", label: "Does not repeat" },
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly-day", label: "Monthly — same date" },
          { value: "monthly-weekday", label: "Monthly — weekday position" },
        ],
        initial_value: text(defaults.frequency),
      },
      ...["daily", "weekly", "monthly-day", "monthly-weekday"].map((frequency): FormField => ({
        type: "number_input",
        action_id: "interval_" + (frequency === "daily" ? "days" : frequency === "weekly" ? "weeks" : frequency === "monthly-day" ? "months" : "months_weekday"),
        label: frequency === "daily" ? "Every … days" : frequency === "weekly" ? "Every … weeks" : "Every … months",
        initial_value: Number(defaults["interval_" + (frequency === "daily" ? "days" : frequency === "weekly" ? "weeks" : frequency === "monthly-day" ? "months" : "months_weekday")] ?? defaults.interval ?? 1),
        min: 1, max: 52,
        condition: { field: "frequency", eq: frequency },
      })),
      {
        ...date("until", "Last repeat date", defaults.until),
        condition: { field: "frequency", neq: "none" },
      },
      {
        type: "checkbox",
        action_id: "weekdays",
        label:
          "Days of the week (leave blank to use the first event’s weekday)",
        options: days,
        initial_value: Array.isArray(defaults.weekdays)
          ? defaults.weekdays
          : [],
        condition: { field: "frequency", eq: "weekly" },
      },
      {
        type: "number_input",
        action_id: "dayOfMonth",
        label: "Day of month",
        initial_value: Number(
          defaults.dayOfMonth || scheduleValues(fields).start.slice(8, 10) || 1,
        ),
        min: 1,
        max: 31,
        condition: monthlyDay,
      },
      {
        type: "radio",
        action_id: "missingDayBehavior",
        label: "When this day does not exist",
        options: [
          { value: "skip", label: "Skip that month" },
          { value: "lastDay", label: "Use the month’s last day" },
        ],
        initial_value: text(defaults.missingDayBehavior) || "skip",
        condition: monthlyDay,
      },
      {
        ...select(
          "position",
          "Weekday position",
          [1, 2, 3, 4, 5, "last"].map((value, i) => ({
            value: String(value),
            label: ["First", "Second", "Third", "Fourth", "Fifth", "Last"][i]!,
          })),
          String(defaults.position || 1),
        ),
        condition: monthlyWeekday,
      },
      {
        ...select("weekday", "Weekday", days, defaults.weekday || "monday"),
        condition: monthlyWeekday,
      },
    ]),
  );
  const schema = await eventSchema(ctx);
  fields = {
    ...fields,
    venue: fields[referenceField(schema, "venue")] ?? fields.venue,
    organizer_ref:
      fields[referenceField(schema, "organizer_ref")] ?? fields.organizer_ref,
  };
  const relationOptions = async (field: "venue" | "organizer_ref") => {
    const target = referenceTarget(schema, field);
    if (
      schema &&
      (await ctx.schema?.listCollections())?.some(
        (item) => item.slug === target,
      )
    ) {
      const entries = await listNative(ctx, target);
      const selected =
        state.values && Object.hasOwn(state.values, field)
          ? text(state.values[field])
          : referenceId(fields[field]);
      const directory = directoryChoices(entries, state.locale, selected, state.search, field === "venue");
      return { ...directory, configured: true, target, options: [
        {
          value: "",
          label: field === "venue" ? "No saved venue" : "No saved organizer",
        },
        ...directory.choices.map(({value,label}) => ({value,label})),
      ] };
    }
    return { target, configured: false, options: [{ value: "", label: "No collection configured" }], current: undefined, matches: 0 };
  };
  const [venues, organizers] = await Promise.all([
    relationOptions("venue"),
    relationOptions("organizer_ref"),
  ]);
  for (const [field, options] of [
    ["venue", venues.options],
    ["organizer_ref", organizers.options],
  ] as const) {
    const id = referenceId(fields[field]);
    if (id && !options.some((item) => item.value === id))
      options.push({
        value: id,
        label: "Unavailable selection — choose another",
      });
  }
  blocks.push(
    { type: "header", text: "Where" },
    form("search-directories", "Find saved venues & organizers", [
      input(
        "directory_search",
        "Find by name or address (up to 80 matches per list)",
        state.search,
      ),
    ]),
    form("apply-details", "Apply venue, organizer & categories", [
      {
        type: "combobox",
        action_id: "venue",
        label: "Saved venue",
        options: venues.options,
        initial_value: text(state.values?.venue ?? referenceId(fields.venue)),
        placeholder: "Search venues",
      },
      {
        type: "combobox",
        action_id: "organizer_ref",
        label: "Saved organizer",
        options: organizers.options,
        initial_value: text(
          state.values?.organizer_ref ?? referenceId(fields.organizer_ref),
        ),
        placeholder: "Search organizers",
      },
      input(
        "categories",
        "Categories (separate with commas)",
        state.values?.categories ??
          (parseJson(fields.categories) as string[] | undefined)?.join(", ") ??
          "",
      ),
    ]),
  );
  for (const [field, directory] of [["venue", venues], ["organizer_ref", organizers]] as const) {
    if (!directory.configured) continue;
    if (directory.current) blocks.push({ type: "fields", fields: [{ label: field === "venue" ? "Saved venue" : "Saved organizer", value: [directory.current.name, directory.current.address].filter(Boolean).join(" — ") }] });
    if (directory.current && !directory.current.published) blocks.push({ type: "banner", variant: "alert", title: "Publish this selection before publishing the event." });
    const path = "/_emdash/admin/content/" + encodeURIComponent(directory.target);
    blocks.push({ type: "actions", elements: [
      { type: "link", label: field === "venue" ? "Create venue" : "Manage organizers", target: { kind: "external", url: new URL(path + (field === "venue" ? "/new" : ""), state.origin).href } },
      ...(directory.current ? [{ type: "link" as const, label: field === "venue" ? "Edit selected venue" : "Edit selected organizer", target: { kind: "external" as const, url: new URL(path + "/" + encodeURIComponent(directory.current.editId), state.origin).href } }] : []),
    ] });
  }
  if (state.search && !venues.matches && !organizers.matches) blocks.push({ type: "context", text: "No results. Try another name or address, or create a venue." });
  blocks.push({ type: "actions", elements: [{ type: "button", action_id: "search-directories", label: "Refresh directories" }] });
  if (!fields.recurrence) return compactPanel(blocks, state);
  try {
    const first = scheduleValues(fields).start.slice(0, 10);
    const today = instantToLocalDateTime(new Date().toISOString(), scheduleValues(fields).timezone).slice(0, 10);
    const from = state.windowStart || (first > today ? first : today);
    const inspection = inspectNativeOccurrences(
      fields,
      from,
      addDays(from, 89),
      10,
      state.offset,
    );
    blocks.push(
      { type: "header", text: "Individual dates" },
      form("inspect-window", "Show dates", [
        date("from", "Show the 90 days starting on", from),
      ]),
      {
        type: "context",
        text: `${inspection.total} dates in this window. Schedule changes affect every language; announcement changes affect ${state.locale || "this language"} only.`,
      },
    );
    blocks.push({
      type: "table",
      page_action_id: "page-occurrences",
      columns: [
        { key: "date", label: "Original date" },
        { key: "effective", label: "Current date" },
        { key: "status", label: "Status", format: "badge" },
        { key: "action", label: "Manage", format: "element" },
      ],
      rows: inspection.occurrences.map((item) => ({
        date: displayDate(
          item.scheduledLocalStart,
          item.recurrenceId.length === 10,
          state.uiLocale,
        ),
        effective:
          displayDate(item.effectiveLocalStart, item.allDay, state.uiLocale) +
          (item.allDay ? " (all day)" : ""),
        status: item.status,
        action: {
          type: "button",
          action_id: "edit-occurrence",
          label: "Manage date",
          value: item.recurrenceId,
        },
      })),
      empty_text: "No dates in this window. Choose another start date.",
    });
    const elements: Extract<
      BlockResponse["blocks"][number],
      { type: "actions" }
    >["elements"] = [];
    if (state.offset)
      elements.push({
        type: "button",
        action_id: "page-occurrences",
        label: "Previous dates",
        value: JSON.stringify({ from, offset: Math.max(0, state.offset - 10) }),
      });
    if (inspection.hasMore)
      elements.push({
        type: "button",
        action_id: "page-occurrences",
        label: "Next dates",
        value: JSON.stringify({ from, offset: state.offset + 10 }),
      });
    if (elements.length) blocks.push({ type: "actions", elements });
    const selected = inspection.occurrences.find(
      (item) => item.recurrenceId === state.selectedId,
    );
    if (selected) {
      blocks.push(
        {
          type: "header",
          text:
            "Manage " +
            displayDate(
              selected.scheduledLocalStart,
              selected.recurrenceId.length === 10,
              state.uiLocale,
            ),
        },
        {
          type: "context",
          text:
            displayDate(
              selected.effectiveLocalStart,
              selected.allDay,
              state.uiLocale,
            ) +
            " – " +
            displayDate(
              selected.effectiveLocalEnd,
              selected.allDay,
              state.uiLocale,
            ) +
            " (" +
            selected.timezone +
            ")",
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              action_id: "cancel-occurrence",
              label: "Cancel this date",
              style: "danger",
              value: selected.recurrenceId,
              confirm: {
                title: "Cancel this date?",
                text: "This affects every language after you publish the draft.",
                confirm: "Cancel date",
                deny: "Keep date",
                style: "danger",
              },
            },
            {
              type: "button",
              action_id: "restore-occurrence",
              label: "Restore original schedule",
              value: selected.recurrenceId,
            },
            {
              type: "button",
              action_id: "clear-occurrence-copy",
              label: "Use series announcement",
              value: selected.recurrenceId,
            },
          ],
        },
      );
      const effective = {
        all_day: selected.allDay,
        timezone: selected.timezone,
        start: selected.effectiveStart,
        end: selected.effectiveEnd,
        start_date: selected.effectiveStart,
        end_date: selected.effectiveEnd,
      };
      blocks.push(
        form("reschedule-occurrence", "Apply new dates to draft", [
          select(
            "recurrence_id",
            "Original date",
            [
              {
                value: selected.recurrenceId,
                label: selected.scheduledLocalStart,
              },
            ],
            selected.recurrenceId,
          ),
          ...scheduleFields(effective, "override_", state.values),
        ]),
      );
      const editorial = selected.localizedCopy ?? {};
      blocks.push(
        form("set-occurrence-copy", "Apply announcement to draft", [
          select(
            "recurrence_id",
            "Announcement date",
            [
              {
                value: selected.recurrenceId,
                label: selected.scheduledLocalStart,
              },
            ],
            selected.recurrenceId,
          ),
          ...(
            ["title", "description", "location", "organizer"] as const
          ).flatMap((key): FormField[] => [
            {
              type: "toggle",
              action_id: "use_" + key,
              label: "Use a different " + key,
              initial_value:
                state.values && Object.hasOwn(state.values, "use_" + key)
                  ? state.values["use_" + key] === true
                  : Object.hasOwn(editorial, key),
            },
            {
              ...input(
                "copy_" + key,
                key[0]!.toUpperCase() + key.slice(1),
                state.values?.["copy_" + key] ??
                  (key === "description"
                    ? portableTextToPlainText(editorial[key])
                    : editorial[key]),
                key === "description",
              ),
              condition: { field: "use_" + key, eq: true },
            },
          ]),
        ]),
      );
    }
  } catch (err) {
    blocks.push({
      type: "banner",
      variant: "error",
      title: "Dates could not be shown",
      description:
        err instanceof Error ? err.message : "Check the event schedule.",
    });
  }
  return compactPanel(blocks, state);
}

function compactPanel(blocks: BlockResponse["blocks"], state: { action?: string; error?: string; selectedId: string; search?: string }) {
  const result: BlockResponse["blocks"] = [];
  let group: Extract<BlockResponse["blocks"][number], {type: "accordion"}> | undefined;
  for (const block of blocks) {
    if (block.type === "header" && ["When", "Where", "Repeat", "Individual dates"].includes(block.text)) {
      const label = block.text;
      group = { type: "accordion", block_id: "eventual-" + label, label, blocks: [], default_open: label === "When" || Boolean(state.error) || (label === "Where" && Boolean(state.search || state.action === "apply-details" || state.action === "search-directories")) || (label === "Repeat" && state.action === "apply-recurrence") || (label === "Individual dates" && Boolean(state.selectedId || state.action?.includes("occurrence") || state.action === "inspect-window")) };
      result.push(group);
    } else (group ? group.blocks : result).push(block);
  }
  const order = ["When", "Where", "Repeat", "Individual dates"];
  return { blocks: [...result.filter(block => block.type !== "accordion"), ...result.filter((block): block is Extract<typeof block, {type: "accordion"}> => block.type === "accordion").sort((a,b) => order.indexOf(a.label) - order.indexOf(b.label))] };
}
