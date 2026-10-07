import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editorText, localizeEventualBlocks, draftSummary,fillFrenchCoreMessages } from "../astro/editor-i18n.mjs";
import {setupI18n} from "@lingui/core";
import { patchEventualPresentation } from "../astro/editor-compat.mjs";
test("French presentation follows UI language and preserves editable data and row titles", () => {
  const source = [{ type: "context", block_id: "eventual-ui", text: "When" }, { type: "form", fields: [{ label: "Repeat", initial_value: "Daily", options: [{ value: "daily", label: "Daily" }] }], submit: { action_id: "apply", label: "Apply dates to draft" } }, { type: "table", columns: [{ label: "Event" }], rows: [{ title: "Repeat", status: "draft", edit: {type:"button",label:"Edit",value:"Daily"} }] }];
  const original = structuredClone(source);
  const translated = localizeEventualBlocks(source, "fr-CH");
  assert.equal(translated[0].text, "Quand");
  assert.equal(translated[1].fields[0].initial_value, "Daily");
  assert.deepEqual(translated[1].fields[0].options[0], { value: "daily", label: "Chaque jour" });
  assert.equal(translated[2].rows[0].title, "Repeat");
  assert.equal(translated[2].rows[0].status, "Brouillon");
  assert.equal(translated[2].rows[0].edit.value, "Daily");
  assert.deepEqual(source, original);
  assert.equal(localizeEventualBlocks([{ type:"header",text:"When" }], "fr")[0].text, "When");
  assert.deepEqual(localizeEventualBlocks(source, "en"), source);
});
test("narrow panels present occurrence dates without a wide table or changed recurrence IDs",()=>{
  const action={type:"button",action_id:"edit-occurrence",label:"Manage date",value:"2026-11-02T10:00"};
  const source=[{type:"context",block_id:"eventual-ui"},{type:"table",rows:[{date:"2 nov. 2026",effective:"2 nov. 2026",status:"scheduled",action}]}];
  const result=localizeEventualBlocks(source,"fr");
  assert.equal(result.some(block=>block.type === "table"),false);
  assert.deepEqual(result[1].fields,[{label:"Date",value:"2 nov. 2026"}]);
  assert.equal(result[2].elements[0].value,action.value);
  assert.equal(source[1].rows[0].action.label,"Manage date");
});
test("French catalog repairs preserve host translations and English messages",()=>{
  const i18n=setupI18n({locale:"fr",messages:{fr:{xVT291:["Live version"],vaizKG:["Publication personnalisée"]},en:{xVT291:["Live version"]}}});
  assert.equal(fillFrenchCoreMessages(i18n),true);
  assert.equal(i18n._("xVT291"),"Version publiée");
  assert.equal(i18n._("vaizKG"),"Publication personnalisée");
  assert.equal(fillFrenchCoreMessages(i18n),false);
  i18n.activate("en");assert.equal(fillFrenchCoreMessages(i18n),false);assert.equal(i18n._("xVT291"),"Live version");
});
test("recurrence summaries explain weekdays and monthly missing-day behavior", () => {
  assert.equal(editorText("every 2 weeks on Monday, Thursday through 2026-12-17", "fr"), "Toutes les 2 semaines, le lundi et le jeudi jusqu’au 17 décembre 2026");
  assert.equal(editorText("monthly on last monday through 2026-12-17", "fr"), "Chaque mois, le dernier lundi jusqu’au 17 décembre 2026");
  assert.match(editorText("monthly on day 31 (use last day if missing) through 2026-12-17", "fr"), /dernier jour du mois/);
});
test("the tested admin adapter only changes presentation and rejects unknown builds", () => {
  const source = readFileSync(new URL("../node_modules/@emdash-cms/admin/dist/index.js", import.meta.url), "utf8");
  const translated = patchEventualPresentation(source);
  assert.match(translated, /localizeEventualBlocks/);
  assert.match(translated, /EventualOriginalBlockRenderer/);
  assert.match(translated, /eventualOriginalT/);
  assert.match(translated, /eventualDraftSummary\(operation.field/);
  assert.match(translated, /eventualEditorText\(error.message,eventualPageUiLocale\)/);
  assert.equal(translated.includes('eventualEditorText(error.message,i18n.locale)'),false);
  assert.equal(translated.includes("onDraftResponse(response)"), source.includes("onDraftResponse(response)"));
  assert.throws(() => patchEventualPresentation("different build"), /Unsupported/);
});
test("draft review shows names, civil dates and human recurrence without changing values", () => {
  localizeEventualBlocks([{type:"context",block_id:"eventual-ui"},{type:"combobox",action_id:"venue",options:[{value:"stable-row",label:"School — Rue de l’École [EN]"}]}],"fr");
  assert.equal(draftSummary("venue_id","stable-row","fr"),"School — Rue de l’École [EN]");
  const rule={frequency:"weekly",interval:2,weekdays:["monday"],until:"2030-12-01"};
  const source=JSON.stringify(rule);
  assert.match(draftSummary("recurrence",source,"fr"),/^Toutes les 2 semaines, le lundi jusqu’au/);
  assert.equal(JSON.stringify(rule),source);
  assert.equal(draftSummary("categories","[]","fr"),"—");
  assert.equal(draftSummary("start_date","2030-11-04","fr","America/New_York"),"4 novembre 2030");
  assert.match(draftSummary("exceptions",[{recurrenceId:"2030-11-04T11:00",status:"cancelled"}],"fr"),/Annulé/);
  const changed=draftSummary("exceptions",[{recurrenceId:"2030-11-04T11:00",status:"modified",overrides:{start:"2030-11-05T13:00:00Z",end:"2030-11-05T14:00:00Z",timezone:"Europe/Paris"}}],"fr");
  assert.match(changed,/Nouvelle date/);assert.match(changed,/5 novembre 2030.*14:00/);
  assert.match(draftSummary("occurrence_content",[{recurrenceId:"2030-11-04",overrides:{description:[{children:[{text:"Une annonce"}]}]}}],"fr"),/Description: Une annonce/);
  assert.match(editorText("Publish a valid referenced venue before publishing or scheduling this event.","fr"),/Publiez d’abord/);
});
