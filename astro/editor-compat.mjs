/**
 * Legacy source-install transform for `@vermeulen.solutions/eventual/install`. Registry installs
 * never execute this file; the host renders plugin panels directly.
 *
 * Blocks 1.2-1.3 render a form block as <form> inside the content editor's
 * <form>. Blocks 1.4+ render a div[role="group"] with its own Enter handling.
 * This patches both shapes plus Eventual-specific form state and date-label
 * behaviour that the host renderer does not provide.
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
  const legacyForm =
    component.includes('jsxs("form", {') &&
    component.includes("onSubmit: handleSubmit,") &&
    component.includes('type: "submit",') &&
    component.includes("e.preventDefault();");
  const modernForm =
    !component.includes('jsxs("form", {') &&
    component.includes('role: "group"') &&
    component.includes('type: "button"') &&
    component.includes("onClick: handleClick");
  if (!legacyForm && !modernForm)
    throw new Error("Unsupported EmDash Block Kit form renderer.");
  const fieldKey = "}, field.action_id);";
  if (!component.includes(fieldKey))
    throw new Error("Unsupported EmDash Block Kit form field key.");
  component = component.replace(
    fieldKey,
    '}, field.action_id + JSON.stringify(field.initial_value));',
  );
  if (legacyForm) {
    for (const needle of [
      "e.preventDefault();",
      'jsxs("form", {',
      "onSubmit: handleSubmit,",
      'type: "submit",',
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
      .replace('type: "submit",', 'type: "button", onClick: handleSubmit,');
  }
  let patched = source.slice(0, start) + component + source.slice(end);
  // The 1.2/1.3 renderer omits the option key, producing warnings on every
  // venue choice. Use its stable value, including the empty "no venue" option.
  const optionKey = "children: item.label\n\t\t})";
  if (patched.includes(optionKey))
    patched = patched.replace(
      optionKey,
      "children: item.label\n\t\t}, item.value)",
    );
  const dateMarker =
    "function DateInputElementComponent({ element, onAction, onChange }) {";
  const dateStart = patched.indexOf(dateMarker),
    dateEnd = patched.indexOf("\n//#endregion", dateStart);
  if (dateStart < 0 || dateEnd < 0)
    throw new Error("Unsupported Block Kit date input.");
  const date = patched.slice(dateStart, dateEnd);
  if (!date.includes('jsx("label", {') || !date.includes('type: "date",'))
    throw new Error("Unsupported Block Kit date label.");
  patched =
    patched.slice(0, dateStart) +
    date
      .replace(dateMarker, dateMarker + "\n const eventualDateId=useId();")
      .replace('jsx("label", {', 'jsx("label", { htmlFor:eventualDateId,')
      .replace('type: "date",', 'type: "date", id:eventualDateId,') +
    patched.slice(dateEnd);
  return addUseIdImport(patched);
}

function addUseIdImport(source) {
  const reactImport = /import \{([^}]+)\} from "react";/;
  const match = source.match(reactImport);
  if (!match) throw new Error("Unsupported Block Kit React import.");
  const names = match[1].split(",").map((name) => name.trim());
  if (names.includes("useId")) return source;
  names.push("useId");
  return source.replace(
    reactImport,
    `import { ${names.join(", ")} } from "react";`,
  );
}
export function eventualEditorCompatibility() {
  let command = "serve";
  return {
    name: "eventual-embedded-block-forms-1.0.1",
    enforce: "pre",
    config(_config, env = { command: "serve" }) {
      command = env.command ?? "serve";
      // Keep core's admin prebundle (including its CommonJS dependencies) and
      // apply presentation before optimization in dev. Production builds use
      // the regular transform below; applying both duplicates the admin module.
      return { optimizeDeps: { exclude: ["@emdash-cms/blocks"], rolldownOptions: {plugins:[{name:"eventual-admin-presentation-1.0.1", transform(source,id) {
        if (command !== "serve") return null;
        if (id.replaceAll("\\", "/").endsWith("/@emdash-cms/admin/dist/index.js")) return {code:patchEventualPresentation(source),map:null};
        return null;
      }}]} } };
    },
    transform(source, id) {
      const path = id.replaceAll("\\", "/").split("?")[0];
      if (path.endsWith("/@emdash-cms/admin/dist/index.js"))
        return command === "serve"
          ? null
          : { code: patchEventualPresentation(source), map: null };
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
import { localizeEventualBlocks, draftSummary as eventualDraftSummary, editorText as eventualEditorText, loadEditorCatalog as eventualLoadCatalog, onEditorCatalog as eventualOnCatalog } from ${JSON.stringify(presentationModule)};
function BlockRenderer(props) {
 const {locale}=useLocale();
 const [eventualCatalogTick,eventualSetCatalogTick]=React$1.useState(0);
 React$1.useEffect(()=>{ const off=eventualOnCatalog(()=>eventualSetCatalogTick(n=>n+1)); eventualLoadCatalog(locale); return off; },[locale]);
 const blocks=React$1.useMemo(()=>localizeEventualBlocks(props.blocks, locale), [props.blocks,locale,eventualCatalogTick]);
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
  // Admin 1.2/1.3 use SettingsActionBar; 1.4 removed it. Patch it only when present.
  const barStart=patched.indexOf('function SettingsActionBar({');
  if(barStart>=0){
    const barEnd=patched.indexOf('\nfunction ',barStart+1);
    if(barEnd<0) throw new Error("Unsupported settings action bar boundary.");
    patched=patched.slice(0,barStart)+patched.slice(barStart,barEnd).replace('jsx(PublishActions, {','jsx(PublishActions, { eventualUi,')+patched.slice(barEnd);
    patched=patched.replace('function SettingsActionBar({ collectionLabel,','function SettingsActionBar({ eventualUi=false, collectionLabel,');
    if(!patched.includes('function SettingsActionBar({ eventualUi=false, collectionLabel,')) throw new Error("Unsupported settings action bar signature.");
  }
  const publishPattern=/function PublishActions\(\{ collectionLabel, (isNew, isLive, hasPendingChanges, publishingState, isPending, disabled, onPublish, onUnpublish, onMenuOpenChange, size, (?:fullWidth|compact)) \}\) \{\n\tconst \{ _: _t4 \} = useLingui\(\);/;
  if(!publishPattern.test(patched)) throw new Error("Unsupported publish actions signature.");
  return patched.replace(publishPattern, (_match, props) => `function PublishActions({ eventualUi=false, collectionLabel, ${props} }) {\n const {locale: eventualPublishLocale}=useLocale(); const {_:eventualPublishT}=useLingui(); const _t4=eventualUi ? message=>eventualEditorText(eventualPublishT(message),eventualPublishLocale):eventualPublishT;`);
}
