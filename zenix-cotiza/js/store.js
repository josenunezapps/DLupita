// Estado y reglas de negocio de Zenix Cotiza. Se guarda en el dispositivo.
import { uid, startOfDay, DAY } from './util.js';
import { buildDemo } from './seed.js';

const KEY = 'zenix-cotiza:v1';
const listeners = new Set();
let state = null;

export const STATUS = {
  draft:    { label: 'Borrador',  tone: 'gray' },
  sent:     { label: 'Enviado',   tone: 'blue' },
  accepted: { label: 'Aceptado',  tone: 'green' },
  rejected: { label: 'Rechazado', tone: 'red' },
  expired:  { label: 'Vencido',   tone: 'amber' },
};
export const IVA_COND = { RI: 'Responsable Inscripto', MT: 'Monotributista', EX: 'Exento' };
export const IVA_RATES = [0, 10.5, 21, 27];

export function load() {
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  if (!state || state.version !== 1) { state = buildDemo(); persist(); }
  return state;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('No se pudo guardar', e); } }
export const get = () => state;
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
function commit(silent = false) { persist(); if (!silent) listeners.forEach(fn => fn(state)); }

export function resetDemo() { state = buildDemo(); commit(); }
export function wipe() { state = { ...state, clients: [], catalog: [], quotes: [], seq: 1 }; state.company.demo = false; commit(); }
export function importBackup(o) {
  if (!o || o.version !== 1 || !Array.isArray(o.quotes) || !o.company) throw new Error('El archivo no es un respaldo válido de Zenix Cotiza.');
  state = o; commit();
}

// ---------- cálculos ----------
export const discriminaIVA = (company = state.company) => company.iva === 'RI';

export function calc(q, company = state.company) {
  const ri = discriminaIVA(company);
  const gd = Math.min(100, Math.max(0, +q.discount || 0)) / 100;
  const lines = q.items.map(it => {
    const gross = (+it.qty || 0) * (+it.price || 0);
    const net = gross * (1 - Math.min(100, Math.max(0, +it.disc || 0)) / 100);
    return { ...it, gross, net };
  });
  const subtotal = lines.reduce((a, l) => a + l.net, 0);
  const discAmt = subtotal * gd;
  const base = subtotal - discAmt;
  const ivaBy = {};
  if (ri) for (const l of lines) { const r = +l.iva || 0; if (r) ivaBy[r] = (ivaBy[r] || 0) + l.net * (1 - gd) * r / 100; }
  const iva = Object.values(ivaBy).reduce((a, b) => a + b, 0);
  const round = v => Math.round(v * 100) / 100;
  return { lines, subtotal: round(subtotal), discAmt: round(discAmt), base: round(base), ivaBy, iva: round(iva), total: round(base + iva), ri };
}

export const expiresAt = q => startOfDay(new Date(q.date)) + (q.validity + 1) * DAY;
export function statusOf(q, now = Date.now()) {
  if (q.status === 'sent' && now >= expiresAt(q)) return 'expired';
  return q.status;
}
export const quoteNumber = (q, company = state.company) => `${company.prefix || '0001'}-${String(q.n).padStart(8, '0')}`;
export const clientById = id => state.clients.find(c => c.id === id) || null;
export const quoteById = id => state.quotes.find(q => q.id === id) || null;

export function clientStats(id) {
  const qs = state.quotes.filter(q => q.clientId === id);
  const acc = qs.filter(q => q.status === 'accepted');
  return { count: qs.length, accepted: acc.length, amount: acc.reduce((a, q) => a + calc(q).total, 0), last: qs.reduce((a, q) => Math.max(a, q.date), 0) };
}

export function dashboard(now = Date.now()) {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const all = state.quotes.map(q => ({ q, st: statusOf(q, now), total: calc(q).total }));
  const issued = all.filter(x => x.q.status !== 'draft');
  const month = issued.filter(x => (x.q.sentAt || x.q.date) >= monthStart);
  const decided = issued.filter(x => x.st === 'accepted' || x.st === 'rejected' || x.st === 'expired');
  const won = issued.filter(x => x.st === 'accepted');
  const open = all.filter(x => x.st === 'sent');
  const soon = open.filter(x => expiresAt(x.q) - now < 4 * DAY).sort((a, b) => expiresAt(a.q) - expiresAt(b.q));
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const a = new Date(d.getFullYear(), d.getMonth() - i, 1).getTime(), b = new Date(d.getFullYear(), d.getMonth() - i + 1, 1).getTime();
    const inM = issued.filter(x => (x.q.sentAt || x.q.date) >= a && (x.q.sentAt || x.q.date) < b);
    months.push({ ts: a, issued: inM.reduce((s, x) => s + x.total, 0), won: inM.filter(x => x.st === 'accepted').reduce((s, x) => s + x.total, 0) });
  }
  const avgDays = won.length ? won.reduce((s, x) => s + ((x.q.decidedAt || x.q.date) - (x.q.sentAt || x.q.date)), 0) / won.length / DAY : 0;
  return {
    monthIssued: month.reduce((s, x) => s + x.total, 0), monthCount: month.length,
    monthWon: month.filter(x => x.st === 'accepted').reduce((s, x) => s + x.total, 0),
    winRate: decided.length ? won.length / decided.length : 0, decided: decided.length, won: won.length,
    openAmount: open.reduce((s, x) => s + x.total, 0), openCount: open.length, soon, months, avgDays,
    drafts: all.filter(x => x.st === 'draft').length,
  };
}

// ---------- comandos ----------
export function saveCompany(data) { Object.assign(state.company, data); commit(); }

export function saveClient(c) {
  if (!String(c.name || '').trim()) throw new Error('El cliente necesita un nombre.');
  const clean = { id: c.id || uid(), name: c.name.trim(), doc: (c.doc || '').trim(), email: (c.email || '').trim(), phone: (c.phone || '').trim(), address: (c.address || '').trim(), notes: (c.notes || '').trim(), createdAt: c.createdAt || Date.now() };
  const i = state.clients.findIndex(x => x.id === clean.id);
  if (i >= 0) state.clients[i] = clean; else state.clients.unshift(clean);
  commit(); return clean;
}
export function deleteClient(id) {
  if (state.quotes.some(q => q.clientId === id)) throw new Error('Ese cliente tiene presupuestos. Borralos primero o dejalo como está.');
  state.clients = state.clients.filter(c => c.id !== id); commit();
}

export function saveItem(it) {
  if (!String(it.name || '').trim()) throw new Error('El ítem necesita un nombre.');
  const clean = { id: it.id || uid(), name: it.name.trim(), unit: (it.unit || 'u.').trim(), price: Math.max(0, +it.price || 0), iva: IVA_RATES.includes(+it.iva) ? +it.iva : 21 };
  const i = state.catalog.findIndex(x => x.id === clean.id);
  if (i >= 0) state.catalog[i] = clean; else state.catalog.unshift(clean);
  commit(); return clean;
}
export function deleteItem(id) { state.catalog = state.catalog.filter(x => x.id !== id); commit(); }

export function newQuote(clientId = null) {
  const c = state.company;
  const q = {
    id: uid(), n: state.seq++, clientId, title: '', date: Date.now(), validity: c.validity || 15, status: 'draft',
    items: [], discount: 0, notes: '', terms: c.terms || '', payment: c.payment || '', delivery: '',
    createdAt: Date.now(), updatedAt: Date.now(), sentAt: null, decidedAt: null, history: [{ ts: Date.now(), status: 'draft' }],
  };
  state.quotes.push(q); commit(); return q;
}
export function updateQuote(id, patch, silent = true) {
  const q = quoteById(id); if (!q) return;
  Object.assign(q, patch, { updatedAt: Date.now() }); commit(silent); return q;
}
export function setStatus(id, status) {
  const q = quoteById(id); if (!q || q.status === status) return;
  if (status !== 'draft' && !q.clientId) throw new Error('Elegí un cliente antes de enviar el presupuesto.');
  if (status !== 'draft' && !q.items.length) throw new Error('Agregá al menos un ítem.');
  q.status = status; q.updatedAt = Date.now();
  if (status === 'sent' && !q.sentAt) q.sentAt = Date.now();
  if (status === 'accepted' || status === 'rejected') q.decidedAt = Date.now();
  if (status === 'sent' || status === 'draft') q.decidedAt = null;
  q.history.push({ ts: Date.now(), status });
  commit(); return q;
}
export function duplicateQuote(id) {
  const src = quoteById(id); if (!src) return;
  const q = { ...structuredClone(src), id: uid(), n: state.seq++, status: 'draft', date: Date.now(), createdAt: Date.now(), updatedAt: Date.now(), sentAt: null, decidedAt: null, history: [{ ts: Date.now(), status: 'draft' }] };
  q.items = q.items.map(i => ({ ...i, id: uid() }));
  state.quotes.push(q); commit(); return q;
}
export function deleteQuote(id) { state.quotes = state.quotes.filter(q => q.id !== id); commit(); }

// Datos mínimos para que el cliente vea el presupuesto desde un link
export function sharePayload(q) {
  const c = state.company, cl = clientById(q.clientId);
  const company = { name: c.name, cuit: c.cuit, iva: c.iva, address: c.address, phone: c.phone, email: c.email, web: c.web, color: c.color, prefix: c.prefix };
  if (c.logo && c.logo.length < 24000) company.logo = c.logo;
  return {
    v: 1, company, client: cl ? { name: cl.name, doc: cl.doc, email: cl.email, phone: cl.phone, address: cl.address } : null,
    quote: { n: q.n, title: q.title, date: q.date, validity: q.validity, items: q.items.map(({ desc, qty, unit, price, disc, iva }) => ({ desc, qty, unit, price, disc, iva })), discount: q.discount, notes: q.notes, terms: q.terms, payment: q.payment, delivery: q.delivery },
  };
}
