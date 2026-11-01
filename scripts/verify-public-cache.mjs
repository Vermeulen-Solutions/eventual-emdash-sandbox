/** Disposable production Astro HTML gate. Run test:package first. No hosted writes. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { Kysely } from 'kysely';
import { createDialect } from 'emdash/db/sqlite';
import { createMigrationExecutor } from 'emdash/internal/db/sqlite-migrations';
import { getCoreMigrationIdentity } from 'emdash/migrations';
import { applySeed } from 'emdash/seed';

const root = process.cwd();
const packed = JSON.parse(readFileSync('reports/packed-astro.json', 'utf8'));
assert(packed.consumer.startsWith(resolve(root, 'reports') + '\\') || packed.consumer.startsWith(resolve(root, 'reports') + '/'));
for (const file of packed.installedFiles) {
  assert.equal(createHash('sha256').update(readFileSync(join(packed.consumer, 'node_modules/eventual', file.path))).digest('hex'), file.sha256, 'Rerun test:package after changing packaged files');
}
const work = join(packed.consumer, 'cache-host-' + Date.now());
// 0.9.6's Windows resolver points at a nonexistent .exe. Patch only this disposable
// dependency, using workerd's exported platform binary (same local-host workaround).
if (process.platform === 'win32') {
  const runnerDir = join(packed.consumer, 'node_modules/@emdash-cms/sandbox-workerd');
  assert.equal(JSON.parse(readFileSync(join(runnerDir, 'package.json'), 'utf8')).version, '0.9.6');
  const original = 'return join(join(createRequire(import.meta.url).resolve("workerd"), "..", ".."), "bin", process.platform === "win32" ? "workerd.exe" : "workerd");';
  const replacement = 'return createRequire(import.meta.url)("workerd").default;';
  const runners = readdirSync(join(runnerDir, 'dist')).filter(name => /^runner-.*\.mjs$/.test(name));
  assert.equal(runners.length, 1);
  const path = join(runnerDir, 'dist', runners[0]);
  const source = readFileSync(path, 'utf8');
  assert(source.includes(original) || source.includes(replacement));
  writeFileSync(path, source.replace(original, replacement));
}
const pages = join(work, 'src/pages');
mkdirSync(pages, { recursive: true });
writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'eventual-cache-acceptance', private: true, type: 'module' }));
const database = join(work, 'synthetic.db');
const rangeFrom = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const rangeThrough = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
const eventDay = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
const identity = await getCoreMigrationIdentity();
assert.equal(identity.emdashVersion, '1.4.0');
const executor = await createMigrationExecutor({ url: database }, { projectRoot: work, env: {} });
await executor.execute({ action: 'apply', artifact: { emdashVersion: identity.emdashVersion, migrationSetFingerprint: identity.fingerprint } });
const db = new Kysely({ dialect: createDialect({ url: 'file:' + database }) });
const exported = spawnSync(process.execPath, [join(packed.consumer, 'node_modules/eventual/scripts/export-native-schema.mjs'), '--event-collection', 'activities', '--venue-collection', 'locations', '--organizer-collection', 'hosts'], { encoding: 'utf8', windowsHide: true });
assert.equal(exported.status, 0, exported.stderr);
const seed = JSON.parse(exported.stdout);
seed.content = { locations: [{ id: 'hall', slug: 'hall', status: 'published', data: { name: 'Original hall' } }], hosts: [{ id: 'club', slug: 'club', status: 'published', data: { name: 'Original organizer' } }] };
seed.collections.push({ ...seed.collections.find(c => c.slug === 'activities'), slug: 'empty_events', label: 'Other events' });
try { await applySeed(db, seed, { includeContent: true, onConflict: 'error' }); }
finally { await db.destroy(); }
// Fault injection is confined to this fixture's provider; Astro's actual memory provider stores HTML.
writeFileSync(join(work, 'provider.mjs'), `import {createRequire} from 'node:module'; import {pathToFileURL} from 'node:url'; const require=createRequire(import.meta.url); const path=require.resolve('astro/package.json').replace(/package.json$/, 'dist/core/cache/memory-provider.js'); const {default:factory}=await import(pathToFileURL(path)); export default function(){const provider=factory();return {...provider, async invalidate(spec){if(globalThis.__eventualFailPurge)throw Error('Synthetic purge failure');return provider.invalidate(spec)}}}`);
writeFileSync(join(work, 'astro.config.mjs'), `import {defineConfig} from 'astro/config'; import node from '@astrojs/node'; import emdash,{local} from 'emdash/astro'; import {sqlite} from 'emdash/db'; import eventual from 'eventual'; export default defineConfig({output:'server',adapter:node({mode:'standalone'}),cache:{provider:{entrypoint:new URL('./provider.mjs',import.meta.url)}},integrations:[emdash({fonts:false,toolbar:false,database:sqlite({url:${JSON.stringify('file:' + database)}}),storage:local({directory:'./uploads',baseUrl:'/_emdash/api/media/file'}),sandboxed:[eventual],sandboxRunner:'@emdash-cms/sandbox-workerd/sandbox'})],devToolbar:{enabled:false}});`);
writeFileSync(join(work, 'src/middleware.ts'), `import {defineMiddleware} from 'astro:middleware'; import {publicFeedCacheOptions} from 'eventual/astro'; export const onRequest=defineMiddleware(async(context,next)=>{const response=await next(); if(!['/events','/empty'].includes(context.url.pathname))return response; const body=await response.text(); const result=new Response(body,response); const eligible=context.request.method==='GET'&&!context.request.headers.has('authorization')&&!context.request.headers.has('cookie')&&!context.locals.user&&!context.url.searchParams.has('_preview')&&!context.url.searchParams.has('_edit')&&response.status===200&&!response.headers.has('set-cookie'); const options=eligible ? publicFeedCacheOptions(context.locals.publicFeeds??[],{maxAge:15,boundaries:context.locals.boundaries??[]}) : false; context.cache.set(options); result.headers.set('cache-control',options?'no-cache':'private, no-store'); return result;});`);
// Private, fixture-only fault control. It never purges or ships in the package.
writeFileSync(join(pages, 'fixture-fault.ts'), `export async function POST({request,cache}){cache.set(false);if(!process.env.EVENTUAL_CACHE_TEST_TOKEN||request.headers.get('authorization')!=='Bearer '+process.env.EVENTUAL_CACHE_TEST_TOKEN)return new Response('Forbidden',{status:403}); globalThis.__eventualFailPurge=(await request.json()).fail;return Response.json({ok:true})}`);
writeFileSync(join(pages, '[page].astro'), `---
import {parsePublicFeed,publicEventTimeBoundary} from 'eventual/astro';
import {getSiteSettingsWithCacheHint} from 'emdash';
let feed; let settings; let error;
try {
 const url=new URL('/_emdash/api/plugins/eventual/publicEvents',Astro.url);
 url.searchParams.set('from',${JSON.stringify(rangeFrom)});url.searchParams.set('through',${JSON.stringify(rangeThrough)});url.searchParams.set('publicUrls','false');
 if(Astro.url.searchParams.has('error'))url.searchParams.set('from','invalid');
 if(Astro.params.page==='empty')url.searchParams.set('category','Empty');
 feed=parsePublicFeed(await Astro.locals.emdash.handlePublicPluginApiRoute('eventual','GET','publicEvents',new Request(url)));
 if(Astro.url.searchParams.get('metadata')==='missing')delete feed.cache;
 if(Astro.url.searchParams.get('metadata')==='unsupported')feed.cache={version:999};
 Astro.locals.publicFeeds=[feed];
 const boundary=publicEventTimeBoundary(feed.events);
 Astro.locals.boundaries=boundary?[boundary]:[];
 settings=(await getSiteSettingsWithCacheHint()).data;
} catch(e) { error=String(e); Astro.response.status=503; }
const marker=crypto.randomUUID();
---
<html><head><title>Disposable cache acceptance</title></head><body><p id="render">{marker}</p><p>{settings?.title}</p>{error?<p>{error}</p>:feed.events.map(event=><article><h2>{event.title}</h2><p>{event.venue?.name}</p><p>{event.organizer}</p><p>{Date.now()>=Date.parse(event.start)&&Date.now()<Date.parse(event.end)?'ongoing':'other'}</p></article>)}{Astro.locals.user&&<p>Authenticated render</p>}</body></html>`);
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = 'http://127.0.0.1:' + port;
const logPath = resolve(root, 'reports/public-cache-host.log');
writeFileSync(logPath, '');
let server, token, authCookie;
function start(args) {
  server = spawn(process.execPath, args, { cwd: work, windowsHide: true, env: { ...process.env, EVENTUAL_CACHE_TEST_TOKEN: token ?? '', HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', data => appendFileSync(logPath, data));
}
async function stop() { if (server?.exitCode === null) { server.kill(); await once(server, 'exit'); } }
async function ready(path) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw Error('Host exited; inspect ' + logPath);
    try { const response = await fetch(origin + path, { signal: AbortSignal.timeout(60_000) }); if (response.ok) return response; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw Error('Host not ready; inspect ' + logPath);
}
async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(origin + '/_emdash/api/' + path, { method, headers: { authorization: 'Bearer ' + token, 'X-EmDash-Request': '1', 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  assert(response.ok && result.success, path + ': ' + JSON.stringify(result));
  return result.data;
}
async function html(path = '/events', headers) {
  const response = await fetch(origin + path, { headers });
  const body = await response.text();
  return { status: response.status, body, marker: /id="render">([^<]+)/.exec(body)?.[1], headers: response.headers };
}
const checks = [];
async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
const fixtureData = { title: 'Original public event', start: eventDay + 'T10:00:00Z', end: eventDay + 'T11:00:00Z', all_day: false, timezone: 'Europe/Paris', venue: 'hall', organizer_ref: 'club' };
let eventId;
try {
  writeFileSync(join(work, 'start-dev.mjs'), `import {dev} from 'astro';const server=await dev({root:${JSON.stringify(work)},server:{host:'127.0.0.1',port:${port}}});process.on('SIGTERM',async()=>{await server.stop();process.exit(0)});`);
  start([join(work, 'start-dev.mjs')]);
  const setup = await ready('/_emdash/api/setup/dev-bypass?content=0&token=1');
  authCookie = setup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  token = (await setup.json()).data.token;
  assert(token);
  assert(authCookie);
  await api('plugins/eventual/admin', { page: '/settings', action_id: 'save-settings', values: { events: 'activities', venues: 'locations', organizers: 'hosts' } });
  fixtureData.venue = (await api('content/locations/hall')).item.id;
  fixtureData.organizer_ref = (await api('content/hosts/club')).item.id;
  const created = await api('content/activities', { data: fixtureData });
  eventId = created.item.id;
  await api('content/activities/' + eventId + '/publish', { _rev: (await api('content/activities/' + eventId))._rev });
  await stop();
  const build = spawnSync(process.execPath, [join(packed.consumer, 'node_modules/astro/bin/astro.mjs'), 'build'], { cwd: work, encoding: 'utf8', windowsHide: true });
  appendFileSync(logPath, build.stdout + build.stderr);
  assert.equal(build.status, 0, 'Production build failed; inspect ' + logPath);
  start([join(work, 'dist/server/entry.mjs')]);
  await ready('/events');
  await check('production HTML hits cache; draft save remains private; publish purges parent', async () => {
    const a = await html(), b = await html(); assert.equal(a.marker, b.marker); assert(a.body.includes(fixtureData.title));
    await api('content/activities/' + eventId, { data: { title: 'Private draft title' } }, 'PUT');
    const draft = await html(); assert.equal(draft.marker, a.marker); assert(!draft.body.includes('Private draft title'));
    await api('content/activities/' + eventId + '/publish', { _rev: (await api('content/activities/' + eventId))._rev });
    const fresh = await html(); assert.notEqual(fresh.marker, a.marker); assert(fresh.body.includes('Private draft title'));
  });
  await check('venue/organizer live edits and native site settings refresh real parent HTML', async () => {
    const a = await html();
    await api('content/locations/hall', { data: { name: 'Changed hall' } }, 'PUT');
    const live = await html(); assert.notEqual(live.marker, a.marker); assert(live.body.includes('Changed hall'));
    await api('content/locations/hall/publish', { _rev: (await api('content/locations/hall'))._rev });
    const b = await html(); assert.notEqual(b.marker, live.marker); assert(b.body.includes('Changed hall'));
    await api('content/hosts/club', { data: { name: 'Changed organizer' } }, 'PUT');
    const organizer = await html(); assert.notEqual(organizer.marker, b.marker); assert(organizer.body.includes('Changed organizer'));
    await api('settings', { title: 'Changed synthetic site title' });
    const c = await html(); assert.notEqual(c.marker, b.marker); assert(c.body.includes('Changed synthetic site title'));
  });
  await check('unpublication, republication, trash and restore invalidate parent', async () => {
    await api('content/activities/' + eventId + '/unpublish', { _rev: (await api('content/activities/' + eventId))._rev });
    assert(!(await html()).body.includes('Private draft title'));
    await api('content/activities/' + eventId + '/publish', { _rev: (await api('content/activities/' + eventId))._rev });
    assert((await html()).body.includes('Private draft title'));
    await api('content/activities/' + eventId, undefined, 'DELETE');
    assert(!(await html()).body.includes('Private draft title'));
    await api('content/activities/' + eventId + '/restore', {});
    assert(!(await html()).body.includes('Private draft title'), 'restore returns a draft');
    await api('content/activities/' + eventId + '/publish', { _rev: (await api('content/activities/' + eventId))._rev });
    assert((await html()).body.includes('Private draft title'));
  });
  await check('cached empty category gains its first newly published event', async () => {
    const a = await html('/empty'), b = await html('/empty'); assert.equal(a.marker, b.marker);
    const created = await api('content/activities', { data: { ...fixtureData, title: 'First matching event', categories: 'Empty' } });
    assert.equal((await html('/empty')).marker, a.marker);
    await api('content/activities/' + created.item.id + '/publish', { _rev: (await api('content/activities/' + created.item.id))._rev });
    const fresh = await html('/empty'); assert.notEqual(fresh.marker, a.marker); assert(fresh.body.includes('First matching event'));
  });
  await check('authenticated, preview/edit and unsupported/absent metadata cannot fill a cache', async () => {
    const privateDraft = await api('content/activities', { data: { ...fixtureData, title: 'Secret unannounced draft' } });
    const preview = new URL((await api('content/activities/' + privateDraft.item.id + '/preview-url', { pathPattern: '/events' })).url, origin);
    for (const [path, headers] of [['/events?auth=1', { authorization: 'Bearer ' + token }], ['/events?session=1', { cookie: authCookie }], [preview.pathname + preview.search], ['/events?_preview=invalid'], ['/events?_edit=1'], ['/events?metadata=missing'], ['/events?metadata=unsupported']]) {
      const a = await html(path, headers), b = await html(path, headers);
      assert.notEqual(a.marker, b.marker, path); assert.match(a.headers.get('cache-control') ?? '', /no-store/);
      assert(!a.body.includes('Secret unannounced draft'));
      if (headers?.cookie) assert(a.body.includes('Authenticated render'), 'real session user must be resolved');
    }
    const a = await html('/events?error=1'), b = await html('/events?error=1');
    assert.equal(a.status, 503); assert.notEqual(a.marker, b.marker); assert.match(a.headers.get('cache-control'), /no-store/);
    assert(!(await html()).body.includes('Authenticated render'));
  });
  await check('event start changes ongoing HTML after bounded expiry with no write', async () => {
    const start = Date.now() + 4500;
    const created = await api('content/activities', { data: { ...fixtureData, title: 'Clock event', start: new Date(start).toISOString(), end: new Date(start + 60_000).toISOString() } });
    await api('content/activities/' + created.item.id + '/publish', { _rev: (await api('content/activities/' + created.item.id))._rev });
    const a = await html(), b = await html(); assert.equal(a.marker, b.marker);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, start - Date.now() + 100)));
    const c = await html(); assert.notEqual(c.marker, a.marker); assert(c.body.includes('ongoing'));
  });
  await check('failed native purge is bounded by the feed expiry', async () => {
    const fault = async fail => {
      const response = await fetch(origin + '/fixture-fault', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ fail }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true });
    };
    const a = await html();
    await fault(true);
    try {
      await api('content/activities/' + eventId + '/unpublish', { _rev: (await api('content/activities/' + eventId))._rev });
      assert.equal((await html()).marker, a.marker);
      await new Promise(resolve => setTimeout(resolve, 15_100));
      const b = await html(); assert.notEqual(b.marker, a.marker); assert(!b.body.includes('Private draft title'));
    } finally { await fault(false); }
  });
  await check('plugin collection settings refresh within the ceiling; source failures never fill parent cache', async () => {
    const a = await html();
    await api('plugins/eventual/admin', { page: '/settings', action_id: 'save-settings', values: { events: 'empty_events', venues: 'locations', organizers: 'hosts' } });
    assert.equal((await html()).marker, a.marker, 'plugin settings have no native purge tag');
    await new Promise(resolve => setTimeout(resolve, 15_100));
    const b = await html(); assert.notEqual(b.marker, a.marker); assert(!b.body.includes('First matching event'));
    // The public route rejects invalid ranges. A host catches the error and stays uncached.
    const invalid = await fetch(origin + '/_emdash/api/plugins/eventual/publicEvents?from=invalid&through=2026-12-31');
    assert.equal((await invalid.json()).data.ok, false);
  });
  writeFileSync(resolve(root, 'reports/public-cache-host.json'), JSON.stringify({ passed: true, emdash: identity.emdashVersion, astro: '7.3.2', runner: '@emdash-cms/sandbox-workerd@0.9.6', packageSha256: packed.sha256, work, checks, hostedCloudflare: 'unverified' }, null, 2) + '\n');
} finally { await stop(); }
