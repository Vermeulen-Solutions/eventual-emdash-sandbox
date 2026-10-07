import type { BlockResponse } from '@emdash-cms/blocks';
import type { SandboxedRouteContext } from 'emdash/plugin';
import type { EventualContext } from '../storage';
import { eventSchema } from '../domain/native-references';
import { computeSchedulePanel } from './schedule-panel';
import { renderCompactSchedule } from './compact-panel';

const token = (entry: {updatedAt:string;draftRevisionId?:string|null;status:string}) => JSON.stringify([entry.updatedAt, entry.draftRevisionId ?? '', entry.status]);
const failure = (message:string):BlockResponse => ({blocks:[{type:'banner',title:message,variant:'error'}]});

/** Global saved-entry panels support arbitrary configured collection slugs.
 * They never accept client draft snapshots or edit announcement fields.
 * Core owns drafts/publishing; changes are written to its latest draft only.
 */
export async function handleSavedSchedulePanel(route: SandboxedRouteContext, ctx: EventualContext):Promise<BlockResponse> {
  const schema = await eventSchema(ctx), identity = route.ui?.entry;
  if (!schema || identity?.collection !== schema.slug) return {blocks:[{type:'context',text:'Eventual manages the event collection selected in its settings.'}]};
  const entry = await ctx.content?.get(schema.slug, identity.id);
  if (!entry) return failure('This event no longer exists.');
  const revision = entry.draftRevisionId ? await ctx.content?.getRevision?.(schema.slug, entry.id, entry.draftRevisionId) : undefined;
  const data = revision?.data ?? entry.data;
  const input = route.input && typeof route.input === 'object' ? route.input as Record<string,unknown> : {};
  let [action, expected] = String(input.action_id ?? '').split('|');
  if(input.type !== 'panel_load' && expected !== encodeURIComponent(token(entry))) return failure('This event changed. Close and reopen the panel before trying again.');
  if(action?.startsWith('page-occurrences-')) action='page-occurrences';
  if(action?.startsWith('window-')) {action='inspect-window';input.values={from:input.value};}
  const result = await computeSchedulePanel({...route,input:{...input,action_id:action,draft:{fields:data}}},ctx);
  if('blocks' in result) return result as BlockResponse;
  const operations = result.effect?.operations;
  if(operations?.length) {
    const current = await ctx.content!.get(schema.slug, entry.id);
    if(!current || token(current) !== token(entry)) return failure('This event changed. Close and reopen the panel before trying again.');
    const allowed = new Set(schema.fields.filter(field=>!field.validation?.relation).map(field=>field.slug));
    const updates:Record<string,unknown> = {};
    for(const operation of operations) {
      if(!allowed.has(operation.field) || ['title','description','excerpt'].includes(operation.field)) return failure('The event schema needs an administrator to review this field.');
      updates[operation.field]=operation.op === 'clear' ? null : operation.value;
    }
    await ctx.content!.update!(schema.slug,entry.id,updates);
    return {blocks:[{type:'context',text:'Schedule saved as an EmDash draft. Publish in the content editor when ready.'}],refresh:true,toast:{message:'Schedule draft saved.',type:'success'}};
  }
  // Every form/button carries the version it was rendered against. This catches
  // stale dialogs without treating the client's fields as authoritative.
  const stamp = encodeURIComponent(token(entry));
  const walk = (value:unknown):unknown => {
    if(Array.isArray(value)) return value.map(walk);
    if(!value || typeof value !== 'object') return value;
    const object=value as Record<string,unknown>;
    return Object.fromEntries(Object.entries(object).map(([key,child])=>[key,
      key === 'action_id' && (object.type === 'button' || !object.type && 'label' in object) ? String(child)+'|'+stamp : walk(child)]));
  };
  const response=await renderCompactSchedule(result.fields,ctx,result.state);
  response.blocks = walk(response.blocks) as BlockResponse['blocks'];
  response.blocks.unshift({type:'context',text:'Save announcement edits first. This panel updates the saved draft. Publish in core. Dates and venue are shared across languages.'});
  return response;
}
