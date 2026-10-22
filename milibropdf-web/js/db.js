// Almacenamiento local con IndexedDB: libros, archivos, marcas, sesiones y ajustes.
const DB_NAME = 'milibropdf';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('marks')) {
        const s = db.createObjectStore('marks', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store, mode = 'readonly') {
  const db = await open();
  return db.transaction(store, mode).objectStore(store);
}

export const db = {
  async get(store, key) { return wrap((await tx(store)).get(key)); },
  async all(store) { return wrap((await tx(store)).getAll()); },
  async byIndex(store, index, value) { return wrap((await tx(store)).index(index).getAll(value)); },
  async put(store, value) { return wrap((await tx(store, 'readwrite')).put(value)); },
  async del(store, key) { return wrap((await tx(store, 'readwrite')).delete(key)); },
  async clear(store) { return wrap((await tx(store, 'readwrite')).clear()); },
  async patch(store, key, changes) {
    const cur = await this.get(store, key);
    if (!cur) return null;
    const next = { ...cur, ...changes };
    await this.put(store, next);
    return next;
  },
};

// ---------- Ajustes ----------
export const DEFAULT_SETTINGS = {
  appTheme: 'light',        // light | dark | system
  readerTheme: 'light',     // light | sepia | dark
  fontSize: 100,            // % (EPUB)
  lineHeight: 1.6,
  fontFamily: 'publisher',  // publisher | serif | sans | literata
  margin: 6,                // % lateral (EPUB)
  epubFlow: 'paginated',    // paginated | scrolled
  pdfZoom: 'width',         // 'width' o número
  ttsVoice: '',
  ttsRate: 1,
  ttsLang: 'es',
  keepAwake: true,
  smartTimeout: 0,          // minutos; 0 = desactivado
  libraryView: 'grid',
  librarySort: 'recent',
  highlightColor: '#F5D76E',
};

let settingsCache = null;
const listeners = new Set();

export async function loadSettings() {
  if (settingsCache) return settingsCache;
  const row = await db.get('settings', 'prefs');
  settingsCache = { ...DEFAULT_SETTINGS, ...(row ? row.value : {}) };
  return settingsCache;
}
export function settings() { return settingsCache || { ...DEFAULT_SETTINGS }; }
export async function saveSettings(changes) {
  settingsCache = { ...(await loadSettings()), ...changes };
  await db.put('settings', { key: 'prefs', value: settingsCache });
  listeners.forEach(fn => fn(settingsCache, changes));
  return settingsCache;
}
export function onSettings(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ---------- Libros ----------
export async function deleteBook(id) {
  await db.del('books', id);
  await db.del('files', id);
  for (const m of await db.byIndex('marks', 'bookId', id)) await db.del('marks', m.id);
  for (const s of await db.byIndex('sessions', 'bookId', id)) await db.del('sessions', s.id);
}
