// Tirante: punto de entrada. Conecta el estado, el cálculo, la hoja y los paneles.
import { PROFILES } from './core/catalog.js';
import { analyze } from './core/analysis.js';
import { optimize } from './core/optimize.js';
import { EXAMPLES, buildExample } from './core/examples.js';
import { parseProject, serializeProject, toCSV, toSVG } from './core/io.js';
import { clone, emptyModel, memberById, nodeById, removeMember, removeNode, uid } from './core/model.js';
import { createStore } from './core/store.js';
import { createPersistence } from './core/persist.js';
import { $, $$, debounce, download, esc, hydrateIcons, icon, isCompact, kg, money, num, pct, reducedMotion, slug } from './ui/dom.js';
import { createPalette, dialog, toast } from './ui/kit.js';
import { createSheet } from './ui/sheet.js';
import { createView3D } from './ui/view3d.js';
import { createPanels } from './ui/panels.js';
import { startTest } from './ui/test.js';

const TOOLS = [
  ['select', 'Seleccionar y mover', 'V'], ['node', 'Agregar nudo', 'N'], ['member', 'Dibujar barra', 'B'],
  ['support', 'Poner o cambiar apoyo', 'A'], ['load', 'Poner carga', 'C'], ['erase', 'Borrar', 'X'],
];

// ───────── Estado inicial ─────────
let storage = null;
try { storage = window.localStorage; } catch { /* almacenamiento bloqueado: se trabaja en memoria */ }
const persist = createPersistence(storage);
const prefs = persist.prefs();
const firstVisit = persist.list().length === 0;
let initial = persist.get(persist.currentId()) || persist.list().sort((a, b) => b.updatedAt - a.updatedAt)[0];
if (!initial) { initial = buildExample('warren'); persist.saveProject(initial); }

const store = createStore({
  model: initial,
  sel: { nodes: [], members: [] },
  tool: 'select',
  tab: 'sel',
  vehiclePos: null,
  view: { deform: prefs.deform ?? 1, labels: prefs.labels ?? true, flow: prefs.flow ?? true, mode: '2d' },
});

const app = { store, persist, results: null, test: null, toast, actions: {}, solveMs: 0 };

function solve() {
  const s = store.get();
  const t0 = performance.now();
  app.results = analyze(s.model, { vehiclePos: s.vehiclePos });
  app.solveMs = performance.now() - t0;
}
solve();

hydrateIcons();
const sheet = createSheet({ canvas: $('#sheet'), app });
const view3d = createView3D({ canvas: $('#view3d'), app });
const panels = createPanels(app);
const panelEl = $('#panel');
/** En pantallas chicas el panel es una hoja inferior: al abrirla o cerrarla se reencuadra el dibujo. */
function setPanel(open) {
  if (!isCompact() || panelEl.classList.contains('open') === open) return;
  panelEl.classList.toggle('open', open);
  if (!app.test) sheet.fit();
}

// ───────── Acciones ─────────
const A = app.actions;
const announce = (label, verb) => label && toast(`${verb}: ${label}`, { duration: 1600 });

A.setTool = (tool) => store.set({ tool });
A.undo = () => announce(store.undo(), 'Deshecho');
A.redo = () => announce(store.redo(), 'Rehecho');
A.fit = () => sheet.fit();
A.setView = (patch) => { const view = { ...store.get().view, ...patch }; store.set({ view }); persist.savePrefs({ deform: view.deform, labels: view.labels, flow: view.flow }); };
A.toggleSnap = () => store.mutate((m) => { m.settings.snap = !m.settings.snap; }, { record: false });
A.toggle3D = (on = store.get().view.mode !== '3d') => A.setView({ mode: on ? '3d' : '2d' });
A.toggleTheme = () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  $('meta[name="theme-color"]').content = theme === 'dark' ? '#0A2340' : '#E2E8EC';
  persist.savePrefs({ theme }); sheet.readTheme(); view3d.readTheme();
};
app.showTab = (tab, { open = true } = {}) => { store.set({ tab }); if (open) setPanel(true); };

A.pickMember = (id, { additive = false, keepTab = false } = {}) => {
  const { model, sel } = store.get(), m = memberById(model, id);
  if (!m) return;
  const members = additive ? (sel.members.includes(id) ? sel.members.filter((k) => k !== id) : [...sel.members, id]) : [id];
  store.set({ sel: { nodes: [], members }, ...(keepTab ? {} : { tab: 'sel' }) });
  if (store.get().view.mode === '3d') A.toggle3D(false);
  const a = nodeById(model, m.a), b = nodeById(model, m.b);
  sheet.reveal((a.x + b.x) / 2, (a.y + b.y) / 2);
};
A.pickNode = (id) => { const n = nodeById(store.get().model, id); if (!n) return; store.set({ sel: { nodes: [id], members: [] }, tab: 'sel' }); sheet.reveal(n.x, n.y); };

A.deleteSelection = () => {
  const { sel } = store.get();
  const count = sel.nodes.length + sel.members.length;
  if (!count) return;
  store.mutate((m) => { sel.members.forEach((id) => removeMember(m, id)); sel.nodes.forEach((id) => removeNode(m, id)); }, { label: 'borrar' });
  store.set({ sel: { nodes: [], members: [] } });
  toast(count === 1 ? 'Elemento borrado' : `${count} elementos borrados`, { action: { label: 'Deshacer', run: () => store.undo() } });
};
A.selectAll = () => { const { model } = store.get(); store.set({ sel: { nodes: [], members: model.members.map((m) => m.id) } }); };
A.nudge = (dx, dy) => {
  const { sel, model } = store.get();
  if (!sel.nodes.length) return false;
  const g = model.settings.grid;
  store.mutate((m) => sel.nodes.forEach((id) => { const n = nodeById(m, id); n.x = Math.round((n.x + dx * g) * 1000) / 1000; n.y = Math.round((n.y + dy * g) * 1000) / 1000; }), { label: 'mover nudo' });
  return true;
};

// Proyectos
function open(model, message) {
  flushSave();
  store.load(model, { sel: { nodes: [], members: [] }, vehiclePos: null, tool: 'select' });
  persist.saveProject(model);
  sheet.fit(false);
  panels.renderLibrary();
  if ($('#cOptimizeNote')) $('#cOptimizeNote').textContent = '';
  if (message) toast(message);
}
A.newProject = () => { open(emptyModel('Estructura nueva'), 'Hoja nueva lista'); setPanel(false); store.set({ tool: 'node' }); };
A.openProject = (id) => { const p = persist.get(id); if (p && p.id !== store.get().model.id) open(p); setPanel(false); };
A.loadExample = (key) => { open(buildExample(key), 'Ejemplo abierto como copia tuya'); setPanel(false); };
A.duplicateProject = (id) => {
  const p = id === store.get().model.id ? store.get().model : persist.get(id);
  if (!p) return;
  const copy = { ...clone(p), id: uid(), name: `${p.name} (copia)`.slice(0, 80), example: false, createdAt: Date.now(), updatedAt: Date.now() };
  open(copy, 'Copia creada y abierta');
};
A.deleteProject = (id) => {
  const p = persist.get(id);
  if (!p) return;
  const wasCurrent = id === store.get().model.id;
  persist.deleteProject(id);
  if (wasCurrent) {
    const next = persist.list().sort((a, b) => b.updatedAt - a.updatedAt)[0] || emptyModel('Estructura nueva');
    store.load(next, { sel: { nodes: [], members: [] }, vehiclePos: null }); persist.saveProject(next); sheet.fit(false);
  }
  panels.renderLibrary();
  toast(`«${p.name}» borrado`, { action: { label: 'Deshacer', run: () => { persist.saveProject(p, { current: false }); if (wasCurrent) open(p); else panels.renderLibrary(); } } });
};

// Importar y exportar
const fileBase = () => slug(store.get().model.name);
A.exportJSON = () => { download(`${fileBase()}.tirante.json`, serializeProject(store.get().model), 'application/json'); toast('Proyecto exportado'); };
A.exportSVG = () => { download(`${fileBase()}.svg`, toSVG(store.get().model, analyze(store.get().model)), 'image/svg+xml'); toast('Plano exportado'); };
A.exportCSV = () => { download(`${fileBase()}.csv`, toCSV(store.get().model, analyze(store.get().model)), 'text/csv;charset=utf-8'); toast('Tabla exportada'); };
A.importFile = () => $('#file').click();

async function importText(text, filename = '') {
  const parsed = parseProject(text);
  if (!parsed.ok) {
    return dialog({
      title: 'No se pudo importar',
      html: `<p>${filename ? `El archivo «${esc(filename)}» tiene problemas:` : 'El archivo tiene problemas:'}</p><ul class="errors">${parsed.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul><p class="fine">Tu trabajo actual no se modificó.</p>`,
    });
  }
  const model = parsed.model;
  if (persist.get(model.id)) model.id = uid();
  model.updatedAt = Date.now();
  open(model, `«${model.name}» importado: ${model.nodes.length} nudos y ${model.members.length} barras`);
}
async function importFromFile(file) {
  if (!file) return;
  if (file.size > 3e6) return dialog({ title: 'No se pudo importar', html: '<p>El archivo pesa más de 3 MB; no parece un proyecto de Tirante.</p>' });
  try { await importText(await file.text(), file.name); }
  catch { dialog({ title: 'No se pudo importar', html: '<p>El navegador no pudo leer el archivo. Probá de nuevo.</p>' }); }
}
$('#file').addEventListener('change', (e) => { importFromFile(e.target.files[0]); e.target.value = ''; });
app.importText = importText; // usado por las pruebas automáticas

// Cálculo
A.optimize = () => {
  const { model } = store.get();
  const o = optimize(model);
  const note = $('#cOptimizeNote');
  if (!o.ok) return toast(o.reason, { kind: 'error' });
  if (!o.changed) { if (note) note.textContent = 'Ya usa los tubos más livianos del catálogo que resisten.'; return toast('Ya está en su peso mínimo con este catálogo'); }
  store.mutate((m) => m.members.forEach((b, i) => { b.profile = o.model.members[i].profile; }), { label: 'aligerar' });
  const delta = (o.after.mass - o.before.mass) / o.before.mass;
  const summary = `${kg(o.before.mass)} → ${kg(o.after.mass)} (${delta < 0 ? '−' : '+'}${num(Math.abs(delta) * 100)} %)`;
  if (note) note.textContent = `Último resultado: ${summary}, ${o.changed} barras cambiadas en ${o.iterations} pasadas.`;
  toast(o.after.pass ? `${delta < 0 ? 'Aligerada' : 'Reforzada'}: ${summary}` : 'Ni el tubo más grande alcanza en algunas barras: cambiá la forma', { kind: o.after.pass ? 'info' : 'error', action: { label: 'Deshacer', run: () => store.undo() } });
};
A.runTest = () => {
  if (store.get().view.mode === '3d') A.toggle3D(false);
  store.set({ sel: { nodes: [], members: [] }, vehiclePos: null });
  stopPlay();
  setPanel(false);
  sheet.fit(false);
  startTest(app);
  syncChrome();
};
$('#testOverlay').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'test-close') { app.test?.close(); syncChrome(); $('#sheet').focus(); }
  else if (act === 'test-again') { app.test?.close(); startTest(app); }
});

A.help = () => dialog({
  title: 'Cómo se usa Tirante',
  html: `<p>Dibujá nudos y barras, poné apoyos y cargas. El cálculo se rehace solo: <b class="t-tension">naranja es tracción</b> (la barra se estira) y <b class="t-compression">celeste es compresión</b> (se aplasta). Cuanto más intenso el color, más exigida está.</p>
    <dl class="keys">${[...TOOLS.map(([, t, k]) => [t, k]), ['Buscar una acción', 'Ctrl K'], ['Deshacer y rehacer', 'Ctrl Z, Ctrl Mayús Z'], ['Mover el nudo elegido', 'Flechas'], ['Borrar lo elegido', 'Supr'], ['Elegir todas las barras', 'Ctrl A'], ['Encuadrar', 'F'], ['Plano o 3D', '3'], ['Grilla', 'G'], ['Tema', 'T'], ['Exportar proyecto', 'Ctrl S'], ['Mover la hoja', 'Espacio + arrastrar'], ['Ignorar la grilla al arrastrar', 'Alt'], ['Sumar a la selección', 'Mayús + clic']]
      .map(([t, k]) => `<dt>${t}</dt><dd><kbd>${k}</kbd></dd>`).join('')}</dl>
    <p class="fine">En el celular: un dedo mueve la hoja o un nudo, dos dedos acercan. Con la herramienta Barra, tocá un nudo y después otro.</p>
    <p class="fine">Todo se guarda en este navegador, sin servidor ni cuenta. No se sincroniza entre dispositivos y se pierde si borrás los datos del sitio: usá Exportar para conservar o compartir un proyecto.</p>`,
});

// ───────── Paleta de comandos ─────────
const palette = createPalette(() => {
  const { model, sel } = store.get();
  const cmds = [
    ...TOOLS.map(([id, title, keys]) => ({ title: `Herramienta: ${title}`, keys, run: () => A.setTool(id) })),
    { title: 'Aligerar la estructura', keywords: 'optimizar peso dimensionar', group: 'Cálculo', run: A.optimize },
    { title: 'Cargar hasta que se caiga', keywords: 'ensayo destructivo colapso romper', group: 'Cálculo', run: A.runTest },
    { title: 'Deshacer', keys: 'Ctrl Z', run: A.undo }, { title: 'Rehacer', keys: 'Ctrl Mayús Z', run: A.redo },
    { title: 'Encuadrar todo', keys: 'F', keywords: 'zoom centrar', run: A.fit },
    { title: 'Ver en 3D o en plano', keys: '3', keywords: 'tres dimensiones vista', run: () => A.toggle3D() },
    { title: 'Cambiar entre plano azul y papel', keys: 'T', keywords: 'tema claro oscuro', run: A.toggleTheme },
    { title: 'Activar o desactivar la grilla', keys: 'G', keywords: 'ajuste imán snap', run: A.toggleSnap },
    { title: 'Mostrar u ocultar los esfuerzos escritos', keywords: 'rótulos etiquetas', run: () => A.setView({ labels: !store.get().view.labels }) },
    { title: 'Proyecto nuevo', group: 'Proyectos', keywords: 'hoja en blanco', run: A.newProject },
    { title: 'Importar un proyecto', group: 'Proyectos', keywords: 'abrir archivo json', run: A.importFile },
    { title: 'Exportar el proyecto', keys: 'Ctrl S', keywords: 'guardar json descargar', run: A.exportJSON },
    { title: 'Exportar el plano en SVG', group: 'Exportar', keywords: 'imagen vectorial descargar', run: A.exportSVG },
    { title: 'Exportar la tabla en CSV', group: 'Exportar', keywords: 'excel planilla descargar', run: A.exportCSV },
    { title: 'Duplicar el proyecto', group: 'Proyectos', keywords: 'copia', run: () => A.duplicateProject(model.id) },
    { title: 'Elegir todas las barras', keys: 'Ctrl A', run: A.selectAll },
    { title: 'Ayuda y atajos', keys: '?', run: A.help },
    ...EXAMPLES.map((x) => ({ title: `Abrir ejemplo: ${x.title}`, group: 'Ejemplo', keywords: x.blurb, run: () => A.loadExample(x.key) })),
    ...persist.list().filter((p) => p.id !== model.id).map((p) => ({ title: `Abrir proyecto: ${p.name}`, group: 'Guardado', run: () => A.openProject(p.id) })),
  ];
  if (sel.members.length) cmds.push(...PROFILES.map((p) => ({ title: `Poner tubo ${p.label} a la selección`, group: 'Tubo', keywords: p.id, run: () => store.mutate((m) => sel.members.forEach((id) => { memberById(m, id).profile = p.id; }), { label: 'cambiar perfil' }) })));
  if (sel.nodes.length + sel.members.length) cmds.push({ title: 'Borrar la selección', keys: 'Supr', run: A.deleteSelection });
  cmds.push(...model.members.map((m) => ({ title: `Ir a la barra ${m.id}`, group: `${m.a} a ${m.b}`, run: () => A.pickMember(m.id) })));
  cmds.push(...model.nodes.map((n) => ({ title: `Ir al nudo ${n.id}`, group: `${num(n.x, 1)} ; ${num(n.y, 1)}`, run: () => A.pickNode(n.id) })));
  return cmds;
});
A.palette = () => palette.open();

// ───────── Teclado ─────────
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if (mod && key === 'k') { e.preventDefault(); return A.palette(); }
  if ($('dialog[open]')) return;
  const typing = e.target.matches?.('input, select, textarea, [contenteditable]');
  if (mod && key === 'z') { if (typing) return; e.preventDefault(); return e.shiftKey ? A.redo() : A.undo(); }
  if (mod && key === 'y') { if (typing) return; e.preventDefault(); return A.redo(); }
  if (mod && key === 's') { e.preventDefault(); return A.exportJSON(); }
  if (mod && key === 'a' && !typing) { e.preventDefault(); return A.selectAll(); }
  if (typing || mod || e.altKey) return;
  if (app.test) { if (key === 'escape') { app.test.close(); syncChrome(); } return; }
  const tool = TOOLS.find(([, , k]) => k.toLowerCase() === key);
  if (tool) return A.setTool(tool[0]);
  const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, 1], arrowdown: [0, -1] }[key];
  if (arrows && e.target === $('#sheet')) { if (A.nudge(arrows[0] * (e.shiftKey ? 5 : 1), arrows[1] * (e.shiftKey ? 5 : 1))) e.preventDefault(); return; }
  if (key === 'delete' || key === 'backspace') return A.deleteSelection();
  if (key === 'escape') { if (!sheet.cancel()) { if (store.get().tool !== 'select') A.setTool('select'); else store.set({ sel: { nodes: [], members: [] } }); } return; }
  if (key === 'f') return A.fit();
  if (key === 'g') return A.toggleSnap();
  if (key === 't') return A.toggleTheme();
  if (key === '3') return A.toggle3D();
  if (key === '?' || (key === '/' && e.shiftKey)) return A.help();
  if (key === '+' || key === '=') return sheet.zoom(1.25);
  if (key === '-') return sheet.zoom(0.8);
});

// ───────── Barra superior, herramientas y vistas ─────────
$('#btnPalette').addEventListener('click', A.palette);
$('#btnUndo').addEventListener('click', A.undo);
$('#btnRedo').addEventListener('click', A.redo);
$('#btnTheme').addEventListener('click', A.toggleTheme);
$('#btnHelp').addEventListener('click', A.help);
$('#btnFit').addEventListener('click', () => A.fit());
$('#btnSnap').addEventListener('click', A.toggleSnap);
$('#tools').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) A.setTool(b.dataset.tool); });
$$('[data-view]').forEach((b) => b.addEventListener('click', () => A.toggle3D(b.dataset.view === '3d')));
$('#cjWorst').addEventListener('click', () => { const id = app.results?.totals?.worstId; if (id) { A.pickMember(id); setPanel(true); } });

const nameInput = $('#projName');
nameInput.addEventListener('change', () => {
  const name = nameInput.value.trim().slice(0, 80);
  if (!name) { nameInput.value = store.get().model.name; return toast('El proyecto necesita un nombre', { kind: 'error' }); }
  store.mutate((m) => { m.name = name; m.example = false; }, { label: 'renombrar' });
});
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); if (e.key === 'Escape') { nameInput.value = store.get().model.name; nameInput.blur(); } });

$$('.tabs [role="tab"]').forEach((tab) => tab.addEventListener('click', () => {
  const same = store.get().tab === tab.dataset.tab;
  if (isCompact() && same && panelEl.classList.contains('open')) return setPanel(false);
  app.showTab(tab.dataset.tab);
}));
$('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const tabs = $$('.tabs [role="tab"]'), i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  next.focus(); next.click();
});

// Vehículo
const posInput = $('#vehiclePos');
let playing = 0;
function stopPlay() { cancelAnimationFrame(playing); playing = 0; $('#btnPlay').innerHTML = `<i data-icon="play">${icon('play')}</i>`; $('#btnPlay').setAttribute('aria-label', 'Hacer cruzar el vehículo'); }
posInput.addEventListener('input', () => { stopPlay(); store.set({ vehiclePos: posInput.value / 1000 }); });
$('#btnEnvelope').addEventListener('click', () => { stopPlay(); store.set({ vehiclePos: null }); });
$('#btnPlay').addEventListener('click', () => {
  if (playing) return stopPlay();
  $('#btnPlay').innerHTML = `<i data-icon="pause">${icon('pause')}</i>`; $('#btnPlay').setAttribute('aria-label', 'Detener el vehículo');
  let pos = store.get().vehiclePos ?? 0; if (pos >= 1) pos = 0;
  let last = performance.now();
  const step = (now) => {
    pos += (now - last) / 1000 / 7; last = now;
    if (pos >= 1) { store.set({ vehiclePos: 1 }); return stopPlay(); }
    store.set({ vehiclePos: pos });
    playing = requestAnimationFrame(step);
  };
  playing = requestAnimationFrame(step);
});

// Arrastrar un archivo sobre la ventana para importarlo
let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; $('#drop').hidden = false; e.preventDefault(); } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
window.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; importFromFile(e.dataTransfer.files[0]); });

// Estado vacío y consejo inicial
$('#emptyExamples').innerHTML = EXAMPLES.slice(0, 3).map((x) => `<button type="button" class="btn" data-key="${x.key}">${x.title}</button>`).join('');
$('#emptyExamples').addEventListener('click', (e) => { const b = e.target.closest('[data-key]'); if (b) A.loadExample(b.dataset.key); });
if (firstVisit && !prefs.tipSeen) {
  $('#tip p').textContent = 'Este puente es un ejemplo. Arrastrá cualquier nudo: el cálculo se rehace mientras lo movés.';
  $('#tip').hidden = false;
}
const closeTip = () => { if (!$('#tip').hidden) { $('#tip').hidden = true; persist.savePrefs({ tipSeen: true }); } };
$('#tip').addEventListener('click', (e) => { if (e.target.closest('[data-act="tip-close"]')) closeTip(); });

// ───────── Guardado automático ─────────
const saveState = $('#saveState');
function flushSave() {
  const r = persist.saveProject(store.get().model);
  saveState.dataset.state = r.ok ? 'ok' : 'error';
  saveState.textContent = !r.ok ? 'Sin guardar' : persist.volatile ? 'Sin guardado en este navegador' : 'Guardado';
  if (!r.ok) toast(r.error, { kind: 'error' });
}
const debouncedSave = debounce(flushSave, 450);
const saveNow = () => { saveState.textContent = 'Guardando…'; debouncedSave(); };
window.addEventListener('pagehide', () => persist.saveProject(store.get().model));

// ───────── Sincronización de la interfaz con el estado ─────────
let lastStamp = '';
function syncChrome() {
  const s = store.get(), res = app.results, ok = !!res?.ok, m = s.model;
  if (document.activeElement !== nameInput) nameInput.value = m.name;
  document.title = `${m.name}, Tirante`;
  $('#btnUndo').disabled = !store.canUndo(); $('#btnRedo').disabled = !store.canRedo();
  $$('#tools [data-tool]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tool === s.tool));
  $$('[data-view]').forEach((b) => b.setAttribute('aria-checked', b.dataset.view === s.view.mode));
  $('#btnSnap').setAttribute('aria-pressed', m.settings.snap);
  $$('.tabs [role="tab"]').forEach((t) => { const on = t.dataset.tab === s.tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; });
  const count = s.sel.nodes.length + s.sel.members.length;
  if (count) $('#t-sel').dataset.badge = count; else delete $('#t-sel').dataset.badge;

  // Cajetín
  $('#cjMass').textContent = ok ? kg(res.totals.mass) : '–';
  $('#cjCost').textContent = ok ? money(res.totals.cost) : '–';
  $('#cjDefl').textContent = ok ? `${num(res.totals.maxDisp * 1000, 1)} mm` : '–';
  $('#cjWorst').textContent = ok && res.totals.worstId ? `${res.totals.worstId}, ${pct(res.totals.maxU)}` : ok ? 'sin esfuerzos' : 'sin calcular';
  $('#cjWorst').disabled = !(ok && res.totals.worstId);
  const stampState = !res || res.status === 'empty' ? 'idle' : !ok ? 'unstable' : res.totals.pass ? 'pass' : 'fail';
  const stamp = $('#cjStamp');
  stamp.dataset.state = stampState;
  stamp.firstElementChild.textContent = { idle: 'Sin calcular', unstable: 'Inestable', pass: 'Resiste', fail: 'No resiste' }[stampState];
  if (lastStamp && lastStamp !== stampState && !reducedMotion()) { stamp.classList.remove('thump'); void stamp.offsetWidth; stamp.classList.add('thump'); }
  lastStamp = stampState;
  $('#cjTime').textContent = ok ? `${m.nodes.length} nudos, ${m.members.length} barras, calculado en ${num(app.solveMs, 1)} ms${m.example ? '. Cargas de ejemplo.' : ''}` : '';

  // Avisos sobre la hoja
  const status = $('#status');
  const showStatus = res && !ok && res.status !== 'empty' && s.view.mode === '2d';
  status.hidden = !showStatus; if (showStatus) status.textContent = res.message;
  $('#empty').hidden = m.nodes.length > 0 || s.view.mode === '3d';
  $('#srSummary').textContent = !res || res.status === 'empty' ? 'Hoja vacía.' : !ok ? res.message : `${res.totals.pass ? 'Resiste' : 'No resiste'}. Barra más exigida ${res.totals.worstId || 'ninguna'} al ${pct(res.totals.maxU)}. Peso ${kg(res.totals.mass)}.`;

  // Vehículo
  const veh = $('#vehicle');
  veh.hidden = !(ok && res.P > 0) || s.view.mode === '3d' || !!app.test;
  if (!veh.hidden) {
    if (s.vehiclePos != null && document.activeElement !== posInput) posInput.value = Math.round(s.vehiclePos * 1000);
    $('#vehicleLabel').textContent = s.vehiclePos == null ? 'Peor caso: cada barra con el vehículo donde más la exige' : `Vehículo a ${num(s.vehiclePos * res.chain.length, 1)} m del inicio del tablero`;
    $('#btnEnvelope').hidden = s.vehiclePos == null;
  }
}

store.subscribe((s, prev, meta) => {
  if (s.model !== prev.model || s.vehiclePos !== prev.vehiclePos) solve();
  if (s.model !== prev.model) {
    // Limpia la selección de elementos que ya no existen
    const nodes = s.sel.nodes.filter((id) => nodeById(s.model, id)), members = s.sel.members.filter((id) => memberById(s.model, id));
    if (nodes.length !== s.sel.nodes.length || members.length !== s.sel.members.length) return store.set({ sel: { nodes, members } });
    if (!meta.loaded) saveNow();
    if (!meta.loaded && prev.model.nodes.length && s.model.nodes !== prev.model.nodes) closeTip();
  }
  if (s.view.mode !== prev.view.mode) {
    if (s.view.mode === '3d') { $('#sheet').hidden = true; view3d.start(); } else { view3d.stop(); $('#sheet').hidden = false; sheet.resize(); }
    $('#tools').style.display = s.view.mode === '3d' ? 'none' : '';
  }
  syncChrome();
  panels.render();
});

syncChrome();
panels.render();
flushSave();
if (persist.corrupted) toast('Algunos proyectos guardados estaban dañados y no se pudieron recuperar', { kind: 'error', duration: 7000 });

// Fin del arranque
const boot = $('#boot');
setTimeout(() => { boot.classList.add('gone'); setTimeout(() => boot.remove(), 600); }, reducedMotion() ? 0 : Math.max(0, 850 - performance.now()));
window.addEventListener('resize', debounce(() => { sheet.resize(); }, 120));
window.tirante = app; // acceso desde la consola y las pruebas automáticas
app.sheet = sheet;
