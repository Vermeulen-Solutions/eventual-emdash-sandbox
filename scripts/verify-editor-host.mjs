/** Fresh packed host: real core migrations, source sandbox, browser draft receipts. */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import {pathToFileURL} from "node:url";
import { spawn,spawnSync } from "node:child_process";
import {createHash} from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { Kysely } from "kysely";
import { createDialect } from "emdash/db/sqlite";
import { createMigrationExecutor } from "emdash/internal/db/sqlite-migrations";
import { getCoreMigrationIdentity } from "emdash/migrations";
import { applySeed } from "emdash/seed";

const root = process.cwd();
const packed = JSON.parse(readFileSync("reports/packed-astro.json", "utf8"));
const work = packed.consumer;
for(const file of packed.installedFiles ?? []) {
  const actual=createHash("sha256").update(readFileSync(join(work,"node_modules/eventual",file.path))).digest("hex");
  if(actual!==file.sha256) throw new Error("Installed package changed after packing: "+file.path+". Rerun npm run test:package.");
}
const {createEventsCollectionBlueprint,createVenuesCollectionBlueprint,createOrganizersCollectionBlueprint}=await import(pathToFileURL(join(work,"node_modules/eventual/astro/blueprint.mjs")));
if (!work.startsWith(resolve(root, "reports") + (process.platform === "win32" ? "\\" : "/"))) throw new Error("Packed consumer must be an isolated reports directory.");
const database = join(work, "editor-data-" + Date.now() + ".db");
const startDay=new Date();startDay.setUTCHours(0,0,0,0);startDay.setUTCDate(startDay.getUTCDate()+7);
while(startDay.getUTCDay()!==1) startDay.setUTCDate(startDay.getUTCDate()+1);
const firstDate=startDay.toISOString().slice(0,10), windowEnd=new Date(startDay);windowEnd.setUTCDate(windowEnd.getUTCDate()+27);
const through=windowEnd.toISOString().slice(0,10), from=firstDate;
const executor = await createMigrationExecutor({ url: database }, { projectRoot: work, env: {} });
const identity = await getCoreMigrationIdentity();
await executor.execute({ action: "apply", i18n: {defaultLocale: "fr", locales: ["fr", "en"]}, artifact: { emdashVersion: identity.emdashVersion, migrationSetFingerprint: identity.fingerprint } });
const db = new Kysely({ dialect: createDialect({ url: "file:" + database }) });
try {
  await applySeed(db, {
    version: "1", defaultLocale: "fr", collections: [createEventsCollectionBlueprint(), createVenuesCollectionBlueprint(), createOrganizersCollectionBlueprint()],
    content: { venues: [
      { id: "hall-en", slug: "hall-en", locale: "en", status: "published", data: {name:"School",street:"Rue de l’École",locality:"Genève"} },
      { id: "hall-fr", slug: "hall-fr", locale: "fr", translationOf:"hall-en", status: "published", data: {name:"École communale",street:"Rue de l’École",locality:"Genève"} },
      { id: "unpublished", slug:"unpublished", locale:"fr", status:"draft", data:{name:"Lieu en préparation"} },
    ], events: [{ id:"editor-event", slug:"editor-event", locale:"en", status:"draft", data:{title:"Repeat",description:[],start:firstDate+"T10:00:00Z",end:firstDate+"T11:00:00Z",all_day:false,timezone:"Europe/Paris",location_type:"physical",event_status:"published",virtual_url:"https://example.org/meeting"} }] },
  }, { includeContent:true, onConflict:"error" });
  const event = await db.selectFrom("ec_events").select(["id"]).where("slug","=","editor-event").executeTakeFirstOrThrow();
  const venues = await db.selectFrom("ec_venues").select(["id","locale","status","name"]).execute();
  writeFileSync(join(work,"browser-fixtures.json"), JSON.stringify({ eventId:event.id, venues, firstDate, from, through }));
} finally { await db.destroy(); }
const upgrade=spawnSync(process.execPath,[join(work,"node_modules/eventual/scripts/upgrade-native-editor.mjs"),"--database",database],{cwd:work,encoding:"utf8",windowsHide:true});
if(upgrade.status !== 0) throw new Error(upgrade.stdout+upgrade.stderr);
const upgraded=JSON.parse(upgrade.stdout);
if(upgraded.fields.length || upgraded.entries || upgraded.revisions) throw new Error("Fresh installed blueprint unexpectedly needs upgrading.");
writeFileSync(resolve("reports/installed-upgrade-preview.json"),upgrade.stdout);
writeFileSync(join(work,"astro.config.mjs"), `import {defineConfig} from 'astro/config'; import node from '@astrojs/node'; import react from '@astrojs/react'; import {local} from 'emdash/astro'; import {sqlite} from 'emdash/db'; import eventual from 'eventual'; import emdash from 'eventual/install'; export default defineConfig({output:'server',adapter:node({mode:'standalone'}),integrations:[react(),emdash({fonts:false,database:sqlite({url:${JSON.stringify("file:"+database)}}),storage:local({directory:'./uploads',baseUrl:'/_emdash/api/media/file'}),sandboxed:[eventual],sandboxRunner:'@emdash-cms/sandbox-workerd/sandbox'})], i18n:{defaultLocale:'fr',locales:['fr','en']},devToolbar:{enabled:false}});`);
// The separate Astro component check already generated these routes. Keep the
// host acceptance app focused on the actual native editor and plugin endpoints.
writeFileSync(join(work,"src/pages/index.astro"), "<html><head><title>Editor acceptance</title></head><body>Eventual installation acceptance</body></html>");
const probe = createServer();
await new Promise((resolve,reject)=>{probe.once("error",reject);probe.listen(0,"127.0.0.1",resolve);});
const port = probe.address().port;
await new Promise(resolve=>probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const logs = [];
writeFileSync(resolve("reports/editor-host.log"), "");
const startScript = join(work, "start-editor-host.mjs");
writeFileSync(startScript, `import {dev} from 'astro'; const server=await dev({root:${JSON.stringify(work)},server:{host:'127.0.0.1',port:${port}},vite:{optimizeDeps:{force:true}}}); process.on('SIGTERM',async()=>{await server.stop();process.exit(0)});`);
const server = spawn(process.execPath, [startScript], {cwd:work,env:{...process.env,EVENTUAL_TEST_ORIGIN:origin},windowsHide:true,stdio:["ignore","pipe","pipe"]});
const log = data => { logs.push(data.toString()); appendFileSync(resolve("reports/editor-host.log"), data.toString()); };
server.stdout.on("data",log);server.stderr.on("data",log);
try {
  let ready = false;
  for (let i=0;i<20;i++) {
    if (server.exitCode !== null) throw new Error("Editor host exited before becoming ready.");
    try { const response=await fetch(origin+"/_emdash/api/setup/dev-bypass?content=0",{signal:AbortSignal.timeout(60000)}); if(response.ok){ ready=true;break; } } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready) throw new Error("Editor host did not become ready.");
  const test = spawn(process.execPath,[resolve("node_modules/@playwright/test/cli.js"),"test","--config",resolve("playwright.config.mjs")],{cwd:root,env:{...process.env,EVENTUAL_TEST_ORIGIN:origin,EVENTUAL_BROWSER_FIXTURES:join(work,"browser-fixtures.json")},windowsHide:true,stdio:"inherit"});
  const [code]=await once(test,"exit");
  if(code!==0) throw new Error("Browser acceptance failed.");
  writeFileSync(resolve("reports/editor-installation.json"),JSON.stringify({passed:true,package:packed.packagePath,sha256:packed.sha256,installedFilesVerified:packed.installedFiles?.length,fixtures:{...JSON.parse(readFileSync(join(work,"browser-fixtures.json"),"utf8"))},database,upgradePreview:upgraded},null,2)+"\n");
} finally {
  server.kill(); if(server.exitCode===null) await once(server,"exit");
  mkdirSync(resolve("reports"),{recursive:true});writeFileSync(resolve("reports/editor-host.log"),logs.join(""));
}
