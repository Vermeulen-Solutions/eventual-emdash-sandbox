import { afterEach, expect, it, vi } from 'vitest';
import { fetchPublicFeed } from '../astro/feed';

afterEach(() => vi.unstubAllGlobals());
it.each([undefined, true, false])('passes publicUrls=%s through the Astro helper', async publicUrls => {
  const fetch = vi.fn(async (_input: URL) => Response.json({ success: true, data: { ok: true, from: '2026-01-01', through: '2026-12-31', events: [] } }));
  vi.stubGlobal('fetch', fetch);
  await fetchPublicFeed('https://club.example', '2026-01-01', '2026-12-31', '', { publicUrls });
  const url = new URL(fetch.mock.calls[0]![0]);
  expect(url.searchParams.get('publicUrls')).toBe(publicUrls === undefined ? null : String(publicUrls));
});
