// Cálculo de presupuestos. Mismas reglas que public.calc_quote() en la base:
// cualquier cambio acá debe replicarse allá (y en los tests de paridad).
//
// Reglas (D6):
//  1. Importe de línea  = cantidad × precio unitario, redondeado a centavo (mitad hacia arriba).
//  2. Descuento de línea = importe × % de la línea, redondeado a centavo. Neto = importe − descuento.
//  3. Subtotal = suma de netos de línea (ya redondeados).
//  4. Descuento general: % del subtotal (redondeado) o monto fijo (nunca mayor al subtotal).
//  5. Impuesto (solo si está activado) = (subtotal − descuento) × tasa, redondeado una vez.
//  6. Total = subtotal − descuento + impuesto.
// Cantidades en milésimas (2,5 → 2500), dinero en centavos, porcentajes en puntos básicos (21 % → 2100).
// Todo con BigInt: nunca hay floats en importes.

import { MAX_MINOR } from './money.js';

export const MAX_QTY_MILLI = 1_000_000_000; // 1.000.000 unidades
const MAX = BigInt(MAX_MINOR);

/** División entera redondeando la mitad hacia arriba (n >= 0). */
export function roundDiv(n, d) {
  return (n * 2n + d) / (d * 2n);
}

export function lineAmounts({ qty_milli, unit_price_minor, discount_bp = 0 }) {
  const gross = roundDiv(BigInt(qty_milli) * BigInt(unit_price_minor), 1000n);
  const discount = roundDiv(gross * BigInt(discount_bp || 0), 10000n);
  const net = gross - discount;
  return { gross, discount, net, overflow: gross > MAX };
}

/**
 * @param items [{qty_milli, unit_price_minor, discount_bp}]
 * @param opts {discount_type: 'none'|'percent'|'amount', discount_value, tax_enabled, tax_rate_bp}
 * Devuelve importes como Number (enteros seguros) y avisos de validación.
 */
export function quoteTotals(items, { discount_type = 'none', discount_value = 0, tax_enabled = false, tax_rate_bp = 0 } = {}) {
  let subtotal = 0n;
  let overflow = false;
  const lines = items.map((it) => {
    const a = lineAmounts(it);
    if (a.overflow) overflow = true;
    subtotal += a.net;
    return { gross: Number(a.gross > MAX ? MAX : a.gross), discount: Number(a.discount > MAX ? MAX : a.discount), net: Number(a.net > MAX ? MAX : a.net) };
  });

  let discount = 0n;
  let discountExceeds = false;
  const dv = BigInt(discount_value || 0);
  if (discount_type === 'percent') discount = roundDiv(subtotal * dv, 10000n);
  else if (discount_type === 'amount') {
    discountExceeds = dv > subtotal;
    discount = discountExceeds ? subtotal : dv;
  }

  const base = subtotal - discount;
  const tax = tax_enabled ? roundDiv(base * BigInt(tax_rate_bp || 0), 10000n) : 0n;
  const total = base + tax;
  if (total > MAX || subtotal > MAX) overflow = true;

  const clamp = (n) => Number(n > MAX ? MAX : n);
  return {
    lines,
    subtotal: clamp(subtotal),
    discount: clamp(discount),
    tax: clamp(tax),
    total: clamp(total),
    discountExceeds,
    overflow,
  };
}

/**
 * Cantidad escrita ("3", "2,5", "1.250,75", "0.5") a milésimas.
 * Coma decimal. Un punto con 1 o 2 decimales se toma como decimal; con grupos de 3 dígitos, como separador de miles.
 */
export function parseQty(input) {
  const raw = String(input ?? '').trim().replace(/\s+/g, '');
  if (raw === '') return { ok: false, error: 'Ingresá una cantidad.' };
  if (raw.startsWith('-')) return { ok: false, error: 'La cantidad no puede ser negativa.' };
  if (!/^[0-9.,]+$/.test(raw)) return { ok: false, error: 'Cantidad inválida.' };
  let int;
  let dec = '';
  if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length > 2) return { ok: false, error: 'Cantidad inválida.' };
    [int, dec] = parts;
    if (int.includes('.')) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(int)) return { ok: false, error: 'Cantidad inválida.' };
      int = int.replace(/\./g, '');
    }
  } else if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length === 2 && parts[1].length <= 2) [int, dec] = parts;
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) int = raw.replace(/\./g, '');
    else return { ok: false, error: 'Cantidad inválida. Usá coma para decimales (ej: 2,5).' };
  } else int = raw;
  if (int === '') int = '0';
  if (!/^\d+$/.test(int) || !/^\d*$/.test(dec)) return { ok: false, error: 'Cantidad inválida.' };
  if (dec.length > 3) return { ok: false, error: 'Usá como máximo 3 decimales.' };
  if (int.length > 7) return { ok: false, error: 'La cantidad es demasiado grande.' };
  const value = Number(int) * 1000 + Number(dec.padEnd(3, '0') || '0');
  if (value <= 0) return { ok: false, error: 'La cantidad tiene que ser mayor a cero.' };
  if (value > MAX_QTY_MILLI) return { ok: false, error: 'La cantidad es demasiado grande.' };
  return { ok: true, value };
}

/** Milésimas a texto: 2500 → "2,5", 3000 → "3", 1250750 → "1.250,75". */
export function formatQty(milli) {
  const n = Number(milli) || 0;
  const int = Math.trunc(n / 1000);
  const dec = String(n % 1000).padStart(3, '0').replace(/0+$/, '');
  const intText = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(int);
  return dec ? `${intText},${dec}` : intText;
}
