import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// Generador pseudoaleatorio determinístico (mulberry32) para que la escena sea idéntica siempre.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Factor global de intensidad de los neones: sin bloom (gama baja) se reduce para no quemar los colores a blanco.
export const FX = { k: 1 };

export const PAL = {
  bg: 0x05030f,
  violet: 0x8b4dff,
  electric: 0xa66bff,
  purple: 0x6d28d9,
  deep: 0x3b1a8a,
  cyan: 0x22d3ee,
  ice: 0x9be8ff,
  white: 0xf5f3ff,
  metal: 0x1b1633,
  silver: 0xbdb7dc,
};

export function neon(color, intensity = 2.2, opts = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity * FX.k);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...opts });
}

// Textura de canvas con redibujo bajo demanda.
export function canvasTexture(w, h, draw, { aniso = 4 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const api = {
    canvas, ctx, tex,
    redraw(...args) { draw(ctx, w, h, ...args); tex.needsUpdate = true; },
  };
  draw(ctx, w, h);
  tex.needsUpdate = true;
  return api;
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function roundedRectPath(w, h, r) {
  const p = new THREE.Path();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

// Hexágono (vértice arriba) como Shape; con hueco opcional.
export function hexShape(R, Ri = 0, rot = Math.PI / 2) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * Math.PI) / 3;
    const x = Math.cos(a) * R, y = Math.sin(a) * R;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  if (Ri > 0) {
    const h = new THREE.Path();
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * Math.PI) / 3;
      const x = Math.cos(a) * Ri, y = Math.sin(a) * Ri;
      if (i === 0) h.moveTo(x, y); else h.lineTo(x, y);
    }
    h.closePath();
    s.holes.push(h);
  }
  return s;
}

export function hexRingGeometry(Ro, Ri, depth, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(hexShape(Ro, Ri), {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

// Etiqueta de texto en canvas (sprite plano) con fondo transparente.
export function labelTexture(text, { w = 512, h = 128, size = 54, color = '#ffffff', font = 'ui-sans-serif, "Segoe UI", Roboto, Arial, sans-serif', weight = 700, spacing = 6, align = 'center' } = {}) {
  return canvasTexture(w, h, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    ctx.fillStyle = color;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillText(text, align === 'center' ? W / 2 : align === 'left' ? 12 : W - 12, H / 2 + 2);
  });
}

export function labelPlane(text, width, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const t = labelTexture(text, opts);
  const m = new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false, toneMapped: false, fog: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * h / w), m);
  mesh.userData.label = t;
  return mesh;
}

// Registro de colisiones para validar el recorrido de cámara.
export function makeColliders() {
  const list = [];
  return {
    list,
    box(obj, name, pad = 0) {
      obj.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(obj);
      if (pad) b.expandByScalar(pad);
      list.push({ type: 'box', box: b, name });
    },
    boxRaw(min, max, name) { list.push({ type: 'box', box: new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)), name }); },
    ring(center, innerR, outerR, thick, name) { list.push({ type: 'ring', c: new THREE.Vector3(...center), ri: innerR, ro: outerR, th: thick, name }); },
    sphere(center, r, name) { list.push({ type: 'sphere', c: new THREE.Vector3(...center), r, name }); },
  };
}

export function hitsCollider(c, pos, rad) {
  if (c.type === 'box') {
    const b = c.box;
    const x = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const y = Math.max(b.min.y, Math.min(pos.y, b.max.y));
    const z = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - x, dy = pos.y - y, dz = pos.z - z;
    return dx * dx + dy * dy + dz * dz < rad * rad;
  }
  if (c.type === 'sphere') return pos.distanceTo(c.c) < c.r + rad;
  if (c.type === 'ring') {
    if (Math.abs(pos.z - c.c.z) > c.th / 2 + rad) return false;
    const r = Math.hypot(pos.x - c.c.x, pos.y - c.c.y);
    return r > c.ri - rad && r < c.ro + rad;
  }
  return false;
}
