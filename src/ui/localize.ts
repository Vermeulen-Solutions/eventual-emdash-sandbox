import type { BlockResponse } from '@emdash-cms/blocks';
import type { Translate } from './i18n';

const keys = new Set(['label', 'text', 'title', 'description', 'placeholder', 'empty_text', 'confirm', 'deny', 'message']);
const verbatimOptions = new Set(['venueId', 'organizerId', 'venue', 'organizer_ref', 'imageMediaId', 'timezone', 'eventIds', 'events', 'venues', 'organizers']);

/** Translate presentation, never IDs, form values, user copy or mutation payloads. */
export function localizeResponse(response: BlockResponse, translate: Translate): BlockResponse {
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object') return value;
    const item = value as Record<string, unknown>;
    if (String(item.block_id).startsWith('eventual-verbatim')) return item;
    return Object.fromEntries(Object.entries(item).map(([key, child]) => {
      if (['value', 'initial_value', 'target', 'condition', 'patch'].includes(key)) return [key, child];
      if (key === 'options' && verbatimOptions.has(String(item.action_id))) return [key, (child as { value: string; label: string }[]).map(option => option.value === '' ? { ...option, label: translate(option.label) } : option)];
      // Text cells are data (titles, dates), not UI copy: only a row's buttons and links, its status
      // badges ("draft" → "Draft" → catalog) and the "{date} (all day)" suffix are translated.
      if (key === 'rows') return [key, (child as Record<string, unknown>[]).map(row => Object.fromEntries(Object.entries(row).map(([cell, text]) => {
        if (typeof text != 'string') return [cell, walk(text)];
        const word = text[0]?.toUpperCase() + text.slice(1), out = (item.columns as { key: string; format?: string }[]).some(c => c.key == cell && c.format == 'badge') ? translate(word) : cell == 'effective' ? translate(text) : text;
        return [cell, out == word ? text : out];
      })))];
      if (key === 'label' && item.action_id === 'edit-organizer') return [key, child];
      return [key, keys.has(key) && typeof child === 'string' ? translate(child) : walk(child)];
    }));
  };
  return walk(response) as BlockResponse;
}
