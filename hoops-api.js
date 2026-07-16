/*
 * hoops-api.js — Basket Atlas multi-league client (API-BASKETBALL via proxy)
 * --------------------------------------------------------------------------
 * Talks to the production proxy (proxy/hoops-proxy.js), which hides the
 * api-sports key server-side. If HOOPS_PROXY_BASE is empty the client reports
 * `configured() === false` and every page keeps its verified static fallback —
 * nothing breaks before the proxy is live.
 *
 * Exposes window.HoopsApi. Responses are normalized to the shapes the pages
 * already use ({ name, team, league, pos, nat, pts, reb, ast, val, ... }).
 * NOTE: api-basketball's exact field names can vary per league/plan; the
 * normalizers below read defensively and should be checked against live JSON
 * once the proxy returns real data (see mapPlayer / mapStanding).
 */
(function () {
  function proxyBase() { try { return (typeof window !== 'undefined' && window.HOOPS_PROXY_BASE) || ''; } catch (e) { return ''; } }
  function configured() { return !!proxyBase(); }

  // The 17 Basket Atlas leagues → the search term api-basketball indexes them by.
  // League ids are resolved at runtime from /leagues (ids differ per provider),
  // then cached, so we never ship brittle hard-coded ids.
  var LEAGUES = {
    nba: 'NBA', euro: 'Euroleague', acb: 'Spain', lba: 'Italy', bbl: 'Germany',
    gbl: 'Greece', lnb: 'France', bsl: 'Turkey', aba: 'Adriatic', vtb: 'VTB',
    bcl: 'Champions League', eurocup: 'Eurocup', nbl: 'Australia', bleague: 'Japan',
    cba: 'China', kbl: 'South-Korea', pba: 'Philippines',
  };

  var cache = {};
  function ck(path, params) { return path + '?' + JSON.stringify(params || {}); }

  async function req(path, params, opts) {
    opts = opts || {};
    var base = proxyBase();
    if (!base) { var e = new Error('Proxy not configured'); e.code = 'NO_PROXY'; throw e; }
    var key = ck(path, params);
    if (!opts.fresh && cache[key] && (Date.now() - cache[key].t) < (opts.ttl || 60000)) return cache[key].v;

    var url = new URL(base.replace(/\/$/, '') + path);
    Object.keys(params || {}).forEach(function (k) { if (params[k] != null) url.searchParams.set(k, params[k]); });

    var res;
    try { res = await fetch(url.toString(), { headers: { Accept: 'application/json' } }); }
    catch (netErr) { var ne = new Error('Network/CORS error: ' + netErr.message); ne.code = 'NETWORK'; throw ne; }
    if (res.status === 429) { var r = new Error('Rate limit exceeded'); r.code = 'RATE'; throw r; }
    if (!res.ok) { var h = new Error('HTTP ' + res.status); h.code = 'HTTP_' + res.status; throw h; }
    var body = await res.json();
    var json = body && body.response ? body.response : body; // unwrap api-sports envelope
    cache[key] = { t: Date.now(), v: json };
    return json;
  }

  // Season string api-basketball expects, e.g. "2025-2026". League year flips in October.
  function currentSeason(now) {
    now = now || new Date();
    var y = now.getUTCFullYear();
    var start = now.getUTCMonth() >= 9 ? y : y - 1;
    return start + '-' + (start + 1);
  }

  // Resolve a Basket Atlas league key (e.g. 'acb') → api-basketball league id, cached.
  var leagueIdCache = {};
  async function resolveLeagueId(key) {
    if (leagueIdCache[key] != null) return leagueIdCache[key];
    var term = LEAGUES[key] || key;
    var list = await req('/leagues', { search: term }, { ttl: 86400000 });
    // Prefer an exact-ish name match; else first result.
    var norm = function (s) { return (s || '').toString().toLowerCase(); };
    var want = norm(term);
    var pick = (list || []).find(function (l) { return norm(l.name).indexOf(want) !== -1; }) || (list || [])[0];
    var id = pick && (pick.id || (pick.league && pick.league.id));
    leagueIdCache[key] = id != null ? id : null;
    return leagueIdCache[key];
  }

  // ---- Normalizers (defensive: check against live JSON, adjust as needed) ----
  function mapPlayer(item) {
    var p = item.player || item;
    var st = (item.statistics && item.statistics[0]) || item.statistics || {};
    var games = st.games || {};
    var pts = num(st.points || (st.points && st.points.total));
    return {
      id: p.id, name: p.name || ((p.firstname || '') + ' ' + (p.lastname || '')).trim(),
      team: (st.team && st.team.name) || (item.team && item.team.name) || '',
      league: (st.league && st.league.name) || '',
      pos: p.position || (st.position) || '',
      nat: p.country || p.birth && p.birth.country || '',
      num: p.number || p.jersey || '',
      photo: p.image || p.photo || '',
      pts: pts, reb: num(st.rebounds && st.rebounds.total), ast: num(st.assists),
      raw: item,
    };
  }
  function mapStanding(row) {
    var t = row.team || {};
    return {
      rank: row.position || row.rank, team: t.name || '', abbr: t.code || '',
      logo: t.logo || '', wins: (row.games && row.games.win && row.games.win.total) || row.win,
      losses: (row.games && row.games.lose && row.games.lose.total) || row.lose,
      raw: row,
    };
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  // ---- Public calls ----------------------------------------------------------
  // Real-time player search across a league (name/team). Returns mapped players.
  async function searchPlayers(query, leagueKey, opts) {
    var season = (opts && opts.season) || currentSeason();
    var params = { search: query, season: season };
    if (leagueKey) { var id = await resolveLeagueId(leagueKey); if (id != null) params.league = id; }
    var list = await req('/players', params, opts);
    return (list || []).map(mapPlayer);
  }
  async function getStandings(leagueKey, opts) {
    var season = (opts && opts.season) || currentSeason();
    var id = await resolveLeagueId(leagueKey);
    if (id == null) return [];
    var list = await req('/standings', { league: id, season: season }, opts);
    // api-basketball nests standings as [[...rows]]
    var rows = Array.isArray(list && list[0]) ? list[0] : list;
    return (rows || []).map(mapStanding);
  }
  async function getPlayer(id, opts) {
    var season = (opts && opts.season) || currentSeason();
    var list = await req('/players', { id: id, season: season }, opts);
    return (list || []).map(mapPlayer)[0] || null;
  }
  async function getLeagues(opts) { return req('/leagues', {}, opts || { ttl: 86400000 }); }

  // Health check for the environment screen: is the proxy reachable + keyed?
  async function ping() {
    if (!configured()) return { ok: false, reason: 'not-configured' };
    try { var s = await req('/seasons', {}, { ttl: 60000, fresh: true }); return { ok: true, seasons: Array.isArray(s) ? s.length : 0 }; }
    catch (e) { return { ok: false, reason: e.code || 'error', message: e.message }; }
  }

  window.HoopsApi = {
    LEAGUES: LEAGUES,
    configured: configured, proxyBase: proxyBase,
    currentSeason: currentSeason, resolveLeagueId: resolveLeagueId,
    searchPlayers: searchPlayers, getStandings: getStandings, getPlayer: getPlayer,
    getLeagues: getLeagues, ping: ping, req: req,
  };
})();
