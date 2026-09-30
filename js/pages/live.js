import { initLayout } from '../core/layout.js';
import { getMatches, isDemoMode } from '../core/data.js';
import { SPORTS, LEAGUES } from '../core/config.js';
import { $, esc, icon, fmt, norm, debounce } from '../core/util.js';
import { leagueGroups, skeletonRows, emptyState, errorState, flashScores, setBusy } from '../core/ui.js';

initLayout();

const STATUS = [
  { id: 'todos', label: 'Todos' },
  { id: 'live', label: 'En vivo' },
  { id: 'upcoming', label: 'Próximos' },
  { id: 'final', label: 'Finalizados' },
];

const params = new URLSearchParams(location.search);
const filters = {
  sport: SPORTS[params.get('deporte')] ? params.get('deporte') : 'todos',
  status: STATUS.some((s) => s.id === params.get('estado')) ? params.get('estado') : 'todos',
  q: params.get('q') || '',
};

const els = {
  list: $('#list'), sports: $('#sportChips'), status: $('#statusChips'), q: $('#q'),
  count: $('#resultCount'), updated: $('#updated'), refresh: $('#refreshBtn'),
};
els.q.value = filters.q;

let data = null;
let lastUpdate = null;
let scores = new Map();

function haystack(m) {
  const parts = [LEAGUES[m.league].name, SPORTS[m.sport].name];
  if (m.kind === 'race') parts.push(m.race.name, m.race.circuit, ...(m.results || []).map((r) => r.driver.name));
  else parts.push(m.home.name, m.away.name, m.venue);
  return norm(parts.join(' '));
}

function syncUrl() {
  const p = new URLSearchParams();
  if (filters.sport !== 'todos') p.set('deporte', filters.sport);
  if (filters.status !== 'todos') p.set('estado', filters.status);
  if (filters.q) p.set('q', filters.q);
  if (isDemoMode() && new URLSearchParams(location.search).has('demo')) p.set('demo', '1');
  history.replaceState(null, '', p.toString() ? `?${p}` : location.pathname);
}

function renderChips() {
  const all = data?.matches || [];
  const bySport = (s) => all.filter((m) => s === 'todos' || m.sport === s);
  const inSport = bySport(filters.sport);

  els.sports.innerHTML = [{ id: 'todos', name: 'Todos' }, ...Object.values(SPORTS)].map((s) => `
    <button type="button" class="chip" data-sport-filter="${s.id}" ${s.id !== 'todos' ? `data-sport="${s.id}"` : ''} aria-pressed="${filters.sport === s.id}">
      ${s.id !== 'todos' ? icon(s.id) : ''}${esc(s.name)}
      ${data ? `<span class="chip__count">${bySport(s.id).length}</span>` : ''}
    </button>`).join('');

  els.status.innerHTML = STATUS.map((s) => {
    const n = s.id === 'todos' ? inSport.length : inSport.filter((m) => m.status === s.id).length;
    return `<button type="button" class="chip" data-status-filter="${s.id}" aria-pressed="${filters.status === s.id}">
      ${s.id === 'live' ? '<span class="badge badge--live" style="padding:0;background:none" aria-hidden="true"></span>' : ''}${esc(s.label)}
      ${data ? `<span class="chip__count">${n}</span>` : ''}</button>`;
  }).join('');
}

function render() {
  renderChips();
  if (!data) return;
  const q = norm(filters.q.trim());
  const list = data.matches.filter((m) =>
    (filters.sport === 'todos' || m.sport === filters.sport) &&
    (filters.status === 'todos' || m.status === filters.status) &&
    (!q || haystack(m).includes(q)));

  els.count.textContent = `${list.length} ${list.length === 1 ? 'partido' : 'partidos'}`;
  if (!list.length) {
    const reset = '<button type="button" class="btn" data-action="reset">Quitar filtros</button>';
    els.list.innerHTML = filters.status === 'live' && !q
      ? emptyState({ icon: 'live', title: 'No hay partidos en vivo ahora', text: 'Prueba con los próximos o los finalizados.', action: reset })
      : emptyState({ icon: 'search', title: 'Sin resultados', text: q ? `No encontramos partidos para «${esc(filters.q)}».` : 'No hay partidos con estos filtros.', action: reset });
    return;
  }
  els.list.innerHTML = leagueGroups(list, data.sources);
  scores = flashScores(els.list, scores);
}

function renderUpdated() {
  if (!lastUpdate) return;
  els.updated.innerHTML = `${icon('clock', 'icon--sm')} Actualizado ${fmt.ago(lastUpdate)}`;
}

async function load({ force = false } = {}) {
  setBusy(els.list, true);
  els.refresh.disabled = true;
  if (!data) els.list.innerHTML = skeletonRows(6);
  try {
    data = await getMatches({ force });
    lastUpdate = Date.now();
    render();
    renderUpdated();
  } catch (err) {
    console.error(err);
    if (!data) els.list.innerHTML = errorState();
  } finally {
    setBusy(els.list, false);
    els.refresh.disabled = false;
  }
}

// ---------- Eventos ----------
els.sports.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-sport-filter]');
  if (!btn) return;
  filters.sport = btn.dataset.sportFilter;
  syncUrl(); render();
});
els.status.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-status-filter]');
  if (!btn) return;
  filters.status = btn.dataset.statusFilter;
  syncUrl(); render();
});
els.q.addEventListener('input', debounce(() => { filters.q = els.q.value; syncUrl(); render(); }, 150));
els.refresh.addEventListener('click', () => load({ force: true }));
els.list.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="retry"]')) load({ force: true });
  if (e.target.closest('[data-action="reset"]')) {
    Object.assign(filters, { sport: 'todos', status: 'todos', q: '' });
    els.q.value = '';
    syncUrl(); render();
  }
});

renderChips();
load();

setInterval(renderUpdated, 15000);
setInterval(() => {
  const hasLive = data?.matches.some((m) => m.status === 'live' && m.source === 'api');
  if (!document.hidden && hasLive) load({ force: true });
}, 60000);
