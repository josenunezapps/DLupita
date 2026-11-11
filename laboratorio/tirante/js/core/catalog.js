// Catálogo de materiales y perfiles. Unidades internas: m, kN, kPa, kg.
export const G = 9.80665;

export const MATERIALS = {
  S275: { id: 'S275', name: 'Acero S275', E: 210e6, fy: 275e3, rho: 7850 },
  S355: { id: 'S355', name: 'Acero S355', E: 210e6, fy: 355e3, rho: 7850 },
  AL6061: { id: 'AL6061', name: 'Aluminio 6061-T6', E: 69e6, fy: 240e3, rho: 2700 },
};

// Tubos circulares huecos (diámetro exterior × espesor, en mm).
// El área y la inercia se calculan a partir de la geometría, no se tabulan a mano.
const CHS = [
  [33.7, 2.6], [42.4, 2.6], [48.3, 3.2], [60.3, 3.2], [76.1, 3.6], [88.9, 4],
  [114.3, 4], [139.7, 5], [168.3, 6.3], [219.1, 8], [273, 10], [323.9, 12.5], [406.4, 16],
];

export const PROFILES = CHS.map(([D, t], index) => {
  const d = D - 2 * t;
  return {
    id: `CHS ${D}x${t}`,
    label: `Ø${String(D).replace('.', ',')} × ${String(t).replace('.', ',')}`,
    index, D, t,
    A: (Math.PI / 4) * (D * D - d * d) / 1e6,   // m²
    I: (Math.PI / 64) * (D ** 4 - d ** 4) / 1e12, // m⁴
  };
});

export const PROFILE_BY_ID = new Map(PROFILES.map((p) => [p.id, p]));
export const DEFAULT_PROFILE = 'CHS 88.9x4';

export const profileOf = (member) => PROFILE_BY_ID.get(member.profile) || PROFILE_BY_ID.get(DEFAULT_PROFILE);
export const materialOf = (model) => MATERIALS[model.settings.material] || MATERIALS.S275;
export const kgPerMeter = (profile, material) => profile.A * material.rho;
