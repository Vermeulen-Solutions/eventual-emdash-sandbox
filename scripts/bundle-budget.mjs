import { gunzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const budgets = { file: 110 * 1024, total: 220 * 1024, files: 16 };
export const hardLimits = { file: 128 * 1024, total: 256 * 1024, files: 20 };

// Measure the actual installation payload, including manifest and README.
export function measureArchive(gzip) {
  const tar = gunzipSync(gzip);
  const entries = [];
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim(), 8);
    if (!Number.isFinite(size) || offset + 512 + size > tar.length) throw new Error('Invalid tar entry');
    const type = header[156];
    if (type !== 0 && type !== 48) throw new Error(`Unsupported tar entry type for ${name}`);
    entries.push({ name, bytes: size });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (!entries.length) throw new Error('Empty archive');
  return { entries, total: entries.reduce((sum, entry) => sum + entry.bytes, 0), files: entries.length };
}

export function checkBudget(report, limits = budgets) {
  const errors = report.entries.filter(entry => entry.bytes > limits.file).map(entry => `${entry.name}: ${entry.bytes} > ${limits.file} bytes`);
  if (report.total > limits.total) errors.push(`Total: ${report.total} > ${limits.total} bytes`);
  if (report.files > limits.files) errors.push(`Files: ${report.files} > ${limits.files}`);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const archives = readdirSync('dist').filter(name => name.endsWith('.tar.gz'));
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const archive = `${pkg.name}-${pkg.version}.tar.gz`;
  if (!archives.includes(archive)) throw new Error('Run npm run bundle first');
  const report = measureArchive(readFileSync(`dist/${archive}`));
  const errors = checkBudget(report);
  console.log(JSON.stringify({ ...report, budgets, hardLimits, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
