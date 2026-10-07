import type { OrganizerRecord } from './domain/event';
import { safeHttpUrl } from './domain/venue';
import { organizerCollection, nextUpdatedAt, type EventualContext } from './storage';

export async function saveOrganizer(ctx: EventualContext, input: { name: string; website?: string; contactUrl?: string }, id?: string, expectedUpdatedAt?: string) {
  const fields = { name: input.name.trim(), website: input.website?.trim() ?? '', contactUrl: input.contactUrl?.trim() ?? '' };
  if (!fields.name || fields.name.length > 200 || [fields.website, fields.contactUrl].some(url => url.length > 2048 || url && !safeHttpUrl(url))) return { ok: false as const, error: 'Use a name and valid public HTTP(S) URLs.' };
  const collection = organizerCollection(ctx);
  const previous = id ? await collection.getVersioned(id) : null;
  if (id && (!previous || previous.value.updatedAt !== expectedUpdatedAt)) return { ok: false as const, error: 'This organizer changed. Reload before saving.' };
  const now = nextUpdatedAt(previous?.value.updatedAt);
  const organizer: OrganizerRecord = { ...fields, website: safeHttpUrl(fields.website), contactUrl: safeHttpUrl(fields.contactUrl), id: id ?? crypto.randomUUID(), createdAt: previous?.value.createdAt ?? now, updatedAt: now };
  const result = await collection.compareAndSet(organizer.id, previous?.revision ?? null, organizer);
  return result.applied ? { ok: true as const, organizer } : { ok: false as const, error: 'This organizer changed. Reload before saving.' };
}
