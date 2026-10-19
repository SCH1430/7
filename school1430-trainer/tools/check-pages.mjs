// No bundler is needed: dist contains the editable, dependency-free site.
// Validate the exact folder uploaded by GitHub Actions, including case-sensitive paths.
import { readdir, readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const files = new Map();
async function walk(dir = '') {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const name = path.posix.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Symbolic link is not allowed: ${name}`);
    if (entry.isDirectory()) await walk(name);
    else {
      const stat = await lstat(path.join(root, name));
      if (!stat.isFile()) throw Error(`Not a regular file: ${name}`);
      if (stat.size >= 100 * 1024 ** 2) throw Error(`File exceeds GitHub's 100 MiB limit: ${name}`);
      files.set(name, stat.size);
    }
  }
}
await walk();
const checked = new Set();
function reference(url, from = 'index.html') {
  if (!url || /^(?:https?:|data:|blob:|mailto:|#)/i.test(url)) return;
  if (url.startsWith('/') || url.includes('\\')) throw Error(`Non-portable URL in ${from}: ${url}`);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), decodeURIComponent(url.split(/[?#]/)[0])));
  const file = resolved.endsWith('/') ? resolved + 'index.html' : resolved;
  if (!files.has(file)) throw Error(`Missing file (check spelling and case) in ${from}: ${url}`);
  checked.add(file);
}
function markup(text, from) {
  for (const match of text.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) reference(match[1], from);
}
for (const needed of ['index.html', 'oge.html', '.nojekyll']) {
  if (!files.has(needed)) throw Error(`Required Pages file is missing: ${needed}`);
}
for (const file of files.keys()) {
  if (file.endsWith('.html')) markup(await readFile(path.join(root, file), 'utf8'), file);
  if (file.endsWith('.css')) {
    const css = await readFile(path.join(root, file), 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) reference(match[1], file);
  }
}
const C = require('../dist/bank.js');
const O = require('../dist/oge-core.js');
for (const { task } of C.bank) {
  markup(task.body, 'index.html');
  if (task.sourceImage) reference(task.sourceImage);
}
for (const task of O.bank) {
  markup(task.body, 'oge.html');
  const asset = task.asset || O.asset;
  for (const image of task.images || []) reference(asset + image, 'oge.html');
  if (task.download) reference(asset + task.download, 'oge.html');
}
// Runtime-only resources (PDF export and program checking).
for (const file of ['assets/DejaVuSans.ttf', 'oge-grader-worker.js', 'oge-program-grader.js']) reference(file);
for (const manifest of ['assets/oge-2027/sources.json', 'assets/oge-bank/practice/sources.json', 'assets/oge-bank/levels/sources.json']) {
  const data = JSON.parse(await readFile(path.join(root, manifest), 'utf8'));
  const entries = Array.isArray(data.files) ? data.files.map(record => [record.file, record]) : Object.entries(data.files);
  for (const [name, record] of entries) {
    reference(name, manifest);
    const file = path.posix.join(path.posix.dirname(manifest), name);
    if (files.get(file) !== record.bytes) throw Error(`Changed size: ${file}`);
    const hash = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
    if (hash !== record.sha256) throw Error(`Changed checksum: ${file}`);
  }
  for (const images of Object.values(data.images || {})) for (const image of images) reference(image, manifest);
}
const size = [...files.values()].reduce((sum, bytes) => sum + bytes, 0);
if (size >= 1024 ** 3) throw Error('Site exceeds the GitHub Pages 1 GiB limit.');
console.log(`Pages ready: ${files.size} files, ${(size / 1024 ** 2).toFixed(1)} MiB; ${checked.size} local resources checked.`);
console.log(`Banks loaded: ${C.bank.length} main tasks, ${O.bank.length} OGE tasks. All material checksums match.`);
