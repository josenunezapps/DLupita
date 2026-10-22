// Pantallas: Inicio, Biblioteca, Detalle, Notas y fragmentos, Estadísticas, Configuración.
import { db, settings, saveSettings, deleteBook } from './db.js';
import {
  esc, icon, coverHTML, fmtDuration, fmtDate, fmtRelative, fmtSize, pct, STATUS_LABEL, toast, modal,
  confirmDialog, normalize, MARK_COLORS,
} from './util.js';
import { computeStats, bookStats } from './stats.js';
import { KIND, locationLabel, editMarkDialog, noteDialog, createMark } from './marks.js';
import { tts } from './tts.js';
import { exportBackup, importBackup } from './backup.js';

const openImport = () => document.getElementById('file-input').click();

function progressRow(b) {
  return `<div class="prog-row"><div class="progress"><i style="width:${pct(b.progress)}"></i></div><span>${pct(b.progress)}</span></div>`;
}
function bookCard(b) {
  return `<a class="book-card" href="#/libro/${b.id}">${coverHTML(b)}<div class="meta"><h3>${esc(b.title)}</h3><p>${esc(b.author || 'Autor desconocido')}</p></div>${b.status !== 'unread' ? progressRow(b) : ''}</a>`;
}
function bookRow(b) {
  return `<a class="book-row" href="#/libro/${b.id}">${coverHTML(b, { badge: false })}
    <div style="min-width:0"><h3>${esc(b.title)}</h3><p>${esc(b.author || 'Autor desconocido')} · ${b.format.toUpperCase()} · ${fmtSize(b.fileSize)}</p>${progressRow(b)}</div>
    <span class="status-pill ${b.status}">${STATUS_LABEL[b.status]}</span></a>`;
}
function emptyLibrary() {
  return `<div class="empty"><div class="ill">${icon('book')}</div><h2>Tu biblioteca te espera</h2>
    <p>Agregá tus PDF y EPUB para leerlos, escucharlos y estudiarlos. Los archivos se guardan en este dispositivo.</p>
    <button class="btn btn-primary" data-action="import">${icon('upload')}Agregar mis libros</button>
    <p class="small muted" style="margin-top:14px">También podés arrastrarlos y soltarlos en cualquier parte.</p></div>`;
}

// =============== INICIO ===============
export async function renderHome(el) {
  const [books, stats] = await Promise.all([db.all('books'), computeStats()]);
  const visible = books.filter(b => !b.archived);
  const h = new Date().getHours();
  const greet = h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const last = visible.filter(b => b.lastOpenedAt && b.status !== 'finished').sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0];
  const recent = [...visible].sort((a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt)).slice(0, 12);

  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">${greet}</div><h1>${visible.length ? '¿Qué leemos hoy?' : 'Bienvenido a MiLibroPDF'}</h1>
      <p>Tu biblioteca personal para leer, escuchar y estudiar.</p></div></div>
    ${!visible.length ? emptyLibrary() : `
      ${last ? `<section class="hero">
        <a href="#/libro/${last.id}">${coverHTML(last)}</a>
        <div><div class="eyebrow">Continuar leyendo</div><h2>${esc(last.title)}</h2>
          <p class="author">${esc(last.author || 'Autor desconocido')}</p>
          ${progressRow(last)}
          <p class="small muted" style="margin:-8px 0 16px">${last.chapter ? esc(last.chapter) + ' · ' : ''}${last.page ? `Página ${last.page}${last.pageCount ? ' de ' + last.pageCount : ''} · ` : ''}Última lectura ${fmtRelative(last.lastOpenedAt)}</p>
          <div class="actions"><a class="btn btn-primary" href="#/leer/${last.id}">${icon('book')}Retomar lectura</a>
          <a class="btn" href="#/leer/${last.id}?tts=1">${icon('headphones')}Escuchar</a></div></div>
      </section>` : ''}
      <section class="section"><div class="section-head"><h2>Tu actividad</h2><a href="#/estadisticas">Ver estadísticas</a></div>
        <div class="kpis">
          <div class="kpi"><div class="v">${fmtDuration(stats.today, true)}</div><div class="l">Leído hoy</div></div>
          <div class="kpi"><div class="v">${fmtDuration(stats.week, true)}</div><div class="l">Esta semana</div></div>
          <div class="kpi"><div class="v">${stats.finished}</div><div class="l">Libros terminados</div></div>
          <div class="kpi"><div class="v">${stats.streak}</div><div class="l">${stats.streak === 1 ? 'Día seguido' : 'Días seguidos'}</div></div>
        </div></section>
      <section class="section"><div class="section-head"><h2>Tu biblioteca</h2><a href="#/biblioteca">Ver todo (${visible.length})</a></div>
        <div class="shelf">${recent.map(bookCard).join('')}</div></section>`}
  `;
}

// =============== BIBLIOTECA ===============
const FILTERS = [
  ['all', 'Todos'], ['reading', 'Leyendo'], ['unread', 'Sin empezar'], ['finished', 'Terminados'],
  ['fav', 'Favoritos'], ['pdf', 'PDF'], ['epub', 'EPUB'], ['archived', 'Archivados'],
];
const SORTS = [['recent', 'Recientes'], ['added', 'Fecha de incorporación'], ['title', 'Título'], ['author', 'Autor'], ['progress', 'Progreso']];
const libState = { q: '', filter: 'all' };

export async function renderLibrary(el, query) {
  if (query.get('filtro')) libState.filter = query.get('filtro');
  const s = settings();
  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Biblioteca</div><h1>Tus libros</h1></div>
      <button class="btn btn-primary" data-action="import">${icon('plus')}Agregar libro</button></div>
    <div class="toolbar">
      <div class="search-box">${icon('search')}<input class="input" type="search" id="lib-q" placeholder="Buscar por título, autor o archivo" value="${esc(libState.q)}" /></div>
      <select class="input" id="lib-sort" style="width:auto" aria-label="Ordenar">${SORTS.map(([k, l]) => `<option value="${k}" ${s.librarySort === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <div class="seg" role="group" aria-label="Vista"><button data-view="grid" class="${s.libraryView === 'grid' ? 'active' : ''}" aria-label="Cuadrícula">${icon('grid')}</button><button data-view="list" class="${s.libraryView === 'list' ? 'active' : ''}" aria-label="Lista">${icon('rows')}</button></div>
    </div>
    <div class="chips" id="lib-filters">${FILTERS.map(([k, l]) => `<button class="chip ${libState.filter === k ? 'active' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div id="lib-results" style="margin-top:24px"></div>`;

  const books = await db.all('books');
  const results = el.querySelector('#lib-results');
  const draw = () => {
    const st = settings();
    const q = normalize(libState.q);
    let list = books.filter(b => {
      if (libState.filter === 'archived') { if (!b.archived) return false; } else if (b.archived) return false;
      if (['reading', 'unread', 'finished'].includes(libState.filter) && b.status !== libState.filter) return false;
      if (libState.filter === 'fav' && !b.favorite) return false;
      if ((libState.filter === 'pdf' || libState.filter === 'epub') && b.format !== libState.filter) return false;
      if (q && !normalize(`${b.title} ${b.author} ${b.fileName}`).includes(q)) return false;
      return true;
    });
    const by = {
      recent: (a, b) => (b.lastOpenedAt || b.createdAt) - (a.lastOpenedAt || a.createdAt),
      added: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.title.localeCompare(b.title, 'es'),
      author: (a, b) => (a.author || 'zzz').localeCompare(b.author || 'zzz', 'es'),
      progress: (a, b) => (b.progress || 0) - (a.progress || 0),
    }[st.librarySort] || (() => 0);
    list.sort(by);
    if (!books.length) { results.innerHTML = emptyLibrary(); return; }
    if (!list.length) { results.innerHTML = `<div class="empty"><h2>Sin resultados</h2><p>Probá con otra búsqueda o filtro.</p></div>`; return; }
    results.innerHTML = `<p class="small muted" style="margin:-8px 0 16px">${list.length} ${list.length === 1 ? 'libro' : 'libros'}</p>` +
      (st.libraryView === 'grid' ? `<div class="book-grid">${list.map(bookCard).join('')}</div>` : `<div class="book-list">${list.map(bookRow).join('')}</div>`);
  };
  draw();
  const qi = el.querySelector('#lib-q');
  qi.addEventListener('input', () => { libState.q = qi.value; draw(); });
  if (query.get('buscar')) setTimeout(() => qi.focus(), 50);
  el.querySelector('#lib-sort').addEventListener('change', async e => { await saveSettings({ librarySort: e.target.value }); draw(); });
  el.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', async () => {
    await saveSettings({ libraryView: b.dataset.view });
    el.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b)); draw();
  }));
  el.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
    libState.filter = b.dataset.f;
    el.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('active', x === b)); draw();
  }));
}

// =============== DETALLE ===============
export async function editBookDialog(book) {
  let newCover = null;
  const res = await modal({
    title: 'Editar datos del libro',
    body: `<div class="field"><label>Título</label><input class="input" name="title" value="${esc(book.title)}" /></div>
      <div class="field"><label>Autor</label><input class="input" name="author" value="${esc(book.author)}" placeholder="Autor desconocido" /></div>
      <div class="field"><label>Estado</label><select class="input" name="status">${Object.entries(STATUS_LABEL).map(([k, l]) => `<option value="${k}" ${book.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Portada</label><div style="display:flex;gap:10px;flex-wrap:wrap"><label class="btn btn-sm">${icon('upload')}Elegir imagen<input type="file" accept="image/*" name="cover" hidden></label>${book.cover ? '<button class="btn btn-sm btn-ghost" type="button" name="rmcover">Quitar portada</button>' : ''}</div><span class="small muted" id="cover-name"></span></div>`,
    onOpen: box => {
      box.querySelector('[name=cover]').addEventListener('change', e => { newCover = e.target.files[0] || null; box.querySelector('#cover-name').textContent = newCover ? newCover.name : ''; });
      box.querySelector('[name=rmcover]')?.addEventListener('click', () => { newCover = 'remove'; box.querySelector('#cover-name').textContent = 'Se usará una portada generada.'; });
    },
    actions: [
      { label: 'Cancelar', cls: 'btn-ghost', value: null },
      {
        label: 'Guardar', cls: 'btn-primary', primary: true, collect: box => ({
          title: box.querySelector('[name=title]').value.trim() || book.title,
          author: box.querySelector('[name=author]').value.trim(),
          status: box.querySelector('[name=status]').value,
        }),
      },
    ],
  });
  if (!res) return false;
  if (newCover === 'remove') { res.cover = null; res.coverVersion = (book.coverVersion || 0) + 1; }
  else if (newCover) { res.cover = newCover; res.coverVersion = (book.coverVersion || 0) + 1; }
  if (res.status === 'finished') res.progress = 1;
  await db.patch('books', book.id, res);
  toast('Datos actualizados.');
  return true;
}

function markCard(m, book, { showBook = true } = {}) {
  const k = KIND[m.type];
  const loc = locationLabel(m);
  return `<article class="mark-card" style="--mc:${m.color}" data-id="${m.id}">
    <div class="kind">${icon(k.icon)}${k.label}</div>
    ${m.text ? `<blockquote>${esc(m.text)}</blockquote>` : ''}
    ${m.note ? `<div class="note-body">${esc(m.note)}</div>` : ''}
    <div class="foot">${showBook ? (book ? `<a class="booklink" href="#/libro/${book.id}">${esc(book.title)}</a>` : '<span>Nota libre</span>') + (loc ? ' · ' : '') : ''}<span>${esc(loc)}</span><span>· ${fmtDate(m.createdAt)}</span><span class="sp"></span>
      ${book && m.position ? `<button class="btn btn-sm btn-ghost" data-go="${m.id}">${icon('book')}Ir al punto</button>` : ''}
      ${m.text ? `<button class="icon-btn" data-copy="${m.id}" aria-label="Copiar" title="Copiar">${icon('copy')}</button>` : ''}
      <button class="icon-btn" data-edit="${m.id}" aria-label="Editar" title="Editar">${icon('edit')}</button>
    </div></article>`;
}
function bindMarkCards(root, marks, redraw) {
  root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const m = marks.find(x => x.id === b.dataset.go);
    location.hash = `#/leer/${m.bookId}?pos=${encodeURIComponent(m.position)}`;
  }));
  root.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const m = marks.find(x => x.id === b.dataset.copy);
    try { await navigator.clipboard.writeText(m.text); toast('Texto copiado.'); } catch { toast('No se pudo copiar.'); }
  }));
  root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', async () => {
    const m = marks.find(x => x.id === b.dataset.edit);
    if (await editMarkDialog(m)) redraw();
  }));
}

export async function renderDetail(el, id, query) {
  const book = await db.get('books', id);
  if (!book) { el.innerHTML = `<div class="empty"><h2>Libro no encontrado</h2><p>Puede que haya sido eliminado.</p><a class="btn" href="#/biblioteca">Volver a la biblioteca</a></div>`; return; }
  const [st, marks] = await Promise.all([bookStats(id), db.byIndex('marks', 'bookId', id)]);
  marks.sort((a, b) => b.createdAt - a.createdAt);
  const started = book.status !== 'unread';
  el.innerHTML = `
    <a class="btn btn-ghost btn-sm" href="#/biblioteca" style="margin:-8px 0 14px -10px">${icon('back')}Biblioteca</a>
    <div class="detail">
      <div class="cover-wrap">${coverHTML(book)}</div>
      <div class="detail-info">
        <span class="status-pill ${book.status}">${STATUS_LABEL[book.status]}</span>${book.archived ? ' <span class="status-pill">Archivado</span>' : ''}
        <h1 style="margin-top:12px">${esc(book.title)}</h1>
        <p class="author">${esc(book.author || 'Autor desconocido')}</p>
        <div style="max-width:440px">${progressRow(book)}</div>
        <div class="facts">
          <span>${icon('book')}${book.format.toUpperCase()}${book.pageCount ? ` · ${book.pageCount} págs.` : ''} · ${fmtSize(book.fileSize)}</span>
          <span>${icon('clock')}${fmtDuration(st.total)} leído</span>
          <span>${icon('timer')}Última lectura: ${fmtRelative(book.lastOpenedAt)}</span>
          <span>${icon('plus')}Agregado el ${fmtDate(book.createdAt)}</span>
        </div>
        <div class="actions">
          <a class="btn btn-primary" href="#/leer/${book.id}">${icon('book')}${started ? 'Continuar' : 'Leer'}</a>
          <a class="btn" href="#/leer/${book.id}?tts=1">${icon('headphones')}Escuchar</a>
          <button class="btn" data-a="fav">${icon('star')}${book.favorite ? 'Quitar de favoritos' : 'Favorito'}</button>
          <button class="btn" data-a="finish">${icon('check')}${book.status === 'finished' ? 'Marcar como no terminado' : 'Marcar como terminado'}</button>
          <button class="btn btn-ghost" data-a="edit">${icon('edit')}Editar datos</button>
          <button class="btn btn-ghost" data-a="archive">${icon('archive')}${book.archived ? 'Desarchivar' : 'Archivar'}</button>
          <button class="btn btn-ghost btn-danger" data-a="delete">${icon('trash')}Eliminar</button>
        </div>
      </div>
    </div>
    <div class="tabs" role="tablist">
      <button class="active" data-tab="marks">Notas y fragmentos (${marks.length})</button>
      <button data-tab="stats">Estadísticas</button>
    </div>
    <div id="tab-body"></div>`;

  const body = el.querySelector('#tab-body');
  const showMarks = () => {
    body.innerHTML = `<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="btn btn-sm" id="add-note">${icon('note')}Nueva nota privada</button></div>` +
      (marks.length ? `<div class="marks">${marks.map(m => markCard(m, book, { showBook: false })).join('')}</div>`
        : `<div class="empty" style="padding:36px"><p style="margin:0">Todavía no hay notas ni fragmentos. Seleccioná texto mientras leés para guardar resaltados, fragmentos y notas.</p></div>`);
    bindMarkCards(body, marks, () => renderDetail(el, id, query));
    body.querySelector('#add-note').onclick = async () => {
      const r = await noteDialog({ title: 'Nueva nota privada' });
      if (r) { await createMark({ type: 'note', bookId: id, note: r.note }); renderDetail(el, id, query); }
    };
  };
  const showStats = () => {
    body.innerHTML = `<div class="kpis" style="margin-bottom:20px">
        <div class="kpi"><div class="v">${fmtDuration(st.total, true)}</div><div class="l">Tiempo total</div></div>
        <div class="kpi"><div class="v">${st.count}</div><div class="l">Sesiones</div></div>
        <div class="kpi"><div class="v">${fmtDuration(st.avg, true)}</div><div class="l">Promedio por sesión</div></div>
        <div class="kpi"><div class="v">${st.pages}</div><div class="l">${book.format === 'pdf' ? 'Páginas leídas' : 'Páginas aprox. leídas'}</div></div>
      </div>
      ${st.sessions.length ? `<h3 style="margin-bottom:10px">Historial de sesiones</h3><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Duración</th><th>Páginas</th></tr></thead><tbody>
        ${st.sessions.slice(0, 50).map(s => `<tr><td>${new Date(s.startedAt).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>${fmtDuration(s.duration)}</td><td>${s.pagesRead || 0}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Todavía no hay sesiones registradas para este libro.</p>'}`;
  };
  el.querySelectorAll('[data-tab]').forEach(t => t.addEventListener('click', () => {
    el.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === t));
    t.dataset.tab === 'marks' ? showMarks() : showStats();
  }));
  showMarks();

  el.querySelector('[data-a=fav]').onclick = async () => { await db.patch('books', id, { favorite: !book.favorite }); renderDetail(el, id, query); };
  el.querySelector('[data-a=finish]').onclick = async () => {
    const fin = book.status !== 'finished';
    await db.patch('books', id, fin ? { status: 'finished', progress: 1 } : { status: book.lastOpenedAt ? 'reading' : 'unread' });
    toast(fin ? '¡Felicitaciones por terminarlo!' : 'Marcado como no terminado.'); renderDetail(el, id, query);
  };
  el.querySelector('[data-a=edit]').onclick = async () => { if (await editBookDialog(book)) renderDetail(el, id, query); };
  el.querySelector('[data-a=archive]').onclick = async () => { await db.patch('books', id, { archived: !book.archived }); toast(book.archived ? 'Libro desarchivado.' : 'Libro archivado. Lo encontrás en el filtro Archivados.'); renderDetail(el, id, query); };
  el.querySelector('[data-a=delete]').onclick = async () => {
    if (await confirmDialog('¿Eliminar este libro?', `Se borrarán “${book.title}”, su archivo, su progreso, notas, fragmentos y estadísticas de este dispositivo.`, 'Eliminar', true)) {
      await deleteBook(id); toast('Libro eliminado.'); location.hash = '#/biblioteca';
    }
  };
  if (query.get('editar')) { history.replaceState(null, '', `#/libro/${id}`); if (await editBookDialog(book)) renderDetail(el, id, new URLSearchParams()); }
}

// =============== NOTAS Y FRAGMENTOS ===============
const marksState = { type: 'all', book: '', q: '' };
export async function renderMarks(el) {
  const [marks, books] = await Promise.all([db.all('marks'), db.all('books')]);
  const bookMap = new Map(books.map(b => [b.id, b]));
  const withMarks = books.filter(b => marks.some(m => m.bookId === b.id)).sort((a, b) => a.title.localeCompare(b.title, 'es'));
  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Estudio</div><h1>Notas y fragmentos</h1><p>Todo lo que resaltaste, guardaste y anotaste, en un solo lugar.</p></div>
      <button class="btn btn-primary" id="new-note">${icon('note')}Nueva nota</button></div>
    <div class="toolbar">
      <div class="search-box">${icon('search')}<input class="input" type="search" id="m-q" placeholder="Buscar en tus notas" value="${esc(marksState.q)}" /></div>
      <select class="input" id="m-book" style="width:auto;max-width:260px"><option value="">Todos los libros</option><option value="__free" ${marksState.book === '__free' ? 'selected' : ''}>Notas libres</option>${withMarks.map(b => `<option value="${b.id}" ${marksState.book === b.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select>
    </div>
    <div class="chips">${[['all', 'Todos'], ['highlight', 'Resaltados'], ['fragment', 'Fragmentos'], ['note', 'Notas']].map(([k, l]) => `<button class="chip ${marksState.type === k ? 'active' : ''}" data-t="${k}">${l} <span class="muted">${k === 'all' ? marks.length : marks.filter(m => m.type === k).length}</span></button>`).join('')}</div>
    <div id="m-list" style="margin-top:22px"></div>`;
  const list = el.querySelector('#m-list');
  const draw = () => {
    const q = normalize(marksState.q);
    const items = marks.filter(m => (marksState.type === 'all' || m.type === marksState.type)
      && (!marksState.book || (marksState.book === '__free' ? !m.bookId : m.bookId === marksState.book))
      && (!q || normalize(`${m.text} ${m.note} ${bookMap.get(m.bookId)?.title || ''}`).includes(q)))
      .sort((a, b) => b.createdAt - a.createdAt);
    list.innerHTML = items.length ? `<div class="marks">${items.map(m => markCard(m, bookMap.get(m.bookId))).join('')}</div>`
      : `<div class="empty"><div class="ill">${icon('highlight')}</div><h2>${marks.length ? 'Nada por aquí' : 'Empezá a estudiar'}</h2><p>${marks.length ? 'No hay elementos con esos filtros.' : 'Mientras leés, seleccioná texto para resaltarlo, guardarlo como fragmento o escribir una nota.'}</p></div>`;
    bindMarkCards(list, items, () => renderMarks(el));
  };
  draw();
  el.querySelector('#m-q').addEventListener('input', e => { marksState.q = e.target.value; draw(); });
  el.querySelector('#m-book').addEventListener('change', e => { marksState.book = e.target.value; draw(); });
  el.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { marksState.type = b.dataset.t; el.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('active', x === b)); draw(); }));
  el.querySelector('#new-note').onclick = async () => {
    const r = await noteDialog({ title: 'Nueva nota', books: books.filter(b => !b.archived).sort((a, b) => a.title.localeCompare(b.title, 'es')) });
    if (r) { await createMark({ type: 'note', bookId: r.bookId || null, note: r.note }); toast('Nota guardada.'); renderMarks(el); }
  };
}

// =============== ESTADÍSTICAS ===============
export async function renderStats(el) {
  const s = await computeStats();
  const max = Math.max(1, ...s.last14.map(d => d.ms));
  const wd = new Intl.DateTimeFormat('es', { weekday: 'narrow' });
  const perBook = new Map();
  for (const ss of s.sessionsList) perBook.set(ss.bookId, (perBook.get(ss.bookId) || 0) + (ss.duration || 0));
  const ranked = s.books.filter(b => perBook.get(b.id)).sort((a, b) => perBook.get(b.id) - perBook.get(a.id));
  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Progreso</div><h1>Estadísticas de lectura</h1><p>Tu ritmo, tus hábitos y tus libros.</p></div></div>
    <div class="kpis">
      <div class="kpi"><div class="v">${fmtDuration(s.total, true)}</div><div class="l">Tiempo total leído</div></div>
      <div class="kpi"><div class="v">${fmtDuration(s.today, true)}</div><div class="l">Hoy</div></div>
      <div class="kpi"><div class="v">${fmtDuration(s.week, true)}</div><div class="l">Esta semana</div></div>
      <div class="kpi"><div class="v">${fmtDuration(s.month, true)}</div><div class="l">Este mes</div></div>
      <div class="kpi"><div class="v">${fmtDuration(s.avgDaily, true)}</div><div class="l">Promedio diario (30 días)</div></div>
      <div class="kpi"><div class="v">${s.sessions}</div><div class="l">Sesiones</div></div>
      <div class="kpi"><div class="v">${s.pages}</div><div class="l">Páginas leídas</div></div>
      <div class="kpi"><div class="v">${s.streak}</div><div class="l">Racha actual (días)</div></div>
    </div>
    <section class="section"><div class="section-head"><h2>Últimos 14 días</h2><span class="small muted">minutos por día</span></div>
      <div class="bars">${s.last14.map((d, i) => `<div class="bar ${i === 13 ? 'today' : ''}" title="${new Date(d.day).toLocaleDateString('es')} · ${fmtDuration(d.ms)}"><i style="height:${Math.round((d.ms / max) * 100)}%"></i><span>${wd.format(new Date(d.day)).toUpperCase()}</span></div>`).join('')}</div></section>
    <section class="section"><div class="section-head"><h2>Biblioteca</h2></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${s.finished}</div><div class="l">Terminados</div></div>
        <div class="kpi"><div class="v">${s.reading}</div><div class="l">En curso</div></div>
        <div class="kpi"><div class="v">${s.unread}</div><div class="l">Sin empezar</div></div>
        <div class="kpi"><div class="v">${pct(s.avgProgress)}</div><div class="l">Completado en promedio</div></div>
      </div></section>
    <section class="section"><div class="section-head"><h2>Por libro</h2></div>
      ${ranked.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Libro</th><th>Tiempo</th><th>Progreso</th><th>Estado</th></tr></thead><tbody>
        ${ranked.map(b => `<tr><td><a href="#/libro/${b.id}" style="font-weight:600">${esc(b.title)}</a></td><td>${fmtDuration(perBook.get(b.id))}</td><td style="min-width:120px">${progressRow(b)}</td><td><span class="status-pill ${b.status}">${STATUS_LABEL[b.status]}</span></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Cuando empieces a leer, vas a ver aquí el tiempo dedicado a cada libro.</p>'}</section>`;
}

// =============== CONFIGURACIÓN ===============
export async function renderSettings(el) {
  const s = settings();
  const voices = await tts.voices();
  let usage = '';
  try { const e = await navigator.storage.estimate(); usage = `${fmtSize(e.usage)} usados de ${fmtSize(e.quota)} disponibles`; } catch {}
  const sw = (name, on) => `<label class="switch"><input type="checkbox" data-k="${name}" ${on ? 'checked' : ''}><span></span></label>`;
  const sel = (name, opts, val) => `<select class="input" data-k="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(val) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  el.innerHTML = `
    <div class="page-head"><div><div class="eyebrow">Ajustes</div><h1>Configuración</h1></div></div>
    <div class="settings">
      <section class="card"><h2>Apariencia y lectura</h2>
        <div class="row"><div class="lbl"><b>Tema de la aplicación</b><span>Colores de la biblioteca y menús</span></div>${sel('appTheme', [['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Según el sistema']], s.appTheme)}</div>
        <div class="row"><div class="lbl"><b>Tema de lectura</b><span>Fondo del libro mientras leés</span></div>${sel('readerTheme', [['light', 'Claro'], ['sepia', 'Sepia'], ['dark', 'Oscuro']], s.readerTheme)}</div>
        <div class="row"><div class="lbl"><b>Tamaño de letra (EPUB)</b><span>${s.fontSize}%</span></div><input type="range" min="70" max="200" step="10" value="${s.fontSize}" data-k="fontSize" data-num></div>
        <div class="row"><div class="lbl"><b>Interlineado (EPUB)</b></div>${sel('lineHeight', [[1.3, 'Compacto'], [1.6, 'Normal'], [1.9, 'Amplio'], [2.2, 'Muy amplio']], s.lineHeight)}</div>
        <div class="row"><div class="lbl"><b>Tipografía (EPUB)</b></div>${sel('fontFamily', [['publisher', 'La del libro'], ['literata', 'Literata'], ['serif', 'Serif clásica'], ['sans', 'Sans serif']], s.fontFamily)}</div>
        <div class="row"><div class="lbl"><b>Modo de lectura EPUB</b><span>Pasar páginas o desplazamiento continuo</span></div>${sel('epubFlow', [['paginated', 'Páginas'], ['scrolled', 'Desplazamiento']], s.epubFlow)}</div>
        <div class="row"><div class="lbl"><b>Zoom inicial de PDF</b></div>${sel('pdfZoom', [['width', 'Ajustar al ancho'], [1, '100%'], [1.25, '125%'], [1.5, '150%']], s.pdfZoom)}</div>
      </section>
      <section class="card"><h2>Pantalla</h2>
        <div class="row"><div class="lbl"><b>Mantener pantalla encendida</b><span>Mientras leés o escuchás un libro${'wakeLock' in navigator ? '' : ' (tu navegador no lo admite)'}</span></div>${sw('keepAwake', s.keepAwake)}</div>
        <div class="row"><div class="lbl"><b>Apagado inteligente</b><span>Deja apagar la pantalla tras un tiempo sin actividad (salvo durante la lectura en voz alta)</span></div>${sel('smartTimeout', [[0, 'Desactivado'], [5, '5 min'], [15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min']], s.smartTimeout)}</div>
      </section>
      <section class="card"><h2>Voz</h2>
        <div class="row"><div class="lbl"><b>Voz</b><span>${voices.length ? `${voices.length} voces disponibles en este dispositivo` : 'Tu navegador no ofrece voces'}</span></div>
          <select class="input" data-k="ttsVoice" style="max-width:260px"><option value="">Automática (español)</option>${voices.map(v => `<option value="${esc(v.voiceURI)}" ${s.ttsVoice === v.voiceURI ? 'selected' : ''}>${esc(v.name)} — ${esc(v.lang)}</option>`).join('')}</select></div>
        <div class="row"><div class="lbl"><b>Velocidad</b><span>${s.ttsRate.toFixed(2)}×</span></div><input type="range" min="0.5" max="2.5" step="0.05" value="${s.ttsRate}" data-k="ttsRate" data-num></div>
        <div class="row"><div class="lbl"><b>Probar voz</b></div><button class="btn btn-sm" id="tts-test">${icon('play')}Escuchar ejemplo</button></div>
      </section>
      <section class="card"><h2>Biblioteca</h2>
        <div class="row"><div class="lbl"><b>Vista</b></div>${sel('libraryView', [['grid', 'Cuadrícula'], ['list', 'Lista']], s.libraryView)}</div>
        <div class="row"><div class="lbl"><b>Orden</b></div>${sel('librarySort', SORTS, s.librarySort)}</div>
      </section>
      <section class="card"><h2>Cuenta y datos</h2>
        <div class="row"><div class="lbl"><b>Almacenamiento local</b><span>${usage || 'Tus libros y notas se guardan en este navegador.'}</span></div></div>
        <div class="row"><div class="lbl"><b>Copia de seguridad</b><span>Descargá un archivo con tus libros, progreso, notas, fragmentos, estadísticas y ajustes. Usalo para pasar todo a otro dispositivo.</span></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-sm" id="bk-full">${icon('download')}Completa</button><button class="btn btn-sm btn-ghost" id="bk-light">Solo datos</button></div></div>
        <div class="row"><div class="lbl"><b>Restaurar copia</b><span>Importa un archivo .zip creado con MiLibroPDF. Se combina con lo que ya tenés.</span></div><label class="btn btn-sm">${icon('upload')}Restaurar<input type="file" accept=".zip" id="bk-in" hidden></label></div>
        <div class="row"><div class="lbl"><b>Sincronización en la nube</b><span>Las cuentas con inicio de sesión y la sincronización automática entre dispositivos llegan en la próxima versión.</span></div><span class="status-pill">Próximamente</span></div>
        <div class="row"><div class="lbl"><b>Borrar todo</b><span>Elimina libros, notas y estadísticas de este dispositivo</span></div><button class="btn btn-sm btn-ghost btn-danger" id="wipe">${icon('trash')}Borrar</button></div>
      </section>
      <section class="card"><h2>Atajos de teclado</h2>
        <div class="row"><div class="lbl"><b>← / →</b></div><span class="muted">Página anterior / siguiente</span></div>
        <div class="row"><div class="lbl"><b>Espacio</b></div><span class="muted">Pausar o continuar la voz</span></div>
        <div class="row"><div class="lbl"><b>F</b></div><span class="muted">Pantalla completa</span></div>
        <div class="row"><div class="lbl"><b>N</b></div><span class="muted">Nueva nota</span></div>
      </section>
      <p class="small muted" style="text-align:center">MiLibroPDF Web · v1.0 · Hecho por Zenix AR</p>
    </div>`;

  el.querySelectorAll('[data-k]').forEach(input => {
    const ev = input.type === 'range' ? 'input' : 'change';
    input.addEventListener(ev, async () => {
      let v = input.type === 'checkbox' ? input.checked : input.value;
      if (input.dataset.num || ['lineHeight', 'smartTimeout'].includes(input.dataset.k)) v = Number(v);
      if (input.dataset.k === 'pdfZoom' && v !== 'width') v = Number(v);
      await saveSettings({ [input.dataset.k]: v });
      const lbl = input.closest('.row')?.querySelector('.lbl span');
      if (input.dataset.k === 'fontSize') lbl.textContent = `${v}%`;
      if (input.dataset.k === 'ttsRate') lbl.textContent = `${Number(v).toFixed(2)}×`;
    });
  });
  el.querySelector('#tts-test').onclick = () => tts.sample('Hola. Esta es la voz que te va a leer tus libros en MiLibroPDF.');
  el.querySelector('#bk-full').onclick = () => exportBackup({ includeFiles: true });
  el.querySelector('#bk-light').onclick = () => exportBackup({ includeFiles: false });
  el.querySelector('#bk-in').onchange = async e => { const f = e.target.files[0]; if (f) { await importBackup(f); renderSettings(el); } };
  el.querySelector('#wipe').onclick = async () => {
    if (await confirmDialog('¿Borrar todo?', 'Se eliminarán todos tus libros, notas, fragmentos, estadísticas y ajustes de este dispositivo. Te recomendamos descargar una copia de seguridad antes.', 'Borrar todo', true)) {
      for (const st of ['books', 'files', 'marks', 'sessions', 'settings']) await db.clear(st);
      location.reload();
    }
  };
}

export { MARK_COLORS };
