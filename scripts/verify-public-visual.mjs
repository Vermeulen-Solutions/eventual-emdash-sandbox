/** Capture the production Astro example without redesign; CMS data is local fixture data. */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {chromium} from "@playwright/test";
const events=[
  {id:"community-day",title:"Journée solidaire de Puplinge",description:"## Une journée pour se rencontrer\n\nAteliers, musique et repas partagé pour toutes les générations.\n\n- Accueil dès 10 heures\n- Rencontre avec les associations",start:"2026-10-10",end:"2026-10-11",allDay:true,timezone:"Europe/Paris",location:"Salle communale — Rue de Graman 67, Puplinge",locationType:"hybrid",virtualUrl:"https://example.org/rencontre",status:"published",organizer:"Association solidaire",externalUrl:"https://example.org/inscription",imageUrl:"/poster.png",categories:["Communauté"],venue:null,directionsUrl:"https://maps.google.com/?q=Puplinge"},
  {id:"music-evening",title:"Concert et rencontre des voisins",description:"Une soirée musicale avec les artistes de la région.",start:"2026-10-15T17:00:00Z",end:"2026-10-15T19:30:00Z",allDay:false,timezone:"Europe/Paris",location:"École communale",locationType:"physical",status:"rescheduled",previousStartDate:"2026-10-14T17:00:00Z",organizer:"Équipe culturelle",externalUrl:"",imageUrl:"",categories:["Culture"],venue:null,directionsUrl:""},
  {id:"online-session",title:"Préparer ensemble les prochaines activités de l’association",description:"Réunion en ligne, ouverte aux bénévoles.",start:"2026-10-20T16:00:00Z",end:"2026-10-20T17:00:00Z",allDay:false,timezone:"Europe/Paris",location:"",locationType:"virtual",virtualUrl:"https://example.org/reunion",status:"cancelled",organizer:"Association solidaire",externalUrl:"",imageUrl:"",categories:["Bénévolat"],venue:null,directionsUrl:""},
];
let state="populated",site,browser;
const output=resolve("reports/public-visual");mkdirSync(output,{recursive:true});
const cms=createServer((request,response)=>{
  if(request.url === "/poster.png") {response.setHeader("content-type","image/png");response.end(readFileSync("images/registry/banner-v1.png"));return;}
  if(state === "error") {response.writeHead(503);response.end("Unavailable fixture");return;}
  response.setHeader("content-type","application/json");
  const url=new URL(request.url,"http://fixture.test");
  const selected=state === "empty" ? [] : events.filter(event=>!url.searchParams.get("category") || event.categories.includes(url.searchParams.get("category")));
  response.end(JSON.stringify({success:true,data:{ok:true,from:"2026-10-01",through:"2026-10-31",events:selected}}));
});
const reports=[],errors=[];
try {
  cms.listen(0,"127.0.0.1");await once(cms,"listening");
  process.env.EVENTUAL_API_ORIGIN=`http://127.0.0.1:${cms.address().port}`;
  process.env.EVENTUAL_LOCALE="fr";process.env.EVENTUAL_DISPLAY_TIMEZONE="Europe/Paris";
  process.env.ASTRO_NODE_AUTOSTART="disabled";
  const {handler}=await import("../examples/astro-events/dist/server/entry.mjs");
  site=createServer(handler);site.listen(0,"127.0.0.1");await once(site,"listening");
  const origin=`http://127.0.0.1:${site.address().port}`;
  browser=await chromium.launch();const page=await browser.newPage();page.on("pageerror",error=>errors.push(error.message));
  for(const [size,viewport] of Object.entries({desktop:{width:1440,height:1000},mobile:{width:390,height:844}})) {
    await page.setViewportSize(viewport);
    for(const view of ["list","timeline","cards","schedule","dates","month","locations"]) {
      const response=await page.goto(`${origin}/events?month=2026-10&view=${view}`);
      assert.equal(response.status(),200);await page.locator("h1").waitFor();
      if(view === "month") await page.locator(".calendar-day__events > summary").first().click();
      assert(await page.locator("body").innerText().then(text=>text.includes(events[0].title)));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${size} ${view} overflow`);
      if(size === "desktop" && view === "list") {
        const widths=await page.locator(".agenda-item--without-image").first().evaluate(item=>({
          item:item.getBoundingClientRect().width,
          body:item.querySelector(".agenda-item__body").getBoundingClientRect().width,
        }));
        assert(widths.body>widths.item*0.7,"Image-less agenda content must use the available row width");
      }
      const path=resolve(output,`${size}-${view}.png`);await page.screenshot({path,fullPage:true});reports.push({size,view,path,status:response.status()});
    }
    const detail=await page.goto(`${origin}/events/community-day?from=2026-10-10&through=2026-10-11`);
    assert.equal(detail.status(),200);assert(await page.getByRole("heading",{name:events[0].title,exact:true}).isVisible());
    await page.locator(".calendar-menu > summary").click();
    assert(await page.getByRole("link",{name:"Google Agenda",exact:true}).isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${size} detail overflow`);
    const path=resolve(output,`${size}-detail.png`);await page.screenshot({path,fullPage:true});reports.push({size,view:"detail",path,status:detail.status()});
    state="empty";
    const empty=await page.goto(`${origin}/events?month=2026-10&view=list`);assert.equal(empty.status(),200);
    await page.screenshot({path:resolve(output,`${size}-empty.png`),fullPage:true});
    reports.push({size,view:"empty",path:resolve(output,`${size}-empty.png`),status:empty.status()});
    state="error";
    const failed=await page.goto(`${origin}/events?month=2026-10&view=list`);assert.equal(failed.status(),502);
    assert(await page.getByRole("status").isVisible());await page.screenshot({path:resolve(output,`${size}-error.png`),fullPage:true});
    reports.push({size,view:"error",path:resolve(output,`${size}-error.png`),status:failed.status()});
    state="populated";
  }
  assert.deepEqual(errors,[]);writeFileSync(resolve(output,"capture.json"),JSON.stringify({passed:true,fixture:true,designPreserved:true,captures:reports,errors},null,2));
  console.log(JSON.stringify({passed:true,captures:20,designPreserved:true,output}));
} finally {
  await browser?.close();
  for(const server of [site,cms]) {if(!server)continue;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
