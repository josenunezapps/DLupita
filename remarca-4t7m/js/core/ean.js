// Códigos de barras EAN-13: dígito verificador y codificación en módulos (barras).
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function checkDigit(twelve) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(twelve[i]) * (i % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}
export const isEAN13 = (code) => /^\d{13}$/.test(code) && checkDigit(code) === Number(code[12]);

/** Acepta 12 dígitos (agrega el verificador) o 13 válidos. Devuelve el código de 13 o null. */
export function normalizeEAN(code) {
  const c = String(code ?? '').replace(/\s/g, '');
  if (/^\d{12}$/.test(c)) return c + checkDigit(c);
  return isEAN13(c) ? c : null;
}

/** Cadena de 95 módulos: "1" es barra, "0" es espacio. */
export function encodeEAN13(code) {
  const c = normalizeEAN(code);
  if (!c) return null;
  const parity = PARITY[Number(c[0])];
  let out = '101';
  for (let i = 1; i <= 6; i++) out += (parity[i - 1] === 'L' ? L : G)[Number(c[i])];
  out += '01010';
  for (let i = 7; i <= 12; i++) out += R[Number(c[i])];
  return out + '101';
}

/** SVG vectorial del código, listo para imprimir. */
export function eanSVG(code) {
  const modules = encodeEAN13(code), c = normalizeEAN(code);
  if (!modules) return '';
  let rects = '', run = 0;
  for (let i = 0; i <= modules.length; i++) {
    if (modules[i] === '1') run++;
    else if (run) { const guard = i <= 3 || (i > 45 && i <= 50) || i > 92; rects += `<rect x="${i - run + 7}" y="0" width="${run}" height="${guard ? 27 : 24}"/>`; run = 0; }
  }
  return `<svg class="ean" viewBox="0 0 109 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Código de barras ${c}">${rects}<text x="54.5" y="31.4" font-size="6.2" text-anchor="middle" font-family="monospace" letter-spacing="1.1">${c}</text></svg>`;
}
