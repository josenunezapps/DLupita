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
  const db = { organizations: [], organization_members: [], customers: [], catalog_items: [] };
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
      out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col]), 'es') * (dir === 'desc' ? -1 : 1));
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
    const table = url.pathname.replace('/rest/v1/', '');
    if (!db[table]) return json(404, { message: 'tabla desconocida' });
    const visible = (r) => mine.includes(table === 'organizations' ? r.id : r.organization_id);

    if (method === 'GET') return json(200, applyFilters(db[table].filter(visible), url.searchParams));
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

  // 1. Sin sesión → login
  await page.goto(BASE);
  await page.waitForSelector('h1:has-text("Ingresá a tu cuenta")');
  check(`${p} Sin sesión muestra el login`, page.url().endsWith('#/ingresar'));
  await shot('01-login');

  // 2. Registro con validaciones
  await page.click('text=Creala gratis');
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
  check(`${p} Al volver a entrar los datos siguen`, nums[0] === '1' && nums[1] === '2', nums.join(','));

  // 9. Segunda cuenta no ve nada de la primera
  await page.click(viewportName === 'movil' ? '.topbar >> text=Salir' : '.sidenav >> text=Salir');
  await page.click('text=Creala gratis');
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

  await browser.close();
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
