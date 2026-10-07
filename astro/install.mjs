/** One host integration for the sandbox backend and its frontend companion. */
import emdash from "emdash/astro";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { eventualEditor } from "./descriptor.mjs";
import { eventualEditorCompatibility } from "./editor-compat.mjs";

const require = createRequire(import.meta.url);
export const testedVersions = Object.freeze({ emdash: "1.0.1", "@emdash-cms/admin": "1.0.1", "@emdash-cms/blocks": "1.0.1" });
export const testedToolchain = Object.freeze({astro:"7.3.x (>=7.3.2)",vite:"8.3.x",react:"19.x"});
export function installedVersion(name, resolver = require) {
  let directory = dirname(resolver.resolve(name));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (pkg.name === name) return pkg.version;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Cannot identify ${name}'s installed version.`);
    directory = parent;
  }
}
export function checkEditorVersions(resolveVersion = installedVersion) {
  const versions = Object.fromEntries(Object.keys(testedVersions).map(name => [name, resolveVersion(name)]));
  for (const [name, version] of Object.entries(versions)) {
    if (version !== testedVersions[name]) throw new Error(`Eventual editor requires tested ${name} ${testedVersions[name]}; found ${version}. Use the documented compatibility matrix before upgrading.`);
  }
  return versions;
}
export function checkToolchainVersions(resolveVersion = installedVersion) {
  const versions={};
  for (const [name, range] of Object.entries(testedToolchain)) {
    const version=resolveVersion(name);
    if (!(name === "astro" ? /^7\.3\.\d+$/.test(version) && Number(version.split(".")[2]) >= 2 : name === "vite" ? /^8\.3\.\d+$/.test(version) : /^19\.\d+\.\d+$/.test(version))) throw new Error(`Eventual editor requires ${name} ${range}; found ${version}. See the editor compatibility matrix.`);
    versions[name]=version;
  }
  return versions;
}

/** Preserve existing backend registration, adapters, storage, plugins and hooks. */
export function emdashWithEventual(options = {}) {
  checkEditorVersions();
  checkToolchainVersions();
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const registered = (options.plugins ?? []).find(plugin => plugin.id === "eventual-editor");
  if (registered && (registered.version !== pkg.version || registered.format !== "native")) throw new Error("Remove the mismatched Eventual editor companion before using emdashWithEventual.");
  const backends = [...(options.plugins ?? []), ...(options.sandboxed ?? [])].filter(plugin => plugin.id === "eventual");
  if (backends.length > 1) throw new Error("Eventual backend is registered twice. Keep a single sandboxed or registry installation.");
  if (backends.some(plugin => plugin.version !== pkg.version || plugin.format !== "standard")) throw new Error("Eventual's source backend must be sandboxed and match its frontend companion version.");
  const integration = emdash({ ...options, plugins: registered ? options.plugins : [...(options.plugins ?? []), eventualEditor(pkg.version)] });
  const setup = integration.hooks["astro:config:setup"];
  return {
    ...integration,
    hooks: { ...integration.hooks, "astro:config:setup": async context => {
      context.updateConfig({ vite: { plugins: [eventualEditorCompatibility()] } });
      return setup?.(context);
    } },
  };
}
export default emdashWithEventual;
