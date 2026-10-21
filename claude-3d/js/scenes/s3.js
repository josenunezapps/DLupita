// Escena 3 · Compilación: un vórtice de código cae hacia un núcleo, explota y nace el producto (un dispositivo).
import * as THREE from 'three';
import { COL, FONT, MONO, glow, rng, clamp, smooth, easeBack, ease3, liveTex, rr, radialTex, hexFrame } from '../common.js';

const LOG = [
  [6, '> resolviendo dependencias'],
  [20, '> compilando módulos'],
  [40, '> optimizando recursos'],
  [64, '> empaquetando la app'],
  [86, '> firmando versión'],
  [100, '✓ build exitoso'],
];

function drawScreen(g, w, h, st, logoImg) {
  const s = st || { pct: 0, done: false };
  rr(g, 0, 0, w, h, 34);
  g.save();
  g.clip();
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0b0620');
  bg.addColorStop(1, '#150a3a');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (!s.done) {
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = `600 22px ${MONO}`;
    g.fillText('zenix · build', 30, 58);
    g.fillStyle = '#22d3ee';
    g.fillText(`${Math.round(s.pct)}%`, w - 90, 58);
    g.font = `500 21px ${MONO}`;
    let y = 130;
    LOG.forEach(([at, line]) => {
      if (s.pct >= at) {
        g.fillStyle = line.startsWith('✓') ? '#4ade80' : '#c4a1ff';
        g.fillText(line, 30, y);
        y += 40;
      }
    });
    // barra de progreso
    rr(g, 30, h - 150, w - 60, 22, 11);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fill();
    rr(g, 30, h - 150, Math.max(22, ((w - 60) * s.pct) / 100), 22, 11);
    const pg = g.createLinearGradient(30, 0, w - 30, 0);
    pg.addColorStop(0, '#8b3dff');
    pg.addColorStop(1, '#22d3ee');
    g.fillStyle = pg;
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.font = `500 18px ${MONO}`;
    g.fillText('compilando…', 30, h - 100);
  } else {
    // vista de ejemplo de la app terminada
    if (logoImg && logoImg.complete) g.drawImage(logoImg, 28, 34, 56, 52);
    g.fillStyle = '#fff';
    g.font = `700 30px ${FONT}`;
    g.fillText('Panel', 100, 72);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = `500 17px ${FONT}`;
    g.fillText('vista de ejemplo', 100, 96);
    const cards = [['Pedidos', '128', '#8b3dff'], ['Clientes', '342', '#22d3ee']];
    cards.forEach(([t, v, c], i) => {
      const x = 28 + i * ((w - 76) / 2 + 20);
      rr(g, x, 130, (w - 76) / 2, 120, 22);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fill();
      g.strokeStyle = c;
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.font = `500 18px ${FONT}`;
      g.fillText(t, x + 18, 166);
      g.fillStyle = '#fff';
      g.font = `700 44px ${FONT}`;
      g.fillText(v, x + 18, 222);
    });
    // mini gráfico
    rr(g, 28, 276, w - 56, 190, 22);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fill();
    const bars = [0.35, 0.5, 0.42, 0.68, 0.6, 0.85, 0.95];
    bars.forEach((b, i) => {
      const bw = (w - 56 - 60) / 7 - 8;
      const bx = 44 + i * (bw + 8);
      const bh = b * 140;
      const gg = g.createLinearGradient(0, 456 - bh, 0, 456);
      gg.addColorStop(0, '#22d3ee');
      gg.addColorStop(1, '#8b3dff');
      g.fillStyle = gg;
      rr(g, bx, 456 - bh, bw, bh, 6);
      g.fill();
    });
    // lista
    for (let i = 0; i < 3; i++) {
      rr(g, 28, 490 + i * 64, w - 56, 52, 16);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fill();
      g.beginPath();
      g.arc(58, 516 + i * 64, 14, 0, 6.283);
      g.fillStyle = ['#8b3dff', '#22d3ee', '#c4a1ff'][i];
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillRect(86, 508 + i * 64, 150 - i * 20, 8);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(86, 524 + i * 64, 100, 6);
    }
    // sello
    rr(g, 28, h - 92, w - 56, 54, 27);
    const sg = g.createLinearGradient(28, 0, w - 28, 0);
    sg.addColorStop(0, '#8b3dff');
    sg.addColorStop(1, '#22d3ee');
    g.fillStyle = sg;
    g.fill();
    g.fillStyle = '#fff';
    g.font = `700 22px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('✓ Listo para publicar', w / 2, h - 57);
    g.textAlign = 'left';
  }
  g.restore();
}

export default function build(ctx) {
  const { M, tier, logoImg } = ctx;
  const g = new THREE.Group();
  const r = rng(303);

  // --- vórtice de partículas (todo en shader) ------------------------------
  const nV = tier === 'low' ? 2200 : tier === 'mid' ? 3800 : 7500;
  const seed = new Float32Array(nV * 4);
  for (let i = 0; i < nV; i++) {
    seed[i * 4] = r();
    seed[i * 4 + 1] = r();
    seed[i * 4 + 2] = r();
    seed[i * 4 + 3] = r();
  }
  const vg = new THREE.BufferGeometry();
  vg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
  vg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const vm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uAmt: { value: 1 }, uSpeed: { value: 1 } },
    vertexShader: `
      attribute vec4 aSeed; uniform float uTime, uPR, uAmt, uSpeed; varying vec3 vC; varying float vA;
      void main(){
        float t = fract(aSeed.x + uTime * (.045 + aSeed.w * .05) * uSpeed);
        float e = pow(t, 1.7);
        float rad = mix(18. * (.3 + aSeed.z * .7), .8, e);
        float a = aSeed.y * 6.2831 + e * 10. + uTime * .15;
        float y = (aSeed.w - .5) * 2. * mix(6.5, .15, e);
        vec3 p = vec3(cos(a) * rad, y, sin(a) * rad);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vC = mix(vec3(.5, .15, 1.), mix(vec3(.12, .85, .95), vec3(1., .95, 1.), e), smoothstep(.1, 1., e)) * (.45 + e * .95);
        vA = smoothstep(0., .1, t) * smoothstep(1., .8, t) * uAmt * smoothstep(140., 55., -mv.z);
        gl_PointSize = clamp(uPR * (1.4 + 2.6 * e) * 60. / -mv.z, 1., 18. * uPR);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(vC, a * a * vA); }`,
  });
  const vortex = new THREE.Points(vg, vm);
  vortex.frustumCulled = false;
  vortex.rotation.z = 0.35;
  g.add(vortex);

  // --- núcleo --------------------------------------------------------------
  const core = new THREE.Group();
  g.add(core);
  const coreBall = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 24), new THREE.MeshBasicMaterial({ color: glow(0xf1e8ff, 2.0) }));
  core.add(coreBall);
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), new THREE.MeshBasicMaterial({ color: glow(COL.cyan, 1.8), wireframe: true, transparent: true, opacity: 0.55 }));
  core.add(wire);
  const rings = [];
  [3.0, 4.0, 5.1].forEach((R, i) => {
    const m = new THREE.Mesh(hexFrame(R, 0.14 + i * 0.03, 0.12, 0.02), i === 1 ? M.gCyan : M.gViolet);
    core.add(m);
    rings.push(m);
  });
  const haloTex = radialTex(256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glow(COL.violet, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  halo.scale.setScalar(16);
  g.add(halo);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glow(0xffffff, 2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
  g.add(flash);

  // onda expansiva
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), new THREE.MeshBasicMaterial({ color: glow(COL.violet, 3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  shock.rotation.x = -Math.PI / 2;
  g.add(shock);
  const shock2 = shock.clone();
  shock2.material = shock.material.clone();
  shock2.material.color = glow(COL.cyan, 3);
  shock2.rotation.set(0, 0, 0);
  g.add(shock2);

  // --- dispositivo ---------------------------------------------------------
  const device = new THREE.Group();
  g.add(device);
  const W = 3.3, H = 6.7, RAD = 0.5;
  const body = new THREE.Shape();
  body.moveTo(-W / 2 + RAD, -H / 2);
  body.lineTo(W / 2 - RAD, -H / 2);
  body.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + RAD);
  body.lineTo(W / 2, H / 2 - RAD);
  body.quadraticCurveTo(W / 2, H / 2, W / 2 - RAD, H / 2);
  body.lineTo(-W / 2 + RAD, H / 2);
  body.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - RAD);
  body.lineTo(-W / 2, -H / 2 + RAD);
  body.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + RAD, -H / 2);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 3, curveSegments: 10 });
  bodyGeo.translate(0, 0, -0.15);
  device.add(new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x2a1f4d, metalness: 1, roughness: 0.2 })));
  // pantalla
  const SW = W - 0.26, SH = H - 0.26;
  const screen = liveTex(360, 720, (gg, w, h, st) => drawScreen(gg, w, h, st, logoImg), 8);
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: screen.tex, transparent: true, color: new THREE.Color(1.15, 1.15, 1.2) }));
  screenMesh.position.z = 0.225;
  device.add(screenMesh);
  const devHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glow(COL.violet, 1.1), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
  devHalo.scale.set(14, 16, 1);
  devHalo.position.z = -1.2;
  device.add(devHalo);
  device.visible = false;

  let lastKey = -1;

  function update(u, t, dt, st) {
    vm.uniforms.uTime.value = t;
    vm.uniforms.uPR.value = st.pr;

    // 0..0.5 compila, 0.5..0.6 colapsa, 0.58+ aparece el dispositivo
    const comp = clamp(u / 0.5);
    const collapse = smooth(0.46, 0.6, u);
    const burst = smooth(0.58, 0.64, u) * (1 - smooth(0.64, 0.8, u));
    const born = easeBack((u - 0.58) / 0.22);

    vm.uniforms.uAmt.value = 1 - smooth(0.58, 0.82, u) * 0.82;
    vm.uniforms.uSpeed.value = 0.8 + comp * 1.6 + collapse * 2;

    const pulse = 1 + Math.sin(t * (4 + comp * 10)) * 0.05 * (1 + comp);
    const coreS = (0.75 + comp * 0.45) * pulse * (1 - collapse);
    core.scale.setScalar(Math.max(0.0001, coreS));
    core.visible = coreS > 0.01;
    wire.rotation.set(t * 0.6, t * 0.8, 0);
    rings.forEach((m, i) => {
      m.rotation.set(t * (0.5 + i * 0.35) * (i % 2 ? -1 : 1) * (1 + comp * 2), t * (0.3 + i * 0.25) + i, i * 1.1);
    });
    halo.material.opacity = 0.2 + comp * 0.4 * (1 - collapse * 0.8);
    halo.scale.setScalar(12 + comp * 6 + Math.sin(t * 5) * 0.5);

    flash.material.opacity = burst * 0.95;
    flash.scale.setScalar(6 + burst * 60);

    const sk = clamp((u - 0.6) / 0.28);
    shock.visible = shock2.visible = sk > 0 && sk < 1;
    const ss = 1 + ease3(sk) * 34;
    shock.scale.setScalar(ss);
    shock2.scale.setScalar(ss * 0.75);
    shock.material.opacity = (1 - sk) * 0.9;
    shock2.material.opacity = (1 - sk) * 0.6;

    // dispositivo
    device.visible = born > 0.01;
    device.scale.setScalar(Math.max(0.0001, born) * 1.15);
    device.position.y = 0.2 + Math.sin(t * 1.1) * 0.12;
    device.rotation.y = -1.2 + smooth(0.55, 0.85, u) * 1.5 + st.pointer.x * 0.25 + Math.sin(t * 0.5) * 0.06;
    device.rotation.x = -st.pointer.y * 0.1;

    // pantalla: sólo se redibuja cuando cambia el porcentaje
    const pct = Math.round(clamp(u / 0.5) * 100);
    const done = u > 0.66;
    const key = done ? 1000 : pct;
    if (key !== lastKey) {
      lastKey = key;
      screen.redraw({ pct: done ? 100 : pct, done });
    }
    st.compilePct = pct;
  }

  return { group: g, update };
}
