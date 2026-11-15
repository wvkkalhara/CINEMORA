// Builds sitemap.xml from routes.js. Used by scripts/build-sitemap.mjs (writes public/sitemap.xml)
// and by the Worker as a fallback if that file is missing.
import { SITE, ROUTES } from './routes.js';

const PAGE_IMAGES = {
  home: ['/assets/og-image.jpg', '/assets/logo-full.png'],
  founder: ['/assets/founder.jpg'],
};

export function buildSitemap(lastmod) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(lastmod || '') ? lastmod : new Date().toISOString().slice(0, 10);
  const urls = Object.entries(ROUTES).map(([key, r]) => {
    const images = (PAGE_IMAGES[key] || [])
      .map((src) => `\n    <image:image><image:loc>${xml(SITE.origin + src)}</image:loc></image:image>`)
      .join('');
    return `  <url>\n    <loc>${xml(SITE.origin + r.path)}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>${r.changefreq}</changefreq>\n    <priority>${r.priority}</priority>${images}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
}

function xml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
