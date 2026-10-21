// Escena 6 · Cierre: el logo hexagonal violeta, rayos de luz y chispas. Aquí aparece el llamado a la acción (HTML).
import * as THREE from 'three';
import { COL, glow, rng, clamp, lerp, smooth, ease3, radialTex, hexShape, hexFrame, hexField } from '../common.js';

export default function build(ctx) {
  const { M, tier, logoTex } = ctx;
  const g = new THREE.Group();
  const r = rng(606);
  const PY = 2.2;

  const logo = new THREE.Group();
  logo.position.y = PY;
  g.add(logo);

  // cuerpo del hexágono: placa de metal violeta con bisel
  const R = 4.6;
  const bodyGeo = new THREE.ExtrudeGeometry(hexShape(R), { depth: 1.1, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.28, bevelSegments: 4, curveSegments: 1 });
  bodyGeo.translate(0, 0, -0.55);
  const bodyMat = tier === 'low'
    ? new THREE.MeshStandardMaterial({ color: 0x7c2cff, metalness: 0.95, roughness: 0.2 })
    : new THREE.MeshPhysicalMaterial({ color: 0x8b3dff, metalness: 0.9, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  logo.add(new THREE.Mesh(bodyGeo, bodyMat));
  // cara frontal oscura tipo cristal
  const face = new THREE.Mesh(new THREE.ShapeGeometry(hexShape(R - 0.55)), new THREE.MeshStandardMaterial({ color: 0x07030f, metalness: 0.8, roughness: 0.12 }));
  face.position.z = 0.86;
  logo.add(face);
  const faceRim = new THREE.Mesh(hexFrame(R - 0.5, 0.09, 0.03, 0), M.gCyan);
  faceRim.position.z = 0.9;
  logo.add(faceRim);
  const faceRim2 = new THREE.Mesh(hexFrame(R - 0.95, 0.05, 0.03, 0), M.gViolet);
  faceRim2.position.z = 0.9;
  logo.add(faceRim2);
  const lw = 5.0;
  const z = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw * (314 / 336)), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, alphaTest: 0.02, color: new THREE.Color(1.25, 1.25, 1.3) }));
  z.position.z = 0.93;
  logo.add(z);
  // lado trasero (por si la cámara orbita)
  const zb = z.clone();
  zb.rotation.y = Math.PI;
  zb.position.z = -0.93;
  logo.add(zb);

  // anillos orbitales
  const ringA = new THREE.Mesh(hexFrame(8.2, 0.16, 0.12, 0.02), M.gViolet);
  const ringB = new THREE.Mesh(hexFrame(10.6, 0.12, 0.1, 0.02), M.gCyan);
  const ringC = new THREE.Mesh(hexFrame(13.2, 0.3, 0.2, 0.04), M.metal);
  logo.add(ringA, ringB, ringC);

  // rayos de luz detrás del logo
  const rayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime, uAmt;
      void main(){
        float across = 1. - abs(vUv.x - .5) * 2.;
        float along = smoothstep(0., .08, vUv.y) * (1. - vUv.y);
        float a = pow(across, 2.2) * along * uAmt * (.65 + .35 * sin(uTime * 1.3 + vUv.y * 6.));
        gl_FragColor = vec4(mix(vec3(.55, .25, 1.), vec3(.4, .9, 1.), vUv.y) * 1.5, a * .55);
      }`,
  });
  const rays = new THREE.Group();
  const nRay = tier === 'low' ? 6 : 11;
  for (let i = 0; i < nRay; i++) {
    const w = 1.4 + r() * 2.4;
    const len = 34 + r() * 26;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), rayMat);
    m.geometry.translate(0, len / 2, 0);
    m.rotation.z = (i / nRay) * Math.PI * 2 + r() * 0.3;
    m.position.z = -2.2 - r() * 1.5;
    rays.add(m);
  }
  rays.position.y = PY;
  g.add(rays);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(256), color: glow(COL.violet, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  halo.scale.setScalar(34);
  halo.position.set(0, PY, -3);
  g.add(halo);

  // chispas que suben
  const nS = tier === 'low' ? 250 : tier === 'mid' ? 420 : 800;
  const sp = new Float32Array(nS * 3);
  const sd = new Float32Array(nS * 2);
  for (let i = 0; i < nS; i++) {
    const a = r() * 6.283, rad = 3 + r() * 20;
    sp[i * 3] = Math.cos(a) * rad;
    sp[i * 3 + 1] = -9 + r() * 30;
    sp[i * 3 + 2] = Math.sin(a) * rad * 0.8 - 2;
    sd[i * 2] = 0.8 + r() * 2.4;
    sd[i * 2 + 1] = r() * 6.283;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aS', new THREE.BufferAttribute(sd, 2));
  const sm = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 } },
    vertexShader: `
      attribute vec2 aS; uniform float uTime, uPR; varying float vA; varying vec3 vC;
      void main(){
        vec3 p = position;
        p.y = -9. + mod(position.y + 9. + uTime * aS.x * .9, 30.);
        p.x += sin(uTime * .5 + aS.y) * .8;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vA = smoothstep(-9., -4., p.y) * smoothstep(21., 12., p.y) * (.5 + .5 * sin(uTime * 2. + aS.y * 4.)) * smoothstep(140., 55., -mv.z);
        vC = mix(vec3(.62, .38, 1.), vec3(.5, .95, 1.), step(2.2, aS.x));
        gl_PointSize = clamp(uPR * aS.x * 40. / -mv.z, 1., 12. * uPR);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); gl_FragColor = vec4(vC * 1.6, a * a * vA); }`,
  });
  const sparks = new THREE.Points(sg, sm);
  sparks.frustumCulled = false;
  g.add(sparks);

  // piso
  const field = hexField({ radius: tier === 'low' ? 9 : tier === 'mid' ? 11 : 14, cell: 1.5, colA: COL.violet, colB: COL.cyan });
  field.group.position.set(0, -10, -2);
  g.add(field.group);

  function update(u, t, dt, st) {
    sm.uniforms.uTime.value = t;
    sm.uniforms.uPR.value = st.pr;
    rayMat.uniforms.uTime.value = t;
    rayMat.uniforms.uAmt.value = smooth(0.0, 0.45, u);

    const appear = ease3(u / 0.35);
    logo.scale.setScalar(0.55 + 0.45 * appear);
    logo.position.y = PY + Math.sin(t * 0.8) * 0.2;
    logo.rotation.y = Math.sin(t * 0.33) * 0.22 + st.pointer.x * 0.3 + (1 - appear) * 1.1;
    logo.rotation.x = -st.pointer.y * 0.14;
    ringA.rotation.z = t * 0.25;
    ringB.rotation.z = -t * 0.18;
    ringC.rotation.z = t * 0.06;
    ringA.rotation.x = Math.sin(t * 0.3) * 0.5;
    ringB.rotation.y = Math.cos(t * 0.27) * 0.5;
    rays.rotation.z = t * 0.03;
    halo.material.opacity = 0.55 + 0.3 * appear + Math.sin(t * 1.2) * 0.06;

    const amp = 0.7 + 1.4 * smooth(0, 0.6, u);
    field.update((it) => {
      const wave = 0.5 + 0.5 * Math.sin(it.d * 0.5 - t * 1.4 + it.ph * 0.12);
      const fall = 1 - smooth(5, 21, it.d) * 0.6;
      return { h: 0.25 + smooth(3, 16, it.d) * 0.7 + wave * amp * fall, k: clamp(wave * 0.8 + it.d / 45), i: 0.3 + wave * 1.2 * fall };
    });
  }

  return { group: g, update };
}
