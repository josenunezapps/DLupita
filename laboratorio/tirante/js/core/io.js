// Importación y exportación: proyecto (JSON), tabla de resultados (CSV) y plano (SVG).
import { MATERIALS, PROFILE_BY_ID, materialOf, profileOf } from './catalog.js';
import { LIMITS, SUPPORTS, bounds, defaultSettings, uid } from './model.js';

export const FILE_KIND = 'tirante-proyecto';
export const FILE_VERSION = 1;

export function serializeProject(model) {
  return JSON.stringify({ kind: FILE_KIND, version: FILE_VERSION, exportedAt: new Date().toISOString(), model }, null, 2);
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clampNum = (v, lo, hi, def) => (isNum(v) ? Math.min(hi, Math.max(lo, v)) : def);

/** Valida y normaliza un modelo que viene de afuera. Devuelve {ok, model} o {ok:false, errors}. */
export function validateModel(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['El archivo no contiene una estructura.'] };
  if (!Array.isArray(raw.nodes) || !Array.isArray(raw.members)) return { ok: false, errors: ['Faltan las listas de nudos y barras.'] };
  if (raw.nodes.length > LIMITS.nodes) errors.push(`Tiene ${raw.nodes.length} nudos; el máximo es ${LIMITS.nodes}.`);
  if (raw.members.length > LIMITS.members) errors.push(`Tiene ${raw.members.length} barras; el máximo es ${LIMITS.members}.`);
  if (errors.length) return { ok: false, errors };

  const ids = new Set();
  const nodes = [];
  raw.nodes.forEach((n, i) => {
    const tag = `Nudo ${n?.id ?? i + 1}`;
    if (!n || typeof n.id !== 'string' || !n.id) return errors.push(`El nudo en la posición ${i + 1} no tiene identificador.`);
    if (ids.has(n.id)) return errors.push(`${tag}: identificador repetido.`);
    if (!isNum(n.x) || !isNum(n.y)) return errors.push(`${tag}: coordenadas inválidas.`);
    if (Math.abs(n.x) > LIMITS.coord || Math.abs(n.y) > LIMITS.coord) return errors.push(`${tag}: está a más de ${LIMITS.coord} m del origen.`);
    if (n.support != null && !SUPPORTS.includes(n.support)) return errors.push(`${tag}: tipo de apoyo desconocido ("${n.support}").`);
    let load = null;
    if (n.load != null) {
      if (!isNum(n.load.fx ?? 0) || !isNum(n.load.fy ?? 0)) return errors.push(`${tag}: carga inválida.`);
      load = { fx: clampNum(n.load.fx ?? 0, -LIMITS.load, LIMITS.load, 0), fy: clampNum(n.load.fy ?? 0, -LIMITS.load, LIMITS.load, 0) };
      if (!load.fx && !load.fy) load = null;
    }
    ids.add(n.id);
    nodes.push({ id: n.id, x: n.x, y: n.y, support: n.support ?? null, load });
  });

  const mids = new Set(), pairs = new Set();
  const members = [];
  raw.members.forEach((b, i) => {
    const tag = `Barra ${b?.id ?? i + 1}`;
    if (!b || typeof b.id !== 'string' || !b.id) return errors.push(`La barra en la posición ${i + 1} no tiene identificador.`);
    if (mids.has(b.id)) return errors.push(`${tag}: identificador repetido.`);
    if (!ids.has(b.a) || !ids.has(b.b)) return errors.push(`${tag}: une un nudo que no existe.`);
    if (b.a === b.b) return errors.push(`${tag}: empieza y termina en el mismo nudo.`);
    const key = [b.a, b.b].sort().join('|');
    if (pairs.has(key)) return errors.push(`${tag}: duplica otra barra entre los mismos nudos.`);
    if (!PROFILE_BY_ID.has(b.profile)) return errors.push(`${tag}: perfil desconocido ("${b.profile}").`);
    mids.add(b.id); pairs.add(key);
    members.push({ id: b.id, a: b.a, b: b.b, profile: b.profile, deck: !!b.deck });
  });
  if (errors.length) return { ok: false, errors: errors.slice(0, 8).concat(errors.length > 8 ? [`…y ${errors.length - 8} problemas más.`] : []) };

  const d = defaultSettings(), s = raw.settings || {};
  const settings = {
    material: MATERIALS[s.material] ? s.material : d.material,
    safety: clampNum(s.safety, 1, 5, d.safety),
    selfWeight: s.selfWeight !== false,
    pricePerKg: clampNum(s.pricePerKg, 0, 1000, d.pricePerKg),
    grid: clampNum(s.grid, 0.05, 10, d.grid),
    snap: s.snap !== false,
    moving: { enabled: !!s.moving?.enabled, P: clampNum(s.moving?.P, 0, LIMITS.load, d.moving.P) },
  };
  const maxSeq = (list, prefix) => list.reduce((m, e) => { const k = e.id.startsWith(prefix) ? parseInt(e.id.slice(1), 10) : NaN; return Number.isFinite(k) ? Math.max(m, k) : m; }, list.length);
  const now = Date.now();
  return {
    ok: true,
    model: {
      id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Importado',
      example: !!raw.example,
      createdAt: isNum(raw.createdAt) ? raw.createdAt : now, updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
      seq: { n: maxSeq(nodes, 'N'), b: maxSeq(members, 'B') }, settings, nodes, members,
    },
  };
}

export function parseProject(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, errors: ['No es un archivo JSON válido. Elegí un archivo exportado desde Tirante (.tirante.json).'] }; }
  if (data?.kind !== FILE_KIND) return { ok: false, errors: ['El archivo no es un proyecto de Tirante.'] };
  if (!(data.version <= FILE_VERSION)) return { ok: false, errors: [`El archivo es de una versión más nueva (${data.version}). Actualizá la aplicación.`] };
  return validateModel(data.model);
}

const dec = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits).replace('.', ',') : '');

/** CSV con separador ; y coma decimal (abre directo en Excel y Sheets en español). */
export function toCSV(model, results) {
  const rows = [['barra', 'nudo_a', 'nudo_b', 'perfil', 'longitud_m', 'N_max_kN', 'N_min_kN', 'capacidad_traccion_kN', 'capacidad_compresion_kN', 'aprovechamiento_pct', 'modo', 'masa_kg']];
  model.members.forEach((b) => {
    const r = results?.ok ? results.byId.get(b.id) : null;
    rows.push([b.id, b.a, b.b, b.profile, r ? dec(r.L, 3) : '', r ? dec(r.Nmax) : '', r ? dec(r.Nmin) : '', r ? dec(r.capT) : '', r ? dec(r.capC) : '', r ? dec(r.u * 100, 1) : '', r ? r.mode : 'sin calcular', r ? dec(r.mass, 1) : '']);
  });
  return '﻿' + rows.map((r) => r.join(';')).join('\r\n');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Plano vectorial con cajetín. `mini` genera la miniatura para la biblioteca. */
export function toSVG(model, results, { mini = false } = {}) {
  const b = bounds(model);
  const w = Math.max(b.maxX - b.minX, 1), h = Math.max(b.maxY - b.minY, 1);
  const S = mini ? 100 / Math.max(w, h * 1.6) : 1000 / w;
  const pad = mini ? 10 : 90, block = mini ? 0 : 120;
  const W = w * S + pad * 2, H = h * S + pad * 2 + block;
  const X = (x) => (pad + (x - b.minX) * S).toFixed(1), Y = (y) => (pad + (b.maxY - y) * S).toFixed(1);
  const node = new Map(model.nodes.map((n) => [n.id, n]));
  const ok = results?.ok;
  const ink = '#10253F', tension = '#D8432E', compression = '#1668C7';
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" font-family="Bahnschrift, 'DIN Alternate', 'Roboto Condensed', sans-serif">`;
  if (!mini) out += `<rect width="100%" height="100%" fill="#F4F7F8"/><rect x="20" y="20" width="${(W - 40).toFixed(0)}" height="${(H - 40).toFixed(0)}" fill="none" stroke="${ink}" stroke-width="2"/>`;
  for (const m of model.members) {
    const a = node.get(m.a), c = node.get(m.b);
    const r = ok ? results.byId.get(m.id) : null;
    const color = mini ? 'currentColor' : !r || Math.abs(r.Ngov) < 1e-6 ? '#7C8A99' : r.Ngov > 0 ? tension : compression;
    const sw = mini ? 2 : 3 + profileOf(m).D / 45;
    out += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}" stroke="${color}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`;
    if (!mini && r) out += `<text x="${((+X(a.x) + +X(c.x)) / 2).toFixed(1)}" y="${((+Y(a.y) + +Y(c.y)) / 2 - 8).toFixed(1)}" font-size="13" text-anchor="middle" fill="${ink}">${esc(m.id)} ${r.Ngov >= 0 ? '+' : '−'}${dec(Math.abs(r.Ngov), 0)}</text>`;
  }
  for (const n of model.nodes) {
    const x = +X(n.x), y = +Y(n.y);
    if (n.support) out += `<path d="M${x} ${y} l${mini ? 5 : 14} ${mini ? 8 : 22} h-${mini ? 10 : 28} z" fill="none" stroke="${mini ? 'currentColor' : ink}" stroke-width="${mini ? 1.2 : 2}"/>`;
    if (!mini && n.support && n.support !== 'pin') out += `<line x1="${x - 16}" y1="${y + 27}" x2="${x + 16}" y2="${y + 27}" stroke="${ink}" stroke-width="2"/>`;
    out += `<circle cx="${x}" cy="${y}" r="${mini ? 2.2 : 5}" fill="${mini ? 'currentColor' : '#F4F7F8'}" stroke="${mini ? 'none' : ink}" stroke-width="2"/>`;
    if (!mini && n.load) {
      const L = Math.hypot(n.load.fx, n.load.fy) || 1, ux = n.load.fx / L, uy = -n.load.fy / L;
      out += `<line x1="${(x - ux * 60).toFixed(1)}" y1="${(y - uy * 60).toFixed(1)}" x2="${(x - ux * 9).toFixed(1)}" y2="${(y - uy * 9).toFixed(1)}" stroke="${ink}" stroke-width="2.5" marker-end="url(#f)"/><text x="${(x - ux * 66).toFixed(1)}" y="${(y - uy * 66).toFixed(1)}" font-size="13" text-anchor="middle" fill="${ink}">${dec(L, 0)} kN</text>`;
    }
  }
  if (!mini) {
    const t = ok ? results.totals : null, mat = materialOf(model);
    const by = H - 20 - block, col = (W - 40) / 4;
    const cell = (i, label, value) => `<text x="${(32 + col * i).toFixed(0)}" y="${by + 30}" font-size="13" fill="#5B6B7C">${esc(label)}</text><text x="${(32 + col * i).toFixed(0)}" y="${by + 62}" font-size="24" fill="${ink}">${esc(value)}</text>`;
    out += `<defs><marker id="f" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="${ink}"/></marker></defs>`;
    out += `<line x1="20" y1="${by}" x2="${(W - 20).toFixed(0)}" y2="${by}" stroke="${ink}" stroke-width="2"/>`;
    out += cell(0, 'Proyecto', model.name) + cell(1, 'Material y seguridad', `${mat.name}, γ ${dec(model.settings.safety, 2)}`);
    out += cell(2, 'Peso de la estructura', t ? `${dec(t.mass, 0)} kg` : 'sin calcular') + cell(3, 'Barra más exigida', t ? `${dec(t.maxU * 100, 0)} % ${t.pass ? '(resiste)' : '(no resiste)'}` : 'sin calcular');
    out += `<text x="32" y="${by + 96}" font-size="12" fill="#5B6B7C">Rojo: tracción. Azul: compresión. Esfuerzos en kN. Predimensionado orientativo hecho con Tirante; no reemplaza un cálculo profesional. ${new Date().toLocaleDateString('es-AR')}</text>`;
  }
  return out + '</svg>';
}
