/** Read-only readiness check. Configuration is finally verified by astro build. */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { installedVersion, testedVersions, checkToolchainVersions } from "../astro/install.mjs";

export function checkInstallation(site) {
  const root = resolve(site);
  const resolver = createRequire(resolve(root, "package.json"));
  const checks = [];
  for (const [name, expected] of Object.entries(testedVersions)) {
    try {
      const actual = installedVersion(name, resolver);
      checks.push({ name, expected, actual, ok: actual === expected });
    } catch (error) { checks.push({ name, expected, ok: false, error: error.message }); }
  }
  try { checks.push({name:"editor-toolchain",actual:checkToolchainVersions(name=>installedVersion(name,resolver)),ok:true}); }
  catch(error) { checks.push({name:"editor-toolchain",ok:false,error:error.message}); }
  const configPath = ["astro.config.mjs", "astro.config.ts", "astro.config.js"].map(name => resolve(root, name)).find(existsSync);
  const source = configPath ? readFileSync(configPath, "utf8") : "";
  const candidate = /from\s*["']eventual\/install["']/.test(source) || (source.includes("eventualEditor(") && source.includes("eventualEditorCompatibility("));
  checks.push({ name: "host-config-candidate", ok: candidate, path: configPath, requiresBuildVerification: true });
  return { site: root, checks, prerequisitesReady: checks.every(check => check.ok), next: "Run astro check and astro build. For an existing native schema, stop writers and preview the documented database upgrade. A registry-only update does not install the frontend companion." };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--site") throw new Error("Usage: node scripts/check-editor-installation.mjs --site /absolute/site/path");
  const report = checkInstallation(args[1]);
  console.log(JSON.stringify(report, null, 2));
  if (!report.prerequisitesReady) process.exitCode = 1;
}
