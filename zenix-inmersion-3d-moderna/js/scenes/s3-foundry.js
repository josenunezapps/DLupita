import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PAL, rng, clamp, smooth, smoother, texBox, texPlane, canvasTexture } from '../util.js';
import { flowMaterial } from '../materials.js';
import { text3D, polishedFloor } from '../parts.js';
import { makePreviewScreen } from '../code.js';

// ESCENA 3 · PROCESAMIENTO — Una línea de producción de software: módulos de código (cubos de cristal con código) entran por
// la cinta, atraviesan el compilador, salen como paquetes sólidos y brazos robóticos los ensamblan en una aplicación real.
export function buildFoundry(ctx) {
  const { M, Q, col, font, textures } = ctx;
  const g = new THREE.Group(); g.name = 'foundry';
  const sh = Q.shadows;
  const HW = 16, H = 20, ZF = -193, ZB = -305, LEN = ZF - ZB, CZ = (ZF + ZB) / 2;
  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh && o.cast !== false; m.receiveShadow = sh; g.add(m); return m;
  };
  const d = new THREE.Object3D();

  // ---------- Nave: suelo de hormigón pulido, muros con pilastras, techo con cerchas y luminarias lineales
  const floor = new THREE.Mesh(texPlane(HW * 2 + 2, LEN + 6, 0.1), M.floorMatte);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, CZ); floor.receiveShadow = sh; g.add(floor);
  // marcas de seguridad pintadas en el suelo (líneas finas blancas atenuadas)
  const paint = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd8d6e0).multiplyScalar(0.28) });
  for (const x of [-4.6, 4.6]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.22, LEN - 4), paint); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.015, CZ); g.add(l); }
  for (const s of [-1, 1]) {
    const w = add(texBox(1.2, H, LEN, 0.1), M.concreteDark, s * (HW + 0.6), H / 2, CZ);
    col.boxRaw([s > 0 ? HW - 0.1 : -HW - 1.8, 0, ZB], [s > 0 ? HW + 1.8 : -HW + 0.1, H, ZF], 'fwall' + s);
  }
  const nPil = 10, pil = new THREE.InstancedMesh(texBox(1.5, H, 1.5, 0.2), M.graphite, nPil * 2);
  for (let i = 0; i < nPil; i++) for (const s of [-1, 1]) { d.position.set(s * (HW - 0.4), H / 2, ZF - 6 - i * 11); d.updateMatrix(); pil.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix); }
  pil.castShadow = sh; pil.receiveShadow = sh; g.add(pil);
  add(texBox(HW * 2, 1, LEN, 0.1), M.graphiteDark, 0, H + 0.5, CZ, { cast: false });
  // cerchas transversales y luminarias lineales colgantes
  const truss = new THREE.InstancedMesh(texBox(HW * 2, 0.9, 0.7, 0.2), M.graphite, 11);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 9), M.glowSoft.clone(), 22);
  lights.material.color.multiplyScalar(1.0);
  for (let i = 0; i < 11; i++) {
    d.position.set(0, H - 0.5, ZF - 3 - i * 10.2); d.updateMatrix(); truss.setMatrixAt(i, d.matrix);
    for (const s of [-1, 1]) { d.position.set(s * 8.5, H - 2.2, ZF - 3 - i * 10.2); d.updateMatrix(); lights.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix); }
  }
  g.add(truss, lights);
  // bandejas de cables a lo largo de los muros (detalle industrial)
  for (const s of [-1, 1]) for (const y of [6.5, 9.5]) {
    add(new THREE.BoxGeometry(0.9, 0.2, LEN - 6), M.graphite, s * (HW - 1.4), y, CZ, { cast: false });
    const bundle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, LEN - 8, 8), M.blackPlastic); bundle.rotation.x = Math.PI / 2; bundle.position.set(s * (HW - 1.4), y + 0.3, CZ); g.add(bundle);
  }

  // ---------- Cinta transportadora
  const BY = 1.5, BL = LEN - 8, BZ0 = ZF - 4, BW = 4.2;
  const beltTex = M.rubber.normalMap.clone(); beltTex.needsUpdate = true; beltTex.repeat.set(2, 60);
  const beltMat = M.rubber.clone(); beltMat.normalMap = beltTex; beltMat.roughnessMap = beltTex;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.3, BL), beltMat); belt.position.set(0, BY, BZ0 - BL / 2); belt.receiveShadow = sh; g.add(belt);
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, BL), M.aluminum); rail.position.set(s * (BW / 2 + 0.14), BY + 0.15, BZ0 - BL / 2); rail.castShadow = sh; g.add(rail);
  }
  const nSup = 18, sup = new THREE.InstancedMesh(texBox(BW + 1.2, BY - 0.15, 0.6, 0.3), M.graphiteDark, nSup);
  for (let i = 0; i < nSup; i++) { d.position.set(0, (BY - 0.15) / 2, BZ0 - 2 - i * (BL - 4) / (nSup - 1)); d.updateMatrix(); sup.setMatrixAt(i, d.matrix); }
  sup.castShadow = sh; g.add(sup);

  // ---------- Módulos (cristal con código) → paquetes (aluminio con sello violeta)
  const N = 16, GAP = BL / N;
  const codeTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#0d0d12'; c.fillRect(0, 0, w, h);
    const cols = ['#c4a7ff', '#9ad7c4', '#8fb4ff', '#e6c07b', '#a9a8ba'];
    for (let i = 0; i < 12; i++) { c.fillStyle = cols[(i * 7) % cols.length]; c.globalAlpha = 0.85; c.fillRect(24 + (i % 3) * 18, 26 + i * 17, 50 + ((i * 53) % 130), 7); }
  }); textures.push(codeTex.tex);
  const SZ = 1.8;
  const rawShell = new THREE.InstancedMesh(new RoundedBoxGeometry(SZ, SZ, SZ, 3, 0.12), M.glass, N);
  const rawCore = new THREE.InstancedMesh(new THREE.BoxGeometry(SZ * 0.72, SZ * 0.72, SZ * 0.72), new THREE.MeshBasicMaterial({ map: codeTex.tex, toneMapped: false }), N);
  const pack = new THREE.InstancedMesh(new RoundedBoxGeometry(SZ * 0.92, SZ * 0.92, SZ * 0.92, 3, 0.1), M.aluminum, N);
  const seal = new THREE.InstancedMesh(new THREE.BoxGeometry(SZ * 0.96, 0.16, SZ * 0.96), M.violetMetal, N);
  rawShell.renderOrder = 4; pack.castShadow = sh; seal.castShadow = sh;
  g.add(rawCore, rawShell, pack, seal);
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);

  // ---------- Compilador (pórtico con cámara de proceso)
  const MZ = -239;                           // centro del compilador
  const towers = [-1, 1].map((s) => {
    const t = add(texBox(3.6, 13, 15, 0.2), M.graphite, s * 6.4, 6.5, MZ);
    col.box(t, 'tower' + s, 0.05);
    // ranura de visión: vidrio oscuro con luz interior (se enciende al compilar)
    const win = add(new THREE.BoxGeometry(0.1, 0.3, 11), M.glow ? M.glow : M.glowSoft.clone(), s * 4.55, 3.4, MZ, { cast: false });
    win.material.color.setRGB(0.015, 0.012, 0.03);
    return win;
  });
  const bridge = add(texBox(16.4, 3.4, 15, 0.2), M.graphiteDark, 0, 11.7, MZ);
  col.box(bridge, 'bridge', 0.05);
  // marcos de entrada/salida de la cámara
  for (const zz of [MZ + 7.6, MZ - 7.6]) {
    const fr = add(texBox(9.2, 0.5, 0.9, 0.3), M.aluminum, 0, 10.0, zz);
    for (const s of [-1, 1]) add(texBox(0.5, 9.6, 0.9, 0.3), M.aluminum, s * 4.5, 5.2, zz);
  }
  // luz de proceso dentro de la cámara (barrido que avanza con la compilación)
  const scanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd6c8ff).multiplyScalar(1.3), transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), scanMat); scan.rotation.y = 0; scan.position.set(0, 5.4, MZ); g.add(scan);
  // pantalla de estado (HUD) en el frente del pórtico
  const hud = canvasTexture(1024, 340, () => {}, { aniso: 8 }); textures.push(hud.tex);
  const hudState = { pct: -1 };
  function drawHud(pct) {
    const c = hud.ctx, w = 1024, h = 340;
    c.fillStyle = '#0b0b0f'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 2; c.strokeRect(1, 1, w - 2, h - 2);
    c.fillStyle = '#8d8c9f'; c.font = '600 22px ui-monospace, Menlo, monospace'; c.fillText('PIPELINE · BUILD', 36, 52);
    c.fillStyle = '#f1f0f7'; c.font = '700 84px ui-sans-serif, system-ui, sans-serif'; c.fillText(pct + ' %', 36, 150);
    c.fillStyle = '#1c1c24'; c.fillRect(36, 190, 440, 12);
    c.fillStyle = '#8b5cff'; c.fillRect(36, 190, 440 * pct / 100, 12);
    const steps = [['Validar módulos', 15], ['Resolver dependencias', 35], ['Optimizar', 60], ['Empaquetar', 85], ['Pruebas 48/48', 98]];
    steps.forEach(([t, th], i) => {
      const done = pct >= th, y = 70 + i * 50;
      c.fillStyle = done ? '#7fd6a6' : '#4d4c5c'; c.font = '600 28px ui-sans-serif, system-ui, sans-serif'; c.fillText(done ? '✓' : '○', 560, y + 18);
      c.fillStyle = done ? '#e6e5ee' : '#6f6e80'; c.font = '500 28px ui-sans-serif, system-ui, sans-serif'; c.fillText(t, 604, y + 18);
    });
    hud.tex.needsUpdate = true;
  }
  drawHud(0);
  const hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 3.05), new THREE.MeshBasicMaterial({ map: hud.tex, toneMapped: false }));
  hudMesh.position.set(0, 11.7, MZ + 7.56); g.add(hudMesh);
  const hudFrame = new THREE.Mesh(new RoundedBoxGeometry(9.5, 3.35, 0.2, 2, 0.05), M.blackGloss); hudFrame.position.set(0, 11.7, MZ + 7.46); g.add(hudFrame);
  // Cables que alimentan el compilador desde el techo (pulsos de datos)
  const flows = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x0 = s * (5 + i * 1.6), z0 = MZ + 4 - i * 4;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, H - 0.8, z0 + 12), new THREE.Vector3(x0 * 1.1, H - 4, z0 + 6), new THREE.Vector3(x0, 15.2, z0)]);
    const fm = flowMaterial({ color: PAL.violet, pulse: 0xffffff, speed: 0.6, density: 5, base: 0.18 });
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.12, 6, false), fm); g.add(t); flows.push(fm);
  }

  // ---------- Brazos robóticos (cinemática inversa de 2 segmentos que siguen las piezas)
  function makeArm(x, z, mirror) {
    const L1 = 6.2, L2 = 5.4;
    const base = new THREE.Group(); base.position.set(x, 0, z);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 1.6, 24), M.graphiteDark); pedestal.position.y = 0.8; pedestal.castShadow = sh; base.add(pedestal);
    const yaw = new THREE.Group(); yaw.position.y = 1.6; base.add(yaw);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.0, 20), M.graphite); turret.position.y = 0.5; yaw.add(turret);
    const sho = new THREE.Group(); sho.position.set(0, 1.3, 0); yaw.add(sho);
    const j1 = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 20), M.aluminum); j1.rotation.x = Math.PI / 2; sho.add(j1);
    const l1 = new THREE.Mesh(new RoundedBoxGeometry(L1, 0.9, 0.9, 2, 0.15), M.whitePaint); l1.position.x = L1 / 2; l1.castShadow = sh; sho.add(l1);
    const elb = new THREE.Group(); elb.position.x = L1; sho.add(elb);
    const j2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 20), M.aluminum); j2.rotation.x = Math.PI / 2; elb.add(j2);
    const l2 = new THREE.Mesh(new RoundedBoxGeometry(L2, 0.7, 0.7, 2, 0.12), M.whitePaint); l2.position.x = L2 / 2; l2.castShadow = sh; elb.add(l2);
    const grip = new THREE.Group(); grip.position.x = L2; elb.add(grip);
    for (const sy of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.5), M.graphiteDark); f.position.set(0.5, sy * 0.35, 0); grip.add(f); }
    const tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), M.glowViolet.clone()); tipLight.position.set(0.2, 0, 0.3); grip.add(tipLight);
    g.add(base);
    const tmp = new THREE.Vector3();
    return {
      base, grip, tip: tipLight,
      aim(tx, ty, tz) {
        const dx = tx - x, dz = tz - z, r = Math.hypot(dx, dz), h = ty - (1.6 + 1.3);
        yaw.rotation.y = Math.atan2(-dz, dx);
        const dd = clamp(Math.hypot(r, h), Math.abs(L1 - L2) + 0.05, L1 + L2 - 0.05);
        const beta = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
        const gamma = Math.acos(clamp((L1 * L1 + L2 * L2 - dd * dd) / (2 * L1 * L2), -1, 1));
        sho.rotation.z = Math.atan2(h, r) + beta; elb.rotation.z = -(Math.PI - gamma);
        grip.rotation.z = -(sho.rotation.z + elb.rotation.z);
      },
    };
  }
  const inspect = [makeArm(-9.4, MZ + 11, -1), makeArm(9.4, MZ + 11, 1), makeArm(-9.4, MZ - 11, -1), makeArm(9.4, MZ - 11, 1)];

  // ---------- Célula de ensamblaje (plataforma con la aplicación terminada)
  const AZ = -282, AY = 1.5;
  const plat = add(texBox(15, 0.6, 15, 0.2), M.graphite, 0, 0.3, AZ);
  const ped = add(new THREE.CylinderGeometry(4.2, 4.6, 1.0, 40), M.graphiteDark, 0, 1.1, AZ);
  const pedTop = add(new THREE.CylinderGeometry(4.0, 4.0, 0.08, 40), M.aluminum, 0, 1.64, AZ, { cast: false });
  col.box(plat, 'plat', 0.05);
  const arms = [makeArm(-7.2, AZ + 5, -1), makeArm(7.2, AZ + 5, 1), makeArm(-7.2, AZ - 5.5, -1), makeArm(7.2, AZ - 5.5, 1)];
  // Aplicación: ventana de navegador + teléfono (volúmenes reales con pantalla)
  const prev = makePreviewScreen(); textures.push(prev.tex);
  const app = new THREE.Group(); app.position.set(0, AY + 0.16, AZ); g.add(app);
  const winG = new THREE.Group(); app.add(winG);
  const winBody = new THREE.Mesh(new RoundedBoxGeometry(6.4, 3.7, 0.3, 3, 0.1), M.graphite); winG.add(winBody); winBody.castShadow = sh;
  const winScr = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 6.1 / prev.W * prev.H), new THREE.MeshBasicMaterial({ map: prev.tex, toneMapped: false })); winScr.position.z = 0.16; winG.add(winScr);
  const winStand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.3), M.aluminum); winStand.position.set(0, -2.6, -0.2); winG.add(winStand);
  const phoneG = new THREE.Group(); app.add(phoneG);
  const phone = new THREE.Mesh(new RoundedBoxGeometry(1.9, 3.8, 0.24, 4, 0.22), M.graphiteDark); phoneG.add(phone); phone.castShadow = sh;
  const phoneTex = canvasTexture(256, 512, (c, w, h) => {
    c.fillStyle = '#0c0c10'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f4f3f9'; c.font = '700 34px ui-sans-serif, system-ui, sans-serif'; c.fillText('Tu idea,', 22, 90); c.fillText('en producción.', 22, 132);
    c.fillStyle = '#8b5cff'; c.beginPath(); c.roundRect ? c.roundRect(22, 160, 150, 40, 20) : c.rect(22, 160, 150, 40); c.fill();
    for (let i = 0; i < 3; i++) { c.fillStyle = '#17171d'; c.fillRect(22, 232 + i * 82, w - 44, 66); c.fillStyle = '#8b5cff'; c.fillRect(34, 246 + i * 82, 18, 3); c.fillStyle = '#6f6e80'; c.fillRect(34, 262 + i * 82, 110 + i * 20, 8); }
  }, { aniso: 8 }); textures.push(phoneTex.tex);
  const phoneScr = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 3.5), new THREE.MeshBasicMaterial({ map: phoneTex.tex, toneMapped: false })); phoneScr.position.z = 0.13; phoneG.add(phoneScr);
  // rótulos de cada etapa (letras de aluminio sobre placa negra, colgadas del techo)
  function sign(txt, z) {
    if (!font) return;
    const gr = new THREE.Group(); gr.position.set(0, 15.6, z);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(8.6, 1.3, 0.2, 2, 0.05), M.blackGloss); gr.add(plate);
    const t = text3D(ctx, txt, 0.6, { depth: 0.1, mat: M.aluminum, sideMat: M.graphite }); t.position.z = 0.15; gr.add(t);
    for (const sx of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.2, 6), M.aluminum); rod.position.set(sx * 4, 2.6, 0); gr.add(rod); }
    g.add(gr);
  }
  sign('FUENTE', -216); sign('COMPILADOR', MZ + 9.5); sign('SOFTWARE', -262);
  const asmLight = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.04, 40), M.glowSoft.clone()); asmLight.position.set(0, H - 1.2, AZ); asmLight.material.color.multiplyScalar(0.9); g.add(asmLight);

  const v3 = new THREE.Vector3(), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  return {
    group: g, range: [0.3, 0.56],
    update(s) {
      const p = s.p, L = s.L, t = s.time;
      const compile = smooth(0.375, 0.5, p);
      const pct = Math.round(compile * 100);
      if (pct !== hudState.pct) { hudState.pct = pct; drawHud(pct); }
      // Avance de la cinta: ligado al recorrido (reversible); la textura de la goma se desplaza igual
      const phase = (p - 0.34) * 330;
      beltTex.offset.y = -phase / (BL / 60) * 0.0;       // la normal map de goma es muy sutil; el movimiento se aprecia en los módulos
      const chamberA = MZ + 7.2, chamberB = MZ - 7.2;
      let nearest = [];
      for (let i = 0; i < N; i++) {
        const along = ((i * GAP + phase) % BL + BL) % BL;
        const z = BZ0 - along;
        const inChamber = z < chamberA && z > chamberB;
        const processed = z < MZ;
        d.rotation.set(0, 0, 0);
        const y = BY + 0.15 + SZ / 2 + 0.02;
        if (!processed) { d.position.set(0, y, z); d.updateMatrix(); rawShell.setMatrixAt(i, d.matrix); d.scale.setScalar(1); const k = 1 - smooth(MZ + 5.5, MZ + 0.5, z); d.scale.setScalar(Math.max(0.0001, k)); d.updateMatrix(); rawCore.setMatrixAt(i, d.matrix); d.scale.setScalar(1); pack.setMatrixAt(i, hide); seal.setMatrixAt(i, hide); }
        else {
          const k = smooth(MZ, MZ - 5.5, z);
          d.position.set(0, y - 0.04, z); d.scale.setScalar(Math.max(0.0001, k)); d.updateMatrix(); pack.setMatrixAt(i, d.matrix);
          d.position.y = y - 0.04 + SZ * 0.2 * k; d.updateMatrix(); seal.setMatrixAt(i, d.matrix); d.scale.setScalar(1);
          rawShell.setMatrixAt(i, hide); rawCore.setMatrixAt(i, hide);
        }
        if (z < s.camera.position.z + 22 && z > s.camera.position.z - 26) nearest.push(z);
      }
      rawShell.instanceMatrix.needsUpdate = true; rawCore.instanceMatrix.needsUpdate = true; pack.instanceMatrix.needsUpdate = true; seal.instanceMatrix.needsUpdate = true;
      // Compilador: el barrido recorre la cámara mientras compila; las ranuras se encienden
      scanMat.opacity = 0.11 * smooth(0.37, 0.42, p) * (1 - smooth(0.49, 0.52, p));
      scan.position.z = MZ + Math.sin(compile * Math.PI * 6) * 6.2;
      towers.forEach((w) => { { const k = 0.01 + 0.2 * compile; w.material.color.setRGB(0.5 * k, 0.38 * k, k); } });
      flows.forEach((f) => { f.uniforms.uTime.value = t; f.uniforms.uAct.value = smooth(0.37, 0.4, p) * (1 - smooth(0.5, 0.52, p)); });
      // Brazos de inspección: siguen el módulo más cercano a cada uno
      const targetZ = (k) => nearest.length ? nearest.reduce((a, b) => Math.abs(b - k) < Math.abs(a - k) ? b : a) : k;
      inspect.forEach((a, i) => { const zc = [MZ + 11, MZ + 11, MZ - 11, MZ - 11][i]; const tz = clamp(targetZ(zc), zc - 4, zc + 4); a.aim(0, BY + 2.4 + Math.sin(t * 0 + i) * 0, tz); });
      // Ensamblaje: la ventana y el teléfono llegan por etapas
      const a1 = smoother(0.44, 0.485, p), a2 = smoother(0.465, 0.505, p), a3 = smooth(0.48, 0.515, p);
      winG.position.set(0, 2.9 + (1 - a1) * 5, (1 - a1) * -8 + 0.0); winG.rotation.set(0, (1 - a1) * 1.4, 0);
      winG.visible = a1 > 0.001; phoneG.visible = a2 > 0.001;
      phoneG.position.set(-3.2 + (1 - a2) * -4, 2.2 + (1 - a2) * 6, 1.8 + (1 - a2) * 5); phoneG.rotation.set(0, 0.18 + (1 - a2) * -1.0, (1 - a2) * 0.6);
      prev.update(a3);
      arms.forEach((a, i) => {
        const tx = [winG.position.x - 2.5, winG.position.x + 2.5, phoneG.position.x, phoneG.position.x + 0.5][i];
        const ty = [winG.position.y + 1, winG.position.y + 1, phoneG.position.y + 1, phoneG.position.y][i] + AY;
        const tz = [winG.position.z, winG.position.z, phoneG.position.z, phoneG.position.z][i] + AZ;
        const idle = 1 - smooth(0.44, 0.5, p);
        const rest = [[-2.5, 6, AZ + 2], [2.5, 6, AZ + 2], [-2, 5, AZ - 2], [2, 5, AZ - 2]][i];
        a.aim(tx + (rest[0] - tx) * (1 - a1 * (i < 2 ? 1 : a2)) * 0, Math.max(3, ty), tz);
      });
      // Luces reales
      const live = smooth(0.32, 0.355, p) * (1 - smooth(0.52, 0.55, p));
      const cz = clamp(s.camera.position.z - 6, ZB + 8, ZF - 6);
      L.key.position.set(0, 18, cz + 3); L.key.target.position.set(0, 1.5, cz - 10);
      L.key.color.set(0xf1f1f4); L.key.angle = 1.0; L.key.penumbra = 1; L.key.intensity = 300 * live;
      const inChamber = smooth(MZ + 20, MZ + 6, s.camera.position.z) * (1 - smooth(MZ - 6, MZ - 20, s.camera.position.z));
      L.acc1.position.set(0, 6, MZ); L.acc1.color.set(0xdcd6f2); L.acc1.distance = 40; L.acc1.intensity = (20 + 60 * compile) * live;
      L.acc2.position.set(0, 16, AZ); L.acc2.color.set(0xf1f1f4); L.acc2.distance = 50; L.acc2.intensity = 120 * live * smooth(0.44, 0.5, p);
    },
  };
}
