import { writeFileSync } from "node:fs";
import {
  createEventsCollectionBlueprint,
  createVenuesCollectionBlueprint,
} from "../src/schema/blueprint.ts";
const args = process.argv.slice(2);
let venueCollection = "venues";
let output;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--venue-collection") venueCollection = args[++i];
  else if (args[i] === "--output") output = args[++i];
  else
    throw new Error(
      "Use --venue-collection <slug> and/or --output <new-file.json>.",
    );
}
if (!venueCollection || !/^[a-z][a-z0-9_]*$/.test(venueCollection))
  throw new Error("Invalid venue collection slug.");
const collections = [createEventsCollectionBlueprint({ venueCollection })];
if (venueCollection === "venues")
  collections.push(createVenuesCollectionBlueprint());
const json =
  JSON.stringify({ version: "1", defaultLocale: "fr", collections }, null, 2) +
  "\n";
// Existing locations need reviewed field additions, never replacement.
if (output) writeFileSync(output, json, { encoding: "utf8", flag: "wx" });
else process.stdout.write(json);
