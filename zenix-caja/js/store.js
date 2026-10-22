// Estado de la app + reglas de negocio. Todo se guarda en el dispositivo (localStorage).
import { uid, startOfDay, DAY } from './util.js';
import { buildDemo } from './seed.js';

const KEY = 'zenix-caja:v1';
const listeners = new Set();
let state = null;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch { state = null; }
  if (!state || state.version !== 1) { state = buildDemo(); persist(); }
  return state;
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.warn('No se pudo guardar', e); }
}

export const get = () => state;
export const subscribe = fn => (listeners.add(fn), () => listeners.delete(fn));
function commit() { persist(); listeners.forEach(fn => fn(state)); }

export function resetDemo() { state = buildDemo(); commit(); }
export function wipe() {
  const b = state.business;
  state = { version: 1, business: b, categories: state.categories, products: [], sales: [], sessions: [], currentSession: null, seq: 1 };
  commit();
}
export function importBackup(obj) {
  if (!obj || obj.version !== 1 || !Array.isArray(obj.products) || !Array.isArray(obj.sales)) throw new Error('El archivo no es un respaldo válido de Zenix Caja.');
  state = obj; commit();
}

// ---------- consultas ----------
export const productById = id => state.products.find(p => p.id === id);
export const productByCode = code => state.products.find(p => p.active !== false && p.code && p.code === String(code).trim());
export const categoryById = id => state.categories.find(c => c.id === id);
export const session = () => state.sessions.find(s => s.id === state.currentSession) || null;
export const validSales = () => state.sales.filter(s => s.status !== 'void');

export function salesBetween(from, to) {
  return state.sales.filter(s => s.status !== 'void' && s.ts >= from && s.ts < to);
}

export function sessionSummary(s) {
  const sales = state.sales.filter(v => v.sessionId === s.id && v.status !== 'void');
  const byMethod = {};
  for (const v of sales) for (const p of v.payments) byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
  const cashSales = byMethod.cash || 0;
  const ins = s.moves.filter(m => m.type === 'in').reduce((a, m) => a + m.amount, 0);
  const outs = s.moves.filter(m => m.type === 'out').reduce((a, m) => a + m.amount, 0);
  const total = sales.reduce((a, v) => a + v.total, 0);
  return { sales, count: sales.length, total, byMethod, cashSales, ins, outs, expected: s.openAmount + cashSales + ins - outs };
}

export function stats(from, to) {
  const sales = salesBetween(from, to);
  const total = sales.reduce((a, s) => a + s.total, 0);
  const cost = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.cost * i.qty, 0), 0);
  const units = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.qty, 0), 0);
  return { sales, count: sales.length, total, cost, margin: total - cost, avg: sales.length ? total / sales.length : 0, units };
}

export function topProducts(from, to, n = 5) {
  const m = new Map();
  for (const s of salesBetween(from, to)) for (const i of s.items) {
    const e = m.get(i.pid) || { pid: i.pid, name: i.name, qty: 0, total: 0 };
    e.qty += i.qty; e.total += i.qty * i.price * (s.subtotal ? s.total / s.subtotal : 1); m.set(i.pid, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, n);
}

export function dailySeries(days = 14) {
  const today = startOfDay();
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const from = today - d * DAY;
    const st = stats(from, from + DAY);
    out.push({ ts: from, total: st.total, count: st.count });
  }
  return out;
}

export function hourlySeries(dayStart = startOfDay()) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ h, total: 0, count: 0 }));
  for (const s of salesBetween(dayStart, dayStart + DAY)) {
    const h = new Date(s.ts).getHours(); hours[h].total += s.total; hours[h].count++;
  }
  return hours;
}

export function methodSplit(from, to) {
  const m = {};
  for (const s of salesBetween(from, to)) for (const p of s.payments) m[p.method] = (m[p.method] || 0) + p.amount;
  return m;
}

export const lowStock = () => state.products.filter(p => p.active !== false && p.stock <= p.minStock).sort((a, b) => a.stock / Math.max(1, a.minStock) - b.stock / Math.max(1, b.minStock));

// ---------- comandos ----------
export function saveBusiness(data) { Object.assign(state.business, data); commit(); }

export function saveProduct(p) {
  const code = String(p.code || '').trim();
  if (code && state.products.some(x => x.code === code && x.id !== p.id)) throw new Error(`Ya existe un producto con el código ${code}.`);
  if (!String(p.name || '').trim()) throw new Error('El producto necesita un nombre.');
  if (!(p.price > 0)) throw new Error('El precio de venta tiene que ser mayor a cero.');
  const clean = {
    id: p.id || uid(), code, name: p.name.trim(), cat: p.cat || state.categories[0]?.id,
    price: Math.round(p.price), cost: Math.max(0, Math.round(p.cost || 0)),
    stock: Math.round(p.stock || 0), minStock: Math.max(0, Math.round(p.minStock || 0)), active: true,
  };
  const i = state.products.findIndex(x => x.id === clean.id);
  if (i >= 0) state.products[i] = { ...state.products[i], ...clean }; else state.products.unshift(clean);
  commit(); return clean;
}

export function deleteProduct(id) { state.products = state.products.filter(p => p.id !== id); commit(); }

export function adjustStock(id, delta) {
  const p = productById(id); if (!p) return;
  p.stock = Math.round(p.stock + delta); commit();
}

export function importProducts(list) {
  let added = 0, updated = 0;
  for (const r of list) {
    const ex = r.code ? state.products.find(p => p.code === r.code) : null;
    let cat = state.categories.find(c => c.name.toLowerCase() === String(r.catName || '').toLowerCase());
    if (!cat && r.catName) { cat = { id: uid(), name: r.catName, color: (state.categories.length % 6) + 1 }; state.categories.push(cat); }
    const data = { name: r.name, price: Math.round(r.price), cost: Math.round(r.cost || 0), stock: Math.round(r.stock || 0), minStock: Math.round(r.minStock || 0), cat: cat?.id || state.categories[0]?.id };
    if (ex) { Object.assign(ex, data); updated++; }
    else { state.products.push({ id: uid(), code: r.code || '', active: true, ...data }); added++; }
  }
  commit(); return { added, updated };
}

export function openSession(amount, note = '') {
  if (session()) throw new Error('Ya hay una caja abierta.');
  const s = { id: uid(), openedAt: Date.now(), openAmount: Math.max(0, Math.round(amount)), note, moves: [], closedAt: null, counted: null };
  state.sessions.push(s); state.currentSession = s.id; commit(); return s;
}

export function addMove(type, amount, note) {
  const s = session(); if (!s) throw new Error('Abrí la caja primero.');
  if (!(amount > 0)) throw new Error('Ingresá un monto mayor a cero.');
  s.moves.push({ id: uid(), ts: Date.now(), type, amount: Math.round(amount), note: note || (type === 'in' ? 'Ingreso' : 'Retiro') });
  commit();
}

export function closeSession(counted) {
  const s = session(); if (!s) throw new Error('No hay caja abierta.');
  const sum = sessionSummary(s);
  s.closedAt = Date.now(); s.counted = Math.round(counted); s.expected = sum.expected; s.total = sum.total; s.count = sum.count;
  state.currentSession = null; commit(); return s;
}

/**
 * Registra una venta. items: [{pid, qty}], discount: monto en $, payment: {method, received}
 */
export function checkout({ items, discount = 0, payment }) {
  const s = session(); if (!s) throw new Error('Abrí la caja para poder cobrar.');
  if (!items.length) throw new Error('El carrito está vacío.');
  const lines = items.map(it => {
    const p = productById(it.pid);
    if (!p) throw new Error('Un producto del carrito ya no existe.');
    if (p.stock < it.qty) throw new Error(`Stock insuficiente de ${p.name} (quedan ${p.stock}).`);
    return { pid: p.id, code: p.code, name: p.name, qty: it.qty, price: p.price, cost: p.cost };
  });
  const subtotal = lines.reduce((a, l) => a + l.qty * l.price, 0);
  const disc = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const total = subtotal - disc;
  let change = 0;
  if (payment.method === 'cash') {
    const rec = Math.round(payment.received ?? total);
    if (rec < total) throw new Error('El efectivo recibido no alcanza.');
    change = rec - total;
  }
  for (const l of lines) productById(l.pid).stock -= l.qty;
  const sale = {
    id: uid(), n: state.seq++, ts: Date.now(), items: lines, subtotal, discount: disc, total,
    payments: [{ method: payment.method, amount: total }], received: payment.method === 'cash' ? total + change : total,
    change, status: 'ok', sessionId: s.id,
  };
  state.sales.push(sale); commit(); return sale;
}

export function voidSale(id, reason = '') {
  const s = state.sales.find(x => x.id === id);
  if (!s || s.status === 'void') return;
  s.status = 'void'; s.voidedAt = Date.now(); s.voidReason = reason;
  for (const l of s.items) { const p = productById(l.pid); if (p) p.stock += l.qty; }
  commit();
}
