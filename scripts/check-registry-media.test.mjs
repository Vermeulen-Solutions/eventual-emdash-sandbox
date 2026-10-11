import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, presetTarget, LIMIT_BYTES, SAFETY_FACTOR, WARN_RATIO } from './check-registry-media.mjs';

test('preset targets fit inside the CDN boxes and upscale small sources', () => {
  // Dimensions observed on cdn.em-da.sh derivatives, 2026-10-11.
  assert.deepEqual(presetTarget('screenshot', 1280, 900), { preset: 'feed_thumbnail', width: 2000, height: 1406 });
  assert.deepEqual(presetTarget('screenshot', 1004, 1222), { preset: 'feed_thumbnail', width: 1643, height: 2000 });
  assert.deepEqual(presetTarget('screenshot', 390, 844), { preset: 'feed_thumbnail', width: 924, height: 2000 });
  assert.deepEqual(presetTarget('screenshot', 1440, 1190), { preset: 'feed_thumbnail', width: 2000, height: 1653 });
  assert.deepEqual(presetTarget('banner', 2172, 724), { preset: 'banner', width: 3000, height: 1000 });
  assert.deepEqual(presetTarget('icon', 1254, 1254), { preset: 'avatar', width: 1000, height: 1000 });
  // Larger sources scale down; smaller sources scale up.
  assert.deepEqual(presetTarget('banner', 6000, 2000), { preset: 'banner', width: 3000, height: 1000 });
  assert.deepEqual(presetTarget('icon', 64, 64), { preset: 'avatar', width: 1000, height: 1000 });
  assert.throws(() => presetTarget('video', 100, 100), /Unknown artifact kind/);
});

test('estimates classify with drift headroom against the 1 MiB cap', () => {
  assert.equal(LIMIT_BYTES, 1024 * 1024);
  assert.equal(classify(400 * 1024).status, 'ok');
  // Largest integer estimate whose real output may still fit under the cap.
  const largestFitting = Math.ceil(LIMIT_BYTES / SAFETY_FACTOR) - 1;
  assert.equal(classify(largestFitting).status, 'warn');
  assert.equal(classify(largestFitting + 1).status, 'violation');
  // Warn boundary sits at WARN_RATIO of the cap including headroom.
  assert.equal(classify(Math.floor((LIMIT_BYTES * WARN_RATIO) / SAFETY_FACTOR)).status, 'ok');
  assert.equal(classify(Math.ceil((LIMIT_BYTES * WARN_RATIO) / SAFETY_FACTOR) + 1).status, 'warn');
  // The 0.11.0 detail screenshot measured 1,196,250 real CDN bytes; the
  // emulated size must still be classified as a violation.
  assert.equal(classify(1192776).status, 'violation');
  // The 0.13.4 replacement measured 483,388 emulated bytes.
  assert.equal(classify(483388).status, 'ok');
});
