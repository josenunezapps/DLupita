// Análisis estático de reticulados planos por el método de rigidez directa.
// Unidades: m, kN, kPa. Esfuerzo axial N > 0 = tracción, N < 0 = compresión.
import { G, materialOf, profileOf } from './catalog.js';
import { cholesky, cholSolve, softestMode } from './linalg.js';

/** Capacidad de una barra: fluencia en tracción; fluencia o pandeo de Euler (biarticulada) en compresión. */
export function memberCapacity(profile, material, L, safety = 1) {
  const yieldN = profile.A * material.fy;
  const euler = (Math.PI ** 2 * material.E * profile.I) / (L * L);
  return {
    capT: yieldN / safety,
    capC: Math.min(yieldN, euler) / safety,
    buckling: euler < yieldN,
    yieldN, euler,
  };
}

/** Aprovechamiento (demanda / capacidad) para un rango de esfuerzos [Nmin, Nmax]. */
export function utilization(Nmax, Nmin, cap) {
  const ut = Nmax > 0 ? Nmax / cap.capT : 0;
  const uc = Nmin < 0 ? -Nmin / cap.capC : 0;
  if (uc === 0 && ut === 0) return { u: 0, mode: 'sin esfuerzo', N: 0 };
  return uc > ut
    ? { u: uc, mode: cap.buckling ? 'pandeo' : 'compresión', N: Nmin }
    : { u: ut, mode: 'tracción', N: Nmax };
}

/** Nudos del tablero ordenados de izquierda a derecha, con su posición relativa t ∈ [0, 1]. */
export function deckChain(model) {
  const ids = new Set();
  for (const b of model.members) if (b.deck) { ids.add(b.a); ids.add(b.b); }
  const nodes = model.nodes.filter((n) => ids.has(n.id)).sort((p, q) => p.x - q.x || p.y - q.y);
  if (nodes.length < 2) return null;
  const dist = [0];
  for (let i = 1; i < nodes.length; i++) {
    dist.push(dist[i - 1] + Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y));
  }
  const total = dist[dist.length - 1] || 1;
  return { ids: nodes.map((n) => n.id), nodes, t: dist.map((d) => d / total), length: total };
}

/** Reparto de una carga puntual ubicada en s ∈ [0,1] entre los dos nudos vecinos (regla de la palanca). */
export function vehicleWeights(chain, s) {
  const w = new Float64Array(chain.ids.length);
  const t = chain.t;
  const sc = Math.min(1, Math.max(0, s));
  let i = 0;
  while (i < t.length - 2 && sc > t[i + 1]) i++;
  const span = t[i + 1] - t[i] || 1;
  const f = (sc - t[i]) / span;
  w[i] = 1 - f; w[i + 1] = f;
  return w;
}

/** Punto (x, y) del vehículo sobre el tablero. */
export function vehiclePoint(chain, s) {
  const w = vehicleWeights(chain, s);
  let x = 0, y = 0;
  chain.nodes.forEach((n, i) => { x += n.x * w[i]; y += n.y * w[i]; });
  return { x, y };
}

const fail = (status, message, extra = {}) => ({ ok: false, status, message, ...extra });

/**
 * Analiza el modelo. Devuelve esfuerzos, desplazamientos, reacciones, envolvente de carga móvil
 * y aprovechamiento de cada barra. Con `vehiclePos` (0..1) calcula además el estado instantáneo.
 */
export function analyze(model, { vehiclePos = null } = {}) {
  const { nodes, members, settings } = model;
  if (!nodes.length) return fail('empty', 'La hoja está vacía.');
  if (!members.length) return fail('empty', 'Todavía no hay barras: uní dos nudos para empezar.');

  const material = materialOf(model);
  const nN = nodes.length;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const used = new Uint8Array(nN);

  const geo = [];
  for (const b of members) {
    const ia = index.get(b.a), ib = index.get(b.b);
    const dx = nodes[ib].x - nodes[ia].x, dy = nodes[ib].y - nodes[ia].y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return fail('degenerate', `La barra ${b.id} tiene longitud cero: separá sus nudos.`, { memberId: b.id });
    const profile = profileOf(b);
    used[ia] = used[ib] = 1;
    geo.push({ ia, ib, L, c: dx / L, s: dy / L, profile, k: (material.E * profile.A) / L, mass: profile.A * L * material.rho });
  }

  // Grados de libertad libres
  const dofMap = new Int32Array(2 * nN).fill(-1);
  let nf = 0, restrained = 0;
  for (let i = 0; i < nN; i++) {
    if (!used[i]) continue;
    const sup = nodes[i].support;
    const fixX = sup === 'pin' || sup === 'rollerY';
    const fixY = sup === 'pin' || sup === 'rollerX';
    if (fixX) restrained++; else dofMap[2 * i] = nf++;
    if (fixY) restrained++; else dofMap[2 * i + 1] = nf++;
  }

  // Matriz de rigidez global reducida
  const K = new Float64Array(nf * nf);
  for (const g of geo) {
    const d = [dofMap[2 * g.ia], dofMap[2 * g.ia + 1], dofMap[2 * g.ib], dofMap[2 * g.ib + 1]];
    const v = [-g.c, -g.s, g.c, g.s];
    for (let p = 0; p < 4; p++) {
      if (d[p] < 0) continue;
      for (let q = 0; q < 4; q++) if (d[q] >= 0) K[d[p] * nf + d[q]] += g.k * v[p] * v[q];
    }
  }

  const Kraw = Float64Array.from(K);
  if (nf > 0 && !cholesky(K, nf).ok) {
    const mode = softestMode(Kraw, nf);
    const full = new Float64Array(2 * nN);
    for (let d = 0; d < 2 * nN; d++) if (dofMap[d] >= 0) full[d] = mode[dofMap[d]];
    return fail(
      restrained < 3 ? 'unsupported' : 'mechanism',
      restrained < 3
        ? 'Faltan apoyos: la estructura se desplaza o gira entera. Necesita al menos un apoyo fijo y uno móvil.'
        : 'Es un mecanismo: se deforma sin oponer resistencia. Agregá una diagonal o un apoyo donde se mueve.',
      { mode: full },
    );
  }

  // Cargas base: peso propio + cargas en nudos
  const loadsFull = new Float64Array(2 * nN);
  if (settings.selfWeight) {
    for (const g of geo) {
      const w = (g.mass * G) / 1000 / 2;
      loadsFull[2 * g.ia + 1] -= w; loadsFull[2 * g.ib + 1] -= w;
    }
  }
  nodes.forEach((n, i) => {
    if (n.load && used[i]) { loadsFull[2 * i] += n.load.fx || 0; loadsFull[2 * i + 1] += n.load.fy || 0; }
  });

  const reduce = (full) => {
    const r = new Float64Array(nf);
    for (let d = 0; d < 2 * nN; d++) if (dofMap[d] >= 0) r[dofMap[d]] = full[d];
    return r;
  };
  const expand = (u) => {
    const full = new Float64Array(2 * nN);
    for (let d = 0; d < 2 * nN; d++) if (dofMap[d] >= 0) full[d] = u[dofMap[d]];
    return full;
  };
  const solve = (full) => expand(nf ? cholSolve(K, nf, reduce(full)) : new Float64Array(0));
  const axial = (u) => geo.map((g) => g.k * ((u[2 * g.ib] - u[2 * g.ia]) * g.c + (u[2 * g.ib + 1] - u[2 * g.ia + 1]) * g.s));

  const u0 = solve(loadsFull);
  const N0 = axial(u0);

  // Líneas de influencia: carga unitaria hacia abajo en cada nudo del tablero
  const moving = settings.moving || {};
  const chain = deckChain(model);
  const P = moving.enabled && chain ? Math.max(0, moving.P || 0) : 0;
  let unitU = null, unitN = null;
  if (chain) {
    unitU = []; unitN = [];
    for (const id of chain.ids) {
      const f = new Float64Array(2 * nN);
      f[2 * index.get(id) + 1] = -1;
      const u = solve(f);
      unitU.push(u); unitN.push(axial(u));
    }
  }

  // Estado instantáneo (vehículo en una posición concreta) o estado base
  let disp = u0, loadsNow = loadsFull, weights = null;
  if (P > 0 && vehiclePos != null) {
    weights = vehicleWeights(chain, vehiclePos);
    disp = Float64Array.from(u0);
    loadsNow = Float64Array.from(loadsFull);
    weights.forEach((w, j) => {
      if (!w) return;
      const uj = unitU[j];
      for (let d = 0; d < disp.length; d++) disp[d] += P * w * uj[d];
      loadsNow[2 * index.get(chain.ids[j]) + 1] -= P * w;
    });
  }

  const results = [];
  const byId = new Map();
  let mass = 0, maxU = 0, worstId = null;
  members.forEach((b, i) => {
    const g = geo[i];
    const infl = unitN ? unitN.map((arr) => arr[i]) : null;
    let Nmax = N0[i], Nmin = N0[i];
    if (P > 0) {
      Nmax += P * Math.max(0, ...infl);
      Nmin += P * Math.min(0, ...infl);
    }
    const cap = memberCapacity(g.profile, material, g.L, settings.safety);
    const ut = utilization(Nmax, Nmin, cap);
    let Nnow = ut.N;
    if (weights) { Nnow = N0[i]; weights.forEach((w, j) => { Nnow += P * w * infl[j]; }); }
    const r = {
      id: b.id, L: g.L, mass: g.mass, N0: N0[i], Nmax, Nmin, Nnow, infl,
      capT: cap.capT, capC: cap.capC, buckling: cap.buckling, u: ut.u, mode: ut.mode, Ngov: ut.N,
    };
    results.push(r); byId.set(b.id, r);
    mass += g.mass;
    if (ut.u > maxU) { maxU = ut.u; worstId = b.id; }
  });

  // Reacciones: equilibrio de cada nudo apoyado con las cargas del estado mostrado
  const reactions = [];
  const sumF = Float64Array.from(loadsNow);
  geo.forEach((g, i) => {
    const N = weights ? results[i].Nnow : N0[i];
    sumF[2 * g.ia] += N * g.c; sumF[2 * g.ia + 1] += N * g.s;
    sumF[2 * g.ib] -= N * g.c; sumF[2 * g.ib + 1] -= N * g.s;
  });
  nodes.forEach((n, i) => {
    if (n.support && used[i]) reactions.push({ id: n.id, rx: dofMap[2 * i] < 0 ? -sumF[2 * i] : 0, ry: dofMap[2 * i + 1] < 0 ? -sumF[2 * i + 1] : 0 });
  });

  // Posición del vehículo que más exige a la estructura (para el ensayo destructivo)
  let worstPos = null;
  if (P > 0) {
    let best = -1;
    chain.ids.forEach((_, j) => {
      let m = 0;
      results.forEach((r) => {
        const N = r.N0 + P * r.infl[j];
        m = Math.max(m, N > 0 ? N / r.capT : -N / r.capC);
      });
      if (m > best) { best = m; worstPos = j; }
    });
  }

  let maxDisp = 0;
  for (let i = 0; i < nN; i++) maxDisp = Math.max(maxDisp, Math.hypot(disp[2 * i], disp[2 * i + 1]));

  return {
    ok: true, status: 'ok', message: '',
    members: results, byId, disp, reactions, index,
    chain, P, worstPos, instant: !!weights,
    totals: { mass, cost: mass * (settings.pricePerKg || 0), maxU, worstId, pass: maxU <= 1 + 1e-9, maxDisp },
  };
}
