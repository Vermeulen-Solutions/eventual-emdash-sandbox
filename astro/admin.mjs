/** Frontend companion for configured sites. Eventual's backend stays sandboxed. */
import { createElement as h, useEffect, useRef, useState } from "react";
import { useLocale } from "@emdash-cms/admin";
import {i18n} from "@lingui/core";
import { editorText,fillFrenchCoreMessages } from "./editor-i18n.mjs";
export { eventualEditor, createPlugin } from "./descriptor.mjs";
function useText() { const { locale } = useLocale(); useEffect(()=>{fillFrenchCoreMessages(i18n);},[locale]); return value => editorText(value, locale); }

// Core field widgets receive one value. Scope attendance presentation to the
// enclosing editor form; this never changes, clears or persists another field.
const attendance = new WeakMap();
function useAttendance(ref, value) {
  const [mode, setMode] = useState("physical");
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let store = attendance.get(form);
    if (!store) { store = { value: "physical", listeners: new Set() }; attendance.set(form, store); }
    store.listeners.add(setMode);
    if (value !== undefined) {
      store.value = value || "physical";
      for (const listener of store.listeners) listener(store.value);
    } else setMode(store.value);
    return () => store.listeners.delete(setMode);
  }, [value]);
  return mode;
}

// Returning null uses core's supported plugin field renderer hook. The field
// remains in formData, snapshots, revisions and the database; no CSS hiding.
function ManagedField({ id }) {
  const t = useText();
  return id === "field-start"
    ? h(
        "aside",
        {
          className:
            "rounded-md border border-kumo-line p-4 text-sm leading-relaxed",
          "aria-label": t("Event dates"),
        },
        t("Set dates, choose a saved venue and manage repeats in “Dates, venue & repeat” in the settings panel. For a new event, save its first draft to open that panel."),
      )
    : null;
}
const fieldHelp = {
  "field-excerpt":
    "An optional short summary for event listings. The full announcement stays in Description.",
  "field-image_url":
    "Use this only for an image hosted elsewhere. Prefer Event image from the media library.",
  "field-location":
    "Extra information such as a room or entrance. It appears alongside the saved venue’s address and can be translated.",
  "field-organizer":
    "Leave blank to use the saved organizer’s name. Change it here only when this language needs a different display name.",
  "field-virtual_url": "Link visitors use to join an online or hybrid event.",
  "field-external_url":
    "Link visitors use to register or read more about the event.",
};
function OptionalText({ value, onChange, label, id }) {
  const t = useText();
  const ref = useRef(null);
  const mode = useAttendance(ref);
  const [open, setOpen] = useState(false);
  const url = id.endsWith("_url");
  const multiline = id === "field-excerpt";
  return h(
    "details",
    {
      className: "rounded-md border border-kumo-line p-4",
      ref,
      hidden: id === "field-virtual_url" && mode === "physical",
      open,
      onToggle: event => setOpen(event.currentTarget.open),
    },
    h("summary", { className: "cursor-pointer text-base font-medium break-words" }, t(label), value ? h("span", { className: "ms-2 text-sm font-normal text-kumo-subtle" }, t("Added")) : null),
    h(
      "div",
      { className: "mt-3 grid gap-2" },
      h("label", { htmlFor: id, className: "text-sm", id: id + "-help" }, t(fieldHelp[id] || label)),
      h(multiline ? "textarea" : "input", {
        id,
        "aria-describedby": id + "-help",
        value: typeof value === "string" ? value : "",
        ...(!multiline ? { type: url ? "url" : "text" } : { rows: 3 }),
        onChange: (event) => onChange(event.target.value),
        className:
          "w-full rounded-md border border-kumo-line bg-kumo-base p-2 text-base",
      }),
    ),
  );
}
function LocationType({ value, onChange, label, id }) {
  const t = useText();
  const ref = useRef(null);
  useAttendance(ref, value || "physical");
  return h(
    "label",
    { htmlFor: id, className: "grid gap-2" },
    h("span", { className: "text-base font-medium" }, t(label)),
    h(
      "select",
      {
        id,
        ref,
        value: value || "physical",
        onChange: (event) => onChange(event.target.value),
        className:
          "rounded-md border border-kumo-line bg-kumo-base p-2 text-base",
      },
      ...[
        ["physical", "In person"],
        ["virtual", "Online"],
        ["hybrid", "In person and online"],
      ].map(([value, label]) => h("option", { key: value, value }, t(label))),
    ),
  );
}
function EventStatus({ value, onChange, label, id }) {
  const t = useText();
  return h(
    "label",
    { htmlFor: id, className: "grid gap-2" },
    h("span", { className: "text-base font-medium" }, t(label)),
    h(
      "select",
      {
        id,
        value: value || "published",
        onChange: (event) => onChange(event.target.value),
        className:
          "rounded-md border border-kumo-line bg-kumo-base p-2 text-base",
      },
      ...[
        ["published", "Happening as planned"],
        ["cancelled", "Cancelled"],
        ["postponed", "Postponed (new date to be confirmed)"],
        ["rescheduled", "Rescheduled"],
      ].map(([value, label]) => h("option", { key: value, value }, t(label))),
    ),
    h(
      "span",
      { className: "text-sm text-kumo-subtle" },
      t("Describes the event itself. Use Publish to make it visible on the site."),
    ),
  );
}
export const fields = {
  managed: ManagedField,
  "event-status": EventStatus,
  "optional-text": OptionalText,
  "location-type": LocationType,
};
