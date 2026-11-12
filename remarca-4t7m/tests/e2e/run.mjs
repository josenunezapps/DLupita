// Pruebas de punta a punta en Chrome real. Ejecutar: npm run test:e2e
// Requiere Playwright y Chrome (PLAYWRIGHT_PATH y CHROME_PATH permiten indicar dónde están).
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '../..');
const shots = process.env.SHOTS || path.join(appDir, 'tests/e2e/capturas');
await mkdir(shots, { recursive: true });

// Sirve la app bajo un subdirectorio, igual que GitHub Pages.
const BASE = '/DLupita/remarca-4t7m/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
  const rel = url.pathname.slice(BASE.length) || 'index.html';
  try { res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }).end(await readFile(path.join(appDir, rel))); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const URL0 = `http://localhost:${server.address().port}${BASE}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [], problems = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push('consola: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('excepción: ' + e.message));
  page.on('requestfailed', (r) => problems.push('pedido fallido: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(URL0);
  await page.waitForFunction(() => window.remarca && !document.querySelector('#boot'));
  return page;
}
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); console.log('  ✓', name); }
  catch (e) { results.push(['FALLA', name]); console.log('  ✗', name, '\n    ', e.message.split('\n').slice(0, 6).join(' | ')); }
}
const data = (page) => page.evaluate(() => { const s = window.remarca.store.get(); return { products: s.model.products, shop: s.model.shop, demo: s.model.demo, sel: s.sel, view: s.view }; });
const find = async (page, name) => (await data(page)).products.find((p) => p.name.startsWith(name));
const rows = (page) => page.locator('#pList .prow:not(.cat)');
const go = (page, view) => page.locator(`#n-${view}`).click();
const save = async (dl) => readFile(await dl.path());
const pngSize = (buf) => { assert.equal(buf.subarray(1, 4).toString(), 'PNG'); return [buf.readUInt32BE(16), buf.readUInt32BE(20)]; };

console.log('Escritorio');
const page = await newPage();

await step('abre con el almacén de ejemplo, rotulado como ejemplo', async () => {
  const d = await data(page);
  assert.equal(d.products.length, 18); assert.equal(d.demo, true);
  assert.equal(await page.locator('#demoBanner').isVisible(), true);
  assert.equal(await page.locator('#n-labels').getAttribute('data-badge'), '5');
  assert.equal(await rows(page).count(), 18);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, '01-productos.png') });
});

await step('alta rápida: valida el precio y agrega con Enter', async () => {
  await page.locator('#quickAdd [name="name"]').fill('Dulce de leche 400 g');
  await page.locator('#quickAdd [name="price"]').fill('caro');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#quickAdd .err').nth(1).innerText(), /números/);
  assert.equal((await data(page)).products.length, 18);
  await page.locator('#quickAdd [name="price"]').fill('2.350,50');
  await page.keyboard.press('Enter');
  const p = await find(page, 'Dulce de leche');
  assert.equal(p.price, 2350.5); assert.equal(p.pending, true);
  assert.equal(await page.locator('#n-labels').getAttribute('data-badge'), '6');
  await page.locator('#pQuery').focus(); await page.locator('h1').first().click();
  await page.keyboard.press('Control+z');
  assert.equal((await data(page)).products.length, 18);
});

await step('búsqueda con operadores, filtros por categoría y orden', async () => {
  await page.locator('#pQuery').fill('oferta'); assert.equal(await rows(page).count(), 5);
  await page.locator('#pQuery').fill('>3000 almacen'); assert.equal(await rows(page).count(), 1);
  await page.locator('#pQuery').fill('jamon'); assert.match(await rows(page).first().innerText(), /Jamón cocido/);
  await page.locator('#pQuery').fill('zzzz'); assert.match(await page.locator('#pList').innerText(), /Nada coincide/i);
  await page.locator('[data-act="clear"]').click(); assert.equal(await rows(page).count(), 18);
  await page.locator('[data-chip="category"][data-value="Lácteos"]').click(); assert.equal(await rows(page).count(), 3);
  await page.locator('[data-chip="all"]').click();
  await page.locator('#pSort').selectOption('priceDown');
  assert.match(await rows(page).first().innerText(), /Queso cremoso/);
  await page.locator('#pSort').selectOption('category');
});

await step('editar un producto: valida el código de barras y guarda el precio anterior', async () => {
  await page.locator('[data-edit]', { hasText: 'Leche entera' }).click();
  const form = page.locator('#sheet form');
  await form.locator('[name="code"]').fill('7790001000060'); await form.locator('button[value="save"]').click();
  assert.match(await form.innerText(), /último dígito/);
  await form.locator('[name="code"]').fill('7790001000064');
  await form.locator('[name="price"]').fill('1.600'); await form.locator('button[value="save"]').click();
  const p = await find(page, 'Leche entera');
  assert.equal(p.price, 1600); assert.equal(p.prev, 1450); assert.equal(p.pending, true);
  await page.keyboard.press('Control+z');
  assert.equal((await find(page, 'Leche entera')).price, 1450);
});

await step('remarcar desde la paleta: vista previa, redondeo, aplicar y deshacer', async () => {
  await page.keyboard.press('Control+k'); await page.locator('#paletteInput').fill('remarcar');
  assert.match(await page.locator('#paletteList li[aria-selected="true"]').innerText(), /Remarcar precios/);
  await page.keyboard.press('Enter');
  const form = page.locator('#sheet form');
  await form.locator('[name="pct"]').fill('abc'); assert.equal(await form.locator('#rpApply').isDisabled(), true);
  await form.locator('[data-pct="10"]').click(); await form.locator('[name="rounding"]').selectOption('10');
  assert.match(await form.locator('#rpSummary').innerText(), /Cambian 18 de 18 precios/);
  assert.match(await form.locator('#rpPreview li').first().innerText(), /4\.850[\s\S]*5\.340/);
  await page.waitForTimeout(200); await page.screenshot({ path: path.join(shots, '02-remarcar.png') });
  await form.locator('#rpApply').click();
  assert.equal((await find(page, 'Yerba')).price, 5340); assert.equal((await find(page, 'Yerba')).prev, 4850);
  assert.equal(await page.locator('#n-labels').getAttribute('data-badge'), '18');
  await page.locator('.toast button', { hasText: 'Deshacer' }).click();
  assert.equal((await find(page, 'Yerba')).price, 4850);
  assert.equal(await page.locator('#n-labels').getAttribute('data-badge'), '5');
});

await step('remarcar sólo una categoría, hacia abajo, terminando en 90', async () => {
  await page.locator('#sheet').evaluate((d) => d.open && d.close());
  await page.locator('h1').first().click(); await page.keyboard.press('r');
  const form = page.locator('#sheet form');
  await form.locator('[data-scope="cat"]').click(); await form.locator('[name="category"]').selectOption('Bebidas');
  await form.locator('[data-dir="-1"]').click(); await form.locator('[name="pct"]').fill('7,5'); await form.locator('[name="rounding"]').selectOption('90');
  assert.match(await form.locator('#rpSummary').innerText(), /Cambian 2 de 2 precios/);
  await form.locator('#rpApply').click();
  assert.equal((await find(page, 'Gaseosa')).price, 2990); assert.equal((await find(page, 'Agua')).price, 990);
  assert.equal((await find(page, 'Yerba')).price, 4850);
  await page.keyboard.press('Control+z');
});

await step('selección múltiple: poner en oferta y borrar con deshacer', async () => {
  await page.locator('[data-pick]').nth(1).check(); await page.locator('[data-pick]').nth(2).check();
  assert.match(await page.locator('#pBulk').innerText(), /2 elegidos/);
  await page.locator('#pBulk [data-act="offer"]').click();
  assert.equal((await data(page)).products.filter((p) => p.offer).length, 7);
  await page.keyboard.press('Control+z');
  await page.locator('#pBulk [data-act="delete"]').click();
  assert.equal((await data(page)).products.length, 16);
  await page.locator('.toast button', { hasText: 'Deshacer' }).last().click();
  assert.equal((await data(page)).products.length, 18);
});

await step('carteles: se dibujan a tamaño real y se descargan como PNG', async () => {
  await go(page, 'posters'); await page.waitForTimeout(300);
  const painted = () => page.evaluate(() => { const c = document.querySelector('#poCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 997) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return { w: c.width, h: c.height, colors: seen.size, top: [d[0], d[1], d[2]] }; });
  let c = await painted();
  assert.deepEqual([c.w, c.h], [1080, 1920]); assert.ok(c.colors > 3); assert.deepEqual(c.top, [228, 0, 43], 'la banda superior usa el color del negocio');
  await page.screenshot({ path: path.join(shots, '03-carteles.png') });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="download"]').click()]);
  assert.equal(dl.suggestedFilename(), 'oferta-yerba-mate-1-kg-story.png');
  assert.deepEqual(pngSize(await save(dl)), [1080, 1920]);
  for (const [tpl, fmt, size] of [['fibron', 'post', [1080, 1080]], ['sobrio', 'a4', [1654, 2339]], ['lista', 'story', [1080, 1920]]]) {
    await page.locator(`[data-template="${tpl}"]`).click(); await page.locator(`[data-format="${fmt}"]`).click(); await page.waitForTimeout(250);
    c = await painted(); assert.deepEqual([c.w, c.h], size, tpl); assert.ok(c.colors > 2, tpl);
    await page.locator('#poCanvas').screenshot({ path: path.join(shots, `04-cartel-${tpl}.png`) });
  }
  assert.equal(await page.locator('#poPick input:checked').count(), 5, 'la lista arranca con las ofertas');
  await page.locator('#poTitle').fill('Precios locos'); await page.waitForTimeout(150);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="download"]').click()]);
  assert.equal(dl2.suggestedFilename(), 'precios-locos-story.png');
});

await step('un cartel por cada oferta en un .zip que se puede abrir', async () => {
  await page.locator('[data-template="estallido"]').click(); await page.locator('[data-format="post"]').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#poZip').click()]);
  assert.match(dl.suggestedFilename(), /^ofertas-almacen-don-ejemplo\.zip$/);
  const file = path.join(shots, 'ofertas.zip'); await writeFile(file, await save(dl));
  const names = JSON.parse(execFileSync('python3', ['-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps([[n, z.read(n)[:8].hex()] for n in z.namelist()]))', file], { encoding: 'utf8' }));
  assert.equal(names.length, 5); assert.ok(names.every(([n, head]) => n.endsWith('-post.png') && head === '89504e470d0a1a0a'));
});

await step('etiquetas: sólo las pendientes, con código de barras, y PDF A4 real', async () => {
  await go(page, 'labels');
  assert.equal(await page.locator('#lbSheets .lab').count(), 5);
  assert.equal(await page.locator('#lbSheets .lab svg.ean').count(), 4);
  assert.match(await page.locator('#lbSummary').innerText(), /5 etiquetas en 1 hoja/);
  await page.locator('#lbScope [data-scope="all"]').click();
  assert.equal(await page.locator('#lbSheets .lab').count(), 18);
  await page.waitForTimeout(250); await page.screenshot({ path: path.join(shots, '05-etiquetas.png') });
  await page.locator('[data-size="mediana"]').click();
  assert.match(await page.locator('#lbSummary').innerText(), /18 etiquetas en 2 hojas/);
  await page.evaluate(() => { window.printed = 0; window.print = () => { window.printed++; }; });
  await page.locator('[data-act="print"]').click();
  assert.equal(await page.evaluate(() => window.printed), 1);
  assert.equal(await page.locator('#printRoot .page').count(), 2);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  await writeFile(path.join(shots, 'etiquetas.pdf'), pdf);
  const info = JSON.parse(execFileSync('python3', ['-c', 'import sys,re,json; d=open(sys.argv[1],"rb").read(); print(json.dumps({"pages": len(re.findall(rb"/Type\\s*/Page[^s]", d)), "box": re.findall(rb"/MediaBox\\s*\\[([^\\]]+)\\]", d)[0].decode().split()}))', path.join(shots, 'etiquetas.pdf')], { encoding: 'utf8' }));
  assert.equal(info.pages, 2, 'una página de PDF por hoja de etiquetas');
  assert.ok(Math.abs(Number(info.box[2]) - 595.9) < 1.5 && Math.abs(Number(info.box[3]) - 842.9) < 1.5, 'tamaño A4: ' + info.box.join(' '));
  await page.locator('[data-size="chica"]').click();
});

await step('marcar como impresas limpia los pendientes', async () => {
  await page.locator('#lbScope [data-scope="pending"]').click();
  await page.locator('[data-act="done"]').click();
  assert.equal((await data(page)).products.filter((p) => p.pending).length, 0);
  assert.equal(await page.locator('#n-labels').getAttribute('data-badge'), null);
  assert.match(await page.locator('#lbSheets').innerText(), /Todo al día/i);
});

await step('negocio: nombre, colores y logo se aplican a los carteles', async () => {
  await go(page, 'shop');
  await page.locator('#shName').fill('Kiosco La Esquina'); await page.locator('#shName').blur();
  assert.equal(await page.locator('#shopName').innerText(), 'Kiosco La Esquina');
  await page.locator('[data-preset="1"]').click();
  assert.equal((await data(page)).shop.color, '#0B5FFF');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#0a0'; x.fillRect(0, 0, 900, 500); return c.toDataURL('image/png').split(',')[1]; });
  await page.locator('#fileLogo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.locator('#shLogo img').waitFor();
  const dims = await page.evaluate(() => new Promise((r) => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = window.remarca.store.get().model.shop.logo; }));
  assert.deepEqual(dims, [320, 178], 'el logo se achica a 320 px');
  await go(page, 'posters'); await page.waitForTimeout(300);
  const top = await page.evaluate(() => [...document.querySelector('#poCanvas').getContext('2d').getImageData(2, 2, 1, 1).data].slice(0, 3));
  assert.deepEqual(top, [11, 95, 255]);
  await page.screenshot({ path: path.join(shots, '06-otros-colores.png') });
});

await step('importar una lista pegada desde Excel: revisa, avisa errores y actualiza', async () => {
  await page.keyboard.press('Control+k'); await page.locator('#paletteInput').fill('importar lista'); await page.keyboard.press('Enter');
  const form = page.locator('#sheet form');
  await form.locator('#imText').fill('Producto\tPrecio\tRubro\nYerba mate 1 kg\t5.100\tAlmacén\nAlfajor triple\t950\tKiosco\nSin precio\t\t\nLeche entera 1 L\t1450\tLácteos');
  assert.match(await form.locator('#imResult').innerText(), /3 productos listos[\s\S]*1 renglón tiene problemas[\s\S]*Renglón 4/);
  await form.locator('#imApply').click();
  assert.match(await page.locator('.toast').last().innerText(), /1 nuevo, 1 precio actualizado, 1 sin cambios/);
  const d = await data(page);
  assert.equal(d.products.length, 19); assert.equal(d.view, 'products');
  assert.deepEqual(d.products.filter((p) => p.pending).map((p) => p.name).sort(), ['Alfajor triple', 'Yerba mate 1 kg']);
  assert.equal((await find(page, 'Yerba')).prev, 4850);
});

await step('exportar la lista, guardar una copia, borrar todo y recuperarla', async () => {
  await go(page, 'shop');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export-csv"]').click()]);
  assert.equal((await save(csv)).toString('utf8').trim().split('\r\n').length, 20);
  const [bk] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="backup"]').click()]);
  assert.equal(bk.suggestedFilename(), 'kiosco-la-esquina.remarca.json');
  const backup = await save(bk);
  await page.locator('[data-act="wipe"]').click();
  await page.locator('#dialog button', { hasText: 'Borrar todo' }).click();
  await page.waitForFunction(() => window.remarca.store.get().model.products.length === 0);
  await go(page, 'products');
  assert.match(await page.locator('#pList').innerText(), /Todavía no hay productos/i);
  await page.screenshot({ path: path.join(shots, '07-vacio.png') });
  await page.locator('#fileBackup').setInputFiles({ name: 'mala.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"otra-cosa"}') });
  await page.locator('#dialog[open]').waitFor();
  assert.match(await page.locator('#dialog').innerText(), /no es una copia de Remarca/);
  await page.locator('#dialog button').click();
  await page.locator('#dialog').waitFor({ state: 'hidden' });
  await page.locator('#fileBackup').setInputFiles({ name: 'copia.remarca.json', mimeType: 'application/json', buffer: backup });
  await page.waitForFunction(() => window.remarca.store.get().model.products.length === 19);
  const d = await data(page);
  assert.equal(d.shop.name, 'Kiosco La Esquina'); assert.ok(d.shop.logo.startsWith('data:image/png'));
});

await step('tema oscuro y datos persisten tras recargar', async () => {
  const before = await page.evaluate(() => document.documentElement.dataset.theme), after = before === 'dark' ? 'light' : 'dark';
  await page.locator('#btnTheme').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, '08-otro-tema.png') });
  await page.reload(); await page.waitForFunction(() => window.remarca && !document.querySelector('#boot'));
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), after);
  const d = await data(page);
  assert.equal(d.products.length, 19); assert.equal(d.shop.name, 'Kiosco La Esquina'); assert.equal(d.shop.color, '#0B5FFF');
});

await step('ayuda y navegación con el teclado', async () => {
  await page.locator('h1').first().click();
  await page.keyboard.press('3'); assert.equal((await data(page)).view, 'labels');
  await page.keyboard.press('1'); assert.equal((await data(page)).view, 'products');
  await page.keyboard.press('/'); assert.equal(await page.evaluate(() => document.activeElement.id), 'pQuery');
  await page.locator('h1').first().click(); await page.keyboard.press('Shift+?');
  await page.locator('#dialog[open]').waitFor();
  assert.match(await page.locator('#dialog').innerText(), /Ctrl K/);
  await page.keyboard.press('Escape');
});
await page.context().close();

console.log('Celular (390 × 844, táctil)');
const phone = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await step('móvil: no desborda en ninguna sección', async () => {
  await phone.waitForTimeout(700);
  for (const v of ['products', 'posters', 'labels', 'shop']) {
    await phone.locator(`#n-${v}`).tap(); await phone.waitForTimeout(350);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('#main').scrollWidth <= document.querySelector('#main').clientWidth + 1), true, v);
    await phone.screenshot({ path: path.join(shots, `09-celular-${v}.png`) });
  }
});
await step('móvil: agregar, remarcar y ver las etiquetas pendientes', async () => {
  await phone.locator('#n-products').tap();
  await phone.locator('#quickAdd [name="name"]').fill('Chicles'); await phone.locator('#quickAdd [name="price"]').fill('300');
  await phone.locator('#quickAdd button').tap();
  assert.equal((await data(phone)).products.length, 19);
  await phone.locator('#v-products [data-act="reprice"]').first().tap();
  await phone.locator('#sheet [data-pct="15"]').tap();
  await phone.waitForTimeout(200); await phone.screenshot({ path: path.join(shots, '10-celular-remarcar.png') });
  await phone.locator('#rpApply').tap();
  assert.equal((await find(phone, 'Chicles')).price, 350);
  await phone.locator('#n-labels').tap();
  assert.equal(await phone.locator('#lbSheets .lab').count(), 19);
});
await phone.context().close();

await browser.close(); server.close();
if (problems.length) console.log('\nProblemas en consola o red:\n  ' + [...new Set(problems)].join('\n  '));
const failed = results.filter((r) => r[0] !== 'ok');
console.log(`\n${results.length - failed.length} de ${results.length} pruebas pasaron` + (problems.length ? `, ${new Set(problems).size} problemas de consola/red` : ', sin errores de consola ni de red'));
process.exit(failed.length || problems.length ? 1 : 0);
