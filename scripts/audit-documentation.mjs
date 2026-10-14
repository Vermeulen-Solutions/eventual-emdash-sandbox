// Documentation checks only; no builds, network calls or repository writes.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['README.md', 'CHANGELOG.md'];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !['node_modules', 'dist', '.astro', 'reports'].includes(entry.name)) walk(file);
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file);
  }
}
for (const directory of ['docs', 'images', 'examples', 'audit']) walk(directory);
const errors = [];
function anchors(text) {
  const counts = new Map();
  return new Set([...text.replace(/```[\s\S]*?```/g, '').matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, heading]) => {
    const slug = heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    return slug + (count ? '-' + count : '');
  }));
}
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const prose = text.replace(/```[\s\S]*?```/g, '');
  const links = [...prose.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1]);
  links.push(...[...prose.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]));
  for (const raw of links) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue;
    const [target, fragment] = raw.replace(/^<|>$/g, '').split('#');
    const resolved = target ? path.resolve(root, path.dirname(file), decodeURIComponent(target.split('?')[0])) : path.resolve(root, file);
    if (!fs.existsSync(resolved)) errors.push(`${file}: missing target ${raw}`);
    else if (fragment && resolved.endsWith('.md') && !anchors(fs.readFileSync(resolved, 'utf8')).has(decodeURIComponent(fragment))) errors.push(`${file}: missing heading ${raw}`);
  }
}
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const sections = ['docs/registry-installation.md', 'docs/registry-changelog.md'].map(file => {
  const text = fs.readFileSync(file, 'utf8');
  const bytes = Buffer.byteLength(text), graphemes = [...segmenter.segment(text)].length;
  if (bytes >= 20000 || graphemes >= 2000) errors.push(`${file}: section cap exceeded`);
  return { file, bytes, graphemes };
});
console.log(JSON.stringify({ files: files.length, sections, errors }, null, 2));
if (errors.length) process.exitCode = 1;
