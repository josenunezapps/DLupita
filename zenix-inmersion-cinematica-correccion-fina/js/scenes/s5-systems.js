import * as THREE from 'three';
import { PAL, rng, smooth, clamp, lerp, canvasTexture, labelPlane, hexRingGeometry, roundedRectShape, neon, FX } from '../util.js';
import { gridMaterial, flowMaterial } from '../materials.js';
import { text3D, makeMonitor } from '../parts.js';

// ESCENA 5 · Sistemas conectados: base de datos, servidores, API (puerta que atraviesa la cámara), autenticación,
// aplicación web y nube, unidos por conexiones 3D por las que viajan señales.
export function buildSystems(ctx) {
  const { M, Q, col, textures } = ctx;
  const g = new THREE.Group();
  g.name = 'systems';
  const low = Q.detail === 'low';
  const FLOOR = -4, CZ = -410;

  // Plataforma + pasarelas
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(34, 35, 1.0, 6), M.floor);
  plat.rotation.y = Math.PI / 6; plat.position.set(0, FLOOR - 0.5, CZ); plat.receiveShadow = Q.shadows; g.add(plat);
  const pg = new THREE.Mesh(new THREE.CircleGeometry(34, 6), gridMaterial({ color: PAL.violet, cell: 3, intensity: 1.0, alpha: 0.8 }));
  pg.rotation.x = -Math.PI / 2; pg.rotation.z = Math.PI / 6; pg.position.set(0, FLOOR + 0.012, CZ); g.add(pg);
  const bridge = (z, len) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 0.7, len), M.struct); b.position.set(0, FLOOR - 0.35, z); g.add(b);
    [-4.5, 4.5].forEach((x) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, len), M.violetGlow); s.position.set(x, FLOOR + 0.03, z); g.add(s); });
  };
  bridge(-368, 24); bridge(-460, 48);
  col.boxRaw([-35, FLOOR - 1, -440], [35, FLOOR, -378], 'sys-floor');

  const tagStyle = { w: 512, h: 96, size: 40, color: '#c9c3ec', font: 'ui-sans-serif, system-ui, sans-serif', weight: 600, spacing: 3 };
  const addTitle = (txt, sub, x, y, z, ry, mat) => {
    const t = text3D(ctx, txt, 0.95, { depth: 0.26, mat });
    t.position.set(x, y, z); t.rotation.y = ry; g.add(t);
    const s = labelPlane(sub, 4.0, tagStyle); s.position.set(x, y - 1.05, z); s.rotation.y = ry; g.add(s);
  };
  const portPts = {};

  // 1 · Base de datos: discos apilados con anillos luminosos
  const DB = { x: -8.2, z: -374 };
  for (let i = 0; i < 5; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.8, 36), M.struct);
    d.position.set(DB.x, FLOOR + 0.4 + i * 1.05, DB.z); d.castShadow = Q.shadows; g.add(d);
    const r = new THREE.Mesh(new THREE.TorusGeometry(3.01, 0.06, 6, 48), i % 2 ? M.cyanGlow : M.violetGlow);
    r.rotation.x = Math.PI / 2; r.position.set(DB.x, FLOOR + 0.82 + i * 1.05, DB.z); g.add(r);
  }
  col.boxRaw([DB.x - 3.3, FLOOR, DB.z - 3.3], [DB.x + 3.3, FLOOR + 5.6, DB.z + 3.3], 'db');
  addTitle('DATABASE', 'Bases de datos', DB.x, FLOOR + 8.4, DB.z, 0.5, M.violetGlow);
  portPts.db = new THREE.Vector3(DB.x + 3.1, FLOOR + 3.2, DB.z + 0.8);

  // 2 · Servidores: torres con filas de LED
  const SV = { x: 8.6, z: -380 };
  const ledGeo = new THREE.BoxGeometry(0.9, 0.09, 0.05);
  const nLed = 3 * 2 * 16;
  const leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), nLed);
  const dm = new THREE.Object3D(), tc = new THREE.Color();
  const ledMeta = [];
  let li = 0;
  for (let k = 0; k < 3; k++) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 9, 2.6), M.struct);
    rack.position.set(SV.x, FLOOR + 4.5, SV.z - 4.6 + k * 4.6 + (k === 1 ? 0.0 : 0)); rack.castShadow = Q.shadows; g.add(rack);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.1, 9.05, 0.1), M.cyanGlow); trim.position.set(SV.x - 1.22, FLOOR + 4.5, rack.position.z + 1.3); g.add(trim);
    const trim2 = trim.clone(); trim2.position.z = rack.position.z - 1.3; g.add(trim2);
    for (let c = 0; c < 2; c++) for (let rI = 0; rI < 16; rI++) {
      dm.position.set(SV.x - 1.23, FLOOR + 0.9 + rI * 0.5, rack.position.z - 0.55 + c * 1.1); dm.updateMatrix(); leds.setMatrixAt(li, dm.matrix);
      ledMeta.push(li * 1.37 + k); li++;
    }
  }
  g.add(leds);
  col.boxRaw([SV.x - 1.4, FLOOR, SV.z - 6.2], [SV.x + 1.4, FLOOR + 9.2, SV.z + 6.2], 'servers');
  addTitle('SERVERS', 'Servidores', SV.x, FLOOR + 12.2, SV.z, -0.5, M.cyanGlow);
  portPts.sv = new THREE.Vector3(SV.x - 1.5, FLOOR + 5, SV.z);

  // 3 · API: puerta hexagonal por la que pasa la cámara
  const AP = { z: -396, y: 0.6 };
  const gate = new THREE.Mesh(hexRingGeometry(5.9, 4.8, 1.2, 0.1), M.silver); gate.position.set(0, AP.y, AP.z); g.add(gate);
  const gateGlow = new THREE.Mesh(hexRingGeometry(5.1, 4.62, 1.35, 0), M.electricGlow); gateGlow.position.set(0, AP.y, AP.z); g.add(gateGlow);
  const gateBase = new THREE.Mesh(new THREE.BoxGeometry(11, 0.5, 2.4), M.struct); gateBase.position.set(0, FLOOR + 0.25, AP.z); g.add(gateBase);
  col.ring([0, AP.y, AP.z], 4.5, 6.2, 1.5, 'api-gate');
  col.boxRaw([-5.6, FLOOR, AP.z - 1.2], [5.6, FLOOR + 0.5, AP.z + 1.2], 'api-base');
  addTitle('API', 'Interfaz entre sistemas', 0, AP.y + 8.4, AP.z, 0, M.electricGlow);
  col.boxRaw([-2.8, AP.y + 6.8, AP.z - 0.5], [2.8, AP.y + 9.9, AP.z + 0.5], 'api-title');
  portPts.apiL = new THREE.Vector3(-4.7, AP.y + 0.6, AP.z + 0.2);
  portPts.apiR = new THREE.Vector3(4.7, AP.y + 0.6, AP.z + 0.2);
  portPts.apiT = new THREE.Vector3(0, AP.y + 5.6, AP.z);

  // 4 · Autenticación: candado con escudo hexagonal
  const AU = { x: -10.5, y: 1.8, z: -414 };
  const auth = new THREE.Group(); auth.position.set(AU.x, AU.y, AU.z); auth.rotation.y = 0.55;
  const shield = new THREE.Mesh(hexRingGeometry(3.8, 0.001, 0.35, 0.05), M.metalViolet); shield.position.z = -0.9; auth.add(shield);
  const shieldRim = new THREE.Mesh(hexRingGeometry(3.85, 3.6, 0.5, 0), M.violetGlow); shieldRim.position.z = -0.9; auth.add(shieldRim);
  const lockBody = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.3, 1.2), M.silver); lockBody.position.y = -0.5; auth.add(lockBody);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.24, 12, 30, Math.PI), M.silver); shackle.position.y = 0.65; auth.add(shackle);
  const key = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), M.cyanGlow); key.position.set(0, -0.35, 0.62); auth.add(key);
  const keyS = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.02), M.cyanGlow); keyS.position.set(0, -0.78, 0.62); auth.add(keyS);
  g.add(auth);
  col.sphere([AU.x, AU.y, AU.z], 4.2, 'auth');
  addTitle('AUTH', 'Autenticación', AU.x, AU.y + 5.6, AU.z, 0.55, M.violetGlow);
  portPts.au = new THREE.Vector3(AU.x + 3.3, AU.y + 0.4, AU.z + 1.6);
  portPts.auT = new THREE.Vector3(AU.x + 0.6, AU.y + 3.6, AU.z);

  // 5 · Aplicación web: ventana de navegador con volumen
  const WB = { x: 11.5, y: 1.6, z: -423 };
  const webTex = canvasTexture(768, 480, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#120d30'); gr.addColorStop(1, '#090620'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = '#17123a'; c.fillRect(0, 0, W, 46);
    ['#ff6b8b', '#ffc66b', '#6ee7a8'].forEach((cc, i) => { c.fillStyle = cc; c.beginPath(); c.arc(26 + i * 24, 23, 7, 0, 7); c.fill(); });
    c.fillStyle = '#0b0820'; c.beginPath(); c.roundRect(120, 9, W - 160, 28, 14); c.fill();
    c.font = '600 19px ui-monospace, Menlo, monospace'; c.fillStyle = '#9be8ff'; c.fillText('tu-proyecto.com', 140, 29);
    const bar = (x, y, w, h, col2, r = 8) => { c.fillStyle = col2; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
    bar(40, 80, 90, 24, '#a66bff'); bar(W - 300, 84, 62, 16, '#4a4480'); bar(W - 220, 84, 62, 16, '#4a4480'); bar(W - 140, 84, 62, 16, '#4a4480');
    bar(40, 150, 400, 46, '#efeaff'); bar(40, 208, 300, 46, '#efeaff'); bar(40, 280, 340, 14, '#7d77a6'); bar(40, 304, 280, 14, '#7d77a6'); bar(40, 346, 170, 50, '#8b4dff', 25);
    const g2 = c.createLinearGradient(470, 130, 730, 380); g2.addColorStop(0, '#8b4dff'); g2.addColorStop(1, '#22d3ee'); c.fillStyle = g2; c.beginPath(); c.roundRect(470, 130, 260, 260, 24); c.fill();
    for (let i = 0; i < 3; i++) bar(40 + i * 232, 420, 210, 40, '#1c1650', 12);
  });
  textures.push(webTex.tex);
  const web = makeMonitor(ctx, { w: 8.6, h: 5.4, tex: webTex.tex, accent: PAL.cyan, standLen: 0 });
  web.position.set(WB.x, WB.y, WB.z); web.rotation.y = -0.62; g.add(web);
  const wbBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.5, 6), M.struct); wbBase.position.set(WB.x, FLOOR + 0.25, WB.z - 0.6); g.add(wbBase);
  col.box(web, 'webapp', 0.1);
  col.boxRaw([WB.x - 4.8, FLOOR, WB.z - 5], [WB.x + 4.8, FLOOR + 0.6, WB.z + 4], 'webapp-base');
  addTitle('WEB APP', 'Aplicaciones web', WB.x, WB.y + 5.2, WB.z, -0.62, M.cyanGlow);
  portPts.wb = new THREE.Vector3(WB.x - 3.4, WB.y + 0.8, WB.z + 2.2);
  portPts.wbT = new THREE.Vector3(WB.x - 0.5, WB.y + 3.2, WB.z - 0.5);

  // 6 · Nube: cúmulo de esferas metálicas y de cristal, suspendido sobre el pasillo
  const CL = { x: 0, y: 13, z: -441 };
  const cloud = new THREE.Group(); cloud.position.set(CL.x, CL.y, CL.z);
  const cmain = new THREE.Mesh(new THREE.SphereGeometry(3.3, 40, 24), M.glassTint); cloud.add(cmain);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), M.electricGlow); cloud.add(core);
  [[-4.3, -0.6, 0.4, 2.2], [4.4, -0.5, -0.3, 2.3], [-2.2, 1.9, 1.1, 1.9], [2.6, 2.1, -1.0, 1.7], [0.2, -2.4, 1.4, 1.7], [-6.4, -1.0, -1.2, 1.4], [6.5, -1.2, 0.8, 1.3]].forEach(([x, y, z, r], i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), i % 2 ? M.silver : M.metalViolet); s.position.set(x, y, z); cloud.add(s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.04, 6, 40), i % 2 ? M.cyanGlow : M.violetGlow); ring.position.set(x, y, z); ring.rotation.x = 1.15; cloud.add(ring);
  });
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(8.4, 0.06, 6, 120), M.iceGlow); orbit.rotation.x = Math.PI / 2 - 0.25; cloud.add(orbit);
  g.add(cloud);
  col.sphere([CL.x, CL.y, CL.z], 8.4, 'cloud');
  addTitle('CLOUD', 'Servicios en la nube', CL.x, CL.y - 7.2, CL.z + 2.5, 0, M.whiteGlow);
  portPts.clB = new THREE.Vector3(0, CL.y - 3.0, CL.z + 0.5);
  portPts.clL = new THREE.Vector3(-4.2, CL.y - 1.2, CL.z + 1);
  portPts.clR = new THREE.Vector3(4.2, CL.y - 1.2, CL.z + 1);

  // --- Conexiones 3D: tubos con pulsos + señales (esferas) que los recorren ---
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const links = [
    { a: portPts.db, via: [V3(-6.4, FLOOR + 1.4, -384), V3(-5.6, 0.2, -392)], b: portPts.apiL, c: PAL.violet, p: PAL.cyan },
    { a: portPts.sv, via: [V3(7.2, FLOOR + 2, -388), V3(5.8, 0.4, -394)], b: portPts.apiR, c: PAL.violet, p: PAL.cyan },
    { a: portPts.apiL, via: [V3(-6.4, 1.2, -401), V3(-8.4, 1.8, -408)], b: portPts.au, c: PAL.violet, p: PAL.electric },
    { a: portPts.apiR, via: [V3(7.6, 1.2, -407), V3(8.6, 1.6, -416)], b: portPts.wb, c: PAL.violet, p: PAL.cyan },
    { a: portPts.apiT, via: [V3(0, 8.5, -408), V3(0, 11.5, -424)], b: portPts.clB, c: PAL.electric, p: PAL.ice },
    { a: portPts.auT, via: [V3(-9.5, 9, -421), V3(-6, 11, -433)], b: portPts.clL, c: PAL.violet, p: PAL.electric },
    { a: portPts.wbT, via: [V3(9.6, 9.5, -427), V3(6.4, 11.5, -435)], b: portPts.clR, c: PAL.violet, p: PAL.cyan },
  ];
  const flows = [];
  const curves = [];
  links.forEach((L, i) => {
    const curve = new THREE.CatmullRomCurve3([L.a, ...L.via, L.b], false, 'catmullrom', 0.5);
    const m = flowMaterial({ color: L.c, pulse: L.p, speed: 0.6 + (i % 3) * 0.12, density: 7, base: 0.55 });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.11, 8, false), m);
    g.add(tube); flows.push(m); curves.push(curve);
    [L.a, L.b].forEach((pt) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), M.whiteGlow); n.position.copy(pt); g.add(n); });
  });
  const SIG = links.length * 5;
  const sig = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), SIG);
  sig.frustumCulled = false; g.add(sig);
  const samples = curves.map((c) => c.getSpacedPoints(80));
  const sigC = new THREE.Color(), cyanC = new THREE.Color(PAL.cyan).multiplyScalar(3 * FX.k), whiteC = new THREE.Color(0xffffff).multiplyScalar(3.2 * FX.k);

  return {
    group: g,
    range: [0.62, 0.90],
    update(s) {
      const p = s.p;
      const act = smooth(0.69, 0.725, p);
      flows.forEach((m) => { m.uniforms.uTime.value = s.time; m.uniforms.uAct.value = act; });
      // Señales viajando entre componentes
      let n = 0;
      for (let k = 0; k < links.length; k++) {
        const pts = samples[k];
        for (let j = 0; j < 5; j++) {
          const t = (s.time * (0.11 + 0.02 * (k % 3)) + j / 5 + k * 0.13) % 1;
          const f = t * (pts.length - 1), i0 = Math.floor(f), fr = f - i0;
          const a = pts[i0], b = pts[Math.min(pts.length - 1, i0 + 1)];
          dm.position.set(lerp(a.x, b.x, fr), lerp(a.y, b.y, fr), lerp(a.z, b.z, fr));
          dm.scale.setScalar(Math.max(0.0001, act * (0.7 + 0.5 * Math.sin(t * Math.PI))));
          dm.rotation.set(0, 0, 0); dm.updateMatrix(); sig.setMatrixAt(n, dm.matrix);
          sig.setColorAt(n, (j % 2 ? cyanC : whiteC)); n++;
        }
      }
      sig.instanceMatrix.needsUpdate = true; if (sig.instanceColor) sig.instanceColor.needsUpdate = true;
      // LED de servidores: parpadeo según actividad (apagados hasta que llegan los datos)
      for (let i = 0; i < nLed; i++) {
        const v = 0.5 + 0.5 * Math.sin(s.time * (2.2 + (i % 5) * 0.4) + ledMeta[i] * 3.1);
        tc.set(i % 7 === 0 ? PAL.violet : PAL.cyan).multiplyScalar((0.06 + act * (0.2 + 2.2 * v * v)) );
        leds.setColorAt(i, tc);
      }
      if (leds.instanceColor) leds.instanceColor.needsUpdate = true;
      // La nube se ensambla: gira apenas con el avance, sin rotación perpetua
      cloud.rotation.y = (p - 0.8) * 2.2;
      orbit.rotation.z = p * 8;
    },
  };
}
