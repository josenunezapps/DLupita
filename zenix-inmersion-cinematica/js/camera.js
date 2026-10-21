import * as THREE from 'three';

// Recorrido de cámara: cada llave define posición, punto de mira, FOV y alabeo (roll) para un valor de progreso 0..1.
// La interpolación es Hermite con tangentes en el espacio de progreso, así la velocidad es continua entre capítulos.
export const KEYS = [
  // 1 · Entrada al universo: la estructura se ve desde lejos y la cámara se acerca al portal
  { p: 0.000, pos: [0, 4.5, 50],    look: [0, 2, -40],    fov: 52, roll: 0 },
  { p: 0.045, pos: [-3.5, 3.2, 24], look: [0, 1.5, -44],  fov: 54, roll: -0.03 },
  { p: 0.095, pos: [1.5, 1.4, -6],  look: [0, 0.4, -58],  fov: 58, roll: 0.025 },
  { p: 0.140, pos: [0, 0.3, -52],   look: [0, 0.2, -84],  fov: 66, roll: 0 },
  // 2 · Estación de desarrollo
  { p: 0.180, pos: [0.2, 0.9, -76], look: [-4, 1.2, -96], fov: 58, roll: 0.02 },
  { p: 0.215, pos: [-0.8, 1.0, -92], look: [-9.5, 1.6, -99], fov: 54, roll: 0.035 },
  { p: 0.250, pos: [-0.4, 1.3, -108], look: [-8.5, 2.2, -118], fov: 52, roll: 0.02 },
  { p: 0.285, pos: [0.3, 1.4, -121], look: [8, 2.4, -128], fov: 52, roll: -0.03 },
  { p: 0.320, pos: [0.4, 1.2, -136], look: [0.5, 1.6, -158], fov: 56, roll: -0.01 },
  { p: 0.350, pos: [0, 0.6, -152], look: [0, 0.3, -182], fov: 62, roll: 0 },
  // 3 · Compilación y procesamiento
  { p: 0.385, pos: [0, 0.4, -170], look: [0, 0.2, -200], fov: 64, roll: 0.0 },
  { p: 0.425, pos: [0.3, -0.2, -192], look: [0, 0, -216], fov: 62, roll: 0.05 },
  { p: 0.455, pos: [0.2, 0.2, -214], look: [-4.8, 0.6, -236], fov: 58, roll: 0.02 },
  { p: 0.485, pos: [0.6, 0.6, -230], look: [4.8, 0.2, -240], fov: 56, roll: -0.04 },
  { p: 0.515, pos: [0, 0.4, -250], look: [0, 0.3, -280], fov: 60, roll: 0 },
  // 4 · Estadísticas y rendimiento
  { p: 0.545, pos: [-0.5, 0.8, -268], look: [-12, 0.5, -300], fov: 58, roll: 0.03 },
  { p: 0.580, pos: [-2.4, 1.2, -290], look: [-13, 1.4, -300], fov: 54, roll: 0.04 },
  { p: 0.615, pos: [0.4, 1.5, -302], look: [13, 2.2, -302], fov: 54, roll: -0.04 },
  { p: 0.645, pos: [1.6, 1.8, -316], look: [7.5, 2.2, -330], fov: 54, roll: -0.02 },
  { p: 0.675, pos: [0, 1.2, -336], look: [0, 1.6, -362], fov: 58, roll: 0 },
  // 5 · Sistemas conectados
  { p: 0.705, pos: [-0.2, 1.0, -352], look: [-9, -0.5, -374], fov: 56, roll: 0.03 },
  { p: 0.735, pos: [-0.6, 1.0, -368], look: [9, 0.2, -380], fov: 56, roll: -0.03 },
  { p: 0.765, pos: [0, 0.6, -386], look: [0, 0.6, -410], fov: 58, roll: 0 },
  { p: 0.795, pos: [0.2, 1.2, -402], look: [-10, 2.2, -414], fov: 54, roll: 0.03 },
  { p: 0.825, pos: [0.3, 1.4, -414], look: [10, 1.4, -422], fov: 54, roll: -0.03 },
  { p: 0.850, pos: [0, 2.0, -428], look: [0, 10, -444], fov: 58, roll: 0 },
  // 6 · Gran cierre
  { p: 0.880, pos: [0, 2.6, -448], look: [0, 4, -490], fov: 60, roll: 0 },
  { p: 0.920, pos: [-1.2, 2.6, -482], look: [0, 3.4, -535], fov: 54, roll: 0.02 },
  { p: 0.955, pos: [4.2, 3.4, -498], look: [0, 2.8, -535], fov: 50, roll: -0.025 },
  { p: 1.000, pos: [0, 3.6, -508], look: [0, 1.9, -535], fov: 48, roll: 0 },
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
