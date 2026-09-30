import { initLayout } from '../core/layout.js';
import { getMatch } from '../core/data.js';
import { LEAGUES } from '../core/config.js';
import { $, esc, icon, fmt, capitalize } from '../core/util.js';
import {
  crest, statusBadge, sourceBadge, sportTag, favButton, teamFav, emptyState, errorState,
  sortableTable, setBusy, flashScores,
} from '../core/ui.js';

initLayout();

const area = $('#matchArea');
const id = new URLSearchParams(location.search).get('id');
let match = null;
let tab = 'resumen';
let scores = new Map();

function youtubeLink(m) {
  const q = m.kind === 'race' ? `${m.race.name} Fórmula 1 resumen` : `${m.home.name} vs ${m.away.name} resumen`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// ---------- Cabecera ----------
function heroTeam(team, lg) {
  const fav = team.id !== 'por-definir' ? favButton(teamFav(lg.id, team)) : '';
  return `<div class="hero__team">${crest(team, 'lg')}<h2>${esc(team.name)}</h2>${fav}</div>`;
}

function hero(m) {
  const lg = LEAGUES[m.league];
  const meta = `
    <div class="hero__meta">
      ${sportTag(lg.sport, lg.name)}
      ${m.round ? `<span>${esc(m.round)}</span>` : ''}
      ${statusBadge(m)}
      ${sourceBadge(m.source)}
    </div>`;
  const info = `
    <div class="hero__info">
      <span>${icon('calendar', 'icon--sm')} ${esc(capitalize(fmt.longDate(m.date)))} · ${fmt.time(m.date)}</span>
      ${m.venue ? `<span>${icon('pin', 'icon--sm')} ${esc(m.venue)}</span>` : ''}
      ${m.kind === 'race' ? `<span>${icon('pin', 'icon--sm')} ${esc(m.race.circuit)} · ${esc(m.race.place)}</span>` : ''}
    </div>`;

  if (m.kind === 'race') {
    return `<section class="card hero" data-sport="f1" aria-label="${esc(m.race.name)}">${meta}
      <div class="hero__team">${crest({ short: 'F1', color: '#e11d48' }, 'lg')}<h2 style="font-size:var(--fs-xl)">${esc(m.race.name)}</h2>
      <span class="muted">Ronda ${m.race.round}</span></div>${info}</section>`;
  }

  const center = m.status === 'upcoming'
    ? `<span class="hero__vs">vs</span><span class="muted">${fmt.day(m.date)} · ${fmt.time(m.date)}</span>`
    : `<strong><span data-score="home">${m.home.score}</span> – <span data-score="away">${m.away.score}</span></strong>
       ${m.status === 'live' ? `<span class="match__clock">${esc(m.clock || '')}</span>` : `<span class="muted">${esc(m.note || 'Final')}</span>`}`;
  return `
    <section class="card hero ${m.status === 'live' ? 'is-live' : ''}" data-id="${esc(m.id)}" data-sport="${lg.sport}"
      aria-label="${esc(`${m.home.name} contra ${m.away.name}`)}">
      ${meta}
      <div class="hero__board">
        ${heroTeam(m.home, lg)}
        <div class="hero__score" aria-live="polite">${center}</div>
        ${heroTeam(m.away, lg)}
      </div>
      ${m.sets ? `<div class="hero__info">${m.sets.map((s, i) => `<span class="badge badge--final">Set ${i + 1}: ${esc(s)}</span>`).join('')}</div>` : ''}
      ${info}
    </section>`;
}

// ---------- Contenido ----------
function timeline(m) {
  const events = m.details?.events || [];
  if (!events.length) {
    return emptyState({ icon: 'clock', title: m.status === 'upcoming' ? 'El partido aún no ha empezado' : 'Sin eventos registrados',
      text: m.status === 'upcoming' ? 'Aquí verás goles, tarjetas y cambios en cuanto empiece.' : 'Esta fuente no ofrece la cronología de este partido.' });
  }
  return `<ol class="timeline">${events.map((ev) => `
    <li data-side="${ev.side}">
      <span class="timeline__min">${esc(ev.min)}</span>
      <span class="timeline__ev"><span class="ev-dot ev-${ev.type}" aria-hidden="true"></span>
        <span>${esc(ev.label)} · ${esc(ev.side === 'home' ? m.home.name : m.away.name)}${ev.text ? `<small>${esc(ev.text)}</small>` : ''}</span></span>
    </li>`).join('')}</ol>`;
}

function stats(m) {
  const list = m.details?.stats || [];
  if (!list.length) return emptyState({ icon: 'table', title: 'Sin estadísticas', text: 'Esta fuente no ofrece estadísticas para este partido.' });
  return list.map((s) => {
    const h = parseFloat(s.home) || 0;
    const a = parseFloat(s.away) || 0;
    const pct = h + a ? (h / (h + a)) * 100 : 50;
    return `<div class="stat">
      <div class="stat__row"><strong>${esc(s.home)}</strong><span>${esc(s.label)}</span><strong>${esc(s.away)}</strong></div>
      <div class="stat__bar" aria-hidden="true"><i style="width:${pct}%"></i><i style="width:${100 - pct}%"></i></div>
    </div>`;
  }).join('');
}

function raceResults(m) {
  if (!m.results?.length) {
    return emptyState({ icon: 'flag', title: 'Carrera pendiente', text: `Se disputa el ${esc(fmt.longDate(m.date))} a las ${fmt.time(m.date)}.` });
  }
  const table = sortableTable({
    caption: `Resultados de ${m.race.name}`,
    rows: m.results,
    sort: { key: 'pos', dir: 'asc' },
    columns: [
      { key: 'pos', label: 'Pos.', title: 'Posición', render: (r) => `<span class="rank">${r.pos}</span>` },
      { key: 'name', label: 'Piloto', left: true, value: (r) => r.driver.name, render: (r) => `<span class="team-cell">${crest(r.driver)} ${esc(r.driver.name)}</span>` },
      { key: 'team', label: 'Escudería', left: true },
      { key: 'time', label: 'Tiempo', sortable: false },
      { key: 'points', label: 'Pts', title: 'Puntos', desc: true, strong: true },
    ],
  });
  const card = document.createElement('div');
  card.className = 'card table-wrap';
  card.append(table);
  return card;
}

function render() {
  const m = match;
  document.title = `${m.kind === 'race' ? m.race.name : `${m.home.name} vs ${m.away.name}`} · MultiSport Stats`;
  area.innerHTML = hero(m);

  if (m.kind === 'race') {
    area.insertAdjacentHTML('beforeend', '<h2 style="margin-bottom:var(--space-3)">Resultados</h2>');
    const res = raceResults(m);
    if (typeof res === 'string') area.insertAdjacentHTML('beforeend', res); else area.append(res);
  } else {
    area.insertAdjacentHTML('beforeend', `
      <div class="tabs" role="tablist" aria-label="Detalle del partido">
        <button type="button" class="tab" role="tab" id="tab-resumen" data-tab="resumen" aria-selected="${tab === 'resumen'}" aria-controls="matchPanel">Cronología</button>
        <button type="button" class="tab" role="tab" id="tab-stats" data-tab="stats" aria-selected="${tab === 'stats'}" aria-controls="matchPanel">Estadísticas</button>
      </div>
      <section class="card fade-in" id="matchPanel" role="tabpanel" aria-labelledby="tab-${tab === 'stats' ? 'stats' : 'resumen'}">
        ${tab === 'stats' ? stats(m) : timeline(m)}
      </section>`);
  }
  if (m.status === 'final') {
    area.insertAdjacentHTML('beforeend', `<p style="margin-top:var(--space-4)"><a class="btn" href="${youtubeLink(m)}" target="_blank" rel="noopener">${icon('play')} Buscar el resumen en YouTube ${icon('external', 'icon--sm')}</a></p>`);
  }
  scores = flashScores(area, scores);
}

async function load() {
  if (!id) {
    area.innerHTML = emptyState({ icon: 'search', title: 'No se indicó ningún partido', action: '<a class="btn" href="live.html">Ver partidos</a>' });
    return;
  }
  setBusy(area, true);
  if (!match) area.innerHTML = `<div class="card skeleton" style="height:260px;margin-bottom:var(--space-5)" aria-hidden="true"></div>`;
  try {
    const m = await getMatch(id);
    if (!m) {
      area.innerHTML = emptyState({ icon: 'search', title: 'Partido no encontrado', text: 'Puede que ya no esté disponible en la fuente de datos.', action: '<a class="btn" href="live.html">Ver partidos</a>' });
      return;
    }
    match = m;
    render();
  } catch (err) {
    console.error(err);
    if (!match) area.innerHTML = errorState({ title: 'No pudimos cargar el partido' });
  } finally {
    setBusy(area, false);
  }
}

area.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { tab = t.dataset.tab; render(); document.getElementById(`tab-${tab}`)?.focus(); }
  if (e.target.closest('[data-action="retry"]')) load();
});

load();
setInterval(() => {
  if (!document.hidden && match?.status === 'live' && match.source === 'api') load();
}, 60000);
