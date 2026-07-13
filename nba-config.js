/*
 * nba-config.js — single switch: prototype  ⇄  production
 * ------------------------------------------------------
 * Loaded before nba-api.js on every page.
 *
 * PROTOTYPE (default): leave NBA_PROXY_BASE empty. Each page shows a "Connect"
 * panel; the visitor pastes their own balldontlie key (stored in their browser).
 *
 * PRODUCTION: deploy proxy/balldontlie-proxy.js, then set NBA_PROXY_BASE to your
 * Worker URL below. The browser will send NO key (it lives server-side), live
 * data loads automatically for everyone, and the Connect panels self-hide.
 *
 *   window.NBA_PROXY_BASE = "https://your-worker.workers.dev/nba/v1";
 */
window.NBA_PROXY_BASE = "";

/*
 * ── PRODUCTION MULTI-LEAGUE (recommended) ──────────────────────────────────
 * HOOPS_PROXY_BASE points at proxy/hoops-proxy.js (API-BASKETBALL / api-sports).
 * ONE key, ONE proxy, covers all 17 leagues (NBA + EuroLeague + ACB + …).
 * The key stays server-side; live data loads for every visitor automatically.
 * Leave "" to stay on the verified static dataset. See hoops-api.js + proxy/.
 *
 *   window.HOOPS_PROXY_BASE = "https://basket-atlas-proxy.<you>.workers.dev/hoops";
 */
window.HOOPS_PROXY_BASE = "";

/*
 * NBA_NEWS_RSS — RSS feed for the live News headlines (News page).
 * News is public, so no key: the page fetches it via a CORS-friendly
 * RSS→JSON converter and falls back to curated headlines if it fails.
 * Swap for any NBA feed (NBA.com, Yahoo, team feeds, a Spanish source…).
 */
window.NBA_NEWS_RSS = "https://www.espn.com/espn/rss/nba/news";
