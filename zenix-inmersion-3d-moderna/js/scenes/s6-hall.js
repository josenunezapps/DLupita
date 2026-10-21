import * as THREE from 'three';
import { PAL, rng, clamp, lerp, smooth, smoother, texBox, texPlane, canvasTexture, FX } from '../util.js';
import { polishedFloor } from '../parts.js';
import { Z_POLY, Z_BOX, HEX } from '../logo-data.js';

// ESCENA 6 · SALA FINAL — Un gran vestíbulo negro de piedra pulida: columnas monolíticas, un óculo cenital y, sobre el suelo
// espejado, el logo hexagonal violeta de Zenix AR que se revela progresivamente con la luz.
export function buildHall(ctx) {
  const { M, Q, col, textures, logoTex } = ctx;
  const g = new THREE.Group(); g.name = 'hall';
  const sh = Q.shadows;
  const HW = 34, H = 36, ZF = -510, ZB = -652, LEN = ZF - ZB, CZ = (ZF + ZB) / 2;
  const LZ = -604, LY = 10.2, S = 0.0295;
  const d = new THREE.Object3D();

  // ---------- Suelo espejado (reflector real en gama alta; en el resto, copia especular del logo bajo un suelo translúcido)
  const hallFloor = M.floorPolished.clone(); hallFloor.color.set(0x0c0c11); hallFloor.roughness = 0.34; if ('specularIntensity' in hallFloor) hallFloor.specularIntensity = 0.45; if ('clearcoat' in hallFloor) hallFloor.clearcoat = 0; hallFloor.normalScale = new THREE.Vector2(0.12, 0.12); hallFloor.roughnessMap = null; hallFloor.envMapIntensity = 0.7;
  polishedFloor(ctx, g, { w: HW * 2, h: LEN, z: CZ, mat: hallFloor, opacity: Q.reflector ? 0.88 : 0.8, tint: 0x8a85a8, density: 0.05 });
  if (!Q.reflector) {
    // Sin reflector: el suelo es translúcido y deja ver la copia especular. Se reemplaza el material opaco por uno translúcido.
    g.children[g.children.length - 1].material = Object.assign(hallFloor.clone(), { transparent: true, opacity: 0.82, depthWrite: false });
    g.children[g.children.length - 1].renderOrder = 1;
  }
  col.boxRaw([-HW, -1, ZB], [HW, 0, ZF], 'hall-floor');
  // anillo grabado en el suelo alrededor del logo (sutil, a ras)
  const inlay = new THREE.Mesh(new THREE.RingGeometry(11.6, 11.85, 96), M.aluminum); inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, 0.025, LZ); g.add(inlay);
  const inlay2 = new THREE.Mesh(new THREE.RingGeometry(15.6, 15.7, 96), M.aluminum); inlay2.rotation.x = -Math.PI / 2; inlay2.position.set(0, 0.025, LZ); g.add(inlay2);

  // ---------- Envolvente: muro de entrada (con la boca del túnel), muros laterales, muro de fondo con listones, techo con óculo
  const entry = new THREE.Shape(); entry.moveTo(-HW, 0); entry.lineTo(HW, 0); entry.lineTo(HW, H); entry.lineTo(-HW, H); entry.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 5.4, 5.2, 0, Math.PI * 2, true); entry.holes.push(hole);
  const eg = new THREE.ExtrudeGeometry(entry, { depth: 1.2, bevelEnabled: false, curveSegments: 48 });
  { const uv = eg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.14, uv.getY(i) * 0.14); }
  const ew = new THREE.Mesh(eg, M.concreteDark); ew.position.set(0, 0, ZF - 1.2); g.add(ew);
  col.boxRaw([-HW, 0, ZF - 1.4], [-5.4, H, ZF], 'hentryL'); col.boxRaw([5.4, 0, ZF - 1.4], [HW, H, ZF], 'hentryR');
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(texBox(1.2, H, LEN, 0.1), M.concreteDark); w.position.set(s * (HW + 0.6), H / 2, CZ); w.receiveShadow = sh; g.add(w);
    col.boxRaw([s > 0 ? HW - 0.2 : -HW - 1.8, 0, ZB - 1], [s > 0 ? HW + 1.8 : -HW + 0.2, H, ZF], 'hwall' + s);
  }
  const backWall = new THREE.Mesh(texBox(HW * 2 + 4, H, 1.2, 0.1), M.concreteDark); backWall.position.set(0, H / 2, ZB - 0.6); g.add(backWall);
  col.boxRaw([-HW, 0, ZB - 1.8], [HW, H, ZB + 0.2], 'hback');
  const nSl = 41, slats = new THREE.InstancedMesh(texBox(0.9, H - 4, 0.9, 0.2), M.graphite, nSl);
  for (let i = 0; i < nSl; i++) { d.position.set(-HW + 2 + i * ((HW * 2 - 4) / (nSl - 1)), (H - 4) / 2 + 0.2, ZB + 0.6); d.updateMatrix(); slats.setMatrixAt(i, d.matrix); }
  slats.castShadow = sh; slats.receiveShadow = sh; g.add(slats);
  const ceil = new THREE.Mesh(new THREE.RingGeometry(10.5, 130, 72, 1), M.graphiteDark); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, LZ); g.add(ceil);
  const oculusRim = new THREE.Mesh(new THREE.TorusGeometry(10.6, 0.22, 10, 96), M.aluminum); oculusRim.rotation.x = Math.PI / 2; oculusRim.position.set(0, H - 0.1, LZ); g.add(oculusRim);

  // ---------- Columnas monolíticas (dos hileras que enmarcan la perspectiva)
  const colMat = M.graphite.clone(); colMat.normalMap = null; colMat.roughnessMap = null; colMat.color.set(0x33333a); colMat.metalness = 0.55; colMat.roughness = 0.38;
  const NC = 6, colGeo = new THREE.BoxGeometry(3.4, H - 1, 3.4), cols = new THREE.InstancedMesh(colGeo, colMat, NC * 2);
  const base = new THREE.InstancedMesh(texBox(4.4, 0.7, 4.4, 0.18), M.graphiteDark, NC * 2);
  let ci = 0;
  for (let k = 0; k < NC; k++) for (const s of [-1, 1]) {
    const x = s * 21, z = ZF - 16 - k * 17;
    d.position.set(x, (H - 1) / 2, z); d.updateMatrix(); cols.setMatrixAt(ci, d.matrix);
    d.position.set(x, 0.35, z); d.updateMatrix(); base.setMatrixAt(ci, d.matrix);
    col.boxRaw([x - 2.3, 0, z - 2.3], [x + 2.3, H, z + 2.3], 'hcol' + ci); ci++;
  }
  cols.castShadow = sh; cols.receiveShadow = sh; base.receiveShadow = sh; g.add(cols, base);

  // ---------- Haz cenital tenue desde el óculo
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uI: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vUv; uniform float uI; void main(){ float f = pow(1. - vUv.y, 1.6) * 0.5; gl_FragColor = vec4(vec3(.78,.7,1.) * f * uI, f * uI * .3);
      #include <tonemapping_fragment>
      #include <colorspace_fragment> }`,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(10.2, 17, H - 0.5, 48, 1, true), shaftMat); shaft.position.set(0, (H - 0.5) / 2, LZ); g.add(shaft);

  // ================= LOGO ZENIX AR (unidades de px del logo original) =================
  const logo = new THREE.Group(); logo.position.set(0, LY, LZ); logo.scale.setScalar(S); g.add(logo);
  const revealU = [];
  const revealize = (mat, mode, color = [0.65, 0.45, 1.0]) => {
    const u = { uR: { value: 0 }, uEdge: { value: new THREE.Vector3(...color) } };
    revealU.push(u);
    mat.onBeforeCompile = (shd) => {
      shd.uniforms.uR = u.uR; shd.uniforms.uEdge = u.uEdge;
      shd.vertexShader = shd.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
      shd.fragmentShader = shd.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj; uniform float uR; uniform vec3 uEdge;\nfloat revT(){ ' +
        (mode === 'a' ? 'return abs(atan(vObj.x, vObj.y)) / 3.14159265;' : 'return clamp((vObj.y + 175.) / 350., 0., 1.);') + ' }')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float _t = revT(); if (_t > uR) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n float _e = smoothstep(.07, .0, uR - _t) * step(uR, .995); totalEmissiveRadiance += uEdge * _e * 3.0;');
    };
    mat.customProgramCacheKey = () => 'reveal-' + mode + (mat.isMeshBasicMaterial ? 'b' : 's');
    return mat;
  };
  const rt = (sx = 1, sy = 1, r = HEX.corner) => {
    const P = [[0, HEX.halfH], [HEX.halfW, HEX.vy], [HEX.halfW, -HEX.vy], [0, -HEX.halfH], [-HEX.halfW, -HEX.vy], [-HEX.halfW, HEX.vy]].map(([x, y]) => [x * sx, y * sy]);
    const sp = new THREE.Path(), n = P.length, pt = (i) => new THREE.Vector2(...P[(i + n) % n]);
    for (let i = 0; i < n; i++) {
      const a = pt(i - 1), b = pt(i), c = pt(i + 1);
      const l1 = a.clone().sub(b).normalize(), l2 = c.clone().sub(b).normalize();
      const rr = Math.min(r * Math.min(sx, sy), a.distanceTo(b) * 0.45, c.distanceTo(b) * 0.45);
      const p1 = b.clone().add(l1.multiplyScalar(rr)), p2 = b.clone().add(l2.multiplyScalar(rr));
      if (i === 0) sp.moveTo(p1.x, p1.y); else sp.lineTo(p1.x, p1.y);
      sp.quadraticCurveTo(b.x, b.y, p2.x, p2.y);
    }
    sp.closePath(); return sp;
  };
  const toShape = (path) => new THREE.Shape(path.getPoints(10));
  const band = toShape(rt(1, 1));
  band.holes.push(new THREE.Path(rt((HEX.halfW - HEX.band) / HEX.halfW, (HEX.halfH - HEX.band) / HEX.halfH).getPoints(10).reverse()));
  const ext = { depth: 44, bevelEnabled: true, bevelThickness: 8, bevelSize: 6, bevelSegments: 3, curveSegments: 6 };
  const frameMat = revealize(new THREE.MeshPhysicalMaterial({ color: 0x4b25c0, metalness: 0.9, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.14, emissive: 0x3a1aa0, emissiveIntensity: 0.18 }), 'a');
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(band, ext), frameMat); frame.position.z = -22; frame.castShadow = sh; logo.add(frame);
  const inner = toShape(rt(0.835, 0.862)); inner.holes.push(new THREE.Path(rt(0.805, 0.835).getPoints(10).reverse()));
  const innerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(inner, { depth: 30, bevelEnabled: false }), revealize(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa88bff).multiplyScalar(1.5 * FX.k), toneMapped: false }), 'a'));
  innerMesh.position.z = -15; logo.add(innerMesh);
  const outer = toShape(rt(1.02, 1.017)); outer.holes.push(new THREE.Path(rt(0.997, 0.997).getPoints(10).reverse()));
  const outerMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 10, bevelEnabled: false }), revealize(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb48cff).multiplyScalar(1.9 * FX.k), toneMapped: false }), 'a'));
  outerMesh.position.z = -30; logo.add(outerMesh);
  const zs = new THREE.Shape(Z_POLY.map(([x, y]) => new THREE.Vector2(x, -y)));
  const zg = new THREE.ExtrudeGeometry(zs, { depth: 56, bevelEnabled: true, bevelThickness: 7, bevelSize: 5, bevelSegments: 3, curveSegments: 4 });
  { const pos = zg.attributes.position, uv = zg.attributes.uv, [bx0, by0, bx1, by1] = Z_BOX;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - bx0) / (bx1 - bx0), 1 - ((-pos.getY(i)) - by0) / (by1 - by0)); }
  const zFace = revealize(new THREE.MeshStandardMaterial({ map: logoTex || null, color: logoTex ? 0xffffff : 0x7a4dff, emissive: 0xffffff, emissiveMap: logoTex || null, emissiveIntensity: logoTex ? 0.16 : 0.2, metalness: 0.4, roughness: 0.34 }), 'y', [0.5, 0.8, 1.0]);
  const zSide = revealize(new THREE.MeshPhysicalMaterial({ color: 0x5a30e6, metalness: 0.92, roughness: 0.22, clearcoat: 1, emissive: 0x4a22c8, emissiveIntensity: 0.4 }), 'y', [0.5, 0.8, 1.0]);
  const zMesh = new THREE.Mesh(zg, [zFace, zSide]); zMesh.position.z = -22; zMesh.castShadow = sh; logo.add(zMesh);

  // Copia especular (solo cuando no hay reflector real): comparte geometrías y materiales
  let mirror = null;
  if (!Q.reflector) {
    mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 0.0;
    const lg = logo.clone(); lg.position.set(0, LY, LZ);
    mirror.add(lg); g.add(mirror);
  }
  col.boxRaw([-9, 0, LZ - 3], [9, LY + 9, LZ + 3], 'logo');

  // ---------- Partículas de ensamblado: solo en el instante de la revelación, sobrias (blancas y violeta)
  const NP = Q.detail === 'low' ? 220 : Q.detail === 'med' ? 420 : 700;
  const r = rng(404);
  const aS = new Float32Array(NP * 3), aT = new Float32Array(NP * 3), aD = new Float32Array(NP), aC = new Float32Array(NP * 3);
  const hexPts = rt(1, 1).getPoints(40), zPts = Z_POLY.map(([x, y]) => new THREE.Vector2(x, -y));
  const cc = [new THREE.Color(0x9a76ff), new THREE.Color(0xe9e6ff), new THREE.Color(0xffffff)];
  for (let i = 0; i < NP; i++) {
    const arr = r() < 0.4 ? zPts : hexPts;
    const a = arr[Math.floor(r() * arr.length)], b = arr[(Math.floor(r() * arr.length) + 1) % arr.length], t = r();
    aT.set([lerp(a.x, b.x, t), lerp(a.y, b.y, t), (r() - 0.5) * 60], i * 3);
    const ang = r() * Math.PI * 2, rad = 700 + r() * 1100;
    aS.set([Math.cos(ang) * rad, Math.sin(ang) * rad * 0.6, -900 + r() * 1500], i * 3);
    aD[i] = r() * 0.55; const c = cc[Math.floor(r() * 3)]; aC.set([c.r, c.g, c.b], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(aT, 3)); pg.setAttribute('aStart', new THREE.BufferAttribute(aS, 3));
  pg.setAttribute('aDelay', new THREE.BufferAttribute(aD, 1)); pg.setAttribute('aColor', new THREE.BufferAttribute(aC, 3));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uR: { value: 0 }, uFade: { value: 1 }, uScale: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aStart; attribute float aDelay; attribute vec3 aColor; uniform float uR, uFade, uScale; varying vec3 vC; varying float vA;
      void main(){
        float t = clamp((uR * 1.6 - aDelay) / .85, 0., 1.); t = t * t * (3. - 2. * t);
        vec3 p = mix(aStart, position, t);
        p.xy += vec2(sin(t * 6. + aDelay * 20.), cos(t * 6. + aDelay * 20.)) * 40. * (1. - t);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uScale * (10. + 8. * (1. - t)) / max(-mv.z, .1) * 30., 1.2, 18.);
        vC = aColor; vA = (0.1 + 0.9 * smoothstep(0., .2, t)) * uFade;
      }`,
    fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(vC * 1.6 * a * vA, a * vA); }',
  });
  const parts = new THREE.Points(pg, pMat); parts.frustumCulled = false; logo.add(parts);

  return {
    group: g, range: [0.84, 1.01],
    update(s) {
      const p = s.p, L = s.L;
      const R = smoother(0.9, 0.978, p);
      revealU[0].uR.value = smooth(0.0, 0.6, R);
      revealU[1].uR.value = smooth(0.1, 0.7, R);
      revealU[2].uR.value = smooth(0.15, 0.75, R);
      revealU[3].uR.value = smooth(0.42, 0.9, R);
      revealU[4].uR.value = smooth(0.42, 0.9, R);
      pMat.uniforms.uR.value = smooth(0.0, 0.75, R);
      pMat.uniforms.uFade.value = 1 - smooth(0.78, 1.0, R) * 0.9;
      pMat.uniforms.uScale.value = s.Q.dpr * 0.5;
      shaftMat.uniforms.uI.value = 0.25 + 0.45 * smooth(0.2, 1, R);
      // El logo se asienta mirando a cámara; pequeña oscilación física al revelarse
      const yaw = (1 - smooth(0.93, 0.985, p)) * -0.45;
      logo.rotation.y = yaw; logo.position.y = LY + (1 - smooth(0.9, 0.98, p)) * 0.8;
      if (mirror) { mirror.children[0].rotation.y = yaw; mirror.children[0].position.y = logo.position.y; mirror.children[0].visible = R > 0.01; }
      // Luces reales: óculo cenital, relleno frontal violeta-blanco y contraluz
      const live = smooth(0.84, 0.88, p);
      L.key.position.set(0, H - 2, LZ + 3); L.key.target.position.set(0, LY - 3, LZ);
      L.key.color.set(0xe3dcff); L.key.angle = 0.5; L.key.penumbra = 1; L.key.intensity = 1100 * live * (0.35 + 0.65 * smooth(0.0, 0.8, R));
      L.acc1.position.set(0, 26, LZ + 40); L.acc1.color.set(0xe8e6f4); L.acc1.distance = 130; L.acc1.intensity = 420 * live * (0.5 + 0.5 * smooth(0.2, 1, R));
      L.acc2.position.set(-9, 13, LZ - 10); L.acc2.color.set(0x8b5cff); L.acc2.distance = 60; L.acc2.intensity = 110 * live * smooth(0.3, 1, R);
    },
  };
}
