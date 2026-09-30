// Persistencia local (localStorage) con claves prefijadas "mss.".
// Todo vive solo en este navegador: no hay servidor.

const PREFIX = 'mss.';

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* sin almacenamiento */ }
}

/** Borra todos los datos de la app en este navegador. */
export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch { /* sin almacenamiento */ }
}

// ---------- Preferencias ----------
export const prefs = {
  get theme() { return read('theme', 'dark') === 'light' ? 'light' : 'dark'; },
  setTheme(theme) {
    write('theme', theme);
    document.documentElement.dataset.theme = theme;
    document.dispatchEvent(new CustomEvent('mss:theme', { detail: theme }));
  },
  /** 'auto' = API con respaldo JSON · 'demo' = siempre datos de demostración. */
  get dataMode() { return read('dataMode', 'auto') === 'demo' ? 'demo' : 'auto'; },
  setDataMode(mode) { write('dataMode', mode); },
};

// ---------- Favoritos ----------
// Cada favorito: { key, type: 'team' | 'league', league, id, name, short, color }
export const favorites = {
  all() { return read('favorites', []); },
  has(key) { return this.all().some((f) => f.key === key); },
  toggle(item) {
    const list = this.all();
    const i = list.findIndex((f) => f.key === item.key);
    if (i >= 0) list.splice(i, 1); else list.push(item);
    write('favorites', list);
    document.dispatchEvent(new CustomEvent('mss:favorites', { detail: list }));
    return i < 0;
  },
  remove(key) {
    write('favorites', this.all().filter((f) => f.key !== key));
    document.dispatchEvent(new CustomEvent('mss:favorites'));
  },
};

export const teamKey = (league, id) => `team:${league}:${id}`;
export const leagueKey = (league) => `league:${league}`;

// ---------- Sesión demo ----------
export const session = {
  get() { return read('session', null); },
  set(user) { write('session', { name: user.name, email: user.email, since: Date.now() }); },
  clear() { remove('session'); },
};

// ---------- Perfil (nombre visible y avatar) ----------
export const profile = {
  get() { return read('profile', {}); },
  set(data) { write('profile', { ...this.get(), ...data }); },
};
