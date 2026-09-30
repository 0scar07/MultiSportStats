import { initLayout } from '../core/layout.js';
import { getMatches } from '../core/data.js';
import { SPORTS, LEAGUES } from '../core/config.js';
import { $, esc, icon, fmt, norm, debounce } from '../core/util.js';
import { crest, sportTag, sourceBadge, skeletonCards, emptyState, errorState, setBusy } from '../core/ui.js';

initLayout();

const filters = { sport: 'todos', q: '' };
const els = { list: $('#list'), chips: $('#sportChips'), q: $('#q'), count: $('#resultCount') };
let finals = [];

function title(m) {
  return m.kind === 'race' ? m.race.name : `${m.home.name} ${m.home.score}–${m.away.score} ${m.away.name}`;
}

function youtube(m) {
  const lg = LEAGUES[m.league];
  const q = m.kind === 'race' ? `${m.race.name} F1 resumen carrera` : `${m.home.name} vs ${m.away.name} ${lg.name} resumen`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function thumb(m) {
  if (m.kind === 'race') {
    const podium = (m.results || []).slice(0, 3);
    return podium.length ? podium.map((r) => crest(r.driver, 'lg')).join('') : icon('f1', 'icon--lg');
  }
  return `${crest(m.home, 'lg')}<strong>${m.home.score} – ${m.away.score}</strong>${crest(m.away, 'lg')}`;
}

function card(m) {
  const lg = LEAGUES[m.league];
  return `
    <a class="card card--hover hl-card fade-in" href="${youtube(m)}" target="_blank" rel="noopener"
       data-sport="${lg.sport}" aria-label="Resumen de ${esc(title(m))} en YouTube (se abre en una pestaña nueva)">
      <div class="hl-thumb" aria-hidden="true">${thumb(m)}<span class="hl-thumb__play">${icon('play')}</span></div>
      <div class="hl-card__body">
        <span style="display:flex;justify-content:space-between;gap:8px;align-items:center">${sportTag(lg.sport, lg.name)}${sourceBadge(m.source)}</span>
        <h2>${esc(title(m))}</h2>
        <p>${icon('calendar', 'icon--sm')} ${esc(fmt.day(m.date))} · ${icon('external', 'icon--sm')} YouTube</p>
      </div>
    </a>`;
}

function render() {
  els.chips.innerHTML = [{ id: 'todos', name: 'Todos' }, ...Object.values(SPORTS)].map((s) => `
    <button type="button" class="chip" data-filter="${s.id}" ${s.id !== 'todos' ? `data-sport="${s.id}"` : ''} aria-pressed="${filters.sport === s.id}">
      ${s.id !== 'todos' ? icon(s.id) : ''}${esc(s.name)}</button>`).join('');
  const q = norm(filters.q.trim());
  const list = finals.filter((m) =>
    (filters.sport === 'todos' || m.sport === filters.sport) &&
    (!q || norm(`${title(m)} ${LEAGUES[m.league].name}`).includes(q)));
  els.count.textContent = `${list.length} resúmenes`;
  els.list.innerHTML = list.length
    ? `<div class="grid grid--cards">${list.map(card).join('')}</div>`
    : emptyState({ icon: 'play', title: 'No hay resúmenes', text: 'Aparecerán aquí cuando terminen los partidos.' });
}

async function load() {
  setBusy(els.list, true);
  els.list.innerHTML = skeletonCards(6);
  try {
    const { matches } = await getMatches();
    finals = matches.filter((m) => m.status === 'final').reverse();
    render();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = errorState();
  } finally {
    setBusy(els.list, false);
  }
}

els.chips.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  filters.sport = btn.dataset.filter;
  render();
});
els.q.addEventListener('input', debounce(() => { filters.q = els.q.value; render(); }, 150));
els.list.addEventListener('click', (e) => { if (e.target.closest('[data-action="retry"]')) load(); });

load();
