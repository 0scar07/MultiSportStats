// Utilidades compartidas: DOM, escape de HTML, íconos y formato de fechas en español.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapa texto para insertarlo de forma segura en plantillas HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Referencia a un ícono del sprite SVG. */
export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="assets/icons.svg#${name}"></use></svg>`;
}

export function slug(text) {
  return String(text)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/** Normaliza texto para búsquedas sin tildes ni mayúsculas. */
export function norm(text) {
  return String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Color de texto legible (claro u oscuro) sobre un color de fondo hex. */
export function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.45 ? '#0b0f17' : '#fff';
}

// ---------- Fechas ----------
const LOCALE = 'es';
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const fmt = {
  time: (d) => new Date(d).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }),
  date: (d, opts = { day: 'numeric', month: 'short' }) => new Date(d).toLocaleDateString(LOCALE, opts),
  longDate: (d) => new Date(d).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }),
  /** "Hoy", "Mañana", "Ayer" o fecha corta. */
  day(d) {
    const diff = Math.round((startOfDay(new Date(d)) - startOfDay(new Date())) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff === -1) return 'Ayer';
    return fmt.date(d, { weekday: 'short', day: 'numeric', month: 'short' });
  },
  /** "hace 5 min", "hace 2 h", "hace 3 días". */
  ago(d) {
    const s = Math.round((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    const days = Math.floor(s / 86400);
    return days === 1 ? 'hace 1 día' : `hace ${days} días`;
  },
};

export function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
