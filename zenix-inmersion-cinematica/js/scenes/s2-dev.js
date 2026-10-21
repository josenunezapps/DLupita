import * as THREE from 'three';
import { PAL, rng, smooth, clamp, neon } from '../util.js';
import { gridMaterial } from '../materials.js';
import { makeCodeScreen, makeTerminalScreen } from '../code.js';
import { makeMonitor, text3D, fileSlab, glassTag } from '../parts.js';

// ESCENA 2 · Estación de desarrollo: consolas con monitores físicos, código que se escribe al llegar, terminales,
// archivos y módulos flotantes. Frontend a la izquierda (cian), backend a la derecha (violeta).
export function buildDevStation(ctx) {
  const { M, Q, col, textures } = ctx;
  const g = new THREE.Group();
  g.name = 'dev';
  const FLOOR = -4, Z0 = -64, Z1 = -166;
  const low = Q.detail === 'low';
  const W = low ? 640 : Q.detail === 'high' ? 1280 : 1024;

  // Plataforma con volumen real, rejilla emisiva y cantos luminosos
  const plat = new THREE.Mesh(new THREE.BoxGeometry(96, 1.2, Z0 - Z1), M.floor);
  plat.position.set(0, FLOOR - 0.6, (Z0 + Z1) / 2);
  plat.receiveShadow = Q.shadows;
  g.add(plat);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(96, Z0 - Z1), gridMaterial({ color: PAL.violet, cell: 3, intensity: 0.9, alpha: 0.75 }));
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, FLOOR + 0.012, (Z0 + Z1) / 2);
  g.add(grid);
  const rim = (x, z, sx, sz, m) => { const e = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sz), m); e.position.set(x, FLOOR + 0.03, z); g.add(e); };
  rim(0, Z0 - 0.2, 96, 0.3, M.cyanGlow); rim(0, Z1 + 0.2, 96, 0.3, M.violetGlow);
  rim(-47.8, (Z0 + Z1) / 2, 0.3, Z0 - Z1, M.violetGlow); rim(47.8, (Z0 + Z1) / 2, 0.3, Z0 - Z1, M.cyanGlow);
  col.boxRaw([-48, FLOOR - 1.2, Z1], [48, FLOOR, Z0], 'dev-floor');

  // Consolas de trabajo a ambos lados del pasillo central
  const consoleLen = 66, consoleZ = -114;
  [-1, 1].forEach((s) => {
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, consoleLen), M.metalDark);
    body.position.set(s * 6.1, FLOOR + 0.45, consoleZ);
    body.castShadow = body.receiveShadow = Q.shadows;
    g.add(body);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.05, consoleLen - 0.4), M.black);
    top.position.set(s * 6.1, FLOOR + 0.93, consoleZ);
    g.add(top);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, consoleLen), s < 0 ? M.cyanGlow : M.violetGlow);
    strip.position.set(s * 4.43, FLOOR + 0.88, consoleZ);
    g.add(strip);
    col.box(body, 'console-' + s, 0.05);
  });

  // Teclados: teclas emisivas instanciadas
  const keyGeo = new THREE.BoxGeometry(0.19, 0.04, 0.19);
  const keyCount = 2 * 3 * 70;
  const keys = new THREE.InstancedMesh(keyGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), keyCount);
  const r = rng(21);
  const dummy = new THREE.Object3D(); const c = new THREE.Color();
  let ki = 0;
  [-1, 1].forEach((s) => [-100, -118, -141].forEach((z0) => {
    for (let i = 0; i < 70; i++) {
      const cx = i % 14, cz = Math.floor(i / 14);
      dummy.position.set(s * 5.2 + (cz - 2) * 0.23 * s, FLOOR + 0.98, z0 + (cx - 7) * 0.23);
      dummy.updateMatrix(); keys.setMatrixAt(ki, dummy.matrix);
      c.set(s < 0 ? PAL.cyan : PAL.violet).multiplyScalar(0.25 + r() * 1.4);
      keys.setColorAt(ki, c); ki++;
    }
  }));
  g.add(keys);

  // Monitores con código. `start` = progreso en el que la cámara se acerca a cada uno: allí comienza a escribirse.
  const pAtZ = (z) => 0.18 + (-76 - z) * (0.14 / 60);
  const screens = [];
  const monitors = [];
  const addMon = (kind, x, y, z, rotY, w, h, accent, term = false) => {
    const asp = (w - 0.34) / (h - 0.34);
    const scr = term ? makeTerminalScreen(kind, { W: Math.round(W * 0.75), aspect: asp }) : makeCodeScreen(kind, { W, aspect: asp });
    textures.push(scr.tex);
    const m = makeMonitor(ctx, { w, h, tex: scr.tex, accent, standLen: (y - h / 2) - FLOOR - (term ? 0.9 : 0) });
    m.position.set(x, y, z); m.rotation.y = rotY;
    g.add(m);
    col.box(m, 'monitor-' + kind + '-' + monitors.length, 0.1);
    const start = pAtZ(z) - 0.055;
    screens.push({ scr, start, end: start + 0.085, z });
    scr.update(0, 0);
    monitors.push(m);
    return m;
  };
  const L = PAL.cyan, V = PAL.violet;
  // Frontend (izquierda)
  addMon('html', -9.8, 0.4, -89, 0.55, 5.2, 3.2, L);
  addMon('css', -11.6, 3.7, -97, 0.62, 4.2, 2.6, L);
  addMon('hero', -10.0, 0.6, -107, 0.6, 5.2, 3.2, L);
  if (!low) addMon('css', -11.8, 3.8, -140, 0.5, 4.2, 2.6, L);
  addMon('app', -7.6, 2.2, -122, 0.62, 8.4, 5.2, L);              // monitor principal frontend
  // Backend (derecha)
  addMon('auth', 9.8, 0.4, -93, -0.55, 5.2, 3.2, V);
  addMon('sql', 11.6, 3.7, -101, -0.62, 4.2, 2.6, V);
  addMon('server', 10.0, 0.6, -112, -0.6, 5.2, 3.2, V);
  if (!low) addMon('auth', 11.8, 3.8, -144, -0.5, 4.2, 2.6, V);
  addMon('server', 7.6, 2.2, -127, -0.62, 8.4, 5.2, V);           // monitor principal backend
  // Terminales de desarrollo, más cerca del pasillo
  addMon('build', -5.1, FLOOR + 2.55, -96, 0.95, 3.1, 2.0, L, true);
  addMon('deploy', 5.1, FLOOR + 2.55, -105, -0.95, 3.1, 2.0, V, true);
  addMon('logs', -5.1, FLOOR + 2.55, -134, 0.95, 3.1, 2.0, L, true);
  if (!low) addMon('build', 5.1, FLOOR + 2.55, -140, -0.95, 3.1, 2.0, V, true);

  // Archivos y módulos flotantes
  const names = ['index.html', 'App.jsx', 'Hero.jsx', 'styles.css', 'main.js', 'server.js', 'auth.js', 'schema.sql', 'routes.js', 'package.json'];
  const slabs = [];
  const nSlab = low ? 6 : 10;
  for (let i = 0; i < nSlab; i++) {
    const side = i < nSlab / 2 ? -1 : 1;
    const sl = fileSlab(ctx, names[i], side < 0 ? '#5eead4' : '#b69bff');
    const bx = side * (13.5 + (i % 3) * 2.4), by = 7.2 + (i % 2) * 2.0, bz = -88 - (i % (nSlab / 2)) * 11.5;
    sl.position.set(bx, by - 8, bz); sl.rotation.y = -side * 0.7;
    g.add(sl);
    slabs.push({ m: sl, bx, by, bz, i });
    col.boxRaw([bx - 1.6, by - 1.8, bz - 1.2], [bx + 1.6, by + 1.8, bz + 1.2], 'slab-' + i);
  }
  const tags = [];
  const tagTxt = ['<Hero />', '<Navbar />', 'useAuth()', 'GET /api', 'POST /api', 'JWT', 'SELECT *', 'git push'];
  const nTag = low ? 4 : tagTxt.length;
  for (let i = 0; i < nTag; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const t = glassTag(ctx, tagTxt[i], side < 0 ? '#5eead4' : '#c4b5fd');
    const bx = side * (4.8 + (i % 2) * 0.6), by = 3.9 + (i % 3) * 0.55, bz = -86 - Math.floor(i / 2) * 16 - (side > 0 ? 8 : 0);
    t.position.set(bx, by - 5, bz); t.rotation.y = -side * 0.8;
    g.add(t); tags.push({ m: t, bx, by, bz, i });
    col.boxRaw([bx - 1.5, by - 0.7, bz - 1.2], [bx + 1.5, by + 0.7, bz + 1.2], 'tag-' + i);
  }

  // Rótulos 3D de zona
  const fe = text3D(ctx, 'FRONTEND', 1.5, { depth: 0.35, mat: M.cyanGlow });
  fe.position.set(-10.5, 9.4, -114); fe.rotation.y = 0.5; g.add(fe);
  const be = text3D(ctx, 'BACKEND', 1.5, { depth: 0.35, mat: M.violetGlow });
  be.position.set(10.5, 9.4, -114); be.rotation.y = -0.5; g.add(be);
  col.boxRaw([-15.5, 8, -116], [-5, 11, -112], 'sign-fe'); col.boxRaw([5, 8, -116], [15.5, 11, -112], 'sign-be');

  // Estructura aérea: vigas y paneles de luz (da sensación de interior)
  const beamGeo = new THREE.BoxGeometry(46, 0.4, 0.7);
  const lightMat = neon(0xcfe3ff, 1.5);
  [-84, -100, -116, -132, -148].forEach((z, i) => {
    const b = new THREE.Mesh(beamGeo, M.metalDark); b.position.set(0, 12.5, z); g.add(b);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(23, 0.06, 0.12), M.cyanGlow); s1.position.set(-11.6, 12.27, z); g.add(s1);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(23, 0.06, 0.12), M.violetGlow); s2.position.set(11.6, 12.27, z); g.add(s2);
    [-14, 14].forEach((x) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 1.5), lightMat); p.position.set(x, 11.9, z + 4); g.add(p);
    });
    col.boxRaw([-24, 12.2, z - 0.5], [24, 12.9, z + 0.5], 'beam-' + i);
  });
  // Pilares perimetrales
  const pilGeo = new THREE.BoxGeometry(1.6, 24, 1.6);
  const pil = new THREE.InstancedMesh(pilGeo, M.metalDark, 12);
  const pst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 24, 0.12), M.violetGlow, 12);
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1, z = -76 - Math.floor(i / 2) * 15;
    dummy.position.set(side * 26, 8, z); dummy.updateMatrix(); pil.setMatrixAt(i, dummy.matrix);
    dummy.position.set(side * 26 - side * 0.84, 8, z + 0.85); dummy.updateMatrix(); pst.setMatrixAt(i, dummy.matrix);
    col.boxRaw([side * 26 - 0.9, FLOOR, z - 0.9], [side * 26 + 0.9, 20, z + 0.9], 'pillar-' + i);
  }
  g.add(pil, pst);

  let budget = 0;
  return {
    group: g,
    range: [0.06, 0.40],
    update(s) {
      const p = s.p;
      // Archivos y módulos suben a su sitio al llegar al editor
      const rise = smooth(0.14, 0.27, p);
      slabs.forEach(({ m, bx, by, bz, i }) => {
        m.position.set(bx, by - (1 - rise) * 8 + Math.sin(p * 55 + i * 1.7) * 0.18 * rise, bz);
      });
      const rise2 = smooth(0.16, 0.3, p);
      tags.forEach(({ m, bx, by, bz, i }) => { m.position.set(bx, by - (1 - rise2) * 5 + Math.sin(p * 48 + i) * 0.1 * rise2, bz); });
      // Código: se escribe a medida que la cámara llega a cada monitor (reversible al volver atrás)
      budget = 3;
      const camZ = s.camera.position.z;
      for (const it of screens) {
        if (Math.abs(camZ - it.z) > 90) continue;
        const f = smooth(it.start, it.end, p);
        if (budget > 0 && it.scr.update(f, s.time)) budget--;
      }
    },
  };
}
