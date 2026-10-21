import { clamp, smooth } from './util.js';

// Atmósfera por capítulo: niebla, color de fondo, entorno de reflejos, exposición y bloom.
// Entre capítulos se interpola alrededor del umbral (una puerta/corredor oscuro) y el entorno de reflejos se cambia
// justo en el centro de esa zona de paso, cuando la imagen es más oscura, para que el cambio no se note.
const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
export const BOUNDS = [0.15, 0.355, 0.52, 0.68, 0.86];     // umbrales entre capítulos (progreso)
const A = [
  { env: 'night',      envI: 1.0, fog: rgb(0x08080c), fogDensity: 0.0052, hor: rgb(0x15161d), stars: 1.0, dust: 0.45, hemi: 0.16, camLight: 6,  exposure: 1.00, bloom: 0.30 },
  { env: 'studio',     envI: 1.0, fog: rgb(0x0b0a10), fogDensity: 0.0060, hor: rgb(0x14141b), stars: 0.5, dust: 0.55, hemi: 0.30, camLight: 8,  exposure: 1.00, bloom: 0.18 },
  { env: 'industrial', envI: 1.0, fog: rgb(0x0a0a0f), fogDensity: 0.0085, hor: rgb(0x101116), stars: 0.0, dust: 0.70, hemi: 0.20, camLight: 8,  exposure: 1.00, bloom: 0.26 },
  { env: 'studio',     envI: 1.1, fog: rgb(0x0d0c13), fogDensity: 0.0045, hor: rgb(0x15151d), stars: 0.4, dust: 0.45, hemi: 0.40, camLight: 8,  exposure: 1.02, bloom: 0.16 },
  { env: 'industrial', envI: 0.9, fog: rgb(0x06070d), fogDensity: 0.0100, hor: rgb(0x0d0e14), stars: 0.0, dust: 0.65, hemi: 0.45, camLight: 18,  exposure: 1.00, bloom: 0.26 },
  { env: 'hall',       envI: 1.35, fog: rgb(0x050408), fogDensity: 0.0075, hor: rgb(0x121118), stars: 0.3, dust: 0.60, hemi: 0.34, camLight: 2,  exposure: 1.00, bloom: 0.34 },
];
const W = 0.016;       // semiancho de la zona de mezcla alrededor de cada umbral
const out = {};
const lerpArr = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const L = (a, b, t) => a + (b - a) * t;

export function atmosAt(p) {
  let c = 0;
  while (c < BOUNDS.length && p > BOUNDS[c]) c++;                 // capítulo actual (0..5)
  let a = A[c], b = A[c], t = 0, dip = 0;
  // Cerca de un umbral: mezcla con el capítulo vecino
  for (let i = 0; i < BOUNDS.length; i++) {
    const d = p - BOUNDS[i];
    if (Math.abs(d) < W) { a = A[i]; b = A[i + 1]; t = smooth(-W, W, d); dip = 1 - Math.min(1, Math.abs(d) / (W * 0.55)); }
  }
  out.env = t < 0.5 ? a.env : b.env;
  out.envI = L(a.envI, b.envI, t) * (1 - 0.8 * Math.max(0, dip));      // se oscurece al cruzar el umbral y allí se cambia el entorno
  out.fog = lerpArr(a.fog, b.fog, t);
  out.hor = lerpArr(a.hor, b.hor, t);
  out.fogDensity = L(a.fogDensity, b.fogDensity, t) * (1 + 0.8 * Math.max(0, dip));
  for (const k of ['stars', 'dust', 'hemi', 'camLight', 'exposure', 'bloom']) out[k] = L(a[k], b[k], t);
  out.chapter = c;
  return out;
}
