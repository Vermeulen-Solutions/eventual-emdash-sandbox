import type { CollectionSchemaInfo } from 'emdash';
import { referenceTarget } from './native-references';

/** Dependency evidence, not an Astro cache hint or permission to cache a route. */
export interface PublicFeedCache {
  version: 1;
  dependencies: string[];
  generatedAt: string;
  expiresAt: string;
}

/** Bounds host purge gaps, plugin settings changes and scheduled visibility. */
export const PUBLIC_FEED_CACHE_CEILING_MS = 15_000;

export function publicFeedCache(schema: CollectionSchemaInfo, now: number, defaultFrom: boolean): PublicFeedCache {
  return {
    version: 1,
    // Collection tags cover every entry, translation, missing reference and empty list.
    dependencies: [...new Set([schema.slug, referenceTarget(schema, 'venue'), referenceTarget(schema, 'organizer_ref'), 'emdash:settings'])],
    generatedAt: new Date(now).toISOString(),
    expiresAt: new Date(Math.min(now + PUBLIC_FEED_CACHE_CEILING_MS,
      defaultFrom ? (Math.floor(now / 86_400_000) + 1) * 86_400_000 : Infinity)).toISOString(),
  };
}
