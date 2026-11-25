// Zenix Club — estado y reglas del programa de fidelización.
// Dos modos: "demo" (todo en este dispositivo) y "cloud" (cuenta del comercio en club.zenix.com.ar).
import { uid, startOfDay, DAY } from './util.js';
import { buildDemo } from './seed.js';

const LKEY = 'zenix-club:v1', SKEY = 'zenix-club:session', CKEY = 'zenix-club:cache';
const DEFAULT_BIZ = { refBonus: 1, reviewUrl: '', reviewAfter: 3, minHours: 3 };
const ls = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn(e); } }, del(k) { try { localStorage.removeItem(k); } catch {} } };

// La API vive en club.zenix.com.ar; si la app corre ahí mismo (o en local) se usa el mismo origen.
export const API = (() => {
  try { const o = localStorage.getItem('zenix-club:api'); if (o) return o.replace(/\/$/, ''); } catch {}
  return /^(club\.zenix\.com\.ar|localhost|127\.0\.0\.1)$|\.workers\.dev$/.test(location.hostname) ? '' : 'https://club.zenix.com.ar';
})();
export const PUBLIC = API || location.origin;

let state = null, mode = 'none', session = null; const subs = new Set();
export const get = () => state;
export const getMode = () => mode;
export const me = () => session?.me || null;
export const isOwner = () => mode === 'demo' || session?.me?.role === 'owner';
export const slug = () => session?.slug || '';
export const subscribe = f => (subs.add(f), () => subs.delete(f));
function commit() { if (mode === 'demo') ls.set(LKEY, state); if (mode === 'cloud') ls.set(CKEY, { slug: session.slug, state }); subs.forEach(f => f(state)); }
const withDefaults = s => (s.biz = { ...DEFAULT_BIZ, ...s.biz }, s.staff ||= [], s);

export class ApiError extends Error { constructor(msg, status, extra = {}) { super(msg); this.status = status; Object.assign(this, extra); } }
async function api(method, path, body) {
  let r;
  try {
    r = await fetch(`${API}/api/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: 'Bearer ' + session.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError('Sin conexión. Revisá internet y probá de nuevo.', 0, { offline: true }); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && session && path !== 'login') { endSession(); throw new ApiError(d.error || 'La sesión venció. Volvé a entrar.', 401, { sessionLost: true }); }
  if (!r.ok) throw new ApiError(d.error || 'Algo salió mal. Probá de nuevo.', r.status, d);
  return d;
}
export const publicApi = (method, path, body) => api(method, path, body);

// ---------- arranque y sesión ----------
export function load() {
  session = ls.get(SKEY);
  if (session?.token) {
    mode = 'cloud';
    const c = ls.get(CKEY);
    state = c?.slug === session.slug ? withDefaults(c.state) : null;
    return state ? 'ready' : 'loading';
  }
  const local = ls.get(LKEY);
  if (local?.version === 1) { mode = 'demo'; state = withDefaults(local); return 'ready'; }
  mode = 'none'; return 'onboard';
}
export async function refresh() {
  if (mode !== 'cloud') return;
  const d = await api('GET', 'state');
  state = withDefaults({ version: 1, cloud: true, slug: d.slug, biz: { ...d.biz }, customers: d.customers, events: d.events, staff: d.staff });
  session.me = d.me; ls.set(SKEY, session);
  commit();
}
export async function login(club, secret) {
  const d = await api('POST', 'login', { club: String(club).trim().toLowerCase(), secret });
  session = { token: d.token, slug: d.slug, me: d.me }; ls.set(SKEY, session); mode = 'cloud'; state = null;
  await refresh();
}
function endSession() { session = null; ls.del(SKEY); ls.del(CKEY); mode = ls.get(LKEY) ? 'demo' : 'none'; state = mode === 'demo' ? withDefaults(ls.get(LKEY)) : null; }
export async function logout() { try { await api('POST', 'logout'); } catch {} endSession(); }
export function startDemo() { mode = 'demo'; state = withDefaults(buildDemo()); commit(); }

export function resetDemo() { state = withDefaults(buildDemo()); commit(); }
export function wipe() { state = withDefaults({ version: 1, biz: { ...state.biz, name: 'Mi comercio', address: '', phone: '', demo: false }, customers: [], events: [] }); commit(); }
export function importBackup(o) { if (!o || o.version !== 1 || !Array.isArray(o.customers)) throw new Error('El archivo no es un respaldo de Zenix Club.'); state = withDefaults(o); commit(); }

// ---------- consultas ----------
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
export const staffName = id => (state.staff || []).find(s => s.id === id)?.name || '';
export const referrerOf = c => c?.ref ? byId(c.ref) : null;

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
    monthReferred: cs.filter(c => c.ref && c.createdAt >= m0).length,
    monthQr: cs.filter(c => c.source === 'qr' && c.createdAt >= m0).length,
    today: visits(t0, now), series, lost,
    alerts: ev.filter(e => e.flag === 'forced' && e.ts >= now - 7 * DAY).slice(-6).reverse(),
    ready: cs.filter(c => rewardsReady(c) > 0).sort((a, b) => lastVisit(b) - lastVisit(a)),
    birthdays: cs.map(c => ({ c, d: birthdaySoon(c) })).filter(x => x.d !== null).sort((a, b) => a.d - b.d),
    top: cs.slice().sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 5),
  };
}

// ---------- comandos (todos async: en la nube pasan por la API) ----------
const upsert = c => { const i = state.customers.findIndex(x => x.id === c.id); if (i >= 0) state.customers[i] = c; else state.customers.unshift(c); };
const addEvents = evs => { state.events.push(...(evs || [])); };

export async function saveBiz(d) {
  if (mode === 'cloud') { const r = await api('PUT', 'settings', d); state.biz = { ...state.biz, ...r.biz }; }
  else Object.assign(state.biz, d);
  commit();
}

export async function addCustomer({ name, phone, birthday }) {
  if (mode === 'cloud') { const r = await api('POST', 'customers', { name, phone, birthday }); upsert(r.customer); addEvents(r.events); commit(); return r.customer; }
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
export async function updateCustomer(id, d) {
  if (mode === 'cloud') { const r = await api('PUT', 'customers/' + id, d); upsert(r.customer); commit(); return; }
  const c = byId(id); if (!c) return;
  if (d.phone !== undefined) { const p = normPhone(d.phone); const dup = state.customers.find(x => x.id !== id && normPhone(x.phone) === p); if (dup) throw new Error(`Ese teléfono ya es de ${dup.name}.`); }
  Object.assign(c, d); commit();
}
export async function deleteCustomer(id) {
  if (mode === 'cloud') await api('DELETE', 'customers/' + id);
  state.customers = state.customers.filter(c => c.id !== id); state.events = state.events.filter(e => e.cid !== id); commit();
}

/** Suma sellos por una visita. Devuelve {added, double, ready, justCompleted, referrer}.
 *  Si ya le sumaron hace poco tira un error con code 'recent' (se reintenta con force). */
export async function stamp(id, n = 1, force = false) {
  const c0 = byId(id); if (!c0) throw new Error('Cliente no encontrado');
  const before = rewardsReady(c0);
  if (mode === 'cloud') {
    const r = await api('POST', 'stamp', { cid: id, n, force });
    upsert(r.customer); if (r.referrer) upsert(r.referrer); addEvents(r.events); commit();
    return { added: r.added, double: r.double, ready: rewardsReady(r.customer), justCompleted: rewardsReady(r.customer) > before, referrer: r.referrer || null };
  }
  const hrs = +state.biz.minHours || 0;
  const last = state.events.filter(e => e.cid === id && e.type === 'stamp').pop();
  let flag = null;
  if (hrs && last && Date.now() - last.ts < hrs * 3600e3) {
    const mins = Math.round((Date.now() - last.ts) / 60000);
    if (!force) throw new ApiError(`A ${c0.name.split(' ')[0]} ya le sumaron un sello ${mins < 2 ? 'recién' : 'hace ' + (mins < 60 ? mins + ' min' : Math.round(mins / 60) + ' h')}.`, 409, { code: 'recent' });
    flag = 'forced';
  }
  const c = c0, mult = isDoubleToday() ? 2 : 1;
  const added = Math.max(1, Math.round(n)) * mult;
  c.stamps += added; c.total += added; c.visits = (c.visits || 0) + 1; c.last = Date.now();
  state.events.push({ id: uid(), cid: c.id, ts: Date.now(), type: 'stamp', n: added, flag });
  commit();
  return { added, double: mult > 1, ready: rewardsReady(c), justCompleted: rewardsReady(c) > before, referrer: null };
}
export async function redeem(id) {
  if (mode === 'cloud') { const r = await api('POST', 'redeem', { cid: id }); upsert(r.customer); addEvents(r.events); commit(); return; }
  const c = byId(id); if (!c || rewardsReady(c) < 1) throw new Error('Todavía no tiene un premio para canjear.');
  c.stamps -= goal(); c.redeemed = (c.redeemed || 0) + 1; c.last = Date.now();
  state.events.push({ id: uid(), cid: c.id, ts: Date.now(), type: 'redeem', n: goal() });
  commit();
}
export async function undoLast(id) {
  if (mode === 'cloud') {
    const r = await api('POST', 'undo', { cid: id });
    r.customers.forEach(upsert); state.events = state.events.filter(e => !r.removed.includes(e.id)); commit(); return r.type;
  }
  const i = state.events.map(e => e.cid === id && (e.type === 'stamp' || e.type === 'redeem')).lastIndexOf(true); if (i < 0) return false;
  const e = state.events[i], c = byId(id);
  if (Date.now() - e.ts > 10 * 60e3) throw new Error('Solo se puede deshacer en los primeros 10 minutos.');
  if (e.type === 'stamp') { c.stamps -= e.n; c.total -= e.n; c.visits--; }
  else { c.stamps += e.n; c.redeemed--; }
  state.events.splice(i, 1); commit(); return e.type;
}

// ---------- equipo (solo nube) ----------
export async function addStaff(name, pin) { await api('POST', 'staff', { name, pin }); await refresh(); }
export async function removeStaff(id) { await api('DELETE', 'staff/' + id); await refresh(); }
export const changePassword = (current, password) => api('POST', 'password', { current, password });

// ---------- links ----------
export function cardPayload(c) {
  const b = state.biz;
  return { v: 1, b: { n: b.name, e: b.emoji, c: b.color, p: b.phone, g: goal(), r: b.reward, a: b.address, d: b.doubleDay }, c: { n: c.name, s: c.stamps, t: c.total, v: c.visits || 0, r: c.redeemed || 0, j: c.createdAt, l: lastVisit(c) }, ts: Date.now() };
}
export const liveCardUrl = c => `${PUBLIC}/t/${c.token}`;
export const joinUrl = (ref = '') => `${PUBLIC}/u/${slug()}${ref ? '/' + ref : ''}`;

// pedidos de reseña ya enviados (para no pedirla dos veces)
const RKEY = 'zenix-club:review-asked';
export const reviewAsked = id => (ls.get(RKEY) || []).includes(id);
export const markReviewAsked = id => ls.set(RKEY, [...new Set([...(ls.get(RKEY) || []), id])].slice(-2000));
