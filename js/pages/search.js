import { initLayout } from '../core/layout.js';
import { getTeams, getMatches, getNews } from '../core/data.js';
import { LEAGUES } from '../core/config.js';
import { $, esc, icon, norm, debounce } from '../core/util.js';
import { crest, sportTag, favButton, teamFav, matchRow, emptyState, errorState, setBusy } from '../core/ui.js';

initLayout();

const TYPES = [
  { id: 'todo', label: 'Todo' },
  { id: 'equipos', label: 'Equipos y deportistas' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'noticias', label: 'Noticias' },
];
const SUGGESTIONS = ['Barcelona', 'Arsenal', 'Lakers', 'Maple Leafs', 'Alcaraz', 'Verstappen'];

const params = new URLSearchParams(location.search);
const state = { q: params.get('q') || '', type: 'todo' };
const els = {
  form: $('#searchForm'), q: $('#q'), types: $('#typeChips'), sugg: $('#suggestions'),
  results: $('#results'), count: $('#resultCount'),
};
els.q.value = state.q;

let index = null;

async function buildIndex() {
  const [teams, { matches }, news] = await Promise.all([getTeams(), getMatches(), getNews()]);
  const people = Object.entries(teams).flatMap(([league, list]) =>
    list.map((t) => ({ league, team: t, text: norm(`${t.name} ${t.short} ${LEAGUES[league].name}`) })));
  return {
    teams: people,
    matches: matches.map((m) => ({
      m,
      text: norm(m.kind === 'race'
        ? `${m.race.name} ${m.race.circuit} ${(m.results || []).map((r) => r.driver.name).join(' ')}`
        : `${m.home.name} ${m.away.name} ${LEAGUES[m.league].name}`),
    })),
    news: news.map((n) => ({ n, text: norm(`${n.title} ${n.summary}`) })),
  };
}

function highlight(text, q) {
  const i = norm(text).indexOf(q);
  if (i < 0 || !q) return esc(text);
  return `${esc(text.slice(0, i))}<mark>${esc(text.slice(i, i + q.length))}</mark>${esc(text.slice(i + q.length))}`;
}

function teamResult({ league, team }, q) {
  const lg = LEAGUES[league];
  const kind = lg.sport === 'f1' ? 'Piloto' : lg.sport === 'tenis' ? 'Tenista' : 'Equipo';
  return `<li class="result">
    ${crest(team)}
    <span class="result__main">
      <a href="standings.html?liga=${league}&amp;equipo=${encodeURIComponent(team.id)}">${highlight(team.name, q)}</a>
      <small>${kind} · ${esc(lg.name)}</small>
    </span>
    ${favButton(teamFav(league, team))}
  </li>`;
}

function newsResult({ n }, q) {
  return `<li class="result">
    <span class="crest" style="--c:var(--surface-3);--crest-text:var(--text)" aria-hidden="true">${icon('news', 'icon--sm')}</span>
    <span class="result__main">
      <a href="news.html?id=${encodeURIComponent(n.id)}">${highlight(n.title, q)}</a>
      <small>${sportTag(n.sport)}</small>
    </span>
  </li>`;
}

function section(title, count, body) {
  return `<section class="section fade-in"><div class="section-header"><h2>${esc(title)} <span class="chip__count">${count}</span></h2></div>${body}</section>`;
}

function renderTypes(counts) {
  els.types.innerHTML = TYPES.map((t) => `
    <button type="button" class="chip" data-type="${t.id}" aria-pressed="${state.type === t.id}">
      ${esc(t.label)}${counts ? ` <span class="chip__count">${counts[t.id]}</span>` : ''}</button>`).join('');
}

function render() {
  const q = norm(state.q.trim());
  els.sugg.innerHTML = q.length < 2
    ? `<span>Prueba con:</span>${SUGGESTIONS.map((s) => `<button type="button" class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}`
    : '';
  if (q.length < 2) {
    renderTypes(null);
    els.count.textContent = '';
    els.results.innerHTML = emptyState({ icon: 'search', title: 'Escribe al menos 2 letras', text: 'Buscamos en equipos, deportistas, partidos y noticias.' });
    return;
  }
  const teams = index.teams.filter((x) => x.text.includes(q));
  const matches = index.matches.filter((x) => x.text.includes(q));
  const news = index.news.filter((x) => x.text.includes(q));
  const total = teams.length + matches.length + news.length;
  renderTypes({ todo: total, equipos: teams.length, partidos: matches.length, noticias: news.length });
  els.count.textContent = `${total} resultados para ${state.q}`;

  const show = (t) => state.type === 'todo' || state.type === t;
  const parts = [];
  if (show('equipos') && teams.length) {
    parts.push(section('Equipos y deportistas', teams.length, `<ul class="card result-list">${teams.slice(0, 20).map((t) => teamResult(t, q)).join('')}</ul>`));
  }
  if (show('partidos') && matches.length) {
    parts.push(section('Partidos', matches.length, `<div class="card league-group">${matches.slice(0, 12).map((x) => matchRow(x.m)).join('')}</div>`));
  }
  if (show('noticias') && news.length) {
    parts.push(section('Noticias', news.length, `<ul class="card result-list">${news.map((n) => newsResult(n, q)).join('')}</ul>`));
  }
  els.results.innerHTML = parts.join('') || emptyState({ icon: 'search', title: 'Sin resultados', text: `No encontramos nada para «${esc(state.q)}».` });
}

function syncUrl() {
  history.replaceState(null, '', state.q ? `?q=${encodeURIComponent(state.q)}` : location.pathname);
}

const onInput = debounce(() => { state.q = els.q.value; syncUrl(); if (index) render(); }, 150);
els.q.addEventListener('input', onInput);
els.form.addEventListener('submit', (e) => { e.preventDefault(); state.q = els.q.value; syncUrl(); if (index) render(); });
els.types.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-type]');
  if (!btn) return;
  state.type = btn.dataset.type;
  render();
});
els.sugg.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-suggest]');
  if (!btn) return;
  els.q.value = state.q = btn.dataset.suggest;
  syncUrl(); render(); els.q.focus();
});
els.results.addEventListener('click', (e) => { if (e.target.closest('[data-action="retry"]')) load(); });

async function load() {
  setBusy(els.results, true);
  els.results.innerHTML = '<div class="card card--pad" aria-hidden="true"><span class="skeleton" style="height:18px;width:60%"></span></div>';
  try {
    index = await buildIndex();
    render();
  } catch (err) {
    console.error(err);
    els.results.innerHTML = errorState();
  } finally {
    setBusy(els.results, false);
  }
}

renderTypes(null);
load();
