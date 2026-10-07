import type { CollectionSchemaInfo } from 'emdash';
import type { EventualContext } from '../storage';

export interface CollectionBindings { events: string; venues: string; organizers: string }
export const COLLECTION_SETTINGS_KEY = 'collections';
const slug = /^[a-z][a-z0-9_]{0,62}$/;
export async function eventCollectionName(ctx:EventualContext) {
  return (await ctx.settings?.get<CollectionBindings>(COLLECTION_SETTINGS_KEY))?.events ?? 'events';
}

/** Explicit selections fail closed. Removing a collection never revives legacy writes. */
export async function collectionBindings(ctx: EventualContext) {
  const selected = await ctx.settings?.get<CollectionBindings>(COLLECTION_SETTINGS_KEY);
  const schemas = await ctx.schema?.listCollections() ?? [];
  if (selected && (!selected.events || Object.values(selected).some(value => typeof value !== 'string' || (value !== '' && !slug.test(value)))))
    throw new Error('Invalid collection settings. Choose the collections again in Eventual settings.');
  const events = selected?.events ?? 'events';
  const schema = schemas.find(item => item.slug === events);
  if (selected && !schema) throw new Error('The selected event collection is missing. Choose it again in Eventual settings.');
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
    if(name && !schemas.some(item=>item.slug===name)) throw new Error('A selected directory collection is missing. Review Eventual settings.');
  return { ...bindings, schema, schemas, configured: !!selected };
}

/** Validate before storing all three choices atomically as a single setting. */
export async function saveCollectionBindings(ctx: EventualContext, bindings: CollectionBindings) {
  if (!bindings.events || Object.values(bindings).some(value => typeof value !== 'string' || (value !== '' && !slug.test(value))))
    throw new Error('Choose valid collection names.');
  const schemas = await ctx.schema?.listCollections() ?? [];
  const schema = schemas.find(item => item.slug === bindings.events);
  if (!schema) throw new Error('Choose an existing event collection.');
  const required: Record<string, string> = {title:'string', description:'portableText', start:'datetime', end:'datetime', start_date:'string', end_date:'string', all_day:'boolean', timezone:'string', recurrence:'json', exceptions:'json', occurrence_content:'json'};
  for (const [name, type] of Object.entries(required)) {
    const field = schema.fields.find(item => item.slug === name);
    if (!field || field.type !== type) throw new Error('Event collection needs '+name+' ('+type+'). Apply the Eventual blueprint first.');
    const translatable = ['title','description','occurrence_content'].includes(name);
    if (field.translatable !== translatable) throw new Error('Set '+name+' translatable to '+translatable+' before selecting this collection.');
  }
  for (const [key, fieldName] of [['venues','venue'],['organizers','organizer_ref']] as const) {
    const selected = bindings[key];
    const directory = schemas.find(item => item.slug === selected);
    if (selected && (!directory || !directory.fields.some(item => ['name','title'].includes(item.slug) && item.type === 'string')))
      throw new Error('Choose a '+key+' collection with a name or title field.');
    const field = schema.fields.find(item => item.slug === fieldName);
    const reference = schema.fields.find(item => item.slug === (field?.validation?.relation ? key === 'venues' ? 'venue_id' : 'organizer_id' : fieldName));
    const target = reference?.validation?.targetCollection ?? reference?.options?.collection;
    if (selected && (reference?.type !== 'reference' || target !== selected))
      throw new Error('Set the event '+fieldName+' reference target to '+selected+' first.');
    if (!selected && reference) throw new Error('This event schema has a '+fieldName+' reference. Select its target collection.');
    if (reference?.translatable !== undefined && reference.translatable !== false)
      throw new Error('Event references must be shared across languages.');
  }
  await ctx.settings.set(COLLECTION_SETTINGS_KEY, bindings);
}
