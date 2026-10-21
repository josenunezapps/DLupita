// Utilidades compartidas: matemática, paleta, materiales, texturas de canvas y geometrías hexagonales.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const ease3 = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIO = (t) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeBack = (t) => {
  t = clamp(t);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// PRNG determinista (mulberry32) para que la escena sea idéntica en cada carga.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const COL = {
  bg: 0x05030c,
  violet: 0x8b3dff,
  violet2: 0x6d28d9,
  purple: 0x4c1d95,
  cyan: 0x22c8ff,
  blue: 0x3b82f6,
  lilac: 0xc4a1ff,
  white: 0xffffff,
};

// Color con intensidad > 1 → el bloom lo convierte en luz.
export const glow = (hex, k = 2) => new THREE.Color(hex).multiplyScalar(k);

export const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO = 'ui-monospace, "Cascadia Code", Consolas, "Roboto Mono", Menlo, monospace';

// ---------------------------------------------------------------- canvas
export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Textura de canvas que se puede redibujar (draw recibe argumentos extra en redraw()).
export function liveTex(w, h, draw, aniso = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  const redraw = (...args) => {
    g.clearRect(0, 0, w, h);
    draw(g, w, h, ...args);
    tex.needsUpdate = true;
  };
  redraw();
  return { tex, redraw, canvas };
}

export function radialTex(size = 128, stops) {
  const st = stops || [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.45)'], [0.55, 'rgba(255,255,255,0.1)'], [1, 'rgba(255,255,255,0)']];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  st.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Etiqueta de texto (título + subtítulo) como sprite.
export function labelSprite(title, sub, { w = 512, h = 160, scale = 6, accent = '#22d3ee', color = '#ffffff', glass = true } = {}) {
  const { tex } = liveTex(w, h, (g) => {
    if (glass) {
      rr(g, 6, 6, w - 12, h - 12, 22);
      g.fillStyle = 'rgba(14,8,32,0.78)';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = accent;
      g.globalAlpha = 0.85;
      g.stroke();
      g.globalAlpha = 1;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.font = `700 ${sub ? 54 : 62}px ${FONT}`;
    g.fillText(title, w / 2, sub ? h * 0.4 : h / 2);
    if (sub) {
      g.fillStyle = accent;
      g.font = `600 28px ${MONO}`;
      g.fillText(sub, w / 2, h * 0.74);
    }
  }, 4);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, (scale * h) / w, 1);
  return s;
}

// ---------------------------------------------------------------- hexágonos
export function hexShape(r, rot = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

// Marco hexagonal (aro) con ingletes perfectos.
export function hexFrame(R, w, depth, bevel = 0.04, rot = Math.PI / 2) {
  const shape = hexShape(R, rot);
  const hole = new THREE.Path();
  const r2 = R - w;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const x = Math.cos(a) * r2, y = Math.sin(a) * r2;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// ---------------------------------------------------------------- materiales
export function makeMaterials(tier) {
  const M = {};
  M.metal = new THREE.MeshStandardMaterial({ color: 0x1a1332, metalness: 1, roughness: 0.3 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xd8d2f2, metalness: 1, roughness: 0.2 });
  M.violet = new THREE.MeshStandardMaterial({ color: 0x7c3aed, metalness: 0.9, roughness: 0.22 });
  M.dark = new THREE.MeshStandardMaterial({ color: 0x07040f, metalness: 0.7, roughness: 0.3 });
  const glassParams = {
    color: 0xa78bfa, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false,
  };
  M.glass = tier === 'low'
    ? new THREE.MeshStandardMaterial({ ...glassParams, metalness: 0.2, roughness: 0.1 })
    : new THREE.MeshPhysicalMaterial({ ...glassParams, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05 });
  M.gViolet = new THREE.MeshBasicMaterial({ color: glow(COL.violet, 2.6) });
  M.gCyan = new THREE.MeshBasicMaterial({ color: glow(COL.cyan, 2.4) });
  M.gWhite = new THREE.MeshBasicMaterial({ color: glow(0xffffff, 3) });
  return M;
}

// ---------------------------------------------------------------- campo de hexágonos
// Piso de prismas hexagonales que respira + anillos luminosos en cada tapa.
export function hexField({ radius = 14, cell = 1.2, gap = 0.93, colA = COL.violet, colB = COL.cyan, baseColor = 0x120c22 } = {}) {
  const items = [];
  const rand = rng(11 + radius);
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      const x = cell * Math.sqrt(3) * (q + r / 2);
      const z = cell * 1.5 * r;
      items.push({ x, z, d: Math.hypot(x, z), ph: rand() * 6.283 });
    }
  }
  const n = items.length;
  const prismGeo = new THREE.CylinderGeometry(cell * gap, cell * gap, 1, 6);
  prismGeo.translate(0, 0.5, 0);
  const prismMat = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.95, roughness: 0.34 });
  const prisms = new THREE.InstancedMesh(prismGeo, prismMat, n);
  const ringGeo = new THREE.RingGeometry(cell * gap * 0.72, cell * gap * 0.92, 6, 1);
  ringGeo.rotateZ(Math.PI / 6);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, n);
  const group = new THREE.Group();
  group.add(prisms, rings);
  prisms.frustumCulled = false;
  rings.frustumCulled = false;

  const dummy = new THREE.Object3D();
  const cA = new THREE.Color(colA), cB = new THREE.Color(colB), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) rings.setColorAt(i, cA);

  // heightFn(item, i) → { h, k } altura y mezcla de color (0..1) + intensidad.
  function update(heightFn) {
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const o = heightFn(it, i);
      dummy.position.set(it.x, 0, it.z);
      dummy.scale.set(1, Math.max(0.05, o.h), 1);
      dummy.updateMatrix();
      prisms.setMatrixAt(i, dummy.matrix);
      dummy.position.set(it.x, o.h + 0.03, it.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rings.setMatrixAt(i, dummy.matrix);
      tmp.copy(cA).lerp(cB, o.k).multiplyScalar(o.i);
      rings.setColorAt(i, tmp);
    }
    prisms.instanceMatrix.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true;
    rings.instanceColor.needsUpdate = true;
  }
  return { group, update, count: n, items };
}
