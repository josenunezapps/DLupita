// Pruebas de punta a punta en un navegador real. Ejecutar: npm run test:e2e
// Requiere Playwright y Chrome instalados (PLAYWRIGHT_PATH y CHROME_PATH permiten indicar dónde).
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
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

// Sirve la app bajo un subdirectorio, igual que GitHub Pages (/DLupita/laboratorio/tirante/).
const BASE = '/DLupita/laboratorio/tirante/';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end(); return; }
  let rel = url.pathname.slice(BASE.length) || 'index.html';
  try { const body = await readFile(path.join(appDir, rel)); res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }).end(body); }
  catch { res.writeHead(404).end(); }
}).listen(0);
const URL0 = `http://localhost:${server.address().port}${BASE}`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const results = [];
const problems = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push('consola: ' + m.text()); });
  page.on('pageerror', (e) => problems.push('excepción: ' + e.message));
  page.on('requestfailed', (r) => problems.push('pedido fallido: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  await page.goto(URL0);
  await page.waitForFunction(() => window.tirante && !document.querySelector('#boot'));
  return page;
}
async function step(name, fn) {
  try { await fn(); results.push(['ok', name]); console.log('  ✓', name); }
  catch (e) { results.push(['FALLA', name, e.message]); console.log('  ✗', name, '\n    ', e.message.split('\n').slice(0, 6).join(' | ')); }
}
const state = (page) => page.evaluate(() => { const a = window.tirante, s = a.store.get(); return { name: s.model.name, nodes: s.model.nodes, members: s.model.members.length, profiles: s.model.members.map((m) => m.profile), ok: a.results.ok, status: a.results.status, mass: a.results.totals?.mass, maxU: a.results.totals?.maxU, sel: s.sel, tool: s.tool, tab: s.tab, id: s.model.id }; });
const at = (page, x, y) => page.evaluate(([x, y]) => window.tirante.sheet.project(x, y), [x, y]);
const stamp = (page) => page.locator('#cjStamp span').innerText();

console.log('Escritorio');
const page = await newPage();

await step('abre con el ejemplo, calcula y muestra el sello', async () => {
  const s = await state(page);
  assert.equal(s.name, 'Puente Warren de 24 m'); assert.ok(s.ok);
  assert.equal((await stamp(page)).toLowerCase(), 'resiste');
  assert.match(await page.locator('#cjMass').innerText(), /2\.325 kg/);
  await page.screenshot({ path: path.join(shots, '01-escritorio-plano-azul.png') });
});

await step('arrastrar un nudo recalcula en vivo y se puede deshacer', async () => {
  const before = await state(page);
  const n = before.nodes.find((k) => k.id === 'N10');
  const p = await at(page, n.x, n.y), q = await at(page, n.x, n.y + 2);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 4 });
  const mid = await state(page);
  assert.notEqual(mid.maxU, before.maxU, 'debe recalcular durante el arrastre');
  await page.mouse.move(q.x, q.y, { steps: 4 }); await page.mouse.up();
  const after = await state(page);
  assert.equal(after.nodes.find((k) => k.id === 'N10').y, n.y + 2);
  await page.keyboard.press('Control+z');
  assert.equal((await state(page)).nodes.find((k) => k.id === 'N10').y, n.y, 'un solo deshacer revierte todo el arrastre');
});

await step('seleccionar una barra muestra su resultado; el inspector valida los datos', async () => {
  const s = await state(page);
  const a = s.nodes.find((k) => k.id === 'N1'), b = s.nodes.find((k) => k.id === 'N2');
  const p = await at(page, (a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.click(p.x, p.y);
  await page.locator('#tab-sel h2', { hasText: 'Barra B1' }).waitFor();
  assert.match(await page.locator('#tab-sel').innerText(), /Trabaja al \d+ %/);
  const n = await at(page, a.x, a.y); await page.mouse.click(n.x, n.y);
  const x = page.locator('#tab-sel input[data-field="x"]');
  await x.fill('abc'); await x.blur();
  assert.match(await page.locator('#tab-sel .err').first().innerText(), /número/);
  assert.equal((await state(page)).nodes.find((k) => k.id === 'N1').x, 0, 'un dato inválido no cambia el modelo');
  const down = page.locator('#tab-sel input[data-field="down"]');
  await down.fill('12,5'); await down.blur();
  assert.equal((await page.evaluate(() => window.tirante.store.get().model.nodes[0].load)).fy, -12.5);
  await page.keyboard.press('Control+z');
});

await step('paleta de comandos: buscar y ejecutar «aligerar»', async () => {
  const before = await state(page);
  await page.keyboard.press('Control+k');
  await page.locator('#paletteInput').fill('aliger');
  assert.match(await page.locator('#paletteList li[aria-selected="true"]').innerText(), /Aligerar/);
  await page.keyboard.press('Enter');
  const after = await state(page);
  assert.ok(after.mass < before.mass * 0.75, `${after.mass} < ${before.mass}`);
  assert.ok(after.maxU <= 1 && after.maxU > 0.85);
  assert.equal((await stamp(page)).toLowerCase(), 'resiste');
  await page.locator('.toast button', { hasText: 'Deshacer' }).click();
  assert.equal(Math.round((await state(page)).mass), Math.round(before.mass));
});

await step('tabla de barras: búsqueda con operadores, filtros y orden', async () => {
  await page.locator('#t-bars').click();
  const rows = page.locator('#barRows tr[data-id]');
  assert.equal(await rows.count(), 23);
  await page.locator('#barQuery').fill('uso>60');
  const n = await rows.count(); assert.ok(n > 0 && n < 23, `filtradas: ${n}`);
  const expected = await page.evaluate(() => window.tirante.results.members.filter((r) => r.u * 100 > 60).length);
  assert.equal(n, expected);
  await page.locator('#barQuery').fill('');
  await page.locator('[data-filter="compression"]').click();
  const comp = await page.evaluate(() => window.tirante.results.members.filter((r) => r.Ngov < -1e-6).length);
  assert.equal(await rows.count(), comp);
  await page.locator('[data-filter="all"]').click();
  await page.locator('th[data-sort="L"] button').click();
  const first = await rows.first().locator('td').nth(2).innerText(), lastRow = await rows.last().locator('td').nth(2).innerText();
  assert.ok(parseFloat(first.replace(',', '.')) >= parseFloat(lastRow.replace(',', '.')));
  await page.locator('#barQuery').fill('zzz');
  assert.match(await page.locator('#barRows').innerText(), /Ninguna barra coincide/);
  await page.locator('[data-act="clear"]').click();
  await rows.first().click();
  assert.equal((await state(page)).sel.members.length, 1);
});

await step('vehículo: mover el deslizador cambia los esfuerzos y las reacciones', async () => {
  const r0 = await page.evaluate(() => window.tirante.results.instant);
  await page.locator('#vehiclePos').fill('500');
  const r = await page.evaluate(() => ({ instant: window.tirante.results.instant, sum: window.tirante.results.reactions.reduce((s, q) => s + q.ry, 0) }));
  assert.equal(r0, false); assert.equal(r.instant, true);
  assert.ok(r.sum > 180, 'las reacciones incluyen el vehículo');
  await page.locator('#btnEnvelope').click();
  assert.equal(await page.evaluate(() => window.tirante.store.get().vehiclePos), null);
});

await step('exportar el proyecto y volver a importarlo da la misma estructura', async () => {
  await page.locator('#t-lib').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export-json"]').click()]);
  assert.match(dl.suggestedFilename(), /puente-warren-de-24-m\.tirante\.json/);
  const text = await readFile(await dl.path(), 'utf8');
  const before = await state(page);
  await page.evaluate((t) => window.tirante.importText(t), text);
  const after = await state(page);
  assert.notEqual(after.id, before.id, 'se importa como proyecto aparte');
  assert.equal(after.members, before.members); assert.equal(Math.round(after.mass), Math.round(before.mass));
  const [svg] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export-svg"]').click()]);
  assert.match(await readFile(await svg.path(), 'utf8'), /^<svg[\s\S]+Peso de la estructura/);
  const [csv] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act="export-csv"]').click()]);
  assert.equal((await readFile(await csv.path(), 'utf8')).trim().split('\r\n').length, 24);
});

await step('importar un archivo inválido explica el problema sin tocar el trabajo', async () => {
  const before = await state(page);
  await page.locator('#file').setInputFiles({ name: 'roto.json', mimeType: 'application/json', buffer: Buffer.from('{"kind":"tirante-proyecto","version":1,"model":{"nodes":[{"id":"N1","x":0,"y":0}],"members":[{"id":"B1","a":"N1","b":"N7","profile":"CHS 88.9x4"}]}}') });
  await page.locator('#dialog[open]').waitFor();
  assert.match(await page.locator('#dialog').innerText(), /une un nudo que no existe/);
  await page.locator('#dialog button').click();
  assert.equal((await state(page)).id, before.id);
});

await step('biblioteca: buscar, duplicar, borrar y deshacer el borrado', async () => {
  const cards = page.locator('#libCards .card');
  assert.equal(await cards.count(), 2);
  await page.locator('[data-act="duplicate"]').first().click();
  assert.equal(await cards.count(), 3);
  assert.match((await state(page)).name, /\(copia\)/);
  await page.locator('#libQuery').fill('copia');
  assert.equal(await cards.count(), 1);
  await page.locator('#libQuery').fill('');
  await page.locator('[data-act="remove"]').first().click();
  assert.equal(await cards.count(), 2);
  await page.locator('.toast button', { hasText: 'Deshacer' }).last().click();
  assert.equal(await cards.count(), 3);
});

await step('dibujar desde cero: nudos, barras, apoyos y carga hasta que resiste', async () => {
  await page.locator('[data-act="new"]').click();
  assert.equal(await page.locator('#empty').isVisible(), true);
  assert.equal((await stamp(page)).toLowerCase(), 'sin calcular');
  await page.keyboard.press('b');
  const pts = [[-2, -1], [2, -1], [0, 1]];
  const P = []; for (const [x, y] of pts) P.push(await at(page, x, y));
  await page.mouse.click(P[0].x, P[0].y); await page.mouse.click(P[1].x, P[1].y); await page.mouse.click(P[2].x, P[2].y); await page.mouse.click(P[0].x, P[0].y);
  await page.keyboard.press('Escape');
  let s = await state(page);
  assert.equal(s.nodes.length, 3); assert.equal(s.members, 3);
  assert.equal(s.status, 'unsupported');
  assert.equal(await page.locator('#status').isVisible(), true);
  await page.keyboard.press('a');
  await page.mouse.click(P[0].x, P[0].y);
  await page.mouse.click(P[1].x, P[1].y); await page.mouse.click(P[1].x, P[1].y);
  await page.keyboard.press('c'); await page.mouse.click(P[2].x, P[2].y);
  s = await state(page);
  assert.deepEqual(s.nodes.map((n) => n.support), ['pin', 'rollerX', null]);
  assert.ok(s.ok, s.status);
  assert.equal((await stamp(page)).toLowerCase(), 'resiste');
  await page.keyboard.press('v');
  await page.mouse.click(P[2].x, P[2].y); await page.locator('#sheet').focus();
  await page.keyboard.press('ArrowUp');
  assert.equal((await state(page)).nodes[2].y, 1.5, 'las flechas mueven el nudo elegido');
  await page.keyboard.press('Delete');
  assert.equal((await state(page)).nodes.length, 2);
  await page.keyboard.press('Control+z');
  assert.equal((await state(page)).members, 3);
});

await step('el pórtico inestable se detecta y se arregla con una diagonal', async () => {
  await page.keyboard.press('Control+k'); await page.locator('#paletteInput').fill('portico inestable'); await page.keyboard.press('Enter');
  let s = await state(page);
  assert.equal(s.status, 'mechanism'); assert.equal((await stamp(page)).toLowerCase(), 'inestable');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shots, '02-mecanismo.png') });
  await page.keyboard.press('b');
  const a = await at(page, 0, 0), d = await at(page, 6, 4);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(d.x, d.y, { steps: 5 }); await page.mouse.up();
  s = await state(page);
  assert.equal(s.members, 4); assert.ok(s.ok);
  await page.keyboard.press('v');
});

await step('ensayo destructivo: llega al colapso y lo explica', async () => {
  await page.keyboard.press('Control+k'); await page.locator('#paletteInput').fill('ejemplo arco'); await page.keyboard.press('Enter');
  await page.locator('#t-calc').click(); await page.locator('#cTest').click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(shots, '03-ensayo-cargando.png') });
  await page.locator('#testCard:not([hidden])').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, '04-ensayo-derrumbe.png') });
  assert.match(await page.locator('#testTitle').innerText(), /×\d,\d\d/);
  assert.match(await page.locator('#testBody').innerText(), /primera en ceder fue B\d+/);
  await page.locator('[data-act="test-close"]').click();
  assert.equal(await page.evaluate(() => window.tirante.test), null);
  assert.ok((await state(page)).ok, 'el ensayo no modifica la estructura');
});

await step('vista 3D dibuja la estructura', async () => {
  await page.keyboard.press('3');
  await page.waitForTimeout(700);
  const painted = await page.evaluate(() => { const c = document.querySelector('#view3d'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n; });
  assert.ok(painted > 5000, `pixeles pintados: ${painted}`);
  await page.screenshot({ path: path.join(shots, '05-vista-3d.png') });
  await page.keyboard.press('3');
});

await step('tema claro y persistencia tras recargar', async () => {
  await page.keyboard.press('Control+k'); await page.locator('#paletteInput').fill('ejemplo pratt'); await page.keyboard.press('Enter');
  const theme0 = await page.evaluate(() => document.documentElement.dataset.theme), theme1 = theme0 === 'dark' ? 'light' : 'dark';
  await page.locator('#sheet').focus(); await page.keyboard.press('t');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme1);
  await page.locator('#projName').fill('Puente de prueba'); await page.locator('#projName').blur();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shots, '06-escritorio-otro-tema.png') });
  await page.reload(); await page.waitForFunction(() => window.tirante && !document.querySelector('#boot'));
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme1);
  assert.equal((await state(page)).name, 'Puente de prueba');
  assert.ok(await page.evaluate(() => window.tirante.persist.list().length) >= 4);
});

await step('ayuda y atajos se abren y cierran con el teclado', async () => {
  await page.locator('#sheet').focus(); await page.keyboard.press('Shift+?');
  await page.locator('#dialog[open]').waitFor();
  assert.match(await page.locator('#dialog').innerText(), /Ctrl K/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dialog[open]').count(), 0);
});
await page.context().close();

console.log('Celular (390 × 844, táctil)');
const phone = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
await step('móvil: abre, no desborda y el panel funciona como hoja inferior', async () => {
  await phone.waitForTimeout(900);
  await phone.screenshot({ path: path.join(shots, '07-celular.png') });
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await phone.locator('#tip').isVisible(), true);
  await phone.locator('#t-calc').tap();
  assert.equal(await phone.evaluate(() => document.querySelector('#panel').classList.contains('open')), true);
  await phone.waitForTimeout(450);
  await phone.screenshot({ path: path.join(shots, '08-celular-calculo.png') });
  await phone.locator('#t-bars').tap(); await phone.waitForTimeout(200);
  await phone.screenshot({ path: path.join(shots, '09-celular-barras.png') });
  await phone.locator('#t-bars').tap();
  assert.equal(await phone.evaluate(() => document.querySelector('#panel').classList.contains('open')), false);
});
await step('móvil: tocar una barra la selecciona y arrastrar un nudo lo mueve', async () => {
  const s = await state(phone);
  const a = s.nodes.find((k) => k.id === 'N3'), b = s.nodes.find((k) => k.id === 'N4');
  await phone.waitForTimeout(900);
  const p = await at(phone, (a.x + b.x) / 2, (a.y + b.y) / 2);
  await phone.touchscreen.tap(p.x, p.y);
  assert.deepEqual((await state(phone)).sel.members, ['B7']);
  const n = s.nodes.find((k) => k.id === 'N9'), from = await at(phone, n.x, n.y), to = await at(phone, n.x, n.y + 1);
  const cdp = await phone.context().newCDPSession(phone);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', from.x, from.y);
  for (let i = 1; i <= 6; i++) await touch('touchMove', from.x, from.y + ((to.y - from.y) * i) / 6);
  await touch('touchEnd');
  assert.equal((await state(phone)).nodes.find((k) => k.id === 'N9').y, n.y + 1);
  await phone.locator('#t-sel').tap(); await phone.waitForTimeout(900);
  await phone.screenshot({ path: path.join(shots, '10-celular-seleccion.png') });
});
await phone.context().close();

await browser.close(); server.close();
if (problems.length) console.log('\nProblemas en consola o red:\n  ' + [...new Set(problems)].join('\n  '));
const failed = results.filter((r) => r[0] !== 'ok');
console.log(`\n${results.length - failed.length} de ${results.length} pruebas pasaron` + (problems.length ? `, ${new Set(problems).size} problemas de consola/red` : ', sin errores de consola ni de red'));
process.exit(failed.length || problems.length ? 1 : 0);
