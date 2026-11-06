// Validaciones de formularios. Los mismos límites que los CHECK de la base.

export const LIMITS = {
  orgName: 120,
  legalName: 160,
  customerName: 160,
  taxId: 20,
  phone: 40,
  email: 160,
  address: 240,
  notes: 2000,
  description: 300,
  unit: 20,
  terms: 4000,
  taxName: 30,
};

export function required(value, label) {
  return String(value ?? '').trim() === '' ? `${label} es obligatorio.` : null;
}

export function maxLen(value, max, label) {
  return String(value ?? '').length > max ? `${label}: máximo ${max} caracteres.` : null;
}

export function email(value) {
  const v = String(value ?? '').trim();
  if (v === '') return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'El email no parece válido.';
}

export function password(value) {
  const v = String(value ?? '');
  if (v.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (v.length > 72) return 'La contraseña puede tener hasta 72 caracteres.';
  return null;
}

export function hexColor(value) {
  return /^#[0-9A-Fa-f]{6}$/.test(String(value ?? '')) ? null : 'Color inválido.';
}

export function intRange(value, min, max, label) {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s)) return `${label} debe ser un número entero.`;
  const n = Number(s);
  return n < min || n > max ? `${label} debe estar entre ${min} y ${max}.` : null;
}

/** Devuelve null si el texto está vacío (para guardar NULL en vez de ""). */
export function emptyToNull(value) {
  const v = String(value ?? '').trim();
  return v === '' ? null : v;
}

/** Junta errores { campo: mensaje } descartando los null. */
export function collect(checks) {
  const errors = {};
  for (const [field, msg] of Object.entries(checks)) {
    const first = Array.isArray(msg) ? msg.find(Boolean) : msg;
    if (first) errors[field] = first;
  }
  return errors;
}
