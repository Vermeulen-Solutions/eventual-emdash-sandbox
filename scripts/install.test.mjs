import { test } from "node:test";
import assert from "node:assert/strict";
import { emdashWithEventual, checkEditorVersions, testedVersions, checkToolchainVersions } from "../astro/install.mjs";
import eventual from "../dist/index.mjs";

test("source editor accepts every tested core version", () => {
  for (const version of testedVersions.emdash) {
    assert.deepEqual(
      checkEditorVersions(() => version),
      Object.fromEntries(Object.keys(testedVersions).map(name => [name, version])),
    );
  }
  for (const version of ["1.0.1", "1.3.1", "1.5.0"]) {
    assert.throws(() => checkEditorVersions(() => version), /requires tested/);
  }
  assert.equal(checkToolchainVersions().vite.startsWith("8.3."), true);
  assert.throws(
    () => checkToolchainVersions(name => name === "astro" ? "7.3.2" : "7.9.0"),
    /requires vite/,
  );
});

test("source installer accepts the tested host", () => {
  const integration = emdashWithEventual({ sandboxed: [eventual] });
  assert.equal(typeof integration.hooks, "object");
  assert.equal(typeof integration.hooks["astro:config:setup"], "function");
});
