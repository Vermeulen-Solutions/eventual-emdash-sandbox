import {describe, it, expect, vi} from 'vitest';
import type {EventualContext} from '../src/storage';
import {withInvocationBudget, reserveRpcCalls, remainingRpcCalls} from '../src/domain/invocation-budget';
import {handleCalendarFeed} from '../src/routes/calendar-feed';
import {handlePublicEventImage} from '../src/routes/public-media';
import {memoryKv} from './native-test-helpers';
import {createEventsCollectionBlueprint} from '../src/schema/blueprint';
import {collectionBindings, collectionSettings, collectionSchemas, saveCollectionBindings} from '../src/domain/collections';
import {importRecords} from '../src/transfer';
import {handleContentBeforeUnpublish} from '../src/hooks/content-hooks';
import {resolveEventVenues} from '../src/domain/native-source';
import {nativeEntryToEventRecord} from '../src/domain/event-expansion';

function tracedContext(entries: unknown[] = []) {
  const calls: string[] = [];
  const trace = (name: string, method: Function) => (...args: unknown[]) => {calls.push(name); return method(...args);};
  const kv = memoryKv();
  const ctx = {
    plugin:{id:'eventual'}, site:{url:'https://example.org',locale:'en'},
    settings:{get:trace('settings.get',async()=>undefined)},
    schema:{listCollections:trace('schema.listCollections',async()=>[createEventsCollectionBlueprint()])},
    content:{list:trace('content.list',async()=>({items:entries,hasMore:false}))},
    kv:Object.fromEntries(Object.entries(kv).map(([name,fn])=>[name,trace('kv.'+name,fn)])),
    storage:{calendar_cancellations:{query:trace('storage.query',async()=>({items:[],hasMore:false}))}},
  } as unknown as EventualContext;
  return {ctx, calls, kv};
}
const row = (id: string) => ({id,type:'events',locale:'en',status:'published',data:{title:id,start:'2026-11-15T10:00:00Z',end:'2026-11-15T11:00:00Z',all_day:false,timezone:'UTC'}});

describe('Sandbox invocation accounting and bounded reads',()=>{
  it('stops before the eleventh call, including lazy storage and copied contexts',async()=>{
    const get = vi.fn(async()=>null);
    const ctx = withInvocationBudget({kv:{get},storage:new Proxy({}, {get:()=>({get})}),log:{info:get}} as any);
    for(let i=0;i<8;i++) await ctx.kv.get('x');
    await ctx.storage.events!.get('x');
    const copy = withInvocationBudget({...ctx});
    await copy.log.info('last');
    expect(()=>copy.kv.get('x')).toThrow('sandbox RPC budget');
    expect(get).toHaveBeenCalledTimes(10);
  });
  it('charges failed and parallel calls and reserves final writes',async()=>{
    const get = vi.fn(async()=>{throw new Error('host failed');});
    const ctx = withInvocationBudget({kv:{get}} as any);
    const release = reserveRpcCalls(ctx,2);
    await Promise.allSettled(Array.from({length:8},()=>ctx.kv.get('x')));
    expect(()=>ctx.kv.get('x')).toThrow('sandbox RPC budget');
    release(); release();
    expect(remainingRpcCalls(ctx)).toBe(2);
    await Promise.allSettled([ctx.kv.get('x'),ctx.kv.get('x')]);
    expect(get).toHaveBeenCalledTimes(10);
  });
  it('reconciles 50 cold calendar groups with one conditional write and at most eight calls',async()=>{
    const {ctx,calls} = tracedContext(Array.from({length:50},(_,i)=>row('event-'+i)));
    const result = await handleCalendarFeed(ctx,'example.org');
    expect((result.match(/BEGIN:VEVENT/g) ?? []).length).toBe(50);
    expect(calls.filter(name=>name==='kv.compareAndSet')).toHaveLength(1);
    expect(calls.length).toBeLessThanOrEqual(8);
  });
  it('preserves sequence, UID and cancellations while importing old calendar state',async()=>{
    const first = tracedContext([row('first')]);
    await handleCalendarFeed(first.ctx,'example.org');
    const snapshot:any = await first.kv.get('state:eventual-calendar-snapshot');
    const old = tracedContext([]);
    await old.kv.set('state:eventual-calendar-host',snapshot.host);
    await old.kv.set('state:eventual-calendar:first',{...snapshot.groups.first,sequence:7});
    const feed = await handleCalendarFeed(old.ctx,'changed.example');
    expect(feed).toContain('STATUS:CANCELLED');
    expect(feed).toContain('SEQUENCE:8');
    expect(feed).toContain('first@example.org');
    expect(await old.kv.get('state:eventual-calendar:first')).toBeTruthy();
  });
  it('returns no partial calendar when URL hydration exceeds the budget',async()=>{
    const {ctx,calls,kv} = tracedContext(Array.from({length:20},(_,i)=>({...row('event-'+i),slug:'event-'+i})));
    ctx.content!.getPublicUrl = async()=>{calls.push('content.getPublicUrl');return 'https://example.org/event';};
    await expect(handleCalendarFeed(ctx,'example.org')).rejects.toThrow('sandbox RPC budget');
    expect(calls.length).toBeLessThanOrEqual(10);
    // The atomic reconciliation can finish before URL rendering fails; no partial feed is returned.
    expect(calls.filter(name=>name==='kv.compareAndSet')).toHaveLength(1);
    expect(await kv.get('state:eventual-calendar-snapshot')).toBeTruthy();
  });
  it('leaves the previous snapshot intact when a source scan cannot finish',async()=>{
    const {ctx,calls,kv} = tracedContext();
    const previous = {version:1,host:'example.org',groups:{}};
    await kv.set('state:eventual-calendar-snapshot',previous);
    let page = 0;
    ctx.content!.list = async()=>{calls.push('content.list');return {items:[],hasMore:true,cursor:String(++page)};};
    await expect(handleCalendarFeed(ctx,'example.org')).rejects.toThrow('sandbox RPC budget');
    expect(calls.length).toBeLessThanOrEqual(10);
    expect(await kv.get('state:eventual-calendar-snapshot')).toEqual(previous);
    expect(calls).not.toContain('kv.compareAndSet');
  });
  it('rejects a concurrent conditional commit rather than publishing conflicting sequences',async()=>{
    const {ctx,calls} = tracedContext([row('first')]);
    ctx.kv.compareAndSet = async()=>{calls.push('kv.compareAndSet');return {applied:false} as any;};
    await expect(handleCalendarFeed(ctx,'example.org')).rejects.toThrow('Calendar state conflict');
  });
  it('fails closed when a scheduled draft revision cannot be read',async()=>{
    const {ctx} = tracedContext([{...row('scheduled'),status:'scheduled',draftRevisionId:'revision',data:{...row('scheduled').data,venue:'unrelated'}}]);
    ctx.content!.get = async()=>({id:'venue',status:'published',data:{name:'Venue'}} as any);
    ctx.content!.getTranslations = async()=>({translationGroup:'venue',translations:[]});
    ctx.content!.getRevision = async()=>null;
    expect(await handleContentBeforeUnpublish({collection:'venues',content:{id:'venue'}} as any,ctx)).toMatchObject({cancel:true,reason:expect.stringContaining('could not be verified')});
  });
  it('memoizes complete translated directories and excludes unpublished base references',async()=>{
    const base:any = {id:'venue',locale:'en',translationGroup:'g',status:'published',data:{name:'Hall'}};
    const sibling:any = {...base,id:'fr-venue',locale:'fr',data:{name:'Salle'}};
    const list = vi.fn(async(_target:string,options:any)=>options.cursor ? {items:[sibling],hasMore:false} : {items:[base,{...base,id:'draft',status:'draft'}],hasMore:true,cursor:'next'});
    const ctx:any = {content:{list}};
    const event = {...nativeEntryToEventRecord(row('event'))!,venueId:'venue',locale:'fr'};
    const schema = createEventsCollectionBlueprint() as any;
    expect((await resolveEventVenues(ctx,[event],schema)).get('venue|fr')?.name).toBe('Salle');
    expect((await resolveEventVenues(ctx,[{...event,venueId:'draft'}],schema)).size).toBe(0);
    expect(list).toHaveBeenCalledTimes(2);
  });
  it('batches import reads, reports pending writes, and completes safely on retry',async()=>{
    const records = new Map<string,unknown>();
    const calls: string[] = [];
    const trace = (name:string,method:Function)=>(...args:unknown[])=>{calls.push(name);return method(...args);};
    const ctx:any = {settings:{get:trace('settings',async()=>undefined)},schema:{listCollections:trace('schema',async()=>[])},content:{},storage:{
      events:{getMany:trace('events.getMany',async(ids:string[])=>new Map(ids.filter(id=>records.has(id)).map(id=>[id,records.get(id)]))),compareAndSet:trace('events.compareAndSet',async(id:string,_revision:null,data:unknown)=>{if(records.has(id)) return {applied:false};records.set(id,data);return {applied:true};})},
      venues:{getMany:trace('venues.getMany',async()=>new Map([['v',{}]]))},organizers:{getMany:trace('organizers.getMany',async()=>new Map([['o',{}]]))},
    }};
    const input:any = {collection:'events',source:'backup',mode:'restore',records:Array.from({length:10},(_,i)=>{const id='event-'+i;return {sourceId:id,data:{id,title:id,description:'',start:'2026-11-15',end:'2026-11-15',allDay:true,timezone:'UTC',location:'',organizer:'',externalUrl:'',imageUrl:'',categories:[],published:false,exceptions:[],venueId:'v',organizerId:'o',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'}};})};
    const first = await importRecords(ctx,input,true);
    if (!('rows' in first)) throw new Error('Import validation failed');
    expect(first.rows!.filter(row=>row.status==='pending')).toHaveLength(5);
    expect(calls).toHaveLength(10);
    calls.length=0;
    const retry = await importRecords({...ctx},input,true);
    if (!('rows' in retry)) throw new Error('Import validation failed');
    expect(retry.ok).toBe(true);
    expect(retry.rows!.filter(row=>row.status==='skipped')).toHaveLength(5);
    expect(records.size).toBe(10);
    expect(calls).toHaveLength(10);
  });
  it('streams a native image by ID without scanning the event collection',async()=>{
    const {ctx,calls} = tracedContext();
    ctx.content!.get = async()=>{calls.push('content.get');return {...row('event'),data:{...row('event').data,featured_image:{id:'image'}}} as any;};
    ctx.media = {get:async()=>{calls.push('media.get');return {mimeType:'image/png',size:4};},readBytes:async()=>{calls.push('media.readBytes');return {mimeType:'image/png',bytes:new Uint8Array([1,2,3,4])};}} as any;
    const response:any = await handlePublicEventImage({eventId:'event#2026-11-15T10:00'},ctx);
    expect(response.status).toBe(200);
    expect(calls).not.toContain('content.list');
    expect(calls).toHaveLength(5);
  });
  it('shares raw settings/schema discovery and leaves invalid bindings repairable',async()=>{
    const get = vi.fn(async()=>({events:'removed',venues:'',organizers:''}));
    const schema = createEventsCollectionBlueprint();
    schema.fields = schema.fields.filter(field => !['venue','organizer_ref'].includes(field.slug));
    const schemas = vi.fn(async()=>[schema]);
    const ctx:any = {settings:{get,set:vi.fn()},schema:{listCollections:schemas}};
    await expect(collectionBindings(ctx)).rejects.toThrow('missing');
    expect(await collectionSettings(ctx)).toMatchObject({events:'removed'});
    expect(await collectionSchemas(ctx)).toHaveLength(1);
    await saveCollectionBindings(ctx,{events:'events',venues:'',organizers:''});
    expect(get).toHaveBeenCalledTimes(1);
    expect(schemas).toHaveBeenCalledTimes(1);
  });
});
