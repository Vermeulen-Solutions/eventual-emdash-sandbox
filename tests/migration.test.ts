import { afterEach, describe, expect, it } from "vitest";
import {
  createPluginRuntimeTestHost,
  type PluginRuntimeTestHost,
} from "@emdash-cms/plugin-test";
import {
  createEventsCollectionBlueprint,
  createVenuesCollectionBlueprint,
  createOrganizersCollectionBlueprint,
} from "../src/schema/blueprint";
import { expandEventOccurrences } from "../src/domain/event-expansion";
let host: PluginRuntimeTestHost | undefined;
afterEach(async () => {
  await host?.dispose();
  host = undefined;
});
async function setup() {
  host = await createPluginRuntimeTestHost({
    site: { url: "https://audit.example.com", locale: "fr" },
    i18n: { defaultLocale: "fr", locales: ["fr", "en"] },
  });
  await host.fixtures.collection(createEventsCollectionBlueprint({legacyCompatibility:true}) as any);
  await host.fixtures.collection(createVenuesCollectionBlueprint({legacyCompatibility:true}) as any);
  return host;
}
const schedule = {
  title: "Native event",
  start: "2026-11-15T10:00:00.000Z",
  end: "2026-11-15T11:00:00.000Z",
  timezone: "UTC",
  all_day: false,
};
const legacy = {
  ...schedule,
  id: "legacy-event",
  description: "**Important** [Register](https://example.com)",
  allDay: false,
  published: true,
  status: "published",
  categories: [],
  exceptions: [],
  organizer: "",
  externalUrl: "",
  imageUrl: "",
  location: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const calendar = async (h: PluginRuntimeTestHost, query = "") => {
  const request = {
    method: "GET",
    url:
      "https://audit.example.com/_emdash/api/plugins/eventual/calendar" + query,
  };
  let response = await h.actions.routes.request('calendar', request);
  // A cold aggregate import may exhaust the rendering allowance after its atomic commit.
  // Its complete snapshot lets the next fresh invocation finish without bootstrap reads.
  if (response.status === 503 && (await response.clone().text()).includes('sandbox RPC budget'))
    response = await h.actions.routes.request('calendar', request);
  expect(response.status).toBe(200);
  return response.text();
};
describe("Native modernization through the EmDash production runtime", {timeout:60_000}, () => {
  it('rejects migration of manual translations instead of silently losing their locale rows',async()=>{
    const h=await setup();
    const original={...legacy,locale:'fr',translations:{en:{title:'English announcement',description:'English copy',location:'',organizer:''}}};
    await h.fixtures.plugin.storage('events','legacy-event',original);
    for(const dryRun of [true,false]) {
      const response=await h.transport.invokeRoute('mcp/transfer/migrateToNative',{dryRun,locale:'fr'}) as any;
      expect(JSON.stringify(response)).toContain('Manual translations need explicit native locale rows');
      expect(await h.inspect.content.list('events')).toHaveLength(0);
      expect(await h.inspect.storage.get('events','legacy-event')).toEqual(original);
    }
  });
  it("duplicates through the authorized workspace into a new unpublished native draft", async () => {
    const h = await setup();
    const user = await h.fixtures.user({
      email: "duplicate-editor@example.com",
      role: "editor",
      emailVerified: true,
    });
    await h.fixtures.content("events", {
      id: "duplicate-source",
      slug: "duplicate-source",
      locale: "fr",
      status: "published",
      data: {
        ...schedule,
        calendar_uid: "legacy-source@audit.example.com",
        legacy_id: "legacy-source",
        recurrence: { frequency: "daily", until: "2026-11-17" },
        exceptions: [{ recurrenceId: "2026-11-16T10:00", status: "cancelled" }],
        occurrence_content: [
          {
            recurrenceId: "2026-11-17T10:00",
            overrides: { title: "One date" },
          },
        ],
      },
    });
    const result = await h.admin.act("/events", "duplicate-event", {
      user,
      value: "duplicate-source",
    });
    expect(JSON.stringify(result)).toContain("Draft copy created");
    const copies = await h.inspect.content.list("events");
    const duplicate = copies.find((item) => item.id !== "duplicate-source");
    expect(duplicate, JSON.stringify(result)).toBeDefined();
    expect(duplicate!.status).toBe("draft");
    expect(duplicate!.locale).toBe("fr");
    expect(duplicate!.translationGroup).not.toBe("duplicate-source");
    expect(duplicate!.data.title).toBe("Native event (copy)");
    for (const key of [
      "calendar_uid",
      "legacy_id",
      "legacy_metadata",
      "schedule_history",
      "previous_start_date",
      "exceptions",
      "occurrence_content",
    ])
      expect(duplicate!.data[key] ?? null).toBeNull();
    expect(duplicate!.data.recurrence).toMatchObject({ frequency: "daily" });
    expect(await calendar(h)).not.toContain("(copy)");
  });
  it("resolves translated venue and organizer names without changing shared reference IDs", async () => {
    const h = await setup();
    await h.fixtures.collection(createOrganizersCollectionBlueprint() as any);
    for (const [locale, name] of [
      ["fr", "Salle française"],
      ["en", "English hall"],
    ])
      await h.fixtures.content("venues", {
        id: "hall-" + locale,
        locale,
        ...(locale === "en" ? { translationOf: "hall-fr" } : {}),
        status: "published",
        data: { name },
      });
    for (const [locale, name] of [
      ["fr", "Organisateur français"],
      ["en", "English organizer"],
    ])
      await h.fixtures.content("organizers", {
        id: "organizer-" + locale,
        locale,
        ...(locale === "en" ? { translationOf: "organizer-fr" } : {}),
        status: "published",
        data: { name },
      });
    for (const [locale, title] of [
      ["fr", "Événement"],
      ["en", "English event"],
    ])
      await h.fixtures.content("events", {
        id: "localized-" + locale,
        slug: "localized-" + locale,
        locale,
        ...(locale === "en" ? { translationOf: "localized-fr" } : {}),
        status: "published",
        data: {
          ...schedule,
          title,
          venue: "hall-fr",
          organizer_ref: "organizer-fr",
        },
      });
    const english = await calendar(h, "?locale=en&strict=true");
    const french = await calendar(h, "?locale=fr&strict=true");
    expect(english).toContain("English hall");
    expect(french).toContain("Salle française");
    expect(/UID:([^\r]+)/.exec(english)?.[1]).toEqual(
      /UID:([^\r]+)/.exec(french)?.[1],
    );
    const json = (await h.transport.invokeRoute("publicEvents", {
      locale: "en",
      strict: true,
      from: "2026-11-01",
      through: "2026-11-30",
    })) as any;
    expect(json.events[0].venue.name).toBe("English hall");
    expect(json.events[0].organizer).toBe("English organizer");
    expect(
      (await h.inspect.content.get("events", "localized-en"))!.data.venue,
    ).toBe("hall-fr");
  });
  it("edits schedules through the native saved-entry panel without losing rich text or exposing drafts", async () => {
    const h=await setup();
    const user=await h.fixtures.user({email:'panel-editor@example.com',role:'editor',emailVerified:true});
    await h.fixtures.content('venues',{id:'selected-venue',locale:'fr',status:'published',data:{name:'Saved hall',street:'Published address'}});
    const description=[{_type:'block',_key:'rich',style:'normal',markDefs:[],children:[{_type:'span',_key:'bold',text:'Preserved rich text',marks:['strong']}]}];
    await h.fixtures.content('events',{id:'panel-event',slug:'panel-event',locale:'fr',status:'published',data:{...schedule,description,recurrence:{frequency:'daily',until:'2026-11-17'},exceptions:[],occurrence_content:[]}});
    const all=(response:any):any[]=>response.blocks.flatMap((block:any)=>[block,...(block.blocks?all({blocks:block.blocks}):[])]);
    const load=()=>h.admin.loadEditorPanel('event-schedule','events','panel-event',{user});
    const findForm=(response:any,id:string)=>all(response).find(block=>block.block_id===id);
    const submit=async(id:string,values:any)=>{
      const form=findForm(await load(),id);
      return h.admin.submitEditorPanel('event-schedule','events','panel-event',form.submit.action_id,values,{user,blockId:form.block_id});
    };
    const panel=await load();expect(JSON.stringify(panel)).toContain('Saved hall');
    const blockIds=all(panel).map(block=>block.block_id).filter(Boolean);
    expect(new Set(blockIds).size).toBe(blockIds.length);
    const stale=findForm(panel,'apply-details');
    const saved=await submit('apply-details',{venue:'selected-venue',organizer_ref:'',categories:''});
    expect(JSON.stringify(saved)).toContain('Schedule draft saved');
    const pending=(await h.inspect.content.get('events','panel-event'))!;
    expect(pending.draftRevisionId).toBeTruthy();expect(pending.data.description).toEqual(description);
    expect(await calendar(h)).not.toContain('Published address');
    const rejected=await h.admin.submitEditorPanel('event-schedule','events','panel-event',stale.submit.action_id,{venue:'',categories:''},{user,blockId:stale.block_id});
    expect(JSON.stringify(rejected)).toContain('This event changed');
    expect((await h.actions.content.publish('events','panel-event')).success).toBe(true);
    expect(await calendar(h)).toContain('Published address');
    const edit=all(await load()).flatMap(block=>block.elements??[]).find(item=>item.action_id?.startsWith('edit-occurrence|'));
    const view=await h.admin.actEditorPanel('event-schedule','events','panel-event',edit.action_id,{user,value:edit.value});
    const copy=findForm(view,'set-occurrence-copy');
    const copied=await h.admin.submitEditorPanel('event-schedule','events','panel-event',copy.submit.action_id,{recurrence_id:edit.value,use_title:true,copy_title:'Special date',use_description:true,copy_description:'Occurrence announcement'},{user,blockId:copy.block_id});
    expect(JSON.stringify(copied)).toContain('Schedule draft saved');
    expect(await calendar(h)).not.toContain('SUMMARY:Special date');
    expect((await h.actions.content.publish('events','panel-event')).success).toBe(true);
    const live=await calendar(h);expect(live).toContain('SUMMARY:Special date');expect(live).toContain('DESCRIPTION:Occurrence announcement');
    const output:any=await h.transport.invokeRoute('publicEvents',{from:'2026-11-01',through:'2026-11-30'});
    expect(output.events.find((item:any)=>item.title==='Special date').descriptionBlocks).toEqual(expect.any(Array));
    await submit('apply-details',{venue:'',organizer_ref:'',categories:''});
    expect((await h.actions.content.publish('events','panel-event')).success).toBe(true);
    expect(await calendar(h)).not.toContain('Published address');
    expect((await h.inspect.content.get('events','panel-event'))!.data.description).toEqual(description);
    expect(await h.inspect.storage.list('events')).toHaveLength(0);
  });
  it("reads native metadata and keeps an empty native collection authoritative", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("events", "legacy-event", legacy);
    expect(await calendar(h)).not.toContain("SUMMARY:Native event");
    await h.fixtures.content("events", {
      id: "native",
      status: "published",
      locale: "fr",
      data: schedule,
    });
    expect(await calendar(h, "?locale=fr")).toContain("SUMMARY:Native event");
    const json = (await h.transport.invokeRoute("publicEvents", {
      from: "2026-11-01",
      through: "2026-11-30",
    })) as any;
    expect(json.events).toHaveLength(1);
    expect(json.events[0].id).toBe("native");
  });
  it("accepts editorial patches and rejects invalid schedule patches with an actionable reason", async () => {
    const h = await setup();
    await h.fixtures.content("events", {
      id: "patch",
      status: "draft",
      data: schedule,
    });
    expect(
      (
        await h.actions.content.update("events", "patch", {
          data: { title: "Edited" },
        })
      ).success,
    ).toBe(true);
    const invalid = await h.actions.content.update("events", "patch", {
      data: { timezone: "Mars/Olympus" },
    });
    expect(invalid).toMatchObject({
      success: false,
      error: { code: "SAVE_REJECTED" },
    });
  });
  it("saves and expands explicit all-day civil dates", async () => {
    const h = await setup();
    const saved = await h.actions.content.create("events", {
      data: {
        title: "All day",
        all_day: true,
        start_date: "2026-11-15",
        end_date: "2026-11-16",
        timezone: "Europe/Paris",
      },
    });
    expect(saved.success).toBe(true);
    if (!saved.success) throw Error(saved.error.message);
    const item = saved.data.item;
    const events = expandEventOccurrences([{ ...item, status: "published" }], {
      from: "2026-11-01",
      through: "2026-11-30",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      start: "2026-11-15",
      end: "2026-11-16",
      allDay: true,
    });
  });
  it("previews without writes, migrates generated IDs, publishes and reruns idempotently", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("venues", "legacy-venue", {
      id: "legacy-venue",
      name: "Hall",
      street: "Main street",
    });
    await h.fixtures.plugin.storage("events", "legacy-event", {
      ...legacy,
      venueId: "legacy-venue",
    });
    const preview = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      { dryRun: true },
    )) as any;
    expect(preview.ok, JSON.stringify(preview)).toBe(true);
    expect(preview.venues[0]).toMatchObject({
      status: "planned",
      nativeId: "",
    });
    expect(preview.events[0]).toMatchObject({
      status: "planned",
      nativeId: "",
    });
    expect(await h.inspect.content.list("events")).toHaveLength(0);
    const migrated = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      {},
    )) as any;
    expect(migrated.ok, JSON.stringify(migrated)).toBe(true);
    expect(migrated.events[0].nativeId).not.toBe("legacy-event");
    const event = await h.inspect.content.get(
      "events",
      migrated.events[0].nativeId,
    );
    expect(event?.status).toBe("published");
    expect(event?.data.venue).toBe(migrated.venues[0].nativeId);
    const rerun = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      {},
    )) as any;
    expect(rerun.ok, JSON.stringify(rerun)).toBe(true);
    expect(rerun.events[0].status).toBe("already_exists");
    expect(await h.inspect.content.list("events")).toHaveLength(1);
    expect(await h.inspect.storage.get("events", "legacy-event")).toEqual(
      expect.objectContaining({ id: "legacy-event" }),
    );
    expect(
      await h.inspect.storage.get("venues", "legacy-venue"),
    ).not.toBeNull();
    expect(await calendar(h)).toContain("UID:legacy-event@audit.example.com");
  });
  it("reports unmapped dependencies without creating broken events", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("events", "legacy-event", {
      ...legacy,
      venueId: "missing",
    });
    const preview = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      { dryRun: true },
    )) as any;
    const real = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      {},
    )) as any;
    expect(preview.ok).toBe(false);
    expect(real.ok).toBe(false);
    expect(real.events[0].error).toContain("Unmapped venue");
    expect(await h.inspect.content.list("events")).toHaveLength(0);
  });
  it("emits matching recurring cancellations only after committed deletion", async () => {
    const h = await setup();
    await h.fixtures.content("events", {
      id: "series",
      status: "published",
      locale: "fr",
      data: {
        ...schedule,
        recurrence: JSON.stringify({ frequency: "daily", until: "2026-11-17" }),
      },
    });
    const before = await calendar(h);
    const uids = [...before.matchAll(/UID:([^\r\n]+)/g)].map(
      (match) => match[1],
    );
    expect(uids).toHaveLength(3);
    const deleted = await h.actions.content.trash("events", "series");
    expect(deleted.success, JSON.stringify(deleted)).toBe(true);
    const after = await calendar(h);
    for (const uid of uids) expect(after).toContain("UID:" + uid);
    expect(after.match(/STATUS:CANCELLED/g)).toHaveLength(3);
    expect(await h.inspect.storage.get("events", "series")).toBeNull();
  });
  it("requires authentication and plugins:manage for migration", async () => {
    const h = await setup();
    expect(
      (
        await h.actions.routes.request("mcp/transfer/migrateToNative", {
          method: "POST",
          body: { dryRun: true },
        })
      ).status,
    ).toBe(401);
    const user = await h.fixtures.user({
      email: "editor@example.com",
      role: "editor",
      emailVerified: true,
    });
    expect(
      (
        await h.actions.routes.request("mcp/transfer/migrateToNative", {
          method: "POST",
          body: { dryRun: true },
          user,
        })
      ).status,
    ).toBe(403);
  });
  it("inherits shared migration identity into translations and cancels only after the last published sibling disappears", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("events", "legacy-event", legacy);
    const migration = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      {},
    )) as any;
    expect(migration.ok, JSON.stringify(migration)).toBe(true);
    const frenchId = migration.events[0].nativeId;
    const translated = await h.actions.content.create("events", {
      locale: "en",
      translationOf: frenchId,
      data: { title: "English title" },
    });
    expect(translated.success, JSON.stringify(translated)).toBe(true);
    if (!translated.success) return;
    const englishId = translated.data.item.id;
    const published = await h.actions.content.publish("events", englishId);
    expect(published.success, JSON.stringify(published)).toBe(true);
    const fr = await calendar(h, "?locale=fr&strict=true");
    const en = await calendar(h, "?locale=en&strict=true");
    expect(fr).toContain("UID:legacy-event@audit.example.com");
    expect(en).toContain("UID:legacy-event@audit.example.com");
    expect(en).toContain("SUMMARY:English title");
    expect((await h.actions.content.trash("events", frenchId)).success).toBe(
      true,
    );
    expect(await calendar(h, "?locale=en")).not.toContain("STATUS:CANCELLED");
    expect(await calendar(h, "?locale=fr&strict=true")).toContain(
      "STATUS:CANCELLED",
    );
    expect(await calendar(h, "?locale=fr")).toContain(
      "SUMMARY:[EN] English title",
    );
    expect(
      (await h.actions.content.unpublish("events", englishId)).success,
    ).toBe(true);
    expect(await calendar(h, "?locale=en")).toContain("STATUS:CANCELLED");
  });
  it("keeps live publication separate from a pending schedule draft and advances sequence only on publish", async () => {
    const h = await setup();
    await h.fixtures.content("events", {
      id: "draft-test",
      slug: "draft-test",
      status: "published",
      locale: "fr",
      data: schedule,
    });
    const before = await calendar(h);
    const sequence = Number(/SEQUENCE:(\d+)/.exec(before)?.[1]);
    const changed = await h.actions.content.update("events", "draft-test", {
      data: { start: "2026-11-15T12:00:00Z", end: "2026-11-15T13:00:00Z" },
    });
    expect(changed.success, JSON.stringify(changed)).toBe(true);
    const pending = await calendar(h);
    expect(pending).toContain("DTSTART:20261115T100000Z");
    expect(Number(/SEQUENCE:(\d+)/.exec(pending)?.[1])).toBe(sequence);
    const published = await h.actions.content.publish("events", "draft-test");
    expect(published.success, JSON.stringify(published)).toBe(true);
    const after = await calendar(h);
    expect(after).toContain("DTSTART:20261115T120000Z");
    expect(Number(/SEQUENCE:(\d+)/.exec(after)?.[1])).toBeGreaterThan(sequence);
  });
  it("cancels and restores an exception with the original occurrence UID", async () => {
    const h = await setup();
    await h.fixtures.content("events", {
      id: "exceptions",
      slug: "exceptions",
      status: "published",
      locale: "fr",
      data: {
        ...schedule,
        recurrence: JSON.stringify({ frequency: "daily", until: "2026-11-17" }),
      },
    });
    const before = await calendar(h);
    const uid = /UID:([^\r\n]*2026-11-16[^\r\n]*)/.exec(before)?.[1];
    expect(uid).toBeTruthy();
    const updated = await h.actions.content.update("events", "exceptions", {
      data: {
        exceptions: JSON.stringify([
          { recurrenceId: "2026-11-16T10:00", status: "cancelled" },
        ]),
      },
    });
    expect(updated.success, JSON.stringify(updated)).toBe(true);
    expect(
      (await h.actions.content.publish("events", "exceptions")).success,
    ).toBe(true);
    const cancelled = await calendar(h);
    expect(cancelled.match(/STATUS:CANCELLED/g)).toHaveLength(1);
    expect(cancelled).toContain("UID:" + uid);
    expect(
      (
        await h.actions.content.update("events", "exceptions", {
          data: { exceptions: "[]" },
        })
      ).success,
    ).toBe(true);
    expect(
      (await h.actions.content.publish("events", "exceptions")).success,
    ).toBe(true);
    const restored = await calendar(h);
    expect(restored.match(/STATUS:CONFIRMED/g)).toHaveLength(3);
    expect(restored).not.toContain("STATUS:CANCELLED");
  });
  it("resumes bounded venue/event batches and preserves drafts", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("venues", "legacy-venue", {
      id: "legacy-venue",
      name: "Hall",
    });
    await h.fixtures.plugin.storage("events", "legacy-event", {
      ...legacy,
      published: false,
      status: "draft",
      venueId: "legacy-venue",
    });
    const first = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      { limit: 1 },
    )) as any;
    expect(first.ok, JSON.stringify(first)).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    expect(first.events).toHaveLength(0);
    const second = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      { limit: 1, cursor: first.nextCursor },
    )) as any;
    expect(second.ok, JSON.stringify(second)).toBe(true);
    expect(second.events).toHaveLength(1);
    expect(
      (await h.inspect.content.get("events", second.events[0].nativeId))
        ?.status,
    ).toBe("draft");
    expect(await calendar(h)).not.toContain("SUMMARY:Native event");
  });
  it("publishes native media URLs and keeps the self-contained workspace authoritative", async () => {
    const h = await setup();
    const media = await h.fixtures.media({
      filename: "poster.png",
      mimeType: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    const saved = await h.actions.content.create("events", {
      data: {
        ...schedule,
        featured_image: { id: media.id },
        legacy_id: "old-image-event",
      },
    });
    expect(saved.success, JSON.stringify(saved)).toBe(true);
    if (!saved.success) return;
    expect(
      (await h.actions.content.publish("events", saved.data.item.id)).success,
    ).toBe(true);
    const feed = (await h.transport.invokeRoute("publicEvents", {
      from: "2026-11-01",
      through: "2026-11-30",
    })) as any;
    expect(feed.events[0].imageUrl).toContain(
      "/_emdash/api/plugins/eventual/publicEventImage?eventId=" + saved.data.item.id,
    );
    const direct = await h.actions.routes.request("publicEventImage", {
      method: "GET",
      url: feed.events[0].imageUrl,
    });
    expect(direct.status).toBe(200);
    expect((await direct.arrayBuffer()).byteLength).toBe(8);
    expect(feed.events[0].publicUrl).toContain("/events/");
    const alias = await h.actions.routes.request("publicEventImage", {
      method: "GET",
      url: "https://audit.example.com/_emdash/api/plugins/eventual/publicEventImage?eventId=old-image-event",
    });
    expect(alias.status).toBe(200);
    expect((await alias.arrayBuffer()).byteLength).toBe(8);
    expect(
      (await h.actions.content.unpublish("events", saved.data.item.id)).success,
    ).toBe(true);
    expect(
      (
        await h.actions.routes.request("publicEventImage", {
          method: "GET",
          url: "https://audit.example.com/_emdash/api/plugins/eventual/publicEventImage?eventId=old-image-event",
        })
      ).status,
    ).toBe(404);
    const page = (await h.transport.invokeRoute("admin", {
      type: "page_load",
      page: "/events",
    })) as any;
    expect(JSON.stringify(page)).toContain("/_emdash/admin/content/events/");
    expect(JSON.stringify(page)).not.toContain("save-event");
    expect(
      await h.transport.invokeRoute("mcp/events/create", {
        title: "Forbidden legacy write",
        start: "2026-11-15",
        end: "2026-11-15",
        allDay: true,
        timezone: "UTC",
      }),
    ).toMatchObject({ ok: false, error: "NATIVE_COLLECTIONS_ACTIVE" });
  });
  it.each(["", "created-venue"])(
    "recovers interrupted creation/publication (%s) and preserves completed editorial choices",
    async (recordedId) => {
      const h = await setup();
      const token = "interrupted-venue";
      await h.fixtures.plugin.storage("venues", "legacy-venue", {
        id: "legacy-venue",
        name: "Hall",
      });
      await h.fixtures.plugin.storage("events", "legacy-event", {
        ...legacy,
        venueId: "legacy-venue",
      });
      await h.fixtures.content("venues", {
        id: "created-venue",
        locale: "fr",
        status: "draft",
        data: {
          name: "Hall",
          legacy_id: "legacy-venue",
          legacy_metadata: JSON.stringify({ migrationToken: token }),
        },
      });
      await h.fixtures.plugin.kv(
        "state:eventual-migration:venues:legacy-venue",
        {
          id: recordedId,
          published: true,
          status: recordedId ? "created" : "creating",
          token,
        },
      );
      const preview = (await h.transport.invokeRoute(
        "mcp/transfer/migrateToNative",
        { dryRun: true },
      )) as any;
      expect(preview.venues[0].action).toBe("resume_publication");
      const recovered = (await h.transport.invokeRoute(
        "mcp/transfer/migrateToNative",
        {},
      )) as any;
      expect(recovered.ok, JSON.stringify(recovered)).toBe(true);
      expect(recovered.venues[0].nativeId).toBe("created-venue");
      expect(
        (await h.inspect.content.get("venues", "created-venue"))?.status,
      ).toBe("published");
      expect(await h.inspect.content.list("venues")).toHaveLength(1);
      expect(
        (
          await h.actions.content.unpublish(
            "events",
            recovered.events[0].nativeId,
          )
        ).success,
      ).toBe(true);
      expect(
        (
          (await h.transport.invokeRoute(
            "mcp/transfer/migrateToNative",
            {},
          )) as any
        ).ok,
      ).toBe(true);
      expect(
        (await h.inspect.content.get("events", recovered.events[0].nativeId))
          ?.status,
      ).toBe("draft");
      expect(
        (await h.actions.content.trash("events", recovered.events[0].nativeId))
          .success,
      ).toBe(true);
      const removed = (await h.transport.invokeRoute(
        "mcp/transfer/migrateToNative",
        {},
      )) as any;
      expect(removed.ok).toBe(false);
      expect(removed.events[0].error).toContain("restore it explicitly");
    },
  );
  it("refuses an overlapping migration lease without creating native records", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("events", "legacy-event", legacy);
    await h.fixtures.plugin.kv("state:eventual-migration-lock", {
      until: Date.now() + 60000,
    });
    const blocked = (await h.transport.invokeRoute(
      "mcp/transfer/migrateToNative",
      {},
    )) as any;
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain("already running");
    expect(await h.inspect.content.list("events")).toHaveLength(0);
  });
  it("deduplicates concurrent migration execution", async () => {
    const h = await setup();
    await h.fixtures.plugin.storage("events", "legacy-event", legacy);
    const results = (await Promise.all([
      h.transport.invokeRoute("mcp/transfer/migrateToNative", {}),
      h.transport.invokeRoute("mcp/transfer/migrateToNative", {}),
    ])) as any[];
    expect(results.some((result) => result.ok)).toBe(true);
    expect(await h.inspect.content.list("events")).toHaveLength(1);
    expect(
      await h.inspect.storage.get("events", "legacy-event"),
    ).not.toBeNull();
  });
  it("cancels only the category subscription that loses an active event", async () => {
    const h = await setup();
    const saved = await h.actions.content.create("events", {
      data: { ...schedule, categories: '["Music"]' },
    });
    expect(saved.success).toBe(true);
    if (!saved.success) return;
    const id = saved.data.item.id;
    expect((await h.actions.content.publish("events", id)).success).toBe(true);
    const music = await calendar(h, "?category=Music");
    expect(music).toContain("SUMMARY:Native event");
    expect(
      (
        await h.actions.content.update("events", id, {
          data: { categories: '["Community"]' },
        })
      ).success,
    ).toBe(true);
    expect((await h.actions.content.publish("events", id)).success).toBe(true);
    expect(await calendar(h, "?category=Music")).toContain("STATUS:CANCELLED");
    expect(await calendar(h, "?category=Community")).not.toContain(
      "STATUS:CANCELLED",
    );
    expect(await calendar(h)).not.toContain("STATUS:CANCELLED");
  });
  it("checks publication dependencies, scheduled drafts and restoring a cancelled native item", async () => {
    const h = await setup();
    const venue = await h.actions.content.create("venues", {
      data: { name: "Unpublished hall" },
    });
    expect(venue.success).toBe(true);
    if (!venue.success) return;
    const saved = await h.actions.content.create("events", {
      data: { ...schedule, venue: venue.data.item.id },
    });
    expect(saved.success, JSON.stringify(saved)).toBe(true);
    if (!saved.success) return;
    const id = saved.data.item.id;
    expect((await h.actions.content.publish("events", id)).success).toBe(false);
    const scheduledAt = new Date(Date.now() + 86400000).toISOString();
    expect(
      (await h.actions.content.schedule("events", id, scheduledAt)).success,
    ).toBe(false);
    expect(
      (await h.actions.content.update("events", id, { data: { venue: null } }))
        .success,
    ).toBe(true);
    const scheduled = await h.actions.content.schedule(
      "events",
      id,
      scheduledAt,
    );
    expect(scheduled.success, JSON.stringify(scheduled)).toBe(true);
    expect(await calendar(h)).not.toContain("SUMMARY:Native event");
    expect((await h.actions.content.unschedule("events", id)).success).toBe(
      true,
    );
    expect((await h.actions.content.publish("events", id)).success).toBe(true);
    const before = await calendar(h);
    const uid = /UID:([^\r\n]+)/.exec(before)?.[1];
    expect((await h.actions.content.trash("events", id)).success).toBe(true);
    expect(await calendar(h)).toContain("STATUS:CANCELLED");
    expect((await h.actions.content.restore("events", id)).success).toBe(true);
    expect((await h.actions.content.publish("events", id)).success).toBe(true);
    const after = await calendar(h);
    expect(after).toContain("UID:" + uid);
    expect(after).not.toContain("STATUS:CANCELLED");
  });
  it("profiles native timed recurrence through a year, including DST transitions", async () => {
    const h = await setup();
    const from = new Date().toISOString().slice(0, 10);
    const last = new Date(from + "T00:00:00Z");
    last.setUTCDate(last.getUTCDate() + 365);
    const until = last.toISOString().slice(0, 10);
    for (let i = 0; i < 5; i++)
      await h.fixtures.content("events", {
        id: "profile-" + i,
        status: "published",
        locale: "fr",
        data: {
          ...schedule,
          start: from + "T10:00:00Z",
          end: from + "T11:00:00Z",
          timezone: "Europe/Paris",
          recurrence: JSON.stringify({ frequency: "daily", until }),
        },
      });
    const started = performance.now();
    const body = await calendar(h);
    const elapsedMs = Math.round(performance.now() - started);
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(5 * 366);
    expect(new TextEncoder().encode(body).length).toBeLessThan(4 * 1024 * 1024);
    console.log(
      JSON.stringify({
        scenario: "native timed feed: 5 daily series / 366 days",
        occurrences: 1830,
        elapsedMs,
        bytes: new TextEncoder().encode(body).length,
      }),
    );
  }, 30000);
  it("advances calendar sequence when a published venue changes", async () => {
    const h = await setup();
    const venue = await h.actions.content.create("venues", {
      data: { name: "Hall", street: "Original address" },
    });
    expect(venue.success).toBe(true);
    if (!venue.success) return;
    const venueId = venue.data.item.id;
    expect((await h.actions.content.publish("venues", venueId)).success).toBe(
      true,
    );
    const event = await h.actions.content.create("events", {
      data: { ...schedule, venue: venueId },
    });
    expect(event.success).toBe(true);
    if (!event.success) return;
    expect(
      (await h.actions.content.publish("events", event.data.item.id)).success,
    ).toBe(true);
    const before = await calendar(h);
    expect(before).toContain("Original address");
    const sequence = Number(/SEQUENCE:(\d+)/.exec(before)?.[1]);
    expect(
      (
        await h.actions.content.update("venues", venueId, {
          data: { street: "New address" },
        })
      ).success,
    ).toBe(true);
    expect((await h.actions.content.publish("venues", venueId)).success).toBe(
      true,
    );
    const after = await calendar(h);
    expect(after).toContain("New address");
    expect(Number(/SEQUENCE:(\d+)/.exec(after)?.[1])).toBeGreaterThan(sequence);
  });
  it("preserves localized occurrence copy when a shared schedule change makes its ID stale", async () => {
    const h = await setup();
    const fr = await h.actions.content.create("events", {
      data: {
        ...schedule,
        recurrence: JSON.stringify({ frequency: "daily", until: "2026-11-17" }),
      },
    });
    expect(fr.success).toBe(true);
    if (!fr.success) return;
    const frId = fr.data.item.id;
    expect((await h.actions.content.publish("events", frId)).success).toBe(
      true,
    );
    const copy = JSON.stringify([
      {
        recurrenceId: "2026-11-16T10:00",
        overrides: { title: "English occurrence copy" },
      },
    ]);
    const en = await h.actions.content.create("events", {
      locale: "en",
      translationOf: frId,
      data: { title: "English series", occurrence_content: copy },
    });
    expect(en.success, JSON.stringify(en)).toBe(true);
    if (!en.success) return;
    const enId = en.data.item.id;
    expect((await h.actions.content.publish("events", enId)).success).toBe(
      true,
    );
    expect(await calendar(h, "?locale=en")).toContain(
      "English occurrence copy",
    );
    expect(
      (
        await h.actions.content.update("events", frId, {
          data: { start: "2026-11-15T12:00:00Z", end: "2026-11-15T13:00:00Z" },
        })
      ).success,
    ).toBe(true);
    expect((await h.actions.content.publish("events", frId)).success).toBe(
      true,
    );
    const shifted = await calendar(h, "?locale=en");
    expect(shifted).not.toContain("SUMMARY:English occurrence copy");
    expect(shifted).toContain("DTSTART:20261116T120000Z");
    expect(
      (
        await h.actions.content.update("events", enId, {
          data: { title: "Edited English series" },
        })
      ).success,
    ).toBe(true);
    const published = await h.actions.content.publish("events", enId);
    expect(published.success, JSON.stringify(published)).toBe(true);
    expect(
      (await h.inspect.content.get("events", enId))?.data.occurrence_content,
    ).toEqual(JSON.parse(copy));
  });
});
