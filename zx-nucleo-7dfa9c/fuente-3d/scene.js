// ZENIX AR — offline cinematic renderer (original scene, rendered frame-by-frame)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const P = new URLSearchParams(location.search);
const W = +P.get('w') || 1600, H = +P.get('h') || 900;
const SS = +P.get('ss') || 1.5;
const MODE = P.get('mode') || 'desk';
const RW = Math.round(W * SS), RH = Math.round(H * SS);
export const N = 540;

// ---------- utils ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ramp = (f, a, b) => clamp((f - a) / (b - a));
const ss = (x) => x * x * (3 - 2 * x);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const D2R = Math.PI / 180;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Hermite spline through keyframes (non-uniform Catmull-Rom tangents, zero at ends)
function track(keys) {
  const T = keys.map((k) => k[0]);
  return (f, ch) => {
    const V = keys.map((k) => k[1][ch]);
    if (f <= T[0]) return V[0];
    if (f >= T[T.length - 1]) return V[V.length - 1];
    let i = 0; while (f > T[i + 1]) i++;
    const t0 = T[i], t1 = T[i + 1], h = t1 - t0, u = (f - t0) / h;
    const m = (j) => (j <= 0 || j >= T.length - 1 ? 0 : (V[j + 1] - V[j - 1]) / (T[j + 1] - T[j - 1]));
    const m0 = m(i) * h, m1 = m(i + 1) * h;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * V[i] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * V[i + 1] + (u3 - u2) * m1;
  };
}

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(RW, RH, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(30, RW / RH, 0.1, 200);
scene.add(camera);

// ---------- procedural textures ----------
function brushedTexture(seed) {
  const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = 'rgb(120,120,120)'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const y = r() * s, l = 40 + r() * 260, x = r() * s, v = 90 + r() * 80;
    g.strokeStyle = `rgba(${v},${v},${v},${0.10 + r() * 0.25})`; g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y + (r() - 0.5) * 2); g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * s, y = r() * s, rad = 20 + r() * 90, v = 100 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.25)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.3, 1.3);
  t.anisotropy = 8; return t;
}
function glowTexture() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s); return new THREE.CanvasTexture(c);
}

// ---------- studio environment (original, procedural) ----------
function buildEnv() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: 0x050508, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, col, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  panel(7, 1.2, 0xffffff, 2.2, [0, 9, 1.5], [0, 0, 0]);         // top strip softbox
  panel(4, 4, 0xffffff, 0.45, [-2, 8, -3], [0, 0, 0]);         // soft top bounce
  panel(0.9, 9, 0xe8eeff, 5.0, [-9, 1.5, 2], [0, 0, 0]);       // cool strip left
  panel(0.9, 9, 0xb08cff, 4.2, [9, 1.0, -1], [0, 0, 0]);       // violet strip right
  panel(12, 0.6, 0xffffff, 1.6, [0, 0.4, -10], [0, 0, 0]);     // horizon line behind
  panel(3, 2, 0xffffff, 0.9, [3, 2, 9], [0, 0, 0]);            // front fill
  panel(14, 6, 0x0b0814, 1.0, [0, -6, 0], [0, 0, 0]);          // floor bounce
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture; pm.dispose(); return tex;
}
scene.environment = buildEnv();

// ---------- background haze (camera-attached) ----------
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uI: { value: 0 }, uAsp: { value: RW / RH }, uC: { value: new THREE.Vector2(0.5, 0.5) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }`,
  fragmentShader: `varying vec2 vUv; uniform float uI; uniform float uAsp; uniform vec2 uC;
    void main(){ vec2 p=vUv-uC; p.x*=uAsp; float d=length(p);
      vec3 c=vec3(0.026,0.013,0.065)*exp(-d*d*2.8)*uI + vec3(0.006,0.006,0.011)*exp(-d*1.4)*uI;
      gl_FragColor=vec4(c,1.0); }`,
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
bg.frustumCulled = false; bg.renderOrder = -10; scene.add(bg);

// ---------- floor: real reflection + darkening fade ----------
const FLOOR_Y = -2.45;
const ReflShader = {
  name: 'ZenixReflector',
  uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStr: { value: 0.22 } },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv=textureMatrix*vec4(position,1.0); vW=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStr; varying vec4 vUv; varying vec3 vW;
    void main(){ vec4 base=texture2DProj(tDiffuse,vUv); float d=length(vW.xz);
      float fade=1.0-smoothstep(2.0,11.0,d);
      vec3 c=base.rgb*uStr*fade+vec3(0.004,0.004,0.006);
      gl_FragColor=vec4(c,1.0-smoothstep(9.0,24.0,d)); }`,
};
const mirror = new Reflector(new THREE.PlaneGeometry(80, 80), { textureWidth: RW >> 1, textureHeight: RH >> 1, color: 0xffffff, clipBias: 0.003, shader: ReflShader });
mirror.material.transparent = true; mirror.material.depthWrite = true;
mirror.rotation.x = -Math.PI / 2; mirror.position.y = FLOOR_Y; scene.add(mirror);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.55 }));
shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = FLOOR_Y + 0.004; shadowCatcher.receiveShadow = true; scene.add(shadowCatcher);

// ---------- lights ----------
const key = new THREE.SpotLight(0xffffff, 0, 40, 0.55, 0.9, 1.2);
key.position.set(4.5, 7.5, 6.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0012; key.shadow.normalBias = 0.045; key.shadow.radius = 6; key.shadow.camera.near = 3; key.shadow.camera.far = 25;
scene.add(key, key.target);
const rim = new THREE.SpotLight(0x8f63ff, 0, 40, 0.6, 0.9, 1.2); rim.position.set(-6, 3.5, -6); scene.add(rim, rim.target);
const rim2 = new THREE.SpotLight(0xcfd8ff, 0, 40, 0.5, 0.9, 1.2); rim2.position.set(6.5, 1.5, -5); scene.add(rim2, rim2.target);
const sweep = new THREE.SpotLight(0xf2f4ff, 0, 30, 0.35, 0.6, 1.0); scene.add(sweep, sweep.target);
const coreLight = new THREE.PointLight(0x8a4dff, 0, 9, 1.6); coreLight.position.set(0, 0, -0.15); scene.add(coreLight);
const fill = new THREE.HemisphereLight(0x23203a, 0x000000, 0); scene.add(fill);

// ---------- materials ----------
const brushed = brushedTexture(7);
const graphite = new THREE.MeshPhysicalMaterial({
  color: 0x1d1e24, metalness: 1.0, roughness: 0.42, roughnessMap: brushed,
  clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 1.35,
});
const graphiteDark = new THREE.MeshPhysicalMaterial({ color: 0x0f1014, metalness: 0.9, roughness: 0.6, roughnessMap: brushed, envMapIntensity: 0.6 });
const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd9dbe4, metalness: 1.0, roughness: 0.07, envMapIntensity: 1.3 });
const lightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8b52ff).multiplyScalar(0), toneMapped: true });
const lightBase = new THREE.Color(0x8b52ff);
const zMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, vertexColors: true, metalness: 0.82, roughness: 0.15,
  clearcoat: 1.0, clearcoatRoughness: 0.05, iridescence: 0.3, iridescenceIOR: 1.35, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 520,
  emissive: 0x5a22ff, emissiveIntensity: 0, envMapIntensity: 1.25,
});

// ---------- geometry ----------
const R_OUT = 1.75, R_IN = 1.42, DEPTH = 1.0, PET = 0.1;
const hp = (r, a) => new THREE.Vector2(r * Math.cos(a * D2R), r * Math.sin(a * D2R));
function extrude(pts, depth, bevel, seg = 3) {
  const s = new THREE.Shape(pts);
  const g = new THREE.ExtrudeGeometry(s, { depth: depth - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel * 0.5, bevelSegments: seg, curveSegments: 1 });
  g.translate(0, 0, -(depth / 2) + bevel); g.computeVertexNormals(); return g;
}
const GAPA = 0.75;
const segGeo = extrude([hp(R_IN, -30 + GAPA * 1.25), hp(R_OUT, -30 + GAPA), hp(R_OUT, 30 - GAPA), hp(R_IN, 30 - GAPA * 1.25)], DEPTH, 0.035, 4);
const XH = R_IN * Math.cos(30 * D2R) - 0.005; // hinge x
const petalTri = (() => {
  const a = 30 - GAPA * 1.6, r = R_IN - 0.012;
  const v1 = hp(r, -a), v2 = hp(r, a);
  const g = extrude([new THREE.Vector2(0.045, 0), v1, v2], PET, 0.018, 3);
  g.translate(-XH, 0, -PET / 2); // hinge-local: x in [-XH,0], z in [-PET,0]
  return g;
})();

const zColorA = new THREE.Color(0x2418ff), zColorB = new THREE.Color(0xb83cff);
function zPiece(pts, depth, zOff) {
  const g = extrude(pts.map((p) => new THREE.Vector2(p[0], p[1])), depth, 0.05, 6);
  g.translate(0, 0, zOff);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = clamp((pos.getX(i) * 0.45 - pos.getY(i) * 0.55 + 1.1) / 2.2);
    c.copy(zColorA).lerp(zColorB, t); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}

// Z emblem (original 3-piece folded ribbon)
const zGroup = new THREE.Group(); scene.add(zGroup);
// ZX: cinta plegada. Bandas superior/inferior + diagonal (Z) y dos pliegues claros
// cuyas aristas dibujan la segunda diagonal (X). Simetría de 180° como el logo.
const foldMat = new THREE.MeshPhysicalMaterial({
  color: 0xc98cff, vertexColors: true, metalness: 0.55, roughness: 0.17, clearcoat: 1.0, clearcoatRoughness: 0.05,
  emissive: 0xb45cff, emissiveIntensity: 0.0, envMapIntensity: 1.15, iridescence: 0.35, iridescenceIOR: 1.3,
});
const rot = (p) => [-p[0], -p[1]];
const T  = [[-0.95, 0.644], [-0.70, 1.006], [0.606, 1.006], [1.033, 0.644]];
const DG = [[0.44, 0.644], [1.033, 0.644], [-0.44, -0.644], [-1.033, -0.644]];
// arista izquierda de la diagonal: de (-1.033,-0.644) a (0.44,0.644); el vértice del pliegue cae sobre ella
const yA = 0.06, xA = -1.033 + ((yA + 0.644) / 1.288) * (0.44 + 1.033);
const F1 = [[-0.95, 0.62], [0.40, 0.62], [xA - 0.02, yA]];
const zTop  = new THREE.Mesh(zPiece(T, 0.32, 0.0), zMat);
const zBot  = new THREE.Mesh(zPiece(T.map(rot), 0.32, 0.0), zMat);
const zDiag = new THREE.Mesh(zPiece(DG, 0.36, 0.035), zMat);
function foldPiece(pts) {
  const g = extrude(pts.map((p) => new THREE.Vector2(p[0], p[1])), 0.2, 0.04, 5);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), A = new THREE.Color(0xffd6f4), B = new THREE.Color(0x8a3dff);
  for (let i = 0; i < pos.count; i++) { const t = clamp(Math.abs(pos.getX(i)) * 0.75 - 0.05); c.copy(A).lerp(B, t); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const zF1 = new THREE.Mesh(foldPiece(F1), foldMat);
const zF2 = new THREE.Mesh(foldPiece(F1.map(rot)), foldMat);
zF1.position.z = zF2.position.z = -0.03;
[zTop, zDiag, zBot, zF1, zF2].forEach((m) => { m.castShadow = true; zGroup.add(m); });

// core glow behind Z
const glowTex = glowTexture();
const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x7a3dff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
coreGlow.scale.set(4.2, 4.2, 1); coreGlow.position.set(0, 0, -0.35); scene.add(coreGlow);

// seam glow (light leaking between closed petals)
const seamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8b52ff), transparent: true, opacity: 0, depthWrite: false });
const seamGeo = new THREE.CircleGeometry(R_IN - 0.02, 6); seamGeo.rotateZ(0);
const seam = new THREE.Mesh(seamGeo, seamMat); seam.position.z = 0.36; scene.add(seam);
const seamBack = new THREE.Mesh(seamGeo, seamMat); seamBack.position.z = -0.36; scene.add(seamBack);

// modules
const modules = [];
const lightMats = [];
for (let k = 0; k < 6; k++) {
  const pivot = new THREE.Group(); scene.add(pivot);
  const seg = new THREE.Mesh(segGeo, graphite); seg.castShadow = true; pivot.add(seg);
  const xo = R_OUT * Math.cos(30 * D2R), xm = (R_IN + R_OUT) / 2 * Math.cos(30 * D2R), xi = R_IN * Math.cos(30 * D2R);
  // chrome trim on front & back faces
  for (const zz of [DEPTH / 2 + 0.004, -DEPTH / 2 - 0.004]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.25, 0.012), chrome); t.position.set(xo - 0.09, 0, zz); pivot.add(t);
  }
  // status light on front face + long slot on outer face (unique material per module for staggered boot)
  const lm = lightMat.clone(); lightMats.push(lm);
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.012), lm); st.position.set(xm - 0.02, 0.62, DEPTH / 2 + 0.006); pivot.add(st);
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.7), lm); slot.position.set(xo - 0.006, 0, 0); pivot.add(slot);
  const slotFrame = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.11, 0.78), graphiteDark); slotFrame.position.set(xo - 0.011, 0, 0); pivot.add(slotFrame);
  // inner face connectors (seen once exploded)
  for (const yy of [-0.42, 0, 0.42]) {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 20), chrome);
    cyl.rotation.z = Math.PI / 2; cyl.position.set(xi - 0.015, yy, 0); pivot.add(cyl);
  }
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.0, 0.035), lm); inner.position.set(xi - 0.004, 0, 0.22); pivot.add(inner);
  // petals
  const mk = (sign) => {
    const h = new THREE.Group(); h.position.set(XH, 0, sign * DEPTH / 2);
    const p = new THREE.Mesh(petalTri, graphite); p.castShadow = true;
    if (sign < 0) p.scale.z = -1; // mirror for back
    h.add(p);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.014, 0.01), chrome);
    ridge.position.set(-0.62, 0, sign * 0.004); h.add(ridge);
    pivot.add(h); return h;
  };
  modules.push({ pivot, front: mk(1), back: mk(-1), theta: 30 + 60 * k });
}

// particles
const PN = 700, pr = rng(3), pPos = new Float32Array(PN * 3), pSeed = new Float32Array(PN);
for (let i = 0; i < PN; i++) { pPos[i * 3] = (pr() - 0.5) * 22; pPos[i * 3 + 1] = FLOOR_Y + pr() * 8; pPos[i * 3 + 2] = (pr() - 0.5) * 22; pSeed[i] = pr(); }
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos.slice(), 3));
const pMat = new THREE.PointsMaterial({ map: glowTex, color: 0xb9a8ff, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const points = new THREE.Points(pGeo, pMat); scene.add(points);

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(RW, RH, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(RW, RH);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c=texture2D(tDiffuse,vUv);
    if(any(isnan(c))||any(isinf(c))) c=vec4(0.0,0.0,0.0,1.0); gl_FragColor=min(c,vec4(3.2)); }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(RW, RH), 0.5, 0.6, 1.0); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uV: { value: 1.0 }, uCA: { value: 0.0012 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uV; uniform float uCA; varying vec2 vUv;
    void main(){ vec2 d=vUv-0.5; float r=dot(d,d);
      vec3 c; c.r=texture2D(tDiffuse,vUv+d*uCA*r*8.0).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,vUv-d*uCA*r*8.0).b;
      c*=mix(1.0, smoothstep(0.95,0.18,r*1.6), uV*0.85);
      gl_FragColor=vec4(c,1.0); }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());
const dither = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uSeed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSeed; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed)*43758.5453); }
    void main(){ vec4 c=texture2D(tDiffuse,vUv); c.rgb+=(h(gl_FragCoord.xy)-0.5)/255.0*1.2; gl_FragColor=c; }`,
});
composer.addPass(dither);

// ---------- camera tracks ----------
//         f     az   el   dist  tx    ty    tz    fov  sx
const CAM = track([
  [0,   [-26, -7, 7.8, 0, 0.15, 0, 28, 0.15]],
  [55,  [-40, -2, 4.0, 0.85, 0.55, 0.45, 25, 0.04]],
  [100, [-26, 5, 6.6, 0.15, 0.05, 0.0, 28, 0]],
  [130, [-18, 7, 8.0, 0, 0, 0, 30, 0.12]],
  [175, [-6, 4, 7.1, 0, 0, 0, 30, 0.02]],
  [212, [0, 2, 6.3, 0, 0, 0, 30, 0]],
  [250, [26, 12, 8.2, 0, 0.1, 0, 32, 0]],
  [292, [52, 24, 10.6, 0, 0, 0, 34, 0]],
  [335, [16, 15, 11.0, 0, 0.15, 0.4, 32, 0.07]],
  [455, [-8, 13, 11.0, 0, 0.15, 0.4, 32, 0.07]],
  [500, [-4, 6, 10.5, 0, 0.1, 0, 31, 0]],
  [539, [-10, 4, 7.4, 0, 0.0, 0, 30, 0.2]],
]);
const CH = { az: 0, el: 1, dist: 2, tx: 3, ty: 4, tz: 5, fov: 6, sx: 7 };

function setCamera(f) {
  const c = (n) => CAM(f, CH[n]);
  let dist = c('dist'), fov = c('fov'), sx = c('sx'), sy = 0;
  if (MODE === 'mob') {
    const t = Math.tan(fov * 0.5 * D2R) * 1.8; fov = 2 * Math.atan(t) / D2R; dist *= 1.22; sx = 0; sy = 0.12;
  }
  if (f > 335 && f < 455) { const u = (f - 335) / 20, fr = u - Math.floor(u); dist -= 1.1 * Math.sin(Math.PI * clamp(fr / 0.75)) * (MODE === 'mob' ? 1.2 : 1); }
  const az = c('az') * D2R, el = c('el') * D2R, tg = new THREE.Vector3(c('tx'), c('ty'), c('tz'));
  camera.position.set(tg.x + dist * Math.cos(el) * Math.sin(az), tg.y + dist * Math.sin(el), tg.z + dist * Math.cos(el) * Math.cos(az));
  camera.fov = fov; camera.aspect = RW / RH; camera.updateProjectionMatrix();
  camera.lookAt(tg);
  // lens shift: positive sx moves subject right, sy moves subject up
  camera.projectionMatrix.elements[8] -= 2 * sx;
  camera.projectionMatrix.elements[9] -= 2 * sy;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  bgMat.uniforms.uC.value.set(0.5 + sx, 0.5 + sy);
}

// ---------- module choreography ----------
const tmpQ = new THREE.Quaternion(), qA = new THREE.Quaternion(), qD = new THREE.Quaternion();
const vX = new THREE.Vector3(1, 0, 0), vY = new THREE.Vector3(0, 1, 0), vZ = new THREE.Vector3(0, 0, 1);
const M_CENTER = 1.45;
function serviceSpin(f) {
  // 6 services, 20 frames each; hold 8 then turn 60deg
  const u = clamp((f - 335) / 120) * 6;
  const i = Math.min(5, Math.floor(u)), fr = u - i;
  const turn = i < 5 ? eio(clamp((fr - 0.4) / 0.6)) : 0;
  return (i + turn) * 60;
}
function setModules(f) {
  const open = eio(ramp(f, 176, 214)) * (1 - eio(ramp(f, 282, 330))); // abrir / volver a cerrar en cuñas
  const unlock = ss(ramp(f, 150, 172)) * (1 - ramp(f, 214, 240));
  const expl = eio(ramp(f, 212, 278));                 // radial explode
  const tilt = eio(ramp(f, 262, 336));                 // ring to horizontal
  const spinIn = 30 * eio(ramp(f, 212, 300));          // in-plane spin
  const spinY = -serviceSpin(f) * D2R;
  const toHalo = eio(ramp(f, 452, 515));
  const ringQ = new THREE.Quaternion().setFromAxisAngle(vY, spinY).multiply(new THREE.Quaternion().setFromAxisAngle(vX, tilt * 84 * D2R));
  const rOff = 0.035 * unlock + 1.25 * expl + 0.9 * tilt;
  // which module faces the camera-right slot during services
  let activeK = -1, best = -9, pop = 0;
  if (f >= 335 && f < 455) {
    for (let k = 0; k < 6; k++) {
      const c0 = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion().copy(ringQ).multiply(tmpQ.setFromAxisAngle(vZ, (modules[k].theta + spinIn) * D2R)));
      const sc = c0.z * Math.cos(30 * D2R) + c0.x * Math.sin(30 * D2R);
      if (sc > best) { best = sc; activeK = k; }
    }
    const fr = (((f - 335) / 20) % 1);
    pop = 0.6 * ss(ramp(fr, 0.0, 0.2)) * (1 - ss(ramp(fr, 0.38, 0.62)));
  }
  for (let k = 0; k < 6; k++) {
    const m = modules[k];
    const beta = (m.theta + spinIn) * D2R;
    qA.copy(ringQ).multiply(tmpQ.setFromAxisAngle(vZ, beta));
    const stagger = Math.sin(k * 2.1) * 0.35 * expl * (1 - tilt);
    const center = new THREE.Vector3(rOff + (k === activeK ? pop : 0) + M_CENTER, 0, stagger).applyQuaternion(qA);
    let q = qA.clone(), scale = 1;
    if (toHalo > 0) {
      // final: los seis módulos se retiran hacia la oscuridad y dejan sola la marca ZX
      const w = toHalo * toHalo * (3 - 2 * toHalo);
      const dir = new THREE.Vector3(center.x, 0, center.z); if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0); dir.normalize();
      const cD = dir.clone().multiplyScalar(9).add(new THREE.Vector3(0, (k % 2 ? 1.6 : -0.4), -16 - k * 0.8));
      center.lerp(cD, w);
      q.multiply(tmpQ.setFromAxisAngle(vY, w * (k % 2 ? 1 : -1) * 1.2));
      scale = 1 - 0.25 * w;
    }
    m.pivot.quaternion.copy(q); m.pivot.scale.setScalar(scale);
    m.pivot.position.copy(center).sub(new THREE.Vector3(M_CENTER * scale, 0, 0).applyQuaternion(q));
    m.front.rotation.y = 90 * D2R * open;
    m.back.rotation.y = -90 * D2R * open;
    m.front.position.z = DEPTH / 2 + 0.02 * unlock; m.back.position.z = -DEPTH / 2 - 0.02 * unlock;
    // lights: staggered boot, steady, finale peak
    const boot = ss(ramp(f, 148 + k * 4, 160 + k * 4));
    const svc = k === activeK ? 0.4 + pop * 1.6 : 0;
    const lvl = boot * (0.7 + 0.6 * ss(ramp(f, 480, 530))) + svc * 1.0 + 0.6 * Math.max(0, Math.sin(f * 0.21 + k)) * boot * 0.25;
    lightMats[k].color.copy(lightBase).multiplyScalar(lvl * (1 - 0.85 * toHalo));
  }
}

// ---------- per-frame state ----------
function setFrame(f) {
  setCamera(f);
  setModules(f);
  const reveal = ss(ramp(f, 4, 115));
  scene.environmentIntensity = 0.38 + 0.62 * reveal;
  key.intensity = 170 * (0.2 + 0.8 * ss(ramp(f, 25, 120)));
  rim.intensity = 80;
  rim2.intensity = 90 * ss(ramp(f, 30, 110));
  const sw = ramp(f, -10, 105);
  sweep.position.set(-7 + 14 * sw, 2.6, 5.5); sweep.target.position.set(0.6 - 1.2 * sw, 0.3, 0);
  sweep.intensity = 90 * Math.sin(Math.PI * sw) * (f < 105 ? 1 : 0);
  fill.intensity = 0.6 * reveal;
  bgMat.uniforms.uI.value = 0.15 + 0.85 * reveal + 0.5 * ss(ramp(f, 470, 539));
  // seams & core
  const seamI = (0.22 + 0.78 * ss(ramp(f, 118, 168))) * (1 - ss(ramp(f, 176, 200)));
  seamMat.opacity = seamI; seamMat.color.copy(lightBase).multiplyScalar(1.5 + Math.sin(f * 0.35) * 0.25);
  const core = ss(ramp(f, 172, 222));
  const fin = ss(ramp(f, 470, 532));
  coreGlow.material.opacity = 0.32 * core + 0.25 * fin;
  coreGlow.scale.setScalar(4.0 + 1.2 * fin);
  coreLight.intensity = 9 * core + 8 * fin;
  zMat.emissiveIntensity = 0.03 * core + 0.08 * fin;
  foldMat.emissiveIntensity = 0.05 * core + 0.12 * fin;
  // Z motion
  const zs = eio(ramp(f, 214, 455)) * Math.PI * 2;
  zGroup.rotation.set(Math.sin(f * 0.02) * 0.04 * core, zs + Math.sin(f * 0.015) * 0.05 * core, 0);
  zGroup.position.y = Math.sin(f * 0.03) * 0.04 * core;
  // particles drift
  const pa = pGeo.attributes.position;
  for (let i = 0; i < PN; i++) {
    pa.array[i * 3 + 1] = pPos[i * 3 + 1] + ((f * 0.004 * (0.4 + pSeed[i])) % 8);
    if (pa.array[i * 3 + 1] > FLOOR_Y + 8) pa.array[i * 3 + 1] -= 8;
    pa.array[i * 3] = pPos[i * 3] + Math.sin(f * 0.01 + pSeed[i] * 6.28) * 0.15;
  }
  pa.needsUpdate = true;
  pMat.opacity = 0.5 * ss(ramp(f, 40, 140));
  dither.uniforms.uSeed.value = f * 1.37;
}

// ---------- output ----------
const out = document.createElement('canvas'); out.width = W; out.height = H;
const octx = out.getContext('2d'); octx.imageSmoothingEnabled = true; octx.imageSmoothingQuality = 'high';
window.renderFrame = (f) => {
  setFrame(f);
  if (window.override) window.override();
  composer.render();
  octx.drawImage(renderer.domElement, 0, 0, W, H);
  return out.toDataURL('image/png');
};
window.N = N;

window.ready = true;
