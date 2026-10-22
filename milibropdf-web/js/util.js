// Utilidades de interfaz y formato.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function icon(name, cls = '') { return `<svg class="${cls}"><use href="#i-${name}"/></svg>`; }
export function uid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }

export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

// ---------- Formato ----------
export function fmtDuration(ms, short = false) {
  const min = Math.round((ms || 0) / 60000);
  if (min < 1) return short ? '0 min' : 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
export function fmtSize(bytes) {
  if (!bytes) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
const dtf = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const dtfShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
export function fmtDate(ts) { return ts ? dtf.format(new Date(ts)) : '—'; }
export function fmtRelative(ts) {
  if (!ts) return 'nunca';
  const d = Date.now() - ts;
  const min = Math.floor(d / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return dtfShort.format(new Date(ts));
}
export function pct(p) { return `${Math.round((p || 0) * 100)}%`; }
export function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

export const STATUS_LABEL = { unread: 'Sin empezar', reading: 'Leyendo', finished: 'Terminado' };
export const MARK_COLORS = [
  { c: '#F5D76E', n: 'Amarillo' },
  { c: '#9ED9A0', n: 'Verde' },
  { c: '#9CC8F0', n: 'Azul' },
  { c: '#F2A7C3', n: 'Rosa' },
  { c: '#C8A8F0', n: 'Lila' },
];

// ---------- Texto ----------
export function normalize(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('es', { granularity: 'sentence' }) : null;
/** Divide un texto en frases con su rango de caracteres [start, end). Las frases muy largas se cortan en comas. */
export function splitSentences(text) {
  const out = [];
  const push = (start, end) => {
    const raw = text.slice(start, end);
    if (!raw.trim()) return;
    if (raw.length <= 280) { out.push({ start, end, text: raw.trim() }); return; }
    // Cortar frases largas en pausas naturales
    const re = /[,;:—–]\s+/g; let last = 0; let m;
    while ((m = re.exec(raw))) {
      if (m.index - last > 120) { out.push({ start: start + last, end: start + m.index + 1, text: raw.slice(last, m.index + 1).trim() }); last = m.index + m[0].length; }
    }
    if (raw.slice(last).trim()) out.push({ start: start + last, end, text: raw.slice(last).trim() });
  };
  if (segmenter) {
    for (const s of segmenter.segment(text)) push(s.index, s.index + s.segment.length);
  } else {
    const re = /[^.!?¡¿…]+[.!?…]+["»”')\]]*\s*|[^.!?…]+$/g; let m;
    while ((m = re.exec(text))) push(m.index, m.index + m[0].length);
  }
  return out;
}

// ---------- Portadas ----------
const PALETTES = [
  ['#5B2140', '#3A1429'], ['#2F4A3E', '#1E3029'], ['#3D3A6B', '#26244A'], ['#7A4A24', '#4E2E15'],
  ['#2C4A63', '#1A2E40'], ['#6B2A2A', '#441A1A'], ['#4A3F5C', '#2E273B'], ['#3E5A4E', '#26392F'],
];
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
const coverUrls = new Map();
export function coverURL(book) {
  if (!book.cover) return null;
  const k = book.id + ':' + (book.coverVersion || 0);
  if (!coverUrls.has(k)) coverUrls.set(k, URL.createObjectURL(book.cover));
  return coverUrls.get(k);
}
export function coverHTML(book, { badge = true } = {}) {
  const url = coverURL(book);
  const [c1, c2] = PALETTES[hash(book.title) % PALETTES.length];
  const inner = url
    ? `<img src="${url}" alt="" loading="lazy" />`
    : `<div class="cover-gen" style="--c1:${c1};--c2:${c2}"><div><div class="t">${esc(book.title)}</div><div class="rule"></div></div><div class="a">${esc(book.author || '')}</div></div>`;
  return `<div class="cover">${badge ? `<span class="badge">${book.format.toUpperCase()}</span>` : ''}${book.favorite ? `<span class="fav-mark">${icon('star')}</span>` : ''}${inner}</div>`;
}

// ---------- Toast ----------
export function toast(msg, { action, onAction, timeout = 3800 } = {}) {
  const el = html(`<div class="toast"><span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}</div>`);
  document.getElementById('toast-root').appendChild(el);
  const kill = () => el.remove();
  if (action) el.querySelector('button').onclick = () => { kill(); onAction && onAction(); };
  setTimeout(kill, timeout);
  return kill;
}

// ---------- Modales ----------
export function modal({ title, body = '', actions = [], onOpen, dismissible = true }) {
  return new Promise(resolve => {
    const back = html(`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal">
      ${title ? `<h2>${esc(title)}</h2>` : ''}<div class="body">${body}</div>
      <div class="foot">${actions.map((a, i) => `<button class="btn ${a.cls || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>
    </div></div>`);
    const root = document.getElementById('modal-root');
    root.appendChild(back);
    const box = back.querySelector('.modal');
    const close = (val) => { back.remove(); document.removeEventListener('keydown', onKey, true); resolve(val); };
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { const p = actions.findIndex(a => a.primary); if (p >= 0) run(p); }
    };
    const run = async (i) => {
      const a = actions[i];
      const val = a.value !== undefined ? a.value : (a.collect ? a.collect(box) : true);
      if (a.validate && !a.validate(box)) return;
      close(val);
    };
    back.addEventListener('click', e => { if (e.target === back && dismissible) close(null); });
    box.querySelectorAll('.foot button').forEach(b => b.onclick = () => run(+b.dataset.i));
    document.addEventListener('keydown', onKey, true);
    onOpen && onOpen(box, close);
    const first = box.querySelector('input, textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
  });
}
export function confirmDialog(title, text, okLabel = 'Aceptar', danger = false) {
  return modal({
    title, body: `<p style="margin:0;color:var(--ink-2)">${esc(text)}</p>`,
    actions: [{ label: 'Cancelar', cls: 'btn-ghost', value: false }, { label: okLabel, cls: danger ? 'btn-primary' : 'btn-primary', value: true, primary: true }],
  });
}

// ---------- Descarga ----------
export function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
