import { reject } from './messages';
import type { CollectionSchemaInfo } from 'emdash';
import type { EventualContext } from '../storage';
import {requestMemo, forgetRequestMemo} from './request-memo';

export interface CollectionBindings { events: string; venues: string; organizers: string }
export const COLLECTION_SETTINGS_KEY = 'collections';
const slug = /^[a-z][a-z0-9_]{0,62}$/;
export async function eventCollectionName(ctx:EventualContext) {
  return (await collectionSettings(ctx))?.events ?? 'events';
}

export function collectionSettings(ctx: EventualContext) {
  return requestMemo(ctx, 'collection-settings', async () => await ctx.settings?.get<CollectionBindings>(COLLECTION_SETTINGS_KEY) ?? undefined);
}
/** Raw discovery stays available when a selected collection needs repair. */
export function collectionSchemas(ctx: EventualContext) {
  return requestMemo(ctx, 'schemas', async () => await ctx.schema?.listCollections() ?? []);
}

interface LoadedCollectionBindings extends CollectionBindings {
  schema: CollectionSchemaInfo | undefined;
  schemas: CollectionSchemaInfo[];
  configured: boolean;
}

export function collectionBindings(ctx: EventualContext): Promise<LoadedCollectionBindings> {
  return requestMemo(ctx, 'bindings', () => loadCollectionBindings(ctx));
}

/** Explicit selections fail closed. Removing a collection never revives legacy writes. */
async function loadCollectionBindings(ctx: EventualContext): Promise<LoadedCollectionBindings> {
  const selected = await collectionSettings(ctx);
  const schemas = await collectionSchemas(ctx);
  if (selected && (!selected.events || Object.values(selected).some(value => typeof value !== 'string' || (value !== '' && !slug.test(value)))))
    reject('Invalid collections. Choose them again in Eventual settings.');
  const events = selected?.events ?? 'events';
  const schema = schemas.find(item => item.slug === events);
  if (selected && !schema) reject('The selected event collection is missing.');
  const target = (field: string, fallback: string) => {
    const definition = schema?.fields?.find(item => item.slug === field);
    return String(definition?.validation?.targetCollection ?? definition?.options?.collection ?? fallback);
  };
  const bindings: CollectionBindings = {
    events,
    venues: selected?.venues ?? target('venue', 'venues'),
    organizers: selected?.organizers ?? target('organizer_ref', 'organizers'),
  };
  if(selected) for(const name of [bindings.venues,bindings.organizers])
    if(name && !schemas.some(item=>item.slug===name)) reject('Selected directory missing. Review Eventual settings.');
  return { ...bindings, schema, schemas, configured: !!selected };
}

/** Validate before storing all three choices atomically as a single setting. */
export async function saveCollectionBindings(ctx: EventualContext, bindings: CollectionBindings) {
  if (!bindings.events || Object.values(bindings).some(value => typeof value !== 'string' || (value !== '' && !slug.test(value))))
    reject('Choose valid collection names.');
  const schemas = await collectionSchemas(ctx);
  const schema = schemas.find(item => item.slug === bindings.events);
  if (!schema) reject('Choose an existing event collection.');
  const required: Record<string, string> = {title:'string', description:'portableText', start:'datetime', end:'datetime', start_date:'string', end_date:'string', all_day:'boolean', timezone:'string', recurrence:'json', exceptions:'json', occurrence_content:'json'};
  for (const [name, type] of Object.entries(required)) {
    const field = schema.fields.find(item => item.slug === name);
    if (!field || field.type !== type) reject('Event collection needs '+name+' ('+type+'). Apply the Eventual blueprint first.');
    const translatable = ['title','description','occurrence_content'].includes(name);
    if (field.translatable !== translatable) reject('Set '+name+' translatable to '+translatable+' before selecting this collection.');
  }
  for (const [key, fieldName] of [['venues','venue'],['organizers','organizer_ref']] as const) {
    const selected = bindings[key];
    const directory = schemas.find(item => item.slug === selected);
    if (selected && (!directory || !directory.fields.some(item => ['name','title'].includes(item.slug) && item.type === 'string')))
      reject('Choose a '+key+' collection with a name or title field.');
    const field = schema.fields.find(item => item.slug === fieldName);
    const reference = schema.fields.find(item => item.slug === (field?.validation?.relation ? key === 'venues' ? 'venue_id' : 'organizer_id' : fieldName));
    const target = reference?.validation?.targetCollection ?? reference?.options?.collection;
    if (selected && (reference?.type !== 'reference' || target !== selected))
      reject('Set the event '+fieldName+' reference target to '+selected+' first.');
    if (!selected && reference) reject('This event schema has a '+fieldName+' reference. Select its target collection.');
    if (reference?.translatable !== undefined && reference.translatable !== false)
      reject('Event references must be shared across languages.');
  }
  await ctx.settings.set(COLLECTION_SETTINGS_KEY, bindings);
  forgetRequestMemo(ctx, 'collection-settings');
  forgetRequestMemo(ctx, 'bindings');
}
