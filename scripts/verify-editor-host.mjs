/** Fresh stock host: real migrations and packed sandbox; no Eventual companion. */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
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
  const exported=spawnSync(process.execPath,[join(work,'node_modules/eventual/scripts/export-native-schema.mjs'),'--event-collection','activities','--venue-collection','locations','--organizer-collection','hosts'],{cwd:work,encoding:'utf8',windowsHide:true});
  if(exported.status!==0) throw new Error(exported.stderr);
  const seed=JSON.parse(exported.stdout);
  seed.content={locations:[{id:'school',slug:'school',locale:'fr',status:'published',data:{name:'École communale',street:'Rue de l’École 1',locality:'Genève'}}],hosts:[{id:'association',slug:'association',locale:'fr',status:'published',data:{name:'Association de quartier'}}],activities:[{id:'gathering',slug:'gathering',locale:'fr',status:'draft',data:{title:'Rencontre des voisins',description:[{_type:'block',_key:'intro',style:'normal',markDefs:[],children:[{_type:'span',_key:'copy',text:'Annonce riche préservée',marks:['strong']}]}],start:firstDate+'T08:00:00Z',end:firstDate+'T09:00:00Z',timezone:'Europe/Paris',all_day:false,categories:'Music, Community'}}]};
  await applySeed(db, seed, {includeContent:true,onConflict:'error'});
  writeFileSync(join(work,'browser-fixtures.json'),JSON.stringify({firstDate,from,through}));
} finally { await db.destroy(); }
writeFileSync(join(work,"astro.config.mjs"), `import {defineConfig} from 'astro/config'; import node from '@astrojs/node'; import react from '@astrojs/react'; import emdash,{local} from 'emdash/astro'; import {sqlite} from 'emdash/db'; import eventual from 'eventual'; export default defineConfig({output:'server',adapter:node({mode:'standalone'}),integrations:[react(),emdash({fonts:false,database:sqlite({url:${JSON.stringify("file:"+database)}}),storage:local({directory:'./uploads',baseUrl:'/_emdash/api/media/file'}),sandboxed:[eventual],sandboxRunner:'@emdash-cms/sandbox-workerd/sandbox'})], i18n:{defaultLocale:'fr',locales:['fr','en']},devToolbar:{enabled:false}});`);
// The separate Astro component check already generated these routes. Keep the
// host acceptance app focused on the sandbox workspace and plugin endpoints.
writeFileSync(join(work,"src/pages/index.astro"), "<html><head><title>Editor acceptance</title></head><body>Eventual installation acceptance</body></html>");
// A default-locale prefix is not a valid URL on this stock i18n host. Give the
// already packed/compiled component fixture an explicit route for browser QA.
writeFileSync(join(work,'src/pages/component-preview.astro'),readFileSync(join(work,'src/pages/[locale].astro'),'utf8').replace(/^export function getStaticPaths[^\n]*\n/m,'').replace('const locale=Astro.params.locale;',"const locale='fr';").replace('<head>','<head><meta charset="utf-8"/>'));
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
  const consoleEvidence=['french','english'].map(language=>JSON.parse(readFileSync(resolve('reports/browser-console-'+language+'.json'),'utf8')));
  if(consoleEvidence.some(evidence=>evidence.errors.length)) throw new Error('Unexpected browser errors.');
  writeFileSync(resolve("reports/editor-installation.json"),JSON.stringify({passed:true,architecture:'native-collections',collections:{events:'activities',venues:'locations',organizers:'hosts'},emdashVersion:'1.2.0',package:packed.packagePath,sha256:packed.sha256,installedFilesVerified:packed.installedFiles?.length,fixtures:{...JSON.parse(readFileSync(join(work,"browser-fixtures.json"),"utf8"))},database,selfContained:true,frontendCompanion:false,unexpectedBrowserErrors:0,knownUpstreamDiagnostics:consoleEvidence.flatMap(evidence=>evidence.known),frontendVisual:{pages:['/component-preview'],screenshots:['images/registry-0.13.0/native-public-component-fr-desktop.png','images/registry-0.13.0/native-public-component-fr-mobile.png'],scope:'Packed EventList component example; no site theme installed or changed.'}},null,2)+"\n");
} finally {
  server.kill(); if(server.exitCode===null) await once(server,"exit");
  mkdirSync(resolve("reports"),{recursive:true});writeFileSync(resolve("reports/editor-host.log"),logs.join(""));
}
