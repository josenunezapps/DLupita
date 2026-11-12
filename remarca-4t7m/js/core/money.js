// Precios en pesos: lectura tolerante, formato argentino y reglas de redondeo.

/** Lee "1.250,50", "$ 1.250", "1250.5" o "1,250.50". Devuelve null si no es un precio. */
export function parseMoney(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? text : null;
  let t = String(text ?? '').trim().replace(/[$\s]|ARS/gi, '');
  if (!t || !/^\d[\d.,]*$/.test(t)) return null;
  const lastDot = t.lastIndexOf('.'), lastComma = t.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    t = t.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (lastComma >= 0) {
    // Una sola coma con 1 o 2 cifras detrás es decimal; con 3, separador de miles.
    t = /^\d+,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.split(',').join('');
  } else if (lastDot >= 0) {
    // En Argentina "1.250" es mil doscientos cincuenta; "12.5" es doce y medio.
    t = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.split('.').join('') : t;
    if ((t.match(/\./g) || []).length > 1) return null;
  }
  const v = Number(t);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

const whole = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Partes de un precio para dibujarlo con los centavos chicos: {int:"1.250", dec:"50"|""}. */
export function moneyParts(v) {
  const r = Math.round(v * 100) / 100;
  if (Number.isInteger(r)) return { int: whole.format(r), dec: '' };
  const [int, dec] = cents.format(r).split(',');
  return { int, dec };
}
export function formatMoney(v) { const p = moneyParts(v); return '$ ' + p.int + (p.dec ? ',' + p.dec : ''); }

export const ROUNDINGS = [
  { id: '1', label: 'Al peso, sin redondear' },
  { id: '10', label: 'A múltiplos de $ 10' },
  { id: '50', label: 'A múltiplos de $ 50' },
  { id: '100', label: 'A múltiplos de $ 100' },
  { id: '90', label: 'Terminados en 90' },
  { id: '99', label: 'Terminados en 99' },
];

/** Redondea al valor más cercano que cumple la regla. Nunca devuelve cero ni negativo. */
export function roundPrice(v, rule = '1') {
  if (!(v > 0)) return 0;
  if (rule === '10' || rule === '50' || rule === '100') { const k = Number(rule); return Math.max(k, Math.round(v / k) * k); }
  if (rule === '90' || rule === '99') {
    const end = Number(rule);
    if (v < 100) return Math.max(1, Math.round(v)); // un precio de dos cifras no puede terminar en 90 sin deformarse
    return Math.max(end, Math.round((v - end) / 100) * 100 + end);
  }
  return Math.max(1, Math.round(v));
}
