import type { BlockResponse } from '@emdash-cms/blocks';
import { listOrganizers, organizerCollection, type EventualContext } from './storage';
import { saveOrganizer } from './organizers';

export async function handleOrganizerAdmin(input: { type: string; page?: string; action_id?: string; value?: unknown; block_id?: string; values?: Record<string, unknown> }, ctx: EventualContext): Promise<BlockResponse | null> {
  if (input.type === 'page_load' && input.page === '/organizers' || input.action_id === 'back-to-organizers') {
    const organizers = await listOrganizers(ctx);
    return { blocks: [
      { type: 'header', text: 'Organizers' },
      { type: 'context', text: 'Names, websites, and contact links are public. Choose a saved organizer in the event form, or keep using free text.' },
      { type: 'actions', elements: [{ type: 'button', action_id: 'new-organizer', label: 'Add organizer' }, { type: 'link', label: 'Events', target: { kind: 'plugin-page', path: '/events' } }] },
      ...organizers.map(organizer => ({ type: 'actions' as const, elements: [{ type: 'button' as const, action_id: 'edit-organizer', label: organizer.name, value: organizer.id }] })),
    ] };
  }
  if (input.action_id === 'new-organizer' || input.action_id === 'edit-organizer') {
    const organizer = typeof input.value === 'string' ? await organizerCollection(ctx).get(input.value) : null;
    if (input.action_id === 'edit-organizer' && !organizer) return { blocks: [{ type: 'banner', title: 'Organizer not found', variant: 'error' }] };
    return { blocks: [
      { type: 'header', text: organizer ? 'Edit organizer' : 'Add organizer' },
      { type: 'context', text: 'Only public HTTP(S) contact links are accepted. Private contact details belong outside Eventual.' },
      { type: 'actions', elements: [{ type: 'button', action_id: 'back-to-organizers', label: 'Back to organizers' }] },
      { type: 'form', block_id: `organizer:${encodeURIComponent(organizer?.id ?? '')}:${encodeURIComponent(organizer?.updatedAt ?? '')}`, submit: { action_id: 'save-organizer', label: 'Save organizer' }, fields: ['name', 'website', 'contactUrl'].map(key => ({ type: 'text_input' as const, action_id: key, label: key === 'contactUrl' ? 'Public contact URL' : key === 'website' ? 'Website' : 'Name', initial_value: organizer?.[key as 'name' | 'website' | 'contactUrl'] ?? '' })) },
    ] };
  }
  if (input.type === 'form_submit' && input.action_id === 'save-organizer') {
    const values = input.values;
    const parts = input.block_id?.split(':');
    if (!parts || parts.length !== 3 || parts[0] !== 'organizer' || !values || !['name', 'website', 'contactUrl'].every(key => typeof values[key] === 'string')) return { blocks: [{ type: 'banner', title: 'Invalid organizer form', variant: 'error' }] };
    let expected: string, id: string;
    try { expected = decodeURIComponent(parts[2]!); id = decodeURIComponent(parts[1]!); } catch { return { blocks: [{ type: 'banner', title: 'Invalid organizer version', variant: 'error' }] }; }
    const result = await saveOrganizer(ctx, values as unknown as { name: string; website: string; contactUrl: string }, id || undefined, expected);
    return result.ok ? { ...(await handleOrganizerAdmin({ type: 'page_load', page: '/organizers' }, ctx))!, toast: { message: 'Organizer saved', type: 'success' } } : { blocks: [{ type: 'banner', title: 'Organizer not saved', description: result.error, variant: 'error' }, { type: 'actions', elements: [{ type: 'button', action_id: 'back-to-organizers', label: 'Reload organizers' }] }] };
  }
  return null;
}
