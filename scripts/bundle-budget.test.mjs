import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { measureArchive, checkBudget, budgets } from './bundle-budget.mjs';

test('counts uncompressed payload rather than compressed or padded archive bytes', () => {
  const header = Buffer.alloc(512);
  header.write('backend.js');
  header.write('00000000103\0', 124); // octal 67
  header[156] = 48;
  const report = measureArchive(gzipSync(Buffer.concat([header, Buffer.alloc(512), Buffer.alloc(1024)])));
  assert.equal(report.total, 67);
  assert.equal(report.files, 1);
});
test('each working budget is enforced independently and inclusively', () => {
  assert.deepEqual(checkBudget({ entries: [{ name: 'x', bytes: budgets.file }], total: budgets.total, files: budgets.files }), []);
  assert.equal(checkBudget({ entries: [{ name: 'x', bytes: budgets.file + 1 }], total: budgets.total + 1, files: budgets.files + 1 }).length, 3);
  assert.throws(() => measureArchive(gzipSync(Buffer.alloc(1024))), /Empty/);
});
