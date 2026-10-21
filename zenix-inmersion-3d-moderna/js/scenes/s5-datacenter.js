import * as THREE from 'three';
import { PAL, clamp, lerp, smooth, smoother, texBox, texPlane, canvasTexture, labelPlane } from '../util.js';
import { flowMaterial } from '../materials.js';
import { text3D, polishedFloor } from '../parts.js';

// ESCENA 5 · SISTEMAS CONECTADOS — Una sala de infraestructura creíble: hileras de racks con puertas perforadas, bandejas de
// cables, una compuerta de API por la que viajan las peticiones en tubos neumáticos de cristal, el bloque de bases de datos
// dentro de recintos de vidrio y, al fondo, la cámara acorazada de autenticación que se abre hacia la sala final.
export function buildDatacenter(ctx) {
  const { M, Q, col, font, textures } = ctx;
  const g = new THREE.Group(); g.name = 'datacenter';
  const sh = Q.shadows;
  const HW = 18, H = 15, ZF = -394, ZB = -494, LEN = ZF - ZB, CZ = (ZF + ZB) / 2;
  const sans = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const d = new THREE.Object3D();
  const add = (geo, mat, x, y, z, o = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh && o.cast !== false; m.receiveShadow = sh; g.add(m); return m;
  };

  // ---------- Nave: suelo técnico, muros laterales, techo con luminarias lineales
  polishedFloor(ctx, g, { w: HW * 2, h: LEN + 20, z: CZ - 6, mat: M.floorPolished, opacity: 0.8, density: 0.16 });
  for (const s of [-1, 1]) {
    add(texBox(1.2, H, LEN + 22, 0.12), M.concreteDark, s * (HW + 0.6), H / 2, CZ - 6);
    col.boxRaw([s > 0 ? HW - 0.1 : -HW - 1.8, 0, ZB - 16], [s > 0 ? HW + 1.8 : -HW + 0.1, H, ZF], 'dcwall' + s);
  }
  add(texBox(HW * 2 + 2, 1, LEN + 22, 0.12), M.graphiteDark, 0, H + 0.5, CZ - 6, { cast: false });
  const nStrip = 14, strips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.1, 7), M.glowSoft.clone(), nStrip * 2);
  strips.material.color.multiplyScalar(0.8);
  for (let i = 0; i < nStrip; i++) for (const s of [-1, 1]) { d.position.set(s * 3.2, H - 0.08, ZF - 6 - i * 7.2); d.updateMatrix(); strips.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix); }
  g.add(strips);
  const beams = new THREE.InstancedMesh(texBox(HW * 2, 0.7, 0.6, 0.2), M.graphite, 13);
  for (let i = 0; i < 13; i++) { d.position.set(0, H - 0.5, ZF - 3.6 - i * 7.2); d.updateMatrix(); beams.setMatrixAt(i, d.matrix); }
  beams.castShadow = sh; g.add(beams);

  // ---------- Racks: dos hileras enfrentadas al pasillo central (con vanos para la compuerta y el recinto de datos)
  const GAPS = [[-446, -482]];
  const rz = [];
  for (let z = ZF - 4; z > ZB + 4; z -= 1.3) if (!GAPS.some(([a, b]) => z < a && z > b)) rz.push(z);
  const doorMat = M.perfMetal.clone(); doorMat.color.set(0x4a4a56); doorMat.normalMap = null; doorMat.roughnessMap = null; doorMat.metalness = 0.55; doorMat.roughness = 0.42;
  const NR = rz.length * 2, RX = 6.2, RH = 7.6;
  const bodyMat = M.graphite.clone(); bodyMat.color.multiplyScalar(0.85);
  const rackBody = new THREE.InstancedMesh(texBox(1.7, RH, 1.2, 0.22), bodyMat, NR);
  const rackDoor = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, RH - 0.7), doorMat, NR);
  const rackCap = new THREE.InstancedMesh(new THREE.BoxGeometry(1.74, 0.12, 1.24), M.aluminum, NR);
  const NL = 6, leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.09, 0.09), M.glowSoft.clone(), NR * NL);
  leds.material.color.setScalar(1.6);
  let ri = 0;
  const segs = {};
  rz.forEach((z) => {
    for (const s of [-1, 1]) {
      d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
      d.position.set(s * RX, RH / 2 + 0.1, z); d.updateMatrix(); rackBody.setMatrixAt(ri, d.matrix);
      d.position.y = RH + 0.16; d.updateMatrix(); rackCap.setMatrixAt(ri, d.matrix);
      d.position.set(s * (RX - 0.86), RH / 2 + 0.15, z); d.rotation.y = -s * Math.PI / 2; d.updateMatrix(); rackDoor.setMatrixAt(ri, d.matrix);
      d.rotation.set(0, 0, 0);
      for (let l = 0; l < NL; l++) { d.position.set(s * (RX - 0.88), 1.3 + l * 1.05, z + 0.5); d.updateMatrix(); leds.setMatrixAt(ri * NL + l, d.matrix); }
      ri++;
    }
  });
  for (const m of [rackBody, rackDoor, rackCap]) { m.castShadow = sh && m === rackBody; m.receiveShadow = sh; g.add(m); }
  g.add(leds);
  // colisión de hileras por tramos continuos
  for (const s of [-1, 1]) {
    const tramos = []; let cur = null;
    rz.forEach((z) => { if (cur && cur.z0 - z < 1.4) cur.z0 = z; else { cur = { z1: z, z0: z }; tramos.push(cur); } });
    tramos.forEach((t, i) => col.boxRaw([s * RX - 0.9, 0, t.z0 - 0.6], [s * RX + 0.9, RH + 0.3, t.z1 + 0.6], 'rack' + s + i));
  }
  const ledCol = new THREE.Color(), ledTints = [new THREE.Color(0x8b5cff), new THREE.Color(0xe9e6ff), new THREE.Color(0x2b2a35), new THREE.Color(0x2b2a35), new THREE.Color(0x4fd3c4)];
  let ledStep = -1;
  const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
  const updateLeds = (step, act) => {
    if (step === ledStep) return; ledStep = step;
    for (let i = 0; i < NR * NL; i++) {
      const h = hash(i * 0.37 + Math.floor(step / 3) * 1.91 + (i % 5 === 0 ? step * 0.13 : 0));
      const t = ledTints[Math.min(4, Math.floor(h * 5))];
      leds.setColorAt(i, ledCol.copy(t).multiplyScalar(0.25 + 0.75 * act));
    }
    leds.instanceColor.needsUpdate = true;
  };
  leds.setColorAt(0, ledCol.set(0x222222));

  // ---------- Bandejas de cables sobre el pasillo con haces que transportan pulsos de datos
  const flows = [];
  for (const [x, y] of [[-8.6, 10.6], [8.6, 10.6], [0, 12.6]]) {
    add(texBox(1.4, 0.18, LEN + 14, 0.3), M.aluminum, x, y - 0.12, CZ - 4, { cast: false });
    for (const s of [-1, 1]) add(texBox(0.08, 0.28, LEN + 14, 0.3), M.aluminum, x + s * 0.7, y, CZ - 4, { cast: false });
    for (let k = 0; k < 3; k++) {
      const fm = flowMaterial({ color: PAL.violet, pulse: 0xffffff, speed: 0.5 + k * 0.1, density: 6 + k, base: 0.12, fogDensity: 0.0095 }); flows.push(fm);
      const cx = x + (k - 1) * 0.36;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(cx, y + 0.08, ZF + 8), new THREE.Vector3(cx, y + 0.08, ZB - 4)), 2, 0.1, 6, false), fm);
      g.add(tube);
    }
  }

  // ---------- Tubos neumáticos de cristal (peticiones) que cruzan la compuerta y descienden al bloque de datos
  const DBX = 4.5, DBZ = -469.5;
  const tubePaths = [-1, 1].map((s) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(s * 2.6, 9.0, ZF + 2), new THREE.Vector3(s * 2.6, 9.0, -452), new THREE.Vector3(s * 1.8, 9.4, -459),
    new THREE.Vector3(lerp(DBX, s * 1.6, 0.5), 10.4, -465), new THREE.Vector3(DBX + s * 0.7, 10.9, DBZ),
  ], false, 'catmullrom', 0.3));
  const tubeGlass = new THREE.MeshStandardMaterial({ color: 0xaeb0c8, emissive: 0x4a4a64, emissiveIntensity: 1.0, metalness: 0.1, roughness: 0.18, transparent: true, opacity: 0.34, depthWrite: false, envMapIntensity: 1.8, side: THREE.DoubleSide });
  const ringMat = M.aluminum.clone(); ringMat.color.set(0x7c7c8a);
  const NP = 16, caps = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 10), M.violetSatin, NP * 2);
  tubePaths.forEach((c) => {
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 90, 0.36, 12, false), tubeGlass); t.renderOrder = 3; g.add(t);
    const ringsN = 22, rings = new THREE.InstancedMesh(new THREE.TorusGeometry(0.4, 0.05, 8, 20), ringMat, ringsN);
    const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), ringMat, ringsN);
    const tg = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i < ringsN; i++) { const u = i / (ringsN - 1); c.getPointAt(u, d.position); c.getTangentAt(u, tg); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg); d.quaternion.copy(q); d.updateMatrix(); rings.setMatrixAt(i, d.matrix);
      const y0 = d.position.y + 0.4, hh = Math.max(0.2, (H - 0.6) - y0); d.quaternion.identity(); d.scale.set(1, hh, 1); d.position.y = y0 + hh / 2; d.updateMatrix(); rods.setMatrixAt(i, d.matrix); d.scale.set(1, 1, 1); }
    d.quaternion.identity(); g.add(rings, rods);
  });
  caps.castShadow = false; g.add(caps);
  const tgv = new THREE.Vector3(), qv = new THREE.Quaternion(), pv = new THREE.Vector3(), zA = new THREE.Vector3(0, 1, 0);

  // ---------- Compuerta de API
  const GZ = -450.5;
  for (const s of [-1, 1]) {
    const py = add(texBox(2.2, 13.2, 2.2, 0.2), M.graphite, s * 5.9, 6.6, GZ); col.box(py, 'pylon' + s, 0.05);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 9, 0.1), M.glowSoft.clone()); slit.material.color.multiplyScalar(0.5); slit.position.set(s * 4.74, 6.6, GZ + 1.12); g.add(slit);
  }
  const lintel = add(texBox(14.2, 1.4, 2.4, 0.2), M.graphite, 0, 12.6, GZ);
  const lintelFace = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 0.8), M.blackGloss); lintelFace.position.set(0, 12.6, GZ + 1.22); g.add(lintelFace);
  const apiTxt = text3D(ctx, 'API', 0.62, { depth: 0.12 }); apiTxt.position.set(0, 12.6, GZ + 1.3); g.add(apiTxt);
  const apiSub = labelPlane('PETICIONES · RESPUESTAS', 5.2, { w: 1024, h: 96, size: 44, color: '#bdbccb', font: sans, weight: 600, spacing: 8 }); apiSub.position.set(-4.4, 12.6, GZ + 1.24); g.add(apiSub);

  // ---------- Bloque de bases de datos: recintos de cristal con discos apilados
  const plat = add(new THREE.CylinderGeometry(9.6, 9.8, 0.5, 64), M.graphiteDark, DBX, 0.25, DBZ);
  const platRim = add(new THREE.TorusGeometry(9.62, 0.06, 6, 96), M.aluminum, DBX, 0.52, DBZ, { cast: false }); platRim.rotation.x = Math.PI / 2;
  col.boxRaw([DBX - 9.7, 0, DBZ - 9.7], [DBX + 9.7, 0.55, DBZ + 9.7], 'dbplat');
  const cyls = [];
  const mk = (x, z, r, h, n, hl) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.5, z); g.add(grp);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.35, r + 0.55, 0.5, 40), M.graphite); base.position.y = 0.25; base.castShadow = sh; grp.add(base);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 1, true), M.glass); tube.position.y = 0.5 + h / 2; tube.renderOrder = 3; grp.add(tube);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.4, 40), M.aluminum); top.position.y = 0.5 + h + 0.2; top.castShadow = sh; grp.add(top);
    const discs = new THREE.InstancedMesh(new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.24, 36), M.graphiteDark, n);
    const rings = new THREE.InstancedMesh(new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.05, 36), M.glowSoft.clone(), n);
    rings.material.color.setScalar(0.5);
    for (let i = 0; i < n; i++) { d.position.set(0, 0.9 + i * ((h - 0.8) / n), 0); d.updateMatrix(); discs.setMatrixAt(i, d.matrix); d.position.y += 0.15; d.updateMatrix(); rings.setMatrixAt(i, d.matrix); }
    grp.add(discs, rings);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.1, 36), M.glowViolet.clone()); lamp.position.y = 1; grp.add(lamp);
    const o = { grp, r, h, n, rings, lamp, hl };
    cyls.push(o);
    col.boxRaw([x - r - 0.7, 0, z - r - 0.7], [x + r + 0.7, h + 1, z + r + 0.7], 'dbcyl' + cyls.length);
    return o;
  };
  mk(DBX, DBZ, 2.6, 10.2, 18, true);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; mk(DBX + Math.cos(a) * 6.2, DBZ + Math.sin(a) * 6.2, 1.45, 6.8, 11, false); }
  const dbLabel = labelPlane('BASES DE DATOS · DEMO', 8.4, { w: 1024, h: 110, size: 54, color: '#d8d7e2', font: sans, weight: 600, spacing: 6 });
  dbLabel.rotation.x = -Math.PI / 2; dbLabel.position.set(DBX, 0.56, DBZ + 8.2); g.add(dbLabel);
  const dbRingCol = new THREE.Color();

  // ---------- Cámara acorazada de autenticación (se abre hacia la sala final)
  const VZ = ZB, VY = 5.4, VR = 5.2;
  const shp = new THREE.Shape(); shp.moveTo(-HW - 1.8, 0); shp.lineTo(HW + 1.8, 0); shp.lineTo(HW + 1.8, H + 1); shp.lineTo(-HW - 1.8, H + 1); shp.closePath();
  const hole = new THREE.Path(); hole.absarc(0, VY, VR, 0, Math.PI * 2, true); shp.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(shp, { depth: 1.6, bevelEnabled: false, curveSegments: 64 });
  { const uv = wallGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.14, uv.getY(i) * 0.14); }
  const vwall = new THREE.Mesh(wallGeo, M.concreteDark); vwall.position.set(0, 0, VZ); vwall.receiveShadow = sh; vwall.castShadow = sh; g.add(vwall);
  col.boxRaw([-HW - 2, 0, VZ - 0.2], [-VR, H, VZ + 1.8], 'vaultL'); col.boxRaw([VR, 0, VZ - 0.2], [HW + 2, H, VZ + 1.8], 'vaultR');
  col.boxRaw([-VR, VY + VR - 0.3, VZ - 0.2], [VR, H, VZ + 1.8], 'vaultT');
  const frame = new THREE.Mesh(new THREE.TorusGeometry(VR + 0.35, 0.34, 14, 72), M.aluminum); frame.position.set(0, VY, VZ + 1.7); frame.castShadow = sh; g.add(frame);
  // pasaje tras la puerta (túnel circular oscuro que conduce a la sala final)
  const tunGeo = new THREE.CylinderGeometry(VR, VR, 16, 48, 1, true); { const uv = tunGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * VR * 0.2, uv.getY(i) * 16 * 0.2); }
  const tun = new THREE.Mesh(tunGeo, M.concreteDark.clone()); tun.material.side = THREE.BackSide;
  tun.rotation.x = Math.PI / 2; tun.position.set(0, VY, VZ - 8); g.add(tun);
  const tfl = new THREE.Mesh(texPlane(7.6, 16, 0.2), M.floorMatte); tfl.rotation.x = -Math.PI / 2; tfl.position.set(0, 0.03, VZ - 8); g.add(tfl);
  col.boxRaw([-VR - 0.6, 0, VZ - 16], [-3.6, 11, VZ], 'tunL'); col.boxRaw([3.6, 0, VZ - 16], [VR + 0.6, 11, VZ], 'tunR');
  // puerta
  const door = new THREE.Group(); door.position.set(0, VY, VZ + 2.3); g.add(door);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(VR + 0.15, VR + 0.15, 0.9, 72), M.graphite); slab.rotation.x = Math.PI / 2; slab.castShadow = sh; slab.receiveShadow = sh; door.add(slab);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(VR - 0.55, VR - 0.55, 0.12, 72), M.aluminum); face.rotation.x = Math.PI / 2; face.position.z = 0.48; door.add(face);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 40), M.graphiteDark); inner.rotation.x = Math.PI / 2; inner.position.z = 0.6; door.add(inner);
  const nB = 16, bolts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 12), M.aluminum, nB);
  for (let i = 0; i < nB; i++) { const a = (i / nB) * Math.PI * 2; d.position.set(Math.cos(a) * (VR - 0.2), Math.sin(a) * (VR - 0.2), 0.52); d.rotation.set(Math.PI / 2, 0, 0); d.updateMatrix(); bolts.setMatrixAt(i, d.matrix); }
  d.rotation.set(0, 0, 0); door.add(bolts);
  const wheel = new THREE.Group(); wheel.position.z = 0.8; door.add(wheel);
  for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 0.22), M.aluminum); sp.rotation.z = i * Math.PI / 3; wheel.add(sp); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 20), M.violetMetal); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const authTxt = text3D(ctx, 'AUTH', 1.0, { depth: 0.16 }); authTxt.position.set(0, VY + VR + 2.3, VZ + 1.7); g.add(authTxt);
  const authSub = labelPlane('AUTENTICACION · ACCESO SEGURO', 8.4, { w: 1024, h: 96, size: 46, color: '#bdbccb', font: sans, weight: 600, spacing: 8 }); authSub.position.set(0, VY + VR + 1.0, VZ + 1.72); g.add(authSub);

  // Rótulos de zona
  const zoneSign = labelPlane('SERVIDORES · INFRAESTRUCTURA', 10.6, { w: 1024, h: 96, size: 50, color: '#bdbccb', font: sans, weight: 600, spacing: 8 });
  zoneSign.position.set(0, 7.2, ZF - 6); g.add(zoneSign);

  const light = new THREE.Vector3();
  return {
    group: g, range: [0.66, 0.88],
    update(s) {
      const p = s.p, L = s.L, t = s.time;
      const act = smooth(0.7, 0.74, p);
      updateLeds(Math.floor(p * 700), 0.35 + 0.65 * act);
      flows.forEach((f, i) => { f.uniforms.uTime.value = t * 0.35 + p * 120; f.uniforms.uAct.value = act; });
      // Cápsulas de peticiones avanzando por los tubos (sincronizadas con el scroll, con una deriva mínima en reposo)
      let ci = 0;
      tubePaths.forEach((c, ti) => {
        for (let i = 0; i < NP; i++) {
          const u = ((i / NP) + p * 7 + t * 0.012 + ti * 0.31) % 1;
          c.getPointAt(u, pv); c.getTangentAt(u, tgv);
          qv.setFromUnitVectors(zA, tgv); d.quaternion.copy(qv); d.position.copy(pv);
          const sc = smooth(0, 0.04, u) * (1 - smooth(0.95, 1, u)) * act; d.scale.setScalar(Math.max(0.0001, sc));
          d.updateMatrix(); caps.setMatrixAt(ci++, d.matrix);
        }
      });
      d.quaternion.identity(); d.scale.setScalar(1);
      caps.instanceMatrix.needsUpdate = true;
      // Bases de datos: nivel de escritura que sube por cada recinto y destellos en los discos
      const wr = smooth(0.79, 0.835, p);
      cyls.forEach((c, ci2) => {
        c.lamp.position.y = 0.9 + (c.h - 1.2) * ((wr * (1 + ci2 * 0.07)) % 1.0001);
        c.lamp.visible = wr > 0.01;
        for (let i = 0; i < c.n; i++) {
          const on = hash(i * 7.3 + ci2 * 3.1 + Math.floor(p * 160)) > 0.55 ? 1 : 0.18;
          c.rings.setColorAt(i, dbRingCol.setRGB(on, on * 0.95, on * (c.hl && i % 4 === 0 ? 1.0 : 0.95)));
        }
        c.rings.instanceColor.needsUpdate = true;
      });
      // Puerta de la cámara acorazada: gira la rueda, se desbloquea y rueda hacia un lado
      const u1 = smoother(0.815, 0.835, p), u2 = smoother(0.832, 0.865, p);
      wheel.rotation.z = -u1 * 3.2;
      door.position.x = -u2 * (VR * 2 + 2.4); door.rotation.z = u2 * 2.6;
      // Luces reales
      const live = smooth(0.66, 0.7, p) * (1 - smooth(0.87, 0.9, p));
      const cx = s.camera.position.x, cz = s.camera.position.z;
      L.key.position.set(cx * 0.6, H - 1.5, cz - 4); L.key.target.position.set(cx * 0.4, 1.5, cz - 22);
      L.key.color.set(0xe6e8ff); L.key.angle = 0.95; L.key.penumbra = 1; L.key.intensity = 520 * live;
      L.acc1.position.set(DBX - 2, 12, DBZ + 4); L.acc1.color.set(0xe9e6ff); L.acc1.distance = 46; L.acc1.intensity = 70 * live * smooth(0.77, 0.8, p);
      L.acc2.position.set(0, VY, VZ - 6); L.acc2.color.set(0xf1eeff); L.acc2.distance = 40; L.acc2.intensity = 260 * live * u2;
    },
  };
}
