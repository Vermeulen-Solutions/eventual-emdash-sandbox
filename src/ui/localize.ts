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
      // Table cells and directory/editorial button names are data, not UI copy.
      if (key === 'rows') return [key, child];
      if (key === 'label' && item.action_id === 'edit-organizer') return [key, child];
      return [key, keys.has(key) && typeof child === 'string' ? translate(child) : walk(child)];
    }));
  };
  return walk(response) as BlockResponse;
}
