// Piezas de interfaz reutilizables: escudos, badges, filas de partido, estados y tablas.
import { esc, icon, textOn, fmt } from './util.js';
import { LEAGUES, SPORTS, DEMO_TEXT } from './config.js';
import { favorites, teamKey } from './store.js';

// ---------- Escudos (monograma con el color del equipo) ----------
export function crest(team, size = 'sm') {
  const color = team?.color || '#64748b';
  return `<span class="crest crest--${size}" style="--c:${esc(color)};--crest-text:${textOn(color)}" aria-hidden="true">${esc(team?.short || '?')}</span>`;
}

// ---------- Badges ----------
export function statusBadge(match) {
  if (match.status === 'live') return '<span class="badge badge--live">En vivo</span>';
  if (match.status === 'final') return '<span class="badge badge--final">Final</span>';
  return '<span class="badge badge--upcoming">Próximo</span>';
}

export function demoBadge() {
  return `<span class="badge badge--demo" title="${esc(DEMO_TEXT)}">${icon('database', 'icon--sm')} <span class="badge__label">Datos de demostración</span></span>`;
}

export function apiBadge(label = 'En directo') {
  return `<span class="badge badge--api" title="Datos obtenidos de una API pública">${icon('live', 'icon--sm')} ${esc(label)}</span>`;
}

export function sourceBadge(source) {
  return source === 'api' ? apiBadge() : demoBadge();
}

export function sportTag(sportId, text) {
  return `<span class="sport-tag" data-sport="${sportId}">${icon(sportId, 'icon--sm')} ${esc(text ?? SPORTS[sportId]?.name)}</span>`;
}

// ---------- Partidos ----------
function statusCell(m) {
  if (m.status === 'live') {
    return `${statusBadge(m)}<span class="match__clock">${esc(m.clock || '')}</span>`;
  }
  if (m.status === 'final') {
    return `${statusBadge(m)}<span>${esc(m.note || fmt.day(m.date))}</span>`;
  }
  return `<span class="num"><strong>${fmt.time(m.date)}</strong></span><span>${esc(fmt.day(m.date))}</span>`;
}

function matchLabel(m) {
  if (m.kind === 'race') return `${m.race.name}, ${m.status === 'final' ? 'finalizada' : 'próxima'}`;
  if (m.status === 'upcoming') return `${m.home.name} contra ${m.away.name}, ${fmt.day(m.date)} a las ${fmt.time(m.date)}`;
  const state = m.status === 'live' ? `en vivo, ${m.clock || ''}` : 'final';
  return `${m.home.name} ${m.home.score}, ${m.away.name} ${m.away.score}, ${state}`;
}

function teamLine(team, m, side) {
  const other = side === 'home' ? m.away : m.home;
  const decided = m.status === 'final' && team.score != null && other.score != null && team.score !== other.score;
  const cls = decided ? (team.score > other.score ? 'is-winner' : 'is-loser') : '';
  return `<span class="team-line ${cls}">${crest(team)}<span class="team-line__name">${esc(team.name)}</span></span>`;
}

export function matchRow(m) {
  const href = `match.html?id=${encodeURIComponent(m.id)}`;
  if (m.kind === 'race') {
    const winner = m.results?.[0];
    return `
      <a class="match" href="${href}" data-id="${esc(m.id)}" aria-label="${esc(matchLabel(m))}">
        <span class="match__status">${statusCell(m)}</span>
        <span class="match__race">
          <strong>${esc(m.race.name)}</strong>
          <span>${esc(m.race.circuit)}${winner ? ` · Ganador: ${esc(winner.driver.name)}` : ''}</span>
        </span>
        <span class="match__scores">${winner ? crest(winner.driver) : icon('flag')}</span>
      </a>`;
  }
  const scores = m.status === 'upcoming'
    ? ''
    : `<span class="score" data-score="home">${esc(m.home.score)}</span><span class="score" data-score="away">${esc(m.away.score)}</span>`;
  return `
    <a class="match ${m.status === 'live' ? 'match--live' : ''}" href="${href}" data-id="${esc(m.id)}" aria-label="${esc(matchLabel(m))}">
      <span class="match__status">${statusCell(m)}</span>
      <span class="match__teams">${teamLine(m.home, m, 'home')}${teamLine(m.away, m, 'away')}</span>
      <span class="match__scores">${scores}</span>
    </a>`;
}

/** Agrupa partidos por liga, en el orden de LEAGUES. */
export function leagueGroups(matches, sources = {}) {
  return Object.values(LEAGUES)
    .map((lg) => ({ lg, items: matches.filter((m) => m.league === lg.id) }))
    .filter((g) => g.items.length)
    .map(({ lg, items }) => {
      const live = items.filter((m) => m.status === 'live').length;
      return `
        <section class="card league-group fade-in" data-sport="${lg.sport}" aria-label="${esc(lg.name)}">
          <header class="league-group__header">
            ${icon(lg.sport)}
            <h3>${esc(lg.name)}</h3>
            ${live ? `<span class="badge badge--live">${live} en vivo</span>` : ''}
            ${sources[lg.id] ? sourceBadge(sources[lg.id]) : ''}
          </header>
          ${items.map(matchRow).join('')}
        </section>`;
    })
    .join('');
}

/**
 * Anima los marcadores que cambiaron respecto al render anterior.
 * Recibe el mapa previo y devuelve el nuevo (clave: id de partido + lado).
 */
export function flashScores(root, prev = new Map()) {
  const next = new Map();
  root.querySelectorAll('[data-id] [data-score]').forEach((el) => {
    const key = `${el.closest('[data-id]').dataset.id}:${el.dataset.score}`;
    next.set(key, el.textContent);
    if (prev.has(key) && prev.get(key) !== el.textContent) el.classList.add('score--flash');
  });
  return next;
}

// ---------- Estados ----------
export function skeletonRows(n = 4) {
  const row = `<div class="skeleton-row"><span class="skeleton" style="height:14px"></span><span><span class="skeleton" style="height:14px;width:70%;margin-bottom:8px"></span><span class="skeleton" style="height:14px;width:55%"></span></span><span class="skeleton" style="height:28px"></span></div>`;
  return `<div class="card" aria-hidden="true">${row.repeat(n)}</div>`;
}

export function skeletonCards(n = 3, height = 220) {
  return `<div class="grid grid--cards" aria-hidden="true">${`<div class="card skeleton" style="height:${height}px"></div>`.repeat(n)}</div>`;
}

export function emptyState({ icon: ic = 'search', title, text = '', action = '' }) {
  return `<div class="state fade-in">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${action}</div>`;
}

export function errorState({ title = 'No pudimos cargar los datos', text = 'Revisa tu conexión e inténtalo de nuevo.' } = {}) {
  return `<div class="state state--error fade-in" role="alert">${icon('alert')}<h3>${esc(title)}</h3><p>${esc(text)}</p>
    <button class="btn" type="button" data-action="retry">${icon('refresh')} Reintentar</button></div>`;
}

/** Marca un contenedor como ocupado para lectores de pantalla mientras carga. */
export function setBusy(el, busy) {
  el.setAttribute('aria-busy', String(busy));
}

// ---------- Favoritos ----------
export function teamFav(league, team) {
  return {
    key: teamKey(league, team.id), type: 'team', league,
    id: team.id, name: team.name, short: team.short, color: team.color,
  };
}

export function favButton(item) {
  const on = favorites.has(item.key);
  return `<button type="button" class="fav-btn" data-fav="${esc(JSON.stringify(item))}" aria-pressed="${on}"
    aria-label="${on ? 'Quitar' : 'Añadir'} ${esc(item.name)} ${on ? 'de' : 'a'} favoritos">${icon('star')}</button>`;
}

/** Sincroniza todos los botones de favorito visibles con el estado guardado. */
export function syncFavButtons(root = document) {
  root.querySelectorAll('[data-fav]').forEach((btn) => {
    const item = JSON.parse(btn.dataset.fav);
    const on = favorites.has(item.key);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${on ? 'Quitar' : 'Añadir'} ${item.name} ${on ? 'de' : 'a'} favoritos`);
  });
}

// ---------- Toast ----------
export function toast(message) {
  const region = document.querySelector('.toast-region');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.append(el);
  setTimeout(() => el.remove(), 2800);
}

// ---------- Tabla ordenable ----------
/**
 * columns: [{ key, label, title?, left?, sortable?, value?(row), render?(row), desc? }]
 * Devuelve un <table> con cabeceras clicables (aria-sort) que reordenan las filas.
 */
export function sortableTable({ columns, rows, caption, sort = null, rowAttrs = () => '' }) {
  const table = document.createElement('table');
  table.className = 'data-table';
  let state = sort ? { ...sort } : null;
  const val = (col, row) => (col.value ? col.value(row) : row[col.key]);

  function sorted() {
    if (!state) return rows;
    const col = columns.find((c) => c.key === state.key);
    const dir = state.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = val(col, a); const y = val(col, b);
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), 'es') * dir;
      return ((x ?? -Infinity) - (y ?? -Infinity)) * dir;
    });
  }

  function render() {
    table.innerHTML = `
      ${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ''}
      <thead><tr>${columns.map((c) => {
        const active = state && state.key === c.key;
        const ariaSort = active ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none';
        const inner = c.sortable === false
          ? `<span${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}</span>`
          : `<button type="button" class="sort-btn" data-key="${c.key}"${c.title ? ` title="${esc(c.title)}"` : ''}>${esc(c.label)}${icon(active ? (state.dir === 'asc' ? 'sort-asc' : 'sort-desc') : 'sort')}</button>`;
        return `<th scope="col" class="${c.left ? 'is-left' : ''}" ${c.sortable === false ? '' : `aria-sort="${ariaSort}"`}>${inner}${c.title ? `<span class="sr-only"> (${esc(c.title)})</span>` : ''}</th>`;
      }).join('')}</tr></thead>
      <tbody>${sorted().map((r) => `<tr ${rowAttrs(r)}>${columns.map((c) =>
        `<td class="${c.left ? 'is-left' : ''} ${c.strong ? 'strong' : ''}">${c.render ? c.render(r) : esc(val(c, r))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  }

  table.addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;
    const key = btn.dataset.key;
    const col = columns.find((c) => c.key === key);
    const first = col.desc ? 'desc' : 'asc';
    state = state && state.key === key
      ? { key, dir: state.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: first };
    render();
    table.querySelector(`.sort-btn[data-key="${key}"]`)?.focus();
  });

  render();
  return table;
}
