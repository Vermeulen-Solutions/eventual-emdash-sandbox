import { reject } from './domain/messages';
import type {BlockResponse} from '@emdash-cms/blocks';
import type {SandboxedRouteContext} from 'emdash/plugin';
import type {CollectionSchemaInfo} from 'emdash';
import type {EventualContext} from './storage';
import {nativeSchema} from './domain/native-source';
import {prepareNativeDuplicate} from './native/event-commands';
import {referenceTarget} from './domain/native-references';
import {handlePublicEvents} from './routes/public-events';
import {collectionSchemas} from './domain/collections';

/** Native companion: navigation, inspection and clean draft duplication only. */
export async function handleAdmin(input:unknown,ctx:EventualContext,user?:SandboxedRouteContext['user']):Promise<BlockResponse> {
 const request=input as Record<string,unknown>,schema=await nativeSchema(ctx);
 if(!schema) return {blocks:[{type:'context',text:'Choose an event collection in Eventual settings.'}]};
 const link=(path:string,label:string)=>({type:'link' as const,label,target:{kind:'external' as const,url:new URL(path,ctx.site.url).href}});
 const content='/_emdash/admin/content/'+encodeURIComponent(schema.slug);
 if(request.page==='widget:upcoming-events') {
  const feed=await handlePublicEvents({},ctx);
  return {blocks:[{type:'header',text:'Upcoming events'},...(feed.events ?? []).slice(0,5).map(event=>({type:'section' as const,block_id:'eventual-verbatim',text:event.title+' · '+event.start}))]};
 }
 const blocks:BlockResponse['blocks']=[{type:'header',text:'Events'},{type:'context',text:'Create and edit announcements in EmDash. Save first, then open the Eventual schedule panel.'}];
 if(request.action_id==='duplicate-event') {
  if(!user || typeof request.value!=='string') reject('Sign in before creating a copy.');
  const entry=await ctx.content!.get(schema.slug,request.value);
  if(!entry) reject('This event no longer exists.');
  const revision=entry.draftRevisionId?await ctx.content!.getRevision?.(schema.slug,entry.id,entry.draftRevisionId):undefined;
  const data=prepareNativeDuplicate(revision?.data ?? entry.data),allowed=new Set(schema.fields.filter(field=>!field.validation?.relation).map(field=>field.slug));
  const copied=await ctx.content!.create!(schema.slug,Object.fromEntries(Object.entries({...data,title:String(data.title ?? 'Event')+' (copy)'}).filter(([key])=>allowed.has(key))),{locale:entry.locale ?? undefined});
  blocks.push({type:'context',text:'Draft copy created.'},{type:'actions',elements:[link(content+'/'+encodeURIComponent(copied.id),'Edit the copy')]});
 } else if(request.action_id && !String(request.action_id).startsWith('page-native-events')) reject('Reload the workspace before trying this action.');
 const schemas=await collectionSchemas(ctx);
 blocks.push({type:'actions',elements:[link(content+'/new','Create event'),link(content,'All events'),...(['venue','organizer_ref'] as const).flatMap(field=>{
  const target=referenceTarget(schema,field);
  return schemas.some(item=>item.slug===target)?[link('/_emdash/admin/content/'+encodeURIComponent(target),field==='venue'?'Manage venues':'Manage organizers')]:[];
 })]});
 const cursor=String(request.action_id).startsWith('page-native-events')?String(request.value || ''):undefined;
 const page=await ctx.content!.list(schema.slug,{limit:20,cursor});
 blocks.push({type:'table',page_action_id:'page-native-events',columns:[{key:'title',label:'Event'},{key:'locale',label:'Language'},{key:'status',label:'Publication',format:'badge'},{key:'edit',label:'Edit',format:'element'},...(user?[{key:'copy',label:'Copy',format:'element' as const}]:[])],rows:page.items.map(entry=>({
  title:String(entry.data.title || entry.slug),locale:entry.locale ?? '',status:entry.status,edit:link(content+'/'+encodeURIComponent(entry.id),'Edit'),...(user?{copy:{type:'button' as const,action_id:'duplicate-event',label:'Duplicate',value:entry.id}}:{})
 })),empty_text:'No events yet.'});
 if(page.hasMore && (!page.cursor || page.cursor===cursor)) reject('Incomplete event page. Reload the workspace.');
 const pages=[...(cursor?[{type:'button' as const,action_id:'page-native-events-first',label:'First page',value:''}]:[]),...(page.hasMore?[{type:'button' as const,action_id:'page-native-events-next',label:'Next events',value:page.cursor}]:[])];
 if(pages.length) blocks.push({type:'actions',elements:pages});
 blocks.push({type:'header',text:'Subscribe'},{type:'actions',elements:[link('/_emdash/api/plugins/eventual/calendar','Calendar subscription (.ics)'),link('/_emdash/api/plugins/eventual/publicEvents','Published events (JSON)')]});
 return {blocks};
}
