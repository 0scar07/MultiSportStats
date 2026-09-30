import { initLayout } from '../core/layout.js';
import { getNews } from '../core/data.js';
import { SPORTS, DEMO_TEXT } from '../core/config.js';
import { $, esc, icon, fmt, norm, debounce } from '../core/util.js';
import { sportTag, demoBadge, skeletonCards, emptyState, errorState, setBusy } from '../core/ui.js';

initLayout();

const params = new URLSearchParams(location.search);
const filters = { sport: SPORTS[params.get('deporte')] ? params.get('deporte') : 'todos', q: params.get('q') || '' };
const els = {
  list: $('#newsList'), chips: $('#sportChips'), q: $('#q'), count: $('#resultCount'),
  dialog: $('#newsDialog'), dialogContent: $('#dialogContent'), source: $('#sourceNote'),
};
els.q.value = filters.q;
els.source.innerHTML = demoBadge();

let news = [];

const dateOf = (n) => new Date(Date.now() - n.hoursAgo * 3600000);

function media(n, eager = false) {
  if (!n.image) return `<div class="news-art" data-sport="${n.sport}">${icon(n.sport)}</div>`;
  return `<img src="${esc(n.image)}" alt="${esc(n.alt)}" width="800" height="450" ${eager ? '' : 'loading="lazy"'} decoding="async">`;
}

function card(n, featured) {
  const Title = featured ? 'h2' : 'h3';
  return `
    <article class="card card--hover news-card ${featured ? 'news-card--featured' : ''} fade-in">
      <div class="news-card__media">${media(n, featured)}</div>
      <div class="news-card__body">
        ${sportTag(n.sport)}
        <${Title}>${esc(n.title)}</${Title}>
        <p>${esc(n.summary)}</p>
        <div class="news-card__foot">
          <span>${fmt.ago(dateOf(n))}</span>
          <button type="button" class="btn btn--sm" data-open="${esc(n.id)}" aria-label="Leer: ${esc(n.title)}">Leer ${icon('chevron-right', 'icon--sm')}</button>
        </div>
      </div>
    </article>`;
}

function renderChips() {
  els.chips.innerHTML = [{ id: 'todos', name: 'Todas' }, ...Object.values(SPORTS)].map((s) => `
    <button type="button" class="chip" data-filter="${s.id}" ${s.id !== 'todos' ? `data-sport="${s.id}"` : ''} aria-pressed="${filters.sport === s.id}">
      ${s.id !== 'todos' ? icon(s.id) : ''}${esc(s.name)}</button>`).join('');
}

function render() {
  renderChips();
  const q = norm(filters.q.trim());
  const list = news.filter((n) =>
    (filters.sport === 'todos' || n.sport === filters.sport) &&
    (!q || norm(`${n.title} ${n.summary} ${n.body.join(' ')}`).includes(q)));
  els.count.textContent = `${list.length} ${list.length === 1 ? 'noticia' : 'noticias'}`;
  if (!list.length) {
    els.list.innerHTML = emptyState({ icon: 'news', title: 'No hay noticias', text: q ? `Nada coincide con «${esc(filters.q)}».` : 'Prueba con otro deporte.' });
    return;
  }
  const showFeatured = filters.sport === 'todos' && !q;
  els.list.innerHTML = `<div class="news-grid">${list.map((n) => card(n, showFeatured && n.featured)).join('')}</div>`;
}

function openNews(id) {
  const n = news.find((x) => x.id === id);
  if (!n) return;
  els.dialogContent.innerHTML = `
    <div class="dialog__media">${media(n, true)}</div>
    <div class="dialog__body">
      ${sportTag(n.sport)}
      <h2 id="dialogTitle">${esc(n.title)}</h2>
      ${n.body.map((p) => `<p>${esc(p)}</p>`).join('')}
      <p class="notice">${icon('database')} <span>${esc(DEMO_TEXT)} Artículo escrito para la demo de MultiSport Stats.</span></p>
    </div>`;
  els.dialog.showModal();
}

els.chips.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  filters.sport = btn.dataset.filter;
  render();
});
els.q.addEventListener('input', debounce(() => { filters.q = els.q.value; render(); }, 150));
els.list.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-open]');
  if (btn) openNews(btn.dataset.open);
  if (e.target.closest('[data-action="retry"]')) load();
});
els.dialog.addEventListener('click', (e) => {
  if (e.target === els.dialog || e.target.closest('[data-close]')) els.dialog.close();
});

async function load() {
  setBusy(els.list, true);
  els.list.innerHTML = skeletonCards(4, 280);
  try {
    news = await getNews();
    render();
    if (params.get('id')) openNews(params.get('id'));
  } catch (err) {
    console.error(err);
    els.list.innerHTML = errorState({ title: 'No pudimos cargar las noticias' });
  } finally {
    setBusy(els.list, false);
  }
}

renderChips();
load();
