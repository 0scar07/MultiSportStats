import { initLayout } from '../core/layout.js';
import { getStandings, getMatches } from '../core/data.js';
import { LEAGUES } from '../core/config.js';
import { favorites, leagueKey, teamKey } from '../core/store.js';
import { $, esc, icon } from '../core/util.js';
import {
  sortableTable, crest, favButton, teamFav, sourceBadge, errorState, emptyState,
  matchRow, setBusy, syncFavButtons,
} from '../core/ui.js';

initLayout();

const ORDER = ['laliga', 'premier', 'nba', 'rolandgarros', 'nhl', 'f1'];
const params = new URLSearchParams(location.search);
let current = ORDER.includes(params.get('liga')) ? params.get('liga') : 'laliga';
const target = params.get('equipo');
let conf = 'todas';

const els = {
  tabs: $('#leagueTabs'), panel: $('#panel'), title: $('#leagueTitle'), meta: $('#leagueMeta'),
  actions: $('#leagueActions'), conf: $('#confFilter'), area: $('#tableArea'),
};

// ---------- Columnas por deporte ----------
const num = (key, label, title, extra = {}) => ({ key, label, title, desc: true, ...extra });

function columns(lg) {
  const fav = { key: 'fav', label: '', sortable: false, render: (r) => favButton(teamFav(lg.id, r.team)) };
  const rank = { key: 'rank', label: '#', title: 'Posición', render: (r) => `<span class="rank">${r.rank}</span>` };
  const team = {
    key: 'name', label: lg.sport === 'f1' ? 'Piloto' : 'Equipo', left: true, value: (r) => r.team.name,
    render: (r) => `<span class="team-cell">${crest(r.team)} ${esc(r.team.name)}</span>`,
  };
  switch (lg.sport) {
    case 'futbol':
      return [rank, fav, team,
        num('gp', 'PJ', 'Partidos jugados'), num('w', 'G', 'Ganados'), num('d', 'E', 'Empatados'),
        num('l', 'P', 'Perdidos'), num('gf', 'GF', 'Goles a favor'), num('ga', 'GC', 'Goles en contra'),
        num('gd', 'DG', 'Diferencia de goles', { value: (r) => r.gf - r.ga, render: (r) => { const d = r.gf - r.ga; return d > 0 ? `+${d}` : d; } }),
        num('pts', 'Pts', 'Puntos', { strong: true })];
    case 'baloncesto':
      return [rank, fav, team, { key: 'conf', label: 'Conf.', title: 'Conferencia' },
        num('w', 'G', 'Ganados'), num('l', 'P', 'Perdidos'),
        num('pct', '%', 'Porcentaje de victorias', { strong: true, render: (r) => r.pct.toFixed(3).replace(/^0/, '') }),
        { key: 'streak', label: 'Racha', title: 'Racha actual', sortable: false, render: streak }];
    case 'hockey':
      return [rank, fav, team, { key: 'conf', label: 'Conf.', title: 'Conferencia' },
        num('gp', 'PJ', 'Partidos jugados'), num('w', 'G', 'Ganados'), num('l', 'P', 'Perdidos'),
        num('otl', 'PR', 'Derrotas en prórroga o penaltis'), num('gf', 'GF', 'Goles a favor'),
        num('ga', 'GC', 'Goles en contra'), num('pts', 'Pts', 'Puntos', { strong: true })];
    default: // f1
      return [rank, fav, team, { key: 'constructor', label: 'Escudería', left: true },
        num('wins', 'Vict.', 'Victorias'), num('pts', 'Pts', 'Puntos', { strong: true })];
  }
}

function streak(r) {
  const s = r.streak || '';
  const cls = s.startsWith('W') ? 'streak-w' : s.startsWith('L') ? 'streak-l' : '';
  const txt = s.replace(/^W/, 'G').replace(/^L/, 'P');
  return `<span class="${cls}">${esc(txt || '—')}</span>`;
}

function zoneClass(lg, r, total) {
  if (lg.sport !== 'futbol') return '';
  if (r.rank <= 4) return 'zone-ucl';
  if (r.rank <= 6) return 'zone-uel';
  if (r.rank > total - 3) return 'zone-rel';
  return '';
}

const LEGEND = `<div class="legend">
  <span><i style="background:var(--success)"></i> Liga de Campeones</span>
  <span><i style="background:var(--sport-hockey)"></i> Competiciones europeas</span>
  <span><i style="background:var(--danger)"></i> Descenso</span></div>`;

// ---------- Render ----------
function renderTabs() {
  els.tabs.innerHTML = ORDER.map((id) => {
    const lg = LEAGUES[id];
    const sel = id === current;
    return `<button type="button" class="tab" role="tab" id="tab-${id}" data-league="${id}" data-sport="${lg.sport}"
      aria-selected="${sel}" aria-controls="panel" tabindex="${sel ? 0 : -1}">${icon(lg.sport)} ${esc(lg.short)}</button>`;
  }).join('');
  els.panel.setAttribute('aria-labelledby', `tab-${current}`);
  els.panel.dataset.sport = LEAGUES[current].sport;
}

function renderHeader(lg, info) {
  els.title.textContent = lg.id === 'rolandgarros' ? 'Roland Garros · Cuadro masculino' : lg.name;
  const parts = [];
  if (info?.season) parts.push(`Temporada ${esc(info.season)}`);
  if (info?.note) parts.push(esc(info.note));
  els.meta.innerHTML = parts.join(' · ');
  const favItem = { key: leagueKey(lg.id), type: 'league', league: lg.id, id: lg.id, name: lg.name };
  els.actions.innerHTML = `${info ? sourceBadge(info.source) : ''}
    <span class="chip" style="padding-right:4px">Seguir liga ${favButton(favItem)}</span>`;
}

function renderConf(rows) {
  const hasConf = rows.some((r) => r.conf);
  els.conf.hidden = !hasConf;
  if (!hasConf) return;
  els.conf.querySelector('.chips').innerHTML = ['todas', 'Este', 'Oeste'].map((c) =>
    `<button type="button" class="chip" data-conf="${c}" aria-pressed="${conf === c}">${c === 'todas' ? 'Todas' : `Conferencia ${c}`}</button>`).join('');
}

async function renderTable(lg) {
  const info = await getStandings(lg.id);
  renderHeader(lg, info);
  renderConf(info.rows);
  const rows = conf === 'todas' ? info.rows : info.rows.filter((r) => r.conf === conf);
  if (!rows.length) {
    els.area.innerHTML = emptyState({ icon: 'table', title: 'Sin datos de clasificación' });
    return;
  }
  const table = sortableTable({
    columns: columns(lg),
    rows,
    caption: `Clasificación de ${lg.name}`,
    sort: { key: 'rank', dir: 'asc' },
    rowAttrs: (r) => {
      const cls = [zoneClass(lg, r, info.rows.length), favorites.has(teamKey(lg.id, r.team.id)) ? 'is-fav' : '', r.team.id === target ? 'is-target' : ''];
      return `class="${cls.join(' ').trim()}" data-team="${esc(r.team.id)}"`;
    },
  });
  const card = document.createElement('div');
  card.className = 'card standings-card fade-in';
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  wrap.append(table);
  card.append(wrap);
  els.area.replaceChildren(card);
  if (lg.sport === 'futbol') els.area.insertAdjacentHTML('beforeend', LEGEND);
  if (target) els.area.querySelector(`tr[data-team="${CSS.escape(target)}"]`)?.scrollIntoView({ block: 'center' });
}

async function renderBracket(lg) {
  renderHeader(lg, { source: 'demo', season: '', note: '' });
  els.conf.hidden = true;
  const { matches } = await getMatches();
  const rg = matches.filter((m) => m.league === 'rolandgarros');
  const rounds = ['Cuartos de final', 'Semifinal', 'Final'];
  els.area.innerHTML = `<div class="bracket fade-in">${rounds.map((round) => `
    <section class="card league-group" data-sport="tenis" aria-label="${round}">
      <h3>${round}</h3>
      ${rg.filter((m) => m.round === round).map((m) => `${matchRow(m)}${m.sets ? `<div class="sets" aria-label="Sets">${m.sets.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}`).join('')}
    </section>`).join('')}</div>`;
}

async function show(id, { focus = false } = {}) {
  current = id;
  conf = 'todas';
  renderTabs();
  if (focus) document.getElementById(`tab-${id}`)?.focus();
  const url = new URL(location);
  url.searchParams.set('liga', id);
  history.replaceState(null, '', url);
  const lg = LEAGUES[id];
  els.area.innerHTML = `<div class="card card--pad" aria-hidden="true">${'<span class="skeleton" style="height:22px;margin:10px 0"></span>'.repeat(8)}</div>`;
  setBusy(els.area, true);
  try {
    if (lg.id === 'rolandgarros') await renderBracket(lg);
    else await renderTable(lg);
  } catch (err) {
    console.error(err);
    els.area.innerHTML = errorState({ title: 'No pudimos cargar la clasificación' });
  } finally {
    setBusy(els.area, false);
  }
}

// ---------- Eventos ----------
els.tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-league]');
  if (tab && tab.dataset.league !== current) show(tab.dataset.league);
});
els.tabs.addEventListener('keydown', (e) => {
  const i = ORDER.indexOf(current);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ORDER.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  show(ORDER[(next + ORDER.length) % ORDER.length], { focus: true });
});
els.conf.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-conf]');
  if (!btn) return;
  conf = btn.dataset.conf;
  renderTable(LEAGUES[current]);
});
els.area.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="retry"]')) show(current);
});
document.addEventListener('mss:favorites', () => {
  syncFavButtons();
  els.area.querySelectorAll('tr[data-team]').forEach((tr) =>
    tr.classList.toggle('is-fav', favorites.has(teamKey(current, tr.dataset.team))));
});

show(current);
