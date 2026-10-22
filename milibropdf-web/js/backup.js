// Copia de seguridad en un .zip: sirve para guardar todo o pasarlo a otro dispositivo.
import { db, loadSettings, saveSettings } from './db.js';
import { toast, downloadBlob } from './util.js';

export async function exportBackup({ includeFiles = true } = {}) {
  if (!window.JSZip) { toast('No se pudo preparar la copia.'); return; }
  const kill = toast(includeFiles ? 'Preparando copia completa… puede tardar si tenés muchos libros.' : 'Preparando copia…', { timeout: 60000 });
  try {
    const [books, marks, sessions, prefs] = await Promise.all([db.all('books'), db.all('marks'), db.all('sessions'), loadSettings()]);
    const zip = new JSZip();
    const data = {
      app: 'MiLibroPDF', version: 1, exportedAt: Date.now(), includesFiles: includeFiles,
      books: books.map(({ cover, ...b }) => ({ ...b, hasCover: !!cover })), marks, sessions, settings: prefs,
    };
    for (const b of books) {
      if (b.cover) zip.file(`covers/${b.id}.jpg`, b.cover);
      if (includeFiles) { const f = await db.get('files', b.id); if (f) zip.file(`files/${b.id}.${b.format}`, f.blob); }
    }
    zip.file('milibropdf.json', JSON.stringify(data));
    const blob = await zip.generateAsync({ type: 'blob', compression: includeFiles ? 'STORE' : 'DEFLATE' });
    const d = new Date();
    downloadBlob(blob, `MiLibroPDF-copia-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.zip`);
    kill(); toast('Copia descargada.');
  } catch (e) {
    console.error(e); kill(); toast('No se pudo crear la copia de seguridad.');
  }
}

export async function importBackup(file) {
  const kill = toast('Restaurando copia…', { timeout: 60000 });
  try {
    const zip = await JSZip.loadAsync(file);
    const raw = await zip.file('milibropdf.json')?.async('string');
    if (!raw) { kill(); toast('Ese archivo no es una copia de MiLibroPDF.'); return; }
    const data = JSON.parse(raw);
    let added = 0, updated = 0;
    for (const b of data.books || []) {
      const cur = await db.get('books', b.id);
      const coverEntry = zip.file(`covers/${b.id}.jpg`);
      const cover = coverEntry ? new Blob([await coverEntry.async('arraybuffer')], { type: 'image/jpeg' }) : null;
      const { hasCover, ...clean } = b;
      if (!cur) { await db.put('books', { ...clean, cover }); added++; }
      else if ((b.lastOpenedAt || 0) > (cur.lastOpenedAt || 0)) {
        await db.put('books', { ...cur, ...clean, cover: cover || cur.cover, totalTime: Math.max(cur.totalTime || 0, b.totalTime || 0) }); updated++;
      }
      const fileEntry = zip.file(`files/${b.id}.${b.format}`);
      if (fileEntry && !(await db.get('files', b.id))) {
        const buf = await fileEntry.async('arraybuffer');
        await db.put('files', { id: b.id, blob: new Blob([buf], { type: b.format === 'pdf' ? 'application/pdf' : 'application/epub+zip' }) });
      }
    }
    for (const m of data.marks || []) {
      const cur = await db.get('marks', m.id);
      if (!cur || (m.updatedAt || 0) > (cur.updatedAt || 0)) await db.put('marks', m);
    }
    for (const s of data.sessions || []) if (!(await db.get('sessions', s.id))) await db.put('sessions', s);
    if (data.settings) await saveSettings(data.settings);
    kill();
    toast(`Copia restaurada: ${added} ${added === 1 ? 'libro nuevo' : 'libros nuevos'}${updated ? `, ${updated} actualizados` : ''}.`);
    window.dispatchEvent(new CustomEvent('library-changed'));
    window.dispatchEvent(new CustomEvent('settings-restored'));
  } catch (e) {
    console.error(e); kill(); toast('No se pudo leer la copia de seguridad.');
  }
}
