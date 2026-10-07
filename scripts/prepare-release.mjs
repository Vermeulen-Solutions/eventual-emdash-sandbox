/** Prepare local artifacts only; never publish, tag, commit or upload. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { measureArchive, checkBudget, budgets, hardLimits } from "./bundle-budget.mjs";
const root=process.cwd(), npm=process.env.npm_execpath;
if (!npm) throw new Error("Use npm run release:prepare.");
const acceptance=JSON.parse(readFileSync("reports/editor-installation.json","utf8"));
const browser=JSON.parse(readFileSync("reports/browser-acceptance.json","utf8"));
const publicVisual=JSON.parse(readFileSync("reports/public-visual/capture.json","utf8"));
if(!publicVisual.passed || publicVisual.errors.length || publicVisual.captures.length<20) throw new Error("Complete the desktop/mobile public visual acceptance run first.");
if(!acceptance.passed || browser.stats.unexpected || browser.stats.flaky || browser.stats.skipped || browser.stats.expected<2) throw new Error("Pass both packed browser acceptance workflows first.");
for(const path of ["reports/refinement-unit.log","reports/refinement-unit-new-york.log"]) {
  const log=readFileSync(path,"utf8");
  if(!/Tests\s+170 passed/.test(log) || /Unhandled Error|Test Files.*failed/.test(log)) throw new Error("Complete the clean plugin acceptance run: "+path);
}
if(!/pass 17/.test(readFileSync("reports/refinement-tooling.log","utf8"))) throw new Error("Complete the tooling acceptance run.");
if(/error TS\d+/.test(readFileSync("reports/refinement-typecheck.log","utf8"))) throw new Error("Fix TypeScript errors before packaging.");
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
if(manifest.version !== pkg.version) throw new Error("Backend and host versions differ.");
const destination=resolve("dist/host");mkdirSync(destination,{recursive:true});
const [packed]=JSON.parse(run(npm,["pack","--json","--ignore-scripts","--pack-destination",destination]));
for(const required of ["package/astro/install.mjs","package/astro/editor-compat.mjs","package/astro/editor-i18n.mjs","package/astro/admin.mjs","package/astro/blueprint.mjs","package/astro/blueprint.d.mts","package/scripts/upgrade-native-editor.mjs","package/docs/editor-upgrade.md"]) {
  if(!packed.files.some(file=>"package/"+file.path === required)) throw new Error("Host package missing "+required);
}
function artifact(path) { const bytes=readFileSync(path);return {path,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")}; }
const artifacts=[artifact(archive),artifact(join(destination,packed.filename))];
if(artifacts[1].sha256 !== acceptance.sha256) throw new Error("Host package differs from the browser-tested archive. Rerun test:package and test:editor after final changes.");
const report={version:pkg.version,preparedAt:new Date().toISOString(),published:false,registryPayload:{...measured,budgets,hardLimits,errors:[]},artifacts,hostPackageFiles:packed.files.map(file=>file.path),acceptanceEvidence:["reports/refinement-unit.log","reports/refinement-tooling.log","reports/refinement-typecheck.log","reports/packed-astro.json","reports/browser-acceptance.json"].map(path=>({path,exists:existsSync(path),modified:existsSync(path)?statSync(path).mtime.toISOString():null})),note:"Artifact preparation does not certify unrun external subscriber, live translation-service or deployed D1 checks. See the release handoff and test logs."};
mkdirSync("reports",{recursive:true});writeFileSync("reports/release-preparation.json",JSON.stringify(report,null,2)+"\n");
writeFileSync("dist/SHA256SUMS",artifacts.map(item=>`${item.sha256}  ${item.path === archive ? archive.split(/[\\/]/).pop() : "host/"+packed.filename}`).join("\n")+"\n");
console.log(JSON.stringify({version:report.version,published:false,registryPayload:report.registryPayload,artifacts},null,2));
