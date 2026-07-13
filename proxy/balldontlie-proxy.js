/*
 * balldontlie-proxy.js — Cloudflare Worker (production key hiding)
 * ---------------------------------------------------------------
 * Keeps the BALLDONTLIE API key server-side so it never ships to the browser.
 * The client (nba-api.js) points window.NBA_PROXY_BASE at this Worker and sends
 * NO Authorization header; the Worker injects it and forwards to balldontlie.
 *
 * Deploy (Cloudflare):
 *   1. npm i -g wrangler && wrangler login
 *   2. wrangler secret put BDL_API_KEY      # paste your free key
 *   3. (optional) set ALLOWED_ORIGIN below to your site's origin
 *   4. wrangler deploy
 *   5. In each page's <helmet>, BEFORE nba-api.js:
 *        <script>window.NBA_PROXY_BASE = "https://your-worker.workers.dev/nba/v1";</script>
 *      Then remove the "Connect key" UI — the app is live with no client key.
 *
 * Same idea works on any runtime (Vercel/Netlify function, Express) — forward
 * the path + query to https://api.balldontlie.io and add the Authorization header.
 */

const UPSTREAM = 'https://api.balldontlie.io';
const ALLOWED_ORIGIN = '*'; // tighten to e.g. 'https://basketatlas.com' in production

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const inUrl = new URL(request.url);
    // Only allow the NBA read endpoints we actually use.
    const allowed = /^\/nba\/v1\/(standings|teams|games|season_averages|players\/active|players|stats)$/;
    if (!allowed.test(inUrl.pathname)) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const target = new URL(UPSTREAM + inUrl.pathname + inUrl.search);
    const upstream = await fetch(target.toString(), {
      headers: { Authorization: env.BDL_API_KEY },
      cf: { cacheTtl: 30, cacheEverything: true }, // edge-cache 30s to save rate limit
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    });
  },
};
