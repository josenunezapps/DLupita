// Pruebas del núcleo. Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { formatMoney, moneyParts, parseMoney, roundPrice } from '../js/core/money.js';
import { checkDigit, eanSVG, encodeEAN13, isEAN13, normalizeEAN } from '../js/core/ean.js';
import { crc32, makeZip } from '../js/core/zip.js';
import { fitText, wrap } from '../js/core/fit.js';
import { addProduct, categories, discount, emptyData, mergeImport, previewReprice, queryProducts, reprice, updateProduct, validateData, validateProduct } from '../js/core/products.js';
import { parseCSV, rowsToProducts, toCSV } from '../js/core/csv.js';
import { createPersistence, parseBackup, serializeBackup } from '../js/core/persist.js';
import { demoData } from '../js/core/demo.js';
import { createStore } from '../js/core/store.js';

test('lee precios escritos a la argentina y a la inglesa', () => {
  const cases = { '1.250': 1250, '1.250,50': 1250.5, '$ 1.250': 1250, '1250.5': 1250.5, '1,250.50': 1250.5, '12,5': 12.5, '990': 990, '1.234.567': 1234567, '2,500': 2500, ' $4850 ': 4850 };
  for (const [text, value] of Object.entries(cases)) assert.equal(parseMoney(text), value, text);
  for (const bad of ['', 'abc', '-5', '12..5', '1.2.3', 'gratis']) assert.equal(parseMoney(bad), null, bad);
});

test('formatea en pesos con punto de miles', () => {
  assert.equal(formatMoney(1250), '$ 1.250'); assert.equal(formatMoney(1250.5), '$ 1.250,50'); assert.equal(formatMoney(99), '$ 99');
  assert.deepEqual(moneyParts(4850), { int: '4.850', dec: '' }); assert.deepEqual(moneyParts(12.9), { int: '12', dec: '90' });
});

test('reglas de redondeo', () => {
  assert.equal(roundPrice(1234.4, '1'), 1234); assert.equal(roundPrice(1234, '10'), 1230); assert.equal(roundPrice(1235, '10'), 1240);
  assert.equal(roundPrice(1274, '50'), 1250); assert.equal(roundPrice(1275, '50'), 1300); assert.equal(roundPrice(1249, '100'), 1200);
  assert.equal(roundPrice(1234, '90'), 1190); assert.equal(roundPrice(1245, '90'), 1290); assert.equal(roundPrice(1245, '99'), 1199); assert.equal(roundPrice(1250, '99'), 1299);
  assert.equal(roundPrice(3, '100'), 100, 'nunca redondea a cero'); assert.equal(roundPrice(45, '90'), 45, 'los precios de dos cifras no se deforman');
  for (const rule of ['1', '10', '50', '100', '90', '99']) for (const v of [1, 37, 120, 999, 15480.3]) assert.ok(roundPrice(v, rule) > 0);
});

test('EAN-13: dígito verificador y barras', () => {
  assert.equal(checkDigit('400638133393'), 1); assert.ok(isEAN13('4006381333931')); assert.equal(isEAN13('4006381333932'), false);
  assert.equal(normalizeEAN('779000100001'), '7790001000019'); assert.equal(normalizeEAN('123'), null);
  const m = encodeEAN13('4006381333931');
  assert.equal(m.length, 95); assert.ok(m.startsWith('101') && m.endsWith('101')); assert.equal(m.slice(45, 50), '01010');
  // Primer grupo del ejemplo canónico: paridad LGLLGG para el dígito inicial 4 → 0, 0, 6, 3, 8, 1
  assert.equal(m.slice(3, 45), '0001101' + '0100111' + '0101111' + '0111101' + '0001001' + '0110011');
  assert.match(eanSVG('4006381333931'), /^<svg[\s\S]+4006381333931<\/text><\/svg>$/); assert.equal(eanSVG('nada'), '');
});

test('ZIP: CRC conocido y archivo que otro programa puede abrir', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [{ name: 'oferta yerba.txt', data: new TextEncoder().encode('hola') }, { name: 'ñandú.bin', data: Uint8Array.from({ length: 5000 }, (_, i) => i % 251) }];
  const zip = makeZip(files);
  assert.equal(new DataView(zip.buffer).getUint32(0, true), 0x04034b50);
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'remarca-')), 'prueba.zip');
  writeFileSync(file, zip);
  let listing;
  try { listing = execFileSync('python3', ['-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n: len(z.read(n)) for n in z.namelist()}))', file], { encoding: 'utf8' }); }
  catch (e) { if (e.code === 'ENOENT') return; throw e; }
  assert.deepEqual(JSON.parse(listing), { 'oferta yerba.txt': 4, 'ñandú.bin': 5000 });
});

test('ajuste de texto: parte en renglones y elige el cuerpo más grande que entra', () => {
  const measureAt = (size) => (s) => s.length * size * 0.5;
  assert.deepEqual(wrap(measureAt(10), 'aceite de girasol', 45), ['aceite de', 'girasol']);
  const one = fitText(measureAt, 'Yerba', { maxWidth: 500, maxSize: 300, maxLines: 1 });
  assert.ok(one.size > 195 && one.size <= 200, String(one.size)); assert.deepEqual(one.lines, ['Yerba']);
  const two = fitText(measureAt, 'Aceite de girasol 900 ml', { maxWidth: 400, maxSize: 200, maxLines: 2 });
  assert.equal(two.lines.length, 2); assert.ok(two.lines.every((l) => measureAt(two.size)(l) <= 400));
  const single = fitText(measureAt, 'Aceite de girasol 900 ml', { maxWidth: 400, maxSize: 200, maxLines: 1 });
  const even = fitText(measureAt, 'Yerba mate 1 kg', { maxWidth: 660, maxSize: 110, maxLines: 2 });
  assert.deepEqual(even.lines, ['Yerba', 'mate 1 kg'], 'reparte parejo en vez de dejar «kg» colgando');
  assert.ok(two.size > single.size, 'con dos renglones la letra es más grande');
});

test('validación de productos con mensajes claros', () => {
  assert.equal(validateProduct({ name: '', price: '100' }).errors.name.includes('nombre'), true);
  assert.match(validateProduct({ name: 'Pan', price: 'caro' }).errors.price, /números/);
  assert.match(validateProduct({ name: 'Pan', price: '0' }).errors.price, /mayor que cero/);
  assert.match(validateProduct({ name: 'Pan', price: '10', code: '7790001000010' }).errors.code, /último dígito/);
  const ok = validateProduct({ name: '  Pan   francés ', price: '2.400', unit: 'kg', code: '779000100001', category: ' Frescos ' });
  assert.deepEqual(ok.value, { name: 'Pan francés', price: 2400, prev: null, unit: 'kg', category: 'Frescos', code: '7790001000019', offer: false });
});

test('cambiar un precio guarda el anterior y deja la etiqueta pendiente', () => {
  const d = emptyData(), p = addProduct(d, { name: 'Pan', price: 100 });
  p.pending = false;
  updateProduct(d, p.id, { category: 'Frescos' }); assert.equal(p.pending, false, 'la categoría no cambia la etiqueta');
  updateProduct(d, p.id, { price: 120 }); assert.equal(p.prev, 100); assert.equal(p.pending, true);
  updateProduct(d, p.id, { price: 90, offer: true }); assert.equal(p.prev, 120); assert.equal(discount(p), 25);
  updateProduct(d, p.id, { price: 90, prev: 150 }); assert.equal(p.prev, 150, 'se puede corregir el precio anterior a mano'); assert.equal(discount(p), 40);
});

test('remarcar: vista previa, alcance y redondeo', () => {
  const d = demoData(), before = structuredClone(d.products);
  const lacteos = d.products.filter((p) => p.category === 'Lácteos').map((p) => p.id);
  const pv = previewReprice(d, { ids: lacteos, pct: 10, rounding: '50' });
  assert.equal(pv.count, 3); assert.equal(pv.total, 3); assert.deepEqual(d.products, before, 'la vista previa no modifica nada');
  assert.deepEqual(pv.changes.map((c) => c.after), [1600, 9800, 2900]);
  const done = reprice(d, { ids: lacteos, pct: 10, rounding: '50' });
  assert.equal(done.count, 3);
  const leche = d.products.find((p) => p.name.startsWith('Leche'));
  assert.equal(leche.price, 1600); assert.equal(leche.prev, 1450); assert.equal(leche.pending, true);
  assert.equal(d.products.find((p) => p.name.startsWith('Azúcar')).price, 1290, 'lo que queda fuera del alcance no cambia');
  const all = previewReprice(d, { pct: -5, rounding: '10' });
  assert.ok(all.realPct < -4 && all.realPct > -6, String(all.realPct));
  assert.equal(previewReprice(d, { pct: 0, rounding: '1' }).count, 0);
});

test('búsqueda, filtros y orden de productos', () => {
  const d = demoData();
  assert.equal(queryProducts(d, { query: 'jamon' }).length, 1, 'ignora tildes');
  assert.equal(queryProducts(d, { query: 'oferta' }).length, 5);
  assert.equal(queryProducts(d, { query: '>3000 almacen' }).map((p) => p.name).join(), 'Yerba mate 1 kg');
  assert.equal(queryProducts(d, { query: '7790001000064' })[0].name, 'Leche entera 1 L');
  assert.equal(queryProducts(d, { category: 'Bebidas' }).length, 2);
  assert.equal(queryProducts(d, { flag: 'pending' }).length, 5);
  const up = queryProducts(d, { sort: 'priceUp' }); assert.ok(up[0].price <= up[1].price && up.at(-1).price === 8900);
  assert.deepEqual(categories(d), ['Almacén', 'Bebidas', 'Fiambres', 'Frescos', 'Lácteos', 'Limpieza']);
});

test('CSV: separadores, comillas, encabezados y errores por renglón', () => {
  assert.deepEqual(parseCSV('a;b\r\n"x;1";"dijo ""hola"""\n\n'), [['a', 'b'], ['x;1', 'dijo "hola"']]);
  assert.deepEqual(parseCSV('a,b\n1,2'), [['a', 'b'], ['1', '2']]); assert.deepEqual(parseCSV('a\tb\n1\t2')[1], ['1', '2']);
  const withHead = rowsToProducts(parseCSV('Código;Descripción;Rubro;Precio;Unidad\n7790001000019;Yerba 1 kg;Almacén;$ 4.850,00;un\n;Queso;Lácteos;8900;kilo\n;Sin precio;;;\n'));
  assert.equal(withHead.hasHeader, true); assert.equal(withHead.items.length, 2);
  assert.deepEqual(withHead.items[1], { name: 'Queso', price: 8900, prev: null, unit: 'kg', category: 'Lácteos', code: '', offer: false });
  assert.equal(withHead.errors[0].line, 4); assert.match(withHead.errors[0].message, /precio/);
  const bare = rowsToProducts(parseCSV('Pan francés,2400\nHuevos,3900,Frescos'));
  assert.equal(bare.hasHeader, false); assert.equal(bare.items.length, 2); assert.equal(bare.items[1].category, 'Frescos');
});

test('exportar a CSV y volver a importar conserva los productos', () => {
  const d = demoData();
  const back = rowsToProducts(parseCSV(toCSV(d.products)));
  assert.equal(back.errors.length, 0); assert.equal(back.items.length, d.products.length);
  d.products.forEach((p, i) => { assert.equal(back.items[i].name, p.name); assert.equal(back.items[i].price, p.price); assert.equal(back.items[i].unit, p.unit); assert.equal(back.items[i].code, p.code); });
});

test('importar una lista nueva del proveedor actualiza precios y marca sólo lo que cambió', () => {
  const d = demoData(); d.products.forEach((p) => { p.pending = false; });
  const r = mergeImport(d, [
    { name: 'YERBA MATE 1 KG', price: 5200, category: '', code: '' },          // mismo nombre, otro precio
    { name: 'Otro nombre', price: 1450, category: '', code: '7790001000064' }, // mismo código, mismo precio
    { name: 'Dulce de leche 400 g', price: 2300, category: 'Almacén', code: '', unit: 'un' },
  ]);
  assert.deepEqual(r, { added: 1, updated: 1, unchanged: 1, skipped: 0 });
  const yerba = d.products.find((p) => p.name === 'Yerba mate 1 kg');
  assert.equal(yerba.price, 5200); assert.equal(yerba.prev, 4850);
  assert.deepEqual(d.products.filter((p) => p.pending).map((p) => p.name), ['Yerba mate 1 kg', 'Dulce de leche 400 g']);
});

test('copia de seguridad: ida y vuelta, y rechazo de archivos ajenos', () => {
  const d = demoData();
  const back = parseBackup(serializeBackup(d));
  assert.ok(back.ok); assert.equal(back.bad, 0);
  assert.deepEqual(back.data.products.map((p) => [p.name, p.price, p.prev, p.offer, p.pending, p.code]), d.products.map((p) => [p.name, p.price, p.prev, p.offer, p.pending, p.code]));
  assert.equal(back.data.shop.name, 'Almacén Don Ejemplo');
  assert.match(parseBackup('{{').error, /copia válido/); assert.match(parseBackup('{"kind":"otra"}').error, /no es una copia/);
  const dirty = validateData({ shop: { color: 'rojo', logo: 'javascript:alert(1)' }, products: [{ name: 'Bien', price: 10 }, { name: '', price: 5 }, null] });
  assert.equal(dirty.data.products.length, 1); assert.equal(dirty.bad, 2); assert.equal(dirty.data.shop.color, '#E4002B'); assert.equal(dirty.data.shop.logo, null);
});

test('persistencia: guarda, recupera y sobrevive a datos rotos o a un navegador sin almacenamiento', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
  const p = createPersistence(storage);
  assert.equal(p.isNew(), true);
  assert.ok(p.save(demoData()).ok); p.savePrefs({ theme: 'dark' });
  const again = createPersistence(storage);
  assert.equal(again.load().products.length, 18); assert.equal(again.prefs().theme, 'dark'); assert.equal(again.isNew(), false);
  map.set('remarca.v1', 'roto{'); assert.equal(createPersistence(storage).corrupted, true);
  const blocked = createPersistence({ getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} });
  assert.equal(blocked.volatile, true); assert.ok(blocked.save(demoData()).ok);
});

test('historial: deshacer y rehacer un remarcado', () => {
  const s = createStore({ model: demoData() });
  const before = s.get().model.products.map((p) => p.price);
  s.mutate((d) => { reprice(d, { pct: 12, rounding: '10' }); }, { label: 'remarcar' });
  assert.notDeepEqual(s.get().model.products.map((p) => p.price), before);
  assert.equal(s.undo(), 'remarcar'); assert.deepEqual(s.get().model.products.map((p) => p.price), before);
  s.redo(); assert.equal(s.get().model.products[0].price, 5430);
});
