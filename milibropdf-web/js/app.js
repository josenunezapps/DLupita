// Arranque, navegación por hash, importación (selector y arrastrar y soltar) y tema.
import { loadSettings, settings, onSettings } from './db.js';
import { renderHome, renderLibrary, renderDetail, renderMarks, renderStats, renderSettings } from './views.js';
import { importFiles } from './importer.js';
import { openReader, closeReader, isReaderOpen } from './reader.js';
import { toast } from './util.js';

const view = document.getElementById('view');
let currentRoute = '';

function applyTheme() {
  const t = settings().appTheme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1A1417' : '#5B2140');
}

function parse() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || ''), path };
}

async function route({ soft = false } = {}) {
  const { parts, query } = parse();
  const name = parts[0] || '';
  if (name === 'leer' && parts[1]) {
    await openReader(decodeURIComponent(parts[1]), query);
    return;
  }
  if (isReaderOpen()) closeReader();
  const navKey = { '': 'home', biblioteca: 'library', libro: 'library', notas: 'notes', estadisticas: 'stats', ajustes: 'settings' }[name] || 'home';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === navKey));
  const titles = { home: 'Inicio', library: 'Biblioteca', notes: 'Notas y fragmentos', stats: 'Estadísticas', settings: 'Configuración' };
  document.title = `${titles[navKey]} · MiLibroPDF`;
  try {
    switch (name) {
      case '': await renderHome(view); break;
      case 'biblioteca': await renderLibrary(view, query); break;
      case 'libro': await renderDetail(view, decodeURIComponent(parts[1] || ''), query); break;
      case 'notas': await renderMarks(view); break;
      case 'estadisticas': await renderStats(view); break;
      case 'ajustes': await renderSettings(view); break;
      default: location.replace('#/'); return;
    }
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="empty"><h2>Algo salió mal</h2><p>${e?.message || 'Error inesperado'}</p><a class="btn" href="#/">Volver al inicio</a></div>`;
  }
  if (!soft) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
}

window.addEventListener('hashchange', () => {
  window.__prevRoute = currentRoute;
  currentRoute = location.hash || '#/';
  route();
});

// Re-dibujar la vista actual si cambian los datos (importación, restauración, cierre del lector)
let pending = false;
window.addEventListener('library-changed', () => {
  if (isReaderOpen() || pending) return;
  pending = true;
  setTimeout(() => { pending = false; if (!isReaderOpen()) route({ soft: true }); }, 50);
});
window.addEventListener('settings-restored', () => applyTheme());

// ---------- Importación ----------
const fileInput = document.getElementById('file-input');
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action=import]');
  if (b) { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', async () => {
  const files = [...fileInput.files]; fileInput.value = '';
  const created = await importFiles(files);
  if (created.length === 1 && !isReaderOpen()) location.hash = `#/libro/${created[0].id}`;
});
const overlay = document.getElementById('drop-overlay');
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => { if (!hasFiles(e) || isReaderOpen()) return; e.preventDefault(); dragDepth++; overlay.classList.add('show'); });
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('show'); });
window.addEventListener('drop', async e => {
  if (!hasFiles(e)) return;
  e.preventDefault(); dragDepth = 0; overlay.classList.remove('show');
  if (isReaderOpen()) return;
  await importFiles(e.dataTransfer.files);
});

// ---------- Inicio ----------
(async function init() {
  await loadSettings();
  applyTheme();
  onSettings((s, changed) => { if ('appTheme' in changed) applyTheme(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  currentRoute = location.hash || '#/';
  await route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // Abrir PDF/EPUB con la app instalada (file handlers)
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer(async params => {
      if (!params.files?.length) return;
      const files = await Promise.all(params.files.map(h => h.getFile()));
      const created = await importFiles(files);
      if (created.length) location.hash = `#/leer/${created[0].id}`;
    });
  }
  // Si el navegador puede borrar datos por falta de espacio, pedir almacenamiento persistente
  try { if (navigator.storage?.persisted && !(await navigator.storage.persisted())) navigator.storage.persist?.(); } catch {}
  if (!window.pdfjsLib || !window.ePub) toast('No se pudieron cargar los lectores. Recargá la página.');
})();
