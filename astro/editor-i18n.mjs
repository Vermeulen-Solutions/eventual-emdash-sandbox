/** Presentation only: never translate stored values, IDs, patches, or editorial rows. */
import { LOCALES, resolveLocale, textTranslator } from "@vermeulen.solutions/eventual-locales";

// Site code (not the sandbox): catalogs ship with the npm package and load per language, so the
// admin bundle carries only the language in use. Each import becomes its own chunk.
const catalogs = {
  fr: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/fr.json", { with: { type: "json" } }),
  de: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/de.json", { with: { type: "json" } }),
  nl: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/nl.json", { with: { type: "json" } }),
  es: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/es.json", { with: { type: "json" } }),
  it: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/it.json", { with: { type: "json" } }),
  pt: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/pt.json", { with: { type: "json" } }),
  "pt-BR": () => import("@vermeulen.solutions/eventual-locales/catalogs/core/pt-BR.json", { with: { type: "json" } }),
  pl: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/pl.json", { with: { type: "json" } }),
  cs: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/cs.json", { with: { type: "json" } }),
  sv: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/sv.json", { with: { type: "json" } }),
  da: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/da.json", { with: { type: "json" } }),
  nb: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/nb.json", { with: { type: "json" } }),
  fi: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/fi.json", { with: { type: "json" } }),
  ja: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/ja.json", { with: { type: "json" } }),
  "zh-CN": () => import("@vermeulen.solutions/eventual-locales/catalogs/core/zh-CN.json", { with: { type: "json" } }),
  ko: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/ko.json", { with: { type: "json" } }),
  tr: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/tr.json", { with: { type: "json" } }),
  uk: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/uk.json", { with: { type: "json" } }),
  ar: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/ar.json", { with: { type: "json" } }),
  he: () => import("@vermeulen.solutions/eventual-locales/catalogs/core/he.json", { with: { type: "json" } }),
};
const translators = new Map();
const pending = new Map();
const listeners = new Set();

/** Load the catalog for a UI locale; resolves once editorText can translate into it. */
export function loadEditorCatalog(locale) {
  const lang = resolveLocale(locale, LOCALES);
  if (lang === "en" || translators.has(lang)) return Promise.resolve();
  if (!pending.has(lang)) {
    pending.set(lang, Promise.resolve(catalogs[lang]?.())
      .then(module => { translators.set(lang, module ? textTranslator(module.default ?? module, lang) : null); })
      .catch(() => { translators.set(lang, null); })
      .then(() => { for (const listener of listeners) listener(); }));
  }
  return pending.get(lang);
}
/** Re-render hook point: called after a catalog arrives. Returns an unsubscribe function. */
export function onEditorCatalog(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
if (typeof document !== "undefined" && document.documentElement?.lang) loadEditorCatalog(document.documentElement.lang);

const publishReasons = ["Publish a valid referenced venue before publishing or scheduling this event.", "Publish the referenced organizer before publishing or scheduling this event."];
export function editorText(value, locale = "en") {
  if (typeof value !== "string") return value;
  const lang = resolveLocale(locale, LOCALES);
  if (lang === "en") return value;
  const translate = translators.get(lang);
  if (translate === undefined) { loadEditorCatalog(lang); return value; }
  if (!translate) return value;
  const translated = translate(value);
  if (translated !== value) return translated;
  // Host errors wrap these reasons in their own sentence; show the actionable part.
  for (const reason of publishReasons) if (value.includes(reason)) return translate(reason);
  return value;
}
const presentationKeys = new Set(["label", "text", "title", "description", "placeholder", "empty_text", "confirm", "deny"]);
const statuses = { scheduled: "Scheduled", cancelled: "Cancelled", modified: "Rescheduled", rescheduled: "Rescheduled", published: "Published", draft: "Draft", archived: "Archived" };
// English keeps the stored status word, as before; other languages get the translated label.
const statusText = (status, locale) => status in statuses && resolveLocale(locale, LOCALES) !== "en" ? editorText(statuses[status], locale) : status;
// Confirmed English fallbacks in core's 1.0.1 French catalog. Merge through
// Lingui's public API, preserving already translated or host-customized text.
const coreFrench = [
  ["xVT291","Live version",["Version publiée"]],
  ["TNKBrC","Visitors see this published version",["Les visiteurs voient cette version publiée"]],
  ["vaizKG","Publication date",["Date de publication"]],
  ["GJIQ9P","Created and updated",["Création et modification"]],
  ["mWCZbu","URL & language",["Adresse et langue"]],
  ["7FCZPo","Content language",["Langue du contenu"]],
  ["28x9RX","Choose bylines",["Choisir les collaborateurs"]],
  ["57VuPS","Drop an image here or <0>browse</0>",["Déposez une image ici ou <0>parcourez les fichiers</0>"]],
  ["jPRo6i",null,["Déposez une image ici ou choisissez un fichier pour ",["label"]]],
];
export function fillFrenchCoreMessages(i18n) {
  if(i18n.locale !== "fr") return false;
  const patch={};
  for(const [id,english,translation] of coreFrench) {
    const expected=english===null ? ["Drop an image here or browse for ",["label"]] : [english];
    if(i18n.messages[id]===undefined || JSON.stringify(i18n.messages[id])===JSON.stringify(expected)) patch[id]=translation;
  }
  if(!Object.keys(patch).length) return false;
  i18n.load("fr",patch);return true;
}
// Presentation labels only. Unique native IDs identify selections; never copy
// these labels into the draft patch or change the host's receipt validation.
const directoryLabels = new Map();
export function draftSummary(field, source, locale, timezone = "UTC") {
  if (source === null || source === undefined || source === "") return "—";
  let value = source;
  if (["recurrence", "exceptions", "occurrence_content", "categories"].includes(field) && typeof value === "string") {
    try { value = JSON.parse(value); } catch { return editorText("Stored event data needs repair", locale); }
  }
  if (["venue", "venue_id", "organizer_ref", "organizer_id"].includes(field)) return directoryLabels.get(String(value)) ?? String(value);
  if (typeof value === "boolean") return editorText(value ? "Yes" : "No", locale);
  if (field === "recurrence" && value && typeof value === "object") {
    const n=value.interval ?? 1, unit={daily:"days",weekly:"weeks",monthly:"months"}[value.frequency];
    let summary=n===1 ? value.frequency : `every ${n} ${unit}`;
    if (value.frequency === "weekly" && value.weekdays?.length) summary=`every ${n===1 ? "week" : `${n} weeks`} on ` + value.weekdays.map(day=>day[0].toUpperCase()+day.slice(1)).join(", ");
    if (value.frequency === "monthly" && value.pattern) {
      const p=value.pattern;
      summary += p.type === "dayOfMonth" ? ` on day ${p.dayOfMonth} (${p.missingDayBehavior === "skip" ? "skip missing months" : "use last day if missing"})` : ` on ${p.position === "last" ? "last" : ["first","second","third","fourth","fifth"][p.position-1]} ${p.weekday[0].toUpperCase()+p.weekday.slice(1)}`;
    }
    return editorText(summary + " through " + value.until,locale);
  }
  if (Array.isArray(value)) {
    if (field === "categories") return value.join(", ") || "—";
    if (field === "exceptions" || field === "occurrence_content") return value.length ? value.map(item=>{
      const original=String(item.recurrenceId ?? item.date ?? "");let date=original;
      try {date=new Intl.DateTimeFormat(locale,{dateStyle:"medium",...(original.length===10 ? {} : {timeStyle:"short"}),timeZone:"UTC"}).format(new Date(original.length===10 ? original : original+"Z"));} catch {}
      const overrides=item.overrides ?? {};
      if(field === "exceptions") return date+" — "+(item.status ? statusText(item.status, locale) : editorText("Changed date", locale))+(overrides.start ? " → "+draftSummary("start",overrides.start,locale,overrides.timezone || timezone)+(overrides.end ? " – "+draftSummary("end",overrides.end,locale,overrides.timezone || timezone) : "") : "");
      const plain=value=>typeof value === "string" ? value : Array.isArray(value) ? value.flatMap(block=>block.children?.map(child=>child.text ?? "") ?? []).join(" ") : String(value);
      return date+" — "+Object.entries(overrides).map(([key,value])=>editorText(key[0].toUpperCase()+key.slice(1),locale)+": "+plain(value)).join("; ");
    }).join("; ") : "—";
  }
  if (["start","end","start_date","end_date"].includes(field)) {
    try { return new Intl.DateTimeFormat(locale, {dateStyle:"long",...(String(value).length===10 ? {} : {timeStyle:"short"}),timeZone:String(value).length===10 ? "UTC" : timezone}).format(new Date(String(value))); } catch { return String(value); }
  }
  return typeof value === "string" ? value : String(value);
}
export function localizeEventualBlocks(blocks, locale) {
  if (!blocks.some(block => block.block_id === "eventual-ui")) return blocks;
  const walk = (value, parent = "") => {
    if (Array.isArray(value)) return value.flatMap(item => item?.type === "table" && item.rows?.every(row=>row.action?.action_id === "edit-occurrence") ? walk(item,parent) : [walk(item,parent)]);
    if (!value || typeof value !== "object") return value;
    if (value.block_id === "eventual-verbatim") return value;
    if(value.type === "table" && value.rows?.every(row=>row.action?.action_id === "edit-occurrence")) {
      if(!value.rows.length) return [{type:"context",text:editorText(value.empty_text,locale)}];
      return value.rows.flatMap(row=>{
        const id="eventual-date-"+row.action.value;
        const fields=row.date === row.effective ? [{label:editorText("Date",locale),value:row.date}] : [{label:editorText("Original date",locale),value:row.date},{label:editorText("Current date",locale),value:row.effective}];
        if(row.status !== "scheduled") fields.push({label:editorText("Status",locale),value:statusText(row.status, locale)});
        return [{type:"fields",block_id:id,fields},{type:"actions",block_id:id+"-actions",elements:[walk(row.action)]},{type:"divider",block_id:id+"-end"}];
      });
    }
    if (["venue","organizer_ref"].includes(value.action_id) && Array.isArray(value.options)) {
      for (const option of value.options) if (option.value) directoryLabels.set(option.value, option.label);
      while (directoryLabels.size > 10000) directoryLabels.delete(directoryLabels.keys().next().value);
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      if (key === "rows") return [key, item.map(row => ({ ...row, status: statusText(row.status, locale), ...Object.fromEntries(Object.entries(row).filter(([, cell]) => cell && typeof cell === "object" && cell.type).map(([column, cell]) => [column, walk(cell)])) }))];
      // Values/options contain stored values; localize only their presentation properties.
      if (presentationKeys.has(key) && typeof item === "string") return [key, editorText(item, locale)];
      if (["initial_value", "value", "target", "condition"].includes(key)) return [key, item];
      return [key, walk(item, key)];
    }));
  };
  return walk(blocks);
}
