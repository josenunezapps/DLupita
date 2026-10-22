// Utilidades compartidas: formato, escape, fechas, ids.

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

export const PAY_METHODS = {
  cash:     { label: 'Efectivo',      short: 'Efectivo', color: 'var(--c1)' },
  debit:    { label: 'Débito',        short: 'Débito',   color: 'var(--c2)' },
  credit:   { label: 'Crédito',       short: 'Crédito',  color: 'var(--c3)' },
  transfer: { label: 'Transferencia', short: 'Transf.',  color: 'var(--c4)' },
  qr:       { label: 'QR / Billetera', short: 'QR',      color: 'var(--c5)' },
};

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
