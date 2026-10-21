import * as THREE from 'three';
import { PAL, neon, rng } from './util.js';

// ---------------------------------------------------------------------------------------------------------------
// Mapas PBR procedurales (256², deterministas, reutilizados): normal + rugosidad. Sin descargas de texturas.
// ---------------------------------------------------------------------------------------------------------------
const SZ = 256;
function lattice(seed, cells) {
  const r = rng(seed), v = new Float32Array(cells * cells);
  for (let i = 0; i < v.length; i++) v[i] = r();
  return v;
}
function vnoise(x, y, cells, lat) {   // ruido de valor periódico, x,y en [0,1)
  const fx = x * cells, fy = y * cells, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = lat[(iy % cells) * cells + (ix % cells)], b = lat[(iy % cells) * cells + ((ix + 1) % cells)];
  const c = lat[((iy + 1) % cells) * cells + (ix % cells)], d = lat[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(seed, base, oct) {
  const H = new Float32Array(SZ * SZ);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const cells = base << o, lat = lattice(seed + o * 17, cells);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) H[y * SZ + x] += amp * vnoise(x / SZ, y / SZ, cells, lat);
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < H.length; i++) H[i] /= tot;
  return H;
}
const RECIPES = {
  // Hormigón/panel arquitectónico: grano, juntas cada 128 px y tornillos en las esquinas.
  concrete(seed) {
    const H = fbm(seed, 4, 4), R = fbm(seed + 99, 6, 3), r = rng(seed);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const i = y * SZ + x, gx = x % 128, gy = y % 128;
      let h = H[i] * 0.55 + (r() - 0.5) * 0.06;
      if (gx < 2 || gy < 2) h -= 0.55;
      else if (gx < 4 || gy < 4) h -= 0.12;
      for (const [cx, cy] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
        const dx = (gx - cx), dy = (gy - cy);
        if (dx * dx + dy * dy < 14) h += 0.35;
      }
      H[i] = h; R[i] = 0.62 + R[i] * 0.34 + ((gx < 3 || gy < 3) ? 0.2 : 0);
    }
    return { H, R, k: 3.2 };
  },
  // Metal cepillado anodizado: vetas finas horizontales.
  brushed(seed) {
    const H = new Float32Array(SZ * SZ), R = new Float32Array(SZ * SZ), r = rng(seed);
    const rows = new Float32Array(SZ); for (let y = 0; y < SZ; y++) rows[y] = r();
    const lat = lattice(seed + 3, 8);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const i = y * SZ + x, s = rows[y] * 0.6 + vnoise(x / SZ, y / SZ, 8, lat) * 0.3 + r() * 0.1;
      H[i] = s * 0.5; R[i] = 0.7 + s * 0.3;
    }
    return { H, R, k: 1.2 };
  },
  // Baldosa pulida de gran formato: juntas finas cada 128 px, variación sutil.
  tile(seed) {
    const H = fbm(seed, 3, 3), R = new Float32Array(SZ * SZ), r = rng(seed);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const i = y * SZ + x, gx = x % 128, gy = y % 128, seam = gx < 2 || gy < 2;
      H[i] = H[i] * 0.12 + (seam ? -0.7 : 0);
      R[i] = seam ? 1 : 0.72 + H[i] * 0.4 + r() * 0.06;
    }
    return { H, R, k: 2.2 };
  },
  // Chapa perforada: rejilla de agujeros circulares.
  perf(seed) {
    const H = new Float32Array(SZ * SZ), R = new Float32Array(SZ * SZ), r = rng(seed);
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const i = y * SZ + x, gx = (x % 16) - 8, gy = (y % 16) - 8, d = Math.sqrt(gx * gx + gy * gy);
      H[i] = d < 4.2 ? -1 : (d < 5.2 ? -0.35 : 0) + r() * 0.02; R[i] = d < 4.2 ? 1 : 0.65 + r() * 0.1;
    }
    return { H, R, k: 2.6 };
  },
  // Roca volcánica húmeda/basalto pulido: ruido amplio con brillo variable.
  basalt(seed) {
    const H = fbm(seed, 5, 5), R = fbm(seed + 7, 4, 3);
    for (let i = 0; i < H.length; i++) { R[i] = 0.35 + R[i] * 0.55; }
    return { H, R, k: 3.4 };
  },
  // Superficie técnica muy fina (plásticos, goma, carcasas).
  grain(seed) {
    const H = fbm(seed, 16, 3), R = fbm(seed + 5, 8, 2);
    for (let i = 0; i < R.length; i++) R[i] = 0.78 + R[i] * 0.22;
    return { H, R, k: 0.9 };
  },
};
const MAPS = {};
export function pbrMaps(kind, seed = 1) {
  const key = kind + seed;
  if (MAPS[key]) return MAPS[key];
  const { H, R, k } = RECIPES[kind](seed);
  const n = new Uint8Array(SZ * SZ * 4), ro = new Uint8Array(SZ * SZ * 4);
  for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
    const i = y * SZ + x, xl = H[y * SZ + ((x + SZ - 1) % SZ)], xr = H[y * SZ + ((x + 1) % SZ)];
    const yu = H[((y + SZ - 1) % SZ) * SZ + x], yd = H[((y + 1) % SZ) * SZ + x];
    let nx = (xl - xr) * k, ny = (yu - yd) * k, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    n[i * 4] = (nx * 0.5 + 0.5) * 255; n[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; n[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; n[i * 4 + 3] = 255;
    const rv = Math.max(0, Math.min(1, R[i])) * 255;
    ro[i * 4] = 255; ro[i * 4 + 1] = rv; ro[i * 4 + 2] = 255; ro[i * 4 + 3] = 255;
  }
  const mk = (bytes) => {
    const t = new THREE.DataTexture(bytes, SZ, SZ, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true; return t;
  };
  return (MAPS[key] = { normal: mk(n), rough: mk(ro) });
}

// ---------------------------------------------------------------------------------------------------------------
// Biblioteca de materiales PBR. La dirección de arte es sobria: grafito, negro satinado, aluminio y blanco, con el
// violeta como acento de identidad. Los emisivos son pocos y se usan solo donde hay una luz o una pantalla real.
// ---------------------------------------------------------------------------------------------------------------
export function createMaterials(Q) {
  const phys = Q.physical;
  const std = (o, kind, seed = 1, ns = 0.6) => {
    let m;
    if (phys && (o.clearcoat || o.sheen)) m = new THREE.MeshPhysicalMaterial(o);
    else { const { clearcoat, clearcoatRoughness, sheen, sheenColor, sheenRoughness, ...rest } = o; m = new THREE.MeshStandardMaterial(rest); }
    if (kind) { const t = pbrMaps(kind, seed); m.normalMap = t.normal; m.roughnessMap = t.rough; m.normalScale = new THREE.Vector2(ns, ns); }
    return m;
  };
  const M = {
    concrete: std({ color: 0x5c5c64, metalness: 0.0, roughness: 0.82 }, 'concrete', 11, 0.9),
    concreteDark: std({ color: 0x34343b, metalness: 0.0, roughness: 0.78 }, 'concrete', 23, 0.9),
    basalt: std({ color: 0x1a1920, metalness: 0.15, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.35 }, 'basalt', 5, 0.8),
    graphite: std({ color: 0x3a3944, metalness: 0.85, roughness: 0.42 }, 'brushed', 3, 0.5),
    graphiteDark: std({ color: 0x1c1c22, metalness: 0.8, roughness: 0.5 }, 'brushed', 8, 0.5),
    aluminum: std({ color: 0xc9cad2, metalness: 1.0, roughness: 0.32 }, 'brushed', 5, 0.4),
    whitePaint: std({ color: 0xa9a8b3, metalness: 0.0, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 }, 'grain', 4, 0.2),
    blackPlastic: std({ color: 0x0d0d11, metalness: 0.0, roughness: 0.5 }, 'grain', 2, 0.4),
    blackGloss: std({ color: 0x08080b, metalness: 0.1, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }),
    rubber: std({ color: 0x121216, metalness: 0.0, roughness: 0.92 }, 'grain', 6, 0.8),
    floorPolished: std({ color: 0x101015, metalness: 0.0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12 }, 'tile', 9, 0.5),
    floorMatte: std({ color: 0x25242c, metalness: 0.0, roughness: 0.6 }, 'tile', 14, 0.5),
    perfMetal: std({ color: 0x15151a, metalness: 0.9, roughness: 0.4 }, 'perf', 1, 1.0),
    violetMetal: std({ color: 0x5a34c4, metalness: 0.85, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 }, 'brushed', 12, 0.3),
    violetSatin: std({ color: 0x3a2290, metalness: 0.6, roughness: 0.45 }, 'grain', 3, 0.3),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfd2ff, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, envMapIntensity: 1.2 }),
    glassFrost: new THREE.MeshPhysicalMaterial({ color: 0xf2f1ff, metalness: 0, roughness: 0.35, transparent: true, opacity: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.3, depthWrite: true, envMapIntensity: 1.1 }),
    glassViolet: new THREE.MeshPhysicalMaterial({ color: 0x8b5cff, metalness: 0, roughness: 0.18, transparent: true, opacity: 0.5, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: true, envMapIntensity: 1.3 }),
    // Emisivos (se usan con mesura: luminarias, pantallas, indicadores)
    glowWhite: neon(0xffffff, 2.2),
    glowSoft: neon(0xf1eeff, 1.5),
    glowViolet: neon(PAL.violet, 2.4),
    glowCyan: neon(PAL.cyan, 2.0),
  };
  // Alias de compatibilidad con piezas reutilizadas (monitores, rótulos)
  Object.assign(M, {
    metalDark: M.graphiteDark, metalMid: M.graphite, metalViolet: M.violetMetal, silver: M.aluminum, plate: M.graphiteDark,
    floor: M.floorPolished, black: M.blackPlastic, violetGlow: M.glowViolet, electricGlow: M.glowViolet, cyanGlow: M.glowCyan,
    iceGlow: M.glowSoft, whiteGlow: M.glowWhite, purpleGlow: M.glowViolet, glassTint: M.glassViolet, struct: M.graphite,
  });
  // Cristales de pantalla: reflejo muy leve para no velar el contenido
  // Cristal de pantalla: solo un reflejo diagonal muy tenue (un vidrio físico veló el contenido; así se conserva el contraste)
  const sheen = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d'); const gr = x.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,.075)'); gr.addColorStop(0.42, 'rgba(255,255,255,.012)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.02)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return c; })());
  sheen.colorSpace = THREE.SRGBColorSpace;
  M.screenGlass = new THREE.MeshBasicMaterial({ map: sheen, transparent: true, depthWrite: false, toneMapped: false });
  M.glass_ = M.glass;
  return M;
}

// Rejilla fina (marcas de suelo muy sutiles). Se conserva para detalles puntuales.
export function gridMaterial({ color = PAL.violet, cell = 4, thick = 0.035, intensity = 1.0, alpha = 0.9 } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uCell: { value: cell }, uI: { value: intensity }, uA: { value: alpha }, uFogDensity: { value: 0.01 } },
    vertexShader: /* glsl */`varying vec3 vW; varying float vD; void main(){ vec4 wp = modelMatrix * vec4(position,1.); vW = wp.xyz; vec4 mv = viewMatrix * wp; vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uCell, uI, uA, uFogDensity; varying vec3 vW; varying float vD;
      float line(float v){ float f = abs(fract(v - .5) - .5) / fwidth(v); return 1. - smoothstep(0., 1.5, f); }
      void main(){
        vec2 q = vW.xz / uCell; float px = max(fwidth(q.x), fwidth(q.y));
        float g = max(line(q.x), line(q.y)) * (1. - smoothstep(.22, .5, px));
        float fog = exp(-uFogDensity * uFogDensity * vD * vD);
        gl_FragColor = vec4(uColor * uI, g * uA * fog);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  m.extensions = { derivatives: true };
  return m;
}

// Cable/fibra con pulsos de datos: base discreta, y pulsos que viajan solo cuando `uAct` activa el flujo.
export function flowMaterial({ color = PAL.violet, pulse = 0xffffff, speed = 0.5, density = 6, base = 0.25, fogDensity = 0.0105 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAct: { value: 0 }, uSpeed: { value: speed }, uDens: { value: density },
      uColor: { value: new THREE.Color(color) }, uPulse: { value: new THREE.Color(pulse) }, uBase: { value: base },
      uFogColor: { value: new THREE.Color(0x07060c) }, uFogDensity: { value: fogDensity }, uSeed: { value: Math.random() * 10 },
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
        float pulse = smoothstep(0., .05, f) * (1. - smoothstep(.05, .30, f));
        float rim = .5 + .5 * abs(normalize(vN).z);
        vec3 c = uColor * (uBase + .2 * uAct) * rim + uPulse * 2.4 * pulse * uAct;
        float fog = exp(-uFogDensity * uFogDensity * vD * vD);
        gl_FragColor = vec4(mix(uFogColor, c, fog), 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
