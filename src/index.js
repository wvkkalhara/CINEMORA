/**
 * Cinemora Production — Cloudflare Worker
 *
 *  - Canonical host + HTTPS (301), trailing-slash / case / index.html cleanup
 *  - Clean, crawlable URLs (/prices, /contact, /founder, /location, /social)
 *    each with its own <title>, description, canonical, OG tags, visible section and <h1>
 *  - /robots.txt and /sitemap.xml generated at the edge
 *  - Strict security headers on every response (per-request CSP nonce for inline scripts)
 *  - Cache-Control tuned per content type
 */
import { SITE, ROUTES, PATH_TO_ROUTE } from './routes.js';
import { buildSitemap } from './sitemap.js';

const ASSET_CACHE = 'public, max-age=604800, stale-while-revalidate=86400'; // 7 days
const HTML_CACHE = 'private, no-cache'; // always revalidated; served from the edge in ms
const CRAWLER_CACHE = 'public, max-age=3600, stale-while-revalidate=86400';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const canonicalHost = env.CANONICAL_HOST || 'cinemoraproduction.com';
    // LOCAL_DEV comes from .dev.vars, which only `wrangler dev` reads (it rewrites the URL to the production host).
    const local = String(env.LOCAL_DEV) === 'true' || isLocal(url.hostname);
    // Any other hostname (e.g. cinemora.<account>.workers.dev) is a temporary preview:
    // it is served normally but marked noindex so Google never indexes it.
    const preview = !local && url.hostname !== canonicalHost && url.hostname !== `www.${canonicalHost}`;

    const res = await handle(request, env, url, canonicalHost, local, preview);
    if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  },
};

async function handle(request, env, url, canonicalHost, local, preview) {
    // 1) Canonical origin: http -> https, www -> apex. Preview hosts only get http -> https.
    if (preview && url.protocol !== 'https:') {
      return redirect(`https://${url.host}${url.pathname}${url.search}`, local);
    }
    if (!local && !preview && (url.protocol !== 'https:' || url.hostname !== canonicalHost)) {
      return redirect(`https://${canonicalHost}${url.pathname}${url.search}`, local);
    }

    // 2) Only GET / HEAD are meaningful on a static site.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return secure(new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' } }), local);
    }

    // 3) Path normalisation (one URL per page = no duplicate content).
    let path = url.pathname.replace(/\/{2,}/g, '/');
    if (path === '/index.html' || path === '/index') path = '/';
    if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');
    if (PATH_TO_ROUTE[path.toLowerCase()] && path !== path.toLowerCase()) path = path.toLowerCase();
    if (path !== url.pathname) {
      return redirect(`${url.protocol}//${url.host}${path}${url.search}`, local);
    }

    // 4) Crawler endpoints.
    if (path === '/robots.txt') return text(preview ? 'User-agent: *\nDisallow: /\n' : robots(), 'text/plain; charset=utf-8', request, local);
    if (path === '/sitemap.xml') {
      // Serve the generated public/sitemap.xml; build it on the fly if the file is missing.
      const file = await env.ASSETS.fetch(new Request(new URL('/sitemap.xml', request.url)));
      const body = file.ok ? await file.text() : buildSitemap(env.SITE_LASTMOD);
      return text(body, 'application/xml; charset=utf-8', request, local);
    }

    // 5) Pages.
    const routeKey = PATH_TO_ROUTE[path];
    if (routeKey) return renderPage(routeKey, request, env, local);

    // 6) Static files (images, icons, manifest).
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404) return notFound(request, local);
    const out = new Response(res.body, res);
    if (res.ok) out.headers.set('Cache-Control', ASSET_CACHE);
    return secure(out, local);
}

// ---------------------------------------------------------------- pages

async function renderPage(key, request, env, local) {
  const route = ROUTES[key];
  const pageUrl = SITE.origin + route.path;
  const asset = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
  if (!asset.ok) return notFound(request, local);

  const nonce = makeNonce();
  const routeMeta = Object.fromEntries(
    Object.entries(ROUTES).map(([k, r]) => [k, { title: r.title, description: r.description, url: SITE.origin + r.path }]),
  );
  const breadcrumb = key === 'home' ? null : {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: ROUTES.home.crumb, item: SITE.origin + '/' },
      { '@type': 'ListItem', position: 2, name: route.crumb, item: pageUrl },
    ],
  };

  const setAttr = (attr, value) => ({ element(el) { el.setAttribute(attr, value); } });

  let rewriter = new HTMLRewriter()
    .on('html', setAttr('data-route', key))
    .on('title', { element(el) { el.setInnerContent(route.title); } })
    .on('meta[name="description"]', setAttr('content', route.description))
    .on('link[rel="canonical"]', setAttr('href', pageUrl))
    .on('meta[property="og:url"]', setAttr('content', pageUrl))
    .on('meta[property="og:title"]', setAttr('content', route.title))
    .on('meta[property="og:description"]', setAttr('content', route.description))
    .on('meta[name="twitter:title"]', setAttr('content', route.title))
    .on('meta[name="twitter:description"]', setAttr('content', route.description))
    .on('script', setAttr('nonce', nonce))
    .on('head', {
      element(el) {
        el.append(`<script type="application/json" id="route-meta">${safeJson(routeMeta)}</script>`, { html: true });
        if (breadcrumb) el.append(`<script type="application/ld+json">${safeJson(breadcrumb)}</script>`, { html: true });
      },
    })
    // Show the requested section on first paint (no JS needed, no layout shift).
    .on('main > section', {
      element(el) {
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter((c) => c && c !== 'on');
        if (el.getAttribute('id') === key) cls.push('on');
        if (cls.length) el.setAttribute('class', cls.join(' ')); else el.removeAttribute('class');
      },
    })
    .on('#nav a', {
      element(el) {
        const on = el.getAttribute('data-t') === key;
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter((c) => c && c !== 'on');
        if (on) cls.push('on');
        if (cls.length) el.setAttribute('class', cls.join(' ')); else el.removeAttribute('class');
        if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
      },
    })
    // Exactly one <h1> per URL: that page's main heading.
    .on('[data-h1]', {
      element(el) {
        const owner = el.getAttribute('data-h1');
        el.tagName = owner === key ? 'h1' : owner === 'home' ? 'div' : 'h2';
        if (owner === key && owner !== 'home') el.setAttribute('class', `${el.getAttribute('class') || ''} st`.trim());
      },
    });

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': HTML_CACHE,
    'Content-Security-Policy': pageCsp(nonce, local),
  });
  const body = request.method === 'HEAD' ? null : rewriter.transform(asset).body;
  return secure(new Response(body, { status: 200, headers }), local);
}

function notFound(request, local) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#0a0507"><title>Page not found | Cinemora Production</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;background:#0a0507;color:#f4ece9;font:300 16px/1.6 "Helvetica Neue",Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}h1{font-weight:700;font-size:clamp(2rem,8vw,4rem);margin:0 0 8px;color:#e0627f}a{display:inline-block;margin-top:18px;background:#c2294d;color:#fff;text-decoration:none;padding:13px 28px;border-radius:30px;letter-spacing:.1em}</style></head><body><main><h1>404</h1><p>This scene didn’t make the final cut.</p><a href="/">Back to Cinemora Production</a></main></body></html>`;
  return secure(new Response(request.method === 'HEAD' ? null : html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'X-Robots-Tag': 'noindex',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  }), local);
}

// ---------------------------------------------------------------- crawler files

function robots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE.origin}/sitemap.xml\n`;
}

function text(body, type, request, local) {
  return secure(new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': CRAWLER_CACHE,
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    },
  }), local);
}

// ---------------------------------------------------------------- security

function pageCsp(nonce, local) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdnjs.cloudflare.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "media-src 'self'",
    "worker-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(local ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

function secure(response, local) {
  const h = response.headers;
  if (!local) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (!h.has('Content-Security-Policy')) h.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; frame-ancestors 'none'");
  h.delete('X-Powered-By');
  return response;
}

function redirect(location, local) {
  return secure(new Response(null, { status: 301, headers: { Location: location, 'Cache-Control': 'public, max-age=86400' } }), local);
}

// ---------------------------------------------------------------- helpers

function isLocal(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost');
}

function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
