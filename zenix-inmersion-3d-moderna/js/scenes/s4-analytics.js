import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PAL, clamp, lerp, smooth, smoother, texBox, texPlane, texCyl, canvasTexture, labelPlane } from '../util.js';
import { text3D, polishedFloor } from '../parts.js';

// ESCENA 4 · ANÁLISIS Y RENDIMIENTO — Un observatorio de datos luminoso y sereno: una sala circular con óculo cenital y, en el
// centro, los gráficos como esculturas físicas (columnas de cristal, cinta de aluminio, anillo seccionado) sobre un pedestal.
// Todos los valores son de demostración y están rotulados como tales.
export function buildAnalytics(ctx) {
  const { M, Q, col, font, textures } = ctx;
  const g = new THREE.Group(); g.name = 'analytics';
  const sh = Q.shadows;
  const CX = 0, CZ = -348, R = 34, H = 18;
  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh && o.cast !== false; m.receiveShadow = sh; g.add(m); return m;
  };
  const tex = (t) => { textures.push(t.tex); return t.tex; };
  const sans = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ---------- Sala: suelo de piedra satinada, muro curvo con aberturas (entrada y salida), techo con óculo
  const stone = M.floorMatte.clone(); stone.color.set(0x3b3b43); stone.roughness = 0.38; stone.clearcoat = 0;
  polishedFloor(ctx, g, { w: R * 2 + 4, h: R * 2 + 30, z: CZ, mat: M.floorPolished.clone(), opacity: 0.0, density: 0.1 });   // espejo parcial (alta); el suelo visible es la piedra
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 72), stone); floor.rotation.x = -Math.PI / 2; floor.position.set(CX, 0.01, CZ); floor.receiveShadow = sh; g.add(floor);
  const gap = 0.22;                                      // semiancho angular de cada abertura
  const wallMat = M.concreteDark.clone(); wallMat.color.set(0x3a3a42); wallMat.side = THREE.BackSide;
  for (const [a0, len] of [[gap, Math.PI - 2 * gap], [Math.PI + gap, Math.PI - 2 * gap]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 48, 1, true, a0, len), wallMat); w.position.set(CX, H / 2, CZ); w.receiveShadow = sh; g.add(w);
  }
  // listones verticales de aluminio en el muro (ritmo, escala y reflejos)
  const nSl = 56, slGeo = texBox(0.5, H - 2, 0.7, 0.3), slats = new THREE.InstancedMesh(slGeo, M.graphite, nSl);
  const d = new THREE.Object3D(); let k = 0;
  for (let i = 0; i < nSl; i++) {
    const a = (i / nSl) * Math.PI * 2; if (Math.abs(Math.sin(a / 2 + (a > Math.PI ? 0 : 0))) < 0.05) continue;
    const ad = Math.min(Math.abs(a), Math.abs(a - Math.PI), Math.abs(a - 2 * Math.PI)); if (ad < gap + 0.04) continue;
    d.position.set(CX + Math.sin(a) * (R - 0.5), (H - 2) / 2 + 0.2, CZ + Math.cos(a) * (R - 0.5)); d.rotation.y = a + Math.PI; d.updateMatrix(); slats.setMatrixAt(k++, d.matrix);
  }
  slats.count = k; slats.castShadow = sh; slats.receiveShadow = sh; g.add(slats);
  // techo con óculo y anillo de luz difusa
  const ceil = new THREE.Mesh(new THREE.RingGeometry(12, R + 1, 64), M.graphiteDark); ceil.rotation.x = Math.PI / 2; ceil.position.set(CX, H, CZ); g.add(ceil);
  const ringLight = new THREE.Mesh(new THREE.RingGeometry(9.5, 12, 64), M.glowSoft.clone()); ringLight.material.color.multiplyScalar(0.85); ringLight.rotation.x = Math.PI / 2; ringLight.position.set(CX, H - 0.05, CZ); g.add(ringLight);
  const coffer = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 2.5, 64, 1, true), M.graphite); coffer.position.set(CX, H + 1.2, CZ); g.add(coffer);
  // corredores de entrada y salida
  for (const [zc, dir] of [[CZ + R + 5.5, 1], [CZ - R - 5.5, -1]]) {
    for (const s of [-1, 1]) { const w = add(texBox(1.2, 14, 12, 0.2), M.graphiteDark, s * 7.4, 7, zc); col.box(w, 'dwall' + zc + s, 0.05); }
    add(texBox(15.6, 1.2, 12, 0.2), M.graphiteDark, 0, 14.6, zc, { cast: false });
    const f = new THREE.Mesh(texPlane(14, 12, 0.15), M.floorPolished); f.rotation.x = -Math.PI / 2; f.position.set(0, 0.02, zc); f.receiveShadow = sh; g.add(f);
  }

  // ---------- Pedestal central
  const pedMat = M.concrete.clone(); pedMat.color.set(0x4a4a53); pedMat.roughness = 0.5;
  const ped = add(new THREE.CylinderGeometry(17, 17.4, 0.9, 72), pedMat, CX, 0.45, CZ);
  const pedStep = add(new THREE.CylinderGeometry(19.6, 20, 0.4, 72), M.graphiteDark, CX, 0.2, CZ);
  const pedRim = add(new THREE.TorusGeometry(17.05, 0.07, 6, 96), M.glowSoft.clone(), CX, 0.92, CZ, { cast: false });
  pedRim.rotation.x = Math.PI / 2; pedRim.material.color.multiplyScalar(0.55);
  col.boxRaw([CX - 19.8, 0, CZ - 19.8], [CX + 19.8, 0.5, CZ + 19.8], 'pedstep');
  const TOP = 0.9;

  // Rótulo de demostración grabado en el pedestal (legible al entrar)
  const demo = labelPlane('DATOS DE DEMOSTRACIÓN', 11, { w: 1024, h: 96, size: 54, color: '#e9e8ef', font: sans, weight: 600, spacing: 8 });
  demo.rotation.x = -Math.PI / 2; demo.position.set(CX, TOP + 0.02, CZ + 12.6); g.add(demo);

  // ---------- Gráfico 1 · Columnas de cristal esmerilado (izquierda)
  const place = (grp, th, r, y = TOP) => { grp.position.set(CX + Math.sin(th) * r, y, CZ + Math.cos(th) * r); grp.rotation.y = th; };
  const barsG = new THREE.Group(); place(barsG, -1.55, 11); g.add(barsG);
  const baseA = new THREE.Mesh(new RoundedBoxGeometry(9.6, 0.4, 4.2, 2, 0.1), M.graphite); baseA.position.y = 0.2; baseA.castShadow = sh; baseA.receiveShadow = sh; barsG.add(baseA);
  const vals = [3.1, 4.2, 3.8, 5.6, 6.4, 5.9, 7.6, 8.8], NB = vals.length;
  const barGeo = new RoundedBoxGeometry(0.78, 1, 0.78, 2, 0.08);
  const bars = new THREE.InstancedMesh(barGeo, M.glassFrost, NB), hi = new THREE.Mesh(barGeo, M.glassViolet);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.82, 0.08, 0.82), M.aluminum, NB);
  bars.castShadow = sh; barsG.add(bars, caps, hi);
  const months = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A'];
  vals.forEach((v, i) => {
    const l = labelPlane(months[i], 0.6, { w: 128, h: 128, size: 80, color: '#cfcfd8', font: sans, weight: 600, spacing: 0 }); l.rotation.x = -Math.PI / 2; l.position.set(-3.6 + i * 1.03, 0.41, 1.55); barsG.add(l);
  });
  const barTitle = labelPlane('SESIONES POR MES · DEMO', 6.4, { w: 1024, h: 128, size: 54, color: '#e9e8ef', font: sans, weight: 600, spacing: 4, align: 'left' });
  barTitle.rotation.x = -Math.PI / 2; barTitle.position.set(-1.3, 0.41, 1.95); barsG.add(barTitle);
  // guías de valor (líneas finas de aluminio al fondo)
  for (let i = 1; i <= 3; i++) { const gl = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.03, 0.03), M.aluminum); gl.position.set(0, 0.4 + i * 2.8, -1.7); barsG.add(gl); }

  // ---------- Gráfico 2 · Cinta de aluminio pulido (curva de rendimiento) con panel de cristal al fondo
  const lineG = new THREE.Group(); place(lineG, -2.65, 11); lineG.scale.setScalar(0.8); g.add(lineG);
  const panelPlate = new THREE.Mesh(new RoundedBoxGeometry(14.4, 0.4, 4.8, 2, 0.1), M.graphite); panelPlate.position.y = 0.2; panelPlate.castShadow = sh; panelPlate.receiveShadow = sh; lineG.add(panelPlate);
  const back = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 0.12), M.glass); back.position.set(0, 4.4, -2.1); back.renderOrder = 3; lineG.add(back);
  for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 8, 0.2), M.aluminum); post.position.set(s * 7, 4.4, -2.1); lineG.add(post); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(14.16, 0.16, 0.2), M.aluminum); top.position.set(0, 8.4, -2.1); lineG.add(top);
  const gridT = canvasTexture(1024, 600, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { const y = 60 + i * 120; c.beginPath(); c.moveTo(80, y); c.lineTo(w - 30, y); c.stroke(); }
    c.fillStyle = 'rgba(235,234,242,.8)'; c.font = `500 26px ${sans}`; c.textAlign = 'right';
    ['100', '75', '50', '25', '0'].forEach((t, i) => c.fillText(t, 62, 70 + i * 120));
    c.textAlign = 'center'; ['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'].forEach((t, i) => c.fillText(t, 130 + i * 140, 570));
    c.textAlign = 'left'; c.fillStyle = '#f1f0f7'; c.font = `600 34px ${sans}`; c.fillText('RENDIMIENTO · DEMO', 90, 30);
  }, { aniso: 8 }); tex(gridT);
  const gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 7.85), new THREE.MeshBasicMaterial({ map: gridT.tex, transparent: true, depthWrite: false, toneMapped: false }));
  gridPlane.position.set(0, 4.4, -2.0); lineG.add(gridPlane);
  const pts = [18, 26, 24, 38, 45, 41, 58, 66, 61, 76, 84, 92].map((v, i, a) => new THREE.Vector3(-6 + (i / (a.length - 1)) * 12, 0.9 + (v / 100) * 6.6, -1.6));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const ribbonGeo = new THREE.TubeGeometry(curve, 160, 0.14, 8, false);
  const ribbon = new THREE.Mesh(ribbonGeo, M.aluminum); ribbon.castShadow = sh; lineG.add(ribbon);
  const rTotal = ribbonGeo.index.count;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), M.violetMetal); head.castShadow = sh; lineG.add(head);
  const headGlow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M.glowViolet.clone()); lineG.add(headGlow);
  const drop = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6), M.aluminum, pts.length);
  lineG.add(drop);

  // ---------- Gráfico 3 · Anillo seccionado (distribución) — derecha
  const donutG = new THREE.Group(); place(donutG, -3.85, 11, TOP + 0.4); g.add(donutG);
  const dBase = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.6, 0.4, 48), M.graphite); dBase.position.y = -0.2; dBase.castShadow = sh; dBase.receiveShadow = sh; donutG.add(dBase);
  const segs = [[0.0, 0.58, M.glassViolet], [0.58, 0.84, M.glassFrost], [0.84, 1.0, M.graphiteDark]];
  const segMeshes = segs.map(([a, b, mat], i) => {
    const shp = new THREE.Shape(); const gapA = 0.025, a0 = a * Math.PI * 2 + gapA, a1 = b * Math.PI * 2 - gapA;
    shp.absarc(0, 0, 4.7, a0, a1, false); shp.absarc(0, 0, 2.7, a1, a0, true); shp.closePath();
    const geo = new THREE.ExtrudeGeometry(shp, { depth: 1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 40 });
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.castShadow = sh; donutG.add(m); return m;
  });
  const dTitle = labelPlane('DISPOSITIVOS · DEMO', 5.6, { w: 1024, h: 128, size: 54, color: '#e9e8ef', font: sans, weight: 600, spacing: 4 });
  dTitle.rotation.x = -Math.PI / 2; dTitle.position.set(0, 0.02, 5.2); donutG.add(dTitle);
  const dCenter = labelPlane('58 %', 2.8, { w: 512, h: 256, size: 150, color: '#f4f3f9', font: sans, weight: 700, spacing: 0 }); dCenter.rotation.x = -Math.PI / 2; dCenter.position.y = 0.05; donutG.add(dCenter);
  [['Móvil', '#cdb8ff', 0], ['Escritorio', '#f1f0f7', 1], ['Tablet', '#8d8c9f', 2]].forEach(([t, c_, i]) => {
    const l = labelPlane(t, 1.9, { w: 512, h: 128, size: 66, color: c_, font: sans, weight: 600, spacing: 0, align: 'left' }); l.rotation.x = -Math.PI / 2; l.position.set(-3.2 + i * 2.7, 0.02, 6.1); donutG.add(l);
  });

  // ---------- KPI: tres placas de cristal verticales al fondo (cifras con conteo ascendente)
  const kpis = [['USUARIOS ACTIVOS', 1284, '', '+12 %'], ['SESIONES', 3906, '', '+8 %'], ['LATENCIA MEDIA', 84, ' ms', '−6 %']];
  const kpiObjs = kpis.map(([title, target, unit, delta], i) => {
    const a = -0.3 - i * 0.42;
    const grp = new THREE.Group(); place(grp, a, 14.5); g.add(grp);
    const frame = new THREE.Mesh(new RoundedBoxGeometry(4.8, 6.4, 0.3, 3, 0.1), M.graphiteDark); frame.position.y = 3.5; frame.castShadow = sh; grp.add(frame);
    const foot = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.24, 1.6, 2, 0.08), M.aluminum); foot.position.set(0, 0.12, -0.2); grp.add(foot);
    const api = canvasTexture(768, 1024, () => {}, { aniso: 8 }); tex(api);
    const draw = (val) => {
      const c = api.ctx, w = 768, h = 1024;
      c.fillStyle = '#0d0d11'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#8d8c9f'; c.font = `600 38px ${sans}`; c.textAlign = 'left'; c.fillText(title, 56, 96);
      c.fillStyle = '#f4f3f9'; c.font = `700 ${unit ? 190 : 170}px ${sans}`; const txt = (title === 'LATENCIA MEDIA' ? String(val) : val.toLocaleString('es-AR')) + unit; c.fillText(txt, 50, 380);
      c.fillStyle = '#7fd6a6'; c.font = `600 44px ${sans}`; c.fillText(delta + ' vs. mes anterior', 56, 470);
      // sparkline
      c.strokeStyle = '#8b5cff'; c.lineWidth = 7; c.beginPath();
      for (let j = 0; j < 24; j++) { const x = 56 + j * 28, y = 800 - (0.35 + 0.5 * Math.abs(Math.sin(j * 0.55 + i * 1.3)) + j * 0.012) * 240; j ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      c.fillStyle = '#6f6e80'; c.font = `500 30px ${sans}`; c.fillText('últimos 30 días', 56, 900);
      c.strokeStyle = '#8d8c9f'; c.lineWidth = 2; c.strokeRect(56, 940, 106, 46); c.fillStyle = '#cfcfd8'; c.font = `700 26px ${sans}`; c.fillText('DEMO', 78, 975);
      api.tex.needsUpdate = true;
    };
    draw(0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5.85), new THREE.MeshBasicMaterial({ map: api.tex, toneMapped: false })); scr.position.set(0, 3.5, 0.17); grp.add(scr);
    return { draw, target, last: -1 };
  });

  // ---------- Medidores de recursos: cuatro cilindros de cristal con nivel (CPU, memoria, disco, red)
  const gauges = [['CPU', 0.46], ['MEMORIA', 0.62], ['DISCO', 0.38], ['RED', 0.74]].map(([name, v], i) => {
    const grp = new THREE.Group(); place(grp, -4.7 - i * 0.42, 15.5); g.add(grp);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.3, 28), M.graphite); base.position.y = 0.15; grp.add(base);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6.4, 32, 1, true), M.glass); tube.position.y = 3.5; tube.renderOrder = 3; grp.add(tube);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1, 28), name === 'RED' ? M.glassViolet : M.glassFrost); fill.position.y = 0.4; grp.add(fill);
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.25, 28), M.aluminum); capT.position.y = 6.8; grp.add(capT);
    const lb = labelPlane(name + ' · DEMO', 2.6, { w: 512, h: 96, size: 46, color: '#e0dfe8', font: sans, weight: 600, spacing: 2 }); lb.position.set(0, 7.5, 0); grp.add(lb);
    return { fill, v };
  });

  // Haz de luz cenital suave desde el óculo (conserva la sensación de espacio sin neón)
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uI: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uI; void main(){ float f = pow(vUv.y, 1.4) * 0.5; gl_FragColor = vec4(vec3(.9,.88,1.) * f * uI, f * uI * .35);
      #include <tonemapping_fragment>
      #include <colorspace_fragment> }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(11, 15, H - 1, 40, 1, true), shaftMat); shaft.position.set(CX, (H - 1) / 2 + 0.5, CZ); g.add(shaft);

  return {
    group: g, range: [0.48, 0.72],
    update(s) {
      const p = s.p, L = s.L;
      // Construcción de los gráficos en el orden en que la cámara los recorre (reversible)
      const rb = (i) => smoother(0.585 + i * 0.005, 0.625 + i * 0.005, p);
      vals.forEach((v, i) => {
        const h = Math.max(0.0001, v * rb(i));
        d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.position.set(-3.6 + i * 1.03, 0.4 + h / 2, 0); d.updateMatrix(); bars.setMatrixAt(i, d.matrix);
        d.scale.set(1, 1, 1); d.position.y = 0.4 + h; d.updateMatrix(); caps.setMatrixAt(i, d.matrix);
      });
      caps.instanceMatrix.needsUpdate = true;
      // última columna (acento violeta) separada para destacarla
      const hl = vals[NB - 1] * rb(NB - 1);
      hi.scale.set(1, Math.max(0.0001, hl), 1); hi.position.set(-3.6 + (NB - 1) * 1.03, 0.4 + hl / 2, 0);
      bars.setMatrixAt(NB - 1, new THREE.Matrix4().makeScale(0, 0, 0)); bars.instanceMatrix.needsUpdate = true;
      const rl = smoother(0.62, 0.665, p);
      ribbonGeo.setDrawRange(0, Math.max(6, Math.floor(rl * rTotal / 6) * 6));
      const hp = curve.getPoint(Math.max(0.001, rl)); head.position.copy(hp); headGlow.position.copy(hp); head.visible = headGlow.visible = rl > 0.01;
      pts.forEach((pt, i) => {
        const on = rl >= i / (pts.length - 1) - 0.001; const hh = Math.max(0.0001, (pt.y - 0.4) * (on ? 1 : 0));
        d.rotation.set(0, 0, 0); d.scale.set(1, hh, 1); d.position.set(pt.x, 0.4 + hh / 2, pt.z); d.updateMatrix(); drop.setMatrixAt(i, d.matrix);
      });
      drop.instanceMatrix.needsUpdate = true; d.scale.set(1, 1, 1);
      segMeshes.forEach((m, i) => { const r = smoother(0.655 + i * 0.01, 0.695 + i * 0.01, p); m.scale.z = Math.max(0.0001, [1.7, 1.3, 1.0][i] * r); });
      // KPI: conteo ascendente
      kpiObjs.forEach((k, i) => {
        const v = Math.round(k.target * smoother(0.552 + i * 0.012, 0.605 + i * 0.012, p));
        if (v !== k.last) { k.last = v; k.draw(v); }
      });
      gauges.forEach((gg, i) => { const lv = Math.max(0.001, gg.v * 6 * smoother(0.545 + i * 0.008, 0.6 + i * 0.008, p)); gg.fill.scale.y = lv; gg.fill.position.y = 0.4 + lv / 2; });
      shaftMat.uniforms.uI.value = 0.3;
      // Luces reales: el óculo ilumina el pedestal; relleno suave desde la cámara
      const live = smooth(0.5, 0.53, p) * (1 - smooth(0.69, 0.72, p));
      L.key.position.set(CX, H - 2, CZ); L.key.target.position.set(CX, 0, CZ - 1);
      L.key.color.set(0xf4f2ff); L.key.angle = 0.95; L.key.penumbra = 1; L.key.intensity = 420 * live;
      L.acc1.position.set(s.camera.position.x * 0.5, 9, s.camera.position.z + 4); L.acc1.color.set(0xe9e6ff); L.acc1.distance = 50; L.acc1.intensity = 70 * live;
      L.acc2.position.set(CX, 5, CZ - 22); L.acc2.color.set(0x9a76ff); L.acc2.distance = 50; L.acc2.intensity = 90 * live;
    },
  };
}
