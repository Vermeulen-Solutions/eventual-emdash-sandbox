import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Kysely } from "kysely";
import { SchemaRegistry } from "emdash";
import { createDialect } from "emdash/db/sqlite";
import { createMigrationExecutor } from "emdash/internal/db/sqlite-migrations";
import { getCoreMigrationIdentity } from "emdash/migrations";
import {
  createEventsCollectionBlueprint,
  createVenuesCollectionBlueprint,
} from "../src/schema/blueprint.ts";
import { upgradeNativeEditor } from "./upgrade-native-editor.mjs";

test("SQLite upgrade previews without writes and preserves live, pending and historical reference selections", async () => {
  const directory = mkdtempSync(join(tmpdir(), "eventual-upgrade-"));
  const database = join(directory, "data.db");
  let db;
  try {
    const executor = await createMigrationExecutor(
      { url: database },
      { projectRoot: directory, env: {} },
    );
    const identity = await getCoreMigrationIdentity();
    await executor.execute({
      action: "apply",
      i18n: { defaultLocale: "fr", locales: ["fr", "en"] },
      artifact: {
        emdashVersion: identity.emdashVersion,
        migrationSetFingerprint: identity.fingerprint,
      },
    });
    db = new Kysely({ dialect: createDialect({ url: "file:" + database }) });
    const registry = new SchemaRegistry(db);
    for (const blueprint of [
      createVenuesCollectionBlueprint(),
      createEventsCollectionBlueprint(),
    ]) {
      const { fields, ...collection } = blueprint;
      await registry.createCollection(collection);
      for (const { description, ...field } of fields)
        await registry.createField(blueprint.slug, field);
    }
    await db
      .insertInto("_emdash_relations")
      .values({
        id: "relation",
        slug: "events_venue",
        parent_collection: "events",
        child_collection: "venues",
        parent_label: "Events",
        child_label: "Venues",
        max_children_per_parent: 1,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      })
      .execute();
    await registry.updateField("events", "venue", {
      validation: {
        relation: "events_venue",
        targetCollection: "venues",
        relationSide: "parent",
        multiple: false,
      },
    });
    for (const [id, locale, group] of [
      ["venue-a-fr", "fr", "group-a"],
      ["venue-a-en", "en", "group-a"],
      ["venue-b", "fr", "group-b"],
    ]) {
      await db
        .insertInto("ec_venues")
        .values({
          id,
          locale,
          translation_group: group,
          status: "published",
          name: id,
        })
        .execute();
    }
    for (const [id, locale] of [
      ["event-fr", "fr"],
      ["event-en", "en"],
    ]) {
      await db
        .insertInto("ec_events")
        .values({
          id,
          locale,
          translation_group: "event-group",
          slug: id,
          title: id,
          status: "published",
          venue: "venue-b",
          start: "2027-01-01T10:00:00Z",
          end: "2027-01-01T11:00:00Z",
        })
        .execute();
      await db
        .insertInto("revisions")
        .values([
          {
            id: id + "-live",
            collection: "events",
            entry_id: id,
            data: JSON.stringify({ _references: { venue: ["group-a"] } }),
          },
          {
            id: id + "-draft",
            collection: "events",
            entry_id: id,
            data: JSON.stringify({
              title: "Pending announcement",
              _references: { venue: ["group-b"] },
            }),
          },
          {
            id: id + "-old",
            collection: "events",
            entry_id: id,
            data: JSON.stringify({
              venue: "venue-b",
              title: "Old announcement",
            }),
          },
        ])
        .execute();
      await db
        .updateTable("ec_events")
        .set({
          live_revision_id: id + "-live",
          draft_revision_id: id + "-draft",
        })
        .where("id", "=", id)
        .execute();
    }
    await db
      .insertInto("_emdash_content_references")
      .values({
        id: "edge",
        relation_id: "relation",
        parent_group: "event-group",
        child_group: "group-a",
        sort_order: 0,
        created_at: "2026-01-01",
      })
      .execute();
    const rowsBefore = await db.selectFrom("ec_events").selectAll().execute();
    const revisionsBefore = await db
      .selectFrom("revisions")
      .selectAll()
      .execute();
    const preview = await upgradeNativeEditor(db);
    assert.equal(preview.applied, false);
    assert.equal(
      (await registry.getCollectionWithFields("events")).fields.some(
        (field) => field.slug === "venue_id",
      ),
      false,
    );
    assert.deepEqual(
      await db.selectFrom("ec_events").selectAll().execute(),
      rowsBefore,
    );
    assert.deepEqual(
      await db.selectFrom("revisions").selectAll().execute(),
      revisionsBefore,
    );
    const result = await upgradeNativeEditor(db, { apply: true });
    assert.equal(result.entries, 2);
    const rows = await db.selectFrom("ec_events").selectAll().execute();
    assert.equal(rows[0].venue_id, rows[1].venue_id);
    assert.equal(rows[0].venue_id, "venue-a-en");
    for (const row of rows) {
      const previous = rowsBefore.find((item) => item.id === row.id);
      const { venue_id, ...unchanged } = row;
      assert.deepEqual(unchanged, { ...previous });
      const draft = await db
        .selectFrom("revisions")
        .selectAll()
        .where("id", "=", row.draft_revision_id)
        .executeTakeFirst();
      assert.equal(JSON.parse(draft.data).venue_id, "venue-b");
      assert.equal(JSON.parse(draft.data).title, "Pending announcement");
      const old = await db
        .selectFrom("revisions")
        .selectAll()
        .where("id", "=", row.id + "-old")
        .executeTakeFirst();
      assert.equal(JSON.parse(old.data).venue_id, "venue-b");
    }
    // Rerun after a user selects a new venue: the migration must not restore stale edges.
    await db
      .updateTable("ec_events")
      .set({ venue_id: "" })
      .where("id", "=", "event-fr")
      .execute();
    const rerun = await upgradeNativeEditor(db, { apply: true });
    assert.equal(rerun.entries, 0);
    assert.deepEqual(rerun.fields, []);
    assert.equal(
      (
        await db
          .selectFrom("ec_events")
          .select("venue_id")
          .where("id", "=", "event-fr")
          .executeTakeFirst()
      ).venue_id,
      "",
    );
    assert.equal(
      (await db.selectFrom("_emdash_content_references").selectAll().execute())
        .length,
      1,
    );
    await db
      .insertInto("_emdash_content_references")
      .values({
        id: "ambiguous-edge",
        relation_id: "relation",
        parent_group: "event-group",
        child_group: "group-b",
        sort_order: 1,
        created_at: "2026-01-01",
      })
      .execute();
    const beforeFailure = await db
      .selectFrom("ec_events")
      .selectAll()
      .execute();
    await assert.rejects(
      upgradeNativeEditor(db, { apply: true }),
      /Invalid single-reference selection/,
    );
    assert.deepEqual(
      await db.selectFrom("ec_events").selectAll().execute(),
      beforeFailure,
    );
  } finally {
    await db?.destroy();
    const target = resolve(directory),
      parent = resolve(tmpdir());
    if (!target.startsWith(parent + "\\") && !target.startsWith(parent + "/"))
      throw new Error("Unsafe temporary directory cleanup.");
    rmSync(target, { recursive: true, force: true });
  }
});
