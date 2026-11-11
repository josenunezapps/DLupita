// Ensayo destructivo: se multiplica toda la carga hasta el colapso, quitando las barras que fallan.
import { analyze } from './analysis.js';
import { clone, nodeById } from './model.js';

/**
 * Hipótesis (se muestran al usuario): comportamiento lineal, rotura frágil (la barra que alcanza
 * su capacidad real, sin coeficiente de seguridad, deja de trabajar) y vehículo detenido en la
 * posición más desfavorable.
 */
export function loadToFailure(model) {
  const base = analyze(model);
  if (!base.ok) return { ok: false, reason: base.message };

  const work = clone(model);
  work.settings.safety = 1;
  let vehicleNode = null;
  if (base.P > 0 && base.worstPos != null) {
    vehicleNode = base.chain.ids[base.worstPos];
    const n = nodeById(work, vehicleNode);
    n.load = { fx: n.load?.fx || 0, fy: (n.load?.fy || 0) - base.P };
  }
  work.settings.moving = { ...work.settings.moving, enabled: false };

  const events = [], stages = [];
  let lambda = 0, collapse = null;
  const removed = new Set();

  for (let guard = 0; guard <= model.members.length; guard++) {
    const res = analyze(work);
    if (!res.ok) { collapse = { lambda, mode: res.mode ? Array.from(res.mode) : null, status: res.status }; break; }
    const u1 = {};
    let worst = null;
    for (const r of res.members) { u1[r.id] = { u: r.u, sign: Math.sign(r.Ngov) }; if (!worst || r.u > worst.u) worst = r; }
    if (!worst || worst.u < 1e-9) {
      if (!events.length) return { ok: false, reason: 'No hay cargas para ensayar: agregá una carga o activá el peso propio.' };
      break;
    }
    const next = Math.max(lambda, 1 / worst.u);
    stages.push({ from: lambda, to: next, u1 });
    lambda = next;
    events.push({ lambda, memberId: worst.id, mode: worst.mode });
    removed.add(worst.id);
    work.members = work.members.filter((b) => b.id !== worst.id);
    if (!work.members.length) { collapse = { lambda, mode: null, status: 'empty' }; break; }
  }
  if (!collapse) collapse = { lambda, mode: null, status: 'mechanism' };

  return {
    ok: true, events, stages, removed: [...removed], vehicleNode,
    firstLambda: events[0].lambda, collapseLambda: collapse.lambda,
    survivors: work.members.map((b) => b.id),
  };
}
