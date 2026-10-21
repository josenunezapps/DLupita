// Escena 5 · Sistemas conectados: un núcleo con el logo y módulos que se comunican con pulsos de datos.
import * as THREE from 'three';
import { COL, glow, rng, clamp, lerp, smooth, ease3, easeBack, radialTex, labelSprite, hexFrame } from '../common.js';

const NODES = [
  ['App móvil', 'ANDROID · IOS'],
  ['Sitio web', 'WEB'],
  ['API', 'SERVICIOS'],
  ['Base de datos', 'DATOS'],
  ['Pagos', 'COBROS'],
  ['Panel de gestión', 'ADMIN'],
  ['Notificaciones', 'AVISOS'],
];

export default function build(ctx) {
  const { M, tier, logoTex } = ctx;
  const g = new THREE.Group();
  const r = rng(505);
  const net = new THREE.Group();
  g.add(net);

  // --- núcleo ---------------------------------------------------------------
  const hub = new THREE.Group();
  net.add(hub);
  const hubBody = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 6), M.violet);
  hubBody.rotation.x = Math.PI / 2;
  hubBody.rotation.y = Math.PI / 6;
  hub.add(hubBody);
  const hubGlass = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 1.6, 6), M.glass);
  hubGlass.rotation.copy(hubBody.rotation);
  hub.add(hubGlass);
  const hubLogo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4 * (314 / 336)), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, alphaTest: 0.02, color: new THREE.Color(1.2, 1.2, 1.25) }));
  hubLogo.position.z = 0.65;
  hub.add(hubLogo);
  const hubLogo2 = hubLogo.clone();
  hubLogo2.position.z = -0.65;
  hubLogo2.rotation.y = Math.PI;
  hub.add(hubLogo2);
  const ringA = new THREE.Mesh(hexFrame(4.8, 0.12, 0.1, 0.02), M.gViolet);
  const ringB = new THREE.Mesh(hexFrame(6.0, 0.1, 0.1, 0.02), M.gCyan);
  hub.add(ringA, ringB);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(256), color: glow(COL.violet, 1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75 }));
  halo.scale.setScalar(22);
  g.add(halo);

  // --- nodos en esfera (Fibonacci) -------------------------------------------
  const nodes = [];
  const RAD = 12.5;
  NODES.forEach(([title, sub], i) => {
    const k = (i + 0.5) / NODES.length;
    const phi = Math.acos(1 - 2 * k);
    const th = Math.PI * (1 + Math.sqrt(5)) * i;
    const pos = new THREE.Vector3(Math.cos(th) * Math.sin(phi), Math.cos(phi) * 0.8, Math.sin(th) * Math.sin(phi)).multiplyScalar(RAD);
    const grp = new THREE.Group();
    grp.position.copy(pos);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.6, 6), M.metal);
    body.rotation.x = Math.PI / 2;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 6), i % 2 ? M.gCyan : M.gViolet);
    top.rotation.x = Math.PI / 2;
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.9, 6), M.glass);
    glass.rotation.x = Math.PI / 2;
    grp.add(body, top, glass);
    const label = labelSprite(title, sub, { scale: 4.8, accent: i % 2 ? '#22d3ee' : '#c4a1ff' });
    label.position.y = 2.9;
    grp.add(label);
    grp.userData = { label, base: pos.clone(), ph: r() * 6.283 };
    net.add(grp);
    nodes.push(grp);
  });
  // label no debe rotar con lookAt: los sacamos del grupo y los actualizamos a mano
  nodes.forEach((n) => {
    const l = n.userData.label;
    n.remove(l);
    net.add(l);
  });

  // --- aristas -----------------------------------------------------------------
  const edges = [];
  nodes.forEach((n, i) => edges.push([hub.position, n.position, i]));
  for (let i = 0; i < nodes.length; i++) edges.push([nodes[i].position, nodes[(i + 1) % nodes.length].position, -1]);
  // constelación exterior
  const nOuter = tier === 'low' ? 24 : tier === 'mid' ? 40 : 70;
  const outer = [];
  for (let i = 0; i < nOuter; i++) {
    const a = r() * 6.283, b = Math.acos(2 * r() - 1), rad = 17 + r() * 7;
    outer.push(new THREE.Vector3(Math.sin(b) * Math.cos(a) * rad, Math.cos(b) * rad * 0.75, Math.sin(b) * Math.sin(a) * rad));
  }
  const outerEdges = [];
  outer.forEach((p) => {
    const near = nodes.map((n) => [n.position.distanceTo(p), n.position]).sort((a, b) => a[0] - b[0]).slice(0, 1);
    near.forEach(([, np]) => outerEdges.push([p, np]));
  });
  const linePos = [];
  const lineCol = [];
  const cV = new THREE.Color(COL.violet), cC = new THREE.Color(COL.cyan);
  const pushEdge = (a, b, ca, cb, k) => {
    linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    lineCol.push(ca.r * k, ca.g * k, ca.b * k, cb.r * k, cb.g * k, cb.b * k);
  };
  edges.forEach(([a, b]) => pushEdge(a, b, cV, cC, 1.4));
  outerEdges.forEach(([a, b]) => pushEdge(a, b, cV, cV, 0.2));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  lg.setAttribute('color', new THREE.Float32BufferAttribute(lineCol, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  net.add(lines);

  // puntos de la constelación
  const og = new THREE.BufferGeometry().setFromPoints(outer);
  const dots = new THREE.Points(og, new THREE.PointsMaterial({ size: 0.55, color: glow(COL.lilac, 1.8), map: radialTex(64), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  net.add(dots);

  // --- pulsos de datos -------------------------------------------------------
  const pulses = [];
  edges.forEach(([a, b], i) => {
    const cnt = i < nodes.length ? 3 : 1;
    for (let k = 0; k < cnt; k++) pulses.push({ a, b, t: r(), sp: 0.12 + r() * 0.2, dir: r() > 0.5 ? 1 : -1 });
  });
  const pp = new Float32Array(pulses.length * 3);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pulsePts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.0, color: glow(0xffffff, 3), map: radialTex(64), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  pulsePts.frustumCulled = false;
  net.add(pulsePts);

  const Z = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), wp = new THREE.Vector3();

  function update(u, t, dt, st) {
    const appear = ease3((u - 0.02) / 0.3);
    net.rotation.y = u * 1.8 + t * 0.05;
    net.rotation.x = Math.sin(t * 0.2) * 0.06;

    hub.rotation.y = Math.sin(t * 0.4) * 0.35 + st.pointer.x * 0.2;
    ringA.rotation.z = t * 0.45;
    ringB.rotation.z = -t * 0.3;
    ringA.rotation.x = Math.sin(t * 0.5) * 0.6;
    ringB.rotation.y = Math.cos(t * 0.4) * 0.6;
    hub.scale.setScalar(0.6 + 0.4 * appear);
    halo.material.opacity = 0.4 + 0.35 * appear + Math.sin(t * 1.5) * 0.05;

    nodes.forEach((n, i) => {
      const k = easeBack((u - 0.05 - i * 0.045) / 0.22);
      n.position.copy(n.userData.base).multiplyScalar(Math.max(0.0001, k));
      n.position.y += Math.sin(t * 0.9 + n.userData.ph) * 0.35;
      n.scale.setScalar(Math.max(0.0001, k));
      dir.copy(n.userData.base).negate().normalize();
      n.quaternion.setFromUnitVectors(Z, dir);
      const l = n.userData.label;
      l.position.set(n.position.x, n.position.y + 2.9 * Math.max(0.2, k), n.position.z);
      l.getWorldPosition(wp);
      l.material.opacity = smooth(0.4, 1, k) * smooth(4, 11, st.cam.position.distanceTo(wp));
    });

    // las aristas se reconstruyen a partir de posiciones vivas
    lines.material.opacity = 0.25 + 0.65 * appear;
    // los extremos de las aristas hub→nodo usan posiciones de los grupos (referencias vivas)
    const attr = lg.getAttribute('position');
    let o = 0;
    edges.forEach(([a, b]) => {
      attr.setXYZ(o++, a.x, a.y, a.z);
      attr.setXYZ(o++, b.x, b.y, b.z);
    });
    outerEdges.forEach(([a, b]) => {
      attr.setXYZ(o++, a.x, a.y, a.z);
      attr.setXYZ(o++, b.x, b.y, b.z);
    });
    attr.needsUpdate = true;

    // pulsos
    pulses.forEach((p, i) => {
      p.t += dt * p.sp * (0.6 + appear);
      if (p.t > 1) p.t -= 1;
      const k = p.dir > 0 ? p.t : 1 - p.t;
      pp[i * 3] = lerp(p.a.x, p.b.x, k);
      pp[i * 3 + 1] = lerp(p.a.y, p.b.y, k);
      pp[i * 3 + 2] = lerp(p.a.z, p.b.z, k);
    });
    pg.attributes.position.needsUpdate = true;
    pulsePts.material.opacity = appear;
  }

  return { group: g, update };
}
