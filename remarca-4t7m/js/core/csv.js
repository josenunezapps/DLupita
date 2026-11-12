// Listas de precios en CSV: lectura tolerante (lo que sale de Excel, Sheets o del proveedor) y exportación.
import { UNITS, validateProduct } from './products.js';

/** Analiza texto delimitado respetando comillas. Detecta el separador (; , o tabulación). */
export function parseCSV(text) {
  const src = String(text).replace(/^﻿/, '');
  const first = src.split(/\r?\n/).find((l) => l.trim()) || '';
  const count = (ch) => first.split(ch).length - 1;
  const delim = count('\t') >= Math.max(count(';'), count(','), 1) ? '\t' : count(';') >= count(',') && count(';') > 0 ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const HEADERS = {
  name: ['nombre', 'producto', 'descripcion', 'descripción', 'articulo', 'artículo', 'detalle', 'name'],
  price: ['precio', 'importe', 'pvp', 'valor', 'price', 'precio venta', 'precio de venta'],
  category: ['categoria', 'categoría', 'rubro', 'familia', 'seccion', 'sección'],
  code: ['codigo', 'código', 'ean', 'codigo de barras', 'código de barras', 'barras', 'sku'],
  unit: ['unidad', 'medida', 'unit'],
  prev: ['precio anterior', 'anterior', 'antes'],
};
const UNIT_WORDS = { un: ['un', 'u', 'unidad', 'c/u'], kg: ['kg', 'kilo', 'kilos'], '100g': ['100g', '100 g', '100gr'], lt: ['lt', 'l', 'litro', 'litros'], doc: ['doc', 'docena'], pack: ['pack', 'paquete'], m: ['m', 'metro', 'mt'] };

/** Convierte filas en productos válidos. Sin encabezado asume: nombre, precio, categoría, código. */
export function rowsToProducts(rows) {
  if (!rows.length) return { items: [], errors: [], hasHeader: false };
  const head = rows[0].map((c) => c.toLowerCase());
  const map = {};
  for (const [field, words] of Object.entries(HEADERS)) { const i = head.findIndex((h) => words.includes(h)); if (i >= 0) map[field] = i; }
  const hasHeader = map.name != null && map.price != null;
  if (!hasHeader) Object.assign(map, { name: 0, price: 1, category: 2, code: 3 }), delete map.unit, delete map.prev;
  const items = [], errors = [];
  rows.slice(hasHeader ? 1 : 0).forEach((r, i) => {
    const line = i + (hasHeader ? 2 : 1);
    const unitRaw = (r[map.unit] || '').toLowerCase();
    const unit = Object.keys(UNIT_WORDS).find((u) => UNIT_WORDS[u].includes(unitRaw)) || 'un';
    const v = validateProduct({ name: r[map.name], price: r[map.price], category: r[map.category], code: r[map.code], prev: map.prev != null ? r[map.prev] : null, unit });
    if (v.ok) items.push(v.value);
    else errors.push({ line, message: Object.values(v.errors)[0], text: r.slice(0, 3).join(' | ').slice(0, 60) });
  });
  return { items, errors, hasHeader };
}

const q = (s) => (/[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
const dec = (v) => (v == null ? '' : String(v).replace('.', ','));
export function toCSV(products) {
  const unitName = (id) => UNITS.find((u) => u.id === id)?.id || 'un';
  const rows = [['nombre', 'precio', 'categoria', 'codigo', 'unidad', 'precio anterior', 'oferta']];
  for (const p of products) rows.push([p.name, dec(p.price), p.category, p.code, unitName(p.unit), dec(p.prev), p.offer ? 'si' : 'no']);
  return '﻿' + rows.map((r) => r.map((c) => q(String(c ?? ''))).join(';')).join('\r\n');
}
