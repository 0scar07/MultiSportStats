import { initLayout } from '../core/layout.js';
import { getTeams } from '../core/data.js';
import { LEAGUES } from '../core/config.js';
import { prefs, session, profile, favorites, leagueKey, clearAll } from '../core/store.js';
import { deleteAccount } from '../core/auth.js';
import { $, esc, icon, norm } from '../core/util.js';
import { crest, favButton, teamFav, toast, emptyState, syncFavButtons } from '../core/ui.js';

initLayout();

const els = {
  account: $('#account'), favList: $('#favList'), chips: $('#leagueChips'),
  filter: $('#teamFilter'), picker: $('#teamPicker'), clear: $('#clearAll'),
};

// ---------- Cuenta ----------
function renderAccount() {
  const user = session.get();
  if (!user) {
    els.account.innerHTML = `
      <p class="muted" style="margin-bottom:var(--space-4)">No has iniciado sesión. Los favoritos y preferencias funcionan igual; la cuenta demo solo añade nombre y avatar.</p>
      <div class="account__actions">
        <a class="btn btn--primary" href="login.html">${icon('login')} Iniciar sesión</a>
        <a class="btn" href="register.html">Crear cuenta demo</a>
      </div>`;
    return;
  }
  const p = profile.get();
  const name = p.displayName || user.name;
  els.account.innerHTML = `
    <div class="account">
      <div class="avatar-edit">
        <span class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}" alt="Tu avatar">` : esc(name.charAt(0).toUpperCase())}</span>
        <input type="file" id="avatarInput" accept="image/*" class="sr-only">
        <label class="btn btn--sm" for="avatarInput">${icon('camera', 'icon--sm')} Cambiar foto</label>
      </div>
      <form id="nameForm">
        <div class="field">
          <label for="displayName">Nombre visible</label>
          <input class="input" id="displayName" name="displayName" value="${esc(name)}" autocomplete="name" required maxlength="40">
        </div>
        <div class="field">
          <label for="accEmail">Correo</label>
          <input class="input" id="accEmail" value="${esc(user.email)}" readonly aria-describedby="accEmailHint">
          <span class="field__hint" id="accEmailHint">Cuenta demo guardada en este navegador.</span>
        </div>
        <div class="account__actions">
          <button type="submit" class="btn btn--primary">${icon('check')} Guardar</button>
          <button type="button" class="btn btn--ghost btn--danger" id="deleteAccount">${icon('trash')} Eliminar cuenta demo</button>
        </div>
      </form>
    </div>`;
}

/** Reduce la imagen a 128 px y la guarda como WebP (o PNG si el navegador no soporta WebP). */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
      const ctx = canvas.getContext('2d');
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      const webp = canvas.toDataURL('image/webp', 0.85);
      resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

els.account.addEventListener('change', async (e) => {
  if (e.target.id !== 'avatarInput' || !e.target.files[0]) return;
  try {
    profile.set({ avatar: await resizeImage(e.target.files[0]) });
    toast('Foto actualizada');
    location.reload();
  } catch {
    toast('No se pudo leer la imagen');
  }
});

els.account.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = e.target.elements.displayName.value.trim();
  if (!value) return;
  profile.set({ displayName: value });
  toast('Nombre guardado');
  setTimeout(() => location.reload(), 600);
});

els.account.addEventListener('click', (e) => {
  if (e.target.closest('#deleteAccount')) {
    if (!confirm('¿Eliminar tu cuenta demo de este navegador? Tus favoritos se mantienen.')) return;
    deleteAccount(session.get().email);
    profile.set({ displayName: '', avatar: '' });
    location.href = 'dashboard.html';
  }
});

// ---------- Preferencias ----------
document.querySelectorAll('input[name="theme"]').forEach((r) => {
  r.checked = r.value === prefs.theme;
  r.addEventListener('change', () => { prefs.setTheme(r.value); location.reload(); });
});
document.querySelectorAll('input[name="dataMode"]').forEach((r) => {
  r.checked = r.value === prefs.dataMode;
  r.addEventListener('change', () => {
    prefs.setDataMode(r.value);
    try { Object.keys(sessionStorage).filter((k) => k.startsWith('mss.cache.')).forEach((k) => sessionStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
    toast(r.value === 'demo' ? 'Usando solo datos de demostración' : 'Usando APIs públicas con respaldo');
  });
});

// ---------- Favoritos ----------
function renderFavs() {
  const favs = favorites.all();
  els.favList.innerHTML = favs.length
    ? `<ul class="team-picker" style="max-height:none">${favs.map((f) => `
        <li>${f.type === 'team' ? crest(f) : icon(LEAGUES[f.league]?.sport || 'trophy')}
          <span class="name">${esc(f.name)} <small class="muted">· ${esc(f.type === 'team' ? LEAGUES[f.league]?.name : 'Liga')}</small></span>
          <button type="button" class="btn btn--icon btn--sm btn--ghost" data-remove="${esc(f.key)}" aria-label="Quitar ${esc(f.name)} de favoritos">${icon('close')}</button>
        </li>`).join('')}</ul>`
    : emptyState({ icon: 'star', title: 'Aún no tienes favoritos', text: 'Elige equipos o deportistas abajo.' });
}

let teams = {};
let league = 'laliga';

function renderPicker() {
  els.chips.innerHTML = Object.values(LEAGUES).map((lg) =>
    `<button type="button" class="chip" data-sport="${lg.sport}" data-league="${lg.id}" aria-pressed="${lg.id === league}">${icon(lg.sport)} ${esc(lg.short)}</button>`).join('');
  const q = norm(els.filter.value.trim());
  const lg = LEAGUES[league];
  const leagueItem = { key: leagueKey(lg.id), type: 'league', league: lg.id, id: lg.id, name: lg.name };
  const list = (teams[league] || []).filter((t) => !q || norm(t.name).includes(q));
  els.picker.innerHTML = `
    <li>${icon(lg.sport)}<span class="name"><strong>Toda la liga: ${esc(lg.name)}</strong></span>${favButton(leagueItem)}</li>
    ${list.map((t) => `<li>${crest(t)}<span class="name">${esc(t.name)}</span>${favButton(teamFav(league, t))}</li>`).join('')}`;
}

els.favList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (btn) favorites.remove(btn.dataset.remove);
});
els.chips.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-league]');
  if (!btn) return;
  league = btn.dataset.league;
  renderPicker();
});
els.filter.addEventListener('input', renderPicker);
document.addEventListener('mss:favorites', () => { renderFavs(); syncFavButtons(); });

// ---------- Borrar datos ----------
els.clear.addEventListener('click', () => {
  if (!confirm('Se borrarán cuentas demo, favoritos y preferencias de este navegador. ¿Continuar?')) return;
  clearAll();
  location.href = 'dashboard.html';
});

renderAccount();
renderFavs();
getTeams().then((t) => { teams = t; renderPicker(); }).catch(() => {
  els.picker.innerHTML = '<li>No se pudo cargar la lista de equipos.</li>';
});
if (location.hash === '#favoritos') document.getElementById('favoritos').focus();
