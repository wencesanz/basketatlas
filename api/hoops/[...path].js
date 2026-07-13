/*
 * api/hoops/[...path].js — Basket Atlas proxy para Vercel (API-BASKETBALL / api-sports.io)
 * ---------------------------------------------------------------------------------------
 * Versión Vercel Serverless Function del proxy de Cloudflare (proxy/hoops-proxy.js).
 * Mantiene tu clave api-sports en el SERVIDOR: el navegador llama a esta función,
 * la función inyecta la clave y reenvía a api-basketball. La clave nunca llega al cliente.
 *
 * Ruta pública: https://TU-APP.vercel.app/api/hoops/<endpoint>
 * En nba-config.js:
 *   window.HOOPS_PROXY_BASE = "https://TU-APP.vercel.app/api/hoops";
 *
 * Variables de entorno en Vercel (Settings → Environment Variables):
 *   APISPORTS_KEY   (obligatoria)  tu clave de https://dashboard.api-football.com
 *   ALLOWED_ORIGIN  (opcional)     p.ej. https://basketatlas.com  (restringe CORS)
 */

const UPSTREAM = 'https://v1.basketball.api-sports.io';
const ALLOW = ['/leagues', '/teams', '/players', '/players/statistics', '/standings', '/games', '/statistics', '/seasons', '/countries'];
const TTL = { '/leagues': 86400, '/countries': 86400, '/seasons': 86400, '/teams': 3600, '/standings': 300, '/players': 600, '/players/statistics': 600, '/games': 60, '/statistics': 300 };

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allow = process.env.ALLOWED_ORIGIN;
  const corsOrigin = !allow ? '*' : (origin === allow ? origin : allow);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.APISPORTS_KEY) return res.status(500).json({ error: 'Proxy mal configurado: falta APISPORTS_KEY' });

  // Extraemos la ruta DIRECTAMENTE de la URL, sin depender del parámetro
  // catch-all de Vercel (que en algunos setups llega vacío). Todo lo que
  // haya tras "/api/hoops" son los segmentos del endpoint. "" → healthcheck.
  const url = new URL(req.url, 'http://x');
  const after = url.pathname.replace(/^.*\/api\/hoops/, '');   // "/leagues", "" ...
  const segs = after.split('/').filter(Boolean);
  if (segs.length === 0) return res.status(200).json({ ok: true, service: 'basket-atlas-hoops-proxy', upstream: UPSTREAM });

  const path = '/' + segs.join('/');
  const base = '/' + segs.slice(0, 2).join('/');
  if (!ALLOW.includes(path) && !ALLOW.includes(base)) return res.status(403).json({ error: 'Endpoint no permitido por el proxy', path });

  // Reconstruye el querystring original quitando los parámetros internos que
  // Vercel inyecta para la ruta catch-all (según versión: "path" o "___path").
  url.searchParams.delete('path');
  url.searchParams.delete('___path');
  const target = UPSTREAM + path + (url.search || '');

  let upstream;
  try {
    upstream = await fetch(target, { headers: { 'x-apisports-key': process.env.APISPORTS_KEY, Accept: 'application/json' } });
  } catch (e) {
    return res.status(502).json({ error: 'Fallo al contactar upstream', detail: String(e) });
  }

  const body = await upstream.text();
  const ttl = TTL[path] || TTL[base] || 120;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=60`);
  return res.status(upstream.status).send(body);
}
