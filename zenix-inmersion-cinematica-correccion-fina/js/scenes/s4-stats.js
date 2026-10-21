import * as THREE from 'three';
import { gridMaterial } from '../materials.js';
import { PAL, rng, smooth, clamp, lerp, canvasTexture, labelPlane, hexRingGeometry, neon, FX } from '../util.js';

// ESCENA 4 · Estadísticas y rendimiento: gráficos construidos en el espacio (barras 3D, curva de rendimiento,
// indicadores circulares y monitores de recursos). TODOS los números son de demostración y están rotulados como tales.
export function buildStats(ctx) {
  const { M, Q, col, textures } = ctx;
  const g = new THREE.Group();
  g.name = 'stats';
  const low = Q.detail === 'low';
  const FLOOR = -4, CZ = -305;

  // Plataforma hexagonal de cristal oscuro con anillos concéntricos luminosos y pasarelas de entrada/salida
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(33, 34, 1.0, 6), M.floor);
  plat.rotation.y = Math.PI / 6; plat.position.set(0, FLOOR - 0.5, CZ); plat.receiveShadow = Q.shadows;
  g.add(plat);
  const pg = new THREE.Mesh(new THREE.CircleGeometry(33, 6), gridMaterial({ color: PAL.violet, cell: 3, intensity: 1.0, alpha: 0.8 }));
  pg.rotation.x = -Math.PI / 2; pg.rotation.z = Math.PI / 6; pg.position.set(0, FLOOR + 0.012, CZ); g.add(pg);
  [10, 18, 26, 31.5].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 96), i % 2 ? M.cyanGlow : M.violetGlow);
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, FLOOR + 0.02, CZ); g.add(ring);
  });
  const bridge = (z, len) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(9, 0.7, len), M.struct); b.position.set(0, FLOOR - 0.35, z); g.add(b);
    [-4.5, 4.5].forEach((x) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, len), M.cyanGlow); s.position.set(x, FLOOR + 0.03, z); g.add(s); });
  };
  bridge(-272, 14); bridge(-346, 14);
  col.boxRaw([-34, FLOOR - 1, -340], [34, FLOOR, -270], 'stats-floor');

  // Estructura de la arena: pilares en los vértices y aro superior
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (k * Math.PI) / 3;
    const x = Math.sin(a) * 33, z = CZ + Math.cos(a) * 33;
    const pil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 30, 2.2), M.struct);
    pil.position.set(x, FLOOR + 14, z); g.add(pil);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.14, 30, 0.14), k % 2 ? M.cyanGlow : M.violetGlow);
    st.position.set(x * 0.955, FLOOR + 14, CZ + (z - CZ) * 0.955); g.add(st);
    col.boxRaw([x - 1.3, FLOOR, z - 1.3], [x + 1.3, FLOOR + 30, z + 1.3], 'arena-pillar-' + k);
  }
  const halo = new THREE.Mesh(new THREE.TorusGeometry(33, 0.28, 8, 6), M.electricGlow);
  halo.rotation.set(Math.PI / 2, 0, Math.PI / 6); halo.position.set(0, FLOOR + 27, CZ); g.add(halo);

  // --- Paneles con rejilla y rótulos (canvas) ---
  const panelTex = (title, sub, xl, yl) => {
    const t = canvasTexture(1024, 704, (c, W, H) => {
      c.clearRect(0, 0, W, H);
      const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(24,16,70,.62)'); gr.addColorStop(1, 'rgba(8,5,26,.55)');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      const L = 84, R = 28, T = 100, B = 78;
      c.strokeStyle = 'rgba(139,77,255,.35)'; c.lineWidth = 1.5;
      for (let i = 0; i <= 4; i++) { const y = T + ((H - T - B) * i) / 4; c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); }
      c.font = '500 22px ui-monospace, Menlo, Consolas, monospace'; c.fillStyle = '#9d95cf'; c.textAlign = 'right';
      yl.forEach((v, i) => c.fillText(v, L - 14, H - B - ((H - T - B) * i) / (yl.length - 1) + 7));
      c.textAlign = 'center';
      xl.forEach((v, i) => c.fillText(v, L + ((W - L - R) * (i + 0.5)) / xl.length, H - 34));
      c.textAlign = 'left'; c.font = '700 34px ui-sans-serif, system-ui, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(title, 30, 52);
      c.font = '600 19px ui-monospace, Menlo, Consolas, monospace'; c.fillStyle = '#22d3ee'; c.fillText(sub, 32, 82);
      c.strokeStyle = '#22d3ee'; c.globalAlpha = .9; c.lineWidth = 2; c.strokeRect(W - 128, 28, 100, 36); c.globalAlpha = 1;
      c.font = '700 19px ui-monospace, Menlo, monospace'; c.textAlign = 'center'; c.fillText('DEMO', W - 78, 52);
    });
    textures.push(t.tex);
    return t.tex;
  };
  const PW = 13.4, PH = 9.2;
  const chartBase = (x, rotY, tex) => {
    const grp = new THREE.Group(); grp.position.set(x, FLOOR, CZ + 5); grp.rotation.y = rotY;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.4, 7), M.struct); plate.position.set(0, 0.2, 0); grp.add(plate);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.1, 0.06, 0.1), M.cyanGlow); edge.position.set(0, 0.42, 3.5); grp.add(edge);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    panel.position.set(0, 0.4 + PH / 2, -3.0); grp.add(panel);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW, PH)), new THREE.LineBasicMaterial({ color: new THREE.Color(PAL.violet).multiplyScalar(1.8 * FX.k), toneMapped: false }));
    frame.position.copy(panel.position); grp.add(frame);
    g.add(grp);
    return grp;
  };

  // A · Gráfico de barras 3D (izquierda)
  const barsGrp = chartBase(-15.5, 0.5, panelTex('TRÁFICO MENSUAL', 'visitas · datos de demostración', ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O'], ['0', '2k', '4k', '6k', '8k']));
  const NB = 10, heights = [2.1, 3.0, 2.6, 4.1, 3.7, 5.0, 4.5, 5.9, 5.3, 6.9];
  const barGeo = new THREE.BoxGeometry(0.86, 1, 0.86);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.75, roughness: 0.22, emissive: 0x2a1080, emissiveIntensity: 0.9 });
  const bars = new THREE.InstancedMesh(barGeo, barMat, NB); bars.castShadow = Q.shadows;
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NB);
  const tmpC = new THREE.Color();
  for (let i = 0; i < NB; i++) {
    bars.setColorAt(i, tmpC.set(PAL.deep).lerp(new THREE.Color(PAL.cyan), i / (NB - 1) * 0.8 + 0.1));
    caps.setColorAt(i, tmpC.set(PAL.ice).multiplyScalar(2.0 * FX.k));
  }
  bars.position.set(0, 0.4, 0); caps.position.set(0, 0.4, 0);
  barsGrp.add(bars, caps);
  const dm = new THREE.Object3D();
  col.boxRaw([-24, FLOOR, CZ - 3], [-7, FLOOR + 11, CZ + 11], 'bars-chart');

  // B · Curva de rendimiento (derecha)
  const lineGrp = chartBase(15.5, -0.5, panelTex('SESIONES POR HORA', 'rendimiento · datos de demostración', ['00', '04', '08', '12', '16', '20'], ['0', '250', '500', '750', '1k']));
  const NP = 56, pts = [];
  for (let i = 0; i < NP; i++) {
    const t = i / (NP - 1);
    const y = 1.3 + 3.4 * Math.pow(t, 0.85) + 0.7 * Math.sin(i * 0.5) + 0.45 * Math.sin(i * 0.19 + 1);
    pts.push(new THREE.Vector3(-5.6 + t * 11.2, 0.4 + y * 0.9, -2.6));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const TS = 220, RS = 6;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, TS, 0.07, RS, false), M.cyanGlow);
  lineGrp.add(tube);
  const idxTotal = tube.geometry.index.count;
  // Área bajo la curva con degradado y corte por revelado
  const areaShape = new THREE.Shape();
  const samp = curve.getPoints(160);
  areaShape.moveTo(samp[0].x, 0.4);
  samp.forEach((p) => areaShape.lineTo(p.x, p.y));
  areaShape.lineTo(samp[samp.length - 1].x, 0.4); areaShape.closePath();
  const areaMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    uniforms: { uX: { value: -5.6 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform float uX; void main(){ if (vP.x > uX) discard; float a = clamp((vP.y - .4) / 5., 0., 1.); gl_FragColor = vec4(mix(vec3(.5,.25,1.), vec3(.1,.8,1.), a), .10 + .30 * a); }`,
  });
  const area = new THREE.Mesh(new THREE.ShapeGeometry(areaShape, 8), areaMat);
  area.position.z = -2.62; lineGrp.add(area);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.whiteGlow); lineGrp.add(head);
  const headHalo = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 24), M.cyanGlow); lineGrp.add(headHalo);
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 10, 8), M.iceGlow, 14);
  const dotPos = [];
  for (let i = 0; i < 14; i++) { const p = curve.getPoint((i + 1) / 15); dotPos.push(p); dm.position.copy(p); dm.scale.setScalar(1); dm.updateMatrix(); dots.setMatrixAt(i, dm.matrix); }
  lineGrp.add(dots);
  col.boxRaw([7, FLOOR, CZ - 3], [24, FLOOR + 11, CZ + 11], 'line-chart');

  // C · Indicadores circulares (anillos 3D con volumen)
  const gaugeMat = (value) => new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uValue: { value: 0 }, uA: { value: new THREE.Color(PAL.violet) }, uB: { value: new THREE.Color(PAL.cyan) }, uMax: { value: value } },
    vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalMatrix * normal; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec3 vP; varying vec3 vN; uniform float uValue; uniform vec3 uA, uB;
      void main(){
        float deg = degrees(atan(vP.y, vP.x));
        float d = mod(225. - deg, 360.) / 270.;
        if (d > 1.) discard;
        float lit = step(d, uValue);
        float sh = .65 + .5 * pow(abs(normalize(vN).z), .6);
        vec3 c = mix(uA, uB, d) * ${(2.1 * FX.k).toFixed(2)} * sh;
        vec3 dimc = vec3(.12,.09,.3) * sh;
        gl_FragColor = vec4(mix(dimc, c, lit), 1.);
      }`,
  });
  const gauges = [];
  const makeGauge = (x, y, z, ry, name, unit, target, shown, fmt) => {
    const gr = new THREE.Group(); gr.position.set(x, y, z); gr.rotation.y = ry;
    const gm = gaugeMat(target);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.22, 12, 90), gm); gr.add(arc);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(2.72, 0.06, 8, 90), M.silver); gr.add(bez);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.025, 6, 90), M.violetGlow); gr.add(inner);
    const back = new THREE.Mesh(new THREE.CircleGeometry(2.08, 48), new THREE.MeshBasicMaterial({ color: 0x07051a, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false })); back.position.z = -0.05; gr.add(back);
    const lab = canvasTexture(512, 512, (c, W, H, v = 0) => {
      c.clearRect(0, 0, W, H); c.textAlign = 'center';
      c.font = '800 112px ui-sans-serif, system-ui, sans-serif'; c.fillStyle = '#ffffff'; c.fillText(fmt(v), W / 2, 250);
      c.font = '600 34px ui-monospace, Menlo, Consolas, monospace'; c.fillStyle = '#22d3ee'; c.fillText(unit, W / 2, 304);
      c.font = '700 30px ui-sans-serif, system-ui, sans-serif'; c.fillStyle = '#c9c3ec'; c.fillText(name, W / 2, 362);
      c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.strokeRect(W / 2 - 52, 392, 104, 36);
      c.font = '700 22px ui-monospace, Menlo, monospace'; c.fillStyle = '#22d3ee'; c.fillText('DEMO', W / 2, 418);
    });
    textures.push(lab.tex);
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false, toneMapped: false })); lp.position.z = 0.02; gr.add(lp);
    const tickG = new THREE.BoxGeometry(0.05, 0.22, 0.05);
    const ticks = new THREE.InstancedMesh(tickG, M.purpleGlow, 28);
    for (let i = 0; i < 28; i++) {
      const a = ((225 - (270 * i) / 27) * Math.PI) / 180;
      dm.position.set(Math.cos(a) * 2.95, Math.sin(a) * 2.95, 0); dm.rotation.set(0, 0, a - Math.PI / 2); dm.scale.setScalar(1); dm.updateMatrix(); ticks.setMatrixAt(i, dm.matrix);
    }
    dm.rotation.set(0, 0, 0);
    gr.add(ticks);
    g.add(gr);
    col.sphere([x, y, z], 3.3, 'gauge-' + name);
    gauges.push({ gm, lab, target, shown, fmt, last: -1 });
  };
  makeGauge(-9.5, 2.0, -326, 0.6, 'USUARIOS ACTIVOS', 'en línea', 0.72, 1284, (v) => Math.round(v).toLocaleString('es-AR'));
  makeGauge(9.5, 2.0, -330, -0.6, 'SESIONES', 'hoy', 0.58, 3906, (v) => Math.round(v).toLocaleString('es-AR'));
  makeGauge(0, 8.2, -334, 0, 'LATENCIA', 'ms promedio', 0.83, 84, (v) => String(Math.round(v)));
  gauges[0].val = 0.72; gauges[1].val = 0.58; gauges[2].val = 0.83;

  // D · Monitores de recursos: bancos de barras (CPU, memoria, red, disco)
  const NBANK = low ? 14 : 22;
  const eqMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const banks = [-1, 1].map((s, bi) => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1, 0.5), eqMat, NBANK);
    m.frustumCulled = false; g.add(m);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, NBANK * 0.75 + 0.6), M.struct);
    base.position.set(s * 5.3, FLOOR + 0.09, -326); g.add(base);
    const tag = labelPlane(bi ? 'RED · DISCO  (DEMO)' : 'CPU · MEMORIA  (DEMO)', 4.4, { w: 512, h: 96, size: 38, color: '#9be8ff', font: 'ui-monospace, Menlo, Consolas, monospace', spacing: 2 });
    tag.position.set(s * 5.3, FLOOR + 3.4, -326 + NBANK * 0.375 + 0.4); tag.rotation.y = -s * 0.9; g.add(tag);
    col.boxRaw([s * 5.3 - 0.9, FLOOR, -326 - NBANK * 0.375 - 0.5], [s * 5.3 + 0.9, FLOOR + 2.6, -326 + NBANK * 0.375 + 0.5], 'eq-' + bi);
    return { m, side: s };
  });

  // Rótulo grande de aclaración
  const demo = canvasTexture(1024, 190, (c, W, H) => {
    c.clearRect(0, 0, W, H); c.textAlign = 'center';
    c.font = '800 62px ui-sans-serif, system-ui, sans-serif'; c.fillStyle = '#ffffff'; c.fillText('DATOS DE DEMOSTRACIÓN', W / 2, 78);
    c.font = '600 29px ui-monospace, Menlo, Consolas, monospace'; c.fillStyle = '#22d3ee'; c.fillText('Valores ilustrativos · no son resultados de Zenix AR', W / 2, 132);
  });
  textures.push(demo.tex);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.4), new THREE.MeshBasicMaterial({ map: demo.tex, transparent: true, depthWrite: false, toneMapped: false }));
  sign.position.set(0, 15.2, -341); g.add(sign);

  // Puerta de salida hacia los sistemas
  const gate = new THREE.Mesh(hexRingGeometry(15, 13.6, 1.4, 0.1), M.struct); gate.position.set(0, 3, -353); g.add(gate);
  const gateGlow = new THREE.Mesh(hexRingGeometry(13.9, 13.4, 1.6, 0), M.cyanGlow); gateGlow.position.set(0, 3, -353); g.add(gateGlow);
  col.ring([0, 3, -353], 13.0, 15.5, 1.8, 'stats-gate');

  const cyanC = new THREE.Color(PAL.cyan).multiplyScalar(2.0 * FX.k), violC = new THREE.Color(PAL.violet).multiplyScalar(2.0 * FX.k), whiteC = new THREE.Color(0xffffff).multiplyScalar(2.4 * FX.k);
  let lastDraw = 0;
  return {
    group: g,
    range: [0.46, 0.76],
    update(st) {
      const p = st.p;
      // Las barras crecen cuando la cámara llega al gráfico
      for (let i = 0; i < NB; i++) {
        const k = smooth(0.545 + i * 0.0035, 0.585 + i * 0.0035, p);
        const h = Math.max(0.001, heights[i] * k);
        dm.position.set((i - (NB - 1) / 2) * 1.2, h / 2, 0); dm.rotation.set(0, 0, 0); dm.scale.set(1, h, 1); dm.updateMatrix(); bars.setMatrixAt(i, dm.matrix);
        dm.position.y = h; dm.scale.set(1, 1, 1); dm.updateMatrix(); caps.setMatrixAt(i, dm.matrix);
      }
      bars.instanceMatrix.needsUpdate = true; caps.instanceMatrix.needsUpdate = true;
      // La curva se dibuja de izquierda a derecha
      const f = smooth(0.592, 0.64, p);
      const segs = Math.floor(f * TS);
      tube.geometry.setDrawRange(0, segs * RS * 6);
      tube.visible = segs > 0;
      const hp = curve.getPoint(clamp(f));
      head.position.copy(hp); headHalo.position.copy(hp); headHalo.position.z += 0.05;
      head.visible = headHalo.visible = f > 0.001 && f < 0.999;
      areaMat.uniforms.uX.value = -5.6 + f * 11.2;
      for (let i = 0; i < 14; i++) { const on = (i + 1) / 15 <= f; dm.position.copy(dotPos[i]); dm.rotation.set(0, 0, 0); dm.scale.setScalar(on ? 1 : 0.0001); dm.updateMatrix(); dots.setMatrixAt(i, dm.matrix); }
      dots.instanceMatrix.needsUpdate = true;
      // Indicadores: el arco y el número suben juntos
      const gk = smooth(0.628, 0.668, p);
      for (const gg of gauges) {
        gg.gm.uniforms.uValue.value = gg.val * gk;
        const q = Math.round(gk * 60);
        if (q !== gg.last) { gg.last = q; gg.lab.redraw(gg.shown * (q / 60)); }
      }
      // Monitoreo de recursos en vivo (activo solo en este capítulo)
      const act = smooth(0.635, 0.67, p);
      banks.forEach(({ m, side }, bi) => {
        for (let i = 0; i < NBANK; i++) {
          const w = 0.5 + 0.5 * Math.sin(st.time * (1.3 + bi * 0.4) + i * 0.7 + bi);
          const w2 = 0.5 + 0.5 * Math.sin(st.time * 0.7 + i * 1.9);
          const h = Math.max(0.001, (0.25 + 1.9 * (w * 0.6 + w2 * 0.4)) * act);
          dm.position.set(side * 5.3, FLOOR + h / 2 + 0.18, -326 + (i - (NBANK - 1) / 2) * 0.75);
          dm.scale.set(1, h, 1); dm.updateMatrix(); m.setMatrixAt(i, dm.matrix);
          tmpC.copy(cyanC).lerp(violC, 1 - clamp(h / 2.1)).lerp(whiteC, Math.max(0, h / 2.1 - 0.85));
          m.setColorAt(i, tmpC);
        }
        m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
      });
    },
  };
}
