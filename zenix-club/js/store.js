// Zenix Club — estado y reglas del programa de fidelización. Se guarda en el dispositivo del comercio.
import { uid, startOfDay, DAY } from './util.js';
import { buildDemo } from './seed.js';

const KEY = 'zenix-club:v1';
let state = null; const subs = new Set();
export function load() {
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  if (!state || state.version !== 1) { state = buildDemo(); persist(); }
  return state;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn(e); } }
export const get = () => state;
export const subscribe = f => (subs.add(f), () => subs.delete(f));
function commit() { persist(); subs.forEach(f => f(state)); }

export function resetDemo() { state = buildDemo(); commit(); }
export function wipe() { state = { ...state, customers: [], events: [] }; state.biz.demo = false; commit(); }
export function importBackup(o) { if (!o || o.version !== 1 || !Array.isArray(o.customers)) throw new Error('El archivo no es un respaldo de Zenix Club.'); state = o; commit(); }

// ---------- utilidades ----------
// Normaliza un celular argentino a 10 dígitos (característica + número).
// El "15" solo se quita si sobra: característica + 15 + número = 12 dígitos.
export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.startsWith('54')) d = d.slice(2).replace(/^9/, '');
  if (d.length === 12) { const m = d.match(/^(\d{2,4})15(\d+)$/); if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2]; }
  return d;
}
export const byId = id => state.customers.find(c => c.id === id) || null;
export const goal = () => Math.max(2, state.biz.goal || 8);
export const lastVisit = c => c.last || c.createdAt;
export const daysSince = ts => Math.floor((startOfDay() - startOfDay(new Date(ts))) / DAY);
export const isDoubleToday = () => state.biz.doubleDay !== null && state.biz.doubleDay !== '' && new Date().getDay() === +state.biz.doubleDay;
export const rewardsReady = c => Math.floor(c.stamps / goal());

export function search(q) {
  q = String(q || '').trim().toLowerCase(); if (!q) return [];
  const digits = q.replace(/\D/g, '');
  return state.customers.filter(c => c.name.toLowerCase().includes(q) || (digits.length >= 3 && normPhone(c.phone).includes(digits)))
    .sort((a, b) => lastVisit(b) - lastVisit(a)).slice(0, 8);
}

export function birthdaySoon(c, days = 7) {
  if (!c.birthday) return null;
  const [m, d] = c.birthday.split('-').map(Number); const now = new Date(); const today = startOfDay();
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    const t = new Date(y, m - 1, d).getTime();
    if (t >= today) { const n = Math.round((t - today) / DAY); return n <= days ? n : null; }
  }
  return null;
}

export function stats() {
  const now = Date.now(), t0 = startOfDay();
  const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const pm0 = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getTime();
  const ev = state.events;
  const visits = (a, b) => ev.filter(e => e.type === 'stamp' && e.ts >= a && e.ts < b).length;
  const sameDayPrev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, new Date().getDate(), new Date().getHours()).getTime();
  const cs = state.customers;
  const active = cs.filter(c => now - lastVisit(c) < 30 * DAY).length;
  const returning = cs.filter(c => (c.visits || 0) >= 2).length;
  const series = [];
  for (let i = 29; i >= 0; i--) { const a = t0 - i * DAY; series.push({ ts: a, v: visits(a, a + DAY), n: cs.filter(c => c.createdAt >= a && c.createdAt < a + DAY).length }); }
  const lost = cs.filter(c => { const d = daysSince(lastVisit(c)); return d >= 21 && d <= 120 && (c.visits || 0) >= 2; })
    .sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 8);
  return {
    total: cs.length, active, returnRate: cs.length ? returning / cs.length : 0,
    monthVisits: visits(m0, now), prevMonthVisits: visits(pm0, sameDayPrev),
    monthRedeems: ev.filter(e => e.type === 'redeem' && e.ts >= m0).length,
    monthNew: cs.filter(c => c.createdAt >= m0).length,
    today: visits(t0, now), series, lost,
    ready: cs.filter(c => rewardsReady(c) > 0).sort((a, b) => lastVisit(b) - lastVisit(a)),
    birthdays: cs.map(c => ({ c, d: birthdaySoon(c) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d),
    top: cs.slice().sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 5),
  };
}

// ---------- comandos ----------
export function saveBiz(d) { Object.assign(state.biz, d); commit(); }

export function addCustomer({ name, phone, birthday }) {
  name = String(name || '').trim(); const p = normPhone(phone);
  if (!name) throw new Error('Poné el nombre del cliente.');
  if (p.length < 8) throw new Error('El teléfono parece incompleto (con característica, ej.: 2901 471353).');
  const dup = state.customers.find(c => normPhone(c.phone) === p);
  if (dup) throw new Error(`Ese teléfono ya es de ${dup.name}.`);
  const bonus = Math.max(0, +state.biz.welcome || 0);
  const c = { id: uid(), name, phone: String(phone).trim(), birthday: birthday || '', createdAt: Date.now(), last: Date.now(), stamps: bonus, total: bonus, visits: 0, redeemed: 0 };
  state.customers.unshift(c);
  state.events.push({ id: uid(), cid: c.id, ts: Date.now(), type: 'join', n: bonus });
  commit(); return c;
}
export function updateCustomer(id, d) {
  const c = byId(id); if (!c) return;
  if (d.phone !== undefined) { const p = normPhone(d.phone); const dup = state.customers.find(x => x.id !== id && normPhone(x.phone) === p); if (dup) throw new Error(`Ese teléfono ya es de ${dup.name}.`); }
  Object.assign(c, d); commit();
}
export function deleteCustomer(id) { state.customers = state.customers.filter(c => c.id !== id); state.events = state.events.filter(e => e.cid !== id); commit(); }

/** Suma sellos por una visita. Devuelve {added, ready, justCompleted}. */
export function stamp(id, n = 1) {
  const c = byId(id); if (!c) throw new Error('Cliente no encontrado');
  const mult = isDoubleToday() ? 2 : 1;
  const added = Math.max(1, Math.round(n)) * mult;
  const before = rewardsReady(c);
  c.stamps += added; c.total += added; c.visits = (c.visits || 0) + 1; c.last = Date.now();
  state.events.push({ id: uid(), cid: c.id, ts: Date.now(), type: 'stamp', n: added });
  commit();
  return { added, double: mult > 1, ready: rewardsReady(c), justCompleted: rewardsReady(c) > before };
}
export function redeem(id) {
  const c = byId(id); if (!c || rewardsReady(c) < 1) throw new Error('Todavía no tiene un premio para canjear.');
  c.stamps -= goal(); c.redeemed = (c.redeemed || 0) + 1; c.last = Date.now();
  state.events.push({ id: uid(), cid: c.id, ts: Date.now(), type: 'redeem', n: goal() });
  commit();
}
export function undoLast(id) {
  const i = state.events.map(e => e.cid === id).lastIndexOf(true); if (i < 0) return false;
  const e = state.events[i], c = byId(id);
  if (Date.now() - e.ts > 10 * 60e3) throw new Error('Solo se puede deshacer en los primeros 10 minutos.');
  if (e.type === 'stamp') { c.stamps -= e.n; c.total -= e.n; c.visits--; }
  else if (e.type === 'redeem') { c.stamps += e.n; c.redeemed--; }
  else return false;
  state.events.splice(i, 1); commit(); return e.type;
}

export function cardPayload(c) {
  const b = state.biz;
  return { v: 1, b: { n: b.name, e: b.emoji, c: b.color, p: b.phone, g: goal(), r: b.reward, a: b.address, d: b.doubleDay }, c: { n: c.name, s: c.stamps, t: c.total, r: c.redeemed || 0, j: c.createdAt, l: lastVisit(c) }, ts: Date.now() };
}
