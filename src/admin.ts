import { reject } from './domain/messages';
import type {BlockResponse, FormField} from '@emdash-cms/blocks';
import type {SandboxedRouteContext} from 'emdash/plugin';
import type {EventualContext} from './storage';
import {handleAdmin as nativeWorkspace} from './native-admin';
import {collectionBindings, saveCollectionBindings, collectionSettings, collectionSchemas, legacyReadsEnabled, LEGACY_READS_SETTING_KEY, type CollectionBindings} from './domain/collections';
import {isValidTimeZone} from './domain/date-time';
import {withInvocationBudget} from './domain/invocation-budget';

const context=(text:string):BlockResponse['blocks'][number]=>({type:'context',text});
const nav=():BlockResponse['blocks'][number]=>({type:'actions',elements:[['/events','Events'],['/venues','Venues'],['/organizers','Organizers'],['/settings','Settings']].map(([path,label])=>({type:'button',action_id:'open-page:'+path,label,value:path}))});
const collectionLink=(ctx:EventualContext,slug:string,label:string):BlockResponse['blocks'][number]=>({type:'actions',elements:[{type:'link',label,target:{kind:'external',url:new URL('/_emdash/admin/content/'+encodeURIComponent(slug),ctx.site.url).href}}]});

async function settings(ctx:EventualContext,error?:string):Promise<BlockResponse> {
  // This page repairs removed/broken bindings; do not resolve them first.
  const selected=await collectionSettings(ctx);
  const legacyReads=await legacyReadsEnabled(ctx);
  const schemas=await collectionSchemas(ctx);
  const defaultEvents=schemas.find(item=>item.slug==='events');
  const target=(field:string,fallback:string)=>String(defaultEvents?.fields.find(item=>item.slug===field)?.options?.collection ?? fallback);
  const choose=(key:keyof CollectionBindings,label:string):FormField=>({type:'select',action_id:key,label,
    options:[{value:'',label:key==='events'?'Choose a collection':'No collection'},...schemas.map(item=>({value:item.slug,label:(item.label || item.slug)+' ('+item.slug+')'}))],
    initial_value:selected?.[key] ?? (key==='events' ? defaultEvents?.slug ?? '' : schemas.some(item=>item.slug===target(key==='venues'?'venue':'organizer_ref',key))?target(key==='venues'?'venue':'organizer_ref',key):'')});
  return {blocks:[nav(),{type:'header',text:'Settings'},context('Events, venues and organizers live in EmDash content types. Choose which content type holds each one. This does not move or delete any content.'),
    ...(error ? [{type:'banner' as const,title:'Settings not saved',description:error,variant:'error' as const}] : []),
    {type:'form',block_id:'collection-settings:'+Object.values(selected ?? {}).join(':'),fields:[choose('events','Event collection'),choose('venues','Venue collection'),choose('organizers','Organizer collection')],submit:{action_id:'save-settings',label:'Save settings'}},
    context('Missing a content type? Ask your administrator to create it, or follow the setup guide. No extra software or frontend code is needed.'),
    {type:'form',block_id:'legacy-reads:'+legacyReads,fields:[{type:'toggle',action_id:'legacyReads',label:'Show old events saved inside the plugin',description:'Turn this on only when this site’s events still live inside Eventual itself — for example a site that never moved them into an EmDash content type. While it is off and no content type is chosen, the calendar and feeds stop with a clear error instead of showing old copies that may be in the wrong language.',initial_value:legacyReads}],submit:{action_id:'save-legacy-reads',label:'Save switch'}},
    {type:'actions',elements:[{type:'link',label:'Setup guide',target:{kind:'external',url:'https://github.com/Vermeulen-Solutions/eventual-emdash-sandbox/blob/main/docs/collection-setup.md'}}]}]};
}

/** Companion navigation only. Creation and editorial editing belong to core. */
export async function handleAdmin(input:unknown,ctx:EventualContext,user?:SandboxedRouteContext['user']):Promise<BlockResponse> {
  ctx = withInvocationBudget(ctx);
  const request=input && typeof input==='object' && !Array.isArray(input) ? {...input as Record<string,unknown>} : {};
  if(request.type==='form_submit' && (!request.values || typeof request.values!=='object' || Array.isArray(request.values))) return {blocks:[{type:'banner',title:'Invalid admin request',variant:'error'}]};
  if(String(request.action_id ?? '').startsWith('open-page:')) {request.type='page_load';request.page=request.value;delete request.action_id;}
  const page=request.page;
  if(page==='/settings' || request.action_id==='save-settings' || request.action_id==='save-legacy-reads') {
    // plugins:manage is the administrator role in core; use host-attested identity.
    if(!user || user.role<50) return {blocks:[nav(),context('An administrator must manage Eventual collection settings.')]};
    if(request.action_id==='save-legacy-reads') {
      try {
        const submitted=(request.values as Record<string,unknown>|undefined)?.legacyReads;
        if(!(submitted===true || submitted===false || submitted==='true' || submitted==='false')) reject('The legacy read setting must be on or off.');
        await ctx.settings.set(LEGACY_READS_SETTING_KEY,submitted===true || submitted==='true');
      } catch(error) {return settings(ctx,error instanceof Error?error.message:'Check the legacy read setting.');}
    }
    if(request.action_id==='save-settings') {
      try {
        const values=request.values as Record<string,unknown>;
        if(!values || values.defaultTimezone !== undefined && !isValidTimeZone(String(values.defaultTimezone))) reject('Choose a valid IANA time zone.');
        await saveCollectionBindings(ctx,{events:String(values.events ?? ''),venues:String(values.venues ?? ''),organizers:String(values.organizers ?? '')});
        if(values.defaultTimezone !== undefined) await ctx.settings.set('defaultTimezone',String(values.defaultTimezone));
      } catch(error) {return settings(ctx,error instanceof Error?error.message:'Check the collection settings.');}
    }
    return settings(ctx);
  }
  try {
    const bindings=await collectionBindings(ctx);
    if(!bindings.schema) {
      const legacyReads=await legacyReadsEnabled(ctx);
      return {blocks:[nav(),{type:'header',text:'Connect Eventual to content types'},context('Choose the EmDash content type that holds this site’s events. Eventual no longer keeps events in its own storage, and the old ones cannot be edited here.'),context(legacyReads?'While this is unresolved, public calendars show the old events saved inside the plugin.':'Until a content type is chosen, public calendars and feeds stop with a clear error. Turn on “Show old events saved inside the plugin” if this site’s events still live in the plugin.'),context('You can copy the old events into a content type; the originals stay untouched. See the setup guide for the steps.')]};
    }
    if(page==='/venues' || page==='/organizers') {
      const slug=page==='/venues'?bindings.venues:bindings.organizers;
      return {blocks:[nav(),context('Create and edit these entries in the EmDash content editor.'),...(slug?[collectionLink(ctx,slug,page==='/venues'?'Manage venues':'Manage organizers')]:[context('No collection selected. Ask an administrator to configure it in Eventual settings.')])]};
    }
    return {blocks:[nav(),...(await nativeWorkspace(request,ctx,user)).blocks]};
  } catch(error) {return {blocks:[nav(),{type:'banner',title:'Review collection settings',description:error instanceof Error?error.message:'Collections could not be loaded.',variant:'error'}]};}
}
