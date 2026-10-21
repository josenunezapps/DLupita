// Escena 2 · Desarrollo de software: hélice de paneles de código y una torre de módulos hexagonales que se ensambla.
import * as THREE from 'three';
import { COL, FONT, MONO, glow, rng, clamp, lerp, smooth, ease3, easeIO, liveTex, rr, radialTex, hexField } from '../common.js';

const SNIPS = [
  { f: 'pedidos.js', l: ['// módulo de pedidos', 'import { api } from "./core";', '', 'export async function crearPedido(datos) {', '  const cliente = await api.clientes.get(datos.id);', '  if (!cliente.activo) throw new Error("inactivo");', '  const total = calcular(datos.items);', '  return api.pedidos.create({ cliente, total });', '}'] },
  { f: 'AppViewModel.kt', l: ['class AppViewModel : ViewModel() {', '  val estado = MutableStateFlow(Estado())', '', '  fun cargar() = viewModelScope.launch {', '    val lista = repo.obtenerProductos()', '    estado.value = Estado(lista)', '  }', '}'] },
  { f: 'ventas.sql', l: ['SELECT c.nombre, SUM(p.total) AS ventas', 'FROM pedidos p', 'JOIN clientes c ON c.id = p.cliente_id', 'WHERE p.fecha >= date("now", "-30 day")', 'GROUP BY c.id', 'ORDER BY ventas DESC;'] },
  { f: 'app.js', l: ['const app = createApp({', '  nombre: "Zenix",', '  tema: "oscuro",', '  modulos: [auth, pagos, panel],', '});', '', 'app.on("listo", () => {', '  console.log("sistema en línea");', '});'] },
];

const TOKEN = /(\/\/.*$)|(["'`][^"'`]*["'`])|\b(const|let|var|function|return|async|await|import|from|export|class|if|else|throw|new|fun|val|SELECT|FROM|JOIN|ON|WHERE|GROUP|BY|ORDER|AS|SUM|DESC|override)\b|\b(\d+)\b|([A-Za-z_]\w*)(?=\()/g;

function drawCode(g, w, h, snip, accent) {
  rr(g, 4, 4, w - 8, h - 8, 18);
  g.fillStyle = 'rgba(11,6,26,0.9)';
  g.fill();
  g.lineWidth = 3;
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, accent);
  gr.addColorStop(1, 'rgba(34,211,238,0.9)');
  g.strokeStyle = gr;
  g.stroke();
  // barra de título
  g.fillStyle = 'rgba(255,255,255,0.06)';
  g.fillRect(8, 8, w - 16, 40);
  ['#ff5f7a', '#ffc857', '#4ade80'].forEach((c, i) => {
    g.beginPath();
    g.arc(30 + i * 24, 28, 7, 0, 6.283);
    g.fillStyle = c;
    g.fill();
  });
  g.font = `600 17px ${MONO}`;
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.textBaseline = 'middle';
  g.fillText(snip.f, 108, 29);
  g.textBaseline = 'alphabetic';
  g.font = `500 18.5px ${MONO}`;
  snip.l.forEach((line, i) => {
    const y = 84 + i * 29;
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillText(String(i + 1).padStart(2, ' '), 24, y);
    let x = 62;
    let last = 0;
    const put = (txt, col) => {
      g.fillStyle = col;
      g.fillText(txt, x, y);
      x += g.measureText(txt).width;
    };
    TOKEN.lastIndex = 0;
    let m;
    while ((m = TOKEN.exec(line))) {
      if (m.index > last) put(line.slice(last, m.index), '#e6e1ff');
      const col = m[1] ? '#7d7aa3' : m[2] ? '#67e8f9' : m[3] ? '#c4a1ff' : m[4] ? '#fbbf77' : '#7cb4ff';
      put(m[0], col);
      last = m.index + m[0].length;
    }
    if (last < line.length) put(line.slice(last), '#e6e1ff');
  });
}

export default function build(ctx) {
  const { M, tier } = ctx;
  const g = new THREE.Group();
  const r = rng(77);

  // --- hélice de paneles --------------------------------------------------
  const helix = new THREE.Group();
  g.add(helix);
  const texs = SNIPS.map((s, i) => liveTex(576, 352, (gg, w, h) => drawCode(gg, w, h, s, i % 2 ? '#8b3dff' : '#a56bff'), 8).tex);
  const nPan = tier === 'low' ? 9 : 14;
  const panels = [];
  for (let i = 0; i < nPan; i++) {
    const a = i * 0.9;
    const R = 13.5;
    const z = 27 - i * (54 / (nPan - 1));
    const y = Math.sin(i * 0.75) * 2.4;
    const grp = new THREE.Group();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, 4.4),
      new THREE.MeshBasicMaterial({ map: texs[i % texs.length], transparent: true, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.1, 1.15), depthWrite: false })
    );
    grp.add(plane);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.7), new THREE.MeshBasicMaterial({ color: glow(COL.violet, 0.5), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    back.position.z = -0.08;
    grp.add(back);
    grp.position.set(Math.cos(a) * R, y + Math.sin(a) * R, z);
    // el panel mira hacia el eje de la hélice
    grp.lookAt(0, 0, z);
    grp.userData = { y0: y, ph: r() * 6.283 };
    helix.add(grp);
    panels.push(grp);
  }
  // hilo luminoso que une los paneles
  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const k = i / 90;
    const a = k * (nPan - 1) * 0.9;
    pts.push(new THREE.Vector3(Math.cos(a) * 13.5, Math.sin(a) * 13.5 + Math.sin(k * (nPan - 1) * 0.75) * 2.4, 27 - k * 54));
  }
  const thread = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.045, 5, false), new THREE.MeshBasicMaterial({ color: glow(COL.violet, 2.2), transparent: true, opacity: 0.8 }));
  helix.add(thread);

  // --- torre de módulos hexagonales --------------------------------------
  const cell = 0.62;
  const cells = [];
  for (let q = -2; q <= 2; q++) {
    for (let rr_ = Math.max(-2, -q - 2); rr_ <= Math.min(2, -q + 2); rr_++) {
      cells.push([cell * Math.sqrt(3) * (q + rr_ / 2), cell * 1.5 * rr_]);
    }
  }
  const LAYERS = tier === 'low' ? 6 : 8;
  const N = cells.length * LAYERS;
  const geo = new THREE.CylinderGeometry(cell * 0.94, cell * 0.94, 0.9, 6);
  geo.translate(0, 0.45, 0);
  const tower = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.92, roughness: 0.24 }), N);
  const capGeo = new THREE.RingGeometry(cell * 0.45, cell * 0.8, 6, 1);
  capGeo.rotateZ(Math.PI / 6);
  capGeo.rotateX(-Math.PI / 2);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), N);
  tower.frustumCulled = false;
  caps.frustumCulled = false;
  const towerGroup = new THREE.Group();
  towerGroup.position.y = -1;
  towerGroup.add(tower, caps);
  g.add(towerGroup);

  const parts = [];
  const cA = new THREE.Color(0x3b1d8a), cB = new THREE.Color(0x22d3ee), cT = new THREE.Color();
  const q0 = new THREE.Quaternion(), qI = new THREE.Quaternion(), qT = new THREE.Quaternion();
  for (let l = 0; l < LAYERS; l++) {
    cells.forEach(([cx, cz], ci) => {
      const idx = l * cells.length + ci;
      const sd = r() * 6.283, sp = Math.acos(2 * r() - 1), sr = 26 + r() * 26;
      parts.push({
        end: new THREE.Vector3(cx, l * 0.96, cz),
        start: new THREE.Vector3(Math.sin(sp) * Math.cos(sd) * sr, Math.cos(sp) * sr * 0.7 + 4, Math.sin(sp) * Math.sin(sd) * sr),
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6)),
        delay: (l / LAYERS) * 0.45 + r() * 0.2,
        swirl: (r() - 0.5) * 10,
        col: cA.clone().lerp(cB, l / (LAYERS - 1) * 0.85 + r() * 0.1),
      });
      tower.setColorAt(idx, parts[idx].col);
      caps.setColorAt(idx, parts[idx].col);
    });
  }
  const dummy = new THREE.Object3D();

  // --- base: piso hexagonal ------------------------------------------------
  const base = hexField({ radius: tier === 'low' ? 5 : 7, cell: 0.85, colA: COL.violet, colB: COL.cyan });
  base.group.position.set(0, -1.1, 0);
  g.add(base.group);

  // --- símbolos de código flotando -----------------------------------------
  const symbols = ['{ }', '</>', '( )', '=>', ';', '01', '[ ]', '&&'];
  const symTex = symbols.map((s) => liveTex(128, 128, (gg, w, h) => {
    gg.font = `700 56px ${MONO}`;
    gg.textAlign = 'center';
    gg.textBaseline = 'middle';
    gg.fillStyle = '#ffffff';
    gg.fillText(s, w / 2, h / 2);
  }).tex);
  const nSym = tier === 'low' ? 10 : 26;
  const syms = [];
  for (let i = 0; i < nSym; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: symTex[i % symTex.length], color: glow(i % 3 ? COL.violet : COL.cyan, 1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
    const a = r() * 6.283, rad = 5 + r() * 9;
    sp.position.set(Math.cos(a) * rad, -3 + r() * 16, (r() - 0.5) * 58);
    sp.scale.setScalar(0.8 + r() * 1.1);
    sp.userData = { v: 0.25 + r() * 0.5 };
    g.add(sp);
    syms.push(sp);
  }

  // halo detrás de la torre
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(256), color: glow(COL.violet, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 }));
  halo.scale.setScalar(24);
  halo.position.set(0, 3, -2);
  g.add(halo);

  function update(u, t, dt, st) {
    helix.rotation.z = u * 1.15 + t * 0.025;
    panels.forEach((p, i) => {
      p.position.z += 0; // posición base fija; sólo balanceo lateral
      p.scale.setScalar(1 + Math.sin(t * 0.8 + p.userData.ph) * 0.015);
    });

    // ensamblado de la torre
    const asm = clamp((u - 0.04) / 0.62);
    towerGroup.rotation.y = t * 0.12 + u * 1.3;
    for (let i = 0; i < N; i++) {
      const p = parts[i];
      const k = ease3((asm - p.delay * 0.55) / 0.45);
      dummy.position.lerpVectors(p.start, p.end, k);
      const arc = Math.sin(k * Math.PI) * p.swirl * (1 - k);
      dummy.position.x += arc;
      dummy.position.y += Math.abs(arc) * 0.4;
      qT.copy(p.q).slerp(qI, easeIO(k));
      dummy.quaternion.copy(qT);
      const sc = 0.35 + 0.65 * k;
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      tower.setMatrixAt(i, dummy.matrix);
      // tapa luminosa sólo cuando ya está en su lugar
      const on = smooth(0.85, 1, k);
      dummy.position.y += 0.92 * sc;
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
      cT.copy(p.col).multiplyScalar(on * (0.9 + 1.8 * (i / N > 0.82 ? 1 : 0.35)));
      caps.setColorAt(i, cT);
    }
    tower.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    caps.instanceColor.needsUpdate = true;

    // piso con pulso
    base.update((it) => {
      const w = 0.5 + 0.5 * Math.sin(it.d * 1.1 - t * 2.2);
      return { h: 0.18 + w * 0.35 * (1 - smooth(1, 7, it.d)), k: clamp(it.d / 8), i: 0.3 + w * 1.1 };
    });

    syms.forEach((s) => {
      s.position.y += s.userData.v * dt;
      if (s.position.y > 14) s.position.y = -4;
    });
    halo.material.opacity = 0.35 + asm * 0.35;
  }

  return { group: g, update };
}
