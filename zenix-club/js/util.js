// Utilidades: formato es-AR, escape, CSV, número a letras, links compartibles.

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const moneyDec = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat('es-AR');
const pct = new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 });

export const fmt = {
  money: v => money.format(Math.round(v || 0)),
  moneyExact: v => moneyDec.format(v || 0),
  num: v => num.format(v || 0),
  pct: v => pct.format(isFinite(v) ? v : 0),
  date: ts => new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  dateShort: ts => new Date(ts).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', ''),
  time: ts => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
  dateTime: ts => `${fmt.date(ts)} ${fmt.time(ts)}`,
  weekday: ts => new Date(ts).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
  ticket: n => String(n).padStart(8, '0'),
};

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export const DAY = 864e5;

export function debounce(fn, ms = 150) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// CSV con separador ; (lo que espera Excel en es-AR)
export function toCSV(rows) {
  return '﻿' + rows.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
}

export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

export function download(name, content, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export const parseMoney = s => {
  if (typeof s === 'number') return s;
  const clean = String(s || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isFinite(n) ? n : 0;
};

// ---------- número a letras (para "Son pesos ...") ----------
const U = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
function lt1000(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100), r = n % 100;
  let out = C[c];
  if (r) out += (out ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : ''));
  return out;
}
export function toWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'cero';
  const parts = [];
  const mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1e3), rest = n % 1e3;
  if (mill) parts.push(mill === 1 ? 'un millón' : apocope(toWords(mill)) + ' millones');
  if (miles) parts.push(miles === 1 ? 'mil' : apocope(lt1000(miles)) + ' mil');
  if (rest) parts.push(lt1000(rest));
  return parts.join(' ');
}
const apocope = s => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
export function pesosEnLetras(v) {
  const ent = Math.floor(v), cent = Math.round((v - ent) * 100);
  const txt = toWords(ent);
  return `Son pesos ${txt} con ${String(cent).padStart(2, '0')}/100`.replace(/^./, c => c.toUpperCase());
}

// ---------- links compartibles (todo viaja en el link, sin servidor) ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export async function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if ('CompressionStream' in window) {
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    return 'z' + b64u(out);
  }
  return 'j' + b64u(bytes);
}
export async function decodeShare(s) {
  const kind = s[0], data = unb64u(s.slice(1));
  let bytes = data;
  if (kind === 'z') bytes = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
