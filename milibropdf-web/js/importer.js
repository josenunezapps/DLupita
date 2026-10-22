// Importación de PDF y EPUB: metadatos, portada y guardado local.
import { db } from './db.js';
import { uid, toast, html, esc } from './util.js';

if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

function detectFormat(file, head) {
  const name = file.name.toLowerCase();
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf'; // %PDF
  if (head[0] === 0x50 && head[1] === 0x4B) return name.endsWith('.pdf') ? null : 'epub';      // ZIP
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.epub')) return 'epub';
  return null;
}

function prettyName(fileName) {
  return fileName.replace(/\.(pdf|epub)$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Sin título';
}
function cleanTitle(t, fileName) {
  const s = String(t || '').trim();
  if (!s || s.length < 2 || /^untitled|^microsoft word|\.(docx?|pdf|indd|tex)$/i.test(s) || /^[\W\d_]+$/.test(s)) return prettyName(fileName);
  return s;
}

function cleanAuthor(a) {
  const s = String(a || '').trim();
  return /^(anonymous|unknown|desconocido|admin|user|usuario|\(anonymous\))$/i.test(s) ? '' : s;
}

async function canvasToBlob(canvas, q = 0.85) {
  return new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
}
async function resizeImageBlob(blob, maxW = 400) {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxW / bmp.width);
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await canvasToBlob(c);
  } catch { return blob; }
}

async function pdfMeta(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let title = '', author = '';
  try {
    const meta = await doc.getMetadata();
    title = meta?.info?.Title || meta?.metadata?.get?.('dc:title') || '';
    author = meta?.info?.Author || meta?.metadata?.get?.('dc:creator') || '';
  } catch {}
  let cover = null;
  try {
    const page = await doc.getPage(1);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 420 / vp1.width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    cover = await canvasToBlob(c);
  } catch {}
  const pageCount = doc.numPages;
  doc.destroy();
  return { title: cleanTitle(title, file.name), author: cleanAuthor(author), cover, pageCount };
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function epubMeta(file) {
  const buf = await file.arrayBuffer();
  const book = ePub(buf, {});
  let title = '', author = '', cover = null;
  await withTimeout(book.opened, 20000); // si el EPUB no se puede abrir, falla aquí
  try {
    const md = await withTimeout(book.loaded.metadata, 8000);
    title = md.title; author = md.creator;
  } catch {}
  try {
    const url = await withTimeout(book.coverUrl(), 8000);
    if (url) {
      const blob = await (await fetch(url)).blob();
      cover = await resizeImageBlob(blob);
    }
  } catch {}
  try { await withTimeout(book.ready, 5000); } catch {}
  setTimeout(() => { try { book.destroy(); } catch {} }, 1500);
  return { title: cleanTitle(title, file.name), author: cleanAuthor(author), cover, pageCount: null };
}

let busyEl = null;
function busy(text) {
  if (!text) { busyEl?.remove(); busyEl = null; return; }
  if (!busyEl) { busyEl = html('<div class="import-progress"><div class="spinner"></div><span></span></div>'); document.body.appendChild(busyEl); }
  busyEl.querySelector('span').textContent = text;
}

/** Importa una lista de archivos. Devuelve los libros creados. */
export async function importFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return [];
  const existing = await db.all('books');
  const created = [];
  let skipped = 0, failed = 0;
  try { navigator.storage?.persist?.(); } catch {}
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    busy(files.length > 1 ? `Agregando ${i + 1} de ${files.length}: ${file.name}` : `Agregando ${file.name}…`);
    try {
      const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const format = detectFormat(file, head);
      if (!format) { failed++; toast(`“${file.name}” no es un PDF ni un EPUB.`); continue; }
      if (existing.some(b => b.fileName === file.name && b.fileSize === file.size)) { skipped++; continue; }
      const meta = format === 'pdf' ? await pdfMeta(file) : await epubMeta(file);
      const now = Date.now();
      const book = {
        id: uid(), title: meta.title, author: meta.author, format,
        fileName: file.name, fileSize: file.size, cover: meta.cover, coverVersion: 0,
        pageCount: meta.pageCount, createdAt: now, lastOpenedAt: null,
        position: null, page: null, chapter: '', progress: 0, status: 'unread',
        favorite: false, archived: false, totalTime: 0, locations: null,
      };
      const blob = new Blob([await file.arrayBuffer()], { type: format === 'pdf' ? 'application/pdf' : 'application/epub+zip' });
      await db.put('files', { id: book.id, blob });
      await db.put('books', book);
      existing.push(book);
      created.push(book);
    } catch (err) {
      console.error(err); failed++;
      toast(`No se pudo leer “${file.name}”. ¿Está dañado o protegido con contraseña?`);
    }
  }
  busy(null);
  if (created.length === 1) toast(`“${created[0].title}” se agregó a tu biblioteca.`, { action: 'Editar datos', onAction: () => { location.hash = `#/libro/${created[0].id}?editar=1`; } });
  else if (created.length > 1) toast(`${created.length} libros agregados a tu biblioteca.`);
  if (skipped) toast(skipped === 1 ? 'Ese libro ya estaba en tu biblioteca.' : `${skipped} libros ya estaban en tu biblioteca.`);
  window.dispatchEvent(new CustomEvent('library-changed'));
  return created;
}

export { esc };
