// Prueba end-to-end en Chrome (Playwright) con un backend Supabase SIMULADO en memoria.
// Verifica la interfaz y el uso correcto de la API; el aislamiento real de la base se prueba
// aparte con supabase/tests/0001_aislamiento.sql.
//
// Uso: node cotizapro-k7r2w/tests/e2e.mjs [carpeta-capturas]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { quoteTotals, lineAmounts } from '../app/lib/calc.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const shotsDir = process.argv[2] || path.join(here, 'capturas');
fs.mkdirSync(shotsDir, { recursive: true });
const SUPA = 'https://wqnlbyrpoygqruskfagr.supabase.co';

// ---------------- Servidor estático ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(repoRoot, url);
  if (!file.startsWith(repoRoot)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/cotizapro-k7r2w/`;

// ---------------- Backend simulado ----------------
function createBackend() {
  const users = new Map(); // email -> {id, email, password}
  const tokens = new Map(); // token -> userId
  const db = { organizations: [], organization_members: [], customers: [], catalog_items: [], quotes: [], quote_items: [], quote_versions: [], quote_events: [] };
  const counters = new Map();
  const calls = [];
  let seq = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const now = () => new Date().toISOString();

  function session(user) {
    const access = `tok-${user.id}-${seq++}`;
    const refresh = `ref-${user.id}-${seq++}`;
    tokens.set(access, user.id);
    tokens.set(refresh, user.id);
    return { access_token: access, refresh_token: refresh, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: user.id, email: user.email } };
  }
  const orgsOf = (uid) => db.organization_members.filter((m) => m.user_id === uid).map((m) => m.organization_id);

  function applyFilters(rows, params) {
    let out = rows;
    for (const [k, val] of params) {
      if (['select', 'order', 'limit'].includes(k)) continue;
      if (k === 'or') {
        const m = val.match(/^\((.*)\)$/);
        const parts = m[1].split(/,(?=\w+\.ilike\.)/);
        out = out.filter((r) => parts.some((p) => {
          const [, col, pat] = p.match(/^(\w+)\.ilike\.(.*)$/);
          return ilike(r[col], pat.replace(/^"|"$/g, ''));
        }));
        continue;
      }
      const [op, ...rest] = val.split('.');
      const arg = rest.join('.');
      if (op === 'eq') out = out.filter((r) => String(r[k]) === arg);
      else if (op === 'ilike') out = out.filter((r) => ilike(r[k], arg));
      else throw new Error(`filtro no soportado ${k}=${val}`);
    }
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      out = [...out].sort((a, b) => (typeof a[col] === 'number' ? a[col] - b[col] : String(a[col]).localeCompare(String(b[col]), 'es')) * (dir === 'desc' ? -1 : 1));
    }
    const limit = Number(params.get('limit') || 0);
    return limit ? out.slice(0, limit) : out;
  }
  function ilike(value, pattern) {
    if (value === null || value === undefined) return false;
    const re = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
    return re.test(String(value));
  }

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const authz = req.headers()['authorization'] || '';
    const uid = tokens.get(authz.replace('Bearer ', ''));
    calls.push({ method, path: url.pathname + url.search, apikey: req.headers()['apikey'] });
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (req.headers()['apikey'] !== 'sb_publishable_oh890vH4eoyGd1L7F-Ag8g_fBQIpafm') return json(401, { message: 'apikey inválida' });

    // ---- Auth ----
    if (url.pathname === '/auth/v1/signup') {
      if (users.has(body.email)) return json(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
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
    if (url.pathname === '/auth/v1/recover') return json(200, {});

    // ---- REST ----
    if (!uid) return json(401, { message: 'JWT expired' });
    const mine = orgsOf(uid);
    if (url.pathname === '/rest/v1/rpc/create_organization') {
      if (mine.length) return json(400, { code: 'P0001', message: 'El usuario ya tiene un negocio' });
      const org = { id: uuid(), name: body.p_name, legal_name: null, tax_id: null, phone: null, email: null, address: null, brand_color: '#C2410C', logo_data_url: null, currency: 'ARS', default_validity_days: 15, terms: null, tax_enabled: false, tax_name: 'IVA', tax_rate_bp: 2100, created_by: uid, created_at: now(), updated_at: now() };
      db.organizations.push(org);
      db.organization_members.push({ organization_id: org.id, user_id: uid, role: 'owner' });
      return json(200, org.id);
    }
    // ---- Presupuestos (réplica simplificada de las funciones de la base) ----
    const org = db.organizations.find((o) => mine.includes(o.id));
    const itemsOf = (qid) => db.quote_items.filter((i) => i.quote_id === qid).sort((a, b) => a.position - b.position);
    const totalsOf = (q) => {
      if (q.status !== 'borrador') return { subtotal: q.subtotal_minor, discount: q.discount_minor, tax: q.tax_minor, total: q.total_minor };
      return quoteTotals(itemsOf(q.id), { discount_type: q.discount_type, discount_value: q.discount_value, tax_enabled: org.tax_enabled, tax_rate_bp: org.tax_rate_bp });
    };
    const myQuote = (id) => db.quotes.find((q) => q.id === id && mine.includes(q.organization_id));
    const err = (message) => json(400, { code: 'P0001', message });
    if (url.pathname === '/rest/v1/rpc/save_draft') {
      const d = body.p_data;
      if (d.customer_id && !db.customers.some((c) => c.id === d.customer_id && c.organization_id === org.id)) return err('El cliente no pertenece a este negocio');
      let q;
      if (!body.p_id) {
        q = { id: uuid(), organization_id: org.id, number: null, status: 'borrador', currency: org.currency, created_at: now(),
              valid_until: d.valid_until || new Date(Date.now() + org.default_validity_days * 864e5).toISOString().slice(0, 10) };
        db.quotes.push(q);
      } else {
        q = myQuote(body.p_id);
        if (!q || q.status !== 'borrador') return err('Este presupuesto ya fue emitido o no existe: no se puede editar');
        db.quote_items = db.quote_items.filter((i) => i.quote_id !== q.id);
      }
      Object.assign(q, { customer_id: d.customer_id || null, title: d.title || null, notes: d.notes || null, discount_type: d.discount_type, discount_value: d.discount_value, valid_until: d.valid_until || q.valid_until });
      d.items.forEach((it, i) => db.quote_items.push({ id: uuid(), quote_id: q.id, organization_id: org.id, position: i, ...it }));
      return json(200, q.id);
    }
    if (url.pathname === '/rest/v1/rpc/issue_quote') {
      const q = myQuote(body.p_id);
      if (!q) return json(404, { code: 'P0002', message: 'No se encontró el presupuesto' });
      if (q.status !== 'borrador') return err('Este presupuesto ya fue emitido');
      if (!q.customer_id) return err('Elegí un cliente antes de emitir');
      const t = totalsOf(q);
      const n = (counters.get(org.id) || 0) + 1;
      counters.set(org.id, n);
      const c = db.customers.find((x) => x.id === q.customer_id);
      Object.assign(q, { status: 'emitido', number: n, issued_at: now(), subtotal_minor: t.subtotal, discount_minor: t.discount, tax_minor: t.tax, total_minor: t.total });
      db.quote_versions.push({ id: uuid(), quote_id: q.id, organization_id: org.id, version: 1, snapshot: {
        schema: 1, number: n, title: q.title, currency: q.currency, issued_at: q.issued_at, valid_until: q.valid_until, notes: q.notes,
        issuer: { name: org.name, legal_name: org.legal_name, tax_id: org.tax_id, phone: org.phone, email: org.email, address: org.address, brand_color: org.brand_color, logo_data_url: org.logo_data_url, terms: org.terms },
        customer: { name: c.name, tax_id: c.tax_id, phone: c.phone, email: c.email, address: c.address },
        items: itemsOf(q.id).map((it) => { const a = lineAmounts(it); return { ...it, gross_minor: Number(a.gross), discount_minor: Number(a.discount), net_minor: Number(a.net) }; }),
        discount: { type: q.discount_type, value: q.discount_value },
        tax: { enabled: org.tax_enabled, name: org.tax_name, rate_bp: org.tax_rate_bp },
        totals: { subtotal_minor: t.subtotal, discount_minor: t.discount, tax_minor: t.tax, total_minor: t.total },
      } });
      db.quote_events.push({ quote_id: q.id, organization_id: org.id, from_status: 'borrador', to_status: 'emitido', created_at: now() });
      return json(200, { id: q.id, number: n, total_minor: t.total });
    }
    if (url.pathname === '/rest/v1/rpc/set_quote_status') {
      const q = myQuote(body.p_id);
      if (!q) return json(404, { code: 'P0002', message: 'No se encontró el presupuesto' });
      const allowed = { emitido: ['enviado', 'aceptado', 'rechazado', 'cancelado'], enviado: ['aceptado', 'rechazado', 'cancelado'] }[q.status] || [];
      if (!allowed.includes(body.p_status)) return err(`No se puede pasar de ${q.status} a ${body.p_status}`);
      db.quote_events.push({ quote_id: q.id, organization_id: org.id, from_status: q.status, to_status: body.p_status, created_at: now() });
      q.status = body.p_status;
      return json(200, q.status);
    }
    if (url.pathname === '/rest/v1/rpc/duplicate_quote') {
      const src = myQuote(body.p_id);
      if (!src) return json(404, { code: 'P0002', message: 'No se encontró el presupuesto' });
      const q = { id: uuid(), organization_id: org.id, number: null, status: 'borrador', currency: src.currency, created_at: now(),
                  customer_id: src.customer_id, title: `${src.title || 'Presupuesto'} (copia)`, notes: src.notes, discount_type: src.discount_type,
                  discount_value: src.discount_value, valid_until: new Date(Date.now() + org.default_validity_days * 864e5).toISOString().slice(0, 10) };
      db.quotes.push(q);
      itemsOf(src.id).forEach((it) => db.quote_items.push({ ...it, id: uuid(), quote_id: q.id }));
      return json(200, q.id);
    }
    const table = url.pathname.replace('/rest/v1/', '');
    if (!db[table]) return json(404, { message: 'tabla desconocida' });
    const visible = (r) => mine.includes(table === 'organizations' ? r.id : r.organization_id);

    if (method === 'GET') {
      let rows = applyFilters(db[table].filter(visible), url.searchParams);
      if (table === 'quotes') {
        rows = rows.map((q) => ({ ...q, quote_total: totalsOf(q).total, customers: q.customer_id ? { name: db.customers.find((c) => c.id === q.customer_id)?.name } : null }));
      }
      return json(200, rows);
    }
    if (method === 'DELETE') {
      const id = url.searchParams.get('id').replace('eq.', '');
      const row = db[table].find((r) => r.id === id && visible(r));
      if (!row || (table === 'quotes' && row.status !== 'borrador')) return json(200, []);
      db[table] = db[table].filter((r) => r !== row);
      if (table === 'quotes') db.quote_items = db.quote_items.filter((i) => i.quote_id !== id);
      return json(200, [row]);
    }
    if (method === 'POST') {
      if (table === 'organizations') return json(403, { message: 'permission denied' });
      if (!mine.includes(body.organization_id)) return json(403, { code: '42501', message: 'new row violates row-level security policy' });
      const row = { id: uuid(), archived: false, created_at: now(), updated_at: now(), ...body };
      db[table].push(row);
      return json(201, [row]);
    }
    if (method === 'PATCH') {
      const id = url.searchParams.get('id').replace('eq.', '');
      const row = db[table].find((r) => r.id === id && visible(r));
      if (!row) return json(200, []);
      Object.assign(row, body, { updated_at: now() });
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

async function run(viewportName, viewport) {
  const backend = createBackend();
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const context = await browser.newContext({ viewport, locale: 'es-AR', deviceScaleFactor: viewportName === 'movil' ? 2 : 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.route(`${SUPA}/**`, (r) => backend.handle(r));
  const otherRequests = [];
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith(SUPA) && !u.startsWith('data:')) otherRequests.push(u); });

  const shot = (name) => page.screenshot({ path: path.join(shotsDir, `${viewportName}-${name}.png`), fullPage: true });
  const p = `[${viewportName}]`;
  const email = `russo+${viewportName}@ejemplo.com`;

  try {
  // 1. Sin sesión → login
  await page.goto(BASE);
  await page.waitForSelector('h1:has-text("Ingresá a tu cuenta")');
  check(`${p} Sin sesión muestra el login`, page.url().endsWith('#/ingresar'));
  await shot('01-login');

  // 2. Registro con validaciones
  await page.click('text=Creala gratis');
  await page.waitForSelector('h1:has-text("Creá tu cuenta")');
  await page.fill('[name=email]', email);
  await page.fill('[name=password]', 'clave1234');
  await page.fill('[name=password2]', 'otra-clave');
  await page.click('button:has-text("Crear cuenta")');
  check(`${p} Registro: contraseñas distintas muestran error`, await page.isVisible('text=Las contraseñas no coinciden.'));
  await page.fill('[name=password2]', 'clave1234');
  await page.click('button:has-text("Crear cuenta")');
  await page.waitForSelector('h1:has-text("¿Cómo se llama tu negocio?")');
  check(`${p} Registro lleva al alta del negocio`, true);
  await shot('02-negocio-nuevo');

  // 3. Alta del negocio
  await page.click('button:has-text("Crear mi negocio")');
  check(`${p} Nombre del negocio obligatorio`, await page.isVisible('text=El nombre es obligatorio.'));
  await page.fill('[name=name]', 'Instalaciones Russo');
  await page.click('button:has-text("Crear mi negocio")');
  await page.waitForSelector('text=¡Listo, tu negocio está creado!');
  check(`${p} Negocio creado y paso 2 visible`, (await page.textContent('.org-name')) === 'Instalaciones Russo');

  // 4. Configuración
  await page.fill('[name=phone]', '2901 555-123');
  await page.fill('[name=email]', 'mal-email');
  await page.click('button:has-text("Guardar")');
  check(`${p} Configuración valida el email`, await page.isVisible('text=El email no parece válido.'));
  await page.fill('[name=email]', 'contacto@russo.com');
  await page.check('[name=tax_enabled]');
  await page.fill('[name=tax_rate]', '10,5');
  await page.fill('[name=terms]', 'Pago 50 % de anticipo y saldo contra entrega.');
  await shot('03-configuracion');
  await page.click('button:has-text("Guardar")');
  await page.waitForSelector('h1:has-text("Inicio")');
  const org = backend.db.organizations[0];
  check(`${p} Configuración guardada en la base`, org.phone === '2901 555-123' && org.tax_enabled === true && org.tax_rate_bp === 1050 && org.email === 'contacto@russo.com', `tasa=${org.tax_rate_bp}`);
  await page.waitForSelector('.stat-n');
  check(`${p} Checklist marca datos del negocio como hechos`, await page.isVisible('.checklist li.done'));
  await shot('04-inicio');

  // 5. Clientes
  await page.click(viewportName === 'movil' ? '.tabbar >> text=Clientes' : '.sidenav >> text=Clientes');
  await page.waitForSelector('text=Todavía no cargaste clientes');
  check(`${p} Clientes: estado vacío`, true);
  await page.click('text=Cargar el primero');
  await page.fill('[name=name]', 'Juan Pérez');
  await page.fill('[name=email]', 'juan@');
  await page.click('button:has-text("Guardar cliente")');
  check(`${p} Cliente: email inválido rechazado`, await page.isVisible('text=El email no parece válido.'));
  await page.fill('[name=email]', 'juan@correo.com');
  await page.fill('[name=phone]', '11 4444-5555');
  await page.click('button:has-text("Guardar cliente")');
  await page.waitForSelector('.row-title:has-text("Juan Pérez")');
  await page.click('text=+ Nuevo cliente');
  await page.fill('[name=name]', 'María López');
  await page.click('button:has-text("Guardar cliente")');
  await page.waitForSelector('.row-title:has-text("María López")');
  check(`${p} Dos clientes en la lista`, (await page.$$('.row-item')).length === 2);
  await page.fill('.search', 'maría');
  await page.waitForFunction(() => document.querySelectorAll('.row-item').length === 1);
  check(`${p} Búsqueda filtra clientes`, (await page.textContent('.row-title')) === 'María López');
  check(`${p} Búsqueda usa filtro del servidor`, backend.calls.some((c) => c.path.includes('or=') && c.path.includes('ilike')));
  await shot('05-clientes');
  await page.fill('.search', '');
  await page.waitForFunction(() => document.querySelectorAll('.row-item').length === 2);
  const juanId = backend.db.customers.find((c) => c.name === 'Juan Pérez').id;

  // Editar y archivar
  await page.click('.row-title:has-text("Juan Pérez")');
  await page.waitForSelector('h1:has-text("Juan Pérez")');
  await page.fill('[name=notes]', 'Prefiere WhatsApp');
  await page.click('button:has-text("Guardar cambios")');
  await page.waitForSelector('.row-title:has-text("Juan Pérez")');
  check(`${p} Edición de cliente guardada`, backend.db.customers.find((c) => c.id === juanId).notes === 'Prefiere WhatsApp');
  await page.click('.row-title:has-text("María López")');
  await page.click('button:has-text("Archivar cliente")');
  await page.waitForFunction(() => document.querySelectorAll('.row-item').length === 1);
  check(`${p} Archivar quita al cliente de la lista`, true);
  await page.check('#show-archived');
  await page.waitForSelector('.row-title:has-text("María López")');
  check(`${p} Archivados visibles con el filtro`, true);

  // 6. Conceptos
  await page.click(viewportName === 'movil' ? '.tabbar >> text=Conceptos' : '.sidenav >> text=Conceptos');
  await page.waitForSelector('text=Tu catálogo está vacío');
  await page.click('text=Cargar el primero');
  await page.fill('[name=description]', 'Colocación de ventana');
  await page.selectOption('[name=kind]', 'mano_de_obra');
  await page.fill('[name=unit]', 'unidad');
  await page.fill('[name=price]', '-5');
  await page.click('button:has-text("Guardar concepto")');
  check(`${p} Concepto: precio negativo rechazado`, await page.isVisible('text=El importe no puede ser negativo.'));
  await page.fill('[name=price]', '15.000');
  check(`${p} El error del campo se borra al corregir el valor`, !(await page.isVisible('text=El importe no puede ser negativo.')));
  await page.fill('[name=cost]', '10.000');
  const margin = await page.textContent('.margin-out');
  check(`${p} Muestra recargo y margen distintos`, margin.includes('recargo sobre costo 50 %') && margin.includes('margen sobre precio 33,3 %'), margin);
  await shot('06-concepto-form');
  await page.click('button:has-text("Guardar concepto")');
  await page.waitForSelector('.amount');
  check(`${p} Concepto guardado en centavos`, backend.db.catalog_items[0].price_minor === 1500000 && backend.db.catalog_items[0].cost_minor === 1000000);
  check(`${p} Lista muestra precio formateado`, (await page.textContent('.amount')) === '$ 15.000,00');
  await page.click('text=+ Nuevo concepto');
  await page.fill('[name=description]', 'Ventana aluminio 120x100');
  await page.fill('[name=price]', '185.400,50');
  await page.click('button:has-text("Guardar concepto")');
  await page.waitForFunction(() => document.querySelectorAll('.row-item').length === 2);
  await page.selectOption('.select-sm', 'material');
  await page.waitForFunction(() => document.querySelectorAll('.row-item').length === 1);
  check(`${p} Filtro por tipo`, (await page.textContent('.row-title')) === 'Ventana aluminio 120x100');
  await page.selectOption('.select-sm', '');
  await page.waitForFunction(() => document.querySelectorAll('.row-item').length === 2);
  await shot('07-conceptos');

  // 7. Recargar conserva sesión y datos
  await page.reload();
  await page.waitForSelector('.row-item');
  check(`${p} Recargar conserva sesión y datos`, (await page.$$('.row-item')).length === 2 && page.url().includes('#/conceptos'));

  // 7b. Presupuestos: armar, validar, vista previa, guardar, emitir
  const nav = (label) => (viewportName === 'movil' ? `.tabbar >> text=${label}` : `.sidenav >> text=${label}`);
  await page.click(nav('Presupuestos'));
  await page.waitForSelector('text=Todavía no hiciste presupuestos');
  await page.click('text=Hacer el primero');
  await page.waitForSelector('h1:has-text("Nuevo presupuesto")');
  const options = await page.$$eval('#q-customer option', (os) => os.map((o) => o.textContent));
  check(`${p} Editor: clientes archivados no se ofrecen`, options.includes('Juan Pérez') && !options.includes('María López'), options.join(', '));
  await page.selectOption('#q-customer', { label: 'Juan Pérez' });
  await page.fill('#q-title', 'Ventanas living');
  await page.click('button:has-text("+ Del catálogo")');
  await page.click('.picker-item:has-text("Ventana aluminio")');
  await page.click('.picker-item:has-text("Colocación de ventana")');
  const lines = page.locator('.line');
  check(`${p} El catálogo agrega líneas con precio`, (await lines.count()) === 2 && (await lines.nth(0).locator('[name=price]').inputValue()) === '185.400,50');
  await lines.nth(0).locator('[name=qty]').fill('3');
  await lines.nth(1).locator('[name=qty]').fill('3');
  await lines.nth(1).locator('[name=disc]').fill('10');
  const totals = await page.$$eval('.totals dd', (els) => els.map((e) => e.textContent));
  check(`${p} Totales en vivo: subtotal, IVA 10,5 % y total`, totals[0] === '$ 596.701,50' && totals[1] === '$ 62.653,66' && totals[2] === '$ 659.355,16', totals.join(' | '));

  await page.click('button:has-text("+ Línea libre")');
  await lines.nth(2).locator('[name=description]').fill('Extra');
  await lines.nth(2).locator('[name=qty]').fill('0');
  await page.click('.summary-actions button:has-text("Emitir")');
  check(`${p} No deja emitir con una línea inválida`, (await page.isVisible('text=Revisá las líneas marcadas.')) && !(await page.isVisible('dialog')));
  await lines.nth(2).locator('button[aria-label^="Quitar"]').click();
  check(`${p} Quitar línea recalcula el total`, (await page.textContent('.total-value')) === '$ 659.355,16');
  await shot('08-editor');

  await page.click('button:has-text("Vista previa")');
  await page.waitForSelector('dialog .doc-watermark');
  const prev = await page.textContent('dialog .doc');
  check(`${p} Vista previa muestra BORRADOR, cliente y total`, prev.includes('BORRADOR') && prev.includes('Juan Pérez') && prev.includes('$ 659.355,16'));
  await page.screenshot({ path: path.join(shotsDir, `${viewportName}-09-vista-previa.png`) });
  await page.click('dialog button:has-text("Cerrar")');

  await page.click('button:has-text("Guardar borrador")');
  await page.waitForFunction(() => /#\/presupuestos\/[0-9a-f-]{36}$/.test(location.hash));
  const draft = backend.db.quotes[0];
  check(`${p} Borrador guardado sin número y con 2 líneas`, draft.status === 'borrador' && draft.number === null && backend.db.quote_items.filter((i) => i.quote_id === draft.id).length === 2);
  check(`${p} Cantidades y descuentos llegan en enteros`, backend.db.quote_items.some((i) => i.qty_milli === 3000 && i.discount_bp === 1000 && i.unit_price_minor === 1500000));

  await page.click('.summary-actions button:has-text("Emitir")');
  await page.waitForSelector('dialog >> text=Emitir presupuesto');
  await page.click('dialog button:has-text("Emitir")');
  await page.waitForSelector('h1:has-text("N.º 0001")');
  const quoteId = draft.id;
  check(`${p} Emitido con número 0001`, (await page.textContent('.doc-number')) === 'N.º 0001');
  check(`${p} El documento emitido muestra el total del snapshot`, (await page.textContent('.doc-total')) === '$ 659.355,16' && backend.db.quote_versions[0].snapshot.totals.total_minor === 65935516);
  await shot('10-emitido');

  const wa = await page.getAttribute('a:has-text("Enviar por WhatsApp")', 'href');
  check(`${p} WhatsApp: número del cliente y texto con N.º y total`, wa.startsWith('https://wa.me/5491144445555?text=') && decodeURIComponent(wa).includes('N.º 0001') && decodeURIComponent(wa).includes('$ 659.355,16'), wa.slice(0, 48));

  await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.click('button:has-text("Descargar PDF")');
  await page.waitForFunction(() => window.__printed === 1);
  check(`${p} PDF: nombre de archivo PRES-0001-Juan-Perez`, (await page.title()) === 'PRES-0001-Juan-Perez');
  if (viewportName === 'escritorio') {
    const pdfPath = path.join(shotsDir, 'PRES-0001-Juan-Perez.pdf');
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    const pages = Number(execFileSync('pdfinfo', [pdfPath]).toString().match(/Pages:\s+(\d+)/)[1]);
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-']).toString();
    check(`${p} PDF real: 1 página A4`, pages === 1, `${pages} página(s)`);
    check(`${p} PDF real: número, cliente, líneas y total`, ['N.º 0001', 'Juan Pérez', 'Ventana aluminio 120x100', 'Colocación de ventana', '$ 659.355,16', 'IVA 10,5 %'].every((t) => text.includes(t)));
    check(`${p} PDF real: sin menús ni botones de la app`, !text.includes('Descargar PDF') && !text.includes('Conceptos'));
  }
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  check(`${p} Después de imprimir vuelve la pantalla normal`, !(await page.evaluate(() => document.body.classList.contains('print-mode'))));

  await page.click('button:has-text("Marcar como enviado")');
  await page.waitForSelector('.issued-head .badge:has-text("Enviado")');
  await page.click('button:has-text("Aceptado")');
  await page.waitForSelector('.issued-head .badge:has-text("Aceptado")');
  check(`${p} Estados: enviado → aceptado, sin más acciones`, !(await page.isVisible('.status-card')) && (await page.$$('.timeline li')).length === 3);

  await page.click('button:has-text("Duplicar")');
  await page.waitForSelector('h1:has-text("Ventanas living (copia)")');
  check(`${p} Duplicar abre un borrador con las mismas líneas`, (await page.locator('.line').count()) === 2);
  await page.fill('#q-title', 'Ventanas living v2');
  page.once('dialog', (d) => d.dismiss());
  await page.click(nav('Clientes'));
  await page.waitForTimeout(300);
  check(`${p} Cambios sin guardar: pide confirmar y deja quedarse`, page.url().includes('#/presupuestos/') && (await page.isVisible('#q-title')));
  page.once('dialog', (d) => d.accept());
  await page.click(nav('Presupuestos'));
  await page.waitForSelector('.chip');
  const chipText = await page.$$eval('.chip', (cs) => cs.map((c) => c.textContent));
  check(`${p} Lista y filtros: 2 presupuestos, 1 borrador, 1 aceptado`, (await page.$$('.list .row-item')).length === 2 && chipText.includes('Borradores1') && chipText.includes('Aceptados1'), chipText.join(' '));
  await page.click('.chip:has-text("Aceptados")');
  check(`${p} Filtro Aceptados muestra solo el emitido`, (await page.$$('.list .row-item')).length === 1);
  await shot('11-presupuestos');

  // 8. Salir y volver a entrar
  await page.click(viewportName === 'movil' ? '.topbar >> text=Salir' : '.sidenav >> text=Salir');
  await page.waitForSelector('h1:has-text("Ingresá a tu cuenta")');
  await page.fill('[name=email]', email);
  await page.fill('[name=password]', 'mala-clave');
  await page.click('button:has-text("Ingresar")');
  await page.waitForSelector('text=Email o contraseña incorrectos.');
  check(`${p} Login con clave incorrecta muestra error claro`, true);
  await page.fill('[name=password]', 'clave1234');
  await page.click('button:has-text("Ingresar")');
  await page.waitForSelector('.stat-n');
  const nums = await page.$$eval('.stat-n', (els) => els.map((e) => e.textContent));
  check(`${p} Al volver a entrar los datos siguen`, nums[0] === '0' && nums[1] === '1' && nums[2] === '1', nums.join(','));

  // 9. Segunda cuenta no ve nada de la primera
  await page.click(viewportName === 'movil' ? '.topbar >> text=Salir' : '.sidenav >> text=Salir');
  await page.click('text=Creala gratis');
  await page.waitForSelector('h1:has-text("Creá tu cuenta")');
  await page.fill('[name=email]', `otro+${viewportName}@ejemplo.com`);
  await page.fill('[name=password]', 'clave5678');
  await page.fill('[name=password2]', 'clave5678');
  await page.click('button:has-text("Crear cuenta")');
  await page.fill('[name=name]', 'Pinturería Otra');
  await page.click('button:has-text("Crear mi negocio")');
  await page.waitForSelector('text=¡Listo, tu negocio está creado!');
  await page.goto(`${BASE}#/clientes`);
  await page.waitForSelector('text=Todavía no cargaste clientes');
  check(`${p} Segunda cuenta ve su lista de clientes vacía`, true);
  await page.goto(`${BASE}#/clientes/${juanId}`);
  await page.waitForSelector('text=No encontramos ese cliente.');
  check(`${p} Segunda cuenta no abre un cliente ajeno por URL`, true);
  await page.goto(`${BASE}#/presupuestos/${quoteId}`);
  await page.waitForSelector('text=No encontramos ese presupuesto.');
  check(`${p} Segunda cuenta no abre un presupuesto ajeno por URL`, true);

  // 10. Higiene
  check(`${p} Toda llamada a Supabase usa la clave publicable`, backend.calls.every((c) => c.apikey === 'sb_publishable_oh890vH4eoyGd1L7F-Ag8g_fBQIpafm'));
  check(`${p} Sin pedidos a otros dominios`, otherRequests.length === 0, otherRequests.join(', '));
  // Chrome registra como error cada respuesta 4xx (acá, el login con clave incorrecta, provocado a propósito).
  // Esos se cuentan aparte; el resto serían errores de código.
  const networkErrors = consoleErrors.filter((e) => e.startsWith('Failed to load resource'));
  const codeErrors = consoleErrors.filter((e) => !e.startsWith('Failed to load resource'));
  check(`${p} Sin errores de JavaScript en consola`, codeErrors.length === 0, codeErrors.slice(0, 3).join(' | '));
  check(`${p} Solo el 4xx provocado aparece como error de red`, networkErrors.length === 1, `${networkErrors.length} error(es) de red`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(`${p} Sin scroll horizontal`, !overflow);
  } catch (e) {
    await page.screenshot({ path: path.join(shotsDir, `${viewportName}-ERROR.png`) }).catch(() => {});
    console.log(`${p} URL al fallar: ${page.url()}`);
    throw e;
  } finally {
    await browser.close();
  }
}

// Si un archivo de la app no carga, la pantalla debe explicar el problema en vez de quedar en blanco.
async function bootFailure() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/app/views/home.js', (r) => r.abort());
  await page.goto(BASE);
  await page.waitForSelector('text=No se pudo cargar CotizaPro', { timeout: 10000 });
  check('[arranque] Un archivo faltante muestra un aviso y botón Reintentar', await page.isVisible('#boot-retry'));
  await page.screenshot({ path: path.join(shotsDir, 'movil-00-error-carga.png') });
  const slow = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await slow.route('**/app/main.js*', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); r.continue(); });
  await slow.goto(BASE, { waitUntil: 'commit' });
  await slow.waitForSelector('text=Cargando CotizaPro…', { timeout: 5000 });
  check('[arranque] Mientras carga se ve "Cargando CotizaPro…"', true);
  await slow.waitForSelector('h1:has-text("Ingresá a tu cuenta")');
  check('[arranque] Con conexión lenta termina en el login', true);
  await browser.close();
}

try {
  await bootFailure();
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
