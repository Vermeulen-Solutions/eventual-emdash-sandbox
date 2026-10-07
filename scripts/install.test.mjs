import { test } from "node:test";
import assert from "node:assert/strict";
import { emdashWithEventual, checkEditorVersions, testedVersions, checkToolchainVersions } from "../astro/install.mjs";
import eventual from "../dist/index.mjs";
test("editor setup checks the actual supported versions and rejects upgrades explicitly", () => {
  assert.deepEqual(checkEditorVersions(), testedVersions);
  assert.throws(() => checkEditorVersions(() => "1.0.2"), /requires tested/);
  assert.equal(checkToolchainVersions().vite.startsWith("8.3."),true);
  assert.throws(()=>checkToolchainVersions(name=>name === "astro" ? "7.3.2" : "7.9.0"),/requires vite/);
});
test("one integration works with source sandbox and registry installation paths", () => {
  for (const options of [{ sandboxed: [eventual] }, {}]) {
    const integration = emdashWithEventual(options);
    assert.equal(integration.name, "emdash");
    assert.equal(typeof integration.hooks["astro:config:setup"], "function");
  }
  assert.throws(() => emdashWithEventual({ sandboxed: [eventual, eventual] }), /registered twice/);
  assert.throws(() => emdashWithEventual({ sandboxed: [{ ...eventual, version: "0.0.0" }] }), /match/);
  assert.throws(() => emdashWithEventual({ plugins: [{ id: "eventual-editor", version: "0.0.0", format: "native" }] }), /mismatched/);
});
