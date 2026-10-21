import * as THREE from 'three';
import { PAL, rng, smooth, clamp, lerp, hexRingGeometry, roundedRectShape, roundedRectPath, canvasTexture, neon, FX } from '../util.js';
import { flowMaterial } from '../materials.js';
import { makeMonitor } from '../parts.js';

// ESCENA 3 · Compilación y procesamiento: túnel hexagonal con conductos de datos, un núcleo procesador que atraviesa la
// cámara y un taller de ensamblado donde los bloques de código se convierten en una aplicación (navegador + móvil).
export function buildCompile(ctx) {
  const { M, Q, col, textures } = ctx;
  const g = new THREE.Group();
  g.name = 'compile';
  const low = Q.detail === 'low';
  const Z0 = -166, ZCORE = -208, ZEND = -258;

  // --- Costillas del túnel (instanciadas). A partir del núcleo se abren formando una nave de ensamblado.
  const rings = [];
  for (let z = -170; z >= -254; z -= 6) rings.push(z);
  const radiusAt = (z) => 7.5 + 5.2 * smooth(-212, -250, z);
  const ribGeo = hexRingGeometry(7.5, 6.7, 0.9, 0.06);
  const ribs = new THREE.InstancedMesh(ribGeo, M.metalDark, rings.length);
  const ribGlow = new THREE.InstancedMesh(hexRingGeometry(6.74, 6.55, 1.05, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), rings.length);
  const d = new THREE.Object3D(); const cc = new THREE.Color();
  rings.forEach((z, i) => {
    const s = radiusAt(z) / 7.5;
    d.position.set(0, 0, z); d.scale.set(s, s, 1); d.updateMatrix();
    ribs.setMatrixAt(i, d.matrix); ribGlow.setMatrixAt(i, d.matrix);
    ribGlow.setColorAt(i, cc.set(PAL.violet).multiplyScalar(0.3));
    col.ring([0, 0, z], 6.7 * s - 0.4, 7.5 * s + 0.4, 1.4, 'rib-' + i);
  });
  g.add(ribs, ribGlow);

  // Paneles de pared (solo en el tramo recto) y vigas longitudinales en los vértices
  const wallLen = 212 - 168 + 6;
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + (k + 0.5) * (Math.PI / 3);
    const ap = 7.5 * Math.cos(Math.PI / 6) + 0.08;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.12, wallLen), M.plate);
    wall.position.set(Math.cos(a) * ap, Math.sin(a) * ap, -168 - wallLen / 2 + 3);
    wall.rotation.z = a - Math.PI / 2;
    g.add(wall);
  }
  const beamGeo = new THREE.BoxGeometry(0.4, 0.4, 120);
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 3;
    const b = new THREE.Mesh(beamGeo, M.metalMid);
    b.position.set(Math.cos(a) * 7.3, Math.sin(a) * 7.3, -226);
    g.add(b);
  }

  // --- Conductos luminosos con pulsos de datos
  const flows = [];
  const addFlow = (pts, rad, color, pulse, speed, dens) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const m = flowMaterial({ color, pulse, speed, density: dens });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 14), rad, 8, false), m);
    g.add(tube); flows.push(m);
    return tube;
  };
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + ((k + 0.5) * Math.PI) / 3;
    const R = 6.0;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const z = -168 - i * 4.2, w = Math.sin(i * 0.9 + k) * 0.35;
      pts.push([Math.cos(a) * (R + w * 0.3), Math.sin(a) * (R + w * 0.3), z]);
    }
    addFlow(pts, 0.14, PAL.violet, k % 2 ? PAL.cyan : PAL.electric, 0.55 + (k % 3) * 0.12, 10);
    const pts2 = [];
    for (let i = 0; i <= 8; i++) {
      const z = -212 - i * 5.2; const rr = 6.0 + 4.4 * smooth(-212, -250, z) * 0.55;
      pts2.push([Math.cos(a) * rr, Math.sin(a) * rr, z]);
    }
    addFlow(pts2, 0.13, PAL.violet, PAL.cyan, 0.5, 8);
  }

  // --- Núcleo procesador: tres anillos hexagonales que giran con la compilación (el pasillo central queda libre)
  const core = new THREE.Group(); core.position.z = ZCORE; g.add(core);
  const coreRings = [
    { Ro: 5.8, Ri: 5.15, z: -1.7, k: 6.5, m: M.metalMid, glow: M.violetGlow },
    { Ro: 4.8, Ri: 4.2, z: 0, k: -8.5, m: M.silver, glow: M.cyanGlow },
    { Ro: 4.0, Ri: 3.45, z: 1.7, k: 11, m: M.metalViolet, glow: M.electricGlow },
  ].map((r) => {
    const grp = new THREE.Group(); grp.position.z = r.z;
    grp.add(new THREE.Mesh(hexRingGeometry(r.Ro, r.Ri, 0.9, 0.07), r.m));
    grp.add(new THREE.Mesh(hexRingGeometry(r.Ri + 0.3, r.Ri - 0.1, 1.05, 0), r.glow));
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      const node = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.2), M.whiteGlow);
      node.position.set(Math.cos(a) * (r.Ro + r.Ri) / 2, Math.sin(a) * (r.Ro + r.Ri) / 2, 0);
      node.rotation.z = a; grp.add(node);
    }
    core.add(grp);
    col.ring([0, 0, ZCORE + r.z], r.Ri - 0.25, r.Ro + 0.3, 1.5, 'core-ring');
    return { grp, k: r.k };
  });
  // Radios que sostienen el núcleo contra las paredes del túnel
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), M.metalDark);
    spoke.position.set(Math.cos(a) * 6.5, Math.sin(a) * 6.5, ZCORE);
    spoke.rotation.z = a - Math.PI / 2;
    g.add(spoke);
  }
  // Campo de energía del núcleo (escaneo): transparente, la cámara lo cruza
  const fieldMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uAct: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime,uAct,uFlash;
      void main(){
        vec2 p = vUv * 2. - 1.; float r = length(p); if (r > 1.) discard;
        float ring = smoothstep(.86,.97,r) * (1.-smoothstep(.97,1.,r));
        float scan = pow(abs(sin((p.y * 7. - uTime * 1.6) * 3.14159)), 18.) * .5;
        float hex = pow(abs(sin(p.x * 22.) * sin((p.y * 22. + p.x * 13.))), 14.) * .35;
        vec3 c = vec3(.5,.3,1.) * (ring * 2.4 + scan * .8 + hex * .6) + vec3(.2,.9,1.) * scan * .6;
        float a = (ring + scan * .35 + hex * .18) * (.35 + .65 * uAct) + uFlash * (1. - r) * .6;
        gl_FragColor = vec4(c * (.4 + uAct) + vec3(.8,.9,1.) * uFlash * (1.-r), clamp(a, 0., 1.));
      }`,
  });
  const field = new THREE.Mesh(new THREE.CircleGeometry(3.3, 48), fieldMat);
  field.position.z = ZCORE;
  g.add(field);

  // Marquesina de estado de compilación (canvas que se redibuja al cambiar el porcentaje)
  const hud = canvasTexture(512, 160, (c, W, H, pct = 0) => {
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(10,6,30,.78)'; c.fillRect(0, 0, W, H);
    c.strokeStyle = pct >= 100 ? '#6ee7a8' : '#22d3ee'; c.lineWidth = 3; c.strokeRect(3, 3, W - 6, H - 6);
    c.font = '700 40px ui-monospace, Menlo, Consolas, monospace'; c.fillStyle = '#efeaff'; c.textBaseline = 'middle';
    c.fillText(pct >= 100 ? 'BUILD COMPLETO ✓' : 'COMPILANDO…  ' + pct + '%', 26, 56);
    c.fillStyle = '#1b1740'; c.fillRect(26, 106, W - 52, 18);
    c.fillStyle = pct >= 100 ? '#6ee7a8' : '#a66bff'; c.fillRect(26, 106, (W - 52) * pct / 100, 18);
  });
  textures.push(hud.tex);
  const hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.44), new THREE.MeshBasicMaterial({ map: hud.tex, transparent: true, toneMapped: false, depthWrite: false }));
  hudMesh.position.set(0, 5.1, ZCORE + 6);
  g.add(hudMesh);
  let hudPct = -1;

  // --- Taller de ensamblado: ventana de navegador y móvil construidos con volumen
  const uiTex = (portrait) => canvasTexture(portrait ? 360 : 700, portrait ? 720 : 460, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#120d30'); gr.addColorStop(1, '#0a0720');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const bar = (x, y, w, h, col2, r = 6) => { c.fillStyle = col2; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
    const pad = portrait ? 22 : 34;
    bar(pad, pad, 70, 22, '#a66bff'); for (let i = 0; i < 3; i++) bar(W - pad - 190 + i * 66, pad + 4, 52, 14, '#4a4480');
    bar(pad, pad + 64, W * (portrait ? 0.78 : 0.5), portrait ? 34 : 40, '#efeaff', 8);
    bar(pad, pad + 64 + (portrait ? 48 : 56), W * (portrait ? 0.6 : 0.38), portrait ? 34 : 40, '#efeaff', 8);
    bar(pad, pad + (portrait ? 160 : 176), W * 0.6, 12, '#7d77a6'); bar(pad, pad + (portrait ? 180 : 196), W * 0.5, 12, '#7d77a6');
    bar(pad, pad + (portrait ? 214 : 232), 150, 44, '#8b4dff', 22);
    if (!portrait) { const g2 = c.createLinearGradient(W * 0.6, 60, W - 30, 230); g2.addColorStop(0, '#8b4dff'); g2.addColorStop(1, '#22d3ee'); c.fillStyle = g2; c.beginPath(); c.roundRect(W * 0.6, 60, W * 0.33, 170, 18); c.fill(); }
    const cards = portrait ? 2 : 3, cw = (W - pad * 2 - (cards - 1) * 16) / cards, y0 = portrait ? 380 : 280;
    for (let i = 0; i < cards; i++) { bar(pad + i * (cw + 16), y0, cw, portrait ? 130 : 140, '#1c1650', 14); bar(pad + 14 + i * (cw + 16), y0 + 16, 36, 36, i % 2 ? '#22d3ee' : '#a66bff', 10); bar(pad + 14 + i * (cw + 16), y0 + 70, cw * 0.6, 10, '#6c6796'); bar(pad + 14 + i * (cw + 16), y0 + 90, cw * 0.4, 10, '#6c6796'); }
    if (portrait) for (let i = 0; i < 2; i++) bar(pad, 540 + i * 74, W - pad * 2, 58, '#1c1650', 14);
    bar(W / 2 - 40, H - 16, 80, 5, '#4a4480', 3);
  });
  const winTex = uiTex(false), phoneTex = uiTex(true);
  textures.push(winTex.tex, phoneTex.tex);
  const WIN = { x: -6.8, y: 0.6, z: -238, ry: 0.78, w: 7.2, h: 4.7 };
  const PHN = { x: 6.4, y: -0.2, z: -241, ry: -0.78, w: 2.7, h: 5.4 };
  const uiMats = [];
  const winMat = new THREE.MeshBasicMaterial({ map: winTex.tex, transparent: true, opacity: 0, toneMapped: false });
  const win = makeMonitor(ctx, { w: WIN.w, h: WIN.h, tex: null, screenMat: winMat, accent: PAL.cyan, standLen: 0 });
  win.position.set(WIN.x, WIN.y, WIN.z); win.rotation.y = WIN.ry; g.add(win);
  col.box(win, 'asm-window', 0.1);
  // El navegador tiene su propia base flotante (soporte de ensamblado)
  const plinth = (x, z, r) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, 0.35, 6), M.metalDark); b.position.set(x, -6.2, z); g.add(b);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.05, 6, 6), M.cyanGlow); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.set(x, -6.0, z); g.add(ring);
  };
  plinth(WIN.x, WIN.z, 4.2); plinth(PHN.x, PHN.z, 2.4);
  // Móvil: cuerpo extruido con esquinas redondeadas
  const phS = roundedRectShape(PHN.w, PHN.h, 0.38);
  phS.holes.push(roundedRectPath(PHN.w - 0.24, PHN.h - 0.24, 0.28));
  const phone = new THREE.Group();
  phone.add(new THREE.Mesh(new THREE.ExtrudeGeometry(phS, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 6 }), M.silver));
  const phMat = new THREE.MeshBasicMaterial({ map: phoneTex.tex, transparent: true, opacity: 0, toneMapped: false });
  const phScr = new THREE.Mesh(new THREE.PlaneGeometry(PHN.w - 0.24, PHN.h - 0.24), phMat); phScr.position.z = 0.04; phone.add(phScr);
  const phBack = new THREE.Mesh(new THREE.PlaneGeometry(PHN.w - 0.24, PHN.h - 0.24), M.black); phBack.position.z = 0.0; phone.add(phBack);
  phone.position.set(PHN.x, PHN.y, PHN.z); phone.rotation.y = PHN.ry; g.add(phone);
  col.box(phone, 'asm-phone', 0.1);
  uiMats.push(winMat, phMat);

  // --- Tokens de código → bloques → software (instanciados; posición dependiente solo del progreso de compilación)
  const NW = { c: 12, r: 8 }, NP = { c: 5, r: 8 };
  const N = Math.min(NW.c * NW.r + NP.c * NP.r, low ? 90 : 136);
  const nWin = Math.min(NW.c * NW.r, Math.round(N * 0.7));
  const tokMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const tok = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), tokMat, N);
  tok.frustumCulled = false;
  g.add(tok);
  const r = rng(99);
  const P = [];
  const winQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, WIN.ry, 0));
  const phQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, PHN.ry, 0));
  const palette = [new THREE.Color(0x1a1444), new THREE.Color(0x8b4dff), new THREE.Color(0x22d3ee), new THREE.Color(0xefeaff), new THREE.Color(0x4a3a9a)];
  for (let i = 0; i < N; i++) {
    const inWin = i < nWin;
    const idx = inWin ? i : i - nWin;
    const cols = inWin ? NW.c : NP.c, rows = inWin ? NW.r : NP.r;
    const cx = idx % cols, cy = Math.floor(idx / cols);
    const w = inWin ? WIN.w : PHN.w, h = inWin ? WIN.h : PHN.h;
    const tw = (w - 0.4) / cols, th = (h - 0.4) / rows;
    const local = new THREE.Vector3(-(w - 0.4) / 2 + (cx + 0.5) * tw, ((h - 0.4) / 2) - (cy + 0.5) * th, 0.1);
    const q = inWin ? winQ : phQ, o = inWin ? WIN : PHN;
    const target = local.clone().applyQuaternion(q).add(new THREE.Vector3(o.x, o.y, o.z));
    const a = r() * Math.PI * 2, rr = 2.7 + r() * 3.1;
    const start = new THREE.Vector3(Math.cos(a) * rr, Math.sin(a) * rr, -172 - r() * 16);
    const a2 = a + (r() - 0.5) * 1.2;
    const entry = new THREE.Vector3(Math.cos(a2) * (2.1 + r() * 0.8), Math.sin(a2) * (2.1 + r() * 0.8), ZCORE + 3.2);
    const exit = new THREE.Vector3(Math.cos(a2 + 1.3) * (1.9 + r() * 0.9), Math.sin(a2 + 1.3) * (1.9 + r() * 0.9), ZCORE - 3.6);
    const ctrl1 = start.clone().lerp(entry, 0.5); ctrl1.x += (r() - 0.5) * 4; ctrl1.y += (r() - 0.5) * 4;
    const ctrl3 = exit.clone().lerp(target, 0.5); ctrl3.y += 3 + r() * 3; ctrl3.x += (r() - 0.5) * 5;
    // color final del mosaico (cabecera, héroe, tarjetas)
    let tc;
    const fr = cy / (rows - 1), fc = cx / (cols - 1);
    if (cy === 0) tc = palette[0];
    else if (fr < 0.5) tc = fc < 0.5 ? (r() < 0.5 ? palette[3] : palette[4]) : palette[1].clone().lerp(palette[2], fc);
    else tc = (cx % 4 === 3 && inWin) ? palette[0] : (r() < 0.5 ? palette[4] : palette[(1 + Math.floor(r() * 2))]);
    P.push({ start, entry, exit, ctrl1, ctrl3, target, tw, th, q, delay: (i / N) * 0.3, spin: r() * 6, tc: tc.clone() });
  }
  const cyanC = new THREE.Color(PAL.cyan).multiplyScalar(2.2 * FX.k);
  const whiteC = new THREE.Color(0xffffff).multiplyScalar(3 * FX.k);
  const violetC = new THREE.Color(PAL.violet).multiplyScalar(2.2 * FX.k);
  const tmpC = new THREE.Color(), pos = new THREE.Vector3(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), idQ = new THREE.Quaternion();
  const bez = (a, b, c, t, out) => { const u = 1 - t; return out.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z); };
  const ease = (t) => t * t * (3 - 2 * t);
  const Mx = new THREE.Matrix4();
  function updateTokens(c, time) {
    const fadeOut = 1 - smooth(0.93, 0.995, c);
    for (let i = 0; i < N; i++) {
      const T = P[i];
      const q = clamp((c - T.delay) / 0.7);
      let k;     // k: 0 = ficha plana (cian), 1 = cubo, 2 = baldosa final
      if (q < 0.4) {
        bez(T.start, T.ctrl1, T.entry, ease(q / 0.4), pos);
        // ficha en espera: ligera oscilación solo mientras el avance la mueve (sin giros eternos)
        sc.set(0.62, 0.2, 0.05); qq.setFromAxisAngle(new THREE.Vector3(0, 0, 1), T.spin + q * 3); tmpC.copy(cyanC); k = 0;
      } else if (q < 0.56) {
        const t = (q - 0.4) / 0.16;
        pos.lerpVectors(T.entry, T.exit, t);
        const s = lerp(0.62, 0.3, ease(t));
        sc.set(s, lerp(0.2, 0.3, ease(t)), lerp(0.05, 0.3, ease(t)));
        qq.setFromAxisAngle(new THREE.Vector3(1, 1, 0).normalize(), t * 9 + T.spin);
        tmpC.copy(cyanC).lerp(whiteC, Math.sin(t * Math.PI)); tmpC.lerp(violetC, t * 0.8); k = 1;
      } else {
        const t = ease((q - 0.56) / 0.44);
        bez(T.exit, T.ctrl3, T.target, t, pos);
        const land = smooth(0.78, 1, t);
        sc.set(lerp(0.3, T.tw * 0.94, land), lerp(0.3, T.th * 0.94, land), lerp(0.3, 0.1, land));
        qq.setFromAxisAngle(new THREE.Vector3(0.4, 1, 0.2).normalize(), (1 - t) * 5 + T.spin).slerp(T.q, land);
        tmpC.copy(violetC).lerp(T.tc.clone().multiplyScalar(1.6 * FX.k), land); k = 2;
      }
      const f = k === 2 ? fadeOut : 1;
      sc.multiplyScalar(Math.max(0.0001, f));
      Mx.compose(pos, qq, sc);
      tok.setMatrixAt(i, Mx);
      tok.setColorAt(i, tmpC);
    }
    tok.instanceMatrix.needsUpdate = true;
    if (tok.instanceColor) tok.instanceColor.needsUpdate = true;
  }

  // Salida de la nave: gran marco hexagonal por el que la cámara pasa hacia el centro de análisis
  const gate = new THREE.Mesh(hexRingGeometry(16, 14.4, 1.4, 0.1), M.metalMid); gate.position.z = ZEND; g.add(gate);
  const gateGlow = new THREE.Mesh(hexRingGeometry(14.7, 14.2, 1.6, 0), M.electricGlow); gateGlow.position.z = ZEND; g.add(gateGlow);
  col.ring([0, 0, ZEND], 14.0, 16.4, 1.8, 'exit-gate');

  const ribCol = new THREE.Color(), dim = new THREE.Color(PAL.violet).multiplyScalar(0.22), lit = new THREE.Color(PAL.cyan).multiplyScalar(1.25);
  return {
    group: g,
    range: [0.30, 0.56],
    update(s) {
      const p = s.p;
      const c = smooth(0.385, 0.495, p);                         // progreso de compilación (0..1)
      const act = smooth(0.35, 0.41, p) * (1 - 0.55 * smooth(0.5, 0.54, p));
      flows.forEach((m) => { m.uniforms.uTime.value = s.time; m.uniforms.uAct.value = act; });
      // El núcleo gira con el avance (no de forma perpetua)
      coreRings.forEach(({ grp, k }) => { grp.rotation.z = c * k; });
      fieldMat.uniforms.uTime.value = s.time;
      fieldMat.uniforms.uAct.value = act;
      fieldMat.uniforms.uFlash.value = Math.max(0, Math.sin(smooth(0.42, 0.5, p) * Math.PI)) * 0.9;
      // Costillas del túnel: se encienden en orden según avanza el procesamiento
      for (let i = 0; i < rings.length; i++) {
        const t = smooth(i / rings.length * 0.9, i / rings.length * 0.9 + 0.12, c);
        ribCol.copy(dim).lerp(lit, t);
        ribGlow.setColorAt(i, ribCol);
      }
      if (ribGlow.instanceColor) ribGlow.instanceColor.needsUpdate = true;
      updateTokens(c, s.time);
      // Ensamblado terminado: aparecen las interfaces reales sobre el mosaico
      const ui = smooth(0.9, 1.0, c);
      uiMats.forEach((m) => { m.opacity = ui; });
      const pct = Math.round(c * 100);
      if (pct !== hudPct) { hudPct = pct; hud.redraw(pct); }
      hudMesh.material.opacity = smooth(0.375, 0.4, p) * (1 - smooth(0.5, 0.52, p));
      hudMesh.visible = hudMesh.material.opacity > 0.01;
    },
  };
}
