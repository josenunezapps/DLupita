// Plantillas locales por negocio. No incluyen datos del cliente ni sustituyen a los borradores de Supabase.
const PREFIX = 'cotizapro:templates:v1:';
const LIMIT = 30;
const validId = id => String(id || '').match(/^[a-zA-Z0-9-]{1,80}$/) !== null;
function key(orgId) { if (!validId(orgId)) throw new Error('Negocio no válido.'); return PREFIX + orgId; }
function read(storage, orgId) {
  try { const v = JSON.parse(storage.getItem(key(orgId)) || '[]'); return Array.isArray(v) ? v.filter(x => x && typeof x.id === 'string' && typeof x.name === 'string' && Array.isArray(x.lines)) : []; }
  catch { return []; }
}
export function listTemplates(orgId, storage = localStorage) { return read(storage, orgId); }
export function saveTemplate(orgId, name, data, storage = localStorage) {
  const label = String(name || '').trim();
  if (!label || label.length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
  if (!Array.isArray(data.lines) || data.lines.length === 0 || data.lines.length > 100) throw new Error('Agregá entre 1 y 100 conceptos.');
  const lines = data.lines.map(l => ({
    description: String(l.description || '').slice(0, 300), unit: String(l.unit || 'unidad').slice(0, 20),
    qty: String(l.qty || '1'), price: String(l.price || ''), disc: String(l.disc || ''),
  }));
  const items = read(storage, orgId);
  const match = items.find(x => x.name.toLocaleLowerCase('es') === label.toLocaleLowerCase('es'));
  const entry = { id: match?.id || ('tpl-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9)),
    name: label, title: String(data.title || '').slice(0, 160), notes: String(data.notes || '').slice(0, 4000),
    discount_type: ['none','percent','amount'].includes(data.discount_type) ? data.discount_type : 'none',
    discount_text: String(data.discount_text || ''), lines };
  if (!match && items.length >= LIMIT) throw new Error('Máximo de 30 plantillas.');
  const next = match ? items.map(x => x.id === match.id ? entry : x) : [...items, entry];
  storage.setItem(key(orgId), JSON.stringify(next));
  return entry;
}
export function removeTemplate(orgId, id, storage = localStorage) {
  const before = read(storage, orgId);
  storage.setItem(key(orgId), JSON.stringify(before.filter(x => x.id !== id)));
  return before.length > read(storage, orgId).length;
}
