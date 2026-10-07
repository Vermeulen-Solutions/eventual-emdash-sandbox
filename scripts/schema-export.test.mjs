import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=(args)=>spawnSync(process.execPath,['scripts/export-native-schema.mjs',...args],{encoding:'utf8',windowsHide:true});
test('schema export supports custom collections and reuses existing locations without host widgets',()=>{
 const result=run(['--event-collection','activities','--venue-collection','locations','--organizer-collection','hosts','--reuse-venues']);
 assert.equal(result.status,0,result.stderr);const seed=JSON.parse(result.stdout);
 assert.deepEqual(seed.collections.map(item=>item.slug),['activities','hosts']);
 const fields=seed.collections[0].fields;assert.equal(fields.find(field=>field.slug==='description').type,'portableText');
 assert.equal(fields.find(field=>field.slug==='categories').type,'string');
 for(const slug of ['legacy_id','legacy_metadata','calendar_uid','organizer_details','image_url','schedule_history','previous_start_date'])assert.equal(fields.some(field=>field.slug===slug),false,slug);
 assert.equal(fields.find(field=>field.slug==='venue').options.collection,'locations');
 assert.equal(fields.find(field=>field.slug==='recurrence').translatable,false);
 assert.equal(fields.find(field=>field.slug==='occurrence_content').translatable,true);
 for(const collection of seed.collections)for(const field of collection.fields){assert.equal(field.widget,undefined);assert.equal(field.options?.eventualEditor,undefined);}
 assert.equal(seed.content,undefined);
});
test('schema exporter rejects ambiguous names and never overwrites a file',()=>{
 assert.notEqual(run(['--venue-collection','events']).status,0);
 assert.notEqual(run(['--event-collection','../unsafe']).status,0);
 const folder=mkdtempSync(join(tmpdir(),'eventual-schema-'));try{
  const output=join(folder,'schema.json');assert.equal(run(['--output',output]).status,0);
  const before=readFileSync(output,'utf8');assert.notEqual(run(['--output',output]).status,0);assert.equal(readFileSync(output,'utf8'),before);
 }finally{rmSync(folder,{recursive:true,force:true});}
});

test('prototype migration fields require an explicit compatibility export',()=>{
 const result=run(['--legacy-compatibility']);assert.equal(result.status,0,result.stderr);
 const seed=JSON.parse(result.stdout);
 for(const collection of seed.collections)assert.equal(collection.fields.find(field=>field.slug==='legacy_id')?.unique,true);
 assert.equal(seed.collections[0].fields.find(field=>field.slug==='categories').type,'json');
});
