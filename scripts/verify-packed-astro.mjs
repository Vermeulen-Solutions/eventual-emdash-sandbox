import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import {createHash} from "node:crypto";
const root = process.cwd();
const npm = process.env.npm_execpath;
if (!npm) throw new Error("Run through npm run test:package.");
function run(script, args, cwd = root) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      (result.stdout ?? "") +
        "\n" +
        (result.stderr ?? "") +
        (result.error?.message ?? ""),
    );
  return result.stdout;
}
run(npm, ["run", "build"]);
const work = resolve(root, "reports", "packed-consumer-" + Date.now());
mkdirSync(join(work, "src", "pages"), { recursive: true });
const packed = JSON.parse(
  run(npm, ["pack", "--json", "--ignore-scripts", "--pack-destination", work]),
);
writeFileSync(
  join(work, "package.json"),
  JSON.stringify({
    name: "eventual-package-check",
    private: true,
    type: "module",
    dependencies: { react: "19.2.4", "react-dom": "19.2.4", emdash: "1.0.1", astro: "7.3.2", "@astrojs/node": "11.1.5", "@astrojs/react": "6.0.5", "@emdash-cms/sandbox-workerd": "0.9.1" },
    overrides: { sharp: "0.35.5", "undici@7.29.0": "7.29.1" },
  }),
);
run(
  npm,
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    join(work, packed[0].filename),
  ],
  work,
);
writeFileSync(
  join(work, "astro.config.mjs"),
  "import {defineConfig} from 'astro/config'; export default defineConfig({output:'static',site:'https://consumer.example'});\n",
);
writeFileSync(
  join(work, "verify-editor.mjs"),
  `import {eventualEditor,createPlugin} from './node_modules/eventual/astro/descriptor.mjs'; import {eventualEditorCompatibility} from 'eventual/admin/compat'; import {checkEditorVersions,emdashWithEventual} from 'eventual/install'; import eventual from 'eventual'; if(eventualEditor().version!==eventual.version || Object.keys(createPlugin().routes).length || !eventualEditorCompatibility().transform) throw Error('Packed editor companion failed'); checkEditorVersions(); emdashWithEventual({sandboxed:[eventual]}); emdashWithEventual({});`,
);
run(join(work, "verify-editor.mjs"), [], work);
const installedSchema=JSON.parse(run(join(work,"node_modules/eventual/scripts/export-native-schema.mjs"),[],work));
if(!installedSchema.collections.some(collection=>collection.slug === "events")) throw new Error("Installed schema CLI failed.");
writeFileSync(
  join(work, "src", "pages", "[locale].astro"),
  `---
import {expandEventOccurrences,eventToJsonLd,serializeJsonLd} from 'eventual/astro';
import {createEventsCollectionBlueprint} from 'eventual/schema';
import EventList from 'eventual/astro/EventList.astro';
export function getStaticPaths(){return ['en','fr','ar','th'].map(locale=>({params:{locale}}));}
const locale=Astro.params.locale;
const native={id:'cms-id',type:'events',status:'published',locale:'fr',slug:'native-slug',url:'https://consumer.example/fr/events/native-slug',data:{title:'Concert é',description:[{_type:'block',children:[{text:'Literal <example> and **notation**'}]}],start:'2026-11-15T10:00:00Z',end:'2026-11-15T11:00:00Z',all_day:0,timezone:'Europe/Paris',venue:'hall',featured_image:{src:'/assets/poster.png'},event_status:'rescheduled',previous_start_date:'2026-11-14T10:00:00Z'}};
const live={id:'all-day-slug',data:{id:'cms-all-day',title:'All day',status:'published',all_day:1,start_date:'2026-11-15',end_date:'2026-11-16',timezone:'Europe/Paris'}};
const events=expandEventOccurrences([native,live],{from:'2026-11-01',through:'2026-11-30',siteUrl:'https://consumer.example',venues:[{id:'hall',type:'venues',data:{name:'Native hall',street:'Main street',city:'Paris'}}]});
if(events.length!==2 || !events.some(event=>event.id==='cms-all-day') || !events.some(event=>event.id==='cms-id'))throw new Error('Packed native/Live adapters failed: '+JSON.stringify(events));
if(!createEventsCollectionBlueprint().supports.includes('scheduling'))throw new Error('Packed schema export failed');
const ld=serializeJsonLd(eventToJsonLd(events.find(event=>event.id==='cms-id'),{siteUrl:'https://consumer.example'}));
---
<html lang={locale}><head><title>Package check</title><script type="application/ld+json" set:html={ld}/></head><body><EventList events={events} locale={locale} /></body></html>
`,
);
run(resolve(root, "node_modules/astro/bin/astro.mjs"), ["build"], work);
const reports = [];
for (const locale of ["en", "fr", "ar", "th"]) {
  const html = readFileSync(join(work, "dist", locale, "index.html"), "utf8");
  const dates = [...html.matchAll(/(?:from|through)=(\d{4}-\d{2}-\d{2})/g)];
  if (
    dates.length !== 4 ||
    !html.includes(
      "https://consumer.example/fr/events/native-slug?from=2026-11-15",
    )
  )
    throw new Error("Packed machine URL dates failed for " + locale);
  const json = JSON.parse(
    /<script type="application\/ld\+json">([^]*?)<\/script>/.exec(html)?.[1] ??
      "null",
  );
  if (
    json?.image !== "https://consumer.example/assets/poster.png" ||
    json.eventStatus !== "https://schema.org/EventRescheduled" ||
    json.previousStartDate !== "2026-11-14T10:00:00Z" ||
    json.description !== "Literal <example> and **notation**" ||
    json.location?.name !== "Native hall"
  )
    throw new Error("Packed JSON-LD failed for " + locale);
  const display = /<time[^>]*>([^<]+)<\/time>/.exec(html)?.[1];
  if (!display) throw new Error("Missing localized date for " + locale);
  reports.push({
    locale,
    display,
    machineDates: dates.map((match) => match[1]),
  });
}
if (
  reports.find((item) => item.locale === "ar").display === reports[0].display ||
  reports.find((item) => item.locale === "th").display === reports[0].display
)
  throw new Error("Packed dates were not localized.");
const packagePath=join(work,packed[0].filename);
const digest=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
const report = { package: packed[0].filename, packagePath, sha256:digest(packagePath), consumer: work, pages: reports, installedFiles:packed[0].files.map(file=>({path:file.path,sha256:digest(join(work,"node_modules/eventual",file.path))})) };
writeFileSync(
  resolve(root, "reports", "packed-astro.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
