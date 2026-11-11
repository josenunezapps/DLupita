// Dimensionado automático: elige para cada barra el perfil más liviano que resiste.
import { PROFILES, materialOf } from './catalog.js';
import { analyze, memberCapacity, utilization } from './analysis.js';
import { clone } from './model.js';

/**
 * Diseño "totalmente aprovechado" con perfiles discretos. Como al cambiar secciones cambian
 * el peso propio y el reparto de esfuerzos, se itera hasta que ninguna barra cambia.
 */
export function optimize(model, { maxIter = 40, target = 1 } = {}) {
  const first = analyze(model);
  if (!first.ok) return { ok: false, reason: first.message };
  const work = clone(model);
  const material = materialOf(work);
  let res = first, iterations = 0;

  for (; iterations < maxIter; iterations++) {
    let changes = 0;
    work.members.forEach((b, i) => {
      const r = res.members[i];
      let pick = PROFILES[PROFILES.length - 1];
      for (const p of PROFILES) {
        const cap = memberCapacity(p, material, r.L, work.settings.safety);
        if (utilization(r.Nmax, r.Nmin, cap).u <= target) { pick = p; break; }
      }
      const current = PROFILES.findIndex((p) => p.id === b.profile);
      // Pasadas las primeras vueltas sólo se permite engrosar: evita oscilar entre dos perfiles.
      if (pick.index !== current && (iterations < 12 || pick.index > current)) { b.profile = pick.id; changes++; }
    });
    if (!changes) break;
    res = analyze(work);
    if (!res.ok) return { ok: false, reason: res.message };
  }

  const changed = work.members.filter((b, i) => b.profile !== model.members[i].profile).length;
  return {
    ok: true, model: work, iterations, changed,
    before: { mass: first.totals.mass, maxU: first.totals.maxU },
    after: { mass: res.totals.mass, maxU: res.totals.maxU, pass: res.totals.pass },
  };
}
