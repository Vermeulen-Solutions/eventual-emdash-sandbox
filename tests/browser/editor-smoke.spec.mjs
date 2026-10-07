import {test,expect} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const fixtures=JSON.parse(readFileSync(process.env.EVENTUAL_BROWSER_FIXTURES,'utf8'));
const origin=process.env.EVENTUAL_TEST_ORIGIN;
const folder='images/registry-0.13.0';mkdirSync(folder,{recursive:true});
const picker=(page,label)=>page.getByRole('combobox',{name:label,exact:true});
const choose=async(page,label,option)=>{await picker(page,label).click();await page.getByRole('option',{name:option,exact:true}).click();};
// EmDash 1.2 emits these three React diagnostics from its stock renderer.
// Keep the exact upstream exceptions visible; all other errors fail acceptance.
const upstreamDiagnostic=message=>/^In HTML, (?:%s )?<form> cannot be a descendant of <form>\./.test(message)
 || /^<form> cannot contain a nested <form>\./.test(message)
 || message.startsWith('In HTML, %s cannot be a descendant of <%s>.')&&message.includes('This will cause a hydration error.%s <form> form ')
 || message==='<%s> cannot contain a nested %s.\nSee this log for the ancestor stack trace. form <form>'
 || message.includes('Each child in a list should have a unique "key" prop.')&&message.includes('ComboboxList');
test.beforeEach(async({page},info)=>{
 const errors=[],known=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error') (upstreamDiagnostic(message.text())?known:errors).push(message.text());});
 info.consoleEvidence={errors,known};
});
test.afterEach(async({},info)=>{
 const evidence=info.consoleEvidence;
 writeFileSync('reports/browser-console-'+info.title.split(' ')[0].toLowerCase()+'.json',JSON.stringify(evidence,null,2)+'\n');
 expect(evidence.errors,'Unexpected browser console or page errors').toEqual([]);
});
const savePanel=async(page,label)=>{
 const url=page.url(),navigations=[];
 const listener=frame=>{if(frame===page.mainFrame())navigations.push(frame.url());};
 page.on('framenavigated',listener);
 try {
  const response=page.waitForResponse(response=>response.url().includes('/panel/event-schedule')&&response.request().method()==='POST');
  await page.getByRole('button',{name:label,exact:true}).click();
  const saved=await response;expect(saved.ok()).toBe(true);
  expect((await saved.json()).data.toast?.type).toBe('success');
  await expect(page.getByText('Brouillon des dates enregistré.',{exact:true})).toBeVisible();
  await expect(page.locator('[contenteditable=true]')).toContainText('Annonce riche préservée');
  expect(page.url()).toBe(url);expect(navigations,'Panel save must not submit/reload the outer editor form').toEqual([]);
 } finally {page.off('framenavigated',listener);}
};
const login=async(page,context,locale)=>{await context.addCookies([{name:'emdash-locale',value:locale,url:origin+'/_emdash'}]);await page.goto('/_emdash/api/auth/dev-bypass?redirect='+encodeURIComponent('/_emdash/admin/plugins/eventual/settings'));const welcome=page.getByRole('dialog').getByRole('button',{name:locale==='fr'?'Commencer':'Get Started',exact:true});await welcome.waitFor({state:'visible',timeout:15000}).then(()=>welcome.click()).catch(()=>{});};
test('French settings connect native content types and rich editor',async({page,context})=>{
 await login(page,context,'fr');
 await choose(page,'Collection des événements','Events (activities)');
 await choose(page,'Collection des lieux','Venues (locations)');
 await choose(page,'Collection des organisations','Organizers (hosts)');
 const settingsSaved=page.waitForResponse(response=>response.url().endsWith('/plugins/eventual/admin')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Enregistrer les paramètres',exact:true}).click();
 await settingsSaved;
 await expect(page.getByText('Paramètres non enregistrés',{exact:true})).toHaveCount(0);
 await page.reload();
 await expect(picker(page,'Collection des événements')).toContainText('Events (activities)');
 await page.screenshot({path:folder+'/native-fr-settings.png',fullPage:true});
 await page.goto('/_emdash/admin/content/activities');
 await page.getByText('Rencontre des voisins',{exact:true}).click();
 await expect(page.locator('[contenteditable=true]')).toBeVisible();
 await expect(page.locator('[contenteditable=true]')).toContainText('Annonce riche préservée');
 await expect(page.locator('[contenteditable=true] strong')).toContainText('Annonce riche préservée');
 await page.getByRole('button',{name:'Dates, venue & repeat',exact:true}).click();
 await expect(page.getByRole('button',{name:'Enregistrer les dates',exact:true})).toBeVisible();
 await savePanel(page,'Enregistrer les dates');
 await page.getByRole('button',{name:'Où',exact:true}).click();
 await picker(page,'Lieu enregistré').click();
 await page.getByRole('option',{name:/École communale/}).click();
 await picker(page,'Organisation enregistrée').click();
 await page.getByRole('option',{name:/^Association de quartier \[FR\]$/}).click();
 await savePanel(page,'Enregistrer le lieu et l’organisation');
 await page.reload();
 await expect(page.locator('[contenteditable=true]')).toContainText('Annonce riche préservée');
 await page.getByRole('button',{name:'Dates, venue & repeat',exact:true}).click();
 await page.getByRole('button',{name:'Où',exact:true}).click();
 await expect(picker(page,'Lieu enregistré')).toHaveValue(/École communale/);
 await expect(picker(page,'Organisation enregistrée')).toHaveValue('Association de quartier [FR]');
 await page.getByRole('button',{name:'Répétition',exact:true}).click();
 await choose(page,'Répétition','Chaque semaine');
 await expect(page.getByText('Jours de la semaine',{exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:'Lundi',exact:true}).check();
 await page.getByText('Dernière date de répétition',{exact:true}).locator('..').locator('input[type=date]').fill(fixtures.through);
 await savePanel(page,'Enregistrer la répétition');
 await page.reload();
 await page.getByRole('button',{name:'Dates, venue & repeat',exact:true}).click();
 await page.getByRole('button',{name:'Répétition',exact:true}).click();
 await expect(picker(page,'Répétition')).toContainText('Chaque semaine');
 await expect(page.getByRole('checkbox',{name:'Lundi',exact:true})).toBeChecked();
 await page.getByRole('button',{name:'Dates individuelles',exact:true}).click();
 await expect(page.getByRole('button',{name:'Annuler la date',exact:true})).toHaveCount(4);
 const cancel=page.waitForResponse(response=>response.url().includes('/panel/event-schedule')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Annuler la date',exact:true}).first().click();expect((await cancel).ok()).toBe(true);
 await page.getByRole('button',{name:'Dates individuelles',exact:true}).click();
 await expect(page.getByRole('button',{name:'Rétablir la date',exact:true})).toHaveCount(1);
 const restore=page.waitForResponse(response=>response.url().includes('/panel/event-schedule')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Rétablir la date',exact:true}).click();expect((await restore).ok()).toBe(true);
 await page.getByRole('button',{name:'Dates individuelles',exact:true}).click();
 await expect(page.getByRole('button',{name:'Rétablir la date',exact:true})).toHaveCount(0);
 await expect(page.locator('[contenteditable=true] strong')).toContainText('Annonce riche préservée');
 await page.screenshot({path:folder+'/native-fr-editor-desktop.png',fullPage:true});
 const feed=locale=>'/_emdash/api/plugins/eventual/publicEvents?'+new URLSearchParams({from:fixtures.from,through:fixtures.through,locale});
 const before=await page.request.get(feed('fr'));expect(before.ok()).toBe(true);const draftFeed=await before.json();expect(draftFeed.success).toBe(true);expect(draftFeed.data.ok).toBe(true);expect(draftFeed.data.events).toEqual([]);
 const publishLabel=/^(Publish now|Publier maintenant)$/;
 await page.getByRole('button',{name:publishLabel}).first().click();
 const publication=page.waitForResponse(response=>response.url().includes('/content/activities/')&&new URL(response.url()).pathname.endsWith('/publish')&&response.request().method()==='POST');
 await page.getByRole('dialog').getByRole('button',{name:publishLabel}).click();expect((await publication).ok()).toBe(true);
 const live=await page.request.get(feed('fr'));expect(live.ok()).toBe(true);const liveFeed=await live.json();expect(liveFeed.success).toBe(true);expect(liveFeed.data.ok).toBe(true);const events=liveFeed.data.events;
 expect(events).toHaveLength(4);
 expect(events.every(event=>event.title==='Rencontre des voisins'&&event.venue?.name==='École communale'&&event.organizer==='Association de quartier')).toBe(true);
 expect(events[0].descriptionBlocks[0].children[0].marks).toContain('strong');
 const strict=await page.request.get(feed('en')+'&strict=true');expect((await strict.json()).data.events).toEqual([]);
 const fallback=await page.request.get(feed('en'));expect((await fallback.json()).data.events[0].title).toBe('[FR] Rencontre des voisins');
 const calendar=async locale=>(await page.request.get('/_emdash/api/plugins/eventual/calendar?locale='+locale)).text();
 const frenchCalendar=await calendar('fr'),englishCalendar=await calendar('en');
 expect(frenchCalendar).toContain('SUMMARY:Rencontre des voisins');expect(frenchCalendar).toContain('École communale');
 expect([...frenchCalendar.matchAll(/^UID:(.+)$/gm)].map(match=>match[1])).toEqual([...englishCalendar.matchAll(/^UID:(.+)$/gm)].map(match=>match[1]));
 // The packed Astro component example has its existing plain styling; no theme is installed.
 await page.goto('/component-preview');await expect(page.getByRole('link',{name:'Concert é',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.characterSet)).toBe('UTF-8');
 await expect(page.locator('time')).toHaveCount(2);
 await page.screenshot({path:folder+'/native-public-component-fr-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:folder+'/native-public-component-fr-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
test('English companion links directly to configured collections',async({page,context})=>{
 await login(page,context,'en');await choose(page,'Event collection','Events (activities)');await choose(page,'Venue collection','Venues (locations)');await choose(page,'Organizer collection','Organizers (hosts)');const saved=page.waitForResponse(response=>response.url().endsWith('/plugins/eventual/admin')&&response.request().method()==='POST');await page.getByRole('button',{name:'Save settings',exact:true}).click();await saved;await expect(page.getByText('Settings not saved',{exact:true})).toHaveCount(0);await page.goto('/_emdash/admin/plugins/eventual/events');
 await expect(page.getByRole('link',{name:'Create event',exact:true})).toHaveAttribute('href',/content\/activities\/new/);
 await expect(page.getByRole('link',{name:'Manage venues',exact:true})).toHaveAttribute('href',/content\/locations$/);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:folder+'/native-en-workspace-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});
