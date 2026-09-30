// Punto único de acceso a datos para las páginas.
// Estrategia: API pública cuando existe (ESPN / Jolpica) y los JSON de data/ como respaldo.
// Cada resultado indica su origen (source: 'api' | 'demo') para mostrar el aviso de demostración.
import { LEAGUES } from './config.js';
import { prefs } from './store.js';
import { espnScoreboard, espnSummary, espnStandings, f1Events, f1Standings } from './api.js';

const memo = new Map();
function once(key, fn) {
  if (!memo.has(key)) memo.set(key, fn().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
}

export function loadJSON(path) {
  return once(path, async () => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
    return res.json();
  });
}

/** Modo demo forzado desde el perfil o con ?demo=1 en la URL. */
export function isDemoMode() {
  return new URLSearchParams(location.search).has('demo') || prefs.dataMode === 'demo';
}

export const getTeams = () => loadJSON('data/teams.json');
export const getNews = () => loadJSON('data/news.json');

// ---------- Partidos demo ----------
// Las fechas del JSON son relativas a hoy (day + time) para que la demo nunca caduque.
function demoDate(day, time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function findTeam(teams, league, id) {
  if (id === 'por-definir') return { id, name: 'Por definir', short: '?', color: '#475569' };
  return teams[league]?.find((t) => t.id === id) || { id, name: id, short: id.slice(0, 3).toUpperCase(), color: '#64748b' };
}

async function demoMatches() {
  const [raw, teams] = await Promise.all([loadJSON('data/matches.json'), getTeams()]);
  return raw.map((m) => {
    const base = {
      ...m,
      sport: LEAGUES[m.league].sport,
      kind: m.kind || 'match',
      date: demoDate(m.day, m.time),
      source: 'demo',
    };
    if (base.kind === 'race') {
      return { ...base, results: (m.results || []).map((r) => ({ ...r, driver: findTeam(teams, 'f1', r.driver) })) };
    }
    return {
      ...base,
      home: { ...findTeam(teams, m.league, m.home.id), score: m.home.score ?? null },
      away: { ...findTeam(teams, m.league, m.away.id), score: m.away.score ?? null },
    };
  });
}

const byDate = (a, b) => new Date(a.date) - new Date(b.date);

/**
 * Todos los partidos/eventos de las ligas configuradas.
 * Devuelve { matches, sources: { [liga]: 'api' | 'demo' } }.
 */
export async function getMatches({ force = false } = {}) {
  const [teams, demo] = await Promise.all([getTeams(), demoMatches()]);
  const demoMode = isDemoMode();

  const results = await Promise.all(Object.values(LEAGUES).map(async (lg) => {
    const fallback = { league: lg.id, source: 'demo', matches: demo.filter((m) => m.league === lg.id) };
    if (demoMode || (!lg.espn && !lg.jolpica)) return fallback;
    try {
      const matches = lg.espn ? await espnScoreboard(lg, teams, force) : await f1Events(teams, force);
      return { league: lg.id, source: 'api', matches };
    } catch (err) {
      console.warn(`[datos] ${lg.name}: API no disponible, se usan datos demo.`, err);
      return fallback;
    }
  }));

  return {
    matches: results.flatMap((r) => r.matches).sort(byDate),
    sources: Object.fromEntries(results.map((r) => [r.league, r.source])),
  };
}

/** Un partido por id, con detalle (eventos y estadísticas) cuando existe. */
export async function getMatch(id) {
  if (id.startsWith('demo-')) {
    return (await demoMatches()).find((m) => m.id === id) || null;
  }
  const espn = /^espn-([a-z]+)-(\d+)$/.exec(id);
  if (espn && LEAGUES[espn[1]]?.espn) {
    return espnSummary(LEAGUES[espn[1]], espn[2], await getTeams());
  }
  if (id.startsWith('f1-')) {
    const { matches } = await getMatches();
    return matches.find((m) => m.id === id) || null;
  }
  return null;
}

/** Clasificación de una liga. Devuelve { rows, season, note, source }. */
export async function getStandings(leagueId) {
  const lg = LEAGUES[leagueId];
  const demo = async () => ({ ...(await loadJSON(`data/standings/${leagueId}.json`)), note: '', source: 'demo' });
  if (isDemoMode()) return demo();
  try {
    const teams = await getTeams();
    if (lg.espn) return { ...(await espnStandings(lg, teams)), source: 'api' };
    if (lg.jolpica) return { ...(await f1Standings(teams)), source: 'api' };
  } catch (err) {
    console.warn(`[datos] Tabla ${lg.name}: API no disponible, se usan datos demo.`, err);
  }
  return demo();
}
