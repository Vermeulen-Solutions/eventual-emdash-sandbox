import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  patchEmbeddedBlockForms,
  eventualEditorCompatibility,
} from "../astro/editor-compat.mjs";

const legacyFixture = `import { useCallback, useEffect, useMemo, useState } from "react";
function FormBlockComponent({ block, onAction }) {
 const [values, setValues] = useState(() => getInitialValues(block.fields));
 function handleClick(e) {
  e.preventDefault();
  const form = e.currentTarget.form;
  if (form && !form.reportValidity()) return;
  submit();
 }
 function handleSubmit(e) {
  e.preventDefault();
  submit();
 }
 return jsxs("form", { onSubmit: handleSubmit, children: [block.fields.map((field) => {
  return jsx("div", {}, field.action_id);
 }), jsx(Button, { type: "submit", onClick: handleClick, children: block.submit.label })] });
}
//#endregion
function DateInputElementComponent({ element, onAction, onChange }) {
 return jsxs("div", { children: [jsx("label", { children: element.label }), jsx("input", { type: "date", value: "" })] });
}
//#endregion
function HeaderBlockComponent({ block }) {
 return jsx("h2", { children: block.text });
}
//#endregion
`;

const modernFixture = `import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
function FormBlockComponent({ block, onAction }) {
 const [values, setValues] = useState(() => getInitialValues(block.fields));
 function handleClick() { submit(); }
 function handleKeyDown(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
 }
 return jsx(FormOwnerContext.Provider, { value: "", children: jsxs("div", { role: "group", onKeyDown: handleKeyDown, children: [block.fields.map((field) => {
  return jsx("div", {}, field.action_id);
 }), jsx(Button, { type: "button", onClick: handleClick, children: block.submit.label })] }) });
}
//#endregion
function DateInputElementComponent({ element, onAction, onChange }) {
 return jsxs("div", { children: [jsx("label", { children: element.label }), jsx("input", { type: "date", value: "" })] });
}
//#endregion
function HeaderBlockComponent({ block }) {
 return jsx("h2", { children: block.text });
}
//#endregion
`;

function region(code, name) {
  const start = code.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} missing`);
  return code.slice(start, code.indexOf("//#endregion", start));
}

function assertCommonPatches(patched) {
  assert.ok(
    patched.includes(
      "useEffect(() => setValues(getInitialValues(block.fields)), [block.fields])",
    ),
  );
  assert.ok(
    patched.includes(
      "field.action_id + JSON.stringify(field.initial_value)",
    ),
  );
  assert.ok(patched.includes("htmlFor:eventualDateId"));
  assert.ok(patched.includes('type: "date", id:eventualDateId'));
  assert.match(
    patched.slice(0, patched.indexOf('from "react"')),
    /\buseId\b/,
  );
}

test("legacy form renderer keeps the nesting workaround", () => {
  const patched = patchEmbeddedBlockForms(legacyFixture);
  const component = region(patched, "FormBlockComponent");
  assert.ok(component.includes("e.stopPropagation()"));
  assert.ok(component.includes('jsxs("div"'));
  assert.ok(component.includes('type: "button", onClick: handleSubmit'));
  assert.ok(!component.includes('jsxs("form"'));
  assert.ok(component.includes("invalid.reportValidity"));
  assert.ok(component.includes("event.isComposing"));
  assertCommonPatches(patched);
  assert.equal(
    region(patched, "HeaderBlockComponent"),
    region(legacyFixture, "HeaderBlockComponent"),
  );
});

test("blocks 1.4 renderer is patched without the legacy form rewrite", () => {
  const patched = patchEmbeddedBlockForms(modernFixture);
  const component = region(patched, "FormBlockComponent");
  assert.ok(component.includes('role: "group"'));
  assert.ok(component.includes('type: "button", onClick: handleClick'));
  assert.ok(!component.includes("e.stopPropagation()"));
  assert.ok(!component.includes("data-eventual-block-form"));
  assert.ok(!component.includes('jsxs("form"'));
  assertCommonPatches(patched);
  assert.equal(
    region(patched, "HeaderBlockComponent"),
    region(modernFixture, "HeaderBlockComponent"),
  );
});

test("the installed renderer is patched in either supported shape", () => {
  const source = readFileSync(
    new URL(
      "../node_modules/@emdash-cms/blocks/dist/index.js",
      import.meta.url,
    ),
    "utf8",
  );
  const patched = patchEmbeddedBlockForms(source);
  const installed = region(source, "FormBlockComponent");
  const component = region(patched, "FormBlockComponent");
  assertCommonPatches(patched);
  if (installed.includes('jsxs("form", {')) {
    assert.ok(component.includes("e.stopPropagation()"));
    assert.ok(component.includes("invalid.reportValidity"));
  } else {
    assert.ok(component.includes('role: "group"'));
    assert.ok(!component.includes("data-eventual-block-form"));
    assert.ok(!component.includes("invalid.reportValidity"));
  }
  const plugin = eventualEditorCompatibility();
  assert.ok(
    plugin.config({}, { command: "serve" }).optimizeDeps.rolldownOptions
      .plugins[0].transform,
  );
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
