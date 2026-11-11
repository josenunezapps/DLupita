// Modelo de datos de una estructura y operaciones puras sobre él.
import { DEFAULT_PROFILE } from './catalog.js';

export const SUPPORTS = ['pin', 'rollerX', 'rollerY'];
export const SUPPORT_LABEL = { pin: 'Fijo', rollerX: 'Móvil horizontal', rollerY: 'Móvil vertical' };
export const LIMITS = { nodes: 400, members: 1200, coord: 500, load: 100000 };

export const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clone = (obj) => structuredClone(obj);

export function defaultSettings() {
  return {
    material: 'S275', safety: 1.5, selfWeight: true, pricePerKg: 1.8,
    grid: 0.5, snap: true, moving: { enabled: false, P: 100 },
  };
}

export function emptyModel(name = 'Sin título') {
  const now = Date.now();
  return {
    id: uid(), name, example: false, createdAt: now, updatedAt: now,
    seq: { n: 0, b: 0 }, settings: defaultSettings(), nodes: [], members: [],
  };
}

export const nodeById = (m, id) => m.nodes.find((n) => n.id === id);
export const memberById = (m, id) => m.members.find((b) => b.id === id);
export const nodeAt = (m, x, y, tol = 1e-6) => m.nodes.find((n) => Math.abs(n.x - x) < tol && Math.abs(n.y - y) < tol);
export const memberBetween = (m, a, b) => m.members.find((k) => (k.a === a && k.b === b) || (k.a === b && k.b === a));

export function addNode(m, x, y, extra = {}) {
  const found = nodeAt(m, x, y);
  if (found) return found;
  const node = { id: 'N' + ++m.seq.n, x, y, support: null, load: null, ...extra };
  m.nodes.push(node);
  return node;
}

export function addMember(m, a, b, extra = {}) {
  if (a === b || !nodeById(m, a) || !nodeById(m, b) || memberBetween(m, a, b)) return null;
  const member = { id: 'B' + ++m.seq.b, a, b, profile: DEFAULT_PROFILE, deck: false, ...extra };
  m.members.push(member);
  return member;
}

export function removeMember(m, id) {
  m.members = m.members.filter((b) => b.id !== id);
}

export function removeNode(m, id) {
  m.nodes = m.nodes.filter((n) => n.id !== id);
  m.members = m.members.filter((b) => b.a !== id && b.b !== id);
}

/** Parte una barra en dos insertando un nudo en (x, y). */
export function splitMember(m, memberId, x, y) {
  const old = memberById(m, memberId);
  if (!old) return null;
  const node = addNode(m, x, y);
  if (node.id === old.a || node.id === old.b) return node;
  removeMember(m, memberId);
  addMember(m, old.a, node.id, { profile: old.profile, deck: old.deck });
  addMember(m, node.id, old.b, { profile: old.profile, deck: old.deck });
  return node;
}

/** Funde el nudo `fromId` dentro de `intoId` (las barras se reconectan; se descartan duplicadas). */
export function mergeNodes(m, fromId, intoId) {
  if (fromId === intoId) return;
  const from = nodeById(m, fromId), into = nodeById(m, intoId);
  if (!from || !into) return;
  if (!into.support && from.support) into.support = from.support;
  if (!into.load && from.load) into.load = from.load;
  const kept = [];
  for (const b of m.members) {
    const a2 = b.a === fromId ? intoId : b.a, b2 = b.b === fromId ? intoId : b.b;
    if (a2 === b2) continue;
    if (kept.some((k) => (k.a === a2 && k.b === b2) || (k.a === b2 && k.b === a2))) continue;
    kept.push({ ...b, a: a2, b: b2 });
  }
  m.members = kept;
  m.nodes = m.nodes.filter((n) => n.id !== fromId);
}

export function memberLength(m, member) {
  const a = nodeById(m, member.a), b = nodeById(m, member.b);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function bounds(m) {
  if (!m.nodes.length) return { minX: -6, maxX: 6, minY: -2, maxY: 5, empty: true };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of m.nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
  }
  return { minX, maxX, minY, maxY, empty: false };
}

export const snap = (v, grid) => Math.round(v / grid) * grid;
