// Pantalla de lectura: barras, panel lateral (índice, notas, búsqueda), selección,
// texto a voz, temporizador, sesiones, pantalla encendida y atajos de teclado.
import { db, settings, saveSettings } from './db.js';
import { esc, icon, html, toast, uid, MARK_COLORS, debounce, fmtDate } from './util.js';
import { createMark, editMarkDialog, noteDialog, locationLabel, KIND } from './marks.js';
import { player, tts } from './tts.js';
import { PdfEngine } from './pdf-engine.js';
import { EpubEngine } from './epub-engine.js';

let R = null; // estado del lector abierto

export function isReaderOpen() { return !!R; }

export async function openReader(bookId, query) {
  const pos = query.get('pos');
  const wantTts = query.get('tts') === '1';
  if (R && R.book.id === bookId) {
    if (pos) R.engine?.goTo(pos);
    if (wantTts && !player.active) startTts();
    return;
  }
  closeReader();
  const book = await db.get('books', bookId);
  if (!book) { toast('No encontramos ese libro.'); location.hash = '#/biblioteca'; return; }
  const file = await db.get('files', bookId);
  if (!file) { await missingFile(book); return; }

  document.body.classList.add('reading');
  const s = settings();
  const root = document.getElementById('reader-root');
  const el = html(`<div class="reader" data-rt="${s.readerTheme}" data-kind="${book.format}">
    <header class="r-top">
      <button class="icon-btn" data-r="back" aria-label="Volver" title="Volver">${icon('back')}</button>
      <div class="r-title"><b>${esc(book.title)}</b><span data-r="sub">${esc(book.author || '')}</span></div>
      <div class="r-tools">
        <button class="icon-btn" data-r="panel" aria-label="Índice, notas y búsqueda" title="Índice, notas y búsqueda">${icon('list')}</button>
        <button class="icon-btn" data-r="tts" aria-label="Escuchar" title="Escuchar (Espacio)">${icon('headphones')}</button>
        <button class="icon-btn r-hide-m" data-r="note" aria-label="Nueva nota" title="Nueva nota (N)">${icon('note')}</button>
        <button class="icon-btn" data-r="display" aria-label="Apariencia" title="Apariencia">${icon('type')}</button>
        <button class="icon-btn r-hide-m" data-r="fullscreen" aria-label="Pantalla completa" title="Pantalla completa (F)">${icon('max')}</button>
      </div>
      <div class="r-pop hidden" data-r="pop"></div>
    </header>
    <div class="r-body">
      <div class="r-stage"><div class="r-loading"><div class="spinner"></div><span>Abriendo libro…</span></div></div>
      <aside class="r-panel hidden" aria-label="Panel del libro"></aside>
    </div>
    <footer class="r-bottom">
      <button class="icon-btn" data-r="prev" aria-label="Anterior" title="Anterior (←)">${icon('back')}</button>
      <input type="range" data-r="slider" min="0" max="1000" value="0" aria-label="Posición en el libro" />
      <span class="r-pos" data-r="pos">—</span>
      <button class="icon-btn" data-r="next" aria-label="Siguiente" title="Siguiente (→)">${icon('next')}</button>
    </footer>
    <div class="dim-screen" data-r="dim"></div>
  </div>`);
  root.innerHTML = ''; root.appendChild(el);
  const q = sel => el.querySelector(`[data-r="${sel}"]`);
  const stage = el.querySelector('.r-stage');

  R = {
    book, el, q, stage, engine: null, marks: [], selection: null, panelTab: 'toc',
    session: { id: uid(), bookId, startedAt: Date.now(), finishedAt: null, duration: 0, pagesRead: 0 },
    visited: new Set(), lastTick: Date.now(), lastActivity: Date.now(), baseTotal: book.totalTime || 0,
    wake: null, dimmed: false, timers: [], cleanup: [], searchToken: null, lastLoc: null,
  };
  const state = R;

  // ---------- Motor ----------
  const hooks = {
    onLocation: loc => onLocation(state, loc),
    onSelect: sel => onSelect(state, sel),
    onTap: () => { if (state.selection) return; closePop(); el.classList.toggle('immersive'); setTimeout(() => state.engine?.onResize?.(), 280); },
    onKey: e => onKey(e),
    onActivity: () => activity(),
    onNotice: msg => { const n = html(`<div class="pdf-notext">${esc(msg)}</div>`); stage.appendChild(n); setTimeout(() => n.remove(), 9000); },
    onLocations: json => { db.patch('books', bookId, { locations: json }); },
    onMarkClick: async id => { const m = state.marks.find(x => x.id === id); if (m && await editMarkDialog(m)) await reloadMarks(); },
    onZoom: () => { if (!q('pop').classList.contains('hidden')) renderDisplayPop(); },
  };
  const Engine = book.format === 'pdf' ? PdfEngine : EpubEngine;
  state.engine = new Engine(stage, book, hooks);
  try {
    await state.engine.open(file.blob, pos || book.position, s);
  } catch (err) {
    console.error(err);
    if (R !== state) return;
    stage.querySelector('.r-loading').innerHTML = `<div style="text-align:center;padding:24px;max-width:420px">${icon('book')}<h2 style="margin:10px 0">No se pudo abrir el libro</h2><p class="small">El archivo puede estar dañado, protegido con contraseña o con DRM.</p><button class="btn" data-r="back2">Volver</button></div>`;
    stage.querySelector('[data-r=back2]').onclick = goBack;
    return;
  }
  if (R !== state) { state.engine.destroy(); return; }
  stage.querySelector('.r-loading')?.remove();
  await db.patch('books', bookId, { lastOpenedAt: Date.now(), status: book.status === 'unread' ? 'reading' : book.status });
  await reloadMarks();
  measureBars();

  // ---------- Controles ----------
  q('back').onclick = goBack;
  q('prev').onclick = () => { activity(); state.engine.prev(); };
  q('next').onclick = () => { activity(); state.engine.next(); };
  const slider = q('slider');
  slider.addEventListener('input', () => { q('pos').textContent = book.format === 'pdf' ? `Página ${slider.value}` : `${Math.round(slider.value / 10)}%`; });
  slider.addEventListener('change', () => { activity(); state.engine.goToSlider(+slider.value); });
  q('panel').onclick = () => togglePanel();
  q('tts').onclick = () => { if (player.active) { stopTts(); } else startTts(); };
  q('note').onclick = () => newNote();
  q('display').onclick = e => { e.stopPropagation(); togglePop(); };
  q('fullscreen').onclick = () => toggleFullscreen();
  q('dim').onclick = () => activity();
  el.addEventListener('click', e => { const path = e.composedPath(); if (!path.includes(q('pop')) && !path.includes(q('display'))) closePop(); });

  const ro = new ResizeObserver(debounce(() => { measureBars(); state.engine?.onResize?.(); }, 120));
  ro.observe(stage);
  state.cleanup.push(() => ro.disconnect());

  // ---------- Actividad, pantalla y sesiones ----------
  const act = () => activity();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => el.addEventListener(ev, act, { passive: true }));
  document.addEventListener('keydown', onKey);
  const onVis = () => { if (!document.hidden) { requestWake(); state.lastTick = Date.now(); } else saveSession(); };
  document.addEventListener('visibilitychange', onVis);
  const onFs = () => q('fullscreen').classList.toggle('on', !!document.fullscreenElement);
  document.addEventListener('fullscreenchange', onFs);
  window.addEventListener('pagehide', saveSession);
  state.cleanup.push(() => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onVis);
    document.removeEventListener('fullscreenchange', onFs);
    window.removeEventListener('pagehide', saveSession);
  });
  state.timers.push(setInterval(tick, 5000));
  requestWake();

  const offPlayer = player.on((p, kind) => renderTtsBar(kind));
  state.cleanup.push(offPlayer);

  if (wantTts) startTts();
  history.replaceState(null, '', `#/leer/${bookId}`);
}

export function closeReader() {
  if (!R) return;
  const state = R;
  saveSession();
  if (player.adapterOwner === state) player.stop();
  else if (player.active) player.stop();
  state.timers.forEach(clearInterval);
  state.cleanup.forEach(fn => { try { fn(); } catch {} });
  try { state.engine?.destroy(); } catch {}
  releaseWake();
  state.searchToken && (state.searchToken.cancel = true);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  document.getElementById('reader-root').innerHTML = '';
  document.body.classList.remove('reading');
  R = null;
  window.dispatchEvent(new CustomEvent('library-changed'));
}

function goBack() {
  const id = R?.book.id;
  const prev = window.__prevRoute;
  location.hash = prev && !prev.startsWith('#/leer/') ? prev : `#/libro/${id}`;
}

async function missingFile(book) {
  const res = await new Promise(resolve => {
    import('./util.js').then(({ modal }) => modal({
      title: 'Falta el archivo de este libro',
      body: `<p style="margin:0;color:var(--ink-2)">“${esc(book.title)}” está en tu biblioteca (con su progreso y notas), pero el archivo no está guardado en este dispositivo. Elegí el PDF o EPUB para volver a vincularlo.</p>`,
      actions: [{ label: 'Cancelar', cls: 'btn-ghost', value: null }, { label: 'Elegir archivo', cls: 'btn-primary', value: true, primary: true }],
    }).then(resolve));
  });
  if (!res) { location.hash = `#/libro/${book.id}`; return; }
  const input = document.createElement('input'); input.type = 'file'; input.accept = book.format === 'pdf' ? '.pdf,application/pdf' : '.epub,application/epub+zip';
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    await db.put('files', { id: book.id, blob: new Blob([await f.arrayBuffer()], { type: f.type || (book.format === 'pdf' ? 'application/pdf' : 'application/epub+zip') }) });
    await db.patch('books', book.id, { fileName: f.name, fileSize: f.size });
    toast('Archivo vinculado.');
    openReader(book.id, new URLSearchParams());
  };
  input.click();
  location.hash = `#/libro/${book.id}`;
}

// ---------- Posición y progreso ----------
const persist = debounce(async (state, loc) => {
  if (R !== state || !loc.position) return;
  const changes = { position: loc.position, page: loc.page ?? null, chapter: loc.chapter || '', progress: loc.progress, lastOpenedAt: Date.now() };
  const cur = await db.get('books', state.book.id);
  if (!cur) return;
  if (loc.atEnd && cur.status !== 'finished') { changes.status = 'finished'; changes.progress = 1; toast('¡Llegaste al final del libro! Lo marcamos como terminado.'); }
  else if (cur.status === 'unread') changes.status = 'reading';
  await db.patch('books', state.book.id, changes);
}, 700);

function onLocation(state, loc) {
  if (R !== state) return;
  state.lastLoc = loc;
  const { q } = state;
  q('pos').textContent = state.book.format === 'pdf' ? `${loc.page} / ${loc.slider.max}` : `${Math.round(loc.progress * 100)}%`;
  q('sub').textContent = loc.label || state.book.author || '';
  const sl = q('slider');
  sl.min = loc.slider.min; sl.max = loc.slider.max;
  if (document.activeElement !== sl) sl.value = loc.slider.value;
  sl.disabled = !!loc.slider.disabled;
  sl.title = loc.slider.disabled ? 'Calculando posiciones del libro…' : '';
  if (loc.unit != null) state.visited.add(loc.unit);
  if (state.panelTab === 'toc' && !state.el.querySelector('.r-panel').classList.contains('hidden')) markCurrentToc();
  persist(state, loc);
}

// ---------- Sesiones ----------
function tick() {
  const state = R; if (!state) return;
  const now = Date.now();
  const idle = now - state.lastActivity;
  const listening = player.state === 'playing' || player.state === 'loading';
  if (!document.hidden && (idle < 5 * 60000 || listening)) state.session.duration += now - state.lastTick;
  state.lastTick = now;
  // Apagado inteligente
  const t = settings().smartTimeout;
  if (t > 0 && !listening && !state.dimmed && idle > t * 60000) {
    state.dimmed = true; releaseWake(); state.q('dim').classList.add('on');
  }
  if (now - (state.lastSave || 0) > 30000) saveSession();
}
async function saveSession() {
  const state = R; if (!state) return;
  state.lastSave = Date.now();
  const s = state.session;
  if (s.duration < 5000) return;
  s.finishedAt = Date.now();
  s.pagesRead = Math.max(0, state.visited.size - 1);
  if (state.book.format === 'epub' && state.engine?.epub?.locations?.length?.()) s.pagesRead = Math.max(0, state.visited.size - 1);
  try {
    await db.put('sessions', { ...s });
    await db.patch('books', state.book.id, { totalTime: state.baseTotal + s.duration });
  } catch (e) { console.warn(e); }
}
function activity() {
  const state = R; if (!state) return;
  state.lastActivity = Date.now();
  if (state.dimmed) { state.dimmed = false; state.q('dim').classList.remove('on'); requestWake(); }
}
async function requestWake() {
  const state = R; if (!state || state.dimmed) return;
  if (!settings().keepAwake || !('wakeLock' in navigator) || document.hidden) return;
  try { if (!state.wake || state.wake.released) state.wake = await navigator.wakeLock.request('screen'); } catch {}
}
function releaseWake() { const state = R; try { state?.wake?.release(); } catch {} if (state) state.wake = null; }

// ---------- Marcas ----------
async function reloadMarks() {
  const state = R; if (!state) return;
  state.marks = (await db.byIndex('marks', 'bookId', state.book.id)).sort((a, b) => a.createdAt - b.createdAt);
  state.engine?.setMarks(state.marks);
  if (state.panelTab === 'marks' && !state.el.querySelector('.r-panel').classList.contains('hidden')) renderPanel();
}
window.addEventListener('marks-changed', e => { if (R && (!e.detail?.bookId || e.detail.bookId === R.book.id)) reloadMarks(); });

function onSelect(state, sel) {
  if (R !== state) return;
  state.selection = sel;
  state.el.querySelector('.sel-bar')?.remove();
  state.el.classList.toggle('selecting', !!sel);
  if (!sel) return;
  const bar = html(`<div class="sel-bar" role="toolbar" aria-label="Acciones de selección">
    <button data-s="copy">${icon('copy')}Copiar</button>
    <div class="colors">${MARK_COLORS.map(c => `<button data-color="${c.c}" title="Resaltar en ${c.n.toLowerCase()}" aria-label="Resaltar en ${c.n.toLowerCase()}" style="background:${c.c}"></button>`).join('')}</div>
    <button data-s="fragment">${icon('quote')}Fragmento</button>
    <button data-s="note">${icon('note')}Nota</button>
    <button data-s="listen">${icon('headphones')}Escuchar</button>
  </div>`);
  state.el.querySelector('.r-body').appendChild(bar);
  bar.addEventListener('mousedown', e => e.preventDefault());
  bar.querySelector('[data-s=copy]').onclick = async () => {
    try { await navigator.clipboard.writeText(sel.text); toast('Texto copiado.'); } catch { toast('No se pudo copiar.'); }
    clearSel();
  };
  bar.querySelectorAll('[data-color]').forEach(b => b.onclick = async () => {
    await createMark({ type: 'highlight', bookId: state.book.id, text: sel.text, color: b.dataset.color, position: sel.position, page: sel.page, chapter: sel.chapter, rects: sel.rects });
    await saveSettings({ highlightColor: b.dataset.color });
    toast('Resaltado guardado.'); clearSel();
  });
  bar.querySelector('[data-s=fragment]').onclick = async () => {
    await createMark({ type: 'fragment', bookId: state.book.id, text: sel.text, position: sel.position, page: sel.page, chapter: sel.chapter });
    toast('Fragmento guardado.', { action: 'Ver', onAction: () => { state.panelTab = 'marks'; openPanel(); } }); clearSel();
  };
  bar.querySelector('[data-s=note]').onclick = async () => {
    const s = { ...sel };
    const r = await noteDialog({ text: s.text });
    if (r) { await createMark({ type: 'note', bookId: state.book.id, text: s.text, note: r.note, position: s.position, page: s.page, chapter: s.chapter, rects: s.rects }); toast('Nota guardada.'); }
    clearSel();
  };
  bar.querySelector('[data-s=listen]').onclick = () => { const s = { ...sel }; clearSel(); startTts({ selection: s }); };
}
function clearSel() { const state = R; if (!state) return; state.engine.clearSelection(); onSelect(state, null); }

async function newNote() {
  const state = R; if (!state) return;
  if (state.selection) { state.el.querySelector('.sel-bar [data-s=note]')?.click(); return; }
  const loc = state.lastLoc || {};
  const r = await noteDialog({ title: 'Nueva nota' });
  if (r) { await createMark({ type: 'note', bookId: state.book.id, note: r.note, position: loc.position, page: loc.page, chapter: loc.chapter }); toast('Nota guardada.'); }
}

// ---------- TTS ----------
function startTts(opts = {}) {
  const state = R; if (!state?.engine) return;
  if (!tts.supported) { toast('Tu navegador no permite la lectura en voz alta.'); return; }
  if (state.engine.kind === 'pdf' && state.engine.hasText === false) { toast('Este PDF no tiene texto reconocible para leer en voz alta.'); return; }
  player.adapterOwner = state;
  player.start(state.engine.ttsAdapter(), { ...opts, title: state.book.title });
  renderTtsBar();
}
function stopTts() { player.stop(); }

function fmtLeft(ms) { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
async function renderTtsBar(kind) {
  const state = R; if (!state) return;
  let bar = state.el.querySelector('.tts-bar');
  state.q('tts').classList.toggle('on', player.active);
  if (!player.active) { bar?.remove(); return; }
  if (kind === 'tick' && bar) { const tl = bar.querySelector('.timer-left'); if (tl) tl.textContent = player.sleepLeft() ? fmtLeft(player.sleepLeft()) : ''; return; }
  if (!bar) {
    if (state.buildingBar) return;
    state.buildingBar = true;
    const voices = await tts.voices();
    state.buildingBar = false;
    if (R !== state || !player.active) return;
    const s = settings();
    bar = html(`<div class="tts-bar" role="region" aria-label="Lectura en voz alta">
      <div class="now"></div>
      <div class="ctrls">
        <button class="icon-btn" data-t="prev" title="Frase anterior" aria-label="Frase anterior">${icon('prevs')}</button>
        <button class="icon-btn play" data-t="play" aria-label="Pausar o continuar"></button>
        <button class="icon-btn" data-t="next" title="Frase siguiente" aria-label="Frase siguiente">${icon('nexts')}</button>
        <span class="grow"></span>
        <select data-t="rate" aria-label="Velocidad" title="Velocidad">${[0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75, 2].map(r => `<option value="${r}">${r}×</option>`).join('')}</select>
        <select data-t="voice" aria-label="Voz" title="Voz"><option value="">Voz automática</option>${voices.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name.replace(/^(Microsoft|Google)\s+/, ''))} (${esc(v.lang)})</option>`).join('')}</select>
        <select data-t="sleep" aria-label="Temporizador de sueño" title="Temporizador de sueño"><option value="0">Sin temporizador</option>${[5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m}">Dormir en ${m} min</option>`).join('')}</select>
        <span class="timer-left"></span>
        <button class="icon-btn" data-t="stop" title="Detener" aria-label="Detener">${icon('x')}</button>
      </div></div>`);
    state.el.querySelector('.r-body').appendChild(bar);
    const rate = bar.querySelector('[data-t=rate]');
    const near = [0.75, 0.9, 1, 1.15, 1.25, 1.5, 1.75, 2].reduce((a, b) => Math.abs(b - s.ttsRate) < Math.abs(a - s.ttsRate) ? b : a);
    rate.value = String(near);
    bar.querySelector('[data-t=voice]').value = s.ttsVoice || '';
    bar.querySelector('[data-t=prev]').onclick = () => player.prevSentence();
    bar.querySelector('[data-t=next]').onclick = () => player.nextSentence();
    bar.querySelector('[data-t=play]').onclick = () => player.toggle();
    bar.querySelector('[data-t=stop]').onclick = () => player.stop();
    rate.onchange = () => player.setRate(Number(rate.value));
    bar.querySelector('[data-t=voice]').onchange = e => player.setVoice(e.target.value);
    bar.querySelector('[data-t=sleep]').onchange = e => { player.setSleep(Number(e.target.value)); if (+e.target.value) toast(`La voz se detendrá en ${e.target.value} minutos.`); };
  }
  if (!bar.isConnected) return;
  const playing = player.state === 'playing' || player.state === 'loading';
  bar.querySelector('[data-t=play]').innerHTML = icon(playing ? 'pause' : 'play');
  bar.querySelector('[data-t=play]').title = playing ? 'Pausar (Espacio)' : 'Continuar (Espacio)';
  bar.querySelector('.now').textContent = player.state === 'loading' ? 'Preparando…' : (player.current?.text || '');
  if (!player.sleepEnd) bar.querySelector('[data-t=sleep]').value = '0';
  bar.querySelector('.timer-left').textContent = player.sleepLeft() ? fmtLeft(player.sleepLeft()) : '';
}

// ---------- Panel ----------
function togglePanel() { const p = R.el.querySelector('.r-panel'); if (p.classList.contains('hidden')) openPanel(); else closePanel(); }
function openPanel() { const p = R.el.querySelector('.r-panel'); p.classList.remove('hidden'); R.q('panel').classList.add('on'); renderPanel(); }
function closePanel() { const p = R?.el.querySelector('.r-panel'); if (!p) return; p.classList.add('hidden'); R.q('panel').classList.remove('on'); }
async function renderPanel() {
  const state = R; if (!state) return;
  const p = state.el.querySelector('.r-panel');
  const tabs = [['toc', 'Índice'], ['marks', `Notas (${state.marks.length})`], ['search', 'Buscar']];
  p.innerHTML = `<div class="ptabs">${tabs.map(([k, l]) => `<button data-p="${k}" class="${state.panelTab === k ? 'active' : ''}">${l}</button>`).join('')}<button class="icon-btn" data-p="close" aria-label="Cerrar panel" style="flex:none">${icon('x')}</button></div><div class="pbody"></div>`;
  p.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { if (b.dataset.p === 'close') return closePanel(); state.panelTab = b.dataset.p; renderPanel(); });
  const body = p.querySelector('.pbody');
  const small = () => window.matchMedia('(max-width: 860px)').matches;
  if (state.panelTab === 'toc') {
    const toc = await state.engine.getToc();
    if (!toc.length) {
      body.innerHTML = `<p class="small" style="padding:12px;color:var(--r-muted)">Este libro no tiene índice.${state.book.format === 'pdf' ? ' Usá la barra inferior o escribí un número de página:' : ''}</p>` +
        (state.book.format === 'pdf' ? `<div class="psearch"><input class="input" type="number" min="1" max="${state.engine.n}" placeholder="Página" id="gopage"><button class="btn btn-sm">Ir</button></div>` : '');
      const gp = body.querySelector('#gopage');
      if (gp) { const go = () => { if (gp.value) { state.engine.goToPage(+gp.value); if (small()) closePanel(); } }; body.querySelector('.btn').onclick = go; gp.onkeydown = e => { if (e.key === 'Enter') go(); }; }
      return;
    }
    body.innerHTML = toc.map((t, i) => `<button class="toc-item ${t.depth === 1 ? 'sub' : t.depth > 1 ? 'sub2' : ''}" data-i="${i}">${esc(t.label || 'Sin título')}</button>`).join('');
    body.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { state.engine.goToToc(toc[+b.dataset.i].target); if (small()) closePanel(); });
    markCurrentToc();
  } else if (state.panelTab === 'marks') {
    const items = [...state.marks].sort((a, b) => b.createdAt - a.createdAt);
    body.innerHTML = `<div class="phead"><span class="small" style="color:var(--r-muted)">Resaltados, fragmentos y notas</span><button class="btn btn-sm btn-ghost" data-new>${icon('plus')}Nota</button></div>` +
      (items.length ? items.map(m => `<div class="pmark" style="--mc:${m.color}" data-id="${m.id}">
        ${m.text ? `<div class="q">${esc(m.text)}</div>` : ''}${m.note ? `<div class="n">${esc(m.note)}</div>` : ''}
        <div class="w">${KIND[m.type].label} · ${esc(locationLabel(m) || '')} ${fmtDate(m.createdAt)} · <a href="#" data-edit="${m.id}" style="text-decoration:underline">Editar</a></div></div>`).join('')
        : `<p class="small" style="padding:12px;color:var(--r-muted)">Seleccioná texto para resaltar, guardar fragmentos o anotar. Con la tecla N creás una nota.</p>`);
    body.querySelector('[data-new]').onclick = () => newNote();
    body.querySelectorAll('.pmark').forEach(el => el.onclick = async e => {
      const m = state.marks.find(x => x.id === el.dataset.id);
      if (e.target.dataset.edit) { e.preventDefault(); e.stopPropagation(); if (await editMarkDialog(m)) reloadMarks(); return; }
      if (m.position) { state.engine.goTo(m.position); if (small()) closePanel(); }
    });
  } else {
    body.innerHTML = `<form class="psearch"><input class="input" type="search" placeholder="Buscar en el libro" value="${esc(state.lastQuery || '')}" /><button class="btn btn-sm btn-primary">Buscar</button></form><div class="sresults"></div>`;
    const form = body.querySelector('form'); const out = body.querySelector('.sresults');
    const input = form.querySelector('input');
    setTimeout(() => input.focus(), 30);
    form.onsubmit = async e => {
      e.preventDefault();
      const qv = input.value.trim(); if (!qv) return;
      state.lastQuery = qv;
      if (state.searchToken) state.searchToken.cancel = true;
      const token = state.searchToken = { cancel: false };
      out.innerHTML = `<p class="small" style="padding:10px;color:var(--r-muted)" data-st>Buscando…</p>`;
      let count = 0; const results = [];
      await state.engine.search(qv, r => {
        if (token.cancel) return;
        results.push(r);
        const b = html(`<button class="sres"><small>${esc(r.where)}</small>…${esc(r.before.slice(-60))}<b>${esc(r.match)}</b>${esc(r.after.slice(0, 80))}…</button>`);
        b.onclick = () => { state.engine.goToResult(r.target); if (small()) closePanel(); };
        out.appendChild(b); count++;
      }, token);
      if (token.cancel) return;
      const st = out.querySelector('[data-st]');
      if (st) st.textContent = count ? `${count} ${count === 1 ? 'resultado' : 'resultados'}` : 'Sin resultados.';
    };
    if (state.lastQuery) form.requestSubmit();
  }
}
function markCurrentToc() {
  const state = R; if (!state) return;
  const ch = state.lastLoc?.chapter;
  state.el.querySelectorAll('.toc-item').forEach(b => b.classList.toggle('current', !!ch && b.textContent === ch));
}

// ---------- Apariencia ----------
function closePop() { R?.q('pop').classList.add('hidden'); R?.q('display').classList.remove('on'); }
function togglePop() { const pop = R.q('pop'); if (pop.classList.contains('hidden')) { renderDisplayPop(); pop.classList.remove('hidden'); R.q('display').classList.add('on'); } else closePop(); }
function renderDisplayPop() {
  const state = R; if (!state) return;
  const s = settings(); const pop = state.q('pop');
  const isPdf = state.book.format === 'pdf';
  pop.innerHTML = `
    <div class="grp"><h4>Tema de lectura</h4><div class="theme-dots">${[['light', 'Claro'], ['sepia', 'Sepia'], ['dark', 'Oscuro']].map(([k, l]) => `<button data-rt="${k}" class="${s.readerTheme === k ? 'active' : ''}">${l}</button>`).join('')}</div></div>
    ${isPdf ? `
      <div class="grp"><h4>Zoom</h4><div class="stepper"><button data-z="out" aria-label="Alejar">−</button><output>${state.engine.zoomLabel()}</output><button data-z="in" aria-label="Acercar">+</button></div></div>
      <div class="grp" style="display:flex;gap:8px"><button class="btn btn-sm" data-z="width" style="flex:1">${icon('width')}Ajustar al ancho</button><button class="btn btn-sm" data-z="rotate" style="flex:1">${icon('rotate')}Rotar</button></div>
    ` : `
      <div class="grp"><h4>Tamaño de letra</h4><div class="stepper"><button data-fs="-10" aria-label="Achicar letra">A−</button><output>${s.fontSize}%</output><button data-fs="10" aria-label="Agrandar letra">A+</button></div></div>
      <div class="grp"><h4>Interlineado</h4><div class="seg">${[[1.3, 'Compacto'], [1.6, 'Normal'], [1.9, 'Amplio'], [2.2, 'Máximo']].map(([v, l]) => `<button data-lh="${v}" class="${s.lineHeight === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
      <div class="grp"><h4>Márgenes</h4><div class="stepper"><button data-mg="-2" aria-label="Menos margen">−</button><output>${s.margin}%</output><button data-mg="2" aria-label="Más margen">+</button></div></div>
      <div class="grp"><h4>Tipografía</h4><select class="input" data-ff>${[['publisher', 'La del libro'], ['literata', 'Literata'], ['serif', 'Serif clásica'], ['sans', 'Sans serif']].map(([v, l]) => `<option value="${v}" ${s.fontFamily === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="grp"><h4>Modo</h4><div class="seg">${[['paginated', 'Páginas'], ['scrolled', 'Desplazamiento']].map(([v, l]) => `<button data-flow="${v}" class="${s.epubFlow === v ? 'active' : ''}">${l}</button>`).join('')}</div></div>
    `}
    <div class="grp"><label class="menu-item" style="justify-content:space-between;cursor:pointer"><span>Mantener pantalla encendida</span><span class="switch"><input type="checkbox" data-awake ${s.keepAwake ? 'checked' : ''}><span></span></span></label></div>`;
  const apply = async changes => {
    const next = await saveSettings(changes);
    if ('readerTheme' in changes) state.el.dataset.rt = next.readerTheme;
    if (state.engine.kind === 'epub') await state.engine.applySettings(next, changes);
    if (state.engine.kind === 'epub' && 'readerTheme' in changes) state.engine.redrawMarks();
    renderDisplayPop();
  };
  pop.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => apply({ readerTheme: b.dataset.rt }));
  pop.querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
    const z = b.dataset.z; const e = state.engine;
    if (z === 'in') e.zoomIn(); else if (z === 'out') e.zoomOut(); else if (z === 'width') e.fitWidth(); else e.rotate();
    renderDisplayPop();
  });
  pop.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => apply({ fontSize: Math.max(70, Math.min(220, s.fontSize + Number(b.dataset.fs))) }));
  pop.querySelectorAll('[data-lh]').forEach(b => b.onclick = () => apply({ lineHeight: Number(b.dataset.lh) }));
  pop.querySelectorAll('[data-mg]').forEach(b => b.onclick = () => apply({ margin: Math.max(0, Math.min(18, s.margin + Number(b.dataset.mg))) }));
  pop.querySelector('[data-ff]')?.addEventListener('change', e => apply({ fontFamily: e.target.value }));
  pop.querySelectorAll('[data-flow]').forEach(b => b.onclick = () => { if (b.dataset.flow !== s.epubFlow) apply({ epubFlow: b.dataset.flow }); });
  pop.querySelector('[data-awake]').onchange = async e => { await saveSettings({ keepAwake: e.target.checked }); e.target.checked ? requestWake() : releaseWake(); };
}

function measureBars() {
  const state = R; if (!state) return;
  const top = state.el.querySelector('.r-top'), bot = state.el.querySelector('.r-bottom');
  state.el.style.setProperty('--top-h', `${top.offsetHeight}px`);
  state.el.style.setProperty('--bot-h', `${bot.offsetHeight}px`);
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => toast('Tu navegador no permite pantalla completa aquí.'));
}

// ---------- Teclado ----------
function onKey(e) {
  const state = R; if (!state) return;
  activity();
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) && e.key !== 'Escape') return;
  if (document.querySelector('.modal-back')) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key) {
    case 'ArrowLeft': case 'PageUp': e.preventDefault?.(); state.engine.prev(); break;
    case 'ArrowRight': case 'PageDown': e.preventDefault?.(); state.engine.next(); break;
    case ' ': e.preventDefault?.(); if (player.active) player.toggle(); else startTts(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'n': case 'N': e.preventDefault?.(); newNote(); break;
    case 'Escape':
      if (state.selection) clearSel();
      else if (!state.q('pop').classList.contains('hidden')) closePop();
      else if (!state.el.querySelector('.r-panel').classList.contains('hidden')) closePanel();
      else if (state.el.classList.contains('immersive')) state.el.classList.remove('immersive');
      break;
  }
}
