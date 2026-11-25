// Zenix Club · API + hosting (Cloudflare Worker con assets estáticos y D1).
// Binding D1: DB → base "zenix-club". Assets: la carpeta zenix-club/ (la app).
//
// Públicas:   GET  /api/club/:slug           datos del programa para la página de alta
//             POST /api/join                  {club,name,phone,birthday,ref}  alta del cliente por QR
//             GET  /api/card/:token           tarjeta en vivo del cliente
// Sesión:     POST /api/login                 {club,secret}  contraseña del dueño o PIN de empleado
//             POST /api/logout
// Mostrador:  GET  /api/state                 programa + clientes + eventos (180 días)
//             POST /api/customers             {name,phone,birthday}
//             PUT  /api/customers/:id         {name,phone,birthday}
//             DELETE /api/customers/:id       (dueño)
//             POST /api/stamp                 {cid,n,force}  409 si ya sumó hace poco
//             POST /api/redeem                {cid}
//             POST /api/undo                  {cid}
// Dueño:      PUT  /api/settings · GET/POST /api/staff · DELETE /api/staff/:id · POST /api/password
// Páginas:    GET /t/:token y /u/:slug[/:ref] → la app con vista previa para WhatsApp

const SESSION_DAYS = 60;
const EVENTS_DAYS = 180;
const UNDO_MIN = 10;
const MAX_STAFF = 12;
const ALLOWED_ORIGINS = [/^https:\/\/club\.zenix\.com\.ar$/, /^https:\/\/josenunezapps\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.workers\.dev$/];

const DEFAULTS = {
  name: 'Mi comercio', emoji: '☕', color: '#0f6b4f', goal: 8, welcome: 1, reward: 'Un café gratis',
  doubleDay: '', phone: '', birthdayGift: 'Una medialuna de regalo', address: '',
  refBonus: 1, reviewUrl: '', reviewAfter: 3, minHours: 3,
};

// ---------- utilidades ----------
class HttpError extends Error { constructor(status, msg, extra = {}) { super(msg); this.status = status; this.extra = extra; } }
const fail = (status, msg, extra) => { throw new HttpError(status, msg, extra); };
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const int = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const rand = (n = 10) => { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ''; for (const x of b) s += ALPHA[x % ALPHA.length]; return s; };
const sha256 = async s => b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Celular argentino a 10 dígitos (igual que en la app).
export function normPhone(p) {
  let d = String(p || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.startsWith('54')) d = d.slice(2).replace(/^9/, '');
  if (d.length === 12) { const m = d.match(/^(\d{2,4})15(\d+)$/); if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2]; }
  return d;
}
const validBirthday = b => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(b || '')) ? b : '';

async function pbkdf2(secret, salt, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret)), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
export async function hashSecret(secret, iter = 100000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${b64(salt)}$${await pbkdf2(secret, salt, iter)}`;
}
async function checkSecret(secret, stored) {
  const [, iter, salt, hash] = String(stored).split('$');
  if (!hash) return false;
  const got = await pbkdf2(secret, unb64(salt), Number(iter));
  let d = got.length ^ hash.length;
  for (let i = 0; i < Math.min(got.length, hash.length); i++) d |= got.charCodeAt(i) ^ hash.charCodeAt(i);
  return d === 0;
}

function settingsOf(club) { let s = {}; try { s = JSON.parse(club.settings); } catch {} return { ...DEFAULTS, ...s }; }
function cleanSettings(d, prev) {
  const s = { ...prev };
  if ('name' in d) s.name = str(d.name, 60) || prev.name;
  if ('emoji' in d) s.emoji = str(d.emoji, 8) || '⭐';
  if ('color' in d) s.color = /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : prev.color;
  if ('goal' in d) s.goal = int(d.goal, 3, 20, prev.goal);
  if ('welcome' in d) s.welcome = int(d.welcome, 0, 5, prev.welcome);
  if ('reward' in d) s.reward = str(d.reward, 80) || prev.reward;
  if ('doubleDay' in d) s.doubleDay = d.doubleDay === '' || d.doubleDay === null ? '' : int(d.doubleDay, 0, 6, '');
  if ('phone' in d) s.phone = str(d.phone, 30);
  if ('birthdayGift' in d) s.birthdayGift = str(d.birthdayGift, 80);
  if ('address' in d) s.address = str(d.address, 100);
  if ('refBonus' in d) s.refBonus = int(d.refBonus, 0, 5, prev.refBonus);
  if ('reviewUrl' in d) s.reviewUrl = /^https:\/\/\S+$/.test(str(d.reviewUrl, 300)) ? str(d.reviewUrl, 300) : '';
  if ('reviewAfter' in d) s.reviewAfter = int(d.reviewAfter, 1, 50, prev.reviewAfter);
  if ('minHours' in d) s.minHours = int(d.minHours, 0, 48, prev.minHours);
  return s;
}

const custOut = c => ({ id: c.id, token: c.token, name: c.name, phone: c.phone, birthday: c.birthday, createdAt: c.created, last: c.last, stamps: c.stamps, total: c.total, visits: c.visits, redeemed: c.redeemed, ref: c.referred_by || null, refPaid: !!c.ref_paid, source: c.source });
const evOut = e => ({ id: e.id, cid: e.cid, ts: e.ts, type: e.type, n: e.n, by: e.staff_id || null, flag: e.flag || null });
const ev = (club, cid, type, n, staff, flag = null, ts = Date.now()) => ({ id: rand(12), club_id: club, cid, ts, type, n, staff_id: staff, flag });
const insEv = (db, e) => db.prepare('INSERT INTO events (id,club_id,cid,ts,type,n,staff_id,flag) VALUES (?,?,?,?,?,?,?,?)').bind(e.id, e.club_id, e.cid, e.ts, e.type, e.n, e.staff_id, e.flag);
const isDouble = s => s.doubleDay !== '' && s.doubleDay !== null && new Date(Date.now() - 3 * 3600e3).getUTCDay() === +s.doubleDay; // hora argentina

// límite de intentos (login, altas por QR)
async function limit(db, key, max, windowMs) {
  const now = Date.now();
  const r = await db.prepare('SELECT count,reset FROM attempts WHERE key=?').bind(key).first();
  if (r && r.reset > now && r.count >= max) fail(429, `Demasiados intentos. Probá de nuevo en ${Math.ceil((r.reset - now) / 60000)} min.`);
  if (!r || r.reset <= now) await db.prepare('INSERT OR REPLACE INTO attempts (key,count,reset) VALUES (?,1,?)').bind(key, now + windowMs).run();
  else await db.prepare('UPDATE attempts SET count=count+1 WHERE key=?').bind(key).run();
}
const clearLimit = (db, key) => db.prepare('DELETE FROM attempts WHERE key=?').bind(key).run();

async function auth(db, request) {
  const h = request.headers.get('Authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok) fail(401, 'Iniciá sesión.');
  const s = await db.prepare('SELECT s.club_id, s.staff_id, s.expires, st.name, st.role, st.active FROM sessions s JOIN staff st ON st.id=s.staff_id WHERE s.token=?').bind(await sha256(tok)).first();
  if (!s || s.expires < Date.now() || !s.active) fail(401, 'La sesión venció. Volvé a entrar.');
  const club = await db.prepare('SELECT * FROM clubs WHERE id=?').bind(s.club_id).first();
  if (!club) fail(401, 'El club no existe.');
  return { club, s: settingsOf(club), staff: { id: s.staff_id, name: s.name, role: s.role }, tokHash: await sha256(tok) };
}
const ownerOnly = a => { if (a.staff.role !== 'owner') fail(403, 'Solo el dueño puede hacer esto.'); };

async function custOf(db, a, id) {
  const c = await db.prepare('SELECT * FROM customers WHERE id=? AND club_id=?').bind(String(id || ''), a.club.id).first();
  if (!c) fail(404, 'Cliente no encontrado.');
  return c;
}

// ---------- rutas de la API ----------
async function api(request, env, path) {
  const db = env.DB, m = request.method;
  const body = m === 'GET' || m === 'DELETE' ? {} : await request.json().catch(() => ({}));
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  let mt;

  // ----- públicas -----
  if (m === 'GET' && (mt = path.match(/^club\/([a-z0-9-]{2,40})$/))) {
    const club = await db.prepare('SELECT * FROM clubs WHERE slug=?').bind(mt[1]).first();
    if (!club) fail(404, 'No encontramos ese club.');
    const s = settingsOf(club);
    return { club: { slug: club.slug, name: s.name, emoji: s.emoji, color: s.color, goal: s.goal, welcome: s.welcome, reward: s.reward, refBonus: s.refBonus, address: s.address } };
  }
  if (m === 'POST' && path === 'join') {
    const club = await db.prepare('SELECT * FROM clubs WHERE slug=?').bind(str(body.club, 40)).first();
    if (!club) fail(404, 'No encontramos ese club.');
    await limit(db, `join:${ip}`, 6, 3600e3);
    const s = settingsOf(club);
    const name = str(body.name, 60), phone = str(body.phone, 30), p = normPhone(phone);
    if (name.length < 2) fail(400, 'Poné tu nombre.');
    if (p.length < 8) fail(400, 'El teléfono parece incompleto (con característica, ej.: 2901 471353).');
    const dup = await db.prepare('SELECT id FROM customers WHERE club_id=? AND phone_norm=?').bind(club.id, p).first();
    if (dup) fail(409, 'Ese teléfono ya está en el club. Pedile tu tarjeta al comercio y te la reenvían por WhatsApp.');
    let ref = null;
    if (body.ref) { const r = await db.prepare('SELECT id FROM customers WHERE token=? AND club_id=?').bind(str(body.ref, 20), club.id).first(); ref = r?.id || null; }
    const c = { id: rand(12), token: rand(10), now: Date.now() };
    await db.batch([
      db.prepare('INSERT INTO customers (id,club_id,token,name,phone,phone_norm,birthday,created,last,stamps,total,referred_by,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(c.id, club.id, c.token, name, phone, p, validBirthday(body.birthday), c.now, c.now, s.welcome, s.welcome, ref, 'qr'),
      insEv(db, ev(club.id, c.id, 'join', s.welcome, null, 'qr', c.now)),
    ]);
    return { token: c.token };
  }
  if (m === 'GET' && (mt = path.match(/^card\/([A-Za-z0-9]{6,20})$/))) return { card: await publicCard(db, mt[1]) };

  // ----- sesión -----
  if (m === 'POST' && path === 'login') {
    const slug = str(body.club, 40).toLowerCase(), secret = String(body.secret || '');
    await limit(db, `login:${slug}:${ip}`, 8, 15 * 60e3);
    await limit(db, `login:${slug}`, 40, 3600e3);
    const club = await db.prepare('SELECT * FROM clubs WHERE slug=?').bind(slug).first();
    if (!club || !secret) fail(401, 'Código de club o contraseña incorrectos.');
    const staff = (await db.prepare('SELECT * FROM staff WHERE club_id=? AND active=1 ORDER BY role DESC').bind(club.id).all()).results;
    const isPin = /^\d{4,6}$/.test(secret);
    let who = null;
    for (const st of staff) { if ((st.role === 'owner') === !isPin && await checkSecret(secret, st.secret)) { who = st; break; } }
    if (!who) fail(401, 'Código de club o contraseña incorrectos.');
    await clearLimit(db, `login:${slug}:${ip}`);
    const tok = rand(32);
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE expires < ?').bind(Date.now()),
      db.prepare('INSERT INTO sessions (token,club_id,staff_id,expires) VALUES (?,?,?,?)').bind(await sha256(tok), club.id, who.id, Date.now() + SESSION_DAYS * 864e5),
    ]);
    return { token: tok, slug: club.slug, me: { id: who.id, name: who.name, role: who.role } };
  }

  const a = await auth(db, request);
  if (m === 'POST' && path === 'logout') { await db.prepare('DELETE FROM sessions WHERE token=?').bind(a.tokHash).run(); return { ok: true }; }

  if (m === 'GET' && path === 'state') {
    const since = Date.now() - EVENTS_DAYS * 864e5;
    const [cs, es, st] = await db.batch([
      db.prepare('SELECT * FROM customers WHERE club_id=? ORDER BY last DESC').bind(a.club.id),
      db.prepare('SELECT * FROM events WHERE club_id=? AND ts>=? ORDER BY ts LIMIT 50000').bind(a.club.id, since),
      db.prepare('SELECT id,name,role,active FROM staff WHERE club_id=? ORDER BY role DESC, created').bind(a.club.id),
    ]);
    return { slug: a.club.slug, biz: a.s, customers: cs.results.map(custOut), events: es.results.map(evOut), staff: st.results.filter(x => x.active).map(x => ({ id: x.id, name: x.name, role: x.role })), me: a.staff };
  }

  if (m === 'POST' && path === 'customers') {
    const name = str(body.name, 60), phone = str(body.phone, 30), p = normPhone(phone);
    if (!name) fail(400, 'Poné el nombre del cliente.');
    if (p.length < 8) fail(400, 'El teléfono parece incompleto (con característica, ej.: 2901 471353).');
    const dup = await db.prepare('SELECT name FROM customers WHERE club_id=? AND phone_norm=?').bind(a.club.id, p).first();
    if (dup) fail(409, `Ese teléfono ya es de ${dup.name}.`);
    const now = Date.now(), id = rand(12), e = ev(a.club.id, id, 'join', a.s.welcome, a.staff.id, null, now);
    await db.batch([
      db.prepare('INSERT INTO customers (id,club_id,token,name,phone,phone_norm,birthday,created,last,stamps,total) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id, a.club.id, rand(10), name, phone, p, validBirthday(body.birthday), now, now, a.s.welcome, a.s.welcome),
      insEv(db, e),
    ]);
    return { customer: custOut(await custOf(db, a, id)), events: [evOut(e)] };
  }
  if ((mt = path.match(/^customers\/([A-Za-z0-9]+)$/))) {
    const c = await custOf(db, a, mt[1]);
    if (m === 'PUT') {
      const name = str(body.name, 60) || c.name, phone = body.phone !== undefined ? str(body.phone, 30) : c.phone, p = normPhone(phone);
      if (p.length < 8) fail(400, 'El teléfono parece incompleto.');
      const dup = await db.prepare('SELECT name FROM customers WHERE club_id=? AND phone_norm=? AND id<>?').bind(a.club.id, p, c.id).first();
      if (dup) fail(409, `Ese teléfono ya es de ${dup.name}.`);
      const bd = body.birthday !== undefined ? validBirthday(body.birthday) : c.birthday;
      await db.prepare('UPDATE customers SET name=?,phone=?,phone_norm=?,birthday=? WHERE id=?').bind(name, phone, p, bd, c.id).run();
      return { customer: custOut(await custOf(db, a, c.id)) };
    }
    if (m === 'DELETE') {
      ownerOnly(a);
      await db.batch([db.prepare('DELETE FROM events WHERE cid=? AND club_id=?').bind(c.id, a.club.id), db.prepare('DELETE FROM customers WHERE id=?').bind(c.id)]);
      return { ok: true };
    }
  }

  if (m === 'POST' && path === 'stamp') {
    const c = await custOf(db, a, body.cid);
    const last = await db.prepare("SELECT ts FROM events WHERE cid=? AND type='stamp' ORDER BY ts DESC LIMIT 1").bind(c.id).first();
    const mins = last ? Math.round((Date.now() - last.ts) / 60000) : null;
    let flag = null;
    if (a.s.minHours > 0 && last && Date.now() - last.ts < a.s.minHours * 3600e3) {
      if (!body.force) fail(409, `A ${c.name.split(' ')[0]} ya le sumaron un sello ${mins < 2 ? 'recién' : 'hace ' + (mins < 60 ? mins + ' min' : Math.round(mins / 60) + ' h')}.`, { code: 'recent', mins });
      flag = 'forced';
    }
    const mult = isDouble(a.s) ? 2 : 1;
    const added = int(body.n, 1, 5, 1) * mult;
    const now = Date.now(), evs = [ev(a.club.id, c.id, 'stamp', added, a.staff.id, flag, now)];
    const stmts = [db.prepare('UPDATE customers SET stamps=stamps+?, total=total+?, visits=visits+1, last=? WHERE id=?').bind(added, added, now, c.id)];
    // referido: en su primera visita ganan los dos
    let referrer = null;
    if (c.referred_by && !c.ref_paid && c.visits === 0 && a.s.refBonus > 0) {
      referrer = await db.prepare('SELECT * FROM customers WHERE id=? AND club_id=?').bind(c.referred_by, a.club.id).first();
      stmts.push(db.prepare('UPDATE customers SET ref_paid=1, stamps=stamps+?, total=total+? WHERE id=?').bind(a.s.refBonus, a.s.refBonus, c.id));
      evs.push(ev(a.club.id, c.id, 'ref', a.s.refBonus, a.staff.id, null, now + 1));
      if (referrer) {
        stmts.push(db.prepare('UPDATE customers SET stamps=stamps+?, total=total+? WHERE id=?').bind(a.s.refBonus, a.s.refBonus, referrer.id));
        evs.push(ev(a.club.id, referrer.id, 'ref', a.s.refBonus, a.staff.id, null, now + 2));
      }
    }
    await db.batch([...stmts, ...evs.map(e => insEv(db, e))]);
    const out = { customer: custOut(await custOf(db, a, c.id)), events: evs.map(evOut), added, double: mult > 1 };
    if (referrer) out.referrer = custOut(await custOf(db, a, referrer.id));
    return out;
  }
  if (m === 'POST' && path === 'redeem') {
    const c = await custOf(db, a, body.cid);
    if (c.stamps < a.s.goal) fail(400, 'Todavía no tiene un premio para canjear.');
    const e = ev(a.club.id, c.id, 'redeem', a.s.goal, a.staff.id);
    await db.batch([db.prepare('UPDATE customers SET stamps=stamps-?, redeemed=redeemed+1, last=? WHERE id=?').bind(a.s.goal, e.ts, c.id), insEv(db, e)]);
    return { customer: custOut(await custOf(db, a, c.id)), events: [evOut(e)] };
  }
  if (m === 'POST' && path === 'undo') {
    const c = await custOf(db, a, body.cid);
    const e = await db.prepare("SELECT * FROM events WHERE cid=? AND type IN ('stamp','redeem') ORDER BY ts DESC LIMIT 1").bind(c.id).first();
    if (!e) fail(400, 'No hay nada para deshacer.');
    if (Date.now() - e.ts > UNDO_MIN * 60e3) fail(400, `Solo se puede deshacer en los primeros ${UNDO_MIN} minutos.`);
    if (a.staff.role !== 'owner' && e.staff_id !== a.staff.id) fail(403, 'Ese movimiento lo hizo otra persona.');
    const removed = [e.id], stmts = [db.prepare('DELETE FROM events WHERE id=?').bind(e.id)];
    if (e.type === 'stamp') {
      stmts.push(db.prepare('UPDATE customers SET stamps=stamps-?, total=total-?, visits=visits-1 WHERE id=?').bind(e.n, e.n, c.id));
      // si esa visita pagó un referido, se revierte también
      const refs = (await db.prepare("SELECT * FROM events WHERE club_id=? AND type='ref' AND ts BETWEEN ? AND ? AND cid IN (?,?)").bind(a.club.id, e.ts + 1, e.ts + 2, c.id, c.referred_by || '').all()).results;
      for (const r of refs) {
        removed.push(r.id);
        stmts.push(db.prepare('DELETE FROM events WHERE id=?').bind(r.id), db.prepare('UPDATE customers SET stamps=stamps-?, total=total-? WHERE id=?').bind(r.n, r.n, r.cid));
        if (r.cid === c.id) stmts.push(db.prepare('UPDATE customers SET ref_paid=0 WHERE id=?').bind(c.id));
      }
    } else stmts.push(db.prepare('UPDATE customers SET stamps=stamps+?, redeemed=redeemed-1 WHERE id=?').bind(e.n, c.id));
    await db.batch(stmts);
    const touched = [...new Set([c.id, c.referred_by].filter(Boolean))];
    const customers = [];
    for (const id of touched) { const x = await db.prepare('SELECT * FROM customers WHERE id=?').bind(id).first(); if (x) customers.push(custOut(x)); }
    return { type: e.type, removed, customers };
  }

  // ----- dueño -----
  if (m === 'PUT' && path === 'settings') {
    ownerOnly(a);
    const s = cleanSettings(body, a.s);
    await db.prepare('UPDATE clubs SET settings=? WHERE id=?').bind(JSON.stringify(s), a.club.id).run();
    return { biz: s };
  }
  if (path === 'staff' && m === 'POST') {
    ownerOnly(a);
    const name = str(body.name, 40), pin = String(body.pin || '');
    if (!name) fail(400, 'Poné el nombre del empleado.');
    if (!/^\d{4,6}$/.test(pin)) fail(400, 'El PIN tiene que ser de 4 a 6 números.');
    const all = (await db.prepare('SELECT * FROM staff WHERE club_id=? AND active=1').bind(a.club.id).all()).results;
    if (all.length >= MAX_STAFF) fail(400, 'Llegaste al máximo de empleados.');
    for (const st of all) if (st.role === 'staff' && await checkSecret(pin, st.secret)) fail(409, `Ese PIN ya lo usa ${st.name}. Elegí otro.`);
    await db.prepare('INSERT INTO staff (id,club_id,name,role,secret,created) VALUES (?,?,?,?,?,?)').bind(rand(12), a.club.id, name, 'staff', await hashSecret(pin, 60000), Date.now()).run();
    return { ok: true };
  }
  if ((mt = path.match(/^staff\/([A-Za-z0-9]+)$/)) && m === 'DELETE') {
    ownerOnly(a);
    const st = await db.prepare("SELECT * FROM staff WHERE id=? AND club_id=? AND role='staff'").bind(mt[1], a.club.id).first();
    if (!st) fail(404, 'Empleado no encontrado.');
    await db.batch([db.prepare('UPDATE staff SET active=0 WHERE id=?').bind(st.id), db.prepare('DELETE FROM sessions WHERE staff_id=?').bind(st.id)]);
    return { ok: true };
  }
  if (m === 'POST' && path === 'password') {
    ownerOnly(a);
    const me = await db.prepare('SELECT * FROM staff WHERE id=?').bind(a.staff.id).first();
    if (!(await checkSecret(String(body.current || ''), me.secret))) fail(400, 'La contraseña actual no es correcta.');
    const p = String(body.password || '');
    if (p.length < 10 || !/\d/.test(p) || !/[a-zA-Z]/.test(p)) fail(400, 'Usá al menos 10 caracteres, con letras y números.');
    await db.batch([
      db.prepare('UPDATE staff SET secret=? WHERE id=?').bind(await hashSecret(p), me.id),
      db.prepare('DELETE FROM sessions WHERE staff_id=? AND token<>?').bind(me.id, a.tokHash),
    ]);
    return { ok: true };
  }
  fail(404, 'Ruta inexistente.');
}

async function publicCard(db, token) {
  const c = await db.prepare('SELECT * FROM customers WHERE token=?').bind(token).first();
  if (!c) fail(404, 'No encontramos tu tarjeta.');
  const club = await db.prepare('SELECT * FROM clubs WHERE id=?').bind(c.club_id).first();
  const s = settingsOf(club);
  return {
    v: 2, ts: Date.now(),
    b: { n: s.name, e: s.emoji, c: s.color, p: s.phone, g: s.goal, r: s.reward, a: s.address, d: s.doubleDay, slug: club.slug, rb: s.refBonus, rv: c.visits >= s.reviewAfter ? s.reviewUrl : '' },
    c: { n: c.name, s: c.stamps, t: c.total, v: c.visits, r: c.redeemed, j: c.created, l: c.last, k: c.token },
  };
}

// ---------- páginas con vista previa para WhatsApp ----------
async function page(request, env, url) {
  const res = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  let title = 'Zenix Club', desc = 'Tu tarjeta de sellos digital.';
  try {
    const [, kind, a] = url.pathname.split('/');
    if (kind === 't') { const c = await publicCard(env.DB, a); title = `${c.b.n} · Tu tarjeta de sellos`; desc = `${c.c.n.split(' ')[0]}, llevás ${c.c.s % c.b.g || (c.c.s >= c.b.g ? c.b.g : 0)} de ${c.b.g} sellos. Premio: ${c.b.r}.`; }
    if (kind === 'u') { const club = await env.DB.prepare('SELECT * FROM clubs WHERE slug=?').bind(a).first(); if (club) { const s = settingsOf(club); title = `Sumate al club de ${s.name}`; desc = `Con ${s.goal} sellos te llevás: ${s.reward}.`; } }
  } catch {}
  return new HTMLRewriter()
    .on('head', { element: e => e.prepend('<base href="/">', { html: true }) })
    .on('title', { element: e => e.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: e => e.setAttribute('content', title) })
    .on('meta[property="og:description"]', { element: e => e.setAttribute('content', desc) })
    .transform(new Response(res.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }));
}

function cors(request) {
  const o = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.some(r => r.test(o)) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : {};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...cors(request) };
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
      try { return new Response(JSON.stringify(await api(request, env, url.pathname.slice(5).replace(/\/$/, ''))), { headers: h }); }
      catch (e) {
        if (e instanceof HttpError) return new Response(JSON.stringify({ error: e.message, ...e.extra }), { status: e.status, headers: h });
        console.error(e); return new Response(JSON.stringify({ error: 'Error del servidor. Probá de nuevo.' }), { status: 500, headers: h });
      }
    }
    if (/^\/(t|u)\/[A-Za-z0-9-]+(\/[A-Za-z0-9]+)?\/?$/.test(url.pathname)) return page(request, env, url);
    return env.ASSETS.fetch(request);
  },
};
