// Documentos guardados en IndexedDB (las fotos son Blobs, no entran en localStorage).
const DB = 'zenix-escaner', STORE = 'docs';
let dbp;
function open() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
    const out = fn(s);
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
}
export const allDocs = async () => (await tx('readonly', s => s.getAll())).sort((a, b) => b.updatedAt - a.updatedAt);
export const getDoc = id => tx('readonly', s => s.get(id));
export const putDoc = doc => { doc.updatedAt = Date.now(); return tx('readwrite', s => s.put(doc)); };
export const deleteDoc = id => tx('readwrite', s => s.delete(id));
