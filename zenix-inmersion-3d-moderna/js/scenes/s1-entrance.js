import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { PAL, rng, smooth, smoother, texBox, texPlane } from '../util.js';
import { text3D } from '../parts.js';

// ESCENA 1 · ENTRADA — Un edificio monolítico en una explanada de basalto, de noche. Sin anillos ni neón: escala,
// hormigón, aletas verticales y una luz interior que se derrama cuando las puertas se abren. La cámara cruza el umbral.
export function buildEntrance(ctx) {
  const { M, Q, col, font } = ctx;
  const g = new THREE.Group(); g.name = 'entrance';
  const FZ = -30;                       // plano de fachada
  const shadows = Q.shadows;
  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadows && o.cast !== false; m.receiveShadow = shadows; g.add(m); return m;
  };

  // ---- Explanada: basalto con reflejo húmedo (espejo parcial en calidad alta) + sendero de hormigón claro
  const floorGeo = texPlane(520, 520, 0.09);
  if (Q.reflector) {
    const mir = new Reflector(new THREE.PlaneGeometry(520, 520), { textureWidth: 768, textureHeight: 768, color: 0x6a6878, clipBias: 0.003 });
    mir.rotation.x = -Math.PI / 2; mir.position.set(0, -0.03, -40); g.add(mir);
    ctx.mirror = mir;
    const wet = M.basalt.clone(); wet.transparent = true; wet.opacity = 0.9; wet.depthWrite = false;
    const f = new THREE.Mesh(floorGeo, wet); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, -40); f.receiveShadow = shadows; f.renderOrder = 1; g.add(f);
  } else {
    const f = new THREE.Mesh(floorGeo, M.basalt); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, -40); f.receiveShadow = shadows; g.add(f);
  }
  const path = new THREE.Mesh(texPlane(15, 140, 0.18), M.floorMatte);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.012, 38); path.receiveShadow = shadows; g.add(path);

  // ---- Volúmenes del edificio (hormigón con juntas y tornillos reales en la normal map)
  const wingW = 70, wingH = 28, wingD = 16;
  for (const s of [-1, 1]) {
    const w = add(texBox(wingW, wingH, wingD, 0.14), M.concrete, s * (6 + wingW / 2), wingH / 2, FZ - wingD / 2);
    col.box(w, 'wing' + s, 0.1);
  }
  // Banda superior en voladizo sobre la entrada (techo del paso)
  const band = add(texBox(152, 8, 24, 0.14), M.concreteDark, 0, 32, FZ - 8);
  col.box(band, 'band', 0.1);
  // Masas altas superiores (silueta asimétrica contra el cielo)
  const tL = add(texBox(46, 24, 20, 0.12), M.concrete, -38, 48, FZ - 10);
  const tR = add(texBox(56, 14, 20, 0.12), M.concrete, 42, 43, FZ - 10);
  const tC = add(texBox(18, 34, 14, 0.12), M.concreteDark, -4, 53, FZ - 14);
  [tL, tR, tC].forEach((m, i) => col.box(m, 'tower' + i, 0.1));
  // Aletas verticales de aluminio anodizado: ritmo, sombra y paralaje al pasar
  const finGeo = texBox(0.7, wingH - 1, 1.5, 0.3);
  const nFin = 28, fins = new THREE.InstancedMesh(finGeo, M.graphite, nFin * 1);
  fins.castShadow = shadows; fins.receiveShadow = shadows;
  const d = new THREE.Object3D(); let k = 0;
  for (const s of [-1, 1]) for (let i = 0; i < nFin / 2; i++) {
    d.position.set(s * (9 + i * 2.6), (wingH - 1) / 2, FZ + 0.7); d.updateMatrix(); fins.setMatrixAt(k++, d.matrix);
  }
  g.add(fins);
  // Pilastras que enmarcan el paso
  for (const s of [-1, 1]) {
    const p = add(texBox(2.2, 28, 2.2, 0.3), M.graphiteDark, s * 7.2, 14, FZ + 1.4);
    col.box(p, 'jamb' + s, 0.05);
  }
  // Marca ZENIX AR en letras de aluminio sobre la banda (volumen real, iluminadas por luz de la escena)
  if (font) {
    const t = text3D(ctx, 'ZENIX AR', 4.2, { depth: 0.9, mat: M.aluminum, sideMat: M.graphite });
    t.position.set(0, 33.5, FZ + 3.9); t.castShadow = shadows; g.add(t);
  }
  // Filo de luz bajo el voladizo (única línea emisiva de la fachada: tenue, cálida-blanca)
  const eaveLight = new THREE.Mesh(new THREE.BoxGeometry(150, 0.18, 0.18), M.glowSoft.clone());
  eaveLight.position.set(0, 28.2, FZ + 3.6); g.add(eaveLight);
  eaveLight.material.color.multiplyScalar(0.55);

  // ---- Puertas: dos hojas de grafito con nervios, deslizan hacia los muros con el avance
  const leafGeo = texBox(6.1, 27, 0.8, 0.3);
  const leaves = [-1, 1].map((s) => {
    const l = new THREE.Group();
    const body = new THREE.Mesh(leafGeo, M.graphiteDark); body.castShadow = shadows; l.add(body);
    for (let i = 0; i < 5; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 26, 0.3), M.aluminum); rib.position.set(-s * (2.4 - i * 1.2) * -1, 0, 0.5); l.add(rib); }
    l.position.set(s * 3.05, 13.5, FZ - 3.5); g.add(l); l.userData.s = s; return l;
  });

  // Rendija de luz: el interior ya está encendido y se filtra entre las hojas antes de abrirse
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 26.4, 0.2), M.glowSoft.clone()); seam.material.color.setScalar(1.8); seam.position.set(0, 13.5, FZ - 5); g.add(seam);
  const seamL = (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 22), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.06, FZ + 11); g.add(m); return m; })();

  // ---- Vestíbulo/corredor de acceso (z −46 → −80): lo que se ve al abrirse las puertas
  const cL = 38, cz0 = -44;
  const cW = 7, cH = 15;
  for (const s of [-1, 1]) {
    const wall = add(texBox(1.4, cH, cL, 0.2), M.graphiteDark, s * (cW + 0.7), cH / 2, cz0 - cL / 2, { cast: false });
    col.box(wall, 'cwall' + s, 0.05);
  }
  const ceil = add(texBox(cW * 2 + 3, 1.2, cL, 0.2), M.graphiteDark, 0, cH + 0.6, cz0 - cL / 2, { cast: false });
  const lintel = add(texBox(cW * 2 + 3, 13, 2, 0.2), M.concreteDark, 0, 21.5, cz0 - 1);
  col.box(lintel, 'lintel', 0.05);
  const cfloor = new THREE.Mesh(texPlane(cW * 2, cL + 20, 0.12), M.floorPolished);
  cfloor.rotation.x = -Math.PI / 2; cfloor.position.set(0, 0.02, cz0 - cL / 2 - 6); cfloor.receiveShadow = shadows; g.add(cfloor);
  // Luminarias lineales de techo (ritmo al avanzar): se encienden con la apertura de las puertas
  const nBars = 9;
  const barMat = M.glowSoft.clone();
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(9, 0.12, 0.7), barMat, nBars);
  for (let i = 0; i < nBars; i++) { d.position.set(0, cH - 0.1, cz0 - 3 - i * 4.4); d.updateMatrix(); bars.setMatrixAt(i, d.matrix); }
  g.add(bars);

  // ---- Balizas bajas a ambos lados del sendero (escala y paralaje; sin neón)
  const nB = 22, bolGeo = new THREE.CylinderGeometry(0.28, 0.34, 1.2, 12);
  const bol = new THREE.InstancedMesh(bolGeo, M.graphite, nB * 2), bolTop = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), M.glowSoft.clone(), nB * 2);
  bol.castShadow = shadows; bol.receiveShadow = shadows; k = 0;
  for (let i = 0; i < nB; i++) for (const s of [-1, 1]) {
    const z = 74 - i * 5; d.position.set(s * 8.4, 0.6, z); d.updateMatrix(); bol.setMatrixAt(k, d.matrix);
    d.position.y = 1.23; d.updateMatrix(); bolTop.setMatrixAt(k, d.matrix); k++;
  }
  g.add(bol, bolTop); bolTop.material.color.multiplyScalar(0.5);
  // Grandes bloques de hormigón (bancos/jardineras) a los costados: capas de profundidad en el primer plano
  const blk = rng(21);
  for (let i = 0; i < 14; i++) {
    const s = blk() < 0.5 ? -1 : 1, w = 2 + blk() * 4, h = 0.8 + blk() * 2, dd = 2 + blk() * 8;
    add(texBox(w, h, dd, 0.25), M.concreteDark, s * (16 + blk() * 40), h / 2, 60 - blk() * 80);
  }

  // ---- Luz saliendo de la puerta: haz volumétrico falso (conos aditivos suaves) + polvo
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uI: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: /* glsl */`varying vec2 vUv; uniform float uI;
      void main(){ float along = 1. - vUv.y, across = abs(vUv.x - .5) * 2.; float f = pow(along, 1.7) * (1. - across*across) * smoothstep(0., .06, vUv.y);
        gl_FragColor = vec4(vec3(.78,.7,1.) * f * uI, f * uI * .5);
        #include <tonemapping_fragment>
        #include <colorspace_fragment> }`,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 2.2, 70, 24, 1, true), coneMat);
  cone.rotation.x = Math.PI / 2; cone.position.set(0, 7, FZ + 28);
  // el cilindro apunta hacia +z; escalar en Y para aplanarlo contra el suelo
  cone.scale.set(1, 1, 0.55); g.add(cone);

  return {
    group: g, range: [-1, 0.2],
    update(s) {
      const p = s.p;
      const u = smoother(0.035, 0.108, p);
      leaves.forEach((l) => { l.position.x = l.userData.s * (3.3 + u * 6.4); });
      const on = 0.25 + 0.75 * u;
      seam.visible = u < 0.9; seamL.material.opacity = 0.14 * (1 - u);
      barMat.color.setScalar(1.15 * on); eaveLight.material.color.setScalar(0.8 + 0.3 * u);
      coneMat.uniforms.uI.value = u * (1 - smooth(0.115, 0.15, p)) * 0.4;
      // Luces reales de esta escena
      const L = s.L, cam = s.camera.position;
      const live = 1 - smooth(0.135, 0.152, p);
      // Luz de luna: direccional fría desde atrás-izquierda (modela la fachada y las aletas)
      L.sun.position.set(-40, 60, 80); L.sun.target.position.set(0, 10, -30); L.sun.color.set(0xe4e8f6); L.sun.intensity = 2.6 * live;
      // La luz del interior se derrama sobre la explanada al abrirse las puertas
      L.key.position.set(0, 10, FZ - 14); L.key.target.position.set(0, 0, FZ + 36);
      L.key.color.set(0xe9e4ff); L.key.angle = 0.7; L.key.penumbra = 1; L.key.intensity = 650 * (0.16 + 0.84 * u) * live;
      L.acc1.intensity = 0;
      L.acc2.position.set(0, 4, Math.max(cam.z - 6, -76)); L.acc2.color.set(0xe6e0ff); L.acc2.distance = 34;
      L.acc2.intensity = (p > 0.1 ? 120 * smooth(0.1, 0.125, p) : 0) * live;                               // luz interior al cruzar
    },
  };
}
