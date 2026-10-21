import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { texPlane } from './util.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PAL, roundedRectShape, roundedRectPath, labelPlane, canvasTexture, neon, FX } from './util.js';

// Monitor moderno: carcasa de aluminio redondeada, marco negro fino, pantalla con vidrio apenas reflectante y soporte de cuello.
export function makeMonitor(ctx, { w = 5.6, h = 3.2, tex, accent = PAL.violet, standLen = 1.2, screenMat = null }) {
  const { M, Q } = ctx;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.28, 3, 0.07), M.graphite);
  body.position.z = -0.14; g.add(body);
  const bez = roundedRectShape(w - 0.02, h - 0.02, 0.1);
  bez.holes.push(roundedRectPath(w - 0.26, h - 0.26, 0.04));
  const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(bez, { depth: 0.02, bevelEnabled: false, curveSegments: 3 }), M.blackGloss);
  bezel.position.z = 0.003; g.add(bezel);
  const mat = screenMat || new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.26, h - 0.26), mat);
  screen.position.z = 0.012; g.add(screen);
  if (Q.detail !== 'low') {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.26, h - 0.26), M.screenGlass);
    glass.position.z = 0.03; g.add(glass);
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(1.4 * FX.k), toneMapped: false }));
  led.position.set(w / 2 - 0.4, -h / 2 + 0.07, 0.025); g.add(led);
  if (standLen > 0.1) {
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.34, standLen + h * 0.3, 0.12), M.aluminum);
    neck.position.set(0, -h / 2 - standLen / 2 + h * 0.15, -0.34); g.add(neck);
    const foot = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.09, 1.3, 2, 0.04), M.aluminum);
    foot.position.set(0, -h / 2 - standLen - 0.03, -0.2); g.add(foot);
    foot.castShadow = Q.shadows; neck.castShadow = Q.shadows;
  }
  body.castShadow = Q.shadows;
  g.userData.screen = screen;
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

// Suelo pulido: en calidad alta, un espejo plano real bajo una capa PBR semitransparente (reflejo húmedo de objetos y luces);
// en el resto, el mismo material PBR con reflejos del entorno. Devuelve la malla del suelo.
export function polishedFloor(ctx, g, { w, h, x = 0, y = 0, z = 0, mat, opacity = 0.88, tint = 0x75737f, density = 0.12, rot = 0 }) {
  const { Q } = ctx;
  const geo = texPlane(w, h, density);
  if (Q.reflector) {
    const mir = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: 768, textureHeight: 768, color: tint, clipBias: 0.003 });
    mir.rotation.x = -Math.PI / 2; mir.position.set(x, y - 0.03, z); g.add(mir);
    const m = mat.clone(); m.transparent = true; m.opacity = opacity; m.depthWrite = false;
    const f = new THREE.Mesh(geo, m); f.rotation.x = -Math.PI / 2; f.position.set(x, y, z); f.receiveShadow = Q.shadows; f.renderOrder = 1; g.add(f);
    return f;
  }
  const f = new THREE.Mesh(geo, mat); f.rotation.x = -Math.PI / 2; f.position.set(x, y, z); f.receiveShadow = Q.shadows; g.add(f);
  return f;
}
