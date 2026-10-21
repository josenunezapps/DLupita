import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { PAL, rng, smooth, smoother, clamp, lerp, hexRingGeometry, canvasTexture, neon, FX } from '../util.js';
import { gridMaterial } from '../materials.js';
import { text3D } from '../parts.js';
import { Z_POLY, Z_BOX, HEX } from '../logo-data.js';

// ESCENA 6 · Gran cierre: sala tecnológica con el logo hexagonal de Zenix AR en 3D (marco hexagonal + Z plegada
// extruidos con el diseño del logo original), que se revela progresivamente con el avance.
export function buildFinale(ctx) {
  const { M, Q, col, textures, logoTex } = ctx;
  const g = new THREE.Group();
  g.name = 'finale';
  const low = Q.detail === 'low';
  const FLOOR = -4, LZ = -535, LY = 4.3;

  // --- Suelo de la sala: reflejo plano real (solo gama alta) o suelo pulido con rejilla
  const HW = 76, HL = 124, HCZ = -512;
  let reflector = null;
  if (Q.reflector) {
    const tw = Math.round(Math.min(1024, 640 * Math.max(1, Q.dpr)));
    reflector = new Reflector(new THREE.PlaneGeometry(HW, HL), { color: new THREE.Color(0x4a3b86), textureWidth: tw, textureHeight: tw, clipBias: 0.003 });
    reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, FLOOR, HCZ);
    g.add(reflector);
  }
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(HW, HL), new THREE.MeshStandardMaterial({ color: 0x07040f, metalness: 0.4, roughness: 0.45, transparent: true, opacity: reflector ? 0.62 : 0.97 }));
  veil.rotation.x = -Math.PI / 2; veil.position.set(0, FLOOR + 0.01, HCZ); veil.receiveShadow = Q.shadows;
  g.add(veil);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(HW, HL), gridMaterial({ color: PAL.violet, cell: 4, intensity: 1.0, alpha: 0.7 }));
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, FLOOR + 0.025, HCZ);
  g.add(grid);
  col.boxRaw([-HW / 2, FLOOR - 1, HCZ - HL / 2], [HW / 2, FLOOR, HCZ + HL / 2], 'hall-floor');

  // --- Columnas hexagonales con vetas luminosas
  const NC = 7;
  const colGeo = new THREE.CylinderGeometry(1.8, 2.1, 30, 6);
  const cols = new THREE.InstancedMesh(colGeo, M.metalDark, NC * 2);
  const cstr = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 30, 0.14), M.violetGlow, NC * 2);
  const cring = new THREE.InstancedMesh(new THREE.TorusGeometry(2.05, 0.07, 6, 6), M.cyanGlow, NC * 2 * 3);
  const d = new THREE.Object3D();
  let ci = 0, ri = 0;
  for (let k = 0; k < NC; k++) for (const s of [-1, 1]) {
    const x = s * 17, z = -476 - k * 12.5;
    d.rotation.set(0, 0, 0); d.scale.setScalar(1);
    d.position.set(x, FLOOR + 14, z); d.updateMatrix(); cols.setMatrixAt(ci, d.matrix);
    d.position.set(x - s * 1.55, FLOOR + 14, z + 0.9); d.updateMatrix(); cstr.setMatrixAt(ci, d.matrix);
    for (let j = 0; j < 3; j++) { d.position.set(x, FLOOR + 3 + j * 8, z); d.rotation.set(Math.PI / 2, 0, 0); d.updateMatrix(); cring.setMatrixAt(ri++, d.matrix); }
    col.boxRaw([x - 2.2, FLOOR, z - 2.2], [x + 2.2, FLOOR + 29, z + 2.2], 'hall-col-' + ci);
    ci++;
  }
  g.add(cols, cstr, cring);

  // --- Techo: vigas y barras de luz
  const beamGeo = new THREE.BoxGeometry(38, 0.7, 1.1);
  const lightBar = neon(0xdfd2ff, 1.5);
  for (let k = 0; k < NC + 1; k++) {
    const z = -470 - k * 12.5;
    const b = new THREE.Mesh(beamGeo, M.metalDark); b.position.set(0, FLOOR + 27, z); g.add(b);
    const lb = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 0.22), lightBar); lb.position.set(0, FLOOR + 26.6, z); g.add(lb);
    col.boxRaw([-19, FLOOR + 26.5, z - 0.6], [19, FLOOR + 27.5, z + 0.6], 'hall-beam-' + k);
  }

  // --- Muro de fondo: anillos hexagonales concéntricos
  [[26, 23.4, PAL.violet], [20, 18.2, PAL.cyan], [14, 12.6, PAL.electric]].forEach(([Ro, Ri, c], i) => {
    const m = new THREE.Mesh(hexRingGeometry(Ro, Ri, 1.2, 0.08), i === 1 ? M.metalMid : M.metalDark); m.position.set(0, LY + 2, -574 - i * 1.5); g.add(m);
    const gl = new THREE.Mesh(hexRingGeometry(Ri + 0.3, Ri - 0.14, 1.4, 0), neon(c, 2.2)); gl.position.copy(m.position); g.add(gl);
  });

  // --- Pedestal hexagonal y anillos de contexto
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 9, 0.9, 6), M.metalDark); ped.position.set(0, FLOOR + 0.45, LZ); g.add(ped);
  const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 0.12, 6), M.black); pedTop.position.set(0, FLOOR + 0.96, LZ); g.add(pedTop);
  const pedGlow = new THREE.Mesh(new THREE.TorusGeometry(7.7, 0.07, 6, 6), M.electricGlow); pedGlow.rotation.x = Math.PI / 2; pedGlow.position.set(0, FLOOR + 1.0, LZ); g.add(pedGlow);
  col.boxRaw([-9, FLOOR, LZ - 9], [9, FLOOR + 1.1, LZ + 9], 'pedestal');
  const gyro = [8.4, 9.9].map((r, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 128), i ? M.cyanGlow : M.violetGlow);
    t.position.set(0, LY, LZ - 1); g.add(t); return t;
  });
  const ztext = text3D(ctx, 'ZENIX AR', 1.5, { depth: 0.22, mat: M.electricGlow });
  if (ztext) { ztext.rotation.x = -Math.PI / 2; ztext.position.set(0, FLOOR + 1.1, LZ + 12); g.add(ztext); }

  // --- LOGO ZENIX AR en 3D (unidades de px del logo original; se escala al final) ---
  const S = 0.0235;
  const logo = new THREE.Group(); logo.position.set(0, LY, LZ); logo.scale.setScalar(S); g.add(logo);
  const revealU = [];
  // Inyección de revelado: corte progresivo con borde luminoso (modo 'a' = barrido angular desde arriba, 'y' = vertical)
  const revealize = (mat, mode, color = [0.65, 0.45, 1.0]) => {
    const u = { uR: { value: 0 }, uEdge: { value: new THREE.Vector3(...color) } };
    revealU.push(u);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uR = u.uR; sh.uniforms.uEdge = u.uEdge;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj; uniform float uR; uniform vec3 uEdge;\nfloat revT(){ ' +
        (mode === 'a' ? 'return abs(atan(vObj.x, vObj.y)) / 3.14159265;' : 'return clamp((vObj.y + 175.) / 350., 0., 1.);') + ' }')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float _t = revT(); if (_t > uR) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float _e = smoothstep(.07, .0, uR - _t) * step(uR, .995); totalEmissiveRadiance += uEdge * _e * 3.2;');
    };
    mat.customProgramCacheKey = () => 'reveal-' + mode;
    return mat;
  };
  const rt = (pts, sx = 1, sy = 1, r = HEX.corner) => {
    // Polígono hexagonal redondeado (coordenadas px, Y hacia arriba)
    const P = [[0, HEX.halfH], [HEX.halfW, HEX.vy], [HEX.halfW, -HEX.vy], [0, -HEX.halfH], [-HEX.halfW, -HEX.vy], [-HEX.halfW, HEX.vy]].map(([x, y]) => [x * sx, y * sy]);
    const sh = new THREE.Path();
    const n = P.length;
    const pt = (i) => new THREE.Vector2(...P[(i + n) % n]);
    for (let i = 0; i < n; i++) {
      const a = pt(i - 1), b = pt(i), c = pt(i + 1);
      const l1 = a.clone().sub(b).normalize(), l2 = c.clone().sub(b).normalize();
      const rr = Math.min(r * Math.min(sx, sy), a.distanceTo(b) * 0.45, c.distanceTo(b) * 0.45);
      const p1 = b.clone().add(l1.multiplyScalar(rr)), p2 = b.clone().add(l2.multiplyScalar(rr));
      if (i === 0) sh.moveTo(p1.x, p1.y); else sh.lineTo(p1.x, p1.y);
      sh.quadraticCurveTo(b.x, b.y, p2.x, p2.y);
    }
    sh.closePath();
    return sh;
  };
  const toShape = (path) => { const s = new THREE.Shape(path.getPoints(10)); return s; };
  const band = toShape(rt(null, 1, 1));
  const hole = rt(null, (HEX.halfW - HEX.band) / HEX.halfW, (HEX.halfH - HEX.band) / HEX.halfH);
  band.holes.push(new THREE.Path(hole.getPoints(10).reverse()));
  const ext = { depth: 44, bevelEnabled: true, bevelThickness: 8, bevelSize: 6, bevelSegments: 3, curveSegments: 6 };
  const frameMat = revealize(new THREE.MeshPhysicalMaterial({ color: 0x5b2fd6, metalness: 0.92, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12, emissive: 0x3a1aa0, emissiveIntensity: 0.35, envMapIntensity: 1.0 }), 'a');
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(band, ext), frameMat);
  frame.position.z = -22; frame.castShadow = Q.shadows; logo.add(frame);
  // Hilo interior (el segundo contorno fino del logo) y borde exterior luminoso
  const inner = toShape(rt(null, 0.835, 0.862)); inner.holes.push(new THREE.Path(rt(null, 0.805, 0.835).getPoints(10).reverse()));
  const innerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(inner, { depth: 30, bevelEnabled: false }), revealize(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa88bff).multiplyScalar(1.7 * FX.k), toneMapped: false }), 'a'));
  innerMesh.position.z = -15; logo.add(innerMesh);
  const outer = toShape(rt(null, 1.02, 1.017)); outer.holes.push(new THREE.Path(rt(null, 0.997, 0.997).getPoints(10).reverse()));
  const outerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 10, bevelEnabled: false }), revealize(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb48cff).multiplyScalar(2.2 * FX.k), toneMapped: false }), 'a'));
  outerMesh.position.z = -30; logo.add(outerMesh);
  // La "Z" plegada: silueta trazada del logo original, extruida con cara texturizada con el diseño original
  const zs = new THREE.Shape(Z_POLY.map(([x, y]) => new THREE.Vector2(x, -y)));
  const zg = new THREE.ExtrudeGeometry(zs, { depth: 56, bevelEnabled: true, bevelThickness: 7, bevelSize: 5, bevelSegments: 3, curveSegments: 4 });
  const pos = zg.attributes.position, uv = zg.attributes.uv;
  const [bx0, by0, bx1, by1] = Z_BOX;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bx0) / (bx1 - bx0), 1 - ((-pos.getY(i)) - by0) / (by1 - by0));
  const zFace = revealize(new THREE.MeshStandardMaterial({ map: logoTex || null, color: logoTex ? 0xffffff : 0x7a4dff, emissive: 0xffffff, emissiveMap: logoTex || null, emissiveIntensity: logoTex ? 0.18 : 0.2, metalness: 0.5, roughness: 0.32, envMapIntensity: 1.2 }), 'y', [0.5, 0.8, 1.0]);
  const zSide = revealize(new THREE.MeshPhysicalMaterial({ color: 0x6b3fff, metalness: 0.95, roughness: 0.18, clearcoat: 1, emissive: 0x4a22c8, emissiveIntensity: 0.7 }), 'y', [0.5, 0.8, 1.0]);
  const zMesh = new THREE.Mesh(zg, [zFace, zSide]);
  zMesh.position.z = -22; zMesh.castShadow = Q.shadows; logo.add(zMesh);
  // Halo trasero (hexágono suave aditivo)
  const haloTex = canvasTexture(256, 256, (c, W, H) => { const gr = c.createRadialGradient(W / 2, H / 2, 6, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(170,120,255,.85)'); gr.addColorStop(0.35, 'rgba(120,70,255,.35)'); gr.addColorStop(1, 'rgba(60,20,160,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, H); });
  textures.push(haloTex.tex);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), new THREE.MeshBasicMaterial({ map: haloTex.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  halo.position.z = -70; logo.add(halo);

  // Partículas de ensamblado: viajan desde el espacio hasta el contorno del logo
  const NP = low ? 260 : Q.detail === 'med' ? 560 : 1000;
  const r = rng(404);
  const aS = new Float32Array(NP * 3), aT = new Float32Array(NP * 3), aD = new Float32Array(NP), aC = new Float32Array(NP * 3), aZ = new Float32Array(NP);
  const hexPts = rt(null, 1, 1).getPoints(40), zPts = Z_POLY.map(([x, y]) => new THREE.Vector2(x, -y));
  const cc = [new THREE.Color(PAL.electric), new THREE.Color(PAL.cyan), new THREE.Color(0xffffff)];
  for (let i = 0; i < NP; i++) {
    const useZ = r() < 0.4, arr = useZ ? zPts : hexPts;
    const a = arr[Math.floor(r() * arr.length)], b = arr[(Math.floor(r() * arr.length) + 1) % arr.length];
    const t = r(); const tx = lerp(a.x, b.x, t), ty = lerp(a.y, b.y, t);
    aT.set([tx, ty, (r() - 0.5) * 60], i * 3);
    const ang = r() * Math.PI * 2, rad = 700 + r() * 1400;
    aS.set([Math.cos(ang) * rad, Math.sin(ang) * rad * 0.7, -900 + r() * 700], i * 3);
    aD[i] = r() * 0.55; aZ[i] = useZ ? 1 : 0;
    const c = cc[Math.floor(r() * 3)]; aC.set([c.r, c.g, c.b], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(aT, 3));
  pg.setAttribute('aStart', new THREE.BufferAttribute(aS, 3));
  pg.setAttribute('aDelay', new THREE.BufferAttribute(aD, 1));
  pg.setAttribute('aColor', new THREE.BufferAttribute(aC, 3));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uR: { value: 0 }, uFade: { value: 1 }, uScale: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aStart; attribute float aDelay; attribute vec3 aColor; uniform float uR, uFade, uScale; varying vec3 vC; varying float vA;
      void main(){
        float t = clamp((uR * 1.6 - aDelay) / .85, 0., 1.); t = t * t * (3. - 2. * t);
        vec3 p = mix(aStart, position, t);
        p.xy += vec2(sin(t * 6. + aDelay * 20.), cos(t * 6. + aDelay * 20.)) * 40. * (1. - t);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * (14. + 10. * (1. - t)) / max(-mv.z, .1) * 30., 1.5, 26.);
        vC = aColor; vA = (0.15 + 0.85 * smoothstep(0., .2, t)) * uFade;
      }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(vC * 2.2 * a * vA, a * vA); }`,
  });
  const parts = new THREE.Points(pg, pMat); parts.frustumCulled = false; logo.add(parts);

  // Conos de luz cinematográficos sobre el logo
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uI: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uI; void main(){ float f = pow(vUv.y, 1.4) * smoothstep(1., .55, vUv.y) * .0 + pow(1. - vUv.y, 1.8); gl_FragColor = vec4(vec3(.5,.3,1.) * f * uI, f * uI * .35); }`,
  });
  [[-11, 0.2], [11, -0.2], [0, 0]].forEach(([x, rz], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 7.5, 30, 28, 1, true), coneMat);
    c.position.set(x * 1.0, FLOOR + 14, LZ + (i === 2 ? 6 : -2)); c.rotation.z = rz;
    g.add(c);
  });

  // Luces del logo (intensidad ligada a la revelación)
  const keyL = new THREE.PointLight(0x9a5bff, 0, 70, 1.3); keyL.position.set(0, LY + 2, LZ + 10); g.add(keyL);
  const rimL = new THREE.PointLight(0x22d3ee, 0, 60, 1.3); rimL.position.set(-9, LY + 3, LZ - 6); g.add(rimL);
  const rimR = new THREE.PointLight(0xc084fc, 0, 60, 1.3); rimR.position.set(9, LY + 1, LZ - 6); g.add(rimR);
  col.boxRaw([-7, FLOOR, LZ - 3], [7, LY + 7, LZ + 3], 'logo');

  return {
    group: g,
    range: [0.80, 1.01],
    resize() { if (reflector) { /* el Reflector se redimensiona solo con la cámara */ } },
    degrade() { if (reflector) reflector.visible = false; },
    update(s) {
      const p = s.p;
      // Revelación del logo ligada al avance (y reversible)
      const R = smoother(0.872, 0.975, p);
      revealU[0].uR.value = smooth(0.0, 0.6, R);        // marco: barrido desde arriba
      revealU[1].uR.value = smooth(0.1, 0.7, R);        // hilo interior
      revealU[2].uR.value = smooth(0.15, 0.75, R);      // borde exterior
      revealU[3].uR.value = smooth(0.42, 0.9, R);       // Z: barrido vertical
      revealU[4].uR.value = smooth(0.42, 0.9, R);
      pMat.uniforms.uR.value = smooth(0.0, 0.75, R);
      pMat.uniforms.uFade.value = 1 - smooth(0.78, 1.0, R) * 0.92;
      pMat.uniforms.uScale.value = s.Q.dpr * 0.5;
      halo.material.opacity = smooth(0.35, 1, R) * 0.32;
      coneMat.uniforms.uI.value = smooth(0.3, 1, R) * 0.45;
      keyL.intensity = 55 * smooth(0.25, 1, R);
      rimL.intensity = 70 * smooth(0.4, 1, R); rimR.intensity = 70 * smooth(0.4, 1, R);
      // El logo gira apenas mientras la cámara lo rodea y queda de frente al llegar
      logo.rotation.y = (1 - smooth(0.9, 0.985, p)) * -0.5 + (smooth(0.93, 0.965, p) - smooth(0.965, 1, p)) * 0.12;
      logo.position.y = LY + (1 - smooth(0.87, 0.97, p)) * 1.2;
      gyro[0].rotation.set(1.2 + p * 3, p * 6, 0); gyro[1].rotation.set(-0.9 - p * 2, p * -4, 0.5);
      gyro.forEach((gm, i) => { gm.scale.setScalar(0.2 + 0.8 * smooth(0.2, 0.95, R)); });
    },
  };
}
