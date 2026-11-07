// Dinero en unidad menor (centavos) como enteros. Nunca floats para importes.
// Máximo admitido: 99.999.999.999.999 centavos (coincide con el CHECK de la base).

export const MAX_MINOR = 99999999999999;

/**
 * Convierte lo que escribe el usuario (formato argentino) a centavos.
 * Acepta: "1500", "1.500", "1.500,5", "1500,50", "1500.50" (punto decimal si hay 1 o 2 decimales).
 * Devuelve { ok: true, value } o { ok: false, error }.
 */
export function parseMoney(input) {
  const raw = String(input ?? '').trim().replace(/\s+/g, '').replace(/^\$/, '');
  if (raw === '') return { ok: false, error: 'Ingresá un importe.' };
  if (raw.startsWith('-')) return { ok: false, error: 'El importe no puede ser negativo.' };
  if (!/^[0-9.,]+$/.test(raw)) return { ok: false, error: 'Usá solo números, puntos y una coma.' };

  let intPart;
  let decPart = '';

  if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length > 2) return { ok: false, error: 'Usá una sola coma para los decimales.' };
    [intPart, decPart] = parts;
    if (!validThousands(intPart)) return { ok: false, error: 'Revisá los puntos de miles.' };
    intPart = intPart.replace(/\./g, '');
  } else {
    const dots = raw.split('.');
    if (dots.length === 1) {
      intPart = raw;
    } else if (dots.length === 2 && dots[1].length >= 1 && dots[1].length <= 2) {
      // "1500.5" o "1500.50": punto como decimal.
      [intPart, decPart] = dots;
    } else {
      if (!validThousands(raw)) return { ok: false, error: 'Revisá los puntos de miles.' };
      intPart = raw.replace(/\./g, '');
    }
  }

  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(decPart)) return { ok: false, error: 'Importe inválido.' };
  if (decPart.length > 2) return { ok: false, error: 'Usá como máximo 2 decimales.' };

  const digits = intPart.replace(/^0+(?=\d)/, '') + decPart.padEnd(2, '0');
  if (digits.length > 15) return { ok: false, error: 'El importe es demasiado grande.' };
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value > MAX_MINOR) return { ok: false, error: 'El importe es demasiado grande.' };
  return { ok: true, value };
}

function validThousands(s) {
  if (!s.includes('.')) return true;
  return /^\d{1,3}(\.\d{3})+$/.test(s);
}

/** Formatea centavos como "$ 1.234,56" (ARS) o "USD 1.234,56". */
export function formatMoney(minor, currency = 'ARS') {
  if (minor === null || minor === undefined || minor === '') return '';
  const n = Number(minor);
  if (!Number.isSafeInteger(n)) return '';
  const negative = n < 0;
  const abs = Math.abs(n);
  const units = Math.trunc(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  const unitsText = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(units);
  const symbol = currency === 'ARS' ? '$' : currency;
  return `${negative ? '-' : ''}${symbol} ${unitsText},${cents}`;
}

/** Centavos a texto editable "1.234,56" (para precargar inputs). */
export function minorToInput(minor) {
  if (minor === null || minor === undefined) return '';
  return formatMoney(minor, 'ARS').replace(/^\$ /, '');
}

/** Porcentaje escrito ("21", "10,5") a puntos básicos (2100, 1050). */
export function parsePercentToBp(input) {
  const raw = String(input ?? '').trim().replace('%', '').replace(',', '.');
  if (raw === '') return { ok: false, error: 'Ingresá un porcentaje.' };
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw)) return { ok: false, error: 'Porcentaje inválido (ej: 21 o 10,5).' };
  const [i, d = ''] = raw.split('.');
  const bp = Number(i) * 100 + Number(d.padEnd(2, '0'));
  if (bp > 10000) return { ok: false, error: 'El porcentaje no puede superar 100.' };
  return { ok: true, value: bp };
}

export function bpToPercentText(bp) {
  const n = Number(bp) || 0;
  const i = Math.trunc(n / 100);
  const d = n % 100;
  if (d === 0) return String(i);
  return `${i},${String(d).padStart(2, '0').replace(/0$/, '')}`;
}
