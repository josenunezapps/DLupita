// Guardado local en el navegador (localStorage). Sin servidor: los datos no salen del dispositivo.
import { emptyData, validateData } from './products.js';

export const KEY = 'remarca.v1';

export function createPersistence(storage) {
  let volatile = false, store = storage;
  const memory = new Map();
  const fallback = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  try { if (!store) throw 0; store.setItem(KEY + '.probe', '1'); store.removeItem(KEY + '.probe'); } catch { store = fallback; volatile = true; }

  let data = null, prefs = {}, corrupted = false;
  try {
    const raw = store.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const v = validateData(parsed.data);
      if (v.ok) data = v.data; else corrupted = true;
      prefs = parsed.prefs && typeof parsed.prefs === 'object' ? parsed.prefs : {};
    }
  } catch { corrupted = true; }

  const flush = () => {
    try { store.setItem(KEY, JSON.stringify({ data, prefs })); return { ok: true }; }
    catch (e) { return { ok: false, error: /quota/i.test(String(e?.name) + String(e?.message)) ? 'El almacenamiento del navegador está lleno. Probá con un logo más liviano o exportá una copia.' : 'No se pudo guardar en este navegador.' }; }
  };
  return {
    get volatile() { return volatile; }, get corrupted() { return corrupted; },
    load: () => data, prefs: () => prefs, isNew: () => data == null,
    save(next) { data = next; return flush(); },
    savePrefs(p) { prefs = { ...prefs, ...p }; return flush(); },
    empty: emptyData,
  };
}

export const BACKUP_KIND = 'remarca-copia';
export const serializeBackup = (data) => JSON.stringify({ kind: BACKUP_KIND, version: 1, exportedAt: new Date().toISOString(), data }, null, 1);
export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return { ok: false, error: 'No es un archivo de copia válido. Elegí un archivo .remarca.json exportado desde acá.' }; }
  if (obj?.kind !== BACKUP_KIND) return { ok: false, error: 'El archivo no es una copia de Remarca.' };
  if (!(obj.version <= 1)) return { ok: false, error: 'La copia es de una versión más nueva de Remarca.' };
  return validateData(obj.data);
}
