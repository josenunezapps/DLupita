import * as THREE from 'three';
import { PAL, rng, smooth, smoother, hexRingGeometry, hexShape, neon } from '../util.js';
import { gridMaterial } from '../materials.js';

// ESCENA 1 · Entrada al universo Zenix: megaestructura hexagonal con un portal que se activa al avanzar.
export function buildPortal(ctx) {
  const { M, Q, col } = ctx;
  const g = new THREE.Group();
  g.name = 'portal';

  const CENTER_Z = -30;
  const tiers = [
    { z: -30, Ro: 29, Ri: 25.6, off: 1.15, dir: 1 },
    { z: -37, Ro: 25, Ri: 21.8, off: -0.9, dir: -1 },
    { z: -44, Ro: 21, Ri: 18.0, off: 0.75, dir: 1 },
    { z: -51, Ro: 17, Ri: 14.2, off: -0.6, dir: -1 },
  ];
  const rings = [];
  tiers.forEach((t, i) => {
    const grp = new THREE.Group();
    grp.position.z = t.z;
    const depth = 3.0;
    const body = new THREE.Mesh(hexRingGeometry(t.Ro, t.Ri, depth, 0.14), i % 2 ? M.metalMid : M.metalDark);
    body.castShadow = Q.shadows; body.receiveShadow = Q.shadows;
    grp.add(body);
    const backPlate = new THREE.Mesh(hexRingGeometry(t.Ro - 0.65, t.Ri + 0.5, depth * 0.34, 0.08), i % 2 ? M.metalDark : M.metalMid);
    backPlate.position.z = -depth * 0.12;
    grp.add(backPlate);
    // Franja neón en el canto interior + aristas finas en el exterior
    const strip = new THREE.Mesh(hexRingGeometry(t.Ri + 0.06, t.Ri - 0.34, depth + 0.75, 0), i % 2 ? M.cyanGlow : M.violetGlow);
    grp.add(strip);
    const edge = new THREE.Mesh(hexRingGeometry(t.Ro + 0.03, t.Ro - 0.28, depth + 0.55, 0), M.electricGlow);
    grp.add(edge);
    // Nervios radiales (estructura técnica): placas entre el borde interior y el exterior
    const ribGeo = new THREE.BoxGeometry(0.82, (t.Ro - t.Ri) * 0.92, depth * 1.45);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + Math.PI / 6;
      const rr = (t.Ro + t.Ri) / 2;
      const rib = new THREE.Mesh(ribGeo, M.silver);
      rib.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      rib.rotation.z = a - Math.PI / 2;
      grp.add(rib);
    }
    grp.userData = t;
    rings.push(grp);
    g.add(grp);
    col.ring([0, 0, t.z], t.Ri - 0.2, t.Ro + 0.2, depth + 0.6, 'portal-ring-' + i);
  });

  // Vigas longitudinales: forman una jaula que aporta perspectiva y profundidad
  const beamGeo = new THREE.BoxGeometry(1.3, 1.3, 40);
  const R0 = tiers[0].Ro - 0.6;
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 3;
    const bx = Math.cos(a) * R0, by = Math.sin(a) * R0;
    const beam = new THREE.Mesh(beamGeo, M.metalDark);
    beam.position.set(bx, by, -42);
    g.add(beam);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 40.4), k % 2 ? M.cyanGlow : M.violetGlow);
    line.position.set(bx * 0.985, by * 0.985, -42);
    g.add(line);
    col.box(beam, 'portal-beam-' + k, 0.1);
  }

  // Torres colosales a los lados (escala de la estructura)
  const towerGeo = new THREE.BoxGeometry(9.5, 90, 9.5);
  const stripGeo = new THREE.BoxGeometry(0.34, 88, 0.34);
  [[-52, -26], [52, -26], [-70, -70], [70, -70]].forEach(([x, z], i) => {
    const tw = new THREE.Mesh(towerGeo, M.metalDark);
    tw.position.set(x, 8, z);
    g.add(tw);
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(stripGeo, i % 2 ? M.cyanGlow : M.violetGlow);
      s.position.set(x + sx * 4.05, 8, z + 4.05);
      g.add(s);
    }
    col.box(tw, 'portal-tower-' + i, 0.1);
  });

  // Suelo: rejilla emisiva infinita bajo la estructura
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -26, -20);
  floor.receiveShadow = Q.shadows;
  g.add(floor);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), gridMaterial({ color: PAL.violet, cell: 6, intensity: 1.4, alpha: 0.9 }));
  grid.rotation.x = -Math.PI / 2; grid.position.set(0, -25.9, -20);
  g.add(grid);

  // Losas de datos flotando en el espacio: pasan por los costados de la cámara al avanzar
  const r = rng(7);
  const SL = Q.detail === 'low' ? 12 : 28;
  const slabGeo = new THREE.BoxGeometry(3.0, 1.8, 0.55);
  const slabs = new THREE.InstancedMesh(slabGeo, M.plate, SL);
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.14, 0.22), M.cyanGlow, SL);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < SL; i++) {
    const a = r() * Math.PI * 2, rad = 18 + r() * 22;
    dummy.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.6 + 2.5, 30 - r() * 92);
    dummy.rotation.set((r() - 0.5) * 0.5, (r() - 0.5) * 1.2, (r() - 0.5) * 0.6);
    const s = 0.76 + r() * 1.35; dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    slabs.setMatrixAt(i, dummy.matrix);
    // franja en el borde inferior de cada losa
    const m2 = dummy.matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.84, 0.18));
    strips.setMatrixAt(i, m2);
  }
  g.add(slabs, strips);

  // Disco del portal: horizonte de eventos con iris que se abre
  const discMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform float uTime, uOpen, uFade;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vUv*2.-1.; float r = length(p); if (r > 1.) discard;
        float a = atan(p.y, p.x);
        float sw = n(vec2(a*2. + uTime*.5 + r*7., r*5. - uTime*.8))*.65 + n(vec2(a*5. - uTime*.35, r*11. + uTime*.6))*.35;
        vec3 violet = vec3(.55,.22,1.), cyan = vec3(.1,.85,1.);
        vec3 c = mix(violet, cyan, smoothstep(.2,.9,sw)) * (.5 + sw*1.5);
        float iris = smoothstep(uOpen - .12, uOpen + .02, r);       // 0 dentro del iris abierto
        float core = (1. - r*.6) * iris;
        float ring = smoothstep(.80, .95, r) * (1. - smoothstep(.96, 1., r));
        float spokes = pow(abs(sin(a*6. + uOpen*3.)), 24.) * smoothstep(.55,.9,r) * .8;
        vec3 col = c * core * .62 + vec3(.75,.55,1.) * ring * 1.5 + vec3(.4,.8,1.) * spokes * iris * .8;
        float alpha = clamp(core + ring + spokes*iris, 0., 1.) * uFade;
        gl_FragColor = vec4(col * uFade, alpha);
      }`,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(12.5, 96), discMat);
  disc.position.set(0, 0, -57);
  g.add(disc);
  // Marco metálico del portal (anillo grueso) con volumen real
  const frame = new THREE.Mesh(new THREE.TorusGeometry(12.9, 0.7, 20, 96), M.silver);
  frame.position.copy(disc.position);
  g.add(frame);
  const frameGlow = new THREE.Mesh(new THREE.TorusGeometry(12.9, 0.18, 12, 96), M.electricGlow);
  frameGlow.position.copy(disc.position); frameGlow.position.z += 0.55;
  g.add(frameGlow);
  col.ring([0, 0, -57], 11.9, 13.7, 1.6, 'portal-frame');

  // Conos de luz volumétrica falsa saliendo del portal hacia la cámara
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uI: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uI; void main(){ float f = pow(1.-vUv.y, 1.6) * smoothstep(0.,.25,vUv.y); gl_FragColor = vec4(vec3(.45,.25,1.) * f * uI, f * uI * .55); }`,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(12, 3, 60, 40, 1, true), coneMat);
  cone.rotation.x = Math.PI / 2; cone.position.set(0, 0, -57 + 30);
  g.add(cone);

  return {
    group: g,
    range: [-1, 0.22],
    update(s) {
      const p = s.p;
      const lock = 1 - smoother(0.0, 0.11, p);
      rings.forEach((grp, i) => {
        const t = grp.userData;
        grp.rotation.z = t.off * lock * 2.2 + t.dir * p * 1.4;
      });
      discMat.uniforms.uTime.value = s.time;
      discMat.uniforms.uOpen.value = smooth(0.015, 0.105, p) * 1.12;
      // El disco se disuelve cuando la cámara lo atraviesa (no hay corte brusco)
      discMat.uniforms.uFade.value = 1 - smooth(0.118, 0.145, p) * 0.9;
      coneMat.uniforms.uI.value = smooth(0.02, 0.1, p) * (1 - smooth(0.12, 0.15, p));
    },
  };
}
