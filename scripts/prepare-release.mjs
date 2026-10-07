/** Prepare local artifacts only; never publish, tag, commit or upload. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { measureArchive, checkBudget, budgets, hardLimits } from "./bundle-budget.mjs";
const root=process.cwd(), npm=process.env.npm_execpath;
if (!npm) throw new Error("Use npm run release:prepare.");
const acceptance=JSON.parse(readFileSync("reports/editor-installation.json","utf8"));
if(acceptance.unexpectedBrowserErrors !== 0 || !Array.isArray(acceptance.knownUpstreamDiagnostics)) throw new Error('Complete browser console inspection with explicit upstream diagnostics.');
const browser=JSON.parse(readFileSync("reports/browser-acceptance.json","utf8"));
if(acceptance.frontendVisual?.screenshots?.length<2 || !acceptance.frontendVisual?.screenshots?.every(path=>existsSync(path))) throw new Error('Complete current packed frontend component screenshots first.');
if(!acceptance.passed || acceptance.architecture !== 'native-collections' || acceptance.emdashVersion !== '1.2.0' || !acceptance.selfContained || acceptance.frontendCompanion !== false || browser.stats.unexpected || browser.stats.flaky || browser.stats.skipped || browser.stats.expected<2) throw new Error("Pass the native-collection browser workflows on EmDash 1.2 first.");
for(const path of ["reports/native-full-tests.log","reports/native-full-tests-new-york.log"]) {
  const log=readFileSync(path,"utf8");
  const count=Number(log.match(/Tests\s+(\d+) passed/)?.[1] ?? 0);
  if(count<181 || /Unhandled Error|Test Files.*failed/.test(log)) throw new Error("Complete the clean plugin acceptance run: "+path);
}
if(Number(readFileSync("reports/native-tooling.log","utf8").match(/pass (\d+)/)?.[1] ?? 0)<20) throw new Error("Complete the tooling acceptance run.");
if(/error TS\d+/.test(readFileSync("reports/native-typecheck.log","utf8"))) throw new Error("Fix TypeScript errors before packaging.");
const pkg=JSON.parse(readFileSync("package.json","utf8"));
function run(script,args) {
  const result=spawnSync(process.execPath,[script,...args],{cwd:root,encoding:"utf8",windowsHide:true});
  if(result.status !== 0) throw new Error((result.stdout??"")+"\n"+(result.stderr??""));
  return result.stdout;
}
run(npm,["run","build"]);
run(npm,["run","bundle"]);
const archive=resolve("dist",`${pkg.name}-${pkg.version}.tar.gz`);
const measured=measureArchive(readFileSync(archive));
const errors=[...checkBudget(measured),...checkBudget(measured,hardLimits)];
if(errors.length) throw new Error(errors.join("\n"));
const manifest=JSON.parse(readFileSync("dist/manifest.json","utf8"));
if(manifest.version !== pkg.version) throw new Error("Manifest and package versions differ.");
const destination=resolve("dist/source");mkdirSync(destination,{recursive:true});
const [packed]=JSON.parse(run(npm,["pack","--json","--ignore-scripts","--pack-destination",destination]));
for(const required of ["package/dist/index.mjs","package/dist/plugin.mjs","package/astro/feed.ts","package/astro/blueprint.mjs"]) {
  if(!packed.files.some(file=>"package/"+file.path === required)) throw new Error("Optional source package missing "+required);
}
function artifact(path) { const bytes=readFileSync(path);return {path,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}; }
const artifacts=[artifact(archive),artifact(join(destination,packed.filename))];
if(artifacts[1].sha256 !== acceptance.sha256) throw new Error("Source package differs from the browser-tested archive. Rerun test:package and test:editor after final changes.");
const report={version:pkg.version,preparedAt:new Date().toISOString(),published:false,selfContained:true,frontendCompanionRequired:false,registryPayload:{...measured,budgets,hardLimits,errors:[]},artifacts,optionalSourcePackageFiles:packed.files.map(file=>file.path),acceptanceEvidence:["reports/native-full-tests.log","reports/native-full-tests-new-york.log","reports/native-tooling.log","reports/native-typecheck.log","reports/packed-astro.json","reports/browser-acceptance.json"].map(path=>({path,exists:existsSync(path),modified:existsSync(path)?statSync(path).mtime.toISOString():null})),note:"Native schemas are a one-time administrator setup; no frontend companion is required. The source package and schema exporter are optional for site developers. External subscriber and deployed D1 checks are not certified; see the handoff."};
mkdirSync("reports",{recursive:true});writeFileSync("reports/release-preparation.json",JSON.stringify(report,null,2)+"\n");
writeFileSync("dist/SHA256SUMS",artifacts.map(item=>`${item.sha256}  ${item.path === archive ? archive.split(/[\\/]/).pop() : "source/"+packed.filename}`).join("\n")+"\n");
console.log(JSON.stringify({version:report.version,published:false,registryPayload:report.registryPayload,artifacts},null,2));
