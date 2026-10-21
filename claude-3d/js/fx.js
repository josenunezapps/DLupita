// Efectos globales: entorno PMREM, fondo nebuloso, polvo, estelas de velocidad y pase final.
import * as THREE from 'three';
import { rng, COL } from './common.js';

// Entorno de "estudio" con paneles emisivos violeta/cian para que los metales tengan reflejos.
export function makeEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x06030d);
  const add = (w, h, d, x, y, z, col, k) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) }));
    m.position.set(x, y, z);
    s.add(m);
  };
  add(34, 1, 8, 0, 13, 0, 0xffffff, 3.2);
  add(1, 12, 22, -15, 2, 0, COL.violet, 4.2);
  add(1, 12, 22, 15, 2, 0, COL.cyan, 3.4);
  add(24, 7, 1, 0, 1, -15, 0xb28cff, 2.4);
  add(24, 5, 1, 0, 0, 15, COL.violet2, 1.6);
  add(22, 1, 12, 0, -11, 3, COL.purple, 2.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.04);
  pm.dispose();
  return rt.texture;
}

// Esfera inversa con nebulosa fbm (colores según la escena) que acompaña a la cámara.
export function makeBackdrop(oct = 4) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    defines: { OCT: oct },
    uniforms: {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(COL.purple) },
      uB: { value: new THREE.Color(0x0e7490) },
      uAmt: { value: 1 },
    },
    vertexShader: `
      varying vec3 vD;
      void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vD; uniform float uTime, uAmt; uniform vec3 uA, uB;
      float hash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x){
        vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < OCT; i++){ s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= .5; } return s; }
      void main(){
        vec3 d = normalize(vD);
        float n  = fbm(d * 2.2 + vec3(0., uTime * .012, 0.));
        float n2 = fbm(d * 4.6 - vec3(uTime * .016, 0., 0.) + 5.);
        float band = smoothstep(.38, .92, n) * .95 + smoothstep(.52, 1., n2) * .4;
        vec3 col = mix(uA, uB, smoothstep(.2, .85, n2)) * band * .6;
        float h = 1. - abs(d.y);
        col += uA * .1 * pow(h, 3.);
        gl_FragColor = vec4(col * uAmt, 1.);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

// Polvo cósmico: puntos suaves a lo largo de todo el recorrido.
export function makeDust(count, zMin, zMax) {
  const r = rng(5);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * 110;
    pos[i * 3 + 1] = (r() - 0.5) * 60;
    pos[i * 3 + 2] = zMin + r() * (zMax - zMin);
    seed[i * 2] = 0.6 + r() * 1.6;
    seed[i * 2 + 1] = r() * 6.283;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aS', new THREE.BufferAttribute(seed, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: `
      attribute vec2 aS; uniform float uTime, uPR; varying float vA; varying vec3 vC;
      void main(){
        vec3 p = position + vec3(sin(uTime * .2 + aS.y) * .7, cos(uTime * .17 + aS.y * 1.7) * .7, 0.);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float d = -mv.z;
        vA = smoothstep(170., 40., d) * smoothstep(1., 7., d) * (.45 + .55 * sin(uTime * 1.4 + aS.y * 5.));
        vC = mix(vec3(.6, .4, 1.), vec3(.45, .92, 1.), step(1.9, aS.x));
        gl_PointSize = clamp(aS.x * uPR * 44. / d, 1., 14. * uPR);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main(){ float r = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., r); gl_FragColor = vec4(vC * 1.4, a * a * vA); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Estelas de velocidad alrededor de la cámara (todo en GPU, con wrap alrededor de la cámara).
export function makeStreaks(count) {
  const r = rng(9);
  const pos = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2 * 4);
  for (let i = 0; i < count; i++) {
    const a = r(), b = r(), c = r();
    // ambos vértices comparten xyz; w = 0 (cabeza) / 1 (cola)
    for (let k = 0; k < 2; k++) {
      const o = (i * 2 + k) * 4;
      seed[o] = a; seed[o + 1] = b; seed[o + 2] = c; seed[o + 3] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTail: { value: new THREE.Vector3() }, uAmt: { value: 0 } },
    vertexShader: `
      attribute vec4 aSeed; uniform vec3 uCam, uTail; uniform float uAmt; varying float vA; varying float vH;
      void main(){
        vec3 box = vec3(44., 28., 76.);
        vec3 sp = aSeed.xyz * box;
        vec3 rel = mod(sp - uCam, box) - box * .5;
        float rr = length(rel.xy);
        rel.xy += normalize(rel.xy + vec2(1e-4)) * max(0., 3.2 - rr);
        vec3 wp = uCam + rel + uTail * aSeed.w * (.5 + aSeed.x);
        vA = (1. - aSeed.w * .9) * uAmt * (.3 + aSeed.y * .7);
        vH = aSeed.z;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
      }`,
    fragmentShader: `
      varying float vA; varying float vH;
      void main(){ vec3 c = mix(vec3(.62, .45, 1.), vec3(.55, .95, 1.), step(.78, vH)); gl_FragColor = vec4(c * 1.6, vA); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.visible = false;
  return lines;
}

// Viñeta + aberración cromática (según velocidad) + grano. Se aplica antes del tone mapping.
export const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0 }, uVig: { value: 0.8 }, uGrain: { value: 0.02 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uGrain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - .5; float d = dot(c, c);
      vec2 off = c * uCA * d * 2.;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1. - uVig * d * 1.35;
      float n = h(vUv * vec2(1920., 1080.) + fract(uTime) * 91.) - .5;
      col = col * (1. + n * uGrain * 4.) + n * uGrain * .08;
      gl_FragColor = vec4(max(col, 0.), 1.);
    }`,
};
