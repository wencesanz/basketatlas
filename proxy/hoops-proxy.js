/*
 * hoops-proxy.js — Basket Atlas production proxy (API-BASKETBALL / api-sports.io)
 * ------------------------------------------------------------------------------
 * A tiny edge proxy that keeps your api-sports key SERVER-SIDE. The browser
 * calls this Worker; the Worker injects the key and forwards to api-basketball.
 * The key never reaches the client, so live multi-league data works for every
 * visitor with no per-user setup.
 *
 * Covers all 17 Basket Atlas leagues (NBA, EuroLeague, ACB, LBA, BBL, LNB,
 * B.League, CBA, KBL, PBA, …) through ONE provider and ONE key.
 *
 * ── Deploy (Cloudflare Workers) ────────────────────────────────────────────
 *   npm i -g wrangler && wrangler login
 *   # wrangler.toml:  name = "basket-atlas-proxy"  /  main = "proxy/hoops-proxy.js"
 *   wrangler secret put APISPORTS_KEY      # paste your api-sports.io key
 *   # (optional) allow only your site:
 *   wrangler secret put ALLOWED_ORIGIN     # e.g. https://basketatlas.com
 *   wrangler deploy
 *
 * Then set the Worker URL in nba-config.js:
 *   window.HOOPS_PROXY_BASE = "https://basket-atlas-proxy.<you>.workers.dev/hoops";
 *
 * Get a free key at https://dashboard.api-football.com (same account powers
 * api-basketball). Free tier = 100 req/day; paid unlocks all leagues + volume.
 *
 * Adaptable to Vercel/Netlify/Express: same idea — read the key from an env
 * var, forward everything after /hoops to UPSTREAM with the x-apisports-key
 * header, and echo CORS. This file targets Cloudflare Workers.
 */

const UPSTREAM = 'https://v1.basketball.api-sports.io';
// Endpoints we allow through (defense-in-depth; keeps the proxy a read-only lens).
const ALLOW = ['/leagues', '/teams', '/players', '/players/statistics', '/standings', '/games', '/statistics', '/seasons', '/countries'];
// Short edge cache per path+query (seconds). Protects your daily quota.
const TTL = { '/leagues': 86400, '/countries': 86400, '/seasons': 86400, '/teams': 3600, '/standings': 300, '/players': 600, '/players/statistics': 600, '/games': 60, '/statistics': 300 };

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors);
    if (!env.APISPORTS_KEY) return json({ error: 'Proxy misconfigured: APISPORTS_KEY secret not set' }, 500, cors);

    const url = new URL(request.url);
    // Strip the /hoops prefix → the api-basketball path.
    let path = url.pathname.replace(/^\/hoops/, '') || '/';
    if (path === '/' || path === '') return json({ ok: true, service: 'basket-atlas-hoops-proxy', upstream: UPSTREAM }, 200, cors);

    const base = '/' + path.split('/').filter(Boolean).slice(0, 2).join('/');
    const allowed = ALLOW.includes(path) || ALLOW.includes(base);
    if (!allowed) return json({ error: 'Endpoint not allowed by proxy', path }, 403, cors);

    const target = UPSTREAM + path + (url.search || '');

    // Edge cache read.
    const cache = caches.default;
    const cacheKey = new Request(target, { method: 'GET' });
    let hit = await cache.match(cacheKey);
    if (hit) {
      const h = new Headers(hit.headers); Object.entries(cors).forEach(([k, v]) => h.set(k, v)); h.set('x-proxy-cache', 'HIT');
      return new Response(hit.body, { status: hit.status, headers: h });
    }

    let upstream;
    try {
      upstream = await fetch(target, { headers: { 'x-apisports-key': env.APISPORTS_KEY, Accept: 'application/json' } });
    } catch (e) {
      return json({ error: 'Upstream fetch failed', detail: String(e) }, 502, cors);
    }

    const body = await upstream.text();
    const ttl = TTL[path] || TTL[base] || 120;
    const h = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=' + ttl, 'x-proxy-cache': 'MISS' });
    Object.entries(cors).forEach(([k, v]) => h.set(k, v));
    const res = new Response(body, { status: upstream.status, headers: h });
    if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};

function corsHeaders(origin, env) {
  const allow = env && env.ALLOWED_ORIGIN;
  const value = !allow ? '*' : (origin === allow ? origin : allow);
  return {
    'Access-Control-Allow-Origin': value,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, cors || {}) });
}
