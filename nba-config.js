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
window.HOOPS_PROXY_BASE = "https://basketatlas.vercel.app/api/hoops";

/*
 * NBA_NEWS_RSS — legacy single feed (still supported for back-compat).
 * NBA_NEWS_SOURCES — multiple basketball outlets, merged + sorted by date.
 *
 * News is public (no key). The page fetches each feed through a CORS-friendly
 * RSS→JSON converter, tags every headline with its source, merges them newest
 * first, and falls back to curated headlines if all feeds fail.
 *
 * Each source: { name (shown as a badge), url (a PUBLIC RSS/Atom feed) }.
 * Add/remove freely. Only feeds that publish a real public RSS work here —
 * see the note about X and The Athletic in the News page summary.
 */
window.NBA_NEWS_SOURCES = [
  { name: "NBA.com",        url: "https://www.nba.com/rss/nba_rss.xml" },
  { name: "ESPN",           url: "https://www.espn.com/espn/rss/nba/news" },
  { name: "Yahoo Sports",   url: "https://sports.yahoo.com/nba/rss.xml" },
  { name: "CBS Sports",     url: "https://www.cbssports.com/rss/headlines/nba/" },
  { name: "HoopsHype",      url: "https://hoopshype.com/feed/" },
  { name: "Bleacher Report", url: "https://bleacherreport.com/articles/feed?tag_id=19" }
];

// Legacy single-feed fallback (used only if NBA_NEWS_SOURCES is empty).
window.NBA_NEWS_RSS = "https://www.espn.com/espn/rss/nba/news";
