import {describe,expect,it} from 'vitest';
import {createPluginRuntimeTestHost} from '@emdash-cms/plugin-test';
import {validateBlockResponse} from '@emdash-cms/blocks/server';
import {localizeResponse} from '../src/ui/localize';
import {putVenueIfUnchanged,type EventualContext} from '../src/storage';
describe('Sandbox native onboarding',{timeout:60_000},()=>{
 it('rejects a stale legacy venue update when the clock has not advanced',async()=>{
 const stamp='2099-01-01T00:00:00.000Z';
 let saved={id:'hall',name:'Hall',street:'',street2:'',locality:'',region:'',postalCode:'',country:'',createdAt:stamp,updatedAt:stamp};
 const ctx={storage:{venues:{getVersioned:async()=>({value:saved,revision:'1'}),compareAndSet:async(_id:string,_revision:string,value:typeof saved)=>{saved=value;return{applied:true};}}}} as unknown as EventualContext;
 expect(await putVenueIfUnchanged(ctx,{...saved,name:'New name'},stamp)).toBe(true);
 expect(saved.updatedAt).toBe('2099-01-01T00:00:00.001Z');
 expect(await putVenueIfUnchanged(ctx,{...saved,name:'Stale name'},stamp)).toBe(false);
 });
 it('directs an unconfigured site to content types without private writes',async()=>{
 const h=await createPluginRuntimeTestHost({site:{url:'https://audit.example.com',locale:'fr'}});
 try{const user=await h.fixtures.user({email:'onboarding@example.com',role:'editor',emailVerified:true});
 const page=await h.admin.loadPage('/events',{user});expect(validateBlockResponse(page,{}).valid).toBe(true);
 expect(JSON.stringify(page)).toContain('Connect Eventual to content types');expect(JSON.stringify(page)).not.toContain('save-event');
 await h.admin.act('/events','new-event',{user});expect(await h.inspect.storage.list('events')).toHaveLength(0);
 expect(JSON.stringify(await h.admin.loadPage('/settings',{user}))).toContain('An administrator must');
 }finally{await h.dispose();}
 });
 it('localizes controls while preserving collection labels and initial values',()=>{
 const result:any=localizeResponse({blocks:[{type:'header',text:'Events'},{type:'section',block_id:'eventual-verbatim:2026-10-19T08:00:00Z',text:'Daily'},{type:'form',block_id:'unchanged',fields:[{type:'text_input',action_id:'title',label:'Title',initial_value:'Daily'},{type:'select',action_id:'venues',label:'Venue collection',initial_value:'hall',options:[{label:'Daily',value:'hall'}]}],submit:{action_id:'save-settings',label:'Save settings'}}]},'fr-CH');
 expect(result.blocks[0].text).toBe('Événements');expect(result.blocks[1].text).toBe('Daily');expect(result.blocks[2].fields[0].initial_value).toBe('Daily');expect(result.blocks[2].fields[1].options).toEqual([{label:'Daily',value:'hall'}]);expect(validateBlockResponse(result,{}).valid).toBe(true);
 });
});
