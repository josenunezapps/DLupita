import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PAL, rng, smooth, smoother, texBox, texPlane, canvasTexture } from '../util.js';
import { makeMonitor, text3D, polishedFloor } from '../parts.js';
import { makeCodeScreen, makeTerminalScreen, makePreviewScreen } from '../code.js';

// ESCENA 2 · ESTACIÓN DE DESARROLLO — Un estudio de ingeniería de noche: pared de vidrio hacia el cielo, suelo pulido,
// dos grupos de trabajo (frontend / backend) con monitores físicos, teclados, sillas y luz de techo difusa.
export function buildStudio(ctx) {
  const { M, Q, col, font, textures } = ctx;
  const g = new THREE.Group(); g.name = 'studio';
  const sh = Q.shadows;
  const X0 = -24, X1 = 24, Y1 = 16, ZF = -82, ZB = -192, LEN = ZF - ZB, CZ = (ZF + ZB) / 2;
  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = sh && o.cast !== false; m.receiveShadow = sh; g.add(m); return m;
  };

  // ---------- Envolvente: suelo, paredes, techo
  polishedFloor(ctx, g, { w: 48, h: LEN + 12, z: CZ - 4, mat: M.floorPolished, opacity: 0.9, tint: 0x8a8896, density: 0.12 });
  for (const zw of [ZF, ZB]) for (const s of [-1, 1]) {
    const w = add(texBox(16.8, Y1, 1.2, 0.16), M.graphiteDark, s * (7.2 + 8.4), Y1 / 2, zw);
    col.box(w, 'swall' + zw + s, 0.1);
  }
  for (const zw of [ZF, ZB]) add(texBox(14.4, 1.4, 1.2, 0.16), M.graphiteDark, 0, Y1 - 0.7, zw);
  const ceil = add(texBox(48, 1, LEN, 0.1), M.graphiteDark, 0, Y1 + 0.5, CZ, { cast: false });
  // Pared de vidrio (izquierda): zócalo, montantes y paño transparente: el cielo nocturno se ve a través
  add(texBox(0.8, 0.8, LEN, 0.2), M.graphiteDark, X0, 0.4, CZ);
  const nMull = 19, mull = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, Y1, 0.5), M.graphite, nMull);
  const d = new THREE.Object3D();
  for (let i = 0; i < nMull; i++) { d.position.set(X0, Y1 / 2, ZF - 2 - i * (LEN - 4) / (nMull - 1)); d.updateMatrix(); mull.setMatrixAt(i, d.matrix); }
  mull.castShadow = sh; g.add(mull);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(LEN, Y1 - 0.8), M.glass);
  pane.rotation.y = Math.PI / 2; pane.position.set(X0 + 0.02, Y1 / 2 + 0.4, CZ); pane.renderOrder = 3; g.add(pane);
  col.boxRaw([X0 - 1, 0, ZB], [X0 + 0.6, Y1, ZF], 'glasswall');
  // Pared derecha: tablero grafito y listones acústicos verticales (ritmo y profundidad al pasar)
  add(texBox(1, Y1, LEN, 0.12), M.graphiteDark, X1 + 0.5, Y1 / 2, CZ);
  col.boxRaw([X1 - 0.2, 0, ZB], [X1 + 1, Y1, ZF], 'rwall');
  const nSl = 76, slats = new THREE.InstancedMesh(texBox(0.35, 13.5, 0.55, 0.3), M.graphite, nSl);
  for (let i = 0; i < nSl; i++) { d.position.set(X1 - 0.3, 7.2, ZF - 3 - i * 1.38); d.updateMatrix(); slats.setMatrixAt(i, d.matrix); }
  slats.castShadow = sh; slats.receiveShadow = sh; g.add(slats);
  // Vigas de techo y luminarias difusas
  const beamGeo = texBox(48, 0.9, 0.9, 0.2);
  for (let i = 0; i < 11; i++) add(beamGeo, M.graphite, 0, Y1 - 0.4, ZF - 5 - i * 10.5, { cast: false });
  const panelMat = M.glowSoft.clone(); panelMat.color.multiplyScalar(0.9);
  const nP = 22, panels = new THREE.InstancedMesh(new THREE.BoxGeometry(5.5, 0.08, 2.6), panelMat, nP);
  for (let i = 0; i < 11; i++) for (const s of [-1, 1]) { d.position.set(s * 9.5, Y1 - 0.92, ZF - 10 - i * 10); d.updateMatrix(); panels.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix); }
  g.add(panels);

  // ---------- Mobiliario
  function desk(x, z0, len, side) {
    const gr = new THREE.Group(); gr.position.set(x, 0, z0);
    const top = new THREE.Mesh(new RoundedBoxGeometry(3.8, 0.16, len, 2, 0.05), M.blackPlastic); top.position.y = 1.5; top.castShadow = sh; top.receiveShadow = sh; gr.add(top);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, len - 0.2), M.aluminum); edge.position.set(side * 1.9, 1.5, 0); gr.add(edge);
    for (const e of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.42, 0.24), M.aluminum); leg.position.set(0, 0.71, e * (len / 2 - 0.9)); leg.castShadow = sh; gr.add(leg);
    }
    const modesty = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, len - 2), M.graphiteDark); modesty.position.set(-side * 1.2, 0.95, 0); gr.add(modesty);
    // línea de luz tenue bajo el canto (acento de identidad, sutil)
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, len - 0.4), M.glowViolet.clone()); led.position.set(side * 1.88, 1.4, 0); led.material.color.multiplyScalar(0.55); gr.add(led);
    g.add(gr); return gr;
  }
  function keyboard(x, y, z, rotY) {
    const gr = new THREE.Group(); gr.position.set(x, y, z); gr.rotation.y = rotY;
    gr.add(new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.1, 0.9, 2, 0.04), M.graphiteDark));
    const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.15, 0.07, 0.15, 1, 0.02), M.blackPlastic, 14 * 5);
    let k = 0; const dd = new THREE.Object3D();
    for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) { dd.position.set(-1.15 + c * 0.177, 0.075, -0.32 + r * 0.17); dd.updateMatrix(); keys.setMatrixAt(k++, dd.matrix); }
    gr.add(keys);
    const mouse = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.1, 0.5, 2, 0.1), M.graphiteDark); mouse.position.set(2.0, 0.05, 0.05); gr.add(mouse);
    g.add(gr); return gr;
  }
  function chair(x, z, rotY) {
    const gr = new THREE.Group(); gr.position.set(x, 0, z); gr.rotation.y = rotY;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 5), M.graphiteDark); base.position.y = 0.35; gr.add(base);
    const col_ = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.0, 10), M.aluminum); col_.position.y = 0.9; gr.add(col_);
    const seat = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.34, 1.9, 3, 0.12), M.rubber); seat.position.y = 1.5; seat.castShadow = sh; gr.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(1.9, 2.4, 0.3, 3, 0.12), M.rubber); back.position.set(0, 2.9, -0.95); back.rotation.x = -0.1; back.castShadow = sh; gr.add(back);
    g.add(gr);
  }
  // Cada puesto: monitores en arco suave mirando al pasillo (rotados hacia la cámara que avanza)
  const screens = [];       // { api, kind, fn }
  function station(x, side, specs) {
    const faceY = side > 0 ? -(Math.PI / 2 - 0.36) : (Math.PI / 2 - 0.36);
    const zs = specs.map((s) => s.z);
    const z0 = (Math.min(...zs) + Math.max(...zs)) / 2, len = Math.max(...zs) - Math.min(...zs) + 12;
    desk(x, z0, len, -side);
    specs.forEach((s) => {
      const api = s.make();
      const mon = makeMonitor(ctx, { w: s.w, h: s.w / api.aspect, tex: api.tex, standLen: 1.2 });
      mon.position.set(x + side * 0.4, 1.58 + 1.2 + s.w / api.aspect / 2, s.z); mon.rotation.y = faceY;
      g.add(mon); textures.push(api.tex);
      screens.push({ api, ...s });
      keyboard(x - side * 1.1, 1.62, s.z - side * 0 + 0.0, faceY + Math.PI);
      chair(x - side * 4.8, s.z + 0.6, faceY - Math.PI / 2 * 0 + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + (side > 0 ? 0.36 : -0.36) - Math.PI / 2 * 0);
    });
    return { x, z0, side };
  }
  const code = (kind) => () => { const a = makeCodeScreen(kind); a.aspect = a.W / a.H; return a; };
  const term = (kind) => () => { const a = makeTerminalScreen(kind); a.aspect = a.W / a.H; return a; };
  const prev = () => { const a = makePreviewScreen(); a.aspect = a.W / a.H; return a; };
  // Frontend (ventana, izquierda): código → vista previa → terminal de build
  const A = station(-11.2, -1, [
    { z: -98, w: 6.4, make: code('app'), win: [0.178, 0.236], mode: 'code' },
    { z: -106.5, w: 6.4, make: prev, win: [0.222, 0.272], mode: 'frac' },
    { z: -115, w: 5.2, make: term('build'), win: [0.255, 0.292], mode: 'frac' },
  ]);
  // Backend (derecha): código de servidor → esquema SQL → registros del servicio
  const B = station(11.2, 1, [
    { z: -128, w: 6.4, make: code('server'), win: [0.285, 0.335], mode: 'code' },
    { z: -136.5, w: 5.6, make: code('sql'), win: [0.30, 0.34], mode: 'code' },
    { z: -145, w: 5.2, make: term('logs'), win: [0.318, 0.352], mode: 'frac' },
  ]);
  // Puestos de fondo (pantallas con contenido estático): profundidad y credibilidad
  const idle = [makeCodeScreen('css'), makeCodeScreen('auth')];
  idle.forEach((a, i) => { a.update(1, 0); textures.push(a.tex); });
  [[-11.2, -1, -165, 0], [11.2, 1, -172, 1]].forEach(([x, side, z, i]) => {
    const faceY = side > 0 ? -(Math.PI / 2 - 0.36) : (Math.PI / 2 - 0.36);
    desk(x, z, 16, -side);
    const mon = makeMonitor(ctx, { w: 6, h: 6 / (idle[i].W / idle[i].H), tex: idle[i].tex, standLen: 1.2 });
    mon.position.set(x + side * 0.4, 1.58 + 1.2 + 6 / (idle[i].W / idle[i].H) / 2, z); mon.rotation.y = faceY; g.add(mon);
  });

  // Carteles colgantes de cada grupo (letras de aluminio sobre placa negra)
  if (font) {
    [[A, 'FRONTEND'], [B, 'BACKEND']].forEach(([st, label]) => {
      const gr = new THREE.Group(); gr.position.set(st.x, 11.4, st.z0 - 2);
      const plate = new THREE.Mesh(new RoundedBoxGeometry(8.4, 1.5, 0.22, 2, 0.06), M.blackGloss); gr.add(plate);
      const t = text3D(ctx, label, 0.72, { depth: 0.12, mat: M.aluminum, sideMat: M.graphite }); t.position.z = 0.16; gr.add(t);
      for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.6, 6), M.aluminum); rod.position.set(sx * 3.8, 3.0, 0); gr.add(rod); }
      gr.rotation.y = st.side > 0 ? -(Math.PI / 2 - 0.1) : (Math.PI / 2 - 0.1);
      g.add(gr);
    });
  }

  // Pantalla mural de repositorio (pared derecha): ramas y confirmaciones (contenido de ejemplo)
  const wall = canvasTexture(1536, 640, (c, w, h) => {
    c.fillStyle = '#0d0d11'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e6e5ee'; c.font = '600 34px ui-sans-serif, system-ui, sans-serif'; c.fillText('Actividad del repositorio', 48, 66);
    c.fillStyle = '#6f6e80'; c.font = '400 22px ui-sans-serif, system-ui, sans-serif'; c.fillText('contenido de ejemplo', 48, 100);
    const rows = [['main', '#8b5cff', 190], ['feature/api', '#9ad7c4', 300], ['feature/ui', '#8fb4ff', 410], ['fix/auth', '#e6c07b', 520]];
    rows.forEach(([n, colr, y]) => {
      c.fillStyle = '#8d8c9f'; c.font = '500 24px ui-monospace, monospace'; c.fillText(n, 48, y + 8);
      c.strokeStyle = colr; c.lineWidth = 4; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(280, y); c.lineTo(1480, y); c.stroke();
      for (let i = 0; i < 12; i++) { const x = 300 + i * 100 + ((n.length * 37 + i * 53) % 40); if ((i * 7 + n.length) % 3 !== 0) { c.fillStyle = '#0d0d11'; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); c.stroke(); } }
      c.globalAlpha = 1;
    });
  }, { aniso: 8 });
  textures.push(wall.tex);
  const wallScreen = new THREE.Mesh(new THREE.PlaneGeometry(15, 6.25), new THREE.MeshBasicMaterial({ map: wall.tex, toneMapped: false }));
  wallScreen.position.set(X1 - 0.5, 7.4, -118); wallScreen.rotation.y = -Math.PI / 2; g.add(wallScreen);
  const wf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6.6, 15.4), M.blackGloss); wf.position.set(X1 - 0.2, 7.4, -118); g.add(wf);

  // Pilares estructurales y puerta de salida: marco metálico (el paso al siguiente espacio)
  const doorFrameZ = ZB + 0.8;
  for (const s of [-1, 1]) add(texBox(1.0, 15, 1.6, 0.3), M.aluminum, s * 7.6, 7.5, doorFrameZ, { cast: false });

  let budget = 0;
  return {
    group: g, range: [0.12, 0.38],
    update(s) {
      const p = s.p, L = s.L;
      budget = 0;
      for (const sc of screens) {
        const f = smooth(sc.win[0], sc.win[1], p);
        if (budget < 3 && sc.api.update(f, s.time)) budget++;
      }
      // Luces reales: clave cenital sobre el grupo de trabajo que la cámara está mirando
      const live = smooth(0.13, 0.16, p) * (1 - smooth(0.352, 0.372, p));
      const fx = Math.max(X0 + 4, Math.min(X1 - 4, s.look.x)), fz = Math.max(ZB + 6, Math.min(ZF - 4, s.look.z));
      L.key.position.set(fx * 0.4, 15, fz + 6); L.key.target.position.set(fx, 2.5, fz);
      L.key.color.set(0xf1f1f4); L.key.angle = 0.9; L.key.penumbra = 1; L.key.intensity = 420 * live;
      const onA = p < 0.28;
      const tx = onA ? A.x + 4 : B.x - 4, tz = onA ? -106 : -137;
      L.acc1.position.set(tx, 5, tz); L.acc1.color.set(onA ? 0xcfdcff : 0xd8c8ff); L.acc1.distance = 34; L.acc1.intensity = 40 * live;
      L.acc2.position.set(0, 14, fz); L.acc2.color.set(0xfff0e0); L.acc2.distance = 60; L.acc2.intensity = 60 * live;
      L.sun.intensity = 0;
    },
  };
}
