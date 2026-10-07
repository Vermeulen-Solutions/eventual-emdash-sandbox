import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  patchEmbeddedBlockForms,
  eventualEditorCompatibility,
} from "../astro/editor-compat.mjs";
test("embedded block forms cannot submit the surrounding content editor", () => {
  const source = readFileSync(
    new URL(
      "../node_modules/@emdash-cms/blocks/dist/index.js",
      import.meta.url,
    ),
    "utf8",
  );
  const patched = patchEmbeddedBlockForms(source);
  const component = patched.slice(
    patched.indexOf("function FormBlockComponent"),
    patched.indexOf(
      "//#endregion",
      patched.indexOf("function FormBlockComponent"),
    ),
  );
  assert.ok(component.includes("e.stopPropagation()"));
  assert.ok(component.includes('jsxs("div"'));
  assert.ok(component.includes('type: "button", onClick: handleSubmit'));
  assert.ok(!component.includes('jsxs("form"'));
  assert.ok(component.includes("invalid.reportValidity"));
  assert.ok(component.includes("event.isComposing"));
  assert.ok(component.includes('field.action_id + JSON.stringify(field.initial_value)'));
  assert.ok(patched.includes('htmlFor:eventualDateId'));
  assert.ok(patched.includes('type: "date", id:eventualDateId'));
  const region=code=>code.slice(code.indexOf("function HeaderBlockComponent"),code.indexOf("//#endregion",code.indexOf("function HeaderBlockComponent")));
  assert.equal(region(patched),region(source));
  const plugin = eventualEditorCompatibility();
  assert.ok(plugin.config().optimizeDeps.rolldownOptions.plugins[0].transform);
  assert.equal(plugin.transform(source, "other.js"), null);
  assert.ok(
    plugin.config().optimizeDeps.exclude.includes("@emdash-cms/blocks"),
  );
  assert.equal(
    plugin.transform(
      source,
      "C:/site/node_modules/@emdash-cms/blocks/dist/index.js",
    ).code,
    patched,
  );
});
test("unsupported dependency versions fail visibly instead of silently patching unrelated code", () => {
  assert.throws(
    () => patchEmbeddedBlockForms("different renderer"),
    /Unsupported/,
  );
});
