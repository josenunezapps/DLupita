import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';

import { clamp, smooth, makeColliders, hitsCollider, FX } from './util.js';
import { createMaterials } from './materials.js';
import { buildEnvironment } from './env.js';
import { sampleCamera } from './camera.js';
import { atmosAt } from './atmos.js';
import { UI } from './ui.js';
import { buildEntrance } from './scenes/s1-entrance.js';
import { buildStudio } from './scenes/s2-studio.js';
import { buildFoundry } from './scenes/s3-foundry.js';
import { buildAnalytics } from './scenes/s4-analytics.js';
import { buildDatacenter } from './scenes/s5-datacenter.js';
import { buildHall } from './scenes/s6-hall.js';

const params = new URLSearchParams(location.search);
const ui = new UI();

// ---------------------------------------------------------------- Calidad adaptable
function detectQuality() {
  const ua = navigator.userAgent || '';
  const coarse = matchMedia('(pointer:coarse)').matches;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && Math.min(innerWidth, innerHeight) < 820);
  const mem = navigator.deviceMemory || (mobile ? 3 : 8);
  const cores = navigator.hardwareConcurrency || (mobile ? 6 : 8);
  let tier = mobile ? (mem >= 6 && cores >= 8 ? 'medium' : 'low') : (mem >= 8 && cores >= 8 ? 'high' : 'medium');
  const forced = params.get('q');
  if (['low', 'medium', 'high'].includes(forced)) tier = forced;
  const dprRaw = window.devicePixelRatio || 1;
  const T = {
    low:    { dprMax: 1.75, pixels: 1.5e6, bloom: false, shadows: false, reflector: false, physical: false, particles: 900, samples: 0, detail: 'low' },
    medium: { dprMax: 1.5,  pixels: 2.2e6, bloom: true,  shadows: false, reflector: false, physical: true,  particles: 2000, samples: 4, detail: 'med' },
    high:   { dprMax: 2.0,  pixels: 4.5e6, bloom: true,  shadows: true,  reflector: true,  physical: true,  particles: 3600, samples: 4, detail: 'high' },
  }[tier];
  return { tier, mobile, ...T, dpr: Math.min(dprRaw, T.dprMax) };
}

const Q = detectQuality();
FX.k = Q.bloom ? 1 : 0.7;

// ---------------------------------------------------------------- Renderer (con alternativa si no hay WebGL)
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: !Q.bloom,
    powerPreference: 'high-performance', alpha: false, stencil: false,
  });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 no disponible');
} catch (err) {
  console.warn('[Zenix] WebGL no disponible, se muestra la alternativa:', err);
  ui.showFallback();
  throw err;
}
renderer.setPixelRatio(Q.dpr);
renderer.toneMapping = THREE.NeutralToneMapping;   // respeta el color real de los materiales (sin virar a violeta/saturar)
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (Q.shadows) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 900);
scene.add(camera);

const env = buildEnvironment(renderer, scene, Q);
const M = createMaterials(Q);
const col = makeColliders();
const textures = [];     // texturas de canvas para re-subir tras una pérdida de contexto

// Fuente 3D para rótulos con volumen (si falla la carga, las escenas usan rótulos de canvas)
async function loadFont() {
  try {
    const res = await fetch('vendor/addons/fonts/helvetiker_bold.typeface.json');
    return new FontLoader().parse(await res.json());
  } catch (e) { console.warn('[Zenix] fuente 3D no disponible', e); return null; }
}

const ctx = { THREE, renderer, scene, camera, M, Q, col, env, textures, font: null, mobile: Q.mobile };

// ---------------------------------------------------------------- Postproceso
let composer = null, bloom = null, grainPass = null;
function buildComposer() {
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x * Q.dpr, size.y * Q.dpr, { type: THREE.HalfFloatType, samples: Q.samples });
  composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Q.dpr);
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const half = new THREE.Vector2(size.x * (Q.tier === 'high' ? 1 : 0.5), size.y * (Q.tier === 'high' ? 1 : 0.5));
  bloom = new UnrealBloomPass(half, 0.6, 0.55, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // Acabado cinematográfico: grano de película muy fino (rompe el banding de los degradados oscuros) y viñeta suave.
  grainPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.022 }, uVig: { value: 0.32 }, uSat: { value: 0.85 }, uTint: { value: new THREE.Vector3(1.03, 1.0, 0.95) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGrain, uVig, uSat; uniform vec3 uTint; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 q = vUv - .5; float v = 1. - uVig * smoothstep(.25, .85, length(q * vec2(1.1, 1.)));
        float l = dot(c, vec3(.2126, .7152, .0722)); c = mix(vec3(l), c, uSat) * uTint; c *= v; c += (h(vUv * 1024.) - .5) * uGrain; gl_FragColor = vec4(c, 1.); }`,
  });
  composer.addPass(grainPass);
}

// ---------------------------------------------------------------- Escenas
const scenes = [];
async function init() {
  ui.progress(0.05, 'Cargando fuente 3D');
  ctx.font = await loadFont();
  try { ctx.logoTex = await new THREE.TextureLoader().loadAsync('assets/logo-z.webp'); ctx.logoTex.colorSpace = THREE.SRGBColorSpace; ctx.logoTex.anisotropy = 8; textures.push(ctx.logoTex); } catch (e) { console.warn('[Zenix] textura del logo no disponible', e); ctx.logoTex = null; }
  const steps = [
    ['Entrada', buildEntrance], ['Estación de desarrollo', buildStudio], ['Línea de procesamiento', buildFoundry],
    ['Centro de análisis', buildAnalytics], ['Sala de infraestructura', buildDatacenter], ['Sala final', buildHall],
  ];
  let i = 0;
  for (const [name, fn] of steps) {
    ui.progress(0.1 + (0.8 * i) / steps.length, name);
    await new Promise((r) => setTimeout(r, 0));   // cede el hilo para que la barra se pinte
    const s = fn(ctx);
    s.group.visible = false;
    scene.add(s.group);
    scenes.push(s);
    i++;
  }
  if (Q.bloom) buildComposer();
  resize();
  ui.progress(0.97, 'Compilando shaders');
  // Precompila materiales/shaders de todo el recorrido para evitar tirones al avanzar
  scenes.forEach((s) => (s.group.visible = true));
  renderer.compile(scene, camera);
  scenes.forEach((s) => (s.group.visible = false));
  frame(performance.now(), true);
  ui.ready();
  startLoop();
}

// ---------------------------------------------------------------- Tamaño
function resize() {
  const w = Math.max(1, canvas.parentElement.clientWidth || innerWidth);
  const h = Math.max(1, canvas.parentElement.clientHeight || innerHeight);
  // Resolución efectiva: la objetivo (Q.dpr, que baja sola si la fluidez cae) limitada por un presupuesto de píxeles totales.
  const d = Math.min(Q.dpr, Math.sqrt(Q.pixels / (w * h)));
  Q.dprEff = d;
  renderer.setPixelRatio(d);
  renderer.setSize(w, h, false);
  canvas.style.width = '100%'; canvas.style.height = '100%';
  camera.aspect = w / h;
  Q.aspect = w / h;
  if (composer) { composer.setPixelRatio(d); composer.setSize(w, h); if (bloom) bloom.resolution.set(w * (Q.tier === 'high' ? 1 : 0.5), h * (Q.tier === 'high' ? 1 : 0.5)); }
  env.pMat.uniforms.uScale.value = 160 * d * (h / 900);
  scenes.forEach((s) => s.resize && s.resize(w, h));
  ui.measure();
}
let rto;
addEventListener('resize', () => { clearTimeout(rto); rto = setTimeout(resize, 120); });
addEventListener('orientationchange', () => setTimeout(resize, 250));

// ---------------------------------------------------------------- Pérdida de contexto WebGL
let lost = false;
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; ui.notice('Recuperando gráficos…'); }, false);
canvas.addEventListener('webglcontextrestored', () => {
  lost = false; textures.forEach((t) => { t.needsUpdate = true; }); ui.notice(''); resize();
}, false);

// ---------------------------------------------------------------- Bucle principal
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (!Q.mobile) addEventListener('pointermove', (e) => { pointer.tx = (e.clientX / innerWidth) * 2 - 1; pointer.ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let prog = 0, target = 0, lastProg = 0, kick = 0, time = 0, last = performance.now();
let forced = null;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const perf = { acc: 0, n: 0, cool: 0, level: 0 };

function visibility(p) {
  for (const s of scenes) {
    const r = s.range;
    s.group.visible = p >= r[0] && p <= r[1];
  }
}

function frame(now, once = false) {
  const dt = once ? 0.016 : Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now; time += dt;
  target = forced !== null ? forced : ui.scrollProgress();
  const k = 1 - Math.exp(-dt * (reduced ? 14 : 5.2));
  prog += (target - prog) * k;
  if (Math.abs(target - prog) < 0.00002) prog = target;

  const vel = (prog - lastProg) / dt; lastProg = prog;
  kick += (clamp(vel * 22, -1, 1) - kick) * (1 - Math.exp(-dt * 5));

  const { fov, roll } = sampleCamera(prog, camPos, camLook);
  // Compensación para pantallas verticales: se amplía el FOV para que el encuadre siga abarcando lo importante.
  const aspect = camera.aspect;
  // Respiración óptica ligada a la velocidad real de desplazamiento.
  let vfov = fov + Math.abs(kick) * 3.8;
  if (aspect < 1) vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov) / 2) * Math.min(1.9, 0.92 / aspect)));
  camera.fov = Math.min(88, vfov);

  // Paralaje del puntero (solo escritorio) y respiración sutil de cámara
  pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
  pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
  camera.position.copy(camPos);
  const breathe = reduced ? 0 : 1;
  camera.position.x += Math.sin(time * 0.35) * 0.04 * breathe - kick * 0.12;
  camera.position.y += Math.cos(time * 0.29) * 0.035 * breathe + Math.abs(kick) * 0.07;
  camera.up.set(0, 1, 0);
  camera.lookAt(camLook);
  camera.rotateZ(roll - kick * 0.008);
  camera.rotateY(-pointer.x * 0.035 - kick * 0.004);
  camera.rotateX(-pointer.y * 0.022);
  if (Q.aspect < 0.85) {
    // En vertical, desplaza el encuadre hacia arriba para dejar el tercio inferior libre para el texto.
    // Recalcular el offset en cada fotograma reconstruía la matriz de proyección dos veces.
    const h = renderer.domElement.height, w = renderer.domElement.width;
    const offsetY = h * 0.13;
    const view = camera.view;
    if (!view || !view.enabled || view.fullWidth !== w || view.fullHeight !== h ||
        view.width !== w || view.height !== h || view.offsetX !== 0 || view.offsetY !== offsetY) {
      camera.setViewOffset(w, h, 0, offsetY, w, h);
    }
  } else {
    // Composición editorial en horizontal: el sujeto se corre a la derecha y hacia arriba para que el texto (abajo a la izquierda) no lo tape.
    const h = renderer.domElement.height, w = renderer.domElement.width;
    const k = Q.aspect > 1.15 ? 1 : 0.4;
    const ox = Math.round(-w * 0.085 * k * (1 - smooth(0.88, 0.93, prog))), oy = Math.round(h * 0.07 * k);
    const view = camera.view;
    if (!view || !view.enabled || view.fullWidth !== w || view.fullHeight !== h || view.offsetX !== ox || view.offsetY !== oy) camera.setViewOffset(w, h, ox, oy, w, h);
  }
  camera.updateProjectionMatrix();

  visibility(prog);
  const atm = atmosAt(prog);
  const state = { p: prog, dt, time, camera, look: camLook, Q, kick, L: env.lights, atm };
  env.applyAtmos(atm);
  env.update(camera, camLook, time, atm);
  for (const s of scenes) if (s.group.visible) s.update(state);

  if (bloom) bloom.strength = atm.bloom;
  if (grainPass) {
    grainPass.uniforms.uTime.value = (time % 7) * 0.37;
    const k = smooth(0.9, 0.95, prog);            // el final recupera todo el color del logo
    grainPass.uniforms.uSat.value = 0.85 + 0.17 * k; grainPass.uniforms.uTint.value.set(1.03 - 0.03 * k, 1.0, 0.95 + 0.05 * k);
  }
  renderer.toneMappingExposure = atm.exposure;

  if (!lost) {
    if (composer) composer.render(dt); else renderer.render(scene, camera);
  }
  ui.update(prog, time);

  if (!once) adapt(dt);
}

// Ajuste automático de calidad: si la fluidez cae, baja la resolución y luego apaga efectos costosos.
function adapt(dt) {
  if (document.hidden || params.has('noadapt')) return;
  perf.acc += dt; perf.n++;
  if (perf.cool > 0) { perf.cool -= dt; perf.acc = 0; perf.n = 0; return; }
  if (perf.n < 60) return;
  const avg = perf.acc / perf.n;
  perf.acc = 0; perf.n = 0;
  if (avg > 0.026 && perf.level < 5) {
    perf.level++;
    // Primero se baja la resolución de a poco (hasta 3 pasos), recién después se apagan efectos.
    if (perf.level <= 3 && Q.dprEff > 0.85) { Q.dpr = Math.max(0.8, Math.min(Q.dpr, Q.dprEff) - 0.3); resize(); }
    else if (perf.level === 4 && bloom) { bloom.enabled = false; }
    else if (perf.level === 5) { env.particles.visible = false; scenes.forEach((s) => s.degrade && s.degrade()); }
    perf.cool = 2.5;
    ui.debug(`calidad ↓ nivel ${perf.level} (${(avg * 1000).toFixed(1)} ms/frame)`);
  }
}

// Suspendemos el bucle mientras la pestaña está oculta para no consumir CPU/GPU inútilmente.
let running = false, rafId = 0;
function loop(now) {
  if (document.hidden) { running = false; rafId = 0; last = now; return; }
  rafId = requestAnimationFrame(loop);
  frame(now);
}
function startLoop() {
  if (running || document.hidden) return;
  running = true;
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}
addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
  } else startLoop();
});

// ---------------------------------------------------------------- API de diagnóstico (usada en las pruebas)
window.__zenix = {
  Q, ctx,
  setProgress(p) { forced = clamp(p); prog = forced; lastProg = forced; kick = 0; frame(performance.now(), true); },
  release() { forced = null; },
  get progress() { return prog; },
  info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geoms: renderer.info.memory.geometries, tex: renderer.info.memory.textures, tier: Q.tier, dpr: Q.dpr, dprEff: Q.dprEff }; },
  cameraAt(p) { const a = new THREE.Vector3(), b = new THREE.Vector3(); const m = sampleCamera(p, a, b); return { pos: a.toArray(), look: b.toArray(), ...m }; },
  checkCollisions(radius = 0.9, step = 0.0004) {
    const hits = [], a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let p = 0; p <= 1; p += step) {
      sampleCamera(p, a, b);
      for (const c of col.list) if (hitsCollider(c, a, radius)) hits.push({ p: +p.toFixed(4), name: c.name, pos: a.toArray().map((v) => +v.toFixed(2)) });
    }
    return { colliders: col.list.length, hits };
  },
  stepStats(step = 0.0004) {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), a2 = new THREE.Vector3();
    let maxJump = 0, at = 0, len = 0, minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
    sampleCamera(0, a, b);
    for (let p = step; p <= 1; p += step) {
      sampleCamera(p, a2, b);
      const d = a2.distanceTo(a); len += d; if (d > maxJump) { maxJump = d; at = p; }
      minY = Math.min(minY, a2.y); maxY = Math.max(maxY, a2.y); minX = Math.min(minX, a2.x); maxX = Math.max(maxX, a2.x);
      a.copy(a2);
    }
    return { pathLength: len, maxStep: maxJump, at, x: [minX, maxX], y: [minY, maxY] };
  },
};

init().catch((err) => { console.error('[Zenix] error de inicialización', err); ui.showFallback(); });
