import { initLayout } from '../core/layout.js';
import { getMatches, getStandings, isDemoMode } from '../core/data.js';
import { LEAGUES } from '../core/config.js';
import { favorites } from '../core/store.js';
import { $, esc, icon, fmt, capitalize } from '../core/util.js';
import {
  leagueGroups, skeletonRows, emptyState, errorState, demoBadge, apiBadge, crest,
  sortableTable, flashScores, setBusy,
} from '../core/ui.js';

initLayout();

const els = {
  today: $('#today'), source: $('#sourceNote'),
  live: $('#liveList'), upcoming: $('#upcomingList'), recent: $('#recentList'),
  favSection: $('#favMatchesSection'), favMatches: $('#favMatches'), favChips: $('#favChips'),
  miniTabs: $('#miniTabs'), mini: $('#miniTable'), miniLink: $('#miniLink'),
};
els.today.textContent = capitalize(fmt.longDate(new Date()));

let data = { matches: [], sources: {} };
let scores = new Map();

// ---------- Favoritos ----------
function isFavMatch(m, favs) {
  return favs.some((f) => {
    if (f.league !== m.league) return false;
    if (f.type === 'league') return true;
    if (m.kind === 'race') return m.results?.some((r) => r.driver.id === f.id);
    return m.home.id === f.id || m.away.id === f.id;
  });
}

function renderFavChips() {
  const favs = favorites.all();
  if (!favs.length) {
    els.favChips.innerHTML = `<p class="fav-empty">Aún no tienes favoritos. Márcalos con ${icon('star', 'icon--sm')} en las <a href="standings.html">tablas</a> o en el <a href="search.html">buscador</a>.</p>`;
    return;
  }
  els.favChips.innerHTML = favs.map((f) => `
    <span class="fav-chip">
      ${f.type === 'team' ? crest(f) : icon(LEAGUES[f.league]?.sport || 'trophy')}
      ${esc(f.name)}
      <button type="button" class="btn btn--icon btn--ghost" data-remove="${esc(f.key)}" aria-label="Quitar ${esc(f.name)} de favoritos">${icon('close')}</button>
    </span>`).join('');
}

els.favChips.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  favorites.remove(btn.dataset.remove);
});

function renderFavMatches() {
  const favs = favorites.all();
  const order = { live: 0, upcoming: 1, final: 2 };
  const list = data.matches
    .filter((m) => isFavMatch(m, favs))
    .sort((a, b) => order[a.status] - order[b.status] || new Date(a.date) - new Date(b.date))
    .slice(0, 6);
  els.favSection.hidden = !favs.length;
  els.favMatches.innerHTML = list.length
    ? leagueGroups(list, data.sources)
    : emptyState({ icon: 'star', title: 'Sin partidos de tus favoritos', text: 'Cuando jueguen, aparecerán aquí primero.' });
}

document.addEventListener('mss:favorites', () => { renderFavChips(); renderFavMatches(); });

// ---------- Partidos ----------
function renderMatches() {
  const { matches, sources } = data;
  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches.filter((m) => m.status === 'upcoming').slice(0, 8);
  const recent = matches.filter((m) => m.status === 'final').reverse().slice(0, 6);

  els.live.innerHTML = live.length
    ? leagueGroups(live, sources)
    : emptyState({ icon: 'live', title: 'No hay partidos en vivo ahora', text: 'Revisa los próximos partidos más abajo.' });
  els.upcoming.innerHTML = upcoming.length
    ? leagueGroups(upcoming, sources)
    : emptyState({ icon: 'calendar', title: 'No hay partidos programados' });
  els.recent.innerHTML = recent.length
    ? leagueGroups(recent, sources)
    : emptyState({ icon: 'trophy', title: 'Aún no hay resultados' });

  const allDemo = Object.values(sources).every((s) => s === 'demo');
  els.source.innerHTML = allDemo ? demoBadge() : apiBadge('Datos en directo');
  renderFavMatches();
  scores = flashScores(document.getElementById('main'), scores);
}

async function loadMatches({ force = false } = {}) {
  try {
    data = await getMatches({ force });
    renderMatches();
  } catch (err) {
    console.error(err);
    const html = errorState();
    els.live.innerHTML = html;
    els.upcoming.innerHTML = '';
    els.recent.innerHTML = '';
  } finally {
    [els.live, els.upcoming, els.recent].forEach((el) => setBusy(el, false));
  }
}

// ---------- Mini clasificación ----------
const MINI = ['laliga', 'premier', 'nba', 'nhl', 'f1'];
let miniLeague = 'laliga';

function miniColumns(lg) {
  const team = { key: 'team', label: lg.sport === 'f1' ? 'Piloto' : 'Equipo', left: true, sortable: false,
    render: (r) => `<span class="team-cell">${crest(r.team)} ${esc(r.team.name)}</span>` };
  const rank = { key: 'rank', label: '#', sortable: false, render: (r) => `<span class="rank">${r.rank}</span>` };
  if (lg.sport === 'baloncesto') {
    return [rank, team, { key: 'w', label: 'G', title: 'Ganados', sortable: false },
      { key: 'pct', label: '%', title: 'Porcentaje de victorias', strong: true, sortable: false, render: (r) => r.pct.toFixed(3).replace(/^0/, '') }];
  }
  return [rank, team, { key: 'pts', label: 'Pts', title: 'Puntos', strong: true, sortable: false }];
}

async function renderMini() {
  const lg = LEAGUES[miniLeague];
  els.miniLink.href = `standings.html?liga=${lg.id}`;
  els.mini.innerHTML = `<div style="padding:0 var(--space-4) var(--space-4)">${'<span class="skeleton" style="height:18px;margin-top:10px"></span>'.repeat(5)}</div>`;
  setBusy(els.mini, true);
  try {
    const st = await getStandings(lg.id);
    const rows = [...st.rows].sort((a, b) => a.rank - b.rank).slice(0, 6);
    els.mini.replaceChildren(sortableTable({ columns: miniColumns(lg), rows, caption: `Clasificación de ${lg.name}, primeros puestos` }));
  } catch {
    els.mini.innerHTML = errorState({ title: 'No se pudo cargar la tabla' });
  } finally {
    setBusy(els.mini, false);
  }
}

els.miniTabs.innerHTML = MINI.map((id) => `<button type="button" class="chip" data-sport="${LEAGUES[id].sport}" data-league="${id}" aria-pressed="${id === miniLeague}">${esc(LEAGUES[id].short)}</button>`).join('');
els.miniTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-league]');
  if (!btn || btn.dataset.league === miniLeague) return;
  miniLeague = btn.dataset.league;
  els.miniTabs.querySelectorAll('[data-league]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  renderMini();
});
els.mini.addEventListener('click', (e) => { if (e.target.closest('[data-action="retry"]')) renderMini(); });

// ---------- Inicio ----------
document.getElementById('main').addEventListener('click', (e) => {
  if (e.target.closest('#liveList [data-action="retry"]')) loadMatches({ force: true });
});

[els.live, els.upcoming, els.recent].forEach((el) => { el.innerHTML = skeletonRows(3); setBusy(el, true); });
renderFavChips();
loadMatches();
renderMini();

// Actualiza marcadores cada minuto si hay partidos en vivo con datos reales.
setInterval(() => {
  const hasLive = data.matches.some((m) => m.status === 'live' && m.source === 'api');
  if (!document.hidden && hasLive && !isDemoMode()) loadMatches({ force: true });
}, 60000);
