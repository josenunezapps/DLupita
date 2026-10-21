// Escena 1 · Entrada: portal hexagonal de metal con el logo Z flotando en el centro.
import * as THREE from 'three';
import { COL, glow, hexFrame, hexField, radialTex, smooth, clamp, rng } from '../common.js';

export default function build(ctx) {
  const { M, logoTex, tier } = ctx;
  const g = new THREE.Group();
  const PY = 2.5; // altura del centro del portal

  // --- marcos del portal ---------------------------------------------------
  const defs = [
    { R: 13.5, w: 1.2, d: 1.3, spin: 0.045, col: COL.violet },
    { R: 10.6, w: 0.7, d: 0.9, spin: -0.085, col: COL.cyan },
    { R: 8.3, w: 0.38, d: 0.55, spin: 0.15, col: COL.violet },
  ];
  const frames = defs.map((d) => {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(hexFrame(d.R, d.w, d.d, 0.07), M.metal));
    const rimMat = new THREE.MeshBasicMaterial({ color: glow(d.col, 2.8) });
    // filos luminosos en el borde exterior e interior (cara frontal y trasera)
    [d.d / 2 + 0.075, -d.d / 2 - 0.075].forEach((z) => {
      const o = new THREE.Mesh(hexFrame(d.R - 0.02, 0.1, 0.02, 0), rimMat);
      o.position.z = z;
      const i = new THREE.Mesh(hexFrame(d.R - d.w + 0.12, 0.1, 0.02, 0), rimMat);
      i.position.z = z;
      grp.add(o, i);
    });
    grp.position.y = PY;
    g.add(grp);
    return { grp, ...d };
  });

  // --- logo en capas (efecto de volumen) ------------------------------------
  const logo = new THREE.Group();
  logo.position.set(0, PY, 0);
  const LW = 9.4, LH = LW * (314 / 336);
  const layers = [];
  for (let i = 0; i < 7; i++) {
    const front = i === 0;
    const mat = new THREE.MeshBasicMaterial({
      map: logoTex,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.02,
      color: front ? new THREE.Color(1.15, 1.15, 1.2) : new THREE.Color(COL.purple).multiplyScalar(0.55 - i * 0.06),
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), mat);
    m.position.z = -i * 0.11;
    logo.add(m);
    layers.push(m);
  }
  g.add(logo);

  const haloTex = radialTex(256);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glow(COL.violet, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  halo.scale.setScalar(26);
  halo.position.set(0, PY, -1);
  g.add(halo);
  const halo2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: glow(COL.cyan, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25 }));
  halo2.scale.set(34, 18, 1);
  halo2.position.set(0, PY, -3);
  g.add(halo2);

  // --- escombros hexagonales orbitando --------------------------------------
  const nDeb = tier === 'low' ? 24 : tier === 'mid' ? 40 : 70;
  const debGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.22, 6);
  const deb = new THREE.InstancedMesh(debGeo, M.violet, nDeb);
  const rd = rng(21);
  const debData = [];
  for (let i = 0; i < nDeb; i++) {
    debData.push({ a: rd() * 6.283, r: 16 + rd() * 14, y: (rd() - 0.5) * 16, s: 0.4 + rd() * 1.1, sp: (0.04 + rd() * 0.08) * (rd() > 0.5 ? 1 : -1), z: (rd() - 0.5) * 24, rx: rd() * 6, rz: rd() * 6 });
  }
  deb.frustumCulled = false;
  g.add(deb);
  const dummy = new THREE.Object3D();

  // --- piso de hexágonos ----------------------------------------------------
  const R = tier === 'low' ? 9 : tier === 'mid' ? 11 : 14;
  const field = hexField({ radius: R, cell: 1.35 });
  field.group.position.set(0, -9.5, 0);
  g.add(field.group);
  const cV = new THREE.Color();

  const logoWorld = new THREE.Vector3();

  function update(u, t, dt, st) {
    // marcos: giran y se abren cuando la cámara se acerca
    const open = smooth(0.55, 1, u);
    frames.forEach((f, i) => {
      f.grp.rotation.z = t * f.spin + u * (i % 2 ? -1.4 : 1.4);
      f.grp.position.z = -open * (i + 1) * 1.8;
    });

    // logo: flota, mira al puntero y se disuelve al atravesarlo
    logo.position.y = PY + Math.sin(t * 0.9) * 0.16;
    logo.rotation.y = st.pointer.x * 0.28 + Math.sin(t * 0.37) * 0.1;
    logo.rotation.x = -st.pointer.y * 0.12;
    logo.getWorldPosition(logoWorld);
    const dist = st.cam.position.distanceTo(logoWorld);
    const fade = smooth(1.5, 10, dist);
    layers.forEach((m, i) => (m.material.opacity = fade * (i === 0 ? 1 : 0.9)));
    halo.material.opacity = 0.4 * fade + 0.12 + Math.sin(t * 1.3) * 0.04;
    halo.scale.setScalar(26 + Math.sin(t * 1.3) * 1.2);

    // escombros
    for (let i = 0; i < nDeb; i++) {
      const d = debData[i];
      const a = d.a + t * d.sp;
      dummy.position.set(Math.cos(a) * d.r, PY + d.y + Math.sin(t * 0.5 + i) * 0.4, d.z + Math.sin(a) * d.r * 0.45);
      dummy.rotation.set(d.rx + t * 0.3, a, d.rz + t * 0.2);
      dummy.scale.setScalar(d.s);
      dummy.updateMatrix();
      deb.setMatrixAt(i, dummy.matrix);
    }
    deb.instanceMatrix.needsUpdate = true;

    // piso: ondas que nacen en el centro
    const amp = 0.9 + smooth(0, 0.8, u) * 1.6;
    field.update((it) => {
      const wave = 0.5 + 0.5 * Math.sin(it.d * 0.55 - t * 1.7 + it.ph * 0.15);
      const fall = 1 - smooth(4, 20, it.d) * 0.55;
      const bowl = smooth(2, 15, it.d) * 0.8;
      const h = 0.25 + bowl + wave * amp * fall;
      cV.setScalar(0);
      return { h, k: clamp(wave * 0.9 + it.d / 40), i: 0.35 + wave * 1.1 * fall };
    });
  }

  return { group: g, update, anchorVis: 110 };
}
