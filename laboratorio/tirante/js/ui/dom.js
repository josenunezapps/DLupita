// Utilidades de interfaz: selección de elementos, formato de números e íconos.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const nf = (digits) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const cache = new Map();
export const num = (v, digits = 0) => { if (!cache.has(digits)) cache.set(digits, nf(digits)); return cache.get(digits).format(Object.is(v, -0) ? 0 : v); };
export const signed = (v, digits = 0) => (Math.abs(v) < 0.5 * 10 ** -digits ? '0' : (v > 0 ? '+' : '−') + num(Math.abs(v), digits));
export const pct = (u) => (Number.isFinite(u) ? num(u * 100, 0) + ' %' : '∞');
export const kg = (v) => (v >= 10000 ? num(v / 1000, 1) + ' t' : num(v, 0) + ' kg');
export const money = (v) => 'USD ' + num(v, 0);

/** Convierte "12,5" o "12.5" en número; null si no es válido. */
export function parseNum(text) {
  const t = String(text).trim().replace(/\s/g, '').replace(',', '.');
  if (!/^[-+−]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t.replace('−', '-'));
  return Number.isFinite(v) ? v : null;
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isCompact = () => matchMedia('(max-width: 900px)').matches;
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

export function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'estructura';

const ICONS = {
  select: '<path d="M6 3l12 9-5.5 1.2L15.5 20l-2.6 1.1-3-6.7L6 18z"/>',
  node: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  member: '<path d="M6.5 17.5l11-11"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="5" r="2.4"/>',
  support: '<path d="M12 5l6 10H6z"/><path d="M4 19h16M7 19l-2 3M12 19l-2 3M17 19l-2 3"/>',
  load: '<path d="M12 3v15M6 12l6 6 6-6"/><path d="M5 21h14"/>',
  erase: '<path d="M4 16l9-11 7 6-8 10H7z"/><path d="M9 10l7 6M12 21h9"/>',
  undo: '<path d="M8 5L3 10l5 5"/><path d="M3 10h11a6 6 0 010 12h-3"/>',
  redo: '<path d="M16 5l5 5-5 5"/><path d="M21 10H10a6 6 0 000 12h3"/>',
  theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 000-16z" fill="currentColor"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 115 0c0 1.8-2.5 2-2.5 4M12 17v.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  magnet: '<path d="M3 3h6M3 9h6M15 3h6M15 9h6"/><path d="M3 3v9a9 9 0 0018 0V3h-6v9a3 3 0 01-6 0V3z"/>',
  fit: '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/><path d="M8 8h8v8H8z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  pause: '<path d="M7 4v16M17 4v16"/>',
  inspect: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  table: '<path d="M3 5h18v14H3zM3 10h18M3 15h18M9 5v14"/>',
  calc: '<path d="M4 20l5-9 4 5 3-6 4 10z"/><path d="M4 4v16h16"/>',
  folder: '<path d="M3 6h7l2 3h9v10H3z"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  copy: '<path d="M8 8h12v12H8z"/><path d="M16 8V4H4v12h4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
export function hydrateIcons(root = document) { $$('i[data-icon]', root).forEach((el) => { el.innerHTML = icon(el.dataset.icon); }); }
