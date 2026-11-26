// Flama Burguer · tienda + API en un solo Cloudflare Worker con D1.
// Assets: la carpeta flama/ (la tienda). Binding D1: DB → base "flama".
//
// Públicas:  GET  /api/catalog            productos activos + datos del negocio
//            GET  /api/img/:key           foto subida desde el panel (caché larga)
// Sesión:    POST /api/login              {password} → {token}
//            POST /api/logout
// Dueño:     GET  /api/admin/catalog      todos los productos (también ocultos)
//            PUT  /api/admin/product      {product}  crea o actualiza; image puede ser data:image/jpeg;base64
//            DELETE /api/admin/product/:id
//            PUT  /api/admin/settings     {settings}
//            POST /api/admin/password     {current,next}

const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 8;           // intentos fallidos por IP cada 15 minutos
const MAX_IMAGE = 1_500_000;      // bytes
const ALLOWED_ORIGINS = [/^https:\/\/flama\.zenix\.com\.ar$/, /^https:\/\/josenunezapps\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.workers\.dev$/];

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const token = (n = 32) => b64(crypto.getRandomValues(new Uint8Array(n))).replace(/[+/=]/g, '').slice(0, n);
const now = () => Date.now();

function cors(req) {
  const o = req.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.some(r => r.test(o))) return {};
  return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...extra } });

async function body(req) {
  if (Number(req.headers.get('Content-Length') || 0) > 2_500_000) fail(413, 'La foto es demasiado grande.');
  try { return await req.json(); } catch { fail(400, 'Datos inválidos.'); }
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
}
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }

async function requireOwner(req, env) {
  const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!/^[A-Za-z0-9]{20,64}$/.test(t)) fail(401, 'Iniciá sesión de nuevo.');
  const row = await env.DB.prepare('SELECT expires FROM sessions WHERE token = ?').bind(t).first();
  if (!row || row.expires < now()) fail(401, 'La sesión venció. Iniciá sesión de nuevo.');
  return t;
}

async function catalog(env, admin) {
  const [rows, s] = await Promise.all([
    env.DB.prepare(`SELECT id, data, active FROM products ${admin ? '' : 'WHERE active = 1'} ORDER BY position, id`).all(),
    env.DB.prepare('SELECT data FROM settings WHERE id = 1').first(),
  ]);
  return { products: rows.results.map(r => ({ ...JSON.parse(r.data), id: r.id, active: !!r.active })), settings: s ? JSON.parse(s.data) : {} };
}

function cleanProduct(p) {
  if (!p || typeof p !== 'object') fail(400, 'Producto inválido.');
  const id = str(p.id, 100) || crypto.randomUUID();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) fail(400, 'Identificador inválido.');
  const name = str(p.name, 100); if (!name) fail(400, 'Escribí un nombre.');
  const category = str(p.category, 40) || 'Hamburguesas';
  const variants = (Array.isArray(p.variants) ? p.variants : []).slice(0, 10).map(v => ({ name: str(v?.name, 50), price: Math.round(Number(v?.price)) }));
  if (!variants.length || variants.some(v => !v.name || !Number.isSafeInteger(v.price) || v.price <= 0 || v.price > 100000000)) fail(400, 'Revisá los nombres y precios de las variantes.');
  return { id, name, category, description: str(p.description, 700), image: String(p.image || ''), active: p.active !== false, demo: !!p.demo, variants };
}

async function saveImage(env, id, image) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!m) {
    if (image === '' || /^img\/[a-z0-9_-]+\.webp(\?v=\d+)?$/.test(image) || /^\/api\/img\/[A-Za-z0-9_-]+$/.test(image) || /^https:\/\/[^\s"'<>]{1,500}$/.test(image)) return image;
    fail(400, 'Foto inválida.');
  }
  const bytes = unb64(m[2]);
  if (bytes.length > MAX_IMAGE) fail(413, 'La foto es demasiado grande.');
  const key = `${id}-${now().toString(36)}`;
  await env.DB.prepare('INSERT INTO images (key, type, data, created) VALUES (?, ?, ?, ?)').bind(key, m[1], bytes, now()).run();
  return `/api/img/${key}`;
}

async function oldImageKey(env, id) {
  const row = await env.DB.prepare('SELECT data FROM products WHERE id = ?').bind(id).first();
  const img = row ? JSON.parse(row.data).image || '' : '';
  return (/^\/api\/img\/([A-Za-z0-9_-]+)$/.exec(img) || [])[1] || null;
}

async function api(req, env, url) {
  const path = url.pathname.replace(/^\/api\//, '');
  const m = req.method;

  if (m === 'GET' && path === 'catalog') return json(req, await catalog(env, false));

  if (m === 'GET' && path.startsWith('img/')) {
    const key = path.slice(4);
    if (!/^[A-Za-z0-9_-]{1,140}$/.test(key)) fail(404, 'No encontrada.');
    const row = await env.DB.prepare('SELECT type, data FROM images WHERE key = ?').bind(key).first();
    if (!row) fail(404, 'No encontrada.');
    return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': row.type, 'Cache-Control': 'public, max-age=31536000, immutable', ...cors(req) } });
  }

  if (m === 'POST' && path === 'login') {
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const since = now() - 15 * 60 * 1000;
    const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip = ? AND at > ?').bind(ip, since).first();
    if (n >= MAX_ATTEMPTS) fail(429, 'Demasiados intentos. Probá de nuevo en 15 minutos.');
    const { password } = await body(req);
    const auth = await env.DB.prepare('SELECT salt, hash FROM auth WHERE id = 1').first();
    if (!auth || !same(await hashPassword(String(password || ''), unb64(auth.salt)), auth.hash)) {
      await env.DB.batch([env.DB.prepare('INSERT INTO attempts (ip, at) VALUES (?, ?)').bind(ip, now()), env.DB.prepare('DELETE FROM attempts WHERE at < ?').bind(since)]);
      fail(401, 'Contraseña incorrecta.');
    }
    const t = token();
    await env.DB.batch([env.DB.prepare('INSERT INTO sessions (token, expires) VALUES (?, ?)').bind(t, now() + SESSION_DAYS * 86400000), env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now())]);
    return json(req, { token: t });
  }

  if (m === 'POST' && path === 'logout') {
    const t = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (t) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(t).run();
    return json(req, { ok: true });
  }

  if (!path.startsWith('admin/')) fail(404, 'No encontrado.');
  const session = await requireOwner(req, env);

  if (m === 'GET' && path === 'admin/catalog') return json(req, await catalog(env, true));

  if (m === 'PUT' && path === 'admin/product') {
    const p = cleanProduct((await body(req)).product);
    const old = await oldImageKey(env, p.id);
    p.image = await saveImage(env, p.id, p.image);
    const exists = await env.DB.prepare('SELECT position FROM products WHERE id = ?').bind(p.id).first();
    const position = exists ? exists.position : ((await env.DB.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM products').first()).p);
    const stmts = [env.DB.prepare('INSERT INTO products (id, data, active, position) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, active = excluded.active').bind(p.id, JSON.stringify(p), p.active ? 1 : 0, position)];
    if (old && p.image !== `/api/img/${old}`) stmts.push(env.DB.prepare('DELETE FROM images WHERE key = ?').bind(old));
    await env.DB.batch(stmts);
    return json(req, await catalog(env, true));
  }

  if (m === 'DELETE' && path.startsWith('admin/product/')) {
    const id = decodeURIComponent(path.slice('admin/product/'.length));
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) fail(400, 'Identificador inválido.');
    const old = await oldImageKey(env, id);
    const stmts = [env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id)];
    if (old) stmts.push(env.DB.prepare('DELETE FROM images WHERE key = ?').bind(old));
    await env.DB.batch(stmts);
    return json(req, await catalog(env, true));
  }

  if (m === 'PUT' && path === 'admin/settings') {
    const s = (await body(req)).settings || {};
    const cur = JSON.parse((await env.DB.prepare('SELECT data FROM settings WHERE id = 1').first())?.data || '{}');
    const phone = str(s.phone, 15);
    if (!/^[0-9]{10,15}$/.test(phone)) fail(400, 'El WhatsApp tiene que tener entre 10 y 15 números.');
    const storeStatus = ['auto', 'open', 'closed'].includes(s.storeStatus) ? s.storeStatus : 'auto';
    const next = { ...cur, phone, address: str(s.address, 150), hours: str(s.hours, 100), storeStatus, scheduleDefault: storeStatus === 'auto',
      categories: [...new Set((Array.isArray(s.categories) ? s.categories : []).map(c => str(c, 40)).filter(Boolean))].slice(0, 15) };
    await env.DB.prepare('INSERT INTO settings (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data').bind(JSON.stringify(next)).run();
    return json(req, await catalog(env, true));
  }

  if (m === 'POST' && path === 'admin/password') {
    const { current, next } = await body(req);
    const auth = await env.DB.prepare('SELECT salt, hash FROM auth WHERE id = 1').first();
    if (!same(await hashPassword(String(current || ''), unb64(auth.salt)), auth.hash)) fail(401, 'La contraseña actual no es correcta.');
    if (String(next || '').length < 8) fail(400, 'La nueva contraseña tiene que tener al menos 8 caracteres.');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await env.DB.batch([
      env.DB.prepare('UPDATE auth SET salt = ?, hash = ? WHERE id = 1').bind(b64(salt), await hashPassword(String(next), salt)),
      env.DB.prepare('DELETE FROM sessions WHERE token <> ?').bind(session),
    ]);
    return json(req, { ok: true });
  }

  fail(404, 'No encontrado.');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
      try { return await api(req, env, url); }
      catch (e) {
        if (e instanceof HttpError) return json(req, { error: e.message }, e.status);
        console.error(e);
        return json(req, { error: 'Error del servidor. Probá de nuevo.' }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
