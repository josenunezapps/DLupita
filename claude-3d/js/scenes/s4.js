// Escena 4 · Estadísticas: ciudad de barras de energía, línea de crecimiento y dona. TODOS los datos son de demostración.
import * as THREE from 'three';
import { COL, FONT, MONO, glow, rng, clamp, lerp, smooth, ease3, easeIO, liveTex, rr, radialTex, labelSprite, hexFrame } from '../common.js';

const COLS = 9, ROWS = 4, SP = 2.15;
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP'];

function kpiCard(title, big, sub, accent) {
  return liveTex(420, 220, (g, w, h, v) => {
    const val = v == null ? big : v;
    rr(g, 6, 6, w - 12, h - 12, 26);
    g.fillStyle = 'rgba(12,7,30,0.82)';
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = accent;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.font = `600 24px ${MONO}`;
    g.fillText(title, 30, 52);
    g.fillStyle = '#fff';
    g.font = `800 76px ${FONT}`;
    g.fillText(val, 28, 144);
    g.fillStyle = accent;
    g.font = `600 22px ${MONO}`;
    g.fillText(sub, 30, 190);
  }, 8);
}

export default function build(ctx) {
  const { M, tier } = ctx;
  const g = new THREE.Group();
  const r = rng(404);

  // --- plataforma ---------------------------------------------------------
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(19, 19.6, 0.7, 6), M.dark);
  plat.position.y = -0.5;
  plat.rotation.y = Math.PI / 6;
  g.add(plat);
  const platRim = new THREE.Mesh(hexFrame(19.7, 0.16, 0.06, 0), M.gViolet);
  platRim.rotation.x = -Math.PI / 2;
  platRim.position.y = -0.14;
  g.add(platRim);
  const platRim2 = new THREE.Mesh(hexFrame(15.2, 0.1, 0.05, 0), M.gCyan);
  platRim2.rotation.x = -Math.PI / 2;
  platRim2.position.y = -0.13;
  g.add(platRim2);

  // --- barras ---------------------------------------------------------------
  const geo = new THREE.BoxGeometry(1.25, 1, 1.25);
  geo.translate(0, 0.5, 0);
  const n = COLS * ROWS;
  const tAttr = new Float32Array(n);
  const data = [];
  for (let c = 0; c < COLS; c++) {
    for (let rw = 0; rw < ROWS; rw++) {
      const i = c * ROWS + rw;
      const trend = 1.2 + (c / (COLS - 1)) * 6.4;
      const hh = trend * (0.72 + 0.2 * (1 - rw / ROWS)) + r() * 1.8;
      data.push({ x: (c - (COLS - 1) / 2) * SP, z: (rw - (ROWS - 1) / 2) * SP + 1.5, h: hh, delay: c / COLS * 0.6 + r() * 0.12 });
      tAttr[i] = clamp(hh / 9.5);
    }
  }
  geo.setAttribute('aT', new THREE.InstancedBufferAttribute(tAttr, 1));
  const barMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFog: { value: new THREE.Color(COL.bg) } },
    vertexShader: `
      attribute float aT; varying float vY; varying float vT; varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){
        vY = position.y; vT = aT; vP = position;
        vN = normalize(mat3(instanceMatrix) * normal);
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uFog; varying float vY; varying float vT; varying vec3 vN; varying vec3 vW; varying vec3 vP;
      void main(){
        vec3 lo = vec3(.3, .08, .8), hi = vec3(.06, .5, 1.);
        float k = pow(clamp(vY, 0., 1.), .85);
        vec3 c = mix(lo * .5, mix(lo, hi, vT * .9 + vY * .25), k);
        float top = smoothstep(.94, 1., vY) * step(.5, vN.y);
        c += top * vec3(.9, .85, 1.) * 1.3;
        float scan = .5 + .5 * sin(vW.y * 6. - uTime * 3. + vW.x * .4);
        c += scan * .05 * k * hi;
        c *= .26 + vT * .4;
        float ex = smoothstep(.4, .5, abs(vP.x)), ez = smoothstep(.4, .5, abs(vP.z));
        c += ex * ez * vec3(.5, .75, 1.) * (.35 + vT * .9);
        float dd = distance(cameraPosition, vW);
        float fg = 1. - exp(-pow(.0095 * dd, 2.));
        gl_FragColor = vec4(mix(c, uFog, fg), 1.);
      }`,
  });
  const bars = new THREE.InstancedMesh(geo, barMat, n);
  bars.frustumCulled = false;
  g.add(bars);
  const dummy = new THREE.Object3D();

  // etiquetas de meses
  const monthTex = liveTex(1024, 96, (gg, w, h) => {
    gg.font = `700 40px ${MONO}`;
    gg.textAlign = 'center';
    gg.textBaseline = 'middle';
    gg.fillStyle = 'rgba(210,200,255,0.9)';
    MONTHS.forEach((m, i) => gg.fillText(m, (w / COLS) * (i + 0.5), h / 2));
  }, 8).tex;
  const monthPlane = new THREE.Mesh(new THREE.PlaneGeometry(COLS * SP, (COLS * SP * 96) / 1024), new THREE.MeshBasicMaterial({ map: monthTex, transparent: true, depthWrite: false }));
  monthPlane.rotation.x = -Math.PI / 2;
  monthPlane.position.set(0, -0.12, (ROWS - 1) / 2 * SP + 1.5 + 2.2);
  g.add(monthPlane);

  // --- pared de gráfico con línea de crecimiento ---------------------------
  const wallTex = liveTex(1024, 512, (gg, w, h) => {
    gg.strokeStyle = 'rgba(120,200,255,0.2)';
    gg.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      gg.beginPath();
      gg.moveTo(0, (h / 8) * i);
      gg.lineTo(w, (h / 8) * i);
      gg.stroke();
    }
    for (let i = 0; i <= 18; i++) {
      gg.beginPath();
      gg.moveTo((w / 18) * i, 0);
      gg.lineTo((w / 18) * i, h);
      gg.stroke();
    }
  }).tex;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: wallTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, color: glow(COL.cyan, 0.6) }));
  wall.position.set(0, 10, -9);
  g.add(wall);

  const curvePts = [];
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    curvePts.push(new THREE.Vector3(-17 + k * 34, 2.5 + k * 9.5 + Math.sin(k * 11) * 1.1 + (r() - 0.5) * 0.7, -8.6));
  }
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const tubeSeg = 240, tubeRad = 6;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, tubeSeg, 0.13, tubeRad, false), new THREE.MeshBasicMaterial({ color: glow(COL.cyan, 2.6) }));
  const idxCount = tube.geometry.index.count;
  g.add(tube);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 16), new THREE.MeshBasicMaterial({ color: glow(0xffffff, 2.2) }));
  g.add(head);
  const headHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(128), color: glow(COL.cyan, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  headHalo.scale.setScalar(3.4);
  head.add(headHalo);

  // --- dona -------------------------------------------------------------------
  const donut = new THREE.Group();
  donut.position.set(-22.5, 7, 1);
  const segs = [[0.52, COL.violet], [0.3, COL.cyan], [0.18, 0xdcd3ff]];
  let start = Math.PI / 2;
  const arcs = [];
  segs.forEach(([frac, col], i) => {
    const arc = frac * Math.PI * 2 - 0.12;
    const m = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.5, 14, 48, arc), new THREE.MeshBasicMaterial({ color: glow(col, 2.2) }));
    m.rotation.z = start;
    start += frac * Math.PI * 2;
    donut.add(m);
    arcs.push(m);
  });
  const dLabel = labelSprite('Canales', 'DEMO', { scale: 5, accent: '#c4a1ff' });
  dLabel.position.set(0, 0, 0);
  donut.add(dLabel);
  g.add(donut);

  // --- tarjetas KPI (sprites) ------------------------------------------------
  const kpis = [
    { c: kpiCard('VISITAS · DEMO', '+38%', 'dato ilustrativo', '#22d3ee'), pos: [18.5, 10.5, -1], val: (k) => `+${Math.round(38 * k)}%` },
    { c: kpiCard('USUARIOS · DEMO', '12.480', 'dato ilustrativo', '#8b3dff'), pos: [0, 17.5, -6], val: (k) => Math.round(12480 * k).toLocaleString('es-AR') },
    { c: kpiCard('CONVERSIÓN · DEMO', '4,2%', 'dato ilustrativo', '#c4a1ff'), pos: [-8, 14, 4], val: (k) => (4.2 * k).toFixed(1).replace('.', ',') + '%' },
  ];
  kpis.forEach((k) => {
    k.s = new THREE.Sprite(new THREE.SpriteMaterial({ map: k.c.tex, transparent: true, depthWrite: false, opacity: 0 }));
    k.s.scale.set(7.4, 3.9, 1);
    k.s.position.set(...k.pos);
    k.q = -1;
    g.add(k.s);
  });

  // banner permanente de datos de demostración
  const banner = labelSprite('DATOS DE DEMOSTRACIÓN', 'ilustrativos · no son métricas reales', { w: 768, h: 170, scale: 12, accent: '#fbbf77' });
  banner.position.set(0, 21.5, -8);
  g.add(banner);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(256), color: glow(COL.blue, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
  halo.scale.set(60, 30, 1);
  halo.position.set(0, 8, -12);
  g.add(halo);

  const pt = new THREE.Vector3();

  function update(u, t, dt, st) {
    barMat.uniforms.uTime.value = t;
    // barras: crecen escalonadas y respiran
    for (let i = 0; i < n; i++) {
      const d = data[i];
      const k = ease3((u - 0.04 - d.delay * 0.45) / 0.32);
      const breathe = 1 + Math.sin(t * 1.4 + i * 0.7) * 0.025 * k;
      dummy.position.set(d.x, 0, d.z);
      dummy.scale.set(1, Math.max(0.02, d.h * k * breathe), 1);
      dummy.updateMatrix();
      bars.setMatrixAt(i, dummy.matrix);
    }
    bars.instanceMatrix.needsUpdate = true;

    // línea de crecimiento
    const lk = clamp((u - 0.12) / 0.55);
    tube.geometry.setDrawRange(0, Math.max(6, Math.floor((idxCount * lk) / 6) * 6));
    curve.getPoint(clamp(lk), pt);
    head.position.copy(pt);
    head.visible = lk > 0.01;

    // dona
    const dk = ease3((u - 0.2) / 0.4);
    donut.scale.setScalar(Math.max(0.001, dk));
    donut.rotation.y = Math.sin(t * 0.4) * 0.25;

    // KPIs (cuenta ascendente, redibuja sólo cuando cambia el número mostrado)
    kpis.forEach((k, i) => {
      const kk = ease3((u - 0.25 - i * 0.08) / 0.3);
      k.s.material.opacity = smooth(0, 1, kk);
      k.s.position.y = k.pos[1] + Math.sin(t * 0.8 + i * 2) * 0.25;
      const step = Math.round(kk * 40);
      if (step !== k.q) {
        k.q = step;
        k.c.redraw(k.val(kk));
      }
    });
    banner.material.opacity = smooth(0.02, 0.15, u);
    plat.rotation.y = Math.PI / 6;
  }

  return { group: g, update };
}
