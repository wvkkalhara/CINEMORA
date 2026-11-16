// Puts the files made by "Logo Editor.html" into the website and refreshes the version number,
// so browsers and Google never show an old copy of the logo.
//
// How to use:
//   1. Extract cinemora-logo-files.zip into the "logo-update" folder (next to package.json).
//   2. Run:  npm run logo
//
// It copies mark.png, icon-192.png, icon-512.png (public/assets), apple-touch-icon.png and favicon.ico (public),
// renames them -vN -> -v(N+1), updates every reference and removes the previous version.
import { readFileSync, writeFileSync, copyFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));
const inDir = p('logo-update');

const need = ['mark.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.ico'];
const missing = need.filter((f) => !existsSync(`${inDir}/${f}`));
if (missing.length) {
  console.error(`\nMissing in the "logo-update" folder: ${missing.join(', ')}\n` +
    'Extract cinemora-logo-files.zip into that folder first (the files must sit directly inside it).\n');
  process.exit(1);
}

const html = readFileSync(p('public/index.html'), 'utf8');
const m = html.match(/\/assets\/mark-v(\d+)\.png/);
if (!m) { console.error('Could not find the current logo version in public/index.html'); process.exit(1); }
const oldV = Number(m[1]);
const newV = oldV + 1;

const versioned = { 'mark.png': 'mark', 'icon-192.png': 'icon-192', 'icon-512.png': 'icon-512' };
for (const [file, base] of Object.entries(versioned)) {
  copyFileSync(`${inDir}/${file}`, p(`public/assets/${base}-v${newV}.png`));
  rmSync(p(`public/assets/${base}-v${oldV}.png`), { force: true });
}
copyFileSync(`${inDir}/apple-touch-icon.png`, p('public/apple-touch-icon.png'));
copyFileSync(`${inDir}/favicon.ico`, p('public/favicon.ico'));

const textFiles = ['public/index.html', 'public/site.webmanifest', 'src/index.js'];
for (const f of textFiles) {
  let s = readFileSync(p(f), 'utf8');
  for (const base of Object.values(versioned)) s = s.split(`${base}-v${oldV}.png`).join(`${base}-v${newV}.png`);
  s = s.split(`/favicon.ico?v=${oldV}`).join(`/favicon.ico?v=${newV}`);
  s = s.split(`/apple-touch-icon.png?v=${oldV}`).join(`/apple-touch-icon.png?v=${newV}`);
  writeFileSync(p(f), s);
}

for (const f of readdirSync(inDir).filter((n) => !n.startsWith('PUT'))) rmSync(`${inDir}/${f}`, { recursive: true, force: true });
console.log(`\nLogo updated to version ${newV}. The previous version was removed.\nNow run:  npm run deploy\n`);
