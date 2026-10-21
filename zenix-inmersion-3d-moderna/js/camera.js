import * as THREE from 'three';

// Recorrido de cámara: cada llave define posición, punto de mira, FOV y alabeo (roll) para un valor de progreso 0..1.
// La interpolación es Hermite con tangentes en el espacio de progreso, así la velocidad es continua entre capítulos.
// Órbita alrededor de la sala circular de análisis (centro 0,−348): ángulo θ=0 hacia la entrada (+z).
const OC = [0, -348];
const orb = (th, r, y) => [OC[0] + Math.sin(th) * r, y, OC[1] + Math.cos(th) * r];
export const KEYS = [
  // 1 · Entrada
  { p: 0.000, pos: [0, 2.4, 64],    look: [0, 13, -30],   fov: 52, roll: 0 },
  { p: 0.045, pos: [-5, 2.8, 42],   look: [0, 9, -30],    fov: 50, roll: -0.01 },
  { p: 0.085, pos: [2, 2.5, 8],     look: [0, 7, -34],    fov: 52, roll: 0.012 },
  { p: 0.118, pos: [0, 2.3, -26],   look: [0, 3.5, -62],  fov: 56, roll: 0 },
  { p: 0.138, pos: [0, 2.3, -54],   look: [0, 3, -92],    fov: 58, roll: 0 },
  // 2 · Estación de desarrollo
  { p: 0.160, pos: [0, 2.6, -77],   look: [-3, 3.4, -100], fov: 58, roll: 0 },
  { p: 0.190, pos: [-1.2, 3.0, -91], look: [-11.2, 4.2, -99], fov: 54, roll: 0.012 },
  { p: 0.220, pos: [-3.6, 3.7, -93.5], look: [-11.2, 4.5, -100.5], fov: 48, roll: 0.01 },
  { p: 0.248, pos: [-3.2, 3.7, -103], look: [-11.2, 4.5, -106.5], fov: 48, roll: 0 },
  { p: 0.272, pos: [-2.4, 3.5, -113], look: [-11.2, 4.0, -115], fov: 50, roll: -0.01 },
  { p: 0.298, pos: [1.2, 3.5, -124], look: [11.2, 4.5, -129], fov: 50, roll: -0.015 },
  { p: 0.322, pos: [3.6, 3.7, -132], look: [11.2, 4.6, -137], fov: 48, roll: -0.01 },
  { p: 0.342, pos: [3.0, 3.5, -145], look: [11.2, 4.0, -146], fov: 50, roll: 0 },
  { p: 0.362, pos: [0, 3.0, -178],  look: [0, 3.2, -208], fov: 58, roll: 0 },
  // 3 · Procesamiento
  { p: 0.380, pos: [-0.5, 3.2, -198], look: [-3, 3.0, -220], fov: 58, roll: 0.01 },
  { p: 0.402, pos: [-6.4, 3.8, -210], look: [-1, 2.6, -224], fov: 54, roll: 0.02 },
  { p: 0.428, pos: [-6.2, 4.4, -222], look: [0.5, 4.2, -238], fov: 54, roll: 0.015 },
  { p: 0.448, pos: [-2.6, 5.0, -229], look: [0, 4.6, -247], fov: 54, roll: 0 },
  { p: 0.466, pos: [0, 4.6, -243], look: [0, 4, -263], fov: 56, roll: 0 },
  { p: 0.486, pos: [2.6, 4.3, -256], look: [0, 3.5, -277], fov: 54, roll: -0.012 },
  { p: 0.504, pos: [4.0, 4.5, -266], look: [0, 3.4, -282], fov: 50, roll: -0.01 },
  { p: 0.524, pos: [0, 9.0, -283], look: [0, 3.5, -306], fov: 56, roll: 0 },
  { p: 0.538, pos: [0, 3.6, -301],  look: [0, 3.8, -330], fov: 58, roll: 0 },
  // 4 · Análisis y rendimiento (órbita)
  { p: 0.556, pos: orb(0.0, 27, 4.0),   look: [0, 4.0, -348], fov: 56, roll: 0 },
  { p: 0.578, pos: orb(-0.5, 26, 4.4),  look: orb(-0.7, 14, 3.9), fov: 52, roll: 0.01 },
  { p: 0.602, pos: orb(-1.15, 24.5, 4.8), look: orb(-1.55, 11, 4.3), fov: 50, roll: 0.012 },
  { p: 0.628, pos: orb(-1.95, 24.5, 5.0), look: orb(-2.65, 11, 4.6), fov: 50, roll: 0 },
  { p: 0.654, pos: orb(-2.7, 24.5, 4.8), look: orb(-3.85, 10, 3.8), fov: 52, roll: -0.01 },
  { p: 0.676, pos: orb(-3.2, 25, 4.2),   look: orb(-3.14, 40, 4), fov: 54, roll: 0 },
  { p: 0.692, pos: [0, 3.6, -378],  look: [0, 3.4, -396], fov: 56, roll: 0 },
  { p: 0.712, pos: [0, 3.2, -392],  look: [0, 3.2, -422], fov: 58, roll: 0 },
  // 5 · Sistemas conectados
  { p: 0.735, pos: [0, 3.4, -406],  look: [0, 4.6, -434], fov: 58, roll: 0 },
  { p: 0.757, pos: [-1.6, 3.7, -424], look: [0, 7.5, -450], fov: 56, roll: 0.008 },
  { p: 0.780, pos: [0, 3.9, -441],  look: [0, 9.5, -454], fov: 54, roll: 0 },
  { p: 0.800, pos: [-3.2, 3.7, -453], look: [3.5, 5.0, -466], fov: 52, roll: -0.01 },
  { p: 0.818, pos: [-7.5, 4.3, -463], look: [4.5, 5.2, -470], fov: 52, roll: -0.012 },
  { p: 0.834, pos: [-6.5, 4.5, -474], look: [4.5, 5.0, -470], fov: 52, roll: 0 },
  { p: 0.848, pos: [-1.5, 3.7, -483], look: [0, 5.4, -496], fov: 54, roll: 0.01 },
  { p: 0.864, pos: [0, 3.4, -491], look: [0, 5.2, -506], fov: 56, roll: 0 },
  { p: 0.884, pos: [0, 3.2, -503], look: [0, 4.4, -522], fov: 58, roll: 0 },
  // 6 · Sala final
  { p: 0.902, pos: [0, 3.0, -516],  look: [0, 8.5, -566], fov: 58, roll: 0 },
  { p: 0.926, pos: [-7.5, 3.4, -538], look: [0, 9.5, -604], fov: 56, roll: 0.01 },
  { p: 0.950, pos: [6.5, 4.0, -557], look: [0, 10, -604], fov: 54, roll: -0.01 },
  { p: 0.974, pos: [0.8, 4.6, -573], look: [0, 10, -604], fov: 52, roll: 0 },
  { p: 1.000, pos: [0, 5.0, -581],  look: [0, 10.2, -604], fov: 50, roll: 0 },
];

const N = KEYS.length;
const vp = KEYS.map((k) => new THREE.Vector3(...k.pos));
const vl = KEYS.map((k) => new THREE.Vector3(...k.look));

function tangents(arr, scalar = false) {
  const m = [];
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
    const dp = KEYS[b].p - KEYS[a].p;
    if (scalar) m.push((arr[b] - arr[a]) / dp);
    else m.push(arr[b].clone().sub(arr[a]).divideScalar(dp));
  }
  return m;
}
const mp = tangents(vp), ml = tangents(vl);
const fovs = KEYS.map((k) => k.fov), rolls = KEYS.map((k) => k.roll);
const mf = tangents(fovs, true), mr = tangents(rolls, true);

function h(t) {
  const t2 = t * t, t3 = t2 * t;
  return [2 * t3 - 3 * t2 + 1, t3 - 2 * t2 + t, -2 * t3 + 3 * t2, t3 - t2];
}

const tmp = new THREE.Vector3();
function hermiteV(out, a, b, ma, mb, t, dt) {
  const [h00, h10, h01, h11] = h(t);
  out.set(0, 0, 0);
  out.addScaledVector(a, h00).addScaledVector(ma, h10 * dt).addScaledVector(b, h01).addScaledVector(mb, h11 * dt);
  return out;
}

export function sampleCamera(p, outPos, outLook) {
  p = Math.min(1, Math.max(0, p));
  let i = 0;
  while (i < N - 2 && p > KEYS[i + 1].p) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const dt = k1.p - k0.p;
  const t = (p - k0.p) / dt;
  hermiteV(outPos, vp[i], vp[i + 1], mp[i], mp[i + 1], t, dt);
  hermiteV(outLook, vl[i], vl[i + 1], ml[i], ml[i + 1], t, dt);
  const [h00, h10, h01, h11] = h(t);
  const fov = fovs[i] * h00 + mf[i] * h10 * dt + fovs[i + 1] * h01 + mf[i + 1] * h11 * dt;
  const roll = rolls[i] * h00 + mr[i] * h10 * dt + rolls[i + 1] * h01 + mr[i + 1] * h11 * dt;
  return { fov, roll };
}

// Capítulos: rango de progreso y etiqueta (la UI y la navegación los usan).
export const CHAPTERS = [
  { id: 'entrada',  from: 0.000, to: 0.150, name: 'Entrada' },
  { id: 'software', from: 0.150, to: 0.355, name: 'Desarrollo' },
  { id: 'compila',  from: 0.355, to: 0.520, name: 'Compilación' },
  { id: 'rendim',   from: 0.520, to: 0.680, name: 'Rendimiento' },
  { id: 'sistemas', from: 0.680, to: 0.860, name: 'Sistemas' },
  { id: 'cierre',   from: 0.860, to: 1.000, name: 'Zenix AR' },
];
