// Remarca: punto de entrada. Conecta el estado, el guardado, las vistas, las acciones y los atajos.
import { toCSV } from './core/csv.js';
import { demoData } from './core/demo.js';
import { formatMoney } from './core/money.js';
import { createPersistence, parseBackup, serializeBackup } from './core/persist.js';
import { emptyData, removeProducts } from './core/products.js';
import { createStore } from './core/store.js';
import { $, $$, debounce, download, esc, hydrateIcons, isCompact, plural, reducedMotion, slug } from './ui/dom.js';
import { createPalette, dialog, toast } from './ui/kit.js';
import { createLabelsView } from './ui/labels-view.js';
import { createPostersView } from './ui/posters-view.js';
import { createProductsView, editProduct, openReprice } from './ui/products-view.js';
import { createShopView, openImport, readLogo } from './ui/shop-view.js';

const VIEWS = [['products', 'Productos'], ['posters', 'Carteles'], ['labels', 'Etiquetas'], ['shop', 'Negocio']];

// ───────── Estado ─────────
let storage = null;
try { storage = window.localStorage; } catch { /* almacenamiento bloqueado: se trabaja en memoria */ }
const persist = createPersistence(storage);
const prefs = persist.prefs();
const firstVisit = persist.isNew();
const initial = persist.load() || demoData();

const store = createStore({
  model: initial,
  view: VIEWS.some(([v]) => v === prefs.view) ? prefs.view : 'products',
  sel: [],
  filter: { query: '', category: null, flag: null, sort: 'category' },
  poster: { template: 'estallido', format: 'story', productIds: [], title: '', note: prefs.note ?? 'Hasta agotar stock', showBefore: true, showShop: true, touched: false },
  labels: { size: prefs.labelSize || 'chica', scope: 'pending', category: '', barcode: prefs.barcode ?? true, date: prefs.date ?? true, shopName: prefs.labelShop ?? false },
});

const app = { store, persist, toast, actions: {}, logo: null, fillImport: null };
const A = app.actions;
hydrateIcons();

const views = { products: createProductsView(app), posters: createPostersView(app), labels: createLabelsView(app), shop: createShopView(app) };

// El logo se mantiene decodificado para dibujarlo en los carteles.
let logoSrc = null;
function syncLogo() {
  const src = store.get().model.shop.logo;
  if (src === logoSrc) return;
  logoSrc = src; app.logo = null;
  if (!src) return;
  const img = new Image();
  img.onload = () => { if (logoSrc === src) { app.logo = img; views.posters.draw(); } };
  img.src = src;
}

// ───────── Acciones ─────────
const announce = (label, verb) => label && toast(`${verb}: ${label}`, { duration: 1600 });
A.go = (view) => { store.set({ view }); persist.savePrefs({ view }); $('#main').scrollTo({ top: 0 }); };
A.undo = () => announce(store.undo(), 'Deshecho');
A.redo = () => announce(store.redo(), 'Rehecho');
A.toggleTheme = () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme; persist.savePrefs({ theme });
};
A.newProduct = () => { if (store.get().view !== 'products') A.go('products'); editProduct(app); };
A.reprice = () => { if (store.get().view !== 'products') A.go('products'); openReprice(app); };
A.deleteProducts = (ids) => {
  if (!ids.length) return;
  const names = store.get().model.products.filter((p) => ids.includes(p.id)).map((p) => p.name);
  store.mutate((d) => removeProducts(d, ids), { label: 'borrar' });
  store.set({ sel: store.get().sel.filter((id) => !ids.includes(id)) });
  toast(names.length === 1 ? `${names[0]} borrado` : `${names.length} productos borrados`, { action: { label: 'Deshacer', run: () => store.undo() } });
};
A.posterFor = (ids) => {
  const one = ids.length === 1, cur = store.get().poster;
  store.set({ poster: { ...cur, template: one ? (cur.template === 'lista' ? 'estallido' : cur.template) : 'lista', productIds: ids.slice(0, 8), title: one ? cur.title : '', touched: true } });
  A.go('posters');
};
A.labelsFor = (ids) => { store.set({ sel: ids, labels: { ...store.get().labels, scope: 'sel' } }); A.go('labels'); };
A.print = () => { if (store.get().view !== 'labels') A.go('labels'); requestAnimationFrame(() => views.labels.print()); };

// Datos
function replaceData(data, message) {
  store.mutate((d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, data); }, { label: 'reemplazar datos' });
  store.set({ sel: [], filter: { query: '', category: null, flag: null, sort: 'category' }, poster: { ...store.get().poster, productIds: [], touched: false } });
  toast(message, { duration: 6000, action: { label: 'Deshacer', run: () => store.undo() } });
}
A.loadDemo = async () => {
  const has = store.get().model.products.length && !store.get().model.demo;
  if (has && !(await dialog({ title: 'Cargar el ejemplo', html: '<p>Se reemplazan tus productos y los datos del negocio por un almacén inventado. Podés deshacerlo enseguida, o guardar una copia antes.</p>', buttons: [{ label: 'Cancelar', value: false }, { label: 'Cargar el ejemplo', value: true, primary: true }] }))) return;
  replaceData(demoData(), 'Almacén de ejemplo cargado');
};
A.startOwn = () => { replaceData(emptyData(), 'Listo: lista vacía para tu negocio'); A.go('shop'); setTimeout(() => $('#shName').focus(), 60); };
A.wipe = async () => {
  if (!(await dialog({ title: 'Borrar todo', html: `<p>Se borran ${plural(store.get().model.products.length, 'producto', 'productos')}, el nombre, los colores y el logo de este dispositivo.</p>`, buttons: [{ label: 'Cancelar', value: false, primary: true }, { label: 'Borrar todo', value: true, danger: true }] }))) return;
  replaceData(emptyData(), 'Todo borrado');
};
const base = () => slug(store.get().model.shop.name || 'remarca');
A.exportCSV = () => { const d = store.get().model; if (!d.products.length) return toast('No hay productos para exportar', { kind: 'error' }); download(`lista-de-precios-${base()}.csv`, toCSV(d.products), 'text/csv;charset=utf-8'); toast(`Lista exportada: ${plural(d.products.length, 'producto', 'productos')}`); };
A.backup = () => { download(`${base()}.remarca.json`, serializeBackup(store.get().model), 'application/json'); toast('Copia guardada en tus descargas'); };
A.restore = () => $('#fileBackup').click();
A.importList = () => openImport(app);

async function restoreText(text, name = '') {
  const r = parseBackup(text);
  if (!r.ok) return dialog({ title: 'No se pudo recuperar', html: `<p>${name ? `«${esc(name)}»: ` : ''}${esc(r.error)}</p><p class="fine">Tus datos actuales no se modificaron.</p>` });
  replaceData(r.data, `Copia recuperada: ${plural(r.data.products.length, 'producto', 'productos')}${r.bad ? `, ${r.bad} descartados por datos inválidos` : ''}`);
}
async function takeFile(file) {
  if (!file) return;
  if (file.size > 5e6) return dialog({ title: 'Archivo demasiado grande', html: '<p>El archivo pesa más de 5 MB; no parece una lista de precios ni una copia de Remarca.</p>' });
  let text;
  try { text = await file.text(); } catch { return dialog({ title: 'No se pudo leer', html: '<p>El navegador no pudo leer el archivo. Probá de nuevo.</p>' }); }
  if (/\.json$/i.test(file.name) || text.trimStart().startsWith('{')) return restoreText(text, file.name);
  if (app.fillImport) app.fillImport(text); else openImport(app, text);
}
app.takeFile = takeFile; app.restoreText = restoreText;
$('#fileCsv').addEventListener('change', (e) => { takeFile(e.target.files[0]); e.target.value = ''; });
$('#fileBackup').addEventListener('change', (e) => { takeFile(e.target.files[0]); e.target.value = ''; });
$('#fileLogo').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try { const logo = await readLogo(file); store.mutate((d) => { d.shop.logo = logo; }, { label: 'cambiar logo' }); toast('Logo actualizado'); }
  catch (err) { toast(err.message, { kind: 'error' }); }
});

A.help = () => dialog({
  title: 'Cómo se usa',
  html: `<p><b>1.</b> Cargá tus productos (o importalos desde Excel). <b>2.</b> Cuando cambian los precios, usá «Remarcar» para subirlos todos juntos. <b>3.</b> Imprimí sólo las etiquetas que cambiaron y sacá los carteles de oferta para el estado de WhatsApp.</p>
    <dl class="keys">${[['Buscar una acción o un producto', 'Ctrl K'], ['Producto nuevo', 'N'], ['Remarcar precios', 'R'], ['Buscar en la lista', '/'], ['Productos, Carteles, Etiquetas, Negocio', '1 2 3 4'], ['Imprimir etiquetas', 'Ctrl P'], ['Deshacer y rehacer', 'Ctrl Z, Ctrl Mayús Z'], ['Elegir todos los productos a la vista', 'Ctrl A'], ['Tema claro u oscuro', 'T']].map(([t, k]) => `<dt>${t}</dt><dd><kbd>${k}</kbd></dd>`).join('')}</dl>
    <p class="fine">En la búsqueda de productos podés escribir palabras, «oferta», «pendiente» o comparaciones como «>3000». También podés arrastrar una lista de precios o una copia sobre la ventana para importarla.</p>
    <p class="fine">Todo se guarda en este navegador, sin servidor ni cuenta. No se sincroniza entre dispositivos: usá «Guardar una copia» en Negocio para llevarlo a otro lado.</p>`,
});

// ───────── Paleta de comandos ─────────
const palette = createPalette(() => {
  const { model, sel } = store.get();
  return [
    { title: 'Remarcar precios', keys: 'R', keywords: 'aumentar subir bajar porcentaje inflacion', run: A.reprice },
    { title: 'Producto nuevo', keys: 'N', keywords: 'agregar cargar alta', run: A.newProduct },
    { title: 'Imprimir etiquetas', keys: 'Ctrl P', keywords: 'pdf gondola', run: A.print },
    ...VIEWS.map(([v, label], i) => ({ title: `Ir a ${label}`, keys: String(i + 1), run: () => A.go(v) })),
    { title: 'Importar lista de precios desde Excel', group: 'Datos', keywords: 'csv pegar proveedor', run: A.importList },
    { title: 'Exportar lista de precios a Excel', group: 'Datos', keywords: 'csv descargar', run: A.exportCSV },
    { title: 'Guardar una copia de seguridad', group: 'Datos', keywords: 'backup respaldo exportar', run: A.backup },
    { title: 'Recuperar una copia de seguridad', group: 'Datos', keywords: 'backup restaurar importar', run: A.restore },
    { title: 'Cargar el almacén de ejemplo', group: 'Datos', keywords: 'demo prueba', run: A.loadDemo },
    { title: 'Deshacer', keys: 'Ctrl Z', run: A.undo }, { title: 'Rehacer', keys: 'Ctrl Mayús Z', run: A.redo },
    { title: 'Cambiar entre claro y oscuro', keys: 'T', keywords: 'tema noche', run: A.toggleTheme },
    { title: 'Ayuda', keys: '?', keywords: 'atajos como se usa', run: A.help },
    ...(sel.length ? [{ title: `Hacer cartel con ${plural(sel.length, 'el elegido', 'los elegidos')}`, group: 'Selección', run: () => A.posterFor(sel) }, { title: `Etiquetas de ${plural(sel.length, 'el elegido', 'los elegidos')}`, group: 'Selección', run: () => A.labelsFor(sel) }] : []),
    ...model.products.map((p) => ({ title: `Editar ${p.name}`, group: formatMoney(p.price), keywords: `${p.category} ${p.code}`, run: () => { if (store.get().view !== 'products') A.go('products'); editProduct(app, p.id); } })),
    ...model.products.filter((p) => p.offer).map((p) => ({ title: `Cartel de ${p.name}`, group: 'Oferta', run: () => A.posterFor([p.id]) })),
  ];
});
A.palette = () => palette.open();

// ───────── Teclado ─────────
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if (mod && key === 'k') { e.preventDefault(); return A.palette(); }
  if ($('dialog[open]')) return;
  const typing = e.target.matches?.('input:not([type="checkbox"]), select, textarea');
  if (mod && key === 'z' && !typing) { e.preventDefault(); return e.shiftKey ? A.redo() : A.undo(); }
  if (mod && key === 'y' && !typing) { e.preventDefault(); return A.redo(); }
  if (mod && key === 'p') { e.preventDefault(); return A.print(); }
  if (mod && key === 'a' && !typing && store.get().view === 'products') { e.preventDefault(); return store.set({ sel: $$('#pList [data-pick]').map((i) => i.dataset.pick) }); }
  if (key === 'escape' && typing && e.target.id === 'pQuery' && e.target.value) { e.target.value = ''; return store.set({ filter: { ...store.get().filter, query: '' } }); }
  if (typing || mod || e.altKey) return;
  if (key === 'escape' && store.get().sel.length) return store.set({ sel: [] });
  if (key === 'n') { e.preventDefault(); return A.newProduct(); }
  if (key === 'r') { e.preventDefault(); return A.reprice(); }
  if (key === 't') return A.toggleTheme();
  if (key === '/') { e.preventDefault(); if (store.get().view !== 'products') A.go('products'); return views.products.focusSearch(); }
  if (key === '?') return A.help();
  const n = Number(key); if (n >= 1 && n <= 4) return A.go(VIEWS[n - 1][0]);
});

// ───────── Barra superior y navegación ─────────
$('#btnPalette').addEventListener('click', A.palette);
$('#btnUndo').addEventListener('click', A.undo);
$('#btnRedo').addEventListener('click', A.redo);
$('#btnTheme').addEventListener('click', A.toggleTheme);
$('#btnHelp').addEventListener('click', A.help);
$('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) A.go(b.dataset.view); });
$('#nav').addEventListener('keydown', (e) => {
  const keys = isCompact() ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  if (!keys.includes(e.key)) return;
  const tabs = $$('#nav [role="tab"]'), i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === keys[1] ? 1 : -1) + tabs.length) % tabs.length];
  e.preventDefault(); next.focus(); next.click();
});
$('#demoBanner').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="start-own"]')) A.startOwn();
  else if (e.target.closest('[data-act="keep-demo"]')) store.mutate((d) => { d.demo = false; }, { label: 'quedarse con el ejemplo' });
});

// Arrastrar archivos sobre la ventana
let depth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; $('#drop').hidden = false; e.preventDefault(); } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --depth <= 0) { depth = 0; $('#drop').hidden = true; } });
window.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; $('#drop').hidden = true; takeFile(e.dataTransfer.files[0]); });

// ───────── Guardado automático ─────────
const saveState = $('#saveState');
function flushSave() {
  const r = persist.save(store.get().model);
  saveState.dataset.state = r.ok ? 'ok' : 'error';
  saveState.textContent = !r.ok ? 'Sin guardar' : persist.volatile ? 'Este navegador no guarda' : 'Guardado';
  if (!r.ok) toast(r.error, { kind: 'error', duration: 7000 });
}
const debouncedSave = debounce(flushSave, 400);
window.addEventListener('pagehide', () => persist.save(store.get().model));

// ───────── Sincronización ─────────
function syncChrome() {
  const s = store.get(), d = s.model;
  $('#shopName').textContent = d.shop.name || 'Tu negocio';
  document.title = `${d.shop.name ? d.shop.name + ', ' : ''}Remarca`;
  $('#btnUndo').disabled = !store.canUndo(); $('#btnRedo').disabled = !store.canRedo();
  $$('#nav [role="tab"]').forEach((t) => { const on = t.dataset.view === s.view; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; });
  const pending = d.products.filter((p) => p.pending).length;
  if (pending) $('#n-labels').dataset.badge = pending > 99 ? '99+' : pending; else delete $('#n-labels').dataset.badge;
  $('#demoBanner').hidden = !d.demo || s.view !== 'products';
  syncLogo();
}

store.subscribe((s, prev) => {
  if (s.model !== prev.model) {
    const ids = new Set(s.model.products.map((p) => p.id));
    if (s.sel.some((id) => !ids.has(id))) return store.set({ sel: s.sel.filter((id) => ids.has(id)) });
    saveState.textContent = 'Guardando…'; debouncedSave();
  }
  if (s.labels !== prev.labels) persist.savePrefs({ labelSize: s.labels.size, barcode: s.labels.barcode, date: s.labels.date, labelShop: s.labels.shopName });
  if (s.poster.note !== prev.poster.note) persist.savePrefs({ note: s.poster.note });
  syncChrome();
  views[s.view].render();
});

syncChrome();
views[store.get().view].render();
flushSave();
if (persist.corrupted) toast('Los datos guardados estaban dañados y no se pudieron recuperar', { kind: 'error', duration: 8000 });
if (firstVisit) setTimeout(() => toast('Cargamos un almacén de ejemplo para que pruebes. Tocá «Remarcar precios».', { duration: 5000 }), 1100);

const boot = $('#boot');
setTimeout(() => { boot.classList.add('gone'); setTimeout(() => boot.remove(), 500); }, reducedMotion() ? 0 : Math.max(0, 900 - performance.now()));
window.remarca = Object.assign(app, { views });
