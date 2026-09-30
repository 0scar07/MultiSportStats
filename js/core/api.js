// Clientes de APIs públicas sin clave, usables desde el navegador (CORS abierto):
//  - ESPN (no oficial, sin documentar): fútbol, NBA y NHL. Puede cambiar sin aviso.
//  - Jolpica F1 (sucesora de Ergast): Fórmula 1.
// Todo se normaliza al mismo formato que los JSON de data/, que actúan como respaldo.
import { slug } from './util.js';

const ESPN = 'https://site.api.espn.com/apis';
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';

/** fetch con tiempo límite y caché corta en sessionStorage. */
export async function fetchJSON(url, { ttl = 60, timeout = 8000, force = false } = {}) {
  const key = `mss.cache.${url}`;
  if (!force && ttl) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(key));
      if (hit && Date.now() - hit.t < ttl * 1000) return hit.d;
    } catch { /* sin caché */ }
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data })); } catch { /* lleno */ }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Equipos ----------
export function resolveTeam(teams, league, raw) {
  const name = raw.displayName || raw.name;
  const id = slug(name);
  const known = teams[league]?.find((t) => t.id === id);
  return known || {
    id, name,
    short: raw.abbreviation || name.slice(0, 3).toUpperCase(),
    color: raw.color ? `#${raw.color}` : '#64748b',
  };
}

// ---------- ESPN: marcadores ----------
function liveClock(sport, status) {
  const type = status.type?.name;
  if (type === 'STATUS_HALFTIME') return 'Descanso';
  if (type === 'STATUS_END_PERIOD') return `Fin ${sport === 'baloncesto' ? 'C' : 'P'}${status.period}`;
  if (sport === 'futbol') return status.displayClock;
  if (sport === 'baloncesto') return `C${status.period} · ${status.displayClock}`;
  if (sport === 'hockey') return `P${status.period} · ${status.displayClock}`;
  return status.type?.shortDetail || '';
}

function finalNote(status) {
  const detail = status.type?.shortDetail || '';
  if (/SO/.test(detail)) return 'Final · Penaltis';
  if (/OT/.test(detail)) return 'Final · Prórroga';
  if (/AET/.test(detail)) return 'Final · Prórroga';
  if (/Pens/.test(detail)) return 'Final · Penaltis';
  return null;
}

export function espnCompetition(eventId, date, comp, lg, teams) {
  const state = comp.status.type.state;
  const status = state === 'in' ? 'live' : state === 'post' ? 'final' : 'upcoming';
  const side = (ha) => {
    const c = comp.competitors.find((x) => x.homeAway === ha);
    const team = resolveTeam(teams, lg.id, c.team);
    return { ...team, espnId: c.team.id, score: status === 'upcoming' ? null : Number(c.score ?? 0) };
  };
  const postponed = comp.status.type.name === 'STATUS_POSTPONED';
  return {
    id: `espn-${lg.id}-${eventId}`,
    league: lg.id, sport: lg.sport, kind: 'match',
    status: postponed ? 'upcoming' : status,
    clock: status === 'live' ? liveClock(lg.sport, comp.status) : null,
    note: postponed ? 'Aplazado' : status === 'final' ? finalNote(comp.status) : null,
    date: date || comp.date,
    home: side('home'), away: side('away'),
    venue: comp.venue?.fullName || '',
    round: '',
    source: 'api',
  };
}

export async function espnScoreboard(lg, teams, force) {
  const data = await fetchJSON(`${ESPN}/site/v2/sports/${lg.espn}/scoreboard`, { ttl: 60, force });
  if (!Array.isArray(data.events)) throw new Error('Formato inesperado');
  return data.events.map((ev) => espnCompetition(ev.id, ev.date, ev.competitions[0], lg, teams));
}

// ---------- ESPN: detalle de partido ----------
const EVENT_TYPES = {
  goal: 'Gol', 'own-goal': 'Autogol', 'penalty---scored': 'Gol de penalti',
  'yellow-card': 'Tarjeta amarilla', 'red-card': 'Tarjeta roja', substitution: 'Cambio',
};
const STAT_LABELS = {
  'Possession': 'Posesión (%)', 'SHOTS': 'Tiros', 'ON GOAL': 'Tiros a puerta', 'Corner Kicks': 'Córners',
  'Fouls': 'Faltas', 'Yellow Cards': 'Amarillas', 'Red Cards': 'Rojas', 'Offsides': 'Fueras de juego',
  'Saves': 'Paradas', 'Passes': 'Pases', 'Accurate Passes': 'Pases precisos',
  'Shots': 'Tiros', 'Hits': 'Golpes', 'Blocked Shots': 'Tiros bloqueados', 'Takeaways': 'Recuperaciones',
  'Power Play Goals': 'Goles en power play', 'Faceoffs Won': 'Faceoffs ganados',
  'Field Goal %': 'Tiros de campo (%)', 'Three Point %': 'Triples (%)', 'Free Throw %': 'Tiros libres (%)',
  'Rebounds': 'Rebotes', 'Assists': 'Asistencias', 'Steals': 'Robos', 'Blocks': 'Tapones', 'Turnovers': 'Pérdidas',
};

function participantsText(k) {
  const names = (k.participants || []).map((p) => p.athlete?.displayName).filter(Boolean);
  if (k.type.type === 'substitution' && names.length === 2) return `Entra ${names[0]} · Sale ${names[1]}`;
  return names.join(', ');
}

export async function espnSummary(lg, eventId, teams) {
  const d = await fetchJSON(`${ESPN}/site/v2/sports/${lg.espn}/summary?event=${eventId}`, { ttl: 30 });
  const comp = d.header.competitions[0];
  const match = espnCompetition(eventId, comp.date, comp, lg, teams);
  if (!match.venue) match.venue = d.gameInfo?.venue?.fullName || '';

  const homeId = match.home.espnId;
  const events = (d.keyEvents || [])
    .filter((k) => EVENT_TYPES[k.type?.type])
    .map((k) => ({
      min: k.clock?.displayValue || '',
      type: k.type.type.includes('goal') || k.type.type.includes('scored') ? 'goal' : k.type.type.includes('yellow') ? 'yellow' : k.type.type.includes('red') ? 'red' : 'sub',
      label: EVENT_TYPES[k.type.type],
      side: k.team?.id === homeId ? 'home' : 'away',
      text: participantsText(k),
    }));

  const byTeam = {};
  (d.boxscore?.teams || []).forEach((t) => { byTeam[t.team.id === homeId ? 'home' : 'away'] = t.statistics || []; });
  const stats = (byTeam.home || [])
    .filter((s) => STAT_LABELS[s.label])
    .map((s) => ({
      label: STAT_LABELS[s.label],
      home: s.displayValue,
      away: (byTeam.away || []).find((x) => x.label === s.label)?.displayValue ?? '-',
    }));
  return { ...match, details: { events, stats } };
}

// ---------- ESPN: clasificaciones ----------
function stat(entry, name) {
  const s = entry.stats.find((x) => x.name === name);
  if (!s) return null;
  return s.value ?? s.displayValue;
}

function espnRows(data, lg, teams) {
  const rows = [];
  for (const group of data.children || [data]) {
    const conf = /East/.test(group.name) ? 'Este' : /West/.test(group.name) ? 'Oeste' : null;
    for (const e of group.standings.entries) {
      const team = resolveTeam(teams, lg.id, e.team);
      const n = (k) => Math.round(Number(stat(e, k) || 0));
      if (lg.sport === 'futbol') {
        rows.push({ rank: n('rank'), team, gp: n('gamesPlayed'), w: n('wins'), d: n('ties'), l: n('losses'), gf: n('pointsFor'), ga: n('pointsAgainst'), pts: n('points') });
      } else if (lg.sport === 'baloncesto') {
        const w = n('wins'); const l = n('losses');
        const streak = e.stats.find((x) => x.name === 'streak')?.displayValue || '';
        rows.push({ team, conf, w, l, pct: w + l ? w / (w + l) : 0, streak });
      } else {
        rows.push({ team, conf, gp: n('gamesPlayed'), w: n('wins'), l: n('losses'), otl: n('otLosses'), pts: n('points'), gf: n('pointsFor'), ga: n('pointsAgainst') });
      }
    }
  }
  if (lg.sport === 'baloncesto') rows.sort((a, b) => b.pct - a.pct);
  if (lg.sport === 'hockey') rows.sort((a, b) => b.pts - a.pts || a.gp - b.gp);
  rows.forEach((r, i) => { if (!r.rank) r.rank = i + 1; });
  return rows;
}

export async function espnStandings(lg, teams) {
  const url = `${ESPN}/v2/sports/${lg.espn}/standings`;
  let data = await fetchJSON(url, { ttl: 600 });
  let rows = espnRows(data, lg, teams);
  let note = '';
  const played = (r) => r.gp ?? (r.w + r.l);
  // Si la temporada actual apenas empieza, se muestra la anterior completa.
  if (!rows.length || Math.max(...rows.map(played)) < 3) {
    const season = Number(data.children?.[0]?.standings?.season || new Date().getFullYear()) - 1;
    data = await fetchJSON(`${url}?season=${season}`, { ttl: 3600 });
    rows = espnRows(data, lg, teams);
    note = 'La temporada actual aún no arranca: se muestra la temporada anterior.';
  }
  const season = data.children?.[0]?.standings?.seasonDisplayName || data.seasons?.[0]?.displayName || '';
  return { rows, season: season.replace(/\s.*$/, ''), note };
}

// ---------- Jolpica F1 ----------
const GP_ES = {
  Australian: 'Australia', Chinese: 'China', Japanese: 'Japón', Bahrain: 'Baréin', 'Saudi Arabian': 'Arabia Saudí',
  Miami: 'Miami', 'Emilia Romagna': 'Emilia-Romaña', Monaco: 'Mónaco', Spanish: 'España', Canadian: 'Canadá',
  Austrian: 'Austria', British: 'Gran Bretaña', Belgian: 'Bélgica', Hungarian: 'Hungría', Dutch: 'Países Bajos',
  Italian: 'Italia', Azerbaijan: 'Azerbaiyán', Singapore: 'Singapur', 'United States': 'Estados Unidos',
  'Mexico City': 'Ciudad de México', 'São Paulo': 'São Paulo', 'Las Vegas': 'Las Vegas', Qatar: 'Catar',
  'Abu Dhabi': 'Abu Dabi', Madrid: 'Madrid', Barcelona: 'Barcelona', Malaysia: 'Malasia', Portuguese: 'Portugal',
};
export function gpName(raw) {
  const m = /^(.*?) Grand Prix(?: in (.*))?$/.exec(raw);
  if (!m) return raw;
  const name = `GP de ${GP_ES[m[1]] || m[1]}`;
  return m[2] ? `${name} (${GP_ES[m[2]] || m[2]})` : name;
}

function driverOf(teams, d) {
  const id = slug(`${d.givenName} ${d.familyName}`);
  return teams.f1?.find((t) => t.id === id) || {
    id, name: `${d.givenName} ${d.familyName}`, short: d.code || d.familyName.slice(0, 3).toUpperCase(), color: '#94a3b8',
  };
}

function raceEvent(race, status, teams) {
  return {
    id: `f1-${race.season}-${race.round}`,
    league: 'f1', sport: 'f1', kind: 'race', status,
    date: `${race.date}T${race.time || '12:00:00Z'}`,
    race: {
      name: gpName(race.raceName),
      circuit: race.Circuit.circuitName,
      place: `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`,
      round: Number(race.round),
    },
    results: (race.Results || []).slice(0, 10).map((r) => ({
      pos: Number(r.position), driver: driverOf(teams, r.Driver), team: r.Constructor.name,
      time: r.Time?.time || r.status, points: Number(r.points),
    })),
    source: 'api',
  };
}

export async function f1Events(teams, force) {
  const [last, next] = await Promise.all([
    fetchJSON(`${JOLPICA}/current/last/results.json`, { ttl: 600, force }),
    fetchJSON(`${JOLPICA}/current/next.json`, { ttl: 600, force }).catch(() => null),
  ]);
  const events = [];
  const lastRace = last.MRData.RaceTable.Races[0];
  if (lastRace) events.push(raceEvent(lastRace, 'final', teams));
  const nextRace = next?.MRData.RaceTable.Races[0];
  if (nextRace) events.push(raceEvent(nextRace, 'upcoming', teams));
  return events;
}

export async function f1Standings(teams) {
  const d = await fetchJSON(`${JOLPICA}/current/driverStandings.json`, { ttl: 600 });
  const list = d.MRData.StandingsTable.StandingsLists[0];
  return {
    season: list.season,
    rows: list.DriverStandings.map((s) => ({
      rank: Number(s.position), team: driverOf(teams, s.Driver),
      constructor: s.Constructors.at(-1)?.name || '', wins: Number(s.wins), pts: Number(s.points),
    })),
    note: '',
  };
}
