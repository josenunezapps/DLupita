// Zenix Cotiza — presupuestos profesionales. Shell, rutas y vistas.
import * as S from './store.js';
import { fmt, esc, DAY, debounce, download, parseMoney, encodeShare, decodeShare, toCSV } from './util.js';
import { docHTML } from './doc.js';
import { grouped } from './charts.js';

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  doc: '<path d="M14 2.5H6.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V7.5z"/><path d="M14 2.5v5h5M9 13h6M9 17h6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>',
  box: '<path d="m21 7.5-9-5-9 5 9 5 9-5Z"/><path d="M3 7.5v9l9 5 9-5v-9M12 12.5v9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', share: '<path d="M4 12v7.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V12M16 6l-4-3.5L8 6M12 2.5V15"/>',
  print: '<path d="M6 9V2.5h12V9"/><rect x="2.5" y="9" width="19" height="8" rx="2"/><path d="M6 14h12v7.5H6z"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V4.5A1.5 1.5 0 0 0 14.5 3h-10A1.5 1.5 0 0 0 3 4.5v10A1.5 1.5 0 0 0 4.5 16H8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  dup: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V4.5A1.5 1.5 0 0 0 14.5 3h-10A1.5 1.5 0 0 0 3 4.5v10A1.5 1.5 0 0 0 4.5 16H8M14.5 11.5v6M11.5 14.5h6"/>',
  wa: '<path d="M3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 8 19.5z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1.2-1 .9c-1-.4-2.2-1.6-2.6-2.6l.9-1-1.2-2z"/>',
  eye: '<path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/>', upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M4 17v3h16v-3"/>',
  up: '<path d="m6 15 6-6 6 6"/>', link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
};
const icon = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NAV = [['inicio', 'Inicio', 'home'], ['presupuestos', 'Presupuestos', 'doc'], ['clientes', 'Clientes', 'users'], ['catalogo', 'Catálogo', 'box'], ['ajustes', 'Ajustes', 'gear']];
const chip = st => `<span class="chip ${S.STATUS[st].tone}">${S.STATUS[st].label}</span>`;
const isMobile = () => matchMedia('(max-width: 900px)').matches;

// ---------- shell ----------
let current = null;
function shell() {
  document.body.innerHTML = `
  <header class="top">
    <a class="brand" href="#/inicio"><span class="logo">${logo()}</span><span><b>Zenix</b> Cotiza</span></a>
    <nav class="nav">${NAV.map(([id, l, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <div class="top-r">
      <button class="icon-btn" id="themeBtn" aria-label="Cambiar tema"></button>
      <button class="btn primary" data-new>${icon('plus')}<span>Nuevo presupuesto</span></button>
    </div>
  </header>
  <main id="view"></main>
  <nav class="tabbar">${NAV.map(([id, l, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
  <div id="modals"></div><div id="toasts" aria-live="polite"></div><div id="print-area"></div>`;
  $('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('zenix-cotiza:theme', t); } catch {} paintTheme(); };
  paintTheme();
}
function paintTheme() { const b = $('#themeBtn'); if (b) b.innerHTML = icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon'); }
const logo = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="var(--ink)"/><path d="M12 9.5h12l4 4V30a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 12 30z" fill="none" stroke="var(--bg)" stroke-width="2.4" stroke-linejoin="round"/><path d="M16.5 17h7l-7 8h7.5" fill="none" stroke="#a78bfa" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

document.addEventListener('click', e => {
  if (e.target.closest('[data-new]')) { const q = S.newQuote(e.target.closest('[data-new]').dataset.new || null); location.hash = '#/p/' + q.id; }
});

// ---------- toasts y modales ----------
function toast(msg, type = 'ok') {
  const el = document.createElement('div'); el.className = 'toast ' + type;
  el.innerHTML = `${icon(type === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 4000 : 2400);
}
const stack = [];
function modal({ title, body, foot = '', size = '', onMount, onClose }) {
  const w = document.createElement('div'); w.className = 'mw';
  w.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></header><div class="mb">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
  $('#modals').appendChild(w);
  const close = () => { if (!w.isConnected) return; w.classList.remove('in'); stack.splice(stack.indexOf(close), 1); setTimeout(() => w.remove(), 180); onClose?.(); };
  w.addEventListener('mousedown', e => { if (e.target === w) close(); });
  $$('[data-close]', w).forEach(b => b.onclick = close);
  stack.push(close); requestAnimationFrame(() => w.classList.add('in'));
  onMount?.(w, close);
  setTimeout(() => ($('[autofocus]', w) || $('input,textarea,select', w))?.focus(), 40);
  return close;
}
function confirmBox(title, text, ok = 'Confirmar', danger = false) {
  return new Promise(res => {
    let done = false;
    modal({ title, size: 'sm', body: `<p class="muted">${text}</p>`, foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(ok)}</button>`,
      onMount: (w, close) => { $('#cfOk', w).onclick = () => { done = true; res(true); close(); }; }, onClose: () => !done && res(false) });
  });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1](); });

// ---------- router ----------
const VIEWS = {};
async function route() {
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  while (stack.length) stack[stack.length - 1]();
  current?.destroy?.();
  if (id === 'ver') return publicView(arg);
  if (!$('.top')) shell();
  const v = VIEWS[id] ? id : 'inicio';
  document.body.dataset.view = v;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === v || (v === 'p' && a.dataset.nav === 'presupuestos')));
  const old = $('#view'), root = old.cloneNode(false); old.replaceWith(root);
  current = VIEWS[v](root, arg) || {};
  document.title = (current.title || 'Zenix Cotiza') + ' · Zenix Cotiza';
  window.scrollTo(0, 0);
}
S.subscribe(() => current?.update?.());

const pageHead = (title, sub, actions = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="ph-a">${actions}</div></div>`;

// =====================================================================
// INICIO
// =====================================================================
VIEWS.inicio = root => {
  const draw = () => {
    const st = S.get(), d = S.dashboard();
    const monthName = new Date().toLocaleDateString('es-AR', { month: 'long' });
    const events = st.quotes.flatMap(q => q.history.slice(1).map(h => ({ ...h, q }))).sort((a, b) => b.ts - a.ts).slice(0, 7);
    const best = st.clients.map(c => ({ c, ...S.clientStats(c.id) })).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5);
    const bestMax = Math.max(1, ...best.map(b => b.amount));
    const verb = { sent: 'Enviaste', accepted: 'Aceptaron', rejected: 'Rechazaron', draft: 'Volviste a borrador' };
    root.innerHTML = `
    ${pageHead(`Hola${st.company.name ? ', ' + esc(st.company.name.split(/[—–-]/)[0].trim()) : ''}`, `Así vienen tus presupuestos en ${monthName}.`)}
    <section class="kpis">
      <div class="card kpi"><span>Presupuestado en ${monthName}</span><b>${fmt.money(d.monthIssued)}</b><small>${d.monthCount} ${d.monthCount === 1 ? 'presupuesto enviado' : 'presupuestos enviados'}</small></div>
      <div class="card kpi"><span>Ganado en ${monthName}</span><b>${fmt.money(d.monthWon)}</b><small>de lo enviado este mes</small></div>
      <div class="card kpi accent"><span>Tasa de cierre</span><b>${fmt.pct(d.winRate)}</b><div class="bar"><i style="width:${d.winRate * 100}%"></i></div><small>${d.won} aceptados de ${d.decided} resueltos${d.avgDays ? ` · deciden en ~${Math.round(d.avgDays)} días` : ''}</small></div>
      <div class="card kpi"><span>En juego ahora</span><b>${fmt.money(d.openAmount)}</b><small>${d.openCount} esperando respuesta${d.drafts ? ` · ${d.drafts} en borrador` : ''}</small></div>
    </section>
    <section class="g21">
      <div class="card">
        <div class="ch"><h3>Últimos 6 meses</h3><div class="lg"><span><i class="s1"></i>Enviado</span><span><i class="s2"></i>Ganado</span></div></div>
        ${grouped(d.months.map(m => ({ ...m, label: new Date(m.ts).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '') })), [{ key: 'issued', label: 'Enviado', cls: 's1' }, { key: 'won', label: 'Ganado', cls: 's2' }])}
      </div>
      <div class="card">
        <div class="ch"><h3>Por vencer</h3><span class="muted small">próximos 4 días</span></div>
        <ul class="list">${d.soon.map(x => { const left = Math.ceil((S.expiresAt(x.q) - Date.now()) / DAY); const cl = S.clientById(x.q.clientId); return `<li><a href="#/p/${x.q.id}"><div><b>${esc(cl?.name || 'Sin cliente')}</b><small>${esc(x.q.title || S.quoteNumber(x.q))}</small></div><span class="r"><b>${fmt.money(x.total)}</b><small class="${left <= 1 ? 'red' : 'amber'}">${left <= 0 ? 'vence hoy' : `vence en ${left} ${left === 1 ? 'día' : 'días'}`}</small></span></a></li>`; }).join('') || `<li class="empty">Nada por vencer. Buen momento para hacer seguimiento a los enviados.</li>`}</ul>
      </div>
    </section>
    <section class="g2">
      <div class="card">
        <div class="ch"><h3>Actividad reciente</h3><a class="link" href="#/presupuestos">Ver todos</a></div>
        <ul class="feed">${events.map(e => { const cl = S.clientById(e.q.clientId); return `<li><span class="dot ${S.STATUS[e.status].tone}"></span><a href="#/p/${e.q.id}"><b>${verb[e.status] || ''}</b> ${e.status === 'sent' ? 'a' : ''} ${esc(cl?.name || '')} · ${esc(e.q.title || S.quoteNumber(e.q))}</a><time>${relTime(e.ts)}</time></li>`; }).join('') || '<li class="empty">Todavía no hay actividad.</li>'}</ul>
      </div>
      <div class="card">
        <div class="ch"><h3>Mejores clientes</h3><span class="muted small">por monto aceptado</span></div>
        <ul class="rank">${best.map((b, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(b.c.name)}</b><div class="bar"><i style="width:${b.amount / bestMax * 100}%"></i></div></div><span class="r"><b>${fmt.money(b.amount)}</b><small>${b.accepted} de ${b.count}</small></span></li>`).join('') || '<li class="empty">Cuando te acepten presupuestos, tus mejores clientes aparecen acá.</li>'}</ul>
      </div>
    </section>`;
  };
  draw();
  return { update: draw, title: 'Inicio' };
};

function relTime(ts) {
  const m = Math.round((Date.now() - ts) / 6e4);
  if (m < 60) return m <= 1 ? 'recién' : `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24); if (d < 7) return d === 1 ? 'ayer' : `hace ${d} días`;
  return fmt.dateShort(ts);
}

// =====================================================================
// LISTA DE PRESUPUESTOS
// =====================================================================
VIEWS.presupuestos = root => {
  const f = { st: 'all', q: '' };
  root.innerHTML = `
    ${pageHead('Presupuestos', '', `<button class="btn ghost" id="exp">${icon('download')}<span class="hide-sm">Exportar</span></button>`)}
    <div class="toolbar">
      <div class="seg" id="fst"><button data-s="all">Todos</button>${Object.entries(S.STATUS).map(([k, v]) => `<button data-s="${k}">${v.label}<em></em></button>`).join('')}</div>
      <label class="search">${icon('search')}<input id="fq" placeholder="Cliente, proyecto o número"></label>
    </div>
    <div class="card flush"><div class="tw"><table class="table"><thead><tr><th>Número</th><th>Cliente y proyecto</th><th>Fecha</th><th>Estado</th><th class="r">Total</th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const rows = () => S.get().quotes.map(q => ({ q, st: S.statusOf(q), cl: S.clientById(q.clientId), t: S.calc(q).total })).sort((a, b) => b.q.date - a.q.date);
  const draw = () => {
    const all = rows(), term = f.q.trim().toLowerCase();
    $$('#fst button').forEach(b => { b.classList.toggle('on', b.dataset.s === f.st); const em = $('em', b); if (em) em.textContent = all.filter(x => x.st === b.dataset.s).length; });
    const list = all.filter(x => (f.st === 'all' || x.st === f.st) && (!term || (x.cl?.name || '').toLowerCase().includes(term) || (x.q.title || '').toLowerCase().includes(term) || S.quoteNumber(x.q).includes(term) || String(x.q.n) === term));
    $('#tb').innerHTML = list.map(x => `<tr data-go="${x.q.id}" tabindex="0">
      <td class="num">${S.quoteNumber(x.q)}</td>
      <td><b>${esc(x.cl?.name || 'Sin cliente')}</b><small class="muted block">${esc(x.q.title || `${x.q.items.length} ítems`)}</small></td>
      <td class="nowrap">${fmt.date(x.q.date)}${x.st === 'sent' ? `<small class="muted block">vence ${fmt.dateShort(S.expiresAt(x.q) - DAY)}</small>` : ''}</td>
      <td>${chip(x.st)}</td><td class="r num"><b>${fmt.money(x.t)}</b></td></tr>`).join('') || `<tr><td colspan="5"><div class="empty">${icon('doc')}<p>${all.length ? 'No hay presupuestos con ese filtro.' : 'Todavía no hiciste ningún presupuesto.'}</p><button class="btn primary" data-new>${icon('plus')} Crear el primero</button></div></td></tr>`;
  };
  draw();
  $('#fst').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { f.st = b.dataset.s; draw(); } };
  $('#fq').oninput = debounce(e => { f.q = e.target.value; draw(); }, 80);
  root.addEventListener('click', e => { const tr = e.target.closest('[data-go]'); if (tr) location.hash = '#/p/' + tr.dataset.go; });
  root.addEventListener('keydown', e => { const tr = e.target.closest?.('[data-go]'); if (tr && e.key === 'Enter') location.hash = '#/p/' + tr.dataset.go; });
  $('#exp').onclick = () => {
    const r = [['numero', 'fecha', 'cliente', 'proyecto', 'estado', 'neto', 'iva', 'total'], ...rows().map(x => { const c = S.calc(x.q); return [S.quoteNumber(x.q), fmt.date(x.q.date), x.cl?.name || '', x.q.title, S.STATUS[x.st].label, c.base, c.iva, c.total]; })];
    download(`presupuestos-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(r), 'text/csv'); toast('Presupuestos exportados');
  };
  return { update: draw, title: 'Presupuestos' };
};

// =====================================================================
// EDITOR
// =====================================================================
VIEWS.p = (root, id) => {
  const q = S.quoteById(id);
  if (!q) { root.innerHTML = `<div class="empty big">${icon('doc')}<p>Ese presupuesto no existe o fue eliminado.</p><a class="btn primary" href="#/presupuestos">Volver a la lista</a></div>`; return { title: 'No encontrado' }; }
  const st = S.get();
  const ri = () => S.discriminaIVA();
  root.innerHTML = `
  <div class="ed">
    <div class="ed-bar">
      <a href="#/presupuestos" class="icon-btn" aria-label="Volver">${icon('back')}</a>
      <div class="ed-t"><b class="num">${S.quoteNumber(q)}</b><span id="edSt"></span><small class="muted" id="saved">Guardado</small></div>
      <div class="seg mob-tabs" id="mtabs"><button data-t="form" class="on">Editar</button><button data-t="prev">Vista previa</button></div>
      <div class="ed-a">
        <button class="btn ghost" id="pdfBtn">${icon('print')}<span class="hide-sm">PDF</span></button>
        <button class="btn primary" id="shareBtn">${icon('share')}<span class="hide-sm">Enviar</span></button>
        <button class="icon-btn" id="moreBtn" aria-label="Más acciones">${icon('more')}</button>
        <div class="menu" id="menu" hidden>
          <button data-st="sent">${icon('share')} Marcar como enviado</button>
          <button data-st="accepted">${icon('check')} Marcar como aceptado</button>
          <button data-st="rejected">${icon('x')} Marcar como rechazado</button>
          <button data-st="draft">${icon('edit')} Volver a borrador</button>
          <hr><button id="dupBtn">${icon('dup')} Duplicar</button><button id="delBtn" class="danger">${icon('trash')} Eliminar</button>
        </div>
      </div>
    </div>
    <div class="ed-body" data-tab="form">
      <form class="ed-form" id="f" autocomplete="off" onsubmit="return false">
        <section class="card">
          <div class="ch"><h3>Cliente</h3><button type="button" class="link" id="newCl">+ Nuevo cliente</button></div>
          <select name="clientId" id="clSel"><option value="">Elegí un cliente…</option>${st.clients.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map(c => `<option value="${c.id}" ${c.id === q.clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <div class="fg3">
            <label class="field s3"><span>Proyecto o título</span><input name="title" value="${esc(q.title)}" placeholder="Ej.: Sitio web institucional"></label>
            <label class="field"><span>Fecha</span><input type="date" name="date" value="${new Date(q.date - new Date(q.date).getTimezoneOffset() * 6e4).toISOString().slice(0, 10)}"></label>
            <label class="field"><span>Validez (días)</span><input type="number" name="validity" min="1" value="${q.validity}"></label>
            <label class="field"><span>Plazo de entrega</span><input name="delivery" value="${esc(q.delivery)}" placeholder="Ej.: 15 días hábiles"></label>
          </div>
        </section>
        <section class="card">
          <div class="ch"><h3>Ítems</h3><span class="muted small" id="itCount"></span></div>
          <div id="items"></div>
          <datalist id="cat">${st.catalog.map(c => `<option value="${esc(c.name)}">${fmt.money(c.price)} / ${esc(c.unit)}</option>`).join('')}</datalist>
          <div class="it-add">
            <button type="button" class="btn ghost" id="addIt">${icon('plus')} Agregar ítem</button>
            <button type="button" class="btn ghost" id="fromCat">${icon('box')} Desde el catálogo</button>
          </div>
          <div class="totals" id="tots"></div>
        </section>
        <section class="card">
          <div class="ch"><h3>Condiciones</h3></div>
          <div class="fg1">
            <label class="field"><span>Forma de pago</span><textarea name="payment" rows="2">${esc(q.payment)}</textarea></label>
            <label class="field"><span>Condiciones generales</span><textarea name="terms" rows="3">${esc(q.terms)}</textarea></label>
            <label class="field"><span>Observaciones para el cliente</span><textarea name="notes" rows="2" placeholder="Opcional">${esc(q.notes)}</textarea></label>
          </div>
        </section>
        <section class="card hist"><div class="ch"><h3>Historial</h3></div><ol id="hist"></ol></section>
      </form>
      <div class="ed-prev"><div class="paper-wrap" id="pw"><div class="paper" id="paper"></div></div></div>
    </div>
  </div>`;

  const form = $('#f'), paper = $('#paper');
  const preview = () => {
    paper.innerHTML = docHTML({ company: S.get().company, client: S.clientById(q.clientId), quote: q, number: S.quoteNumber(q) });
    fit();
  };
  const fit = () => { const pw = $('#pw'); if (!pw) return; const s = Math.min(1, (pw.clientWidth - 2) / 794); paper.style.setProperty('--s', s); pw.style.height = (paper.firstElementChild?.offsetHeight || 1123) * s + 'px'; };
  const ro = new ResizeObserver(fit); ro.observe($('#pw'));

  const header = () => {
    $('#edSt').innerHTML = chip(S.statusOf(q));
    $('#hist').innerHTML = q.history.slice().reverse().map(h => `<li><span class="dot ${S.STATUS[h.status].tone}"></span><b>${S.STATUS[h.status].label}</b><time>${fmt.dateTime(h.ts)}</time></li>`).join('');
  };
  let savedT;
  const saved = () => { const el = $('#saved'); el.textContent = 'Guardando…'; clearTimeout(savedT); savedT = setTimeout(() => { el.textContent = 'Guardado'; }, 500); };
  const touch = patch => { S.updateQuote(q.id, patch); saved(); schedule(); };
  const schedule = debounce(() => { preview(); totalsKeepFocus(); }, 90);

  const itemRow = (it, i) => `
    <div class="it" data-i="${it.id}">
      <span class="it-n">${i + 1}</span>
      <label class="field it-d"><span>Descripción</span><input list="cat" data-k="desc" value="${esc(it.desc)}" placeholder="Producto o servicio"></label>
      <label class="field it-q"><span>Cant.</span><input data-k="qty" inputmode="decimal" value="${it.qty}"></label>
      <label class="field it-u"><span>Unidad</span><input data-k="unit" value="${esc(it.unit)}"></label>
      <label class="field it-p"><span>Precio unit.</span><div class="money"><i>$</i><input data-k="price" inputmode="decimal" value="${it.price}"></div></label>
      <label class="field it-b"><span>Bonif. %</span><input data-k="disc" inputmode="decimal" value="${it.disc || ''}" placeholder="0"></label>
      ${ri() ? `<label class="field it-v"><span>IVA</span><select data-k="iva">${S.IVA_RATES.map(r => `<option value="${r}" ${+it.iva === r ? 'selected' : ''}>${fmt.num(r)}%</option>`).join('')}</select></label>` : ''}
      <div class="it-t"><span>Importe</span><b class="num" data-tot></b></div>
      <button type="button" class="icon-btn sm it-x" data-rm aria-label="Quitar ítem">${icon('trash')}</button>
    </div>`;
  const items = () => {
    $('#items').innerHTML = q.items.map(itemRow).join('') || `<div class="empty">${icon('box')}<p>Agregá productos o servicios. Si escribís el nombre de algo del catálogo, se completa solo.</p></div>`;
    $('#itCount').textContent = q.items.length ? `${q.items.length} ${q.items.length === 1 ? 'ítem' : 'ítems'}` : '';
    totals();
  };
  const totals = () => {
    const t = S.calc(q);
    t.lines.forEach(l => { const el = $(`.it[data-i="${l.id}"] [data-tot]`); if (el) el.textContent = fmt.money(l.net); });
    $('#tots').innerHTML = `
      <label class="gdisc"><span>Descuento general</span><div class="pct"><input id="gd" inputmode="decimal" value="${q.discount || ''}" placeholder="0"><i>%</i></div></label>
      <dl>
        <dt>Subtotal</dt><dd class="num">${fmt.moneyExact(t.subtotal)}</dd>
        ${t.discAmt ? `<dt>Descuento</dt><dd class="num green">−${fmt.moneyExact(t.discAmt)}</dd>` : ''}
        ${t.ri ? Object.keys(t.ivaBy).sort((a, b) => b - a).map(r => `<dt>IVA ${fmt.num(+r)}%</dt><dd class="num">${fmt.moneyExact(t.ivaBy[r])}</dd>`).join('') : ''}
        <dt class="grand">Total</dt><dd class="grand num">${fmt.moneyExact(t.total)}</dd>
      </dl>`;
    const gd = $('#gd'); gd.oninput = () => { touch({ discount: parseMoney(gd.value) }); };
  };
  // mantener el foco del descuento general al re-dibujar los totales
  const totalsKeepFocus = () => { const a = document.activeElement; const had = a?.id === 'gd'; const pos = had ? a.selectionStart : 0; totals(); if (had) { const g = $('#gd'); g.focus(); try { g.setSelectionRange(pos, pos); } catch {} } };

  form.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'gd') return;
    const row = el.closest('.it');
    if (row) {
      const it = q.items.find(x => x.id === row.dataset.i); const k = el.dataset.k;
      if (k === 'desc') {
        it.desc = el.value;
        const c = S.get().catalog.find(x => x.name === el.value);
        if (c) { it.unit = c.unit; it.price = c.price; it.iva = c.iva; $('[data-k=unit]', row).value = c.unit; $('[data-k=price]', row).value = c.price; const iv = $('[data-k=iva]', row); if (iv) iv.value = c.iva; }
      } else if (k === 'unit') it.unit = el.value;
      else if (k === 'iva') it.iva = +el.value;
      else it[k] = parseMoney(el.value);
      touch({ items: q.items });
      return;
    }
    const name = el.name; if (!name) return;
    if (name === 'date') { const [y, m, d] = el.value.split('-').map(Number); if (y) touch({ date: new Date(y, m - 1, d, 12).getTime() }); header(); }
    else if (name === 'validity') { touch({ validity: Math.max(1, parseInt(el.value, 10) || 1) }); header(); }
    else if (name === 'clientId') { touch({ clientId: el.value || null }); }
    else touch({ [name]: el.value });
  });
  form.addEventListener('change', e => { if (e.target.name === 'clientId') { touch({ clientId: e.target.value || null }); } });

  const addItem = (data = {}) => {
    q.items.push({ id: Math.random().toString(36).slice(2, 9), desc: '', qty: 1, unit: 'u.', price: 0, disc: 0, iva: 21, ...data });
    S.updateQuote(q.id, { items: q.items }); saved(); items(); preview();
    const last = $$('.it').pop(); if (last && !data.desc) $('[data-k=desc]', last).focus();
    last?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  $('#addIt').onclick = () => addItem();
  $('#fromCat').onclick = () => catalogPicker(c => addItem({ desc: c.name, unit: c.unit, price: c.price, iva: c.iva }));
  $('#items').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'); if (!rm) return;
    const row = rm.closest('.it'); q.items = q.items.filter(x => x.id !== row.dataset.i);
    S.updateQuote(q.id, { items: q.items }); saved(); items(); preview();
  });
  $('#newCl').onclick = () => clientForm(null, c => {
    const sel = $('#clSel'); sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`); sel.value = c.id; touch({ clientId: c.id });
  });

  // acciones
  const menu = $('#menu');
  $('#moreBtn').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  const closeMenu = e => { if (!menu.contains(e.target)) menu.hidden = true; };
  document.addEventListener('click', closeMenu);
  menu.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; menu.hidden = true;
    if (b.dataset.st) { try { S.setStatus(q.id, b.dataset.st); header(); toast(`Marcado como ${S.STATUS[b.dataset.st].label.toLowerCase()}`); } catch (err) { toast(err.message, 'err'); } }
    if (b.id === 'dupBtn') { const n = S.duplicateQuote(q.id); toast('Presupuesto duplicado'); location.hash = '#/p/' + n.id; }
    if (b.id === 'delBtn' && await confirmBox('Eliminar presupuesto', `Se elimina el presupuesto <b>${S.quoteNumber(q)}</b>. No se puede deshacer.`, 'Eliminar', true)) { S.deleteQuote(q.id); toast('Presupuesto eliminado'); location.hash = '#/presupuestos'; }
  };
  $('#pdfBtn').onclick = () => printDoc(docHTML({ company: S.get().company, client: S.clientById(q.clientId), quote: q, number: S.quoteNumber(q) }), `Presupuesto ${S.quoteNumber(q)}`);
  $('#shareBtn').onclick = () => shareModal(q, header);
  $('#mtabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; $$('#mtabs button').forEach(x => x.classList.toggle('on', x === b)); $('.ed-body').dataset.tab = b.dataset.t; fit(); window.scrollTo(0, 0); };

  header(); items(); preview();
  return {
    title: S.quoteNumber(q),
    destroy() { ro.disconnect(); document.removeEventListener('click', closeMenu); },
  };
};

function catalogPicker(onPick) {
  const cat = S.get().catalog;
  modal({
    title: 'Agregar desde el catálogo', size: 'md',
    body: `<label class="search">${icon('search')}<input id="cs" placeholder="Buscar en el catálogo" autofocus></label><ul class="picker" id="cl"></ul>`,
    onMount(w, close) {
      const draw = term => { term = (term || '').toLowerCase(); $('#cl', w).innerHTML = cat.filter(c => c.name.toLowerCase().includes(term)).map(c => `<li><button data-c="${c.id}"><span>${esc(c.name)}</span><b class="num">${fmt.money(c.price)}<small> / ${esc(c.unit)}</small></b></button></li>`).join('') || `<li class="empty">Nada coincide. Podés cargarlo en Catálogo.</li>`; };
      draw(); $('#cs', w).oninput = e => draw(e.target.value);
      $('#cs', w).onkeydown = e => { if (e.key === 'Enter') $('#cl button', w)?.click(); };
      $('#cl', w).onclick = e => { const b = e.target.closest('[data-c]'); if (b) { onPick(cat.find(c => c.id === b.dataset.c)); close(); } };
    },
  });
}

// ---------- imprimir / PDF ----------
function printDoc(html, title) {
  $('#print-area').innerHTML = html;
  const t = document.title; document.title = title;
  window.print();
  setTimeout(() => { document.title = t; }, 500);
}

// ---------- compartir ----------
const waPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('00')) d = d.slice(2); if (d.startsWith('54')) return d.startsWith('549') ? d : '549' + d.slice(2); if (d.startsWith('0')) d = d.slice(1); d = d.replace(/^(\d{2,4})15/, '$1'); return '549' + d; };

async function shareModal(q, after) {
  const cl = S.clientById(q.clientId);
  if (!cl) return toast('Elegí un cliente antes de enviar.', 'err');
  if (!q.items.length) return toast('Agregá al menos un ítem.', 'err');
  const payload = await encodeShare(S.sharePayload(q));
  const url = location.href.split('#')[0] + '#/ver/' + payload;
  const t = S.calc(q), c = S.get().company;
  const msg = `Hola ${cl.name.split(' ')[0]}! Te paso el presupuesto ${q.title ? `de "${q.title}" ` : ''}por ${fmt.money(t.total)} (N° ${S.quoteNumber(q)}). Lo podés ver y aceptar desde acá:\n${url}\n\n${c.name}`;
  const phone = waPhone(cl.phone);
  modal({
    title: 'Enviar presupuesto', size: 'md',
    body: `
      <div class="share-hero"><span class="logo-sm">${icon('link')}</span><div><b>${esc(cl.name)}</b><span>${fmt.moneyExact(t.total)} · válido ${q.validity} días</span></div></div>
      <p class="muted small">El link contiene el presupuesto completo: tu cliente lo abre en el celular, lo descarga en PDF y lo acepta con un toque por WhatsApp. No necesita cuenta ni instalar nada.</p>
      <div class="linkbox"><input readonly value="${esc(url)}" id="lk"><button class="btn ghost sm" id="cp">${icon('copy')} Copiar</button></div>
      <label class="field"><span>Mensaje</span><textarea id="wm" rows="5">${esc(msg)}</textarea></label>
      ${!phone ? '<p class="small amber">Este cliente no tiene teléfono cargado: WhatsApp te va a pedir que elijas el contacto.</p>' : ''}`,
    foot: `<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">${icon('eye')} Ver como cliente</a><button class="btn wa" id="waBtn">${icon('wa')} Enviar por WhatsApp</button>`,
    onMount(w, close) {
      $('#cp', w).onclick = async () => { try { await navigator.clipboard.writeText(url); } catch { $('#lk', w).select(); document.execCommand('copy'); } toast('Link copiado'); markSent(); };
      $('#waBtn', w).onclick = () => { window.open(`https://wa.me/${phone}?text=${encodeURIComponent($('#wm', w).value)}`, '_blank', 'noopener'); markSent(); close(); };
    },
  });
  function markSent() { if (q.status === 'draft') { S.setStatus(q.id, 'sent'); after?.(); toast('Marcado como enviado'); } }
}

// ---------- vista pública del cliente ----------
async function publicView(payload) {
  document.body.dataset.view = 'ver';
  let data;
  try { data = await decodeShare(payload || ''); } catch { data = null; }
  if (!data?.quote) {
    document.body.innerHTML = `<div class="pub-err"><div class="empty big">${icon('alert')}<h2>No pudimos abrir este presupuesto</h2><p>El link parece incompleto. Pedile a quien te lo envió que lo comparta de nuevo.</p></div></div>`;
    return;
  }
  const { company: c, client, quote: q } = data;
  const number = `${c.prefix || '0001'}-${String(q.n).padStart(8, '0')}`;
  const t = S.calc(q, c);
  const expired = Date.now() >= S.expiresAt(q);
  const phone = waPhone(c.phone);
  const accept = `Hola! Soy ${client?.name || ''}. Acepto el presupuesto N° ${number}${q.title ? ` ("${q.title}")` : ''} por ${fmt.money(t.total)}. ¿Cómo seguimos?`;
  const ask = `Hola! Tengo una consulta sobre el presupuesto N° ${number}${q.title ? ` ("${q.title}")` : ''}.`;
  document.title = `Presupuesto ${number} · ${c.name}`;
  document.body.innerHTML = `
  <div class="pub" style="--brand:${esc(c.color || '#6d3df5')}">
    <header class="pub-bar">
      <div><small>Presupuesto de</small><b>${esc(c.name)}</b></div>
      <button class="btn ghost sm" id="pPdf">${icon('download')}<span class="hide-sm">Descargar PDF</span></button>
    </header>
    ${expired ? `<div class="pub-warn">${icon('clock')} Este presupuesto venció. Podés pedir una actualización.</div>` : ''}
    <div class="pub-sum">
      <span>Total${t.ri ? ' con IVA' : ''}</span><b class="num">${fmt.moneyExact(t.total)}</b>
      <small>${q.title ? esc(q.title) + ' · ' : ''}${expired ? 'vencido' : `válido hasta el ${fmt.date(S.expiresAt(q) - DAY)}`}</small>
    </div>
    <div class="paper-wrap" id="pw"><div class="paper" id="paper">${docHTML({ company: c, client, quote: q, number })}</div></div>
    <div class="pub-cta">
      ${phone ? `<a class="btn wa lg" href="https://wa.me/${phone}?text=${encodeURIComponent(expired ? ask + ' Ya venció, ¿me lo podés actualizar?' : accept)}" target="_blank" rel="noopener">${icon(expired ? 'wa' : 'check')} ${expired ? 'Pedir actualización' : 'Aceptar presupuesto'}</a>
      <a class="btn ghost lg" href="https://wa.me/${phone}?text=${encodeURIComponent(ask)}" target="_blank" rel="noopener">${icon('wa')} Hacer una consulta</a>` : `<p class="muted">Para aceptarlo, comunicate con ${esc(c.name)}${c.email ? ` a ${esc(c.email)}` : ''}.</p>`}
    </div>
    <p class="pub-foot">Generado con Zenix Cotiza</p>
  </div>
  <div id="toasts"></div><div id="print-area"></div>`;
  const paper = $('#paper'), pw = $('#pw');
  const fit = () => { const s = Math.min(1, (pw.clientWidth - 2) / 794); paper.style.setProperty('--s', s); pw.style.height = paper.firstElementChild.offsetHeight * s + 'px'; };
  new ResizeObserver(fit).observe(pw); fit();
  $('#pPdf').onclick = () => printDoc(docHTML({ company: c, client, quote: q, number }), `Presupuesto ${number} - ${c.name}`);
}

// =====================================================================
// CLIENTES
// =====================================================================
VIEWS.clientes = root => {
  let term = '';
  root.innerHTML = `${pageHead('Clientes', '', `<button class="btn primary" id="nc">${icon('plus')} Nuevo cliente</button>`)}
    <div class="toolbar"><label class="search">${icon('search')}<input id="cq" placeholder="Buscar cliente"></label></div>
    <div class="cards" id="cg"></div>`;
  const draw = () => {
    const t = term.toLowerCase();
    const list = S.get().clients.filter(c => !t || c.name.toLowerCase().includes(t) || (c.doc || '').includes(t) || (c.email || '').toLowerCase().includes(t)).map(c => ({ c, s: S.clientStats(c.id) })).sort((a, b) => b.s.last - a.s.last || a.c.name.localeCompare(b.c.name, 'es'));
    $('#cg').innerHTML = list.map(({ c, s }) => `
      <article class="card ccard" data-c="${c.id}" tabindex="0">
        <div class="av" style="--h:${[...c.name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360}">${esc(c.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase())}</div>
        <div class="cc-b"><b>${esc(c.name)}</b><small>${esc([c.doc, c.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</small></div>
        <dl><div><dt>Presupuestos</dt><dd>${s.count}</dd></div><div><dt>Aceptados</dt><dd>${s.accepted}</dd></div><div><dt>Facturable</dt><dd class="num">${fmt.money(s.amount)}</dd></div></dl>
      </article>`).join('') || `<div class="empty big">${icon('users')}<p>${S.get().clients.length ? 'No hay clientes que coincidan.' : 'Cargá tu primer cliente.'}</p></div>`;
  };
  draw();
  $('#cq').oninput = debounce(e => { term = e.target.value; draw(); }, 80);
  $('#nc').onclick = () => clientForm();
  root.addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (c) clientDetail(c.dataset.c); });
  return { update: draw, title: 'Clientes' };
};

function clientDetail(id) {
  const c = S.clientById(id); if (!c) return;
  const qs = S.get().quotes.filter(q => q.clientId === id).sort((a, b) => b.date - a.date);
  modal({
    title: c.name, size: 'md',
    body: `<div class="kv">${[['CUIT/DNI', c.doc], ['Teléfono', c.phone], ['Email', c.email], ['Dirección', c.address]].map(([k, v]) => `<div><span>${k}</span><b>${esc(v || '—')}</b></div>`).join('')}</div>
      <h4 class="sub">Presupuestos</h4>
      <ul class="list">${qs.map(q => `<li><a href="#/p/${q.id}"><div><b>${esc(q.title || S.quoteNumber(q))}</b><small>${S.quoteNumber(q)} · ${fmt.date(q.date)}</small></div><span class="r"><b class="num">${fmt.money(S.calc(q).total)}</b>${chip(S.statusOf(q))}</span></a></li>`).join('') || '<li class="empty">Sin presupuestos todavía.</li>'}</ul>`,
    foot: `<button class="btn ghost danger" id="dc">${icon('trash')}</button><button class="btn ghost" id="ec">${icon('edit')} Editar</button><button class="btn primary" data-new="${c.id}">${icon('plus')} Nuevo presupuesto</button>`,
    onMount(w, close) {
      $('#ec', w).onclick = () => { close(); clientForm(c); };
      $('#dc', w).onclick = async () => { try { if (await confirmBox('Eliminar cliente', `¿Eliminar a <b>${esc(c.name)}</b>?`, 'Eliminar', true)) { S.deleteClient(c.id); toast('Cliente eliminado'); close(); } } catch (e) { toast(e.message, 'err'); } };
      w.addEventListener('click', e => { if (e.target.closest('a,[data-new]')) close(); });
    },
  });
}

function clientForm(c = null, onSaved) {
  modal({
    title: c ? 'Editar cliente' : 'Nuevo cliente', size: 'md',
    body: `<form id="cf" class="fg2" onsubmit="return false">
      <label class="field s2"><span>Nombre o razón social</span><input name="name" value="${esc(c?.name || '')}" autofocus></label>
      <label class="field"><span>CUIT o DNI</span><input name="doc" value="${esc(c?.doc || '')}" inputmode="numeric"></label>
      <label class="field"><span>Teléfono (WhatsApp)</span><input name="phone" value="${esc(c?.phone || '')}" inputmode="tel" placeholder="2901 123456"></label>
      <label class="field s2"><span>Email</span><input name="email" type="email" value="${esc(c?.email || '')}"></label>
      <label class="field s2"><span>Dirección</span><input name="address" value="${esc(c?.address || '')}"></label>
    </form>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="cs">${c ? 'Guardar' : 'Crear cliente'}</button>`,
    onMount(w, close) {
      const go = () => { try { const saved = S.saveClient({ ...c, ...Object.fromEntries(new FormData($('#cf', w))) }); toast(c ? 'Cliente actualizado' : 'Cliente creado'); close(); onSaved?.(saved); } catch (e) { toast(e.message, 'err'); } };
      $('#cs', w).onclick = go; $('#cf', w).onkeydown = e => e.key === 'Enter' && go();
    },
  });
}

// =====================================================================
// CATÁLOGO
// =====================================================================
VIEWS.catalogo = root => {
  let term = '';
  root.innerHTML = `${pageHead('Catálogo', 'Productos y servicios que cotizás seguido', `<button class="btn primary" id="ni">${icon('plus')} Nuevo ítem</button>`)}
    <div class="toolbar"><label class="search">${icon('search')}<input id="iq" placeholder="Buscar en el catálogo"></label></div>
    <div class="card flush"><div class="tw"><table class="table"><thead><tr><th>Producto o servicio</th><th>Unidad</th>${S.discriminaIVA() ? '<th class="r">IVA</th>' : ''}<th class="r">Precio</th><th></th></tr></thead><tbody id="it"></tbody></table></div></div>`;
  const draw = () => {
    const ri = S.discriminaIVA();
    $('#it').innerHTML = S.get().catalog.filter(c => c.name.toLowerCase().includes(term.toLowerCase())).map(c => `<tr>
      <td><b>${esc(c.name)}</b></td><td class="muted">${esc(c.unit)}</td>${ri ? `<td class="r muted">${fmt.num(c.iva)}%</td>` : ''}<td class="r num"><b>${fmt.money(c.price)}</b></td>
      <td class="r nowrap"><button class="icon-btn sm" data-e="${c.id}" aria-label="Editar">${icon('edit')}</button><button class="icon-btn sm" data-d="${c.id}" aria-label="Eliminar">${icon('trash')}</button></td></tr>`).join('') || `<tr><td colspan="5"><div class="empty">${icon('box')}<p>El catálogo está vacío.</p></div></td></tr>`;
  };
  draw();
  $('#iq').oninput = debounce(e => { term = e.target.value; draw(); }, 80);
  $('#ni').onclick = () => itemForm();
  root.addEventListener('click', async e => {
    const ed = e.target.closest('[data-e]'), dl = e.target.closest('[data-d]');
    if (ed) itemForm(S.get().catalog.find(c => c.id === ed.dataset.e));
    if (dl && await confirmBox('Eliminar ítem', 'Los presupuestos que ya lo usan no cambian.', 'Eliminar', true)) { S.deleteItem(dl.dataset.d); toast('Ítem eliminado'); }
  });
  return { update: draw, title: 'Catálogo' };
};

function itemForm(it = null) {
  const ri = S.discriminaIVA();
  modal({
    title: it ? 'Editar ítem' : 'Nuevo ítem', size: 'sm',
    body: `<form id="if" class="fg2" onsubmit="return false">
      <label class="field s2"><span>Nombre</span><input name="name" value="${esc(it?.name || '')}" autofocus></label>
      <label class="field"><span>Unidad</span><input name="unit" value="${esc(it?.unit || 'u.')}" placeholder="u., h, mes, m²"></label>
      <label class="field"><span>Precio${ri ? ' (sin IVA)' : ''}</span><div class="money"><i>$</i><input name="price" inputmode="decimal" value="${it?.price ?? ''}"></div></label>
      ${ri ? `<label class="field s2"><span>Alícuota de IVA</span><select name="iva">${S.IVA_RATES.map(r => `<option value="${r}" ${(it?.iva ?? 21) === r ? 'selected' : ''}>${fmt.num(r)}%</option>`).join('')}</select></label>` : ''}
    </form>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="is">${it ? 'Guardar' : 'Agregar'}</button>`,
    onMount(w, close) {
      const go = () => { try { const d = Object.fromEntries(new FormData($('#if', w))); S.saveItem({ ...it, ...d, price: parseMoney(d.price), iva: d.iva ?? it?.iva ?? 21 }); toast(it ? 'Ítem actualizado' : 'Ítem agregado'); close(); } catch (e) { toast(e.message, 'err'); } };
      $('#is', w).onclick = go; $('#if', w).onkeydown = e => e.key === 'Enter' && go();
    },
  });
}

// =====================================================================
// AJUSTES
// =====================================================================
const SWATCHES = ['#6d3df5', '#0f766e', '#1d4ed8', '#be123c', '#c2410c', '#111827'];
VIEWS.ajustes = root => {
  const c = S.get().company;
  root.innerHTML = `${pageHead('Ajustes', 'Así se ve tu empresa en cada presupuesto')}
  <div class="g21 top-align">
    <form class="card" id="cf" onsubmit="return false">
      <div class="ch"><h3>Tu empresa</h3></div>
      <div class="fg2">
        <div class="field s2 logo-f"><span>Logo</span>
          <div class="logo-row"><div class="logo-prev" id="lp">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : icon('upload')}</div>
          <div><button type="button" class="btn ghost sm" id="lu">Subir imagen</button> ${c.logo ? '<button type="button" class="btn ghost sm" id="lr">Quitar</button>' : ''}<p class="muted small">PNG o JPG. Se achica automáticamente.</p></div>
          <input type="file" id="lf" accept="image/*" hidden></div></div>
        <label class="field s2"><span>Nombre comercial</span><input name="name" value="${esc(c.name)}"></label>
        <label class="field"><span>CUIT</span><input name="cuit" value="${esc(c.cuit)}"></label>
        <label class="field"><span>Condición frente al IVA</span><select name="iva">${Object.entries(S.IVA_COND).map(([k, v]) => `<option value="${k}" ${c.iva === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Teléfono (para que te acepten por WhatsApp)</span><input name="phone" value="${esc(c.phone)}" inputmode="tel"></label>
        <label class="field"><span>Email</span><input name="email" value="${esc(c.email)}"></label>
        <label class="field"><span>Dirección</span><input name="address" value="${esc(c.address)}"></label>
        <label class="field"><span>Sitio web</span><input name="web" value="${esc(c.web)}"></label>
        <div class="field s2"><span>Color de marca</span><div class="sw" id="sw">${SWATCHES.map(s => `<button type="button" style="--c:${s}" data-c="${s}" class="${s === c.color ? 'on' : ''}" aria-label="${s}"></button>`).join('')}<input type="color" id="cc" value="${esc(c.color)}" aria-label="Otro color"></div></div>
      </div>
      <div class="ch mt"><h3>Valores por defecto</h3></div>
      <div class="fg2">
        <label class="field"><span>Punto de venta (prefijo)</span><input name="prefix" value="${esc(c.prefix)}" maxlength="5" inputmode="numeric"></label>
        <label class="field"><span>Validez (días)</span><input name="validity" type="number" min="1" value="${c.validity}"></label>
        <label class="field s2"><span>Forma de pago</span><textarea name="payment" rows="2">${esc(c.payment)}</textarea></label>
        <label class="field s2"><span>Condiciones generales</span><textarea name="terms" rows="3">${esc(c.terms)}</textarea></label>
      </div>
      <div class="row-end"><button class="btn primary" id="sv">Guardar cambios</button></div>
    </form>
    <div class="stack">
      <section class="card"><div class="ch"><h3>Respaldo</h3></div><p class="muted small">Tus datos viven en este dispositivo. Descargá un respaldo cada tanto o usalo para pasarte a otra computadora.</p>
        <div class="row"><button class="btn ghost" id="bk">${icon('download')} Descargar</button><button class="btn ghost" id="rs">${icon('upload')} Restaurar</button><input type="file" id="rf" accept="application/json,.json" hidden></div></section>
      <section class="card"><div class="ch"><h3>Datos de ejemplo</h3></div><p class="muted small">La demo trae a Zenix AR cotizando proyectos a comercios ficticios de Ushuaia.</p>
        <div class="row"><button class="btn ghost" id="dm">Restaurar demo</button><button class="btn ghost danger" id="wp">${icon('trash')} Empezar de cero</button></div></section>
    </div>
  </div>`;
  const form = $('#cf'); let color = c.color, logo = c.logo;
  const setColor = v => { color = v; $('#cc').value = v; $$('#sw button').forEach(b => b.classList.toggle('on', b.dataset.c === v)); };
  $('#sw').onclick = e => { const b = e.target.closest('[data-c]'); if (b) setColor(b.dataset.c); };
  $('#cc').oninput = e => setColor(e.target.value);
  $('#lu').onclick = () => $('#lf').click();
  $('#lr')?.addEventListener('click', () => { logo = ''; $('#lp').innerHTML = icon('upload'); });
  $('#lf').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { logo = await shrinkImage(f, 360); $('#lp').innerHTML = `<img src="${logo}" alt="">`; } catch { toast('No se pudo leer la imagen', 'err'); }
  };
  $('#sv').onclick = () => {
    const d = Object.fromEntries(new FormData(form));
    if (!d.name.trim()) return toast('Poné el nombre de tu empresa', 'err');
    S.saveCompany({ ...d, validity: Math.max(1, parseInt(d.validity, 10) || 15), prefix: (d.prefix || '1').replace(/\D/g, '').padStart(4, '0').slice(-5), color, logo, demo: false });
    toast('Cambios guardados');
  };
  $('#bk').onclick = () => { download(`zenix-cotiza-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.get()), 'application/json'); toast('Respaldo descargado'); };
  $('#rs').onclick = () => $('#rf').click();
  $('#rf').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const o = JSON.parse(await f.text()); if (await confirmBox('Restaurar respaldo', 'Se reemplazan todos los datos actuales.', 'Restaurar', true)) { S.importBackup(o); toast('Respaldo restaurado'); route(); } } catch (err) { toast(err.message.includes('JSON') ? 'No se pudo leer el archivo' : err.message, 'err'); } };
  $('#dm').onclick = async () => { if (await confirmBox('Restaurar demo', 'Se reemplazan tus datos por los de ejemplo.', 'Restaurar', true)) { S.resetDemo(); toast('Demo restaurada'); route(); } };
  $('#wp').onclick = async () => { if (await confirmBox('Empezar de cero', 'Se borran clientes, catálogo y presupuestos. Se mantienen los datos de tu empresa.', 'Borrar todo', true)) { S.wipe(); toast('Listo, a cotizar'); route(); } };
  return { title: 'Ajustes' };
};

function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      const png = cv.toDataURL('image/png'); const jpg = cv.toDataURL('image/jpeg', .85);
      res(png.length < 60000 ? png : jpg);
    };
    img.onerror = rej; img.src = url;
  });
}

// ---------- arranque ----------
S.load();
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
