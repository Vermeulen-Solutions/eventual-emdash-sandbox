import { test } from "node:test";
import assert from "node:assert/strict";
import { emdashWithEventual, checkEditorVersions, testedVersions, checkToolchainVersions } from "../astro/install.mjs";
import eventual from "../dist/index.mjs";
test("historical editor rejects current core versions instead of applying old source patches", () => {
  assert.deepEqual(checkEditorVersions(name=>testedVersions[name]), testedVersions);
  assert.throws(() => checkEditorVersions(), /requires tested/);
  assert.throws(() => checkEditorVersions(() => "1.0.2"), /requires tested/);
  assert.equal(checkToolchainVersions().vite.startsWith("8.3."),true);
  assert.throws(()=>checkToolchainVersions(name=>name === "astro" ? "7.3.2" : "7.9.0"),/requires vite/);
});
test("historical companion installer is explicitly unavailable on EmDash 1.2", () => {
  assert.throws(() => emdashWithEventual({sandboxed:[eventual]}), /requires tested/);
});
