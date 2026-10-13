// Verify current publisher records, exact-CID labels and the uploaded package bytes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DiscoveryClient } from '@emdash-cms/registry-client/discovery';

const did = 'did:plc:g2hei4vcwndrdl3gdbb6np6c';
const slug = 'eventual';
const version = '0.14.0';
const directory = 'reports/release-0.14.0';
const document = await fetch('https://plc.directory/' + did).then(response => response.json());
const pds = document.service.find(service => service.id.endsWith('#atproto_pds')).serviceEndpoint;
async function record(kind, rkey) {
  const query = new URLSearchParams({ repo: did, collection: 'com.emdashcms.experimental.package.' + kind, rkey });
  const response = await fetch(pds + '/xrpc/com.atproto.repo.getRecord?' + query);
  assert.equal(response.ok, true, `${kind}: HTTP ${response.status}`);
  return response.json();
}
const discovery = new DiscoveryClient({ aggregatorUrl: 'https://registry.emdashcms.com' });
const signedProfile = await record('profile', slug);
const signedRelease = await record('release', slug + ':' + version);
const profile = await discovery.getPackage({ did, slug });
let cursor, release;
do {
  const page = await discovery.listReleases({ did, package: slug, cursor, limit: 50 });
  release = page.releases.find(item => item.version === version);
  cursor = page.cursor;
} while (!release && cursor);
const records = { checkedAt: new Date().toISOString(), pds, signedProfile, signedRelease, profile, release };
await fs.writeFile(directory + '/registry-records.json', JSON.stringify(records, null, 2) + '\n');
assert.equal(profile?.cid, signedProfile.cid, 'Profile indexing must match the current PDS record');
assert.equal(release?.cid, signedRelease.cid, 'Release indexing must match the current PDS record');
for (const [name, item] of [['profile', profile], ['release', release]]) {
  assert.ok(item.labels.some(label => label.cid === item.cid && !label.neg && ['listing-passed', 'listing-overridden'].includes(label.val)), `${name} lacks current-CID approval`);
}
const artifact = signedRelease.value.artifacts.package;
assert.equal(release.release.artifacts.package.checksum, artifact.checksum);
const blob = artifact.blob.ref.$link;
const response = await fetch(pds + '/xrpc/com.atproto.sync.getBlob?' + new URLSearchParams({ did, cid: blob }));
assert.equal(response.ok, true);
const remote = Buffer.from(await response.arrayBuffer());
const local = await fs.readFile('dist/eventual-0.14.0.tar.gz');
assert.deepEqual(remote, local, 'The uploaded artifact must equal the publish-produced local archive');
const result = { identifier: `${did}/${slug}@${version}`, profileCid: profile.cid, releaseCid: release.cid, profileApproved: true, releaseApproved: true, checksum: artifact.checksum, blobCid: blob, bytes: remote.length, sha256: createHash('sha256').update(remote).digest('hex') };
await fs.writeFile(directory + '/registry-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
