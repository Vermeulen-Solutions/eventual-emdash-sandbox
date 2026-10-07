/**
 * Versioned, offline SQLite upgrade for EmDash 1.0.1. Default: rollback preview.
 * Stop the site's writers, then --apply --backup <new absolute backup path>.
 * Uses SchemaRegistry for schema mutations; backfills only added reference columns.
 */
import { DatabaseSync, backup } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Kysely } from "kysely";
import { createDialect } from "emdash/db/sqlite";
import { SchemaRegistry } from "emdash";
import {
  createEventsCollectionBlueprint,
  createVenuesCollectionBlueprint,
  createOrganizersCollectionBlueprint,
} from "../astro/blueprint.mjs";

export async function upgradeNativeEditor(db, { apply = false } = {}) {
  const report = {
    applied: apply,
    fields: [],
    entries: 0,
    revisions: 0,
    warnings: [],
  };
  const previewRollback = new Error("preview rollback");
  try {
    await db.transaction().execute(async (trx) => {
      const registry = new SchemaRegistry(trx);
      const schema = await registry.getCollectionWithFields("events");
      if (!schema?.fields.some((field) => field.slug === "recurrence"))
        throw new Error("Not an Eventual events schema.");
      const organizerField = schema.fields.find(
        (field) => field.slug === "organizer_ref",
      );
      const organizerTarget =
        organizerField?.validation?.targetCollection ??
        organizerField?.options?.collection ??
        "organizers";
      if (
        organizerTarget === "organizers" &&
        !(await registry.getCollection("organizers"))
      ) {
        const { fields, ...collection } = createOrganizersCollectionBlueprint();
        await registry.createCollection(collection);
        for (const field of fields) {
          const { description, ...input } = field;
          await registry.createField("organizers", input);
        }
        report.fields.push("organizers (created)");
      }
      if (!organizerField) {
        await registry.createField("events", {
          slug: "organizer_ref",
          label: "Saved organizer",
          type: "reference",
          translatable: false,
          options: { collection: organizerTarget },
          widget: "eventual-editor:managed",
        });
        report.fields.push("events.organizer_ref (added)");
      }
      const bindings = [];
      for (const [original, alias, fallback] of [
        ["venue", "venue_id", "venues"],
        ["organizer_ref", "organizer_id", "organizers"],
      ]) {
        const field = schema.fields.find((field) => field.slug === original);
        if (!field) continue;
        const target =
          field.validation?.targetCollection ??
          field.options?.collection ??
          fallback;
        if (!/^[a-z][a-z0-9_]*$/.test(target))
          throw new Error("Invalid reference target.");
        if (field.validation?.relation) {
          if (
            field.validation.relationSide !== "parent" ||
            field.validation.multiple === true
          )
            throw new Error(
              "Only single parent-side Eventual bindings are supported.",
            );
          const relation = await trx
            .selectFrom("_emdash_relations")
            .selectAll()
            .where("slug", "=", field.validation.relation)
            .executeTakeFirst();
          if (
            !relation ||
            relation.parent_collection !== "events" ||
            relation.child_collection !== target
          )
            throw new Error("Reference relation does not match schema.");
          let existing = schema.fields.find((field) => field.slug === alias);
          if (!existing) {
            await registry.createField("events", {
              slug: alias,
              label: original === "venue" ? "Saved venue" : "Saved organizer",
              type: "reference",
              translatable: false,
              options: { collection: target },
              widget: "eventual-editor:managed",
            });
            report.fields.push("events." + alias + " (added)");
          } else if (
            existing.type !== "reference" ||
            existing.validation?.relation ||
            existing.options?.collection !== target ||
            existing.translatable
          )
            throw new Error(
              "Existing " + alias + " has an incompatible definition.",
            );
          bindings.push({ original, alias, target, relation });
        }
      }
      for (const blueprint of [
        createEventsCollectionBlueprint(),
        createVenuesCollectionBlueprint(),
        createOrganizersCollectionBlueprint(),
      ]) {
        const collection = await registry.getCollectionWithFields(
          blueprint.slug,
        );
        if (!collection) continue;
        for (const definition of blueprint.fields) {
          const installed=collection.fields.find(field=>field.slug === definition.slug);
          if(!installed) continue;
          if(installed.label === definition.label && installed.options?.eventualEditor === true && (!definition.widget || installed.widget === definition.widget)) continue;
          // Preserve type, required/default, target, flags and validation. Cosmetic upgrade only.
          await registry.updateField(blueprint.slug, definition.slug, {
            label: definition.label,
            options: { ...installed.options, eventualEditor: true },
            ...(definition.widget ? { widget: definition.widget } : {}),
          });
          report.fields.push(blueprint.slug + "." + definition.slug);
        }
      }
      const rows = await trx.selectFrom("ec_events").selectAll().execute();
      for (const binding of bindings) {
        const targets = await trx
          .selectFrom("ec_" + binding.target)
          .select(["id", "locale", "translation_group", "status"])
          .execute();
        const edges = await trx
          .selectFrom("_emdash_content_references")
          .selectAll()
          .where("relation_id", "=", binding.relation.id)
          .orderBy("sort_order")
          .execute();
        const resolveGroup = (groups) => {
          if (
            !Array.isArray(groups) ||
            groups.length > 1 ||
            groups.some((group) => typeof group !== "string")
          )
            throw new Error("Invalid single-reference selection.");
          if (!groups.length) return "";
          const matches = targets
            .filter((item) => item.translation_group === groups[0])
            .sort((a, b) => a.id.localeCompare(b.id));
          if (!matches.length)
            throw new Error(
              "A reference points to a missing translation group. Repair it before upgrading.",
            );
          // Shared fields must use the same canonical entry ID across all event locales.
          return (
            matches.find((item) => item.status === "published") ?? matches[0]
          ).id;
        };
        for (const row of rows) {
          const groups = edges
            .filter((edge) => edge.parent_group === row.translation_group)
            .map((edge) => edge.child_group);
          const live = resolveGroup(groups);
          // Once populated, the canonical column is authoritative. Reruns never overwrite edits.
          if (row[binding.alias] === null || row[binding.alias] === undefined) {
            await trx
              .updateTable("ec_events")
              .set({ [binding.alias]: live })
              .where("id", "=", row.id)
              .execute();
            report.entries++;
          }
          const revisions = await trx
            .selectFrom("revisions")
            .selectAll()
            .where("collection", "=", "events")
            .where("entry_id", "=", row.id)
            .execute();
          for (const revision of revisions) {
            const data = JSON.parse(revision.data);
            if (Object.hasOwn(data, binding.alias)) continue;
            const staged = data._references;
            let id;
            if (staged && Object.hasOwn(staged, binding.original))
              id = resolveGroup(staged[binding.original]);
            else if (Object.hasOwn(data, binding.original)) {
              const previous = data[binding.original];
              if (previous === null || previous === "") id = "";
              else if (
                typeof previous === "string" &&
                targets.some((target) => target.id === previous)
              )
                id = previous;
              else
                throw new Error(
                  "A historical reference cannot be resolved safely.",
                );
            } else if (
              revision.id === row.live_revision_id ||
              revision.id === row.draft_revision_id
            )
              id = live;
            else {
              report.warnings.push(
                "Historical revision " +
                  revision.id +
                  " has no reference snapshot; left unchanged.",
              );
              continue;
            }
            data[binding.alias] = id;
            await trx
              .updateTable("revisions")
              .set({ data: JSON.stringify(data) })
              .where("id", "=", revision.id)
              .execute();
            report.revisions++;
          }
        }
      }
      if (!apply) throw previewRollback;
    });
  } catch (error) {
    if (error !== previewRollback) throw error;
  }
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  let database,
    backupPath,
    apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--database") database = args[++i];
    else if (args[i] === "--backup") backupPath = args[++i];
    else if (args[i] === "--apply") apply = true;
    else
      throw new Error(
        "Use --database <existing sqlite file> [--apply --backup <new file>].",
      );
  }
  if (!database || !existsSync(database))
    throw new Error("Specify an existing database file.");
  database = resolve(database);
  const coreEntry = createRequire(import.meta.url).resolve("emdash");
  const coreVersion = JSON.parse(
    readFileSync(resolve(dirname(coreEntry), "..", "package.json"), "utf8"),
  ).version;
  if (coreVersion !== "1.0.1")
    throw new Error(
      "This upgrade was verified on EmDash 1.0.1. Review before using another version.",
    );
  if (apply) {
    if (
      !backupPath ||
      existsSync(backupPath) ||
      resolve(backupPath) === database ||
      !existsSync(dirname(resolve(backupPath)))
    )
      throw new Error(
        "Apply requires a new backup path in an existing directory.",
      );
    const source = new DatabaseSync(database, { readOnly: true });
    await backup(source, resolve(backupPath));
    source.close();
  }
  const db = new Kysely({
    dialect: createDialect({ url: "file:" + database }),
  });
  try {
    console.log(
      JSON.stringify(await upgradeNativeEditor(db, { apply }), null, 2),
    );
  } finally {
    await db.destroy();
  }
}
