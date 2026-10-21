import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { PAL, roundedRectShape, roundedRectPath, labelPlane, canvasTexture, neon, FX } from './util.js';

// Monitor físico: bisel extruido con hueco real, carcasa trasera, pantalla emisiva, vidrio con reflejos, LED y pie.
export function makeMonitor(ctx, { w = 6, h = 3.6, tex, accent = PAL.cyan, standLen = 0, screenMat = null }) {
  const { M, Q } = ctx;
  const g = new THREE.Group();
  const sh = roundedRectShape(w, h, 0.2);
  sh.holes.push(roundedRectPath(w - 0.34, h - 0.34, 0.06));
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 4 }), M.metalDark);
  g.add(bezel);
  const hs = roundedRectShape(w - 0.16, h - 0.16, 0.22);
  const housing = new THREE.Mesh(new THREE.ExtrudeGeometry(hs, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 4 }), M.metalMid);
  housing.position.z = -0.5;
  g.add(housing);
  const mat = screenMat || new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.34, h - 0.34), mat);
  screen.position.z = 0.03;
  g.add(screen);
  if (Q.detail !== 'low') {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.34, h - 0.34), M.glass);
    glass.position.z = 0.19;
    g.add(glass);
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.6, w * 0.2), 0.03, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(2.6 * FX.k), toneMapped: false }));
  led.position.set(0, -h / 2 + 0.085, 0.21);
  g.add(led);
  // ranuras de ventilación en la carcasa
  const vent = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.04, 0.02), M.black);
  for (let i = 0; i < 3; i++) { const v = vent.clone(); v.position.set(0, h / 2 - 0.3 - i * 0.12, -0.52); g.add(v); }
  if (standLen > 0.1) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, standLen + h / 2, 14), M.metalMid);
    pillar.position.set(0, -(standLen + h / 2) / 2 + 0.0, -0.78);
    g.add(pillar);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.45), M.metalDark);
    arm.position.set(0, -h * 0.15, -0.74);
    g.add(arm);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.14, 28), M.metalDark);
    base.position.set(0, -h / 2 - standLen + 0.07, -0.78);
    g.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.018, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(2.2 * FX.k), toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, -h / 2 - standLen + 0.15, -0.78);
    g.add(ring);
  }
  g.userData.screen = screen;
  g.traverse((o) => { if (o.isMesh && o !== screen) { o.castShadow = Q.shadows && o.material !== M.glass; } });
  return g;
}

// Texto 3D con volumen. Si la fuente no cargó, cae a un rótulo plano.
export function text3D(ctx, str, size, { depth = 0.22, mat = null, sideMat = null } = {}) {
  const { font, M } = ctx;
  if (!font) return labelPlane(str, size * str.length * 0.62, { w: 1024, h: 160, size: 112, spacing: 8 });
  const geo = new TextGeometry(str, { font, size, depth, curveSegments: 4, bevelEnabled: true, bevelThickness: size * 0.025, bevelSize: size * 0.018, bevelSegments: 1 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -depth / 2);
  return new THREE.Mesh(geo, [mat || M.whiteGlow, sideMat || M.silver]);
}

// Losa de archivo: placa con grosor y cara texturizada (nombre + líneas de contenido).
export function fileSlab(ctx, name, accent = '#5eead4', w = 2.2, h = 2.8) {
  const { M, textures } = ctx;
  const tex = canvasTexture(256, Math.round(256 * h / w), (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#171238'); g.addColorStop(1, '#0b0820');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = accent; c.globalAlpha = 0.55; c.lineWidth = 3; c.strokeRect(8, 8, W - 16, H - 16); c.globalAlpha = 1;
    // icono de archivo con esquina doblada
    c.fillStyle = accent; c.globalAlpha = 0.9;
    c.beginPath(); c.moveTo(W / 2 - 28, 36); c.lineTo(W / 2 + 10, 36); c.lineTo(W / 2 + 28, 54); c.lineTo(W / 2 + 28, 100); c.lineTo(W / 2 - 28, 100); c.closePath(); c.fill();
    c.globalAlpha = 1; c.fillStyle = '#0b0820'; c.fillRect(W / 2 - 16, 70, 32, 4); c.fillRect(W / 2 - 16, 80, 24, 4);
    c.fillStyle = '#efeaff'; c.font = '700 22px ui-monospace, Menlo, Consolas, monospace'; c.textAlign = 'center';
    c.fillText(name, W / 2, 138);
    const cols = ['#c792ff', '#7fe0ff', '#ffc66b', '#6c6796', '#7aa8ff'];
    for (let i = 0; i < 6; i++) { c.fillStyle = cols[i % cols.length]; c.globalAlpha = 0.8; c.fillRect(30 + (i % 2) * 14, 168 + i * 18, 40 + ((i * 53) % 110), 6); }
  });
  textures.push(tex.tex);
  const mats = [M.metalMid, M.metalMid, M.metalMid, M.metalMid, new THREE.MeshBasicMaterial({ map: tex.tex, toneMapped: false }), M.metalDark];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), mats);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(1.8 * FX.k), toneMapped: false }));
  mesh.add(edge);
  return mesh;
}

// Placa de cristal con rótulo (módulos flotantes tipo <Hero/>, GET /api, etc.)
export function glassTag(ctx, text, accent = '#5eead4', w = 2.6) {
  const { M } = ctx;
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.34, 0.06), M.glassTint);
  g.add(plate);
  const lab = labelPlane(text, w * 0.9, { w: 512, h: 128, size: 50, color: accent, font: 'ui-monospace, Menlo, Consolas, monospace', spacing: 0 });
  lab.position.z = 0.05;
  g.add(lab);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(1.6 * FX.k), toneMapped: false }));
  g.add(edge);
  return g;
}

// Etiqueta de pared de cristal con título (carteles de zona)
export function neonMat(color, k = 2.4) { return neon(color, k); }
