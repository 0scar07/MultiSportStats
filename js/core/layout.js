// Layout común: sidebar único (drawer en móvil), barra superior móvil, tema y favoritos.
// Cada página declara <body data-page="..."> y llama a initLayout().
import { NAV } from './config.js';
import { esc, icon } from './util.js';
import { prefs, session, profile, favorites } from './store.js';
import { syncFavButtons, toast } from './ui.js';

const BRAND = `
  <a class="brand" href="index.html" aria-label="MultiSport Stats, ir a la portada">
    <span class="brand__mark"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17 7.5 8.5l3.5 6 3.5-7 3.5 9.5"/></svg></span>
    <span>Multi<span>Sport</span> Stats</span>
  </a>`;

const themeLabel = (dark) => (dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');

function themeButton() {
  const dark = prefs.theme === 'dark';
  return `<button type="button" class="btn btn--icon btn--ghost" data-action="theme"
    aria-label="${themeLabel(dark)}">${icon(dark ? 'sun' : 'moon')}</button>`;
}

function themeRow() {
  const dark = prefs.theme === 'dark';
  return `<button type="button" class="btn btn--ghost btn--block sidebar__theme" data-action="theme" data-labelled>
    ${icon(dark ? 'sun' : 'moon')} <span>${dark ? 'Modo claro' : 'Modo oscuro'}</span></button>`;
}

function userBlock() {
  const user = session.get();
  const p = profile.get();
  if (!user) {
    return `<a class="btn btn--primary btn--block" href="login.html">${icon('login')} Iniciar sesión</a>`;
  }
  const name = p.displayName || user.name;
  const avatar = p.avatar
    ? `<img src="${esc(p.avatar)}" alt="">`
    : esc(name.trim().charAt(0).toUpperCase() || '?');
  return `
    <a class="user-chip" href="profile.html">
      <span class="avatar">${avatar}</span>
      <span><span class="user-chip__name">${esc(name)}</span><br><span class="user-chip__sub">Cuenta demo</span></span>
    </a>
    <button type="button" class="btn btn--ghost btn--block" data-action="logout">${icon('logout')} Cerrar sesión</button>`;
}

function sidebar(page) {
  const links = NAV.map((item) => {
    if (item.group) return `<p class="nav__label">${esc(item.group)}</p>`;
    const current = item.page === page ? ' aria-current="page"' : '';
    return `<a class="nav__item" href="${item.href}"${current}>${icon(item.icon)} ${esc(item.label)}</a>`;
  }).join('');
  return `
    <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
      <div class="sidebar__row" style="align-items:center">
        ${BRAND}
        <button type="button" class="btn btn--icon btn--ghost sidebar__close" data-action="close-nav" aria-label="Cerrar menú">${icon('close')}</button>
      </div>
      <nav class="nav">${links}</nav>
      <div class="sidebar__footer">
        ${themeRow()}
        ${userBlock()}
      </div>
    </aside>`;
}

function topbar() {
  return `
    <header class="topbar">
      ${BRAND}
      <div class="topbar__actions">
        ${themeButton()}
        <button type="button" class="btn btn--icon btn--ghost" data-action="open-nav"
          aria-controls="sidebar" aria-expanded="false" aria-label="Abrir menú">${icon('menu')}</button>
      </div>
    </header>`;
}

function setNav(open) {
  document.body.classList.toggle('nav-open', open);
  document.querySelector('[data-action="open-nav"]')?.setAttribute('aria-expanded', String(open));
  if (open) requestAnimationFrame(() => document.querySelector('#sidebar .nav__item')?.focus());
}

function refreshThemeButtons() {
  const dark = prefs.theme === 'dark';
  document.querySelectorAll('[data-action="theme"]').forEach((b) => {
    if (b.hasAttribute('data-labelled')) {
      b.innerHTML = `${icon(dark ? 'sun' : 'moon')} <span>${dark ? 'Modo claro' : 'Modo oscuro'}</span>`;
    } else {
      b.innerHTML = icon(dark ? 'sun' : 'moon');
      b.setAttribute('aria-label', themeLabel(dark));
    }
  });
}

export function initLayout() {
  const page = document.body.dataset.page;
  const main = document.getElementById('main');
  main.insertAdjacentHTML('beforebegin', topbar() + sidebar(page) + '<div class="scrim" data-action="close-nav"></div>');
  document.body.insertAdjacentHTML('beforeend', '<div class="toast-region" role="status" aria-live="polite"></div>');

  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-fav]');
    if (!target) return;

    if (target.dataset.fav) {
      e.preventDefault();
      const item = JSON.parse(target.dataset.fav);
      const added = favorites.toggle(item);
      syncFavButtons();
      toast(added ? `${item.name} añadido a favoritos` : `${item.name} quitado de favoritos`);
      return;
    }
    switch (target.dataset.action) {
      case 'theme':
        prefs.setTheme(prefs.theme === 'dark' ? 'light' : 'dark');
        refreshThemeButtons();
        break;
      case 'open-nav': setNav(true); break;
      case 'close-nav': setNav(false); break;
      case 'logout':
        session.clear();
        location.href = 'login.html?salida=1';
        break;
      default:
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
      setNav(false);
      document.querySelector('[data-action="open-nav"]')?.focus();
    }
  });

  // Mantiene los botones ★ sincronizados si cambian en otra pestaña.
  window.addEventListener('storage', (e) => {
    if (e.key === 'mss.favorites') { syncFavButtons(); document.dispatchEvent(new CustomEvent('mss:favorites')); }
  });
}
