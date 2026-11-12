// Datos del negocio y sus productos, con las operaciones puras que los modifican.
import { parseMoney, roundPrice } from './money.js';
import { normalizeEAN } from './ean.js';

export const UNITS = [
  { id: 'un', label: 'por unidad', short: 'c/u' },
  { id: 'kg', label: 'por kilo', short: 'el kilo' },
  { id: '100g', label: 'cada 100 gramos', short: 'los 100 g' },
  { id: 'lt', label: 'por litro', short: 'el litro' },
  { id: 'doc', label: 'por docena', short: 'la docena' },
  { id: 'pack', label: 'por pack', short: 'el pack' },
  { id: 'm', label: 'por metro', short: 'el metro' },
];
export const unitShort = (id) => (UNITS.find((u) => u.id === id) || UNITS[0]).short;
export const LIMITS = { products: 3000, name: 70, category: 30, price: 99999999 };

export function emptyData() {
  return { version: 1, demo: false, seq: 0, shop: { name: '', tagline: '', color: '#E4002B', color2: '#FFE600', logo: null }, products: [] };
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export const normName = (s) => clean(s, 200).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Valida los campos de un producto tal como los escribe una persona. */
export function validateProduct(fields) {
  const errors = {};
  const name = clean(fields.name, LIMITS.name + 1);
  if (!name) errors.name = 'Escribí el nombre del producto.';
  else if (name.length > LIMITS.name) errors.name = `El nombre puede tener hasta ${LIMITS.name} letras.`;
  const price = parseMoney(fields.price);
  if (price == null) errors.price = 'Escribí el precio con números, por ejemplo 1.250.';
  else if (price <= 0) errors.price = 'El precio tiene que ser mayor que cero.';
  else if (price > LIMITS.price) errors.price = 'Ese precio es demasiado grande.';
  let prev = null;
  if (fields.prev != null && String(fields.prev).trim() !== '') {
    prev = parseMoney(fields.prev);
    if (prev == null || prev <= 0) errors.prev = 'El precio anterior tiene que ser un número mayor que cero.';
  }
  const rawCode = clean(fields.code, 40).replace(/\s/g, '');
  let code = rawCode;
  if (/^\d{12,13}$/.test(rawCode)) {
    code = normalizeEAN(rawCode);
    if (!code) errors.code = 'El último dígito del código de barras no coincide: revisalo.';
  } else if (rawCode && !/^[\w.\-/]{1,24}$/.test(rawCode)) errors.code = 'El código admite letras, números, guiones y puntos, hasta 24 caracteres.';
  const unit = UNITS.some((u) => u.id === fields.unit) ? fields.unit : 'un';
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, errors, value: { name, price, prev, unit, category: clean(fields.category, LIMITS.category), code: code || '', offer: !!fields.offer } };
}

export function addProduct(data, value, now = Date.now()) {
  const p = { id: 'p' + ++data.seq, name: value.name, price: value.price, prev: value.prev ?? null, unit: value.unit || 'un', category: value.category || '', code: value.code || '', offer: !!value.offer, pending: true, updatedAt: now };
  data.products.push(p);
  return p;
}

/** Aplica cambios; si cambia el precio guarda el anterior y marca la etiqueta como pendiente de imprimir. */
export function updateProduct(data, id, value, now = Date.now()) {
  const p = data.products.find((k) => k.id === id);
  if (!p) return null;
  const priceChanged = value.price != null && value.price !== p.price;
  const labelChanged = priceChanged || (value.name != null && value.name !== p.name) || (value.unit != null && value.unit !== p.unit) || (value.offer != null && value.offer !== p.offer) || (value.code != null && value.code !== p.code);
  const prev = 'prev' in value && value.prev !== undefined && !(priceChanged && value.prev === p.prev) ? value.prev : priceChanged ? p.price : p.prev;
  Object.assign(p, value, { prev });
  if (labelChanged) { p.pending = true; p.updatedAt = now; }
  return p;
}

export const removeProducts = (data, ids) => { const s = new Set(ids); data.products = data.products.filter((p) => !s.has(p.id)); };
export const categories = (data) => [...new Set(data.products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

/** Porcentaje de descuento que muestra una oferta (0 si no corresponde). */
export const discount = (p) => (p.offer && p.prev && p.prev > p.price ? Math.round((1 - p.price / p.prev) * 100) : 0);

/** Calcula el remarcado sin tocar los datos: sirve para mostrar el antes y el después. */
export function previewReprice(data, { ids = null, pct, rounding = '1' }) {
  const only = ids ? new Set(ids) : null;
  const changes = [];
  for (const p of data.products) {
    if (only && !only.has(p.id)) continue;
    const after = roundPrice(p.price * (1 + pct / 100), rounding);
    if (after !== p.price) changes.push({ id: p.id, name: p.name, before: p.price, after });
  }
  const sumBefore = changes.reduce((s, c) => s + c.before, 0), sumAfter = changes.reduce((s, c) => s + c.after, 0);
  return { changes, count: changes.length, total: only ? only.size : data.products.length, realPct: sumBefore ? (sumAfter / sumBefore - 1) * 100 : 0 };
}

export function reprice(data, options, now = Date.now()) {
  const preview = previewReprice(data, options);
  const byId = new Map(preview.changes.map((c) => [c.id, c]));
  for (const p of data.products) {
    const c = byId.get(p.id);
    if (c) { p.prev = p.price; p.price = c.after; p.pending = true; p.updatedAt = now; }
  }
  return preview;
}

/** Búsqueda: palabras sueltas, y además >1000, <500, oferta, pendiente. */
export function matcher(query) {
  const tests = normName(query).split(' ').filter(Boolean).map((tok) => {
    const m = tok.match(/^(>=|<=|>|<)(\d+(?:[.,]\d+)?)$/);
    if (m) { const v = Number(m[2].replace(',', '.')); return (p) => (m[1] === '>' ? p.price > v : m[1] === '<' ? p.price < v : m[1] === '>=' ? p.price >= v : p.price <= v); }
    if (tok === 'oferta' || tok === 'ofertas') return (p) => p.offer;
    if (tok === 'pendiente' || tok === 'pendientes') return (p) => p.pending;
    return (p) => normName(`${p.name} ${p.category} ${p.code}`).includes(tok);
  });
  return (p) => tests.every((t) => t(p));
}

export const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }),
  priceUp: (a, b) => a.price - b.price,
  priceDown: (a, b) => b.price - a.price,
  recent: (a, b) => b.updatedAt - a.updatedAt,
  category: (a, b) => (a.category || 'zzz').localeCompare(b.category || 'zzz', 'es') || a.name.localeCompare(b.name, 'es'),
};

export function queryProducts(data, { query = '', category = null, flag = null, sort = 'category' } = {}) {
  const match = matcher(query);
  return data.products
    .filter((p) => match(p) && (category == null || p.category === category) && (flag === 'offer' ? p.offer : flag === 'pending' ? p.pending : true))
    .sort(SORTS[sort] || SORTS.category);
}

/** Incorpora una lista importada: actualiza por código o por nombre, agrega lo nuevo. */
export function mergeImport(data, items, now = Date.now()) {
  const byCode = new Map(data.products.filter((p) => p.code).map((p) => [p.code, p]));
  const byName = new Map(data.products.map((p) => [normName(p.name), p]));
  const result = { added: 0, updated: 0, unchanged: 0, skipped: 0 };
  for (const item of items) {
    const found = (item.code && byCode.get(item.code)) || byName.get(normName(item.name));
    if (found) {
      const patch = { price: item.price };
      if (item.category) patch.category = item.category;
      if (item.code && !found.code) patch.code = item.code;
      if (found.price === item.price && (!item.category || item.category === found.category)) { result.unchanged++; continue; }
      updateProduct(data, found.id, patch, now); result.updated++;
    } else if (data.products.length >= LIMITS.products) result.skipped++;
    else { const p = addProduct(data, item, now); byName.set(normName(p.name), p); if (p.code) byCode.set(p.code, p); result.added++; }
  }
  return result;
}

/** Valida datos que vienen de un archivo o del almacenamiento. */
export function validateData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.products)) return { ok: false, error: 'El archivo no contiene una lista de productos de Remarca.' };
  if (raw.products.length > LIMITS.products) return { ok: false, error: `Tiene ${raw.products.length} productos; el máximo es ${LIMITS.products}.` };
  const data = emptyData();
  const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d);
  const s = raw.shop || {};
  data.shop = { name: clean(s.name, 50), tagline: clean(s.tagline, 80), color: hex(s.color, data.shop.color), color2: hex(s.color2, data.shop.color2), logo: typeof s.logo === 'string' && s.logo.startsWith('data:image/') && s.logo.length < 400000 ? s.logo : null };
  data.demo = !!raw.demo;
  let bad = 0;
  for (const r of raw.products) {
    const v = validateProduct(r || {});
    if (!v.ok) { bad++; continue; }
    const p = addProduct(data, v.value, Number.isFinite(r.updatedAt) ? r.updatedAt : Date.now());
    p.pending = r.pending !== false;
  }
  return { ok: true, data, bad };
}
