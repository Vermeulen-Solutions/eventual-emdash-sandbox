#!/usr/bin/env node
/** Emit a schema-only seed. Never connect to a database or overwrite a file. */
import { writeFileSync } from 'node:fs';
import {createEventsCollectionBlueprint,createVenuesCollectionBlueprint,createOrganizersCollectionBlueprint} from '../astro/blueprint.mjs';
const args=process.argv.slice(2);
let eventCollection='events',venueCollection='venues',organizerCollection='organizers',locale='fr',output,reuseVenues=false,reuseOrganizers=false,legacyCompatibility=false;
for(let i=0;i<args.length;i++) {
  if(args[i]==='--event-collection') eventCollection=args[++i];
  else if(args[i]==='--venue-collection') venueCollection=args[++i];
  else if(args[i]==='--organizer-collection') organizerCollection=args[++i];
  else if(args[i]==='--locale') locale=args[++i];
  else if(args[i]==='--reuse-venues') reuseVenues=true;
  else if(args[i]==='--reuse-organizers') reuseOrganizers=true;
  else if(args[i]==='--legacy-compatibility') legacyCompatibility=true;
  else if(args[i]==='--output') output=args[++i];
  else throw new Error('Use --event-collection, --venue-collection, --organizer-collection, --locale, --reuse-venues, --reuse-organizers, --legacy-compatibility and/or --output.');
}
for(const slug of [eventCollection,venueCollection,organizerCollection]) if(!slug || !/^[a-z][a-z0-9_]{0,62}$/.test(slug)) throw new Error('Invalid collection slug.');
if(new Set([eventCollection,venueCollection,organizerCollection]).size!==3) throw new Error('Use separate event, venue and organizer collections.');
if(!locale || Intl.getCanonicalLocales(locale)[0]!==locale) throw new Error('Use a canonical locale such as fr or en.');
const events=createEventsCollectionBlueprint({eventCollection,venueCollection,organizerCollection,bindRelations:false,legacyCompatibility});
// Stock core widgets only: the sandbox panel supplies schedule controls.
const collections=[events];
if(!reuseVenues) collections.push({...createVenuesCollectionBlueprint({legacyCompatibility}),slug:venueCollection});
if(!reuseOrganizers) collections.push({...createOrganizersCollectionBlueprint({legacyCompatibility}),slug:organizerCollection});
for(const collection of collections) for(const field of collection.fields) {delete field.widget;if(field.options) delete field.options.eventualEditor;}
const json=JSON.stringify({version:'1',defaultLocale:locale,collections},null,2)+'\n';
if(output) writeFileSync(output,json,{encoding:'utf8',flag:'wx'}); else process.stdout.write(json);
