/**
 * EmDash blocks 1.0.1 embeds <form> inside the content editor's <form>.
 * This narrowly scoped Vite transform fixes nesting without changing permissions,
 * RPCs, draft receipts, or any installed dependency files.
 * Remove it after upgrading to a blocks release with an embedded-form fix.
 */
import { fileURLToPath } from "node:url";
const presentationModule = fileURLToPath(new URL("./editor-i18n.mjs",import.meta.url)).replaceAll("\\","/");
export function patchEmbeddedBlockForms(source) {
  const marker = "function FormBlockComponent({ block, onAction }) {";
  const start = source.indexOf(marker);
  if (start < 0)
    throw new Error(
      "Unsupported EmDash Block Kit renderer: FormBlockComponent changed.",
    );
  const end = source.indexOf("\n//#endregion", start);
  if (end < 0) throw new Error("Unsupported EmDash Block Kit form boundary.");
  let component = source.slice(start, end);
  const initializer =
    "const [values, setValues] = useState(() => getInitialValues(block.fields));";
  if (!component.includes(initializer))
    throw new Error("Unsupported EmDash Block Kit form state initializer.");
  component = component.replace(
    initializer,
    initializer +
      "\n useEffect(() => setValues(getInitialValues(block.fields)), [block.fields]);",
  );
  for (const needle of [
    "e.preventDefault();",
    'jsxs("form", {',
    "onSubmit: handleSubmit,",
    'type: "submit",',
    '}, field.action_id);',
  ]) {
    if (!component.includes(needle))
      throw new Error("Unsupported EmDash Block Kit form: " + needle);
  }
  component = component.replace(
    "e.preventDefault();",
    `e.preventDefault();
  e.stopPropagation();
  const root=e.currentTarget.closest('[data-eventual-block-form]');
  const invalid=root?.querySelector(':invalid');
  if (invalid) { invalid.reportValidity?.(); return; }`,
  );
  component = component
    .replace('jsxs("form", {', 'jsxs("div", {')
    .replace(
      "onSubmit: handleSubmit,",
      `role: "group",
  "data-eventual-block-form": "",
  onKeyDown: (event) => {
   if (event.key === "Enter" && !event.defaultPrevented && !event.isComposing && event.target.tagName !== "TEXTAREA" && event.target.tagName !== "BUTTON" && event.target.getAttribute("role") !== "combobox") handleSubmit(event);
  },`,
    )
    .replace('type: "submit",', 'type: "button", onClick: handleSubmit,')
    .replace('}, field.action_id);', '}, field.action_id + JSON.stringify(field.initial_value));');
  // The tested renderer omits the option key, producing warnings on every
  // venue choice. Use its stable value, including the empty "no venue" option.
  let patched=(source.slice(0, start) + component + source.slice(end)).replace('children: item.label\n\t\t})', 'children: item.label\n\t\t}, item.value)');
  const dateMarker='function DateInputElementComponent({ element, onAction, onChange }) {';
  const dateStart=patched.indexOf(dateMarker), dateEnd=patched.indexOf('\n//#endregion',dateStart);
  if(dateStart<0 || dateEnd<0) throw new Error("Unsupported Block Kit date input.");
  const date=patched.slice(dateStart,dateEnd);
  if(!date.includes('jsx("label", {') || !date.includes('type: "date",')) throw new Error("Unsupported Block Kit date label.");
  patched=patched.slice(0,dateStart)+date.replace(dateMarker,dateMarker+'\n const eventualDateId=useId();').replace('jsx("label", {','jsx("label", { htmlFor:eventualDateId,').replace('type: "date",','type: "date", id:eventualDateId,')+patched.slice(dateEnd);
  return patched.replace('import { useCallback, useEffect, useMemo, useState } from "react";', 'import { useCallback, useEffect, useMemo, useState, useId } from "react";');
}
export function eventualEditorCompatibility() {
  return {
    name: "eventual-embedded-block-forms-1.0.1",
    enforce: "pre",
    config() {
      // Keep core's admin prebundle (including its CommonJS dependencies) and
      // apply presentation before optimization as well as in production builds.
      return { optimizeDeps: { exclude: ["@emdash-cms/blocks"], rolldownOptions: {plugins:[{name:"eventual-admin-presentation-1.0.1", transform(source,id) {
        if (id.replaceAll("\\", "/").endsWith("/@emdash-cms/admin/dist/index.js")) return {code:patchEventualPresentation(source),map:null};
        return null;
      }}]} } };
    },
    transform(source, id) {
      const path = id.replaceAll("\\", "/").split("?")[0];
      if (path.endsWith("/@emdash-cms/admin/dist/index.js"))
        return { code: patchEventualPresentation(source), map: null };
      if (
        !id
          .replaceAll("\\", "/")
          .split("?")[0]
          .endsWith("/@emdash-cms/blocks/dist/index.js")
      )
        return null;
      return { code: patchEmbeddedBlockForms(source), map: null };
    },
  };
}

/** Presentation adapter for the tested admin build. RPC and receipts stay untouched. */
export function patchEventualPresentation(source) {
  const original = 'import { BlockRenderer, isSafePluginPagePath, normalizePluginPagePath } from "@emdash-cms/blocks";';
  const panel = 'function SandboxedContentEditorPanel({ pluginId, panelId, title, collection, entryId, locale, versionToken, draftAccess, captureDraft, onDraftResponse, onEntryRefresh, reserveHeaderEnd = false }) {';
  const fieldLabel = 'return field?.label || slug.charAt(0).toUpperCase() + slug.slice(1);';
  const preview = 'function EditorDraftPatchPreview({ operations, fields, currentValues, onApply, onClose }) {';
  const editPage = 'function ContentEditPage() {';
  if (!source.includes(original) || !source.includes(panel) || !source.includes(fieldLabel) || !source.includes(editPage)) throw new Error("Unsupported EmDash admin presentation adapter. Use the tested compatibility matrix.");
  let patched=source.replace(original, original.replace("{ BlockRenderer,", "{ BlockRenderer as EventualOriginalBlockRenderer,") + `
import { localizeEventualBlocks, draftSummary as eventualDraftSummary, editorText as eventualEditorText } from ${JSON.stringify(presentationModule)};
function BlockRenderer(props) {
 const {locale}=useLocale();
 const blocks=React$1.useMemo(()=>localizeEventualBlocks(props.blocks, locale), [props.blocks,locale]);
 return jsx(EventualOriginalBlockRenderer, {...props,blocks});
}`)
    .replace(panel, panel + '\n const {locale: eventualUiLocale}=useLocale();\n if(pluginId === "eventual") title=eventualEditorText(title,eventualUiLocale);')
    .replace(fieldLabel, 'const label=field?.label || slug.charAt(0).toUpperCase() + slug.slice(1); return field?.options?.eventualEditor ? eventualEditorText(label,i18n.locale) : label;')
    // ContentEditPage's local i18n is the content configuration, not Lingui.
    .replace(editPage,editPage+'\n const {locale:eventualPageUiLocale}=useLocale();')
    .replace('description: error instanceof Error ? error.message : _t4({', 'description: error instanceof Error ? (collectionFields.start?.options?.eventualEditor ? eventualEditorText(error.message,eventualPageUiLocale) : error.message) : _t4({')
    .replace(preview, preview + '\n const {locale: eventualPreviewLocale}=useLocale(); const eventualPreview=fields.start?.options?.eventualEditor===true;')
    .replace('function EditorDraftPatchPreview({ operations, fields, currentValues, onApply, onClose }) {\n const {locale: eventualPreviewLocale}=useLocale(); const eventualPreview=fields.start?.options?.eventualEditor===true;\n\tconst { _: _t } = useLingui();', preview + '\n const {locale: eventualPreviewLocale}=useLocale(); const eventualPreview=fields.start?.options?.eventualEditor===true;\n const {_: eventualOriginalT}=useLingui(); const _t=eventualPreview ? message=>eventualEditorText(eventualOriginalT(message), eventualPreviewLocale):eventualOriginalT;')
    .replace('children: fields[operation.field]?.label ?? operation.field', 'children: eventualPreview ? eventualEditorText(fields[operation.field]?.label ?? operation.field,eventualPreviewLocale) : fields[operation.field]?.label ?? operation.field')
    .replace('children: summarize(currentValues[operation.field])', 'children: eventualPreview ? eventualDraftSummary(operation.field,currentValues[operation.field],eventualPreviewLocale,currentValues.timezone) : summarize(currentValues[operation.field])')
    .replace('children: summarize(operation.op === "clear" ? null : operation.value)', 'children: eventualPreview ? eventualDraftSummary(operation.field,operation.op === "clear" ? null : operation.value,eventualPreviewLocale,currentValues.timezone) : summarize(operation.op === "clear" ? null : operation.value)');
  const editorStart=patched.indexOf('function ContentEditor({'), editorEnd=patched.indexOf('\n//#endregion',editorStart);
  if(editorStart<0 || editorEnd<0) throw new Error("Unsupported content editor boundary.");
  const editor=patched.slice(editorStart,editorEnd).replaceAll('jsx(PublishActions, {','jsx(PublishActions, { eventualUi:Object.values(fields).some(field=>field.options?.eventualEditor===true),').replaceAll('jsx(SettingsActionBar, {','jsx(SettingsActionBar, { eventualUi:Object.values(fields).some(field=>field.options?.eventualEditor===true),');
  patched=patched.slice(0,editorStart)+editor+patched.slice(editorEnd);
  patched=patched.replace('function SettingsActionBar({ collectionLabel,','function SettingsActionBar({ eventualUi=false, collectionLabel,');
  const barStart=patched.indexOf('function SettingsActionBar({'), barEnd=patched.indexOf('\nfunction ',barStart+1);
  patched=patched.slice(0,barStart)+patched.slice(barStart,barEnd).replace('jsx(PublishActions, {','jsx(PublishActions, { eventualUi,')+patched.slice(barEnd);
  return patched.replace('function PublishActions({ collectionLabel,','function PublishActions({ eventualUi=false, collectionLabel,').replace('function PublishActions({ eventualUi=false, collectionLabel, isNew, isLive, hasPendingChanges, publishingState, isPending, disabled, onPublish, onUnpublish, onMenuOpenChange, size, fullWidth }) {\n\tconst { _: _t4 } = useLingui();','function PublishActions({ eventualUi=false, collectionLabel, isNew, isLive, hasPendingChanges, publishingState, isPending, disabled, onPublish, onUnpublish, onMenuOpenChange, size, fullWidth }) {\n const {locale: eventualPublishLocale}=useLocale(); const {_:eventualPublishT}=useLingui(); const _t4=eventualUi ? message=>eventualEditorText(eventualPublishT(message),eventualPublishLocale):eventualPublishT;');
}
