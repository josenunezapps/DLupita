// Motor: renderer + postproceso, cámara guiada por el scroll, calidad adaptativa y HUD.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp, smooth, makeMaterials, COL } from './common.js';
import { makeEnv, makeBackdrop, makeDust, makeStreaks, FinalShader } from './fx.js';
import s1 from './scenes/s1.js';
import s2 from './scenes/s2.js';
import s3 from './scenes/s3.js';
import s4 from './scenes/s4.js';
import s5 from './scenes/s5.js';
import s6 from './scenes/s6.js';

const html = document.documentElement;
const q = new URLSearchParams(location.search);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

const SPACING = 90; // distancia entre escenas sobre el eje -Z
const NAMES = ['Entrada', 'Desarrollo', 'Compilación', 'Estadísticas', 'Sistemas', 'Cierre'];
const BUILDERS = [s1, s2, s3, s4, s5, s6];

// Fotogramas clave de cámara por escena (posición, objetivo) en coordenadas locales de la escena.
// 4 por escena + 1 final → el parámetro del spline coincide con el progreso de scroll.
const KF = [
  // 1 · portal
  [[0, 2.5, 36], [0, 2.5, 0]], [[-9, 3.5, 24], [0, 2.5, 0]], [[6, 1.5, 12], [0, 2.5, -2]], [[0, 2.5, -8], [0, 2.5, -40]],
  // 2 · desarrollo
  [[0, 0.8, 40], [0, 2, 0]], [[7, 2, 22], [0, 2.5, 0]], [[-8, 3.5, 6], [0, 3, 0]], [[-2, 1.5, -16], [0, 1, -40]],
  // 3 · compilación
  [[0, 0.8, 40], [0, 0, 0]], [[13, 7, 17], [0, 0, 0]], [[-9, 2, 10], [0, 0, 0]], [[3, 1.0, 13], [0, 0, 0]],
  // 4 · estadísticas
  [[0, 0.8, 40], [0, 4, 0]], [[-19, 11, 28], [0, 4, 0]], [[18, 9, 25], [0, 5, -2]], [[3, 3, -14], [0, 3, -40]],
  // 5 · sistemas
  [[0, 0.8, 40], [0, 0, 0]], [[15, 6, 24], [0, 0, 0]], [[-13, -2, 12], [0, 0, 0]], [[3, 2, -19], [0, 0, -40]],
  // 6 · cierre
  [[0, 0.8, 40], [0, 2, 0]], [[-6, 3, 28], [0, 2.2, 0]], [[3, 2.5, 20], [0, 2.2, 0]], [[0, 2.2, 15], [0, 2.2, 0]],
];
KF.push([[0, 2.2, 14], [0, 2.2, 0]]);

const TINTS = [
  [0x4c1d95, 0x1d4ed8], [0x5b21b6, 0x0e7490], [0x7c3aed, 0x22d3ee],
  [0x1e3a8a, 0x0e7490], [0x4338ca, 0x7c3aed], [0x6d28d9, 0x22d3ee],
].map(([a, b]) => [new THREE.Color(a), new THREE.Color(b)]);

const TIERS = {
  high: { dpr: 1.75, msaa: 4, bloomScale: 1, dust: 2200, streaks: 220, oct: 4, bloom: 0.8 },
  mid: { dpr: 1.25, msaa: 0, bloomScale: 0.5, dust: 1100, streaks: 130, oct: 3, bloom: 0.7 },
  low: { dpr: 1.0, msaa: 0, bloomScale: 0.35, dust: 600, streaks: 70, oct: 2, bloom: 0.7 },
};

function detectTier() {
  const ua = navigator.userAgent || '';
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && Math.min(innerWidth, innerHeight) < 820);
  let tier = mobile ? 'mid' : 'high';
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile && (mem <= 3 || cores <= 4)) tier = 'low';
  const o = q.get('q');
  if (o === 'low' || o === 'mid' || o === 'high') tier = o;
  return { tier, mobile, coarse, forced: !!o };
}

function fail(why, err) {
  console.warn('[zenix-3d] versión alternativa:', why, err || '');
  html.classList.add('nogl');
  html.classList.remove('loading');
}

async function boot() {
  const { tier, mobile, coarse, forced } = detectTier();
  const T = TIERS[tier];
  html.dataset.tier = tier;
  const canvas = $('#gl');
  const lbar = $('#lbar');
  const setLoad = (p) => lbar && (lbar.style.width = `${Math.round(p * 100)}%`);
  setLoad(0.08);

  // ---- renderer --------------------------------------------------------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
  } catch (e) {
    return fail('sin contexto WebGL', e);
  }
  renderer.info.autoReset = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const isGL2 = renderer.capabilities.isWebGL2;
  const hdr = isGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));

  let dpr = Math.min(window.devicePixelRatio || 1, T.dpr);
  let cssW = canvas.clientWidth || innerWidth;
  let cssH = canvas.clientHeight || innerHeight;
  renderer.setPixelRatio(dpr);
  renderer.setSize(cssW, cssH, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.FogExp2(COL.bg, 0.0095);
  const camera = new THREE.PerspectiveCamera(55, cssW / cssH, 0.1, 1200);

  const env = makeEnv(renderer);
  scene.environment = env;
  scene.environmentIntensity = 0.95;

  // luces que siguen a la cámara (cantidad constante → sin recompilar shaders)
  const hemi = new THREE.HemisphereLight(0x8b6cff, 0x0b0618, 0.55);
  const keyL = new THREE.PointLight(0x9d6bff, 160, 70, 2);
  const fillL = new THREE.PointLight(0x22c8ff, 110, 70, 2);
  scene.add(hemi, keyL, fillL);

  // ---- logo ------------------------------------------------------------
  const logoImg = new Image();
  logoImg.decoding = 'async';
  logoImg.src = 'assets/logo-z.webp';
  await new Promise((res) => {
    logoImg.onload = res;
    logoImg.onerror = res;
    setTimeout(res, 6000);
  });
  let logoSource = logoImg;
  if (!logoImg.naturalWidth) {
    // plan B: dibujamos una "Z" simple si el logo no cargó
    const c = document.createElement('canvas');
    c.width = 336;
    c.height = 314;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 336, 314);
    gr.addColorStop(0, '#8b3dff');
    gr.addColorStop(1, '#22d3ee');
    g.fillStyle = gr;
    g.font = '800 300px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Z', 168, 160);
    logoSource = c;
  }
  const logoTex = new THREE.Texture(logoSource);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  logoTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  logoTex.needsUpdate = true;
  setLoad(0.25);

  // ---- mundo -----------------------------------------------------------
  const M = makeMaterials(tier);
  const st = { pointer: { x: 0, y: 0 }, cam: camera, pr: dpr, compilePct: 0 };
  const ctx = { M, tier, logoTex, logoImg: logoSource };

  const backdrop = makeBackdrop(T.oct);
  scene.add(backdrop);
  const dust = makeDust(T.dust, -SPACING * 5 - 60, 70);
  scene.add(dust);
  const streaks = makeStreaks(T.streaks);
  scene.add(streaks);

  const worlds = [];
  BUILDERS.forEach((b, i) => {
    try {
      const w = b(ctx);
      w.group.position.set(0, 0, -SPACING * i);
      w.anchor = -SPACING * i;
      w.range = [i / 6, (i + 1) / 6];
      w.vis = w.anchorVis || 78;
      scene.add(w.group);
      worlds.push(w);
    } catch (e) {
      console.error(`[zenix-3d] escena ${i + 1} falló y se omite`, e);
      worlds.push(null);
    }
    setLoad(0.25 + ((i + 1) / 6) * 0.4);
  });

  // portales hexagonales entre escenas
  const gateGeo = new THREE.TorusGeometry(9.5, 0.1, 6, 6);
  const gateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.violet).multiplyScalar(2.6) });
  const gateMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(COL.cyan).multiplyScalar(2.2) });
  const gates = [];
  for (let i = 1; i < 6; i++) {
    const gr = new THREE.Group();
    gr.position.set(0, 0.8, -SPACING * i + 50);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(gateGeo, k % 2 ? gateMat2 : gateMat);
      m.scale.setScalar(1 - k * 0.24);
      m.position.z = -k * 0.9;
      m.rotation.z = Math.PI / 6;
      gr.add(m);
    }
    scene.add(gr);
    gates.push(gr);
  }

  // ---- cámara guiada ---------------------------------------------------
  const toWorld = ([p, t], i) => {
    const sc = Math.floor(i / 4);
    const z0 = -SPACING * Math.min(sc, 5);
    return [new THREE.Vector3(p[0], p[1], p[2] + z0), new THREE.Vector3(t[0], t[1], t[2] + z0)];
  };
  const kfw = KF.map(toWorld);
  const posCurve = new THREE.CatmullRomCurve3(kfw.map((k) => k[0]), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(kfw.map((k) => k[1]), false, 'centripetal');
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3();

  // ---- postproceso -----------------------------------------------------
  const rtType = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const samples = isGL2 && !q.has('msaa0') ? T.msaa : 0;
  const rt = new THREE.WebGLRenderTarget(cssW * dpr, cssH * dpr, { type: rtType, samples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(cssW * dpr * T.bloomScale, cssH * dpr * T.bloomScale), T.bloom, 0.55, 1.05);
  composer.addPass(bloom);
  const fin = new ShaderPass(FinalShader);
  composer.addPass(fin);
  composer.addPass(new OutputPass());
  if (q.has('nobloom')) bloom.enabled = false;
  if (q.has('nofinal')) fin.enabled = false;

  function applySize() {
    composer.setPixelRatio(dpr);
    composer.setSize(cssW, cssH);
    bloom.setSize(cssW * dpr * T.bloomScale, cssH * dpr * T.bloomScale);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH;
    // en pantallas verticales ampliamos el campo de visión para que entre la escena
    camera.fov = 55 + clamp(1.25 - camera.aspect, 0, 1) * 26;
    if (camera.aspect > 1.35 && !q.has('nooffset')) camera.setViewOffset(cssW, cssH, -cssW * 0.055, 0, cssW, cssH);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    st.pr = dpr;
    dust.material.uniforms.uPR.value = dpr;
  }
  applySize();

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
      if (w === cssW && h === cssH) return;
      cssW = w;
      cssH = h;
      applySize();
      measure();
    }, 120);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  // ---- DOM / HUD -----------------------------------------------------------
  const caps = $$('.cap');
  const dots = $$('.rail button');
  const idxN = $('#idxN');
  const idxName = $('#idxName');
  const progBar = $('#progress i');
  const capState = caps.map(() => -1);
  let curIdx = -1;

  let maxScroll = 1;
  function measure() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }
  measure();
  window.addEventListener('load', measure);

  dots.forEach((b, i) => {
    b.addEventListener('click', () => {
      measure();
      const target = clamp(i / 6 + (i === 0 ? 0 : 0.05)) * maxScroll;
      window.scrollTo({ top: target, behavior: 'smooth' });
    });
  });

  if (!coarse) {
    window.addEventListener('pointermove', (e) => {
      st.pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      st.pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }
  st.pointer.tx = 0;
  st.pointer.ty = 0;

  // ---- depuración opcional -----------------------------------------------------
  let dbg = null;
  if (q.has('debug')) {
    dbg = document.createElement('pre');
    dbg.style.cssText = 'position:fixed;left:8px;top:60px;z-index:99;margin:0;padding:6px 8px;font:11px/1.35 ui-monospace,monospace;color:#9ff;background:rgba(0,0,0,.6);pointer-events:none';
    document.body.appendChild(dbg);
  }

  // ---- estado de animación ---------------------------------------------------
  let prog = 0, target = 0, time = 0, last = performance.now();
  const prevCam = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let speed = 0, lastHeld = -1;
  let frames = 0, accDt = 0, accN = 0, degrade = 0, fps = 60;
  let running = true;
  const tint = [new THREE.Color(), new THREE.Color()];

  function setScenesFor(camZ, all = false) {
    worlds.forEach((w) => {
      if (!w) return;
      w.group.visible = all || Math.abs(camZ - w.anchor) < w.vis;
    });
  }

  function placeCamera(p, t) {
    posCurve.getPoint(p, tmpP);
    tgtCurve.getPoint(p, tmpT);
    // pequeño balanceo de "cámara en mano"
    tmpP.x += Math.sin(t * 0.37) * 0.12;
    tmpP.y += Math.sin(t * 0.53 + 1) * 0.1;
    camera.position.copy(tmpP);
    camera.lookAt(tmpT);
    if (!coarse) {
      camera.translateX(st.pointer.x * 0.55);
      camera.translateY(-st.pointer.y * 0.32);
    }
  }

  function updateWorld(dt) {
    setScenesFor(camera.position.z);
    worlds.forEach((w, i) => {
      if (!w || !w.group.visible) return;
      const u = clamp((prog - w.range[0]) / (w.range[1] - w.range[0]));
      w.update(u, time, dt, st);
    });
    // portales: pulsan al acercarse
    gates.forEach((gr, i) => {
      const d = Math.abs(camera.position.z - gr.position.z);
      gr.visible = d < 120;
      const near = 1 - smooth(4, 60, d);
      gr.children.forEach((m, k) => {
        m.rotation.z = Math.PI / 6 + time * 0.1 * (k % 2 ? -1 : 1) + near * 0.8 * (k + 1);
        m.scale.setScalar((1 - k * 0.24) * (1 + near * 0.12 * Math.sin(time * 3 + k)));
      });
    });
  }

  function updateBackdrop() {
    const f = prog * 6;
    const i = Math.min(5, Math.floor(f));
    const j = Math.min(5, i + 1);
    const k = smooth(0.7, 1, f - i);
    tint[0].copy(TINTS[i][0]).lerp(TINTS[j][0], k);
    tint[1].copy(TINTS[i][1]).lerp(TINTS[j][1], k);
    const u = backdrop.material.uniforms;
    u.uA.value.copy(tint[0]);
    u.uB.value.copy(tint[1]);
    u.uTime.value = time;
    backdrop.position.copy(camera.position);
  }

  function updateHud() {
    // subtítulos
    caps.forEach((el, i) => {
      const l = clamp(prog * 6 - i, 0, 1);
      let a = i === 0 ? 1 - smooth(0.74, 0.92, l) : smooth(0.06, 0.22, l) * (i === 5 ? 1 : 1 - smooth(0.74, 0.92, l));
      a = Math.round(a * 200) / 200;
      if (a === capState[i]) return;
      capState[i] = a;
      el.style.opacity = a;
      el.style.visibility = a < 0.01 ? 'hidden' : 'visible';
      el.style.transform = `translate3d(0, ${((1 - a) * 22).toFixed(1)}px, 0)`;
      el.style.pointerEvents = i === 5 && a > 0.5 ? 'auto' : 'none';
    });
    const idx = Math.min(5, Math.floor(prog * 6 + 0.1));
    if (idx !== curIdx) {
      curIdx = idx;
      dots.forEach((d, i) => d.classList.toggle('on', i === idx));
      if (idxN) idxN.textContent = String(idx + 1).padStart(2, '0');
      if (idxName) idxName.textContent = NAMES[idx];
      html.dataset.scene = String(idx + 1);
    }
    if (progBar) progBar.style.transform = `scaleX(${prog.toFixed(4)})`;
  }

  // ---- calidad adaptativa: sólo baja, nunca sube -------------------------------
  function adapt(dt) {
    if (forced || q.has('fixed')) return;
    frames++;
    if (frames < 100) return; // calentamiento
    accDt += Math.min(dt, 0.1);
    accN++;
    if (accN >= 70) {
      const avg = accDt / accN;
      fps = 1 / avg;
      accDt = 0;
      accN = 0;
      if (avg > 0.03 && degrade < 3) {
        degrade++;
        if (degrade === 1) dpr = Math.max(0.8, dpr * 0.78);
        else if (degrade === 2) dpr = Math.max(0.7, dpr * 0.8);
        else bloom.enabled = false;
        applySize();
        console.info('[zenix-3d] calidad reducida a nivel', degrade, 'dpr', dpr.toFixed(2), 'fps≈', fps.toFixed(0));
      }
    }
  }

  // ---- bucle -----------------------------------------------------------------
  function frame(now) {
    if (!running) return;
    if (window.__zAbort) { renderer.setAnimationLoop(null); return; }
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 1 / 60;
    const rawDt = dt;
    dt = Math.min(dt, 0.05);
    time += dt;

    target = clamp(window.scrollY / maxScroll);
    prog += (target - prog) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(target - prog) < 0.00012) prog = target;
    if (window.__zHold != null) prog = window.__zHold; // gancho para pruebas

    st.pointer.x += ((st.pointer.tx || 0) - st.pointer.x) * (1 - Math.exp(-dt * 4));
    st.pointer.y += ((st.pointer.ty || 0) - st.pointer.y) * (1 - Math.exp(-dt * 4));

    placeCamera(prog, time);

    // velocidad de la cámara → estelas y aberración cromática
    if (window.__zHold != null && Math.abs(prog - lastHeld) > 0.004) {
      prevCam.copy(camera.position); // salto de prueba: sin falsa velocidad
      speed = 0;
      lastHeld = prog;
    }
    const inst = camera.position.distanceTo(prevCam) / dt;
    vel.copy(camera.position).sub(prevCam).divideScalar(dt);
    prevCam.copy(camera.position);
    speed = lerp(speed, inst, 1 - Math.exp(-dt * 7));
    const amt = smooth(8, 60, speed);
    streaks.visible = amt > 0.02;
    if (streaks.visible) {
      const su = streaks.material.uniforms;
      su.uCam.value.copy(camera.position);
      su.uAmt.value = amt * 0.85;
      su.uTail.value.copy(vel).multiplyScalar(0.075);
      if (su.uTail.value.length() > 9) su.uTail.value.setLength(9);
    }
    fin.uniforms.uCA.value = amt * 0.04;
    fin.uniforms.uTime.value = time;
    dust.material.uniforms.uTime.value = time;

    keyL.position.set(camera.position.x + 6, camera.position.y + 8, camera.position.z - 6);
    fillL.position.set(camera.position.x - 9, camera.position.y - 3, camera.position.z - 16);

    updateBackdrop();
    updateWorld(dt);
    updateHud();
    renderer.info.reset();
    composer.render(dt);
    adapt(rawDt);

    if (dbg && frames % 15 === 0) {
      dbg.textContent = `tier ${tier}${hdr ? '' : ' (sin HDR)'}  dpr ${dpr.toFixed(2)}  fps≈${(1 / dt).toFixed(0)}\nprog ${prog.toFixed(3)} esc ${curIdx + 1}  vel ${speed.toFixed(1)}\ncalls ${renderer.info.render.calls} tri ${renderer.info.render.triangles}`;
    }
  }

  // pérdida de contexto GL (típico en móviles al cambiar de app)
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    running = false;
    console.warn('[zenix-3d] contexto WebGL perdido');
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  // ---- precalentamiento: compila shaders y sube texturas con el loader visible -----
  setLoad(0.7);
  try {
    setScenesFor(0, true);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  } catch (e) {
    console.info('[zenix-3d] compileAsync no disponible', e);
  }
  setLoad(0.82);
  for (let i = 0; i < 6; i++) {
    const w = worlds[i];
    if (!w) continue;
    worlds.forEach((o) => o && (o.group.visible = o === w));
    const k = KF[i * 4];
    const z0 = -SPACING * i;
    camera.position.set(k[0][0], k[0][1], k[0][2] + z0);
    camera.lookAt(k[1][0], k[1][1], k[1][2] + z0);
    try { w.update(0.3, 0.5, 0.016, st); } catch (e) { /* ya se informa en el bucle */ }
    composer.render(0.016);
    await new Promise((r) => requestAnimationFrame(r));
  }
  setLoad(1);
  last = performance.now();
  renderer.setAnimationLoop(frame);

  // un par de cuadros y se descubre el escenario
  await new Promise((r) => setTimeout(r, 350));
  html.classList.remove('loading');
  html.classList.add('ready');

  // gancho de pruebas / utilidades (inofensivo en producción)
  window.__z = {
    get p() { return prog; },
    get scene() { return curIdx + 1; },
    get fps() { return fps; },
    tier,
    mobile,
    hdr,
    snap() { target = clamp(window.scrollY / maxScroll); prog = target; },
    hold(v) { window.__zHold = v; },
    release() { window.__zHold = null; },
    info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures, dpr, degrade }),
  };
}

boot().catch((e) => fail('error inesperado', e));
