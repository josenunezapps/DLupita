// Zenix Escáner — escáner de documentos en el navegador.
import * as V from './vision.js';
import { buildPDF } from './pdf.js';
import * as DB from './db.js';
import { samplePhoto } from './sample.js';

const I = {
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  filter: '<circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  share: '<path d="M4 12v7.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V12M16 6l-4-3.5L8 6M12 2.5V15"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', auto: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15.5 12 7l3.5 8.5M9.6 13h4.8"/>',
  magic: '<path d="m15 4 1 2 2 1-2 1-1 2-1-2-2-1 2-1zM5 14l1.5 3L9 18.5 6.5 20 5 23l-1.5-3L1 18.5 3.5 17zM4 10l7-7M20 13l-9 9"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  pdf: '<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5z"/><path d="M14 2.5v5h5"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
};
const icon = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const MAX_SRC = 3000;

// ---------- toasts / hojas ----------
function toast(msg, type = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 3800 : 2200);
}
function busy(msg) {
  const el = document.createElement('div'); el.className = 'busy'; el.innerHTML = `<div class="spin"></div><span>${esc(msg)}</span>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  return { set: m => { $('span', el).textContent = m; }, done: () => { el.classList.remove('in'); setTimeout(() => el.remove(), 200); } };
}
function sheet({ title, body, onMount }) {
  const w = document.createElement('div'); w.className = 'sheet-w';
  w.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="grip"></div><h3>${esc(title)}</h3>${body}</div>`;
  document.body.appendChild(w); requestAnimationFrame(() => w.classList.add('in'));
  const close = () => { w.classList.remove('in'); setTimeout(() => w.remove(), 220); };
  w.addEventListener('click', e => { if (e.target === w) close(); });
  onMount?.(w, close); return close;
}
function confirmSheet(title, text, ok, danger = true) {
  return new Promise(res => sheet({
    title, body: `<p class="muted">${text}</p><div class="sheet-a"><button class="btn ghost" data-n>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-y>${esc(ok)}</button></div>`,
    onMount: (w, close) => { $('[data-n]', w).onclick = () => { close(); res(false); }; $('[data-y]', w).onclick = () => { close(); res(true); }; },
  }));
}

// ---------- imágenes ----------
async function bitmapOf(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { return await createImageBitmap(blob); }
}
function canvasOf(src, w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h); return c; }
const toBlob = (cv, type = 'image/jpeg', q = 0.9) => new Promise(r => cv.toBlob(r, type, q));

/** Normaliza una foto: la achica si es enorme y detecta la hoja. */
async function ingest(blobOrCanvas) {
  let src, w, h;
  if (blobOrCanvas instanceof HTMLCanvasElement) { src = blobOrCanvas; w = src.width; h = src.height; }
  else { src = await bitmapOf(blobOrCanvas); w = src.width; h = src.height; }
  const s = Math.min(1, MAX_SRC / Math.max(w, h));
  const W = Math.round(w * s), H = Math.round(h * s);
  const cv = canvasOf(src, W, H);
  const blob = await toBlob(cv, 'image/jpeg', 0.92);
  const quad = autoQuad(cv, W, H);
  return { id: uid(), blob, w: W, h: H, quad: quad.quad, detected: quad.detected, filter: 'color', rot: 0 };
}

function autoQuad(source, W, H) {
  const { img, scale } = V.smallFrame(source, W, H, 256);
  const det = V.detectDocument(img);
  if (!det) { const m = 0.04; return { detected: false, quad: [[W * m, H * m], [W * (1 - m), H * m], [W * (1 - m), H * (1 - m)], [W * m, H * (1 - m)]] }; }
  let q = det.quad.map(p => [p[0] * scale, p[1] * scale]);
  const mid = V.smallFrame(source, W, H, 1000);
  const ms = mid.scale;
  q = V.refineQuad(V.toGray(mid.img), mid.img.width, mid.img.height, q.map(p => [p[0] / ms, p[1] / ms])).map(p => [p[0] * ms, p[1] * ms]);
  // un pelo hacia adentro para que no se cuele el fondo en los bordes
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
  q = q.map(p => [p[0] + (cx - p[0]) * 0.006, p[1] + (cy - p[1]) * 0.006]);
  q = q.map(p => [Math.min(W, Math.max(0, p[0])), Math.min(H, Math.max(0, p[1]))]);
  return { detected: true, quad: q };
}

// procesado (con caché por parámetros)
const cache = new Map(), bitmaps = new Map();
async function srcBitmap(page) { if (!bitmaps.has(page.id)) bitmaps.set(page.id, await bitmapOf(page.blob)); return bitmaps.get(page.id); }
async function render(page, maxSide = 2200) {
  const key = `${page.id}|${page.quad.map(p => p.map(v => v.toFixed(1)).join(',')).join(';')}|${page.filter}|${page.rot}|${maxSide}`;
  if (cache.has(key)) return cache.get(key);
  const bmp = await srcBitmap(page);
  const srcCv = canvasOf(bmp, page.w, page.h);
  const src = srcCv.getContext('2d').getImageData(0, 0, page.w, page.h);
  const [w, h] = V.outputSize(page.quad, maxSide, page.w, page.h);
  const out = V.warp(src, page.quad, w, h);
  V.applyFilter(out, page.filter);
  let cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(out, 0, 0);
  cv = V.rotateCanvas(cv, page.rot);
  for (const k of cache.keys()) if (k.startsWith(page.id + '|') && k.endsWith('|' + maxSide)) cache.delete(k);
  cache.set(key, cv);
  return cv;
}
async function thumbOf(page) {
  const cv = await render(page, 520);
  const t = canvasOf(cv, Math.round(cv.width * 260 / Math.max(cv.width, cv.height)), Math.round(cv.height * 260 / Math.max(cv.width, cv.height)));
  return t.toDataURL('image/jpeg', 0.75);
}

// ---------- rutas ----------
let current = null;
async function route() {
  current?.destroy?.(); current = null;
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  const app = $('#app'); app.innerHTML = '';
  document.body.dataset.view = id || 'inicio';
  if (id === 'camara') current = await camera(app, arg);
  else if (id === 'doc') current = await editor(app, arg);
  else current = await home(app);
}

// =====================================================================
// INICIO
// =====================================================================
async function home(app) {
  const docs = await DB.allDocs();
  app.innerHTML = `
  <header class="hb">
    <div class="brand"><span class="logo">${logo()}</span><div><b>Zenix</b> Escáner</div></div>
    <span class="pill">${icon('lock')} Todo queda en tu dispositivo</span>
  </header>
  <main class="home">
    ${docs.length ? `<h2 class="sec">Mis documentos <span>${docs.length}</span></h2>
      <div class="docs">${docs.map(d => `
        <a class="dcard" href="#/doc/${d.id}">
          <div class="dthumb">${d.thumb ? `<img src="${d.thumb}" alt="">` : ''}<span class="dpages">${d.pages.length} ${d.pages.length === 1 ? 'pág.' : 'págs.'}</span></div>
          <b>${esc(d.name)}</b><small>${new Date(d.updatedAt).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
        </a>`).join('')}</div>` : `
      <section class="hero">
        <div class="hero-art">${heroArt()}</div>
        <h1>Escaneá documentos<br>como un profesional.</h1>
        <p class="muted">Apuntá la cámara a una hoja: la detecto sola, la enderezo, le saco las sombras y te armo un PDF. Sin subir nada a internet.</p>
        <ul class="feats"><li>${icon('scan')} Detección automática de bordes en vivo</li><li>${icon('magic')} Quita sombras y deja el fondo blanco</li><li>${icon('pdf')} PDF de varias páginas, listo para compartir</li></ul>
      </section>`}
  </main>
  <div class="dock">
    <button class="btn ghost" id="imp">${icon('image')} Importar</button>
    <a class="btn shutter-btn" href="#/camara">${icon('scan')} Escanear</a>
    <input type="file" id="file" accept="image/*" multiple hidden>
  </div>
  ${docs.length ? '' : `<button class="sample" id="sample">${icon('magic')} Probar con una foto de ejemplo</button>`}`;
  $('#imp').onclick = () => $('#file').click();
  $('#file').onchange = e => importFiles([...e.target.files]);
  $('#sample')?.addEventListener('click', async () => {
    const b = busy('Preparando foto de ejemplo…');
    try { const blob = await samplePhoto(); b.done(); await importFiles([blob], true); } catch (err) { b.done(); toast('No se pudo generar el ejemplo', 'err'); console.error(err); }
  });
  return {};
}

async function importFiles(files, sample = false, docId = null) {
  if (!files.length) return;
  const b = busy(files.length > 1 ? `Procesando 1 de ${files.length}…` : 'Detectando la hoja…');
  try {
    const doc = docId ? await DB.getDoc(docId) : newDoc(sample ? 'Factura de ejemplo' : null);
    let found = 0;
    for (let i = 0; i < files.length; i++) {
      b.set(files.length > 1 ? `Procesando ${i + 1} de ${files.length}…` : 'Detectando la hoja…');
      await nextFrame();
      const p = await ingest(files[i]); if (p.detected) found++;
      doc.pages.push(p);
    }
    doc.thumb = await thumbOf(doc.pages[0]);
    await DB.putDoc(doc);
    b.done();
    if (found < files.length) toast(found ? `Detecté ${found} de ${files.length} hojas. Ajustá el resto a mano.` : 'No encontré bordes claros: ajustá las esquinas a mano.', 'warn');
    const first = doc.pages.length - files.length;
    location.hash = `#/doc/${doc.id}/${first}`;
  } catch (err) { b.done(); console.error(err); toast('No se pudo leer la imagen', 'err'); }
}
function newDoc(name) {
  const d = new Date();
  return { id: uid(), name: name || `Escaneo ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, createdAt: Date.now(), updatedAt: Date.now(), pages: [], thumb: '' };
}

// =====================================================================
// CÁMARA
// =====================================================================
async function camera(app, docId) {
  app.innerHTML = `
  <div class="cam">
    <video playsinline muted autoplay></video>
    <svg class="ov" preserveAspectRatio="none"><polygon id="poly" points=""/></svg>
    <div class="flash"></div>
    <header class="cam-top">
      <a href="${docId ? '#/doc/' + docId : '#/'}" class="round" aria-label="Cerrar">${icon('x')}</a>
      <div class="hint" id="hint">Buscando la hoja…</div>
      <div class="cam-tools"><button class="round" id="torch" hidden aria-label="Linterna">${icon('bolt')}</button><button class="round on" id="autoBtn" aria-label="Disparo automático">${icon('auto')}</button></div>
    </header>
    <footer class="cam-bot">
      <button class="last" id="last" aria-label="Ver páginas"><span id="count"></span></button>
      <button class="shutter" id="shot" aria-label="Capturar"><i></i><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="37" id="ring"/></svg></button>
      <button class="round wide" id="done" disabled>Listo</button>
    </footer>
    <div class="cam-err" id="camErr" hidden><div>${icon('scan', 'xl')}<h2>No pude usar la cámara</h2><p id="camMsg"></p><button class="btn primary" id="pick">${icon('image')} Elegir fotos</button><a class="btn ghost" href="#/">Volver</a></div><input type="file" id="cf" accept="image/*" multiple hidden></div>
  </div>`;
  const video = $('video', app), poly = $('#poly', app), svg = $('.ov', app), hint = $('#hint', app);
  let stream = null, alive = true, auto = true, timer = 0, smooth = null, stableSince = 0, lastQuad = null, capturing = false;
  let doc = docId ? await DB.getDoc(docId) : null;
  const pending = [];
  const updateCount = async () => {
    const n = (doc?.pages.length || 0);
    $('#count', app).textContent = n ? n : '';
    $('#last', app).classList.toggle('has', n > 0);
    $('#done', app).disabled = !n;
    if (doc?.pages.length) { const t = await thumbOf(doc.pages[doc.pages.length - 1]); $('#last', app).style.backgroundImage = `url(${t})`; }
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = stream; await video.play();
    const track = stream.getVideoTracks()[0];
    if (track.getCapabilities?.().torch) { const t = $('#torch', app); t.hidden = false; let on = false; t.onclick = async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); t.classList.toggle('on', on); } catch {} }; }
  } catch (err) {
    $('#camErr', app).hidden = false;
    $('#camMsg', app).textContent = err?.name === 'NotAllowedError' ? 'Diste permiso denegado. Podés habilitarlo en la configuración del navegador o elegir fotos de la galería.' : 'Este dispositivo no tiene cámara disponible. Podés elegir fotos que ya tengas.';
    $('#pick', app).onclick = () => $('#cf', app).click();
    $('#cf', app).onchange = e => importFiles([...e.target.files], false, docId);
    return { destroy() {} };
  }
  updateCount();

  const mapPt = ([x, y]) => {
    const cw = video.clientWidth, ch = video.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
    const s = Math.max(cw / vw, ch / vh), ox = (cw - vw * s) / 2, oy = (ch - vh * s) / 2;
    return [x * s + ox, y * s + oy];
  };
  const loop = () => {
    if (!alive) return;
    if (video.videoWidth && !capturing) {
      svg.setAttribute('viewBox', `0 0 ${video.clientWidth} ${video.clientHeight}`);
      const { img, scale } = V.smallFrame(video, video.videoWidth, video.videoHeight, 220);
      const det = V.detectDocument(img);
      let q = det && det.score > 0.45 ? det.quad.map(p => [p[0] * scale, p[1] * scale]) : null;
      if (q) { // refinamiento en una imagen mediana para que el contorno calce justo
        const mid = V.smallFrame(video, video.videoWidth, video.videoHeight, 640), ms = mid.scale;
        q = V.refineQuad(V.toGray(mid.img), mid.img.width, mid.img.height, q.map(p => [p[0] / ms, p[1] / ms])).map(p => [p[0] * ms, p[1] * ms]);
      }
      if (q) {
        smooth = smooth ? smooth.map((p, i) => [p[0] * 0.55 + q[i][0] * 0.45, p[1] * 0.55 + q[i][1] * 0.45]) : q;
        poly.setAttribute('points', smooth.map(mapPt).map(p => p.join(',')).join(' '));
        poly.classList.add('on');
        const move = lastQuad ? Math.max(...q.map((p, i) => Math.hypot(p[0] - lastQuad[i][0], p[1] - lastQuad[i][1]))) / Math.max(video.videoWidth, video.videoHeight) : 1;
        lastQuad = q;
        if (move < 0.018) { stableSince ||= performance.now(); } else stableSince = 0;
        const held = stableSince ? (performance.now() - stableSince) / 1200 : 0;
        $('#ring', app).style.strokeDashoffset = auto ? 232 * (1 - Math.min(1, held)) : 232;
        hint.textContent = auto ? (held > 0.15 ? 'Quieto… capturando' : 'Hoja detectada') : 'Hoja detectada · tocá para capturar';
        poly.classList.toggle('ready', held > 0.15);
        if (auto && held >= 1) capture();
      } else {
        smooth = null; lastQuad = null; stableSince = 0;
        poly.classList.remove('on', 'ready');
        $('#ring', app).style.strokeDashoffset = 232;
        hint.textContent = 'Buscando la hoja…';
      }
    }
    timer = setTimeout(loop, 140);
  };
  loop();

  async function capture() {
    if (capturing || !video.videoWidth) return;
    capturing = true; stableSince = 0;
    $('.flash', app).classList.remove('go'); void $('.flash', app).offsetWidth; $('.flash', app).classList.add('go');
    try { navigator.vibrate?.(30); } catch {}
    const cv = canvasOf(video, video.videoWidth, video.videoHeight);
    try {
      if (!doc) { doc = newDoc(); }
      const p = await ingest(cv);
      doc.pages.push(p);
      doc.thumb = doc.thumb || await thumbOf(doc.pages[0]);
      await DB.putDoc(doc);
      await updateCount();
      toast(`Página ${doc.pages.length} capturada`);
    } catch (e) { console.error(e); toast('No se pudo capturar', 'err'); }
    setTimeout(() => { capturing = false; lastQuad = null; }, 900);
  }
  $('#shot', app).onclick = capture;
  $('#autoBtn', app).onclick = e => { auto = !auto; e.currentTarget.classList.toggle('on', auto); toast(auto ? 'Disparo automático activado' : 'Disparo automático desactivado'); };
  const finish = () => { if (doc) location.hash = `#/doc/${doc.id}`; };
  $('#done', app).onclick = finish; $('#last', app).onclick = finish;
  return { destroy() { alive = false; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); } };
}

// =====================================================================
// EDITOR
// =====================================================================
async function editor(app, id) {
  const [docId, startIdx] = [id, +(location.hash.split('/')[3] || 0)];
  const doc = await DB.getDoc(docId);
  if (!doc) { location.hash = '#/'; return {}; }
  let idx = Math.min(Math.max(0, startIdx || 0), Math.max(0, doc.pages.length - 1));
  let mode = 'view';
  app.innerHTML = `
  <header class="eb">
    <a href="#/" class="icon-btn" aria-label="Volver">${icon('back')}</a>
    <input class="name" id="name" value="${esc(doc.name)}" aria-label="Nombre del documento">
    <button class="icon-btn" id="moreBtn" aria-label="Más">${icon('more')}</button>
    <button class="btn primary" id="pdfBtn">${icon('pdf')}<span>PDF</span></button>
  </header>
  <main class="stage" id="stage">
    <div class="view" id="view"><canvas id="out"></canvas><div class="spin small" id="ld"></div></div>
    <div class="crop" id="crop" hidden>
      <canvas id="srcCv"></canvas>
      <svg id="cropSvg"><path id="shade" fill-rule="evenodd"/><polygon id="cropPoly"/></svg>
      ${[0, 1, 2, 3].map(i => `<div class="h" data-h="${i}"><i></i></div>`).join('')}
      <canvas class="loupe" id="loupe" width="128" height="128"></canvas>
    </div>
  </main>
  <div class="filters" id="filters" hidden></div>
  <nav class="tools" id="tools">
    <button data-t="crop">${icon('crop')}<span>Recortar</span></button>
    <button data-t="filter">${icon('filter')}<span>Filtro</span></button>
    <button data-t="rotate">${icon('rotate')}<span>Girar</span></button>
    <button data-t="del">${icon('trash')}<span>Borrar</span></button>
  </nav>
  <nav class="tools crop-tools" id="cropTools" hidden>
    <button data-c="auto">${icon('magic')}<span>Detectar</span></button>
    <button data-c="full">${icon('full')}<span>Toda la foto</span></button>
    <button data-c="ok" class="ok">${icon('check')}<span>Listo</span></button>
  </nav>
  <div class="strip" id="strip"></div>`;

  const save = async () => { doc.thumb = await thumbOf(doc.pages[0]); await DB.putDoc(doc); };
  const page = () => doc.pages[idx];

  // ----- vista -----
  let renderTok = 0;
  const showPage = async () => {
    if (!doc.pages.length) { location.hash = '#/'; return; }
    const tok = ++renderTok;
    $('#ld').hidden = false;
    await nextFrame();
    const cv = await render(page());
    if (tok !== renderTok) return;
    const out = $('#out'); out.width = cv.width; out.height = cv.height; out.getContext('2d').drawImage(cv, 0, 0);
    $('#ld').hidden = true;
    strip();
  };
  const strip = async () => {
    const el = $('#strip');
    const thumbs = await Promise.all(doc.pages.map(p => thumbOf(p)));
    el.innerHTML = thumbs.map((t, i) => `<button class="th ${i === idx ? 'on' : ''}" data-i="${i}" aria-label="Página ${i + 1}"><img src="${t}" alt=""><span>${i + 1}</span></button>`).join('') +
      `<button class="th add" id="addPg" aria-label="Agregar página">${icon('plus')}</button>` +
      (doc.pages.length > 1 ? `<div class="mv"><button class="icon-btn sm" id="mvL" ${idx === 0 ? 'disabled' : ''} aria-label="Mover a la izquierda">${icon('left')}</button><button class="icon-btn sm" id="mvR" ${idx === doc.pages.length - 1 ? 'disabled' : ''} aria-label="Mover a la derecha">${icon('right')}</button></div>` : '');
    $('.th.on', el)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };
  $('#strip').onclick = async e => {
    const th = e.target.closest('[data-i]');
    if (th) { idx = +th.dataset.i; if (mode === 'crop') exitCrop(false); closeFilters(); showPage(); return; }
    if (e.target.closest('#addPg')) return addPage();
    const mv = e.target.closest('#mvL,#mvR');
    if (mv) { const j = idx + (mv.id === 'mvL' ? -1 : 1); [doc.pages[idx], doc.pages[j]] = [doc.pages[j], doc.pages[idx]]; idx = j; await save(); strip(); }
  };
  const addPage = () => sheet({
    title: 'Agregar página',
    body: `<div class="sheet-list"><a href="#/camara/${doc.id}" class="row">${icon('scan')}<div><b>Escanear con la cámara</b><small>Detección automática de la hoja</small></div></a>
      <button class="row" id="pk">${icon('image')}<div><b>Elegir de la galería</b><small>Podés elegir varias fotos</small></div></button><input type="file" id="pf" accept="image/*" multiple hidden></div>`,
    onMount: (w, close) => { $('#pk', w).onclick = () => $('#pf', w).click(); $('#pf', w).onchange = e => { close(); importFiles([...e.target.files], false, doc.id); }; $('a', w).onclick = close; },
  });

  $('#name').onchange = async e => { doc.name = e.target.value.trim() || doc.name; e.target.value = doc.name; await DB.putDoc(doc); toast('Nombre guardado'); };

  // ----- herramientas -----
  const filtersEl = $('#filters');
  const closeFilters = () => { filtersEl.hidden = true; $$('#tools button').forEach(b => b.classList.remove('on')); };
  const openFilters = async () => {
    $('[data-t=filter]').classList.add('on');
    filtersEl.hidden = false;
    filtersEl.innerHTML = Object.entries(V.FILTERS).map(([k, l]) => `<button data-f="${k}" class="${page().filter === k ? 'on' : ''}"><span class="fth" data-ft="${k}"></span>${l}</button>`).join('');
    // vistas previas de cada filtro
    for (const k of Object.keys(V.FILTERS)) {
      const cv = await render({ ...page(), filter: k }, 220);
      const el = filtersEl.querySelector(`[data-ft="${k}"]`); if (el) el.style.backgroundImage = `url(${cv.toDataURL('image/jpeg', .7)})`;
    }
  };
  filtersEl.onclick = async e => { const b = e.target.closest('[data-f]'); if (!b) return; page().filter = b.dataset.f; $$('#filters button').forEach(x => x.classList.toggle('on', x === b)); await showPage(); save(); };
  $('#tools').onclick = async e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = b.dataset.t;
    if (t === 'filter') { if (filtersEl.hidden) openFilters(); else closeFilters(); return; }
    closeFilters();
    if (t === 'rotate') { page().rot = (page().rot + 1) % 4; await showPage(); save(); }
    if (t === 'crop') enterCrop();
    if (t === 'del') {
      if (!(await confirmSheet('Borrar página', doc.pages.length === 1 ? 'Es la única página: se borra el documento completo.' : `Se borra la página ${idx + 1}.`, 'Borrar'))) return;
      if (doc.pages.length === 1) { await DB.deleteDoc(doc.id); toast('Documento borrado'); location.hash = '#/'; return; }
      doc.pages.splice(idx, 1); idx = Math.min(idx, doc.pages.length - 1); await save(); showPage(); toast('Página borrada');
    }
  };

  // ----- recorte -----
  let quad = null, disp = null;
  const srcCv = $('#srcCv'), cropEl = $('#crop');
  async function enterCrop() {
    mode = 'crop';
    $('#view').hidden = true; cropEl.hidden = false; $('#tools').hidden = true; $('#cropTools').hidden = false; $('#strip').classList.add('dim');
    const p = page(), bmp = await srcBitmap(p);
    quad = p.quad.map(q => q.slice());
    layoutCrop(bmp);
  }
  function layoutCrop(bmp) {
    const p = page(), box = $('#stage').getBoundingClientRect(), pad = 26;
    const s = Math.min((box.width - pad * 2) / p.w, (box.height - pad * 2) / p.h);
    const w = Math.round(p.w * s), h = Math.round(p.h * s);
    const dpr = Math.min(2, devicePixelRatio || 1);
    srcCv.width = w * dpr; srcCv.height = h * dpr; srcCv.style.width = w + 'px'; srcCv.style.height = h + 'px';
    srcCv.getContext('2d').drawImage(bmp, 0, 0, srcCv.width, srcCv.height);
    const ox = (box.width - w) / 2, oy = (box.height - h) / 2;
    srcCv.style.left = ox + 'px'; srcCv.style.top = oy + 'px';
    const svg = $('#cropSvg'); svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    disp = { s, ox, oy, w, h, bmp };
    drawCrop();
  }
  const toScreen = ([x, y]) => [disp.ox + x * disp.s, disp.oy + y * disp.s];
  function drawCrop() {
    const pts = quad.map(toScreen), box = $('#stage').getBoundingClientRect();
    $('#cropPoly').setAttribute('points', pts.map(p => p.join(',')).join(' '));
    $('#shade').setAttribute('d', `M0,0H${box.width}V${box.height}H0Z M${pts.map(p => p.join(',')).join(' L')} Z`);
    $$('.h', cropEl).forEach((h, i) => { h.style.transform = `translate(${pts[i][0]}px, ${pts[i][1]}px)`; });
    const convex = isConvex(quad);
    $('#cropPoly').classList.toggle('bad', !convex);
    $('[data-c=ok]').disabled = !convex;
  }
  function isConvex(q) { let sign = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4]; const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (Math.abs(z) < 1e-6) return false; const sg = Math.sign(z); if (sign && sg !== sign) return false; sign = sg; } return V.polyArea(q) > 400; }
  const loupe = $('#loupe'), lctx = loupe.getContext('2d');
  function showLoupe(i) {
    const [sx, sy] = quad[i], [px, py] = toScreen(quad[i]), Z = 110 / disp.s / 2.6;
    lctx.clearRect(0, 0, 128, 128);
    lctx.drawImage(disp.bmp, sx - Z / 2 * 1, sy - Z / 2 * 1, Z, Z, 0, 0, 128, 128);
    lctx.strokeStyle = '#c6ff3d'; lctx.lineWidth = 1.5; lctx.beginPath(); lctx.moveTo(64, 50); lctx.lineTo(64, 78); lctx.moveTo(50, 64); lctx.lineTo(78, 64); lctx.stroke();
    const box = $('#stage').getBoundingClientRect();
    let lx = px - 64, ly = py - 170; if (ly < 8) ly = py + 50; lx = Math.max(8, Math.min(box.width - 136, lx));
    loupe.style.transform = `translate(${lx}px, ${ly}px)`; loupe.classList.add('on');
  }
  let drag = null;
  cropEl.addEventListener('pointerdown', e => {
    const h = e.target.closest('.h'); if (!h) return;
    e.preventDefault(); const i = +h.dataset.h; const [px, py] = toScreen(quad[i]);
    drag = { i, dx: px - e.clientX, dy: py - e.clientY, rect: $('#stage').getBoundingClientRect() };
    h.setPointerCapture(e.pointerId); h.classList.add('drag'); showLoupe(i);
  });
  cropEl.addEventListener('pointermove', e => {
    if (!drag) return;
    const x = (e.clientX + drag.dx - drag.rect.left - disp.ox) / disp.s, y = (e.clientY + drag.dy - drag.rect.top - disp.oy) / disp.s;
    const p = page();
    quad[drag.i] = [Math.max(0, Math.min(p.w, x)), Math.max(0, Math.min(p.h, y))];
    drawCrop(); showLoupe(drag.i);
  });
  const endDrag = () => { if (!drag) return; $$('.h.drag').forEach(h => h.classList.remove('drag')); loupe.classList.remove('on'); drag = null; };
  cropEl.addEventListener('pointerup', endDrag); cropEl.addEventListener('pointercancel', endDrag);
  // también se puede mover con el teclado: foco en una esquina y flechas
  $$('.h', cropEl).forEach(h => { h.tabIndex = 0; h.setAttribute('role', 'slider'); h.setAttribute('aria-label', ['Esquina superior izquierda', 'Esquina superior derecha', 'Esquina inferior derecha', 'Esquina inferior izquierda'][+h.dataset.h]); });
  cropEl.addEventListener('keydown', e => {
    const h = e.target.closest('.h'); if (!h) return; const i = +h.dataset.h, st = (e.shiftKey ? 10 : 2) / disp.s;
    const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]; if (!d) return;
    e.preventDefault(); quad[i] = [quad[i][0] + d[0], quad[i][1] + d[1]]; drawCrop();
  });
  $('#cropTools').onclick = async e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const p = page();
    if (b.dataset.c === 'auto') { const bmp = await srcBitmap(p); const r = autoQuad(canvasOf(bmp, p.w, p.h), p.w, p.h); quad = r.quad; drawCrop(); toast(r.detected ? 'Hoja detectada' : 'No encontré bordes claros', r.detected ? 'ok' : 'warn'); }
    if (b.dataset.c === 'full') { quad = [[0, 0], [p.w, 0], [p.w, p.h], [0, p.h]]; drawCrop(); }
    if (b.dataset.c === 'ok') exitCrop(true);
  };
  async function exitCrop(apply) {
    mode = 'view';
    if (apply && quad) { page().quad = quad; save(); }
    cropEl.hidden = true; $('#view').hidden = false; $('#tools').hidden = false; $('#cropTools').hidden = true; $('#strip').classList.remove('dim');
    showPage();
  }
  const onResize = () => { if (mode === 'crop' && disp) layoutCrop(disp.bmp); };
  addEventListener('resize', onResize);

  // ----- exportar -----
  async function makePDF(bar) {
    const pages = [];
    for (let i = 0; i < doc.pages.length; i++) {
      bar?.set(`Armando página ${i + 1} de ${doc.pages.length}…`); await nextFrame();
      const cv = await render(doc.pages[i]);
      const blob = await toBlob(cv, 'image/jpeg', 0.86);
      pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: cv.width, height: cv.height });
    }
    return buildPDF(pages, { title: doc.name });
  }
  const fileName = ext => `${doc.name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'documento'}.${ext}`;
  $('#pdfBtn').onclick = () => sheet({
    title: 'Exportar',
    body: `<div class="sheet-list">
      ${navigator.canShare ? `<button class="row" data-x="share">${icon('share')}<div><b>Compartir PDF</b><small>WhatsApp, mail, Drive…</small></div></button>` : ''}
      <button class="row" data-x="pdf">${icon('download')}<div><b>Descargar PDF</b><small>${doc.pages.length} ${doc.pages.length === 1 ? 'página' : 'páginas'}</small></div></button>
      <button class="row" data-x="jpg">${icon('image')}<div><b>Descargar esta página en JPG</b><small>Página ${idx + 1}</small></div></button></div>`,
    onMount: (w, close) => w.addEventListener('click', async e => {
      const b = e.target.closest('[data-x]'); if (!b) return; close();
      const bar = busy('Preparando…');
      try {
        if (b.dataset.x === 'jpg') { const cv = await render(page()); dl(await toBlob(cv, 'image/jpeg', 0.92), fileName('jpg')); bar.done(); return; }
        const pdf = await makePDF(bar); bar.done();
        const file = new File([pdf], fileName('pdf'), { type: 'application/pdf' });
        if (b.dataset.x === 'share' && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: doc.name }); } catch (err) { if (err.name !== 'AbortError') dl(pdf, fileName('pdf')); } }
        else { dl(pdf, fileName('pdf')); toast(`PDF listo · ${(pdf.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`); }
      } catch (err) { bar.done(); console.error(err); toast('No se pudo exportar', 'err'); }
    }),
  });
  $('#moreBtn').onclick = () => sheet({
    title: doc.name,
    body: `<div class="sheet-list"><button class="row" data-m="ren">${icon('edit')}<div><b>Cambiar nombre</b></div></button><button class="row danger" data-m="del">${icon('trash')}<div><b>Borrar documento</b><small>${doc.pages.length} ${doc.pages.length === 1 ? 'página' : 'páginas'}</small></div></button></div>`,
    onMount: (w, close) => w.addEventListener('click', async e => {
      const b = e.target.closest('[data-m]'); if (!b) return; close();
      if (b.dataset.m === 'ren') { const n = $('#name'); n.focus(); n.select(); }
      if (b.dataset.m === 'del' && await confirmSheet('Borrar documento', `Se borra “${esc(doc.name)}” con todas sus páginas.`, 'Borrar')) { await DB.deleteDoc(doc.id); toast('Documento borrado'); location.hash = '#/'; }
    }),
  });

  await showPage();
  if (!page().detected && location.hash.split('/').length > 3 && doc.pages.length) { /* recién importada sin bordes: abrir recorte */ enterCrop(); }
  return { destroy() { removeEventListener('resize', onResize); } };
}

function dl(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------- arte ----------
const logo = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#c6ff3d"/><path d="M11 15v-3a1 1 0 0 1 1-1h3M25 11h3a1 1 0 0 1 1 1v3M29 25v3a1 1 0 0 1-1 1h-3M15 29h-3a1 1 0 0 1-1-1v-3" fill="none" stroke="#0b0c0e" stroke-width="2.6" stroke-linecap="round"/><path d="M15.5 16h9l-9 8h9" fill="none" stroke="#0b0c0e" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const heroArt = () => `<svg viewBox="0 0 320 220" aria-hidden="true">
  <defs><linearGradient id="hg" x1="0" x2="1"><stop offset="0" stop-color="#c6ff3d"/><stop offset="1" stop-color="#3dffb0"/></linearGradient></defs>
  <g transform="translate(40 30) rotate(-8 60 80)"><path d="M10 6 118 14 110 170 2 160z" fill="#2a2d33"/><g stroke="#4a4f58" stroke-width="5" stroke-linecap="round"><path d="M22 34h70M21 50h80M20 66h60M19 82h76M18 98h54M17 114h70"/></g></g>
  <g class="beam"><rect x="28" y="40" width="130" height="3" fill="url(#hg)" rx="2"/></g>
  <path d="M150 110h28" stroke="#5c616b" stroke-width="3" stroke-dasharray="4 6" stroke-linecap="round"/><path d="m174 102 10 8-10 8" fill="none" stroke="#5c616b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="translate(196 34)"><rect width="104" height="148" rx="4" fill="#fff"/><g stroke="#1b1d22" stroke-width="5" stroke-linecap="round"><path d="M14 26h60M14 42h74M14 58h54M14 74h70M14 90h48M14 106h66"/></g><rect x="62" y="122" width="30" height="12" rx="2" fill="#6d3df5"/></g>
  <g fill="url(#hg)"><circle cx="196" cy="34" r="5"/><circle cx="300" cy="34" r="5"/><circle cx="300" cy="182" r="5"/><circle cx="196" cy="182" r="5"/></g></svg>`;

// ---------- arranque ----------
document.body.innerHTML = `<div id="app"></div><div id="toasts" aria-live="polite"></div>`;
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
