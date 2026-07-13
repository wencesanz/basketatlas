/*
 * nba-api.js — Basket Atlas live-data client (BALLDONTLIE NBA API)
 * -----------------------------------------------------------------
 * Browser-side client for https://api.balldontlie.io (CORS-enabled).
 * Requires a FREE API key from https://app.balldontlie.io (Account → API).
 *
 * The key is stored in localStorage ('ba_bdl_key') so the prototype can go
 * live without a backend. NOTE: a client-side key is visible to anyone using
 * the page — fine for a prototype/demo, but for production the key must live
 * behind a small proxy/backend. This module is that seam: swap BASE for your
 * proxy URL and drop the Authorization header when you get there.
 *
 * Exposes window.NBAApi. All calls return the raw balldontlie JSON
 * ({ data, meta }). Mapping to the UI shape happens in each page.
 */
(function () {
  var BASE = 'https://api.balldontlie.io/nba/v1';
  var KEY_LS = 'ba_bdl_key';

  function getKey() { try { return (localStorage.getItem(KEY_LS) || '').trim(); } catch (e) { return ''; } }
  function setKey(k) { try { localStorage.setItem(KEY_LS, (k || '').trim()); } catch (e) {} }
  function clearKey() { try { localStorage.removeItem(KEY_LS); } catch (e) {} }
  function hasKey() { return !!(getKey() || proxyBase()); }
  function proxyBase() { try { return (typeof window !== 'undefined' && window.NBA_PROXY_BASE) || ''; } catch (e) { return ''; } }

  // Small in-memory cache so re-renders don't re-hit the API.
  var cache = {};
  function cacheKey(path, params) { return path + '?' + JSON.stringify(params || {}); }

  async function req(path, params, opts) {
    opts = opts || {};
    var proxy = proxyBase();
    var key = getKey();
    // With a proxy, the key lives server-side; no client key required.
    if (!proxy && !key) { var e = new Error('Missing API key'); e.code = 'NO_KEY'; throw e; }

    var ck = cacheKey(path, params);
    if (!opts.fresh && cache[ck] && (Date.now() - cache[ck].t) < (opts.ttl || 30000)) {
      return cache[ck].v;
    }

    var url = new URL((proxy || BASE) + path);
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v == null) return;
      if (Array.isArray(v)) v.forEach(function (x) { url.searchParams.append(k + '[]', x); });
      else url.searchParams.set(k, v);
    });

    var res;
    try {
      res = await fetch(url.toString(), { headers: proxy ? {} : { Authorization: key } });
    } catch (netErr) {
      var ne = new Error('Network/CORS error: ' + netErr.message); ne.code = 'NETWORK'; throw ne;
    }
    if (res.status === 401) { var a = new Error('Invalid API key'); a.code = 'AUTH'; throw a; }
    if (res.status === 429) { var r = new Error('Rate limit exceeded'); r.code = 'RATE'; throw r; }
    if (!res.ok) { var h = new Error('HTTP ' + res.status); h.code = 'HTTP_' + res.status; throw h; }
    var json = await res.json();
    cache[ck] = { t: Date.now(), v: json };
    return json;
  }

  // ---- Endpoints ------------------------------------------------------------
  // Standings for a season (e.g. 2025 = 2025-26). Real, single call.
  function getStandings(season, opts) { return req('/standings', { season: season }, opts); }
  // All 30 teams.
  function getTeams(opts) { return req('/teams', {}, opts); }
  // Games for a given ISO date (YYYY-MM-DD). Live scores on game days.
  function getGamesByDate(date, opts) { return req('/games', { dates: [date] }, opts); }
  // Season averages for one or more player ids.
  function getSeasonAverages(season, playerIds, opts) {
    return req('/season_averages', { season: season, player_ids: playerIds }, opts);
  }
  // Active players (paginated via cursor).
  function getActivePlayers(cursor, perPage, opts) {
    return req('/players/active', { cursor: cursor, per_page: perPage || 100 }, opts);
  }

  // Current NBA "season" year: the league year starts in October.
  function currentSeason(now) {
    now = now || new Date();
    return now.getUTCMonth() >= 9 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  }

  // Star players tracked for the live leaderboard. Matched to API ids at runtime.
  var STARS = [
    { last: 'Doncic', fi: 'L', abbr: 'LAL', conf: 'West', num: 77, name: 'L. Don\u010di\u0107', team: 'LA Lakers', pos: 'PG', grp: 'G', nat: 'Slovenia' },
    { last: 'Gilgeous-Alexander', fi: 'S', abbr: 'OKC', conf: 'West', num: 2, name: 'S. Gilgeous-Alexander', team: 'Oklahoma City', pos: 'PG', grp: 'G', nat: 'Canada' },
    { last: 'Jokic', fi: 'N', abbr: 'DEN', conf: 'West', num: 15, name: 'N. Joki\u0107', team: 'Denver', pos: 'C', grp: 'C', nat: 'Serbia' },
    { last: 'Edwards', fi: 'A', abbr: 'MIN', conf: 'West', num: 5, name: 'A. Edwards', team: 'Minnesota', pos: 'SG', grp: 'G', nat: 'USA' },
    { last: 'Brown', fi: 'J', abbr: 'BOS', conf: 'East', num: 7, name: 'J. Brown', team: 'Boston', pos: 'SF', grp: 'F', nat: 'USA' },
    { last: 'Maxey', fi: 'T', abbr: 'PHI', conf: 'East', num: 0, name: 'T. Maxey', team: 'Philadelphia', pos: 'PG', grp: 'G', nat: 'USA' },
    { last: 'Durant', fi: 'K', abbr: 'HOU', conf: 'West', num: 7, name: 'K. Durant', team: 'Houston', pos: 'SF', grp: 'F', nat: 'USA' },
    { last: 'Booker', fi: 'D', abbr: 'PHX', conf: 'West', num: 1, name: 'D. Booker', team: 'Phoenix', pos: 'SG', grp: 'G', nat: 'USA' },
    { last: 'Ball', fi: 'L', abbr: 'CHA', conf: 'East', num: 1, name: 'L. Ball', team: 'Charlotte', pos: 'PG', grp: 'G', nat: 'USA' },
    { last: 'Brunson', fi: 'J', abbr: 'NYK', conf: 'East', num: 11, name: 'J. Brunson', team: 'New York', pos: 'PG', grp: 'G', nat: 'USA' },
    { last: 'Wembanyama', fi: 'V', abbr: 'SAS', conf: 'West', num: 1, name: 'V. Wembanyama', team: 'San Antonio', pos: 'C', grp: 'C', nat: 'France' },
    { last: 'Towns', fi: 'K', abbr: 'NYK', conf: 'East', num: 32, name: 'K. Towns', team: 'New York', pos: 'C', grp: 'C', nat: 'USA' },
    { last: 'Cunningham', fi: 'C', abbr: 'DET', conf: 'East', num: 2, name: 'C. Cunningham', team: 'Detroit', pos: 'PG', grp: 'G', nat: 'USA' },
    { last: 'Davis', fi: 'A', abbr: 'DAL', conf: 'West', num: 3, name: 'A. Davis', team: 'Dallas', pos: 'PF', grp: 'F', nat: 'USA' },
    { last: 'Murray', fi: 'J', abbr: 'DEN', conf: 'West', num: 27, name: 'J. Murray', team: 'Denver', pos: 'PG', grp: 'G', nat: 'Canada' },
    { last: 'Flagg', fi: 'C', abbr: 'DAL', conf: 'West', num: 32, name: 'C. Flagg', team: 'Dallas', pos: 'SF', grp: 'F', nat: 'USA' },
    { last: 'Sengun', fi: 'A', abbr: 'HOU', conf: 'West', num: 28, name: 'A. \u015eeng\u00fcn', team: 'Houston', pos: 'C', grp: 'C', nat: 'T\u00fcrkiye' },
    { last: 'Johnson', fi: 'J', abbr: 'ATL', conf: 'East', num: 1, name: 'J. Johnson', team: 'Atlanta', pos: 'PF', grp: 'F', nat: 'USA' },
    { last: 'Mobley', fi: 'E', abbr: 'CLE', conf: 'East', num: 4, name: 'E. Mobley', team: 'Cleveland', pos: 'PF', grp: 'F', nat: 'USA' },
    { last: 'Holmgren', fi: 'C', abbr: 'OKC', conf: 'West', num: 7, name: 'C. Holmgren', team: 'Oklahoma City', pos: 'C', grp: 'C', nat: 'USA' },
    { last: 'Daniels', fi: 'D', abbr: 'ATL', conf: 'East', num: 5, name: 'D. Daniels', team: 'Atlanta', pos: 'SG', grp: 'G', nat: 'Australia' },
    { last: 'Knueppel', fi: 'K', abbr: 'CHA', conf: 'East', num: 7, name: 'K. Knueppel', team: 'Charlotte', pos: 'SG', grp: 'G', nat: 'USA' },
    { last: 'Clingan', fi: 'D', abbr: 'POR', conf: 'West', num: 13, name: 'D. Clingan', team: 'Portland', pos: 'C', grp: 'C', nat: 'USA' },
    { last: 'Thompson', fi: 'A', abbr: 'DET', conf: 'East', num: 9, name: 'A. Thompson', team: 'Detroit', pos: 'SF', grp: 'F', nat: 'USA' },
    { last: 'Gobert', fi: 'R', abbr: 'MIN', conf: 'West', num: 27, name: 'R. Gobert', team: 'Minnesota', pos: 'C', grp: 'C', nat: 'France' },
  ];

  // Build a live leaderboard: match STARS -> ids -> season averages. Returns
  // an array of {..starMeta, gp, min, pts, reb, ast, stl, blk, tov, val}.
  async function getLeaders(season, track, opts) {
    track = track || STARS;
    var norm = function (s) { return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    var byKey = {};
    var cursor, pages = 0;
    do {
      var res = await getActivePlayers(cursor, 100, { ttl: 600000 });
      (res.data || []).forEach(function (p) {
        var last = norm(p.last_name), fi = norm((p.first_name || '')[0]);
        var abbr = norm(p.team && p.team.abbreviation);
        byKey[last + '|' + fi + '|' + abbr] = p.id;
        var k2 = last + '|' + fi;
        if (byKey[k2] == null) byKey[k2] = p.id;
      });
      cursor = res.meta && res.meta.next_cursor;
      pages++;
    } while (cursor && pages < 8);

    var matched = track.map(function (t) {
      var id = byKey[norm(t.last) + '|' + norm(t.fi) + '|' + norm(t.abbr)];
      if (id == null) id = byKey[norm(t.last) + '|' + norm(t.fi)];
      return { t: t, id: id };
    }).filter(function (x) { return x.id != null; });
    if (!matched.length) return [];

    var avg = await getSeasonAverages(season, matched.map(function (m) { return m.id; }), { ttl: 600000 });
    var byId = {};
    (avg.data || []).forEach(function (a) { byId[a.player_id] = a; });
    return matched.map(function (m) {
      var a = byId[m.id];
      if (!a) return null;
      var pts = +a.pts || 0, reb = +a.reb || 0, ast = +a.ast || 0, stl = +a.stl || 0, blk = +a.blk || 0;
      var tov = +(a.turnover != null ? a.turnover : a.tov) || 0;
      return Object.assign({}, m.t, {
        gp: a.games_played != null ? a.games_played : (a.gp || 0),
        min: parseFloat(a.min) || 0,
        pts: pts, reb: reb, ast: ast, stl: stl, blk: blk, tov: tov,
        val: pts + reb + ast + stl + blk - tov,
      });
    }).filter(Boolean);
  }

  // Snapshot every active player's current team: { id: {name, team, abbr} }.
  async function getRosterMap(opts) {
    var map = {};
    var cursor, pages = 0;
    do {
      var res = await getActivePlayers(cursor, 100, opts || { ttl: 600000 });
      (res.data || []).forEach(function (p) {
        map[p.id] = {
          name: ((p.first_name || '') + ' ' + (p.last_name || '')).trim(),
          team: (p.team && p.team.full_name) || (p.team && p.team.abbreviation) || '',
          abbr: (p.team && p.team.abbreviation) || '',
        };
      });
      cursor = res.meta && res.meta.next_cursor;
      pages++;
    } while (cursor && pages < 8);
    return map;
  }

  // Diff a fresh roster map against a stored baseline. Returns detected moves:
  // [{ player, from, to }]. A move = same player id, different team abbreviation.
  function diffRosters(baseline, current) {
    var moves = [];
    Object.keys(current).forEach(function (id) {
      var b = baseline[id], c = current[id];
      if (b && b.abbr && c.abbr && b.abbr !== c.abbr) {
        moves.push({ player: c.name, from: b.team, fromAbbr: b.abbr, to: c.team, toAbbr: c.abbr });
      }
    });
    return moves;
  }

  window.NBAApi = {
    BASE: BASE,
    STARS: STARS,
    getLeaders: getLeaders,
    getRosterMap: getRosterMap,
    diffRosters: diffRosters,
    getKey: getKey, setKey: setKey, clearKey: clearKey, hasKey: hasKey,
    req: req,
    getStandings: getStandings,
    getTeams: getTeams,
    getGamesByDate: getGamesByDate,
    getSeasonAverages: getSeasonAverages,
    getActivePlayers: getActivePlayers,
    currentSeason: currentSeason,
  };
})();
