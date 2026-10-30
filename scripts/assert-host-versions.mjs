/** Fail the host-matrix leg when npm resolves a different EmDash/tooling set. */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const expected = {
  emdash: process.env.EVENTUAL_HOST_EMDASH,
  "@emdash-cms/admin": process.env.EVENTUAL_HOST_ADMIN,
  "@emdash-cms/blocks": process.env.EVENTUAL_HOST_BLOCKS,
  "@emdash-cms/plugin-test": process.env.EVENTUAL_HOST_PLUGIN_TEST,
  "@emdash-cms/plugin-cli": process.env.EVENTUAL_HOST_PLUGIN_CLI,
};
const require = createRequire(join(root, "package.json"));

function installedVersion(name, resolver = require) {
  let directory = dirname(resolver.resolve(name));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      if (pkg.name === name) return pkg.version;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`Cannot identify ${name}'s installed version.`);
    directory = parent;
  }
}

const actual = {};
for (const [name, want] of Object.entries(expected)) {
  if (!want) continue;
  actual[name] = installedVersion(name);
  if (actual[name] !== want)
    throw new Error(`${name} ${actual[name]} != expected ${want}. Check the host-matrix install step.`);
}

try {
  const testRequire = createRequire(require.resolve("@emdash-cms/plugin-test"));
  actual["plugin-test:emdash"] = installedVersion("emdash", testRequire);
  if (expected.emdash && actual["plugin-test:emdash"] !== expected.emdash)
    throw new Error(
      `plugin-test resolves emdash ${actual["plugin-test:emdash"]} != expected ${expected.emdash}.`,
    );
} catch (error) {
  if (!/Cannot find module|Cannot identify/.test(error.message)) throw error;
}

console.log(JSON.stringify({ expected, actual }, null, 2));
