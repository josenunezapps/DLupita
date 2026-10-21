import * as THREE from 'three';
import { PAL, neon } from './util.js';

// Microrelieve de metal cepillado: un par de texturas pequeñas y reutilizadas en todos los materiales.
// No altera geometrías ni incorpora descargas de texturas grandes (128x128, determinista).
function brushedFinish() {
  const size = 128, r = new Uint8Array(size * size * 4), n = new Uint8Array(size * size * 4);
  let seed = 19173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4;
    const grain = (random() - .5) * 28;
    const brush = Math.sin(y * 0.23) * 9 + Math.sin(y * 1.72) * 5;
    const value = Math.max(160, Math.min(249, 225 + brush + grain));
    r[i] = r[i+1] = r[i+2] = value; r[i+3] = 255;
    n[i] = 128 + (random() - .5) * 5;
    n[i+1] = 128 + Math.sin(y * 0.23) * 9 + (random() - .5) * 7;
    n[i+2] = 254; n[i+3] = 255;
  }
  const make = (bytes) => {
    const tex = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 5);
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };
  return { rough: make(r), normal: make(n) };
}

// Materiales compartidos. La calidad (Q.physical) decide si el vidrio usa clearcoat/physical o un material estándar.
export function createMaterials(Q) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o, coat = 0.2) => Q.physical
    ? new THREE.MeshPhysicalMaterial({ ...o, clearcoat: coat, clearcoatRoughness: 0.17 }) : std(o);
  const M = {
    metalDark: std({ color: 0x272050, metalness: 0.92, roughness: 0.36 }),
    metalMid: std({ color: 0x3a3170, metalness: 0.9, roughness: 0.3 }),
    // Estructura arquitectónica grande (anillos, vigas, torres, losas): albedo y metalicidad que responden a la luz de relleno
    // en vez de reflejar solo el fondo negro del entorno (causa de las caras que parecían huecos negros).
    struct: std({ color: 0x3d3482, metalness: 0.8, roughness: 0.4 }),
    metalViolet: phys({ color: 0x3a1f8f, metalness: 0.95, roughness: 0.24 }),
    silver: phys({ color: 0xc9c4e6, metalness: 1.0, roughness: 0.2 }),
    plate: std({ color: 0x0f0b22, metalness: 0.7, roughness: 0.48 }),
    floor: phys({ color: 0x0b0819, metalness: 0.9, roughness: 0.3 }),
    black: std({ color: 0x07050f, metalness: 0.5, roughness: 0.6 }),
    violetGlow: neon(PAL.violet, 2.6),
    electricGlow: neon(PAL.electric, 3.0),
    cyanGlow: neon(PAL.cyan, 2.4),
    iceGlow: neon(PAL.ice, 2.4),
    whiteGlow: neon(0xffffff, 2.8),
    purpleGlow: neon(PAL.purple, 2.2),
    glass: Q.physical
      ? new THREE.MeshPhysicalMaterial({ color: 0x9fb4ff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.02, clearcoat: 0.25, clearcoatRoughness: 0.12, envMapIntensity: 0.15, specularIntensity: 0.3, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: 0x9fb4ff, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.05, depthWrite: false }),
    glassTint: Q.physical
      ? new THREE.MeshPhysicalMaterial({ color: 0x6d4cff, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: 0x6d4cff, metalness: 0.3, roughness: 0.15, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide }),
  };
  const finish = brushedFinish();
  // El mapa de rugosidad introduce reflejos irregulares, el normalMap añade microdetalle.
  // Se usan los mismos mapas en todas las piezas para ahorrar memoria de GPU.
  for (const [mat, strength, reflect] of [
    [M.struct, .10, 1.3], [M.metalDark, .11, 1.18], [M.metalMid, .10, 1.25],
    [M.metalViolet, .10, 1.32], [M.silver, .07, 1.45],
    [M.plate, .08, 1.05], [M.floor, .06, 1.2], [M.black, .05, .8],
  ]) {
    mat.roughnessMap = finish.rough;
    mat.normalMap = finish.normal;
    mat.normalScale = new THREE.Vector2(strength, strength);
    mat.envMapIntensity = reflect;
  }
  return M;
}

// Rejilla de suelo emisiva con desvanecimiento por niebla (sirve para suelos y paneles).
export function gridMaterial({ color = PAL.violet, cell = 4, thick = 0.035, intensity = 1.0, alpha = 0.9 } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCell: { value: cell },
      uThick: { value: thick },
      uI: { value: intensity },
      uA: { value: alpha },
      uFogDensity: { value: 0.01 },
    },
    vertexShader: /* glsl */`
      varying vec3 vW; varying float vD;
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uCell, uThick, uI, uA, uFogDensity;
      varying vec3 vW; varying float vD;
      float line(float v, float w){ float f = abs(fract(v - .5) - .5) / fwidth(v); return 1. - smoothstep(0., 1.5 + w, f); }
      void main(){
        vec2 q = vW.xz / uCell;
        // Las líneas finas se desvanecen cuando la celda mide menos de ~2 px en pantalla (evita moiré/centelleo en la distancia)
        float cellPx = max(fwidth(q.x), fwidth(q.y));
        float g = max(line(q.x, 0.), line(q.y, 0.)) * (1. - smoothstep(.22, .5, cellPx));
        float big = max(line(q.x / 5., 1.), line(q.y / 5., 1.));
        float fog = exp(-uFogDensity * uFogDensity * vD * vD);
        float a = (g * .55 + big * .9) * uA * fog;
        gl_FragColor = vec4(uColor * uI * (0.6 + big), a);
      }`,
  });
  m.extensions = { derivatives: true };
  return m;
}

// Material de "flujo de datos": tubos/cables con pulsos luminosos que viajan. `uAct` (0..1) enciende el flujo solo
// cuando la escena correspondiente está activa. Se usa con TubeGeometry (uv.x recorre el largo del tubo).
export function flowMaterial({ color = PAL.violet, pulse = PAL.cyan, speed = 0.5, density = 6, base = 0.35, fogDensity = 0.0105 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: false,
    uniforms: {
      uTime: { value: 0 }, uAct: { value: 0 }, uSpeed: { value: speed }, uDens: { value: density },
      uColor: { value: new THREE.Color(color) }, uPulse: { value: new THREE.Color(pulse) }, uBase: { value: base },
      uFogColor: { value: new THREE.Color(0x070314) }, uFogDensity: { value: fogDensity }, uSeed: { value: Math.random() * 10 },
    },
    vertexShader: /* glsl */`
      varying float vU; varying float vD; varying vec3 vN;
      void main(){ vU = uv.x; vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform float uTime,uAct,uSpeed,uDens,uBase,uFogDensity,uSeed; uniform vec3 uColor,uPulse,uFogColor;
      varying float vU; varying float vD; varying vec3 vN;
      void main(){
        float x = vU * uDens - uTime * uSpeed + uSeed;
        float f = fract(x);
        float pulse = smoothstep(0., .06, f) * (1. - smoothstep(.06, .42, f));
        float rim = .6 + .4 * abs(normalize(vN).z);
        vec3 c = uColor * (uBase + .25 * uAct) * rim + uPulse * 3.0 * pulse * uAct;
        float fog = exp(-uFogDensity * uFogDensity * vD * vD);
        gl_FragColor = vec4(mix(uFogColor, c, fog), 1.);
      }`,
  });
}
