import type { PluginContentItem } from "emdash";
import { normalizeVenueRecord } from "../domain/venue-adapter";

/** One choice per translation group; keep a saved row ID unchanged. */
export function directoryChoices(entries: PluginContentItem[], locale: string, selected: string | undefined, search = "", venue = false) {
  const groups = new Map<string, PluginContentItem[]>();
  for (const item of entries) {
    const key = item.translationGroup || item.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const choices = [...groups.values()].map(group => {
    const sorted = [...group].sort((a, b) => Number(b.status === "published") - Number(a.status === "published") || a.id.localeCompare(b.id));
    const chosen = sorted.find(item => item.id === selected) ?? sorted[0]!;
    const display = sorted.find(item => item.status === "published" && item.locale?.toLowerCase() === locale.toLowerCase()) ?? sorted.find(item => item.status === "published") ?? sorted.find(item => item.locale?.toLowerCase() === locale.toLowerCase()) ?? sorted[0]!;
    const normalized = venue ? normalizeVenueRecord(display) : undefined;
    const name = String(display.data.name ?? display.data.title ?? display.id);
    const address = normalized?.address ?? "";
    return { value: chosen.id, editId: display.id, label: name + (address ? " — " + address : "") + " [" + (display.locale || "default").toUpperCase() + "]" + (chosen.status === "published" ? "" : " (publish before the event)"), name, address, published: chosen.status === "published" };
  }).sort((a, b) => a.label.localeCompare(b.label));
  const query = search.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const matches = choices.filter(item => !query || item.label.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(query));
  const visible = matches.slice(0, 80);
  const current = choices.find(item => item.value === selected);
  if (current && !visible.includes(current)) visible.push(current);
  return { choices: visible, current, matches: matches.length };
}
