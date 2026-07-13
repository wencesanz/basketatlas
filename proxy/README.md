# Basket Atlas — live data & API key

The site pulls live NBA data from **[balldontlie](https://www.balldontlie.io)** (`api.balldontlie.io`),
which is CORS-enabled so the browser can call it directly. All live wiring lives in
`nba-api.js` (client) and, for production, `proxy/balldontlie-proxy.js` (key-hiding proxy).

## Two ways to run

### 1. Prototype — client-side key (works today)
1. Create a free account at **https://app.balldontlie.io** → Account → copy your API key.
2. Open **League** (or **Players**), paste the key in the *Live data* panel → **Connect**.
3. The key is saved in your browser's `localStorage` (`ba_bdl_key`) and reused across pages
   (Home shows live scores, Players shows live season averages, League shows live standings +
   leaders). Nothing is stored on a server.

⚠️ A client-side key is visible to anyone who opens the page. Fine for a demo, **not** for a
public production site — use the proxy below.

## Recommended production path — API-BASKETBALL (all 17 leagues)

balldontlie only covers the **NBA** for basketball. To serve every league Basket Atlas
advertises (EuroLeague, ACB, LBA, BBL, LNB, B.League, CBA, KBL, PBA …) use
**API-BASKETBALL (api-sports.io)** — one key, one proxy, 115+ competitions. Free tier
is 100 req/day; paid unlocks all leagues + volume.

1. Get a free key at **https://dashboard.api-football.com** (same account powers API-BASKETBALL).
2. Deploy `proxy/hoops-proxy.js` (Cloudflare Worker — hides the key server-side):
   ```
   npm i -g wrangler && wrangler login
   wrangler secret put APISPORTS_KEY      # paste your api-sports key
   wrangler secret put ALLOWED_ORIGIN     # optional: https://basketatlas.com
   wrangler deploy
   ```
3. Set the Worker URL in **`nba-config.js`**:
   ```js
   window.HOOPS_PROXY_BASE = "https://basket-atlas-proxy.<you>.workers.dev/hoops";
   ```
4. Open **Environment.dc.html** to verify — it pings the proxy, shows status, and runs a
   live player-search test. The client is `hoops-api.js` (`window.HoopsApi`).

Everything degrades gracefully: with `HOOPS_PROXY_BASE` empty, pages keep the verified
2025-26 static dataset. **Transfers** are detected by diffing rosters (`diffRosters`) — no
provider offers a clean transfers feed. **News** stays RSS-driven.

---

## Legacy / NBA-only — balldontlie

### Production — proxy (key stays server-side)
Deploy `proxy/balldontlie-proxy.js` (Cloudflare Worker; adaptable to Vercel/Netlify/Express):

```
npm i -g wrangler && wrangler login
wrangler secret put BDL_API_KEY      # paste your key
wrangler deploy
```

Then set the Worker URL in **`nba-config.js`** (one line, loaded by every page):

```js
window.NBA_PROXY_BASE = "https://your-worker.workers.dev/nba/v1";
```

With `NBA_PROXY_BASE` set, `nba-api.js` sends no key from the browser, live data loads
automatically for every visitor, and the *Connect* panels self-hide — the key never leaves
your infrastructure. Leave it `""` to stay in prototype (per-visitor key) mode.

## What's live per page
| Page      | Live data                                             | Endpoint(s)                          |
|-----------|-------------------------------------------------------|--------------------------------------|
| League    | Standings (E/W), today's games, leader board          | `standings`, `games`, `season_averages` |
| Home      | Today's scores strip                                  | `games`                              |
| Players   | Player cards as live season averages                  | `players/active`, `season_averages`  |

Everything falls back to the verified 2025-26 static dataset when no key/proxy is set or a
request fails. **Transfers** and **News** stay curated — balldontlie's free tier has no
transactions/news feed.

## Rate limits
The leaderboard/season-average calls run **once on connect** and are cached in-memory (10 min);
standings/games cache for 30–60s. Adjust TTLs in `nba-api.js`.
