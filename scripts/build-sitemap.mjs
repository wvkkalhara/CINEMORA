// Writes public/sitemap.xml from src/routes.js.
// <lastmod> comes from SITE_LASTMOD in wrangler.toml (falls back to today).
// Runs automatically before `npm run deploy`; run it by hand with `npm run sitemap`.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSitemap } from '../src/sitemap.js';

const root = new URL('..', import.meta.url);
const toml = readFileSync(new URL('wrangler.toml', root), 'utf8');
const lastmod = (toml.match(/^\s*SITE_LASTMOD\s*=\s*"([^"]+)"/m) || [])[1];

const out = new URL('public/sitemap.xml', root);
writeFileSync(out, buildSitemap(lastmod));
console.log(`Wrote ${fileURLToPath(out)} (lastmod ${lastmod || 'today'})`);
