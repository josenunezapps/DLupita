// Prueba end-to-end de Zenix OS en Chrome (Playwright) con un backend Supabase SIMULADO en memoria.
// Verifica la interfaz, los permisos por rol en pantalla y el uso correcto de la API. La seguridad real
// (RLS, roles, stock) se prueba en la base con supabase/tests/0001_nucleo.sql.
// Uso: node zenix-os-p4w8n/tests/e2e.mjs [carpeta-capturas]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const shotsDir = process.argv[2] || path.join(here, 'capturas');
fs.mkdirSync(shotsDir, { recursive: true });
const { SUPABASE_URL: SUPA, SUPABASE_KEY: KEY } = await import('../app/config.js');
const SUPA_BASE = SUPA.startsWith('http') ? SUPA : 'https://simulado.supabase.co';

// Si la config todavía no apunta a un proyecto real, la app se sirve con una config de prueba.
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.endsWith('/zenix-os-p4w8n/app/config.js') && !SUPA.startsWith('http')) {
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    return res.end(`export const SUPABASE_URL='${SUPA_BASE}'; export const SUPABASE_KEY='sb_publishable_prueba'; export const APP_VERSION='test';`);
  }
  let file = path.join(repoRoot, url);
  if (!file.startsWith(repoRoot)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/zenix-os-p4w8n/`;
const API_KEY = SUPA.startsWith('http') ? KEY : 'sb_publishable_prueba';

// ---------------- Backend simulado ----------------
function createBackend() {
  const users = new Map();
  const tokens = new Map();
  const db = { organizations: [], organization_members: [], invitations: [], categories: [], products: [], stock_movements: [], customers: [] };
  const calls = [];
  let seq = 0;
  let movSeq = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const now = () => new Date(Date.now() + seq).toISOString();

  function session(user) {
    const access = `tok-${user.id}-${seq++}`;
    const refresh = `ref-${user.id}-${seq++}`;
    tokens.set(access, user.id);
    tokens.set(refresh, user.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, token_type: 'bearer', user: { id: user.id, email: user.email } };
  }
  const stockOf = (pid) => db.stock_movements.filter((m) => m.product_id === pid).reduce((s, m) => s + m.qty_milli, 0);

  function applyFilters(rows, params) {
    let out = rows;
    for (const [k, val] of params) {
      if (['select', 'order', 'limit'].includes(k)) continue;
      const [op, ...rest] = val.split('.');
      const arg = rest.join('.');
      if (op === 'eq') out = out.filter((r) => String(r[k]) === arg);
      else throw new Error(`filtro no soportado ${k}=${val}`);
    }
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col]), 'es') * (dir === 'desc' ? -1 : 1));
    }
    const limit = Number(params.get('limit') || 0);
    return limit ? out.slice(0, limit) : out;
  }

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    // La app agrega el prefijo zos_ a tablas y funciones; el simulador trabaja sin prefijo.
    const prefixed = url.pathname.startsWith('/rest/v1/');
    if (prefixed && !/^\/rest\/v1\/(rpc\/)?zos_/.test(url.pathname)) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"tabla sin prefijo zos_"}' });
    url.pathname = url.pathname.replace('/rest/v1/zos_', '/rest/v1/').replace('/rpc/zos_', '/rpc/');
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const authz = req.headers()['authorization'] || '';
    const uid = tokens.get(authz.replace('Bearer ', ''));
    calls.push({ method, path: url.pathname + url.search, apikey: req.headers()['apikey'] });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    const err = (message, status = 400) => json(status, { code: 'P0001', message });
    if (req.headers()['apikey'] !== API_KEY) return json(401, { message: 'apikey inválida' });

    if (url.pathname === '/auth/v1/signup') {
      if (users.has(body.email)) return json(422, { error_code: 'user_already_exists', msg: 'User already registered' });
      const u = { id: uuid(), email: body.email, password: body.password };
      users.set(body.email, u);
      return json(200, session(u));
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password') {
        const u = users.get(body.email);
        if (!u || u.password !== body.password) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        return json(200, session(u));
      }
      const id = tokens.get(body.refresh_token);
      if (!id) return json(400, { error: 'invalid_grant' });
      return json(200, session([...users.values()].find((u) => u.id === id)));
    }
    if (url.pathname === '/auth/v1/logout') { tokens.delete(authz.replace('Bearer ', '')); return route.fulfill({ status: 204 }); }

    if (!uid) return json(401, { message: 'JWT expired' });
    const email = [...users.values()].find((u) => u.id === uid)?.email;
    const mem = db.organization_members.find((m) => m.user_id === uid);
    const active = mem && mem.active ? mem : null;
    const org = active ? db.organizations.find((o) => o.id === active.organization_id) : null;
    const role = active?.role;
    const isRole = (...r) => r.includes(role);
    const rpc = url.pathname.startsWith('/rest/v1/rpc/') ? url.pathname.slice(13) : null;

    if (rpc === 'create_organization') {
      if (mem) return err('Tu cuenta ya pertenece a un negocio');
      const o = { id: uuid(), name: body.p_name, phone: null, address: null, currency: body.p_currency, timezone: body.p_timezone, allow_negative_stock: false };
      db.organizations.push(o);
      db.organization_members.push({ organization_id: o.id, user_id: uid, role: 'owner', email, active: true, created_at: now() });
      return json(200, o.id);
    }
    if (rpc === 'accept_invitation') {
      if (mem) return err('Tu cuenta ya pertenece a un negocio');
      const inv = db.invitations.find((i) => i.code === body.p_code.toUpperCase());
      if (!inv || inv.revoked || inv.used_by) return err('El código no es válido o ya venció. Pedile uno nuevo al dueño.');
      inv.used_by = uid; inv.used_at = now();
      db.organization_members.push({ organization_id: inv.organization_id, user_id: uid, role: inv.role, email, active: true, created_at: now() });
      return json(200, inv.organization_id);
    }
    if (!active) return json(200, url.pathname.endsWith('organization_members') ? db.organization_members.filter((m) => m.user_id === uid) : []);
    if (rpc === 'create_invitation') {
      if (!isRole('owner')) return err('Solo el dueño puede invitar');
      const code = `AB${String(++seq).padStart(6, '0').replace(/0/g, 'C')}`.slice(0, 8);
      const inv = { id: uuid(), organization_id: org.id, code, role: body.p_role, created_at: now(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), used_by: null, used_at: null, revoked: false };
      db.invitations.push(inv);
      return json(200, { id: inv.id, code, role: inv.role, expires_at: inv.expires_at });
    }
    if (rpc === 'revoke_invitation') { const i = db.invitations.find((x) => x.id === body.p_id); i.revoked = true; return json(200, null); }
    if (rpc === 'update_member') {
      if (!isRole('owner')) return err('Solo el dueño puede cambiar el equipo');
      if (body.p_user === uid) return err('No podés cambiar tu propio rol ni desactivarte');
      const m = db.organization_members.find((x) => x.user_id === body.p_user && x.organization_id === org.id);
      m.role = body.p_role; m.active = body.p_active;
      return json(200, null);
    }
    if (rpc === 'create_product') {
      if (!isRole('owner', 'supervisor')) return err('No tenés permiso para cargar productos');
      const d = body.p_data;
      if (d.sku && db.products.some((p) => p.organization_id === org.id && (p.sku || '').toLowerCase() === d.sku.toLowerCase())) return json(409, { code: '23505', message: 'duplicate key' });
      const p = { id: uuid(), organization_id: org.id, active: true, ...d };
      db.products.push(p);
      if (body.p_initial_milli > 0 && d.track_stock) db.stock_movements.push({ id: ++movSeq, organization_id: org.id, product_id: p.id, qty_milli: body.p_initial_milli, kind: 'inicial', reason: 'Stock inicial', created_at: now() });
      return json(200, p.id);
    }
    if (rpc === 'adjust_stock') {
      if (!isRole('owner', 'supervisor')) return err('No tenés permiso para mover stock de este producto');
      const s = stockOf(body.p_product);
      const delta = body.p_kind === 'salida' ? -body.p_qty_milli : body.p_kind === 'ajuste' ? body.p_qty_milli - s : body.p_qty_milli;
      if (!org.allow_negative_stock && s + delta < 0) return err(`No hay stock suficiente: quedarían ${(s + delta) / 1000} unidades`);
      db.stock_movements.push({ id: ++movSeq, organization_id: org.id, product_id: body.p_product, qty_milli: delta, kind: body.p_kind, reason: body.p_reason || null, created_at: now() });
      return json(200, s + delta);
    }

    const table = url.pathname.replace('/rest/v1/', '');
    if (!db[table]) return json(404, { message: 'tabla desconocida' });
    const visible = (r) => (table === 'organizations' ? r.id : r.organization_id) === org.id;
    if (method === 'GET') {
      if (table === 'invitations' && !isRole('owner')) return json(200, []);
      let rows = applyFilters(db[table].filter(visible), url.searchParams);
      if (table === 'products') rows = rows.map((p) => ({ ...p, stock_milli: stockOf(p.id) }));
      if (table === 'stock_movements') rows = rows.map((m) => { const p = db.products.find((x) => x.id === m.product_id); return { ...m, zos_products: { name: p.name, unit: p.unit } }; });
      return json(200, rows);
    }
    if (method === 'POST') {
      if (table === 'categories' && !isRole('owner', 'supervisor')) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
      if (body.organization_id !== org.id) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
      if (table === 'categories' && db.categories.some((c) => c.organization_id === org.id && c.name.toLowerCase() === body.name.toLowerCase())) return json(409, { code: '23505', message: 'duplicate key' });
      const row = { id: uuid(), archived: false, created_at: now(), ...body };
      db[table].push(row);
      return json(201, [row]);
    }
    if (method === 'PATCH') {
      if ((table === 'organizations' && !isRole('owner')) || (['products', 'categories'].includes(table) && !isRole('owner', 'supervisor'))) return json(200, []);
      const id = url.searchParams.get('id').replace('eq.', '');
      const row = db[table].find((r) => r.id === id && visible(r));
      if (!row) return json(200, []);
      Object.assign(row, body);
      return json(200, [row]);
    }
    return json(405, { message: 'no soportado' });
  }
  return { handle, calls, db };
}

// ---------------- Pruebas ----------------
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'OK ' : 'NG '} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function run(vp, viewport) {
  const backend = createBackend();
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const context = await browser.newContext({ viewport, locale: 'es-AR', deviceScaleFactor: vp === 'movil' ? 2 : 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.route(`${SUPA_BASE}/**`, (r) => backend.handle(r));
  const otherRequests = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith(SUPA_BASE) && !u.startsWith('data:')) otherRequests.push(u); });
  const shot = (name) => page.screenshot({ path: path.join(shotsDir, `${vp}-${name}.png`), fullPage: true });
  const p = `[${vp}]`;
  const nav = (label) => (vp === 'movil' ? `.tabbar >> text=${label}` : `.sidenav >> text=${label}`);
  const salir = () => page.click(vp === 'movil' ? '.topbar >> text=Salir' : '.sidenav >> text=Salir');
  const owner = `dueno+${vp}@ejemplo.com`;
  const seller = `vendedor+${vp}@ejemplo.com`;

  async function register(email, pass) {
    await page.click('text=Creala gratis');
    await page.waitForSelector('h1:has-text("Creá tu cuenta")');
    await page.fill('[name=email]', email);
    await page.fill('[name=password]', pass);
    await page.fill('[name=password2]', pass);
    await page.click('button:has-text("Crear cuenta")');
    await page.waitForSelector('h1:has-text("¡Bienvenido!")');
  }

  try {
    // 1. Dueño crea el negocio
    await page.goto(BASE);
    await page.waitForSelector('h1:has-text("Ingresá a tu cuenta")');
    await register(owner, 'clave1234');
    check(`${p} Sin invitación, primero ofrece crear el negocio`, (await page.$$eval('.auth-card h2', (e) => e.map((x) => x.textContent)))[0].includes('crear mi negocio'));
    await page.fill('[name=name]', 'Almacén Russo');
    await page.click('button:has-text("Crear mi negocio")');
    await page.waitForSelector('h1:has-text("Inicio")');
    check(`${p} Negocio creado; el dueño ve Equipo y Negocio`, (await page.isVisible(nav('Equipo'))) && (await page.isVisible(nav('Negocio'))));
    await shot('01-inicio-vacio');

    // 2. Categorías
    await page.click(nav('Productos'));
    await page.click('button:has-text("Categorías")');
    await page.fill('dialog [name=cat]', 'Bebidas');
    await page.click('dialog button:has-text("Agregar")');
    await page.waitForSelector('dialog .row-title:has-text("Bebidas")');
    await page.fill('dialog [name=cat]', 'Almacén');
    await page.click('dialog button:has-text("Agregar")');
    await page.waitForSelector('dialog .row-title:has-text("Almacén")');
    await page.fill('dialog [name=cat]', 'bebidas');
    await page.click('dialog button:has-text("Agregar")');
    await page.waitForSelector('dialog >> text=Esa categoría ya existe.');
    check(`${p} Categorías: alta y duplicado rechazado`, backend.db.categories.length === 2);
    await page.click('dialog button:has-text("Listo")');

    // 3. Productos
    async function newProduct({ name, sku = '', cat = '', price, cost = '', min = '', initial = '', track = true }) {
      await page.click('text=+ Nuevo producto');
      await page.waitForSelector('h1:has-text("Nuevo producto")');
      await page.fill('[name=name]', name);
      if (sku) await page.fill('[name=sku]', sku);
      if (cat) await page.selectOption('[name=category_id]', { label: cat });
      await page.fill('[name=price]', price);
      if (cost) await page.fill('[name=cost]', cost);
      if (!track) await page.uncheck('[name=track_stock]');
      if (track && min) await page.fill('[name=min_stock]', min);
      if (track && initial) await page.fill('[name=initial]', initial);
      await page.click('button:has-text("Guardar producto")');
    }
    await newProduct({ name: 'Coca-Cola 1,5 L', sku: '7790895000997', cat: 'Bebidas', price: '2.500', cost: '1.800', min: '6', initial: '24' });
    await page.waitForSelector('.row-title:has-text("Coca-Cola")');
    await newProduct({ name: 'Yerba 1 kg', cat: 'Almacén', price: '4.200', min: '5', initial: '3' });
    await page.waitForSelector('.row-title:has-text("Yerba")');
    await newProduct({ name: 'Coca-Cola repetida', sku: '7790895000997', price: '1' });
    await page.waitForSelector('text=Ya hay otro producto con ese código.');
    check(`${p} Código repetido rechazado con mensaje claro`, true);
    await page.click('text=← Volver');
    await newProduct({ name: 'Bolsa de hielo', price: '1.500', track: false });
    await page.waitForSelector('.row-title:has-text("Bolsa de hielo")');
    const rows = await page.$$eval('.list .row-item', (els) => els.map((e) => e.textContent));
    check(`${p} Lista con stock, bajo mínimo y sin control`, rows.some((r) => r.includes('Coca-Cola') && r.includes('24')) && rows.some((r) => r.includes('Yerba') && r.includes('Bajo')) && rows.some((r) => r.includes('Bolsa de hielo') && r.includes('Sin control')), rows.length + ' productos');
    check(`${p} Stock inicial guardado como movimiento`, backend.db.stock_movements.length === 2 && backend.db.stock_movements[0].qty_milli === 24000);
    await page.click('.chip:has-text("Bebidas")');
    check(`${p} Filtro por categoría`, (await page.$$('.list .row-item')).length === 1);
    await shot('02-productos');

    // 4. Stock
    await page.click(nav('Stock'));
    await page.waitForSelector('.chip:has-text("Bajo o agotado")');
    check(`${p} Stock: chip de alertas cuenta 1`, (await page.textContent('.chip:has-text("Bajo o agotado")')).includes('1'));
    await page.click('.list .row-item:has-text("Coca-Cola")');
    await page.waitForSelector('dialog h2:has-text("Coca-Cola")');
    await page.click('dialog .chip:has-text("Salida")');
    await page.fill('#m-qty', '30');
    await page.fill('#m-reason', 'Rotura');
    await page.click('dialog button:has-text("Registrar")');
    check(`${p} Salida mayor al stock: bloqueada`, await page.isVisible('dialog >> text=No hay stock suficiente'));
    await page.fill('#m-qty', '2');
    check(`${p} Vista previa del stock resultante`, (await page.textContent('dialog .hint')).includes('queda en 22'));
    await page.click('dialog button:has-text("Registrar")');
    await page.waitForSelector('dialog', { state: 'detached' });
    await page.click('.list .row-item:has-text("Coca-Cola")');
    await page.click('dialog .chip:has-text("Ajuste por conteo")');
    await page.fill('#m-qty', '20');
    await page.click('dialog button:has-text("Registrar")');
    check(`${p} Ajuste exige motivo`, await page.isVisible('dialog >> text=Indicá el motivo.'));
    await page.fill('#m-reason', 'Conteo semanal');
    await page.click('dialog button:has-text("Registrar")');
    await page.waitForSelector('dialog', { state: 'detached' });
    await page.click('.list .row-item:has-text("Coca-Cola")');
    await page.fill('#m-qty', '10');
    await page.fill('#m-reason', 'Compra a proveedor');
    await page.click('dialog button:has-text("Registrar")');
    await page.waitForSelector('dialog', { state: 'detached' });
    await page.waitForFunction(() => [...document.querySelectorAll('.list .row-item')].some((r) => r.textContent.includes('Coca-Cola') && r.textContent.includes('30')));
    const movs = backend.db.stock_movements.filter((m) => m.product_id === backend.db.products[0].id).map((m) => m.qty_milli);
    check(`${p} Movimientos: +24, −2, −2 (ajuste a 20), +10 = 30`, JSON.stringify(movs) === JSON.stringify([24000, -2000, -2000, 10000]), JSON.stringify(movs));
    const hist = await page.$$eval('section .list .row-item', (els) => els.map((e) => e.textContent));
    check(`${p} Historial muestra los movimientos con motivo`, hist.some((h) => h.includes('Conteo semanal')) && hist.some((h) => h.includes('Rotura')));
    await shot('03-stock');

    // 5. Inicio con alerta
    await page.click(nav('Inicio'));
    await page.waitForSelector('.stat-n');
    check(`${p} Inicio: alerta de stock bajo para la yerba`, (await page.textContent('main')).includes('Yerba 1 kg'));

    // 6. Clientes (reutilizado de CotizaPro)
    await page.click(nav('Clientes'));
    await page.click('text=Cargar el primero');
    await page.fill('[name=name]', 'Kiosco La Esquina');
    await page.click('button:has-text("Guardar cliente")');
    await page.waitForSelector('.row-title:has-text("Kiosco La Esquina")');
    check(`${p} Clientes funcionan`, backend.db.customers.length === 1);

    // 7. Invitar vendedor
    await page.click(nav('Equipo'));
    await page.waitForSelector('h1:has-text("Equipo")');
    await page.click('button:has-text("Generar invitación")');
    await page.waitForSelector('.invite-code');
    const code = (await page.textContent('.invite-code')).trim();
    const wa = await page.getAttribute('a:has-text("Enviar por WhatsApp")', 'href');
    check(`${p} Invitación: código de 8 y enlace por WhatsApp`, code.length === 8 && decodeURIComponent(wa).includes(`#/unirme/${code}`), code);
    await shot('04-equipo');

    // 8. El vendedor entra por el enlace
    await salir();
    await page.waitForSelector('h1:has-text("Ingresá a tu cuenta")');
    await page.goto(`${BASE}#/unirme/${code}`);
    await page.waitForSelector('h1:has-text("Creá tu cuenta")');
    check(`${p} El enlace lleva a registrarse con aviso de invitación`, await page.isVisible('text=Te invitaron a un equipo'));
    await page.fill('[name=email]', seller);
    await page.fill('[name=password]', 'clave5678');
    await page.fill('[name=password2]', 'clave5678');
    await page.click('button:has-text("Crear cuenta")');
    await page.waitForSelector('h1:has-text("¡Bienvenido!")');
    check(`${p} El código llega precargado`, (await page.inputValue('[name=code]')) === code);
    await page.click('button:has-text("Unirme al equipo")');
    await page.waitForSelector('h1:has-text("Inicio")');
    check(`${p} Vendedor dentro del negocio correcto`, (await page.textContent('.org-name')) === 'Almacén Russo' && (await page.textContent('main')).includes('Vendedor'));

    // 9. Permisos del vendedor en pantalla
    check(`${p} Vendedor no ve Equipo ni Negocio`, !(await page.isVisible(nav('Equipo'))) && !(await page.isVisible(nav('Negocio'))));
    await page.click(nav('Productos'));
    await page.waitForSelector('h1:has-text("Productos")');
    await page.waitForSelector('.list .row-item');
    check(`${p} Vendedor: catálogo solo lectura`, !(await page.isVisible('text=+ Nuevo producto')) && (await page.$$('.list a.row-item')).length === 0);
    await page.goto(`${BASE}#/productos/nuevo`);
    await page.waitForSelector('h1:has-text("Inicio")');
    await page.goto(`${BASE}#/equipo`);
    await page.waitForSelector('h1:has-text("Inicio")');
    check(`${p} Vendedor no entra por URL a pantallas de dueño`, true);
    await page.click(nav('Stock'));
    await page.waitForSelector('h1:has-text("Stock")');
    await page.waitForSelector('.list .row-item');
    check(`${p} Vendedor: stock sin botones de movimiento`, (await page.$$('.list button.row-item')).length === 0);
    await shot('05-vendedor-stock');

    // 10. Dueño cambia rol y desactiva
    await salir();
    await page.fill('[name=email]', owner);
    await page.fill('[name=password]', 'clave1234');
    await page.click('button:has-text("Ingresar")');
    await page.waitForSelector('h1:has-text("Inicio")');
    await page.click(nav('Equipo'));
    await page.waitForSelector(`.row-title:has-text("${seller}")`);
    check(`${p} La invitación usada ya no figura como pendiente`, await page.isVisible('text=No hay invitaciones pendientes.'));
    const sellerRow = page.locator('.row-item', { hasText: seller });
    await sellerRow.locator('select').selectOption('supervisor');
    await page.waitForFunction(() => document.querySelector('.toast')?.textContent === 'Equipo actualizado');
    check(`${p} Cambio de rol guardado`, backend.db.organization_members.find((m) => m.email === seller).role === 'supervisor');
    await sellerRow.locator('button:has-text("Desactivar")').click();
    await page.waitForFunction((s) => [...document.querySelectorAll('.row-item')].some((r) => r.textContent.includes(s) && r.textContent.includes('Desactivado')), seller);
    check(`${p} Miembro desactivado`, backend.db.organization_members.find((m) => m.email === seller).active === false);
    check(`${p} El dueño no puede cambiarse a sí mismo`, await page.locator('.row-item', { hasText: '(vos)' }).locator('select').isDisabled());

    // 11. El desactivado no entra
    await salir();
    await page.fill('[name=email]', seller);
    await page.fill('[name=password]', 'clave5678');
    await page.click('button:has-text("Ingresar")');
    await page.waitForSelector('h1:has-text("Acceso desactivado")');
    check(`${p} Usuario desactivado ve "Acceso desactivado"`, true);

    // 12. Higiene
    check(`${p} Toda llamada usa la clave publicable`, backend.calls.every((c) => c.apikey === API_KEY));
    check(`${p} Sin pedidos a otros dominios`, otherRequests.length === 0, otherRequests.join(', '));
    const codeErrors = consoleErrors.filter((e) => !e.startsWith('Failed to load resource'));
    check(`${p} Sin errores de JavaScript`, codeErrors.length === 0, codeErrors.slice(0, 3).join(' | '));
    check(`${p} Sin scroll horizontal`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
  } catch (e) {
    await page.screenshot({ path: path.join(shotsDir, `${vp}-ERROR.png`) }).catch(() => {});
    console.log(`${p} URL al fallar: ${page.url()}`);
    throw e;
  } finally {
    await browser.close();
  }
}

try {
  await run('movil', { width: 390, height: 844 });
  await run('escritorio', { width: 1280, height: 800 });
} catch (err) {
  check('La prueba terminó sin excepciones', false, err.message.split('\n')[0]);
} finally {
  server.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
