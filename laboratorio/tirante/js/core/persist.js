// Persistencia local. Todo queda en el almacenamiento del navegador (localStorage):
// no hay servidor, no se sincroniza entre dispositivos y se pierde si se borran los datos del sitio.
import { validateModel } from './io.js';

const KEY = 'tirante.v1';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

export function createPersistence(storage) {
  let volatile = false;
  let store = storage;
  try {
    if (!store) throw new Error('sin almacenamiento');
    store.setItem(KEY + '.probe', '1'); store.removeItem(KEY + '.probe');
  } catch { store = memoryStorage(); volatile = true; }

  let data = { projects: {}, currentId: null, prefs: {} };
  let corrupted = false;
  try {
    const raw = store.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [id, m] of Object.entries(parsed.projects || {})) {
        const v = validateModel(m);
        if (v.ok) data.projects[id] = { ...v.model, id }; else corrupted = true;
      }
      data.currentId = data.projects[parsed.currentId] ? parsed.currentId : null;
      data.prefs = parsed.prefs && typeof parsed.prefs === 'object' ? parsed.prefs : {};
    }
  } catch { corrupted = true; }

  const flush = () => {
    try { store.setItem(KEY, JSON.stringify(data)); return { ok: true }; }
    catch (e) { return { ok: false, error: /quota/i.test(e?.name + e?.message) ? 'El almacenamiento del navegador está lleno. Exportá o borrá proyectos.' : 'No se pudo guardar en este navegador.' }; }
  };

  return {
    get volatile() { return volatile; },
    get corrupted() { return corrupted; },
    list: () => Object.values(data.projects),
    get: (id) => data.projects[id] || null,
    currentId: () => data.currentId,
    prefs: () => data.prefs,
    saveProject(model, { current = true } = {}) { data.projects[model.id] = model; if (current) data.currentId = model.id; return flush(); },
    deleteProject(id) { delete data.projects[id]; if (data.currentId === id) data.currentId = null; return flush(); },
    savePrefs(prefs) { data.prefs = { ...data.prefs, ...prefs }; return flush(); },
  };
}
