// Zenix Caja — punto de venta para comercios. Interfaz, rutas y vistas.
import * as S from './store.js';
import { fmt, esc, startOfDay, DAY, PAY_METHODS, debounce, toCSV, parseCSV, download, parseMoney } from './util.js';
import { bars, donut, spark, short } from './charts.js';

// ---------- íconos (trazos estilo lucide, dibujados a mano) ----------
const I = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7.5H6"/>',
  box: '<path d="m21 7.5-9-5-9 5 9 5 9-5Z"/><path d="M3 7.5v9l9 5 9-5v-9"/><path d="M12 12.5v9"/>',
  receipt: '<path d="M5 2.5h14v19l-2.3-1.5-2.4 1.5-2.3-1.5-2.3 1.5-2.4-1.5L5 21.5z"/><path d="M9 7.5h6M9 11.5h6M9 15.5h4"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
  scan: '<path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M17 3h2.5A1.5 1.5 0 0 1 21 4.5V7M21 17v2.5a1.5 1.5 0 0 1-1.5 1.5H17M7 21H4.5A1.5 1.5 0 0 1 3 19.5V17"/><path d="M7 8v8M10 8v8M13.5 8v8M17 8v8"/>',
  print: '<path d="M6 9V2.5h12V9"/><rect x="2.5" y="9" width="19" height="8" rx="2"/><path d="M6 14h12v7.5H6z"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/>',
  upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M4 17v3h16v-3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  arrowIn: '<path d="M12 4v12m0 0-5-5m5 5 5-5"/><path d="M5 20h14"/>', arrowOut: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 20h14"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  install: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7m0 0-3-3m3 3 3-3M10 18.5h4"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;

const NAV = [
  ['inicio', 'Tablero', 'home'], ['vender', 'Vender', 'cart'], ['productos', 'Productos', 'box'],
  ['ventas', 'Ventas', 'receipt'], ['caja', 'Caja', 'cash'], ['ajustes', 'Ajustes', 'gear'],
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const isMobile = () => matchMedia('(max-width: 860px)').matches;

// ---------- shell ----------
let current = null;
function shell() {
  document.body.innerHTML = `
  <div class="app">
    <aside class="side">
      <a class="brand" href="#/inicio" aria-label="Zenix Caja">
        <span class="logo">${logoSVG()}</span>
        <span class="brand-t"><b>Zenix</b> Caja</span>
      </a>
      <nav class="nav">${NAV.map(([id, label, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${label}</span>${id === 'vender' ? '<kbd>F2</kbd>' : ''}</a>`).join('')}</nav>
      <div class="side-foot">
        <button class="btn ghost sm" id="installBtn" hidden>${icon('install')} Instalar app</button>
        <div class="biz" id="bizName"></div>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <div class="top-l"><h1 id="pageTitle"></h1><span class="crumb" id="pageSub"></span></div>
        <div class="top-r">
          <a href="#/caja" class="pill" id="cajaPill"></a>
          <button class="icon-btn" id="themeBtn" aria-label="Cambiar tema"></button>
          <a href="#/ajustes" class="icon-btn mob-only" aria-label="Ajustes">${icon('gear')}</a>
        </div>
      </header>
      <main id="view" tabindex="-1"></main>
    </div>
    <nav class="tabbar">${NAV.filter(n => n[0] !== 'ajustes').map(([id, label, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav>
  </div>
  <div id="modals"></div><div id="toasts" aria-live="polite"></div><div id="print-area"></div>`;
  $('#themeBtn').onclick = toggleTheme;
  paintTheme();
}

function logoSVG() {
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>
  <rect width="40" height="40" rx="11" fill="url(#lg)"/><path d="M11 12h14l-11 16h15" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 21l5 7M30 21l-5 7" stroke="#fff" stroke-opacity=".55" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

function chrome() {
  const st = S.get();
  $('#bizName').innerHTML = `<b>${esc(st.business.name)}</b><span>${st.business.demo ? 'Datos de demostración' : esc(st.business.cuit || '')}</span>`;
  const s = S.session();
  const pill = $('#cajaPill');
  pill.className = 'pill ' + (s ? 'ok' : 'off');
  pill.innerHTML = s ? `<i></i><span>Caja abierta <small>desde ${fmt.time(s.openedAt)}</small></span>` : `<i></i><span>Caja cerrada</span>`;
}

// ---------- tema ----------
function paintTheme() {
  const t = document.documentElement.dataset.theme;
  $('#themeBtn').innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#0b0d12' : '#f6f7f9');
}
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('zenix-caja:theme', t); } catch {}
  paintTheme();
}

// ---------- toasts y modales ----------
export function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `${icon(type === 'err' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 4200 : 2600);
}

const modalStack = [];
function modal({ title, body, foot = '', size = '', onMount, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></header>
    <div class="modal-b">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
  $('#modals').appendChild(wrap);
  const prevFocus = document.activeElement;
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.classList.remove('in');
    modalStack.splice(modalStack.indexOf(close), 1);
    setTimeout(() => wrap.remove(), 180);
    onClose?.();
    prevFocus?.focus?.({ preventScroll: true });
  };
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  $$('[data-close]', wrap).forEach(b => b.onclick = close);
  modalStack.push(close);
  requestAnimationFrame(() => wrap.classList.add('in'));
  onMount?.(wrap, close);
  const f = $('[autofocus]', wrap) || $('input,select,button.primary', wrap);
  setTimeout(() => f?.focus(), 40);
  return close;
}

function confirmBox({ title, text, ok = 'Confirmar', danger = false, input = null }) {
  return new Promise(res => {
    let done = false;
    modal({
      title, size: 'sm',
      body: `<p class="muted">${text}</p>${input ? `<label class="field"><span>${esc(input)}</span><input id="cfIn" autofocus></label>` : ''}`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(ok)}</button>`,
      onMount: (w, close) => { $('#cfOk', w).onclick = () => { done = true; res(input ? ($('#cfIn', w).value || '') : true); close(); }; },
      onClose: () => { if (!done) res(null); },
    });
  });
}

// ---------- router ----------
const VIEWS = {};
function route() {
  const id = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'inicio';
  const v = VIEWS[id] ? id : 'inicio';
  while (modalStack.length) modalStack[modalStack.length - 1]();
  current?.destroy?.();
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === v));
  const def = VIEWS[v];
  $('#pageTitle').textContent = def.title;
  $('#pageSub').textContent = def.sub?.() || '';
  document.title = `${def.title} · Zenix Caja`;
  document.body.dataset.view = v;
  const old = $('#view');
  const root = old.cloneNode(false);
  old.replaceWith(root);
  current = def.mount(root) || {};
  root.scrollTop = 0; window.scrollTo(0, 0);
  chrome();
}

S.subscribe(() => { chrome(); current?.update?.(); });

// =====================================================================
// TABLERO
// =====================================================================
VIEWS.inicio = {
  title: 'Tablero',
  sub: () => new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }),
  mount(root) {
    const draw = () => {
      const t0 = startOfDay(), y0 = t0 - DAY, w0 = t0 - 6 * DAY;
      const now = Date.now(), sameTimeYesterday = now - DAY;
      const today = S.stats(t0, t0 + DAY), yest = S.stats(y0, sameTimeYesterday), yestFull = S.stats(y0, t0);
      const series = S.dailySeries(14);
      const delta = (a, b) => b ? (a - b) / b : null;
      const kpi = (label, value, d, sp, hint) => `
        <div class="card kpi">
          <div class="kpi-h"><span>${label}</span>${d === null ? '' : `<em class="${d >= 0 ? 'pos' : 'neg'}">${icon(d >= 0 ? 'up' : 'down')}${fmt.pct(Math.abs(d))}</em>`}</div>
          <div class="kpi-v">${value}</div>
          <div class="kpi-f"><small>${hint}</small>${sp}</div>
        </div>`;
      const split = S.methodSplit(w0, t0 + DAY);
      const splitData = Object.keys(PAY_METHODS).map(k => ({ label: PAY_METHODS[k].label, value: split[k] || 0, color: PAY_METHODS[k].color }));
      const splitTotal = splitData.reduce((a, d) => a + d.value, 0);
      const top = S.topProducts(w0, t0 + DAY, 6);
      const topMax = Math.max(1, ...top.map(t => t.total));
      const hours = S.hourlySeries().slice(8, 23);
      const curH = new Date().getHours();
      const low = S.lowStock().slice(0, 6);
      const last = S.get().sales.slice(-6).reverse();
      const sess = S.session();

      root.innerHTML = `
      ${!sess ? `<div class="banner">${icon('lock')}<div><b>La caja está cerrada.</b> Abrila para empezar a vender hoy.</div><a class="btn primary sm" href="#/caja">Abrir caja</a></div>` : ''}
      <section class="grid kpis">
        ${kpi('Ventas de hoy', fmt.money(today.total), delta(today.total, yest.total), spark(series.map(s => s.total)), `Ayer a esta hora: ${fmt.money(yest.total)}`)}
        ${kpi('Tickets', fmt.num(today.count), delta(today.count, yest.count), spark(series.map(s => s.count)), `Ayer en total: ${fmt.num(yestFull.count)}`)}
        ${kpi('Ticket promedio', fmt.money(today.avg), delta(today.avg, yest.avg), '', `${fmt.num(today.units)} unidades vendidas`)}
        ${kpi('Ganancia bruta', fmt.money(today.margin), null, '', `Margen ${fmt.pct(today.total ? today.margin / today.total : 0)} sobre ventas`)}
      </section>

      <section class="grid two-one">
        <div class="card">
          <div class="card-h"><h3>Ventas · últimos 14 días</h3><span class="muted">${fmt.money(series.reduce((a, s) => a + s.total, 0))}</span></div>
          ${bars(series.map((s, i) => ({ label: i === series.length - 1 ? 'Hoy' : fmt.weekday(s.ts).slice(0, 2) + ' ' + new Date(s.ts).getDate(), title: fmt.date(s.ts), value: s.total, highlight: i === series.length - 1 })))}
        </div>
        <div class="card">
          <div class="card-h"><h3>Medios de pago</h3><span class="muted">7 días</span></div>
          <div class="donut-row">${donut(splitData, { center: '$' + short(splitTotal) })}
            <ul class="legend">${splitData.map(d => `<li><i style="background:${d.color}"></i><span>${d.label}</span><b>${fmt.pct(splitTotal ? d.value / splitTotal : 0)}</b></li>`).join('')}</ul>
          </div>
        </div>
      </section>

      <section class="grid three">
        <div class="card">
          <div class="card-h"><h3>Hoy por hora</h3><span class="muted">${fmt.num(today.count)} tickets</span></div>
          ${bars(hours.map(h => ({ label: h.h + 'h', value: h.total, highlight: h.h === curH })), { height: 200, width: 380 })}
        </div>
        <div class="card">
          <div class="card-h"><h3>Más vendidos</h3><span class="muted">7 días</span></div>
          <ol class="rank">${top.map((t, i) => `<li><span class="n">${i + 1}</span><div><b>${esc(t.name)}</b><div class="meter"><i style="width:${(t.total / topMax) * 100}%"></i></div></div><span class="r"><b>${fmt.money(t.total)}</b><small>${fmt.num(t.qty)} u.</small></span></li>`).join('') || '<li class="empty">Todavía no hay ventas.</li>'}</ol>
        </div>
        <div class="card">
          <div class="card-h"><h3>Reponer pronto</h3><a href="#/productos?bajo=1" class="link">Ver todo</a></div>
          <ul class="stock-list">${low.map(p => `<li><div><b>${esc(p.name)}</b><small>Mínimo ${p.minStock}</small></div><span class="badge ${p.stock <= 0 ? 'red' : 'amber'}">${p.stock} u.</span><button class="btn ghost xs" data-restock="${p.id}">+ Stock</button></li>`).join('') || '<li class="empty">Todo el stock está en orden.</li>'}</ul>
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>Últimas ventas</h3><a href="#/ventas" class="link">Historial completo</a></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>N°</th><th>Hora</th><th>Detalle</th><th>Medio</th><th class="r">Total</th></tr></thead>
          <tbody>${last.map(saleRow).join('')}</tbody></table></div>
      </section>`;
    };
    draw();
    root.onclick = e => {
      const rs = e.target.closest('[data-restock]'); if (rs) return restockModal(rs.dataset.restock);
      const tr = e.target.closest('[data-sale]'); if (tr) saleDetail(tr.dataset.sale);
    };
    return { update: draw };
  },
};

function saleRow(s) {
  const items = s.items.map(i => `${i.qty}× ${i.name}`).join(', ');
  return `<tr data-sale="${s.id}" class="${s.status === 'void' ? 'void' : ''}" tabindex="0">
    <td class="mono">#${s.n}</td><td>${fmt.time(s.ts)}<small class="muted block">${fmt.dateShort(s.ts)}</small></td>
    <td class="ellipsis" title="${esc(items)}">${esc(items)}</td>
    <td><span class="method" style="--m:${PAY_METHODS[s.payments[0].method].color}">${PAY_METHODS[s.payments[0].method].short}</span></td>
    <td class="r mono"><b>${fmt.money(s.total)}</b>${s.status === 'void' ? '<small class="badge red">Anulada</small>' : ''}</td></tr>`;
}

function restockModal(pid) {
  const p = S.productById(pid); if (!p) return;
  modal({
    title: `Reponer · ${p.name}`, size: 'sm',
    body: `<p class="muted">Stock actual: <b>${p.stock}</b> u. · mínimo ${p.minStock} u.</p>
      <label class="field"><span>Unidades que ingresan</span><input id="rsQ" type="number" inputmode="numeric" min="1" value="${Math.max(1, p.minStock * 2 - p.stock)}" autofocus></label>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="rsOk">Sumar al stock</button>`,
    onMount(w, close) {
      const go = () => { const q = parseInt($('#rsQ', w).value, 10); if (!(q > 0)) return toast('Ingresá una cantidad válida', 'err'); S.adjustStock(pid, q); toast(`${p.name}: +${q} u.`); close(); };
      $('#rsOk', w).onclick = go; $('#rsQ', w).onkeydown = e => e.key === 'Enter' && go();
    },
  });
}

// =====================================================================
// VENDER (POS)
// =====================================================================
const pos = { cart: [], discount: 0, discountMode: 'pct', q: '', cat: 'all' };
try { Object.assign(pos, JSON.parse(sessionStorage.getItem('zenix-caja:cart') || '{}')); } catch {}
const saveCart = () => { try { sessionStorage.setItem('zenix-caja:cart', JSON.stringify({ cart: pos.cart, discount: pos.discount, discountMode: pos.discountMode })); } catch {} };

function cartTotals() {
  const lines = pos.cart.map(l => ({ ...l, p: S.productById(l.pid) })).filter(l => l.p);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.p.price, 0);
  const disc = pos.discountMode === 'pct' ? Math.round(subtotal * Math.min(100, pos.discount) / 100) : Math.min(subtotal, Math.round(pos.discount));
  const units = lines.reduce((a, l) => a + l.qty, 0);
  return { lines, subtotal, disc, total: subtotal - disc, units };
}

function addToCart(pid, qty = 1) {
  const p = S.productById(pid); if (!p) return false;
  const line = pos.cart.find(l => l.pid === pid);
  const next = (line?.qty || 0) + qty;
  if (next > p.stock) { toast(p.stock <= 0 ? `${p.name}: sin stock` : `${p.name}: quedan solo ${p.stock}`, 'err'); beep(220); return false; }
  if (line) line.qty = next; else pos.cart.push({ pid, qty });
  saveCart(); beep(880);
  return true;
}

let actx;
function beep(freq) {
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; o.type = 'sine'; g.gain.value = .04;
    g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + .09);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + .1);
  } catch {}
}

VIEWS.vender = {
  title: 'Vender',
  sub: () => matchMedia('(pointer: coarse)').matches ? 'Tocá un producto para sumarlo' : 'F2 buscar · F9 cobrar · lector de código listo',
  mount(root) {
    const st = S.get();
    root.innerHTML = `
    <div class="pos">
      <section class="pos-l">
        <div class="pos-bar">
          <label class="search">${icon('search')}<input id="q" placeholder="Buscar producto o escanear código…" autocomplete="off" value="${esc(pos.q)}"><kbd>F2</kbd></label>
          ${'BarcodeDetector' in window ? `<button class="btn ghost" id="camBtn" title="Escanear con la cámara">${icon('scan')}<span class="hide-sm">Cámara</span></button>` : ''}
        </div>
        <div class="chips" id="cats">
          <button data-cat="all">Todo</button>${st.categories.map(c => `<button data-cat="${c.id}" style="--cc:var(--c${c.color})"><i></i>${esc(c.name)}</button>`).join('')}
        </div>
        <div class="pgrid" id="pgrid"></div>
      </section>
      <aside class="pos-r" id="cartPanel">
        <div class="cart-h"><h3>Venta actual</h3><button class="link danger" id="clearCart">Vaciar</button><button class="icon-btn mob-only" id="closeCart" aria-label="Cerrar">${icon('x')}</button></div>
        <div class="cart-list" id="cartList"></div>
        <div class="cart-f" id="cartFoot"></div>
      </aside>
      <button class="cart-fab" id="cartFab"></button>
    </div>`;

    const q = $('#q'), grid = $('#pgrid');
    const renderGrid = () => {
      const term = pos.q.trim().toLowerCase();
      const list = S.get().products.filter(p => p.active !== false && (pos.cat === 'all' || p.cat === pos.cat) &&
        (!term || p.name.toLowerCase().includes(term) || (p.code || '').includes(term)));
      $$('#cats button').forEach(b => b.classList.toggle('on', b.dataset.cat === pos.cat));
      grid.innerHTML = list.map(p => {
        const c = S.categoryById(p.cat);
        const inCart = pos.cart.find(l => l.pid === p.id)?.qty || 0;
        const out = p.stock <= 0, low = p.stock <= p.minStock;
        return `<button class="pcard${out ? ' out' : ''}${inCart ? ' in' : ''}" data-add="${p.id}" style="--cc:var(--c${c?.color || 1})" ${out ? 'aria-disabled="true"' : ''}>
          <span class="pc-cat">${esc(c?.name || '')}</span>
          <span class="pc-name">${esc(p.name)}</span>
          <span class="pc-f"><b>${fmt.money(p.price)}</b><small class="${out ? 'red' : low ? 'amber' : ''}">${out ? 'Sin stock' : p.stock + ' u.'}</small></span>
          ${inCart ? `<span class="pc-q">${inCart}</span>` : ''}
        </button>`;
      }).join('') || `<div class="empty big">${icon('search')}<p>No hay productos que coincidan con “${esc(pos.q)}”.</p></div>`;
    };

    const renderCart = () => {
      const t = cartTotals();
      $('#cartList').innerHTML = t.lines.length ? t.lines.map(l => `
        <div class="cline">
          <div class="cl-t"><b>${esc(l.p.name)}</b><small>${fmt.money(l.p.price)} c/u</small></div>
          <div class="qty"><button data-dec="${l.pid}" aria-label="Restar">${icon('minus')}</button><input data-qty="${l.pid}" value="${l.qty}" inputmode="numeric" aria-label="Cantidad"><button data-inc="${l.pid}" aria-label="Sumar">${icon('plus')}</button></div>
          <b class="cl-sub mono">${fmt.money(l.qty * l.p.price)}</b>
          <button class="icon-btn sm" data-rm="${l.pid}" aria-label="Quitar">${icon('trash')}</button>
        </div>`).join('') : `<div class="empty">${icon('cart')}<p>Tocá un producto o escaneá un código para empezar.</p></div>`;
      $('#cartFoot').innerHTML = `
        <div class="disc"><span>Descuento</span>
          <div class="seg sm"><button data-dm="pct" class="${pos.discountMode === 'pct' ? 'on' : ''}">%</button><button data-dm="amt" class="${pos.discountMode === 'amt' ? 'on' : ''}">$</button></div>
          <input id="discIn" inputmode="decimal" value="${pos.discount || ''}" placeholder="0"></div>
        <div id="totals">${totalsHTML(t)}</div>
        <button class="btn primary lg block" id="payBtn" ${t.lines.length ? '' : 'disabled'}>Cobrar <kbd>F9</kbd></button>`;
      const fab = $('#cartFab');
      fab.innerHTML = `${icon('cart')}<span>${t.units ? `${t.units} ${t.units === 1 ? 'producto' : 'productos'}` : 'Carrito vacío'}</span><b>${fmt.money(t.total)}</b>`;
      fab.classList.toggle('has', t.units > 0);
      $('#discIn').oninput = e => {
        pos.discount = parseMoney(e.target.value); saveCart();
        const tt = cartTotals();
        $('#totals').innerHTML = totalsHTML(tt);
        $('#cartFab b').textContent = fmt.money(tt.total);
      };
    };
    const totalsHTML = t => `
        <div class="tot-row"><span>Subtotal · ${t.units} u.</span><span class="mono">${fmt.money(t.subtotal)}</span></div>
        ${t.disc ? `<div class="tot-row accent"><span>Descuento</span><span class="mono">−${fmt.money(t.disc)}</span></div>` : ''}
        <div class="tot-big"><span>Total</span><b class="mono">${fmt.money(t.total)}</b></div>`;

    const update = () => { renderGrid(); renderCart(); };
    update();

    q.oninput = debounce(() => { pos.q = q.value; renderGrid(); }, 60);
    q.onkeydown = e => {
      if (e.key !== 'Enter') return;
      const v = q.value.trim(); if (!v) return;
      const byCode = S.productByCode(v);
      const term = v.toLowerCase();
      const matches = S.get().products.filter(p => p.active !== false && (p.name.toLowerCase().includes(term) || (p.code || '').includes(term)));
      const target = byCode || (matches.length === 1 ? matches[0] : null);
      if (target) { if (addToCart(target.id)) { q.value = ''; pos.q = ''; update(); flash(target.id); } }
      else toast(matches.length ? 'Hay varios resultados: elegí uno de la lista' : `No encontré “${v}”`, 'err');
    };

    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cat) { pos.cat = b.dataset.cat; renderGrid(); return; }
      if (b.dataset.add) { if (b.getAttribute('aria-disabled')) return toast('Producto sin stock', 'err'); if (addToCart(b.dataset.add)) { update(); flash(b.dataset.add); } return; }
      if (b.dataset.inc) { addToCart(b.dataset.inc); update(); return; }
      if (b.dataset.dec) { const l = pos.cart.find(x => x.pid === b.dataset.dec); if (l) { l.qty--; if (l.qty <= 0) pos.cart = pos.cart.filter(x => x !== l); saveCart(); update(); } return; }
      if (b.dataset.rm) { pos.cart = pos.cart.filter(x => x.pid !== b.dataset.rm); saveCart(); update(); return; }
      if (b.dataset.dm) { pos.discountMode = b.dataset.dm; saveCart(); renderCart(); return; }
      if (b.id === 'clearCart') { if (pos.cart.length) { pos.cart = []; pos.discount = 0; saveCart(); update(); toast('Venta vaciada'); } return; }
      if (b.id === 'payBtn') return payFlow(update);
      if (b.id === 'cartFab') return $('#cartPanel').classList.add('open');
      if (b.id === 'closeCart') return $('#cartPanel').classList.remove('open');
      if (b.id === 'camBtn') return cameraScan(update);
    };
    root.onchange = e => {
      const pid = e.target.dataset.qty; if (!pid) return;
      const p = S.productById(pid); let n = parseInt(e.target.value, 10);
      if (!(n >= 0)) n = 1;
      if (n > p.stock) { toast(`${p.name}: quedan solo ${p.stock}`, 'err'); n = p.stock; }
      const l = pos.cart.find(x => x.pid === pid);
      if (n === 0) pos.cart = pos.cart.filter(x => x !== l); else l.qty = n;
      saveCart(); update();
    };

    function flash(pid) {
      const el = grid.querySelector(`[data-add="${pid}"]`);
      el?.classList.remove('pop'); void el?.offsetWidth; el?.classList.add('pop');
    }

    if (!isMobile()) setTimeout(() => q.focus(), 30);
    return {
      update,
      scan(code) {
        const p = S.productByCode(code);
        if (!p) { toast(`Código ${code} no registrado`, 'err'); beep(220); return; }
        if (addToCart(p.id)) { update(); flash(p.id); }
      },
      key(e) {
        if (e.key === 'F9') { e.preventDefault(); if (pos.cart.length) payFlow(update); }
        if (e.key === 'F2') { e.preventDefault(); q.focus(); q.select(); }
      },
    };
  },
};

function payFlow(onDone) {
  const t = cartTotals();
  if (!t.lines.length) return;
  if (!S.session()) {
    return openCashModal(() => payFlow(onDone));
  }
  let method = 'cash';
  const quick = [...new Set([t.total, ...[1000, 2000, 5000, 10000, 20000].filter(b => b > t.total), Math.ceil(t.total / 1000) * 1000, Math.ceil(t.total / 5000) * 5000, Math.ceil(t.total / 10000) * 10000])].sort((a, b) => a - b).slice(0, 5);
  modal({
    title: 'Cobrar venta', size: 'md',
    body: `
      <div class="pay-total"><span>Total a cobrar</span><b class="mono">${fmt.money(t.total)}</b>${t.disc ? `<small>Incluye ${fmt.money(t.disc)} de descuento</small>` : ''}</div>
      <div class="methods">${Object.entries(PAY_METHODS).map(([k, m], i) => `<button data-m="${k}" class="${k === 'cash' ? 'on' : ''}" style="--m:${m.color}"><kbd>${i + 1}</kbd>${m.label}</button>`).join('')}</div>
      <div id="cashBox">
        <label class="field"><span>Efectivo recibido</span><input id="recv" inputmode="numeric" class="big mono" value="${t.total}" autofocus></label>
        <div class="quick">${quick.map(v => `<button data-q="${v}">${v === t.total ? 'Exacto' : fmt.money(v)}</button>`).join('')}</div>
        <div class="change"><span>Vuelto</span><b class="mono" id="chg">${fmt.money(0)}</b></div>
      </div>
      <p class="muted small" id="otherHint" hidden>Confirmá cuando el pago esté acreditado en el posnet, la billetera o tu cuenta.</p>`,
    foot: `<button class="btn ghost" data-close>Volver</button><button class="btn primary lg" id="confirmPay">${icon('check')} Confirmar cobro <kbd>Enter</kbd></button>`,
    onMount(w, close) {
      const recv = $('#recv', w), chg = $('#chg', w), ok = $('#confirmPay', w);
      const calc = () => {
        const r = parseMoney(recv.value), c = r - t.total;
        chg.textContent = c >= 0 ? fmt.money(c) : `Faltan ${fmt.money(-c)}`;
        chg.classList.toggle('red', c < 0);
        ok.disabled = method === 'cash' && c < 0;
      };
      const setM = m => {
        method = m;
        $$('.methods button', w).forEach(b => b.classList.toggle('on', b.dataset.m === m));
        $('#cashBox', w).hidden = m !== 'cash'; $('#otherHint', w).hidden = m === 'cash';
        calc(); if (m === 'cash') recv.select();
      };
      recv.oninput = calc;
      recv.onfocus = () => recv.select();
      w.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.m) setM(b.dataset.m);
        if (b.dataset.q) { recv.value = b.dataset.q; calc(); }
      };
      w.onkeydown = e => {
        if (/^[1-5]$/.test(e.key) && e.target !== recv) { setM(Object.keys(PAY_METHODS)[+e.key - 1]); e.preventDefault(); }
        if (e.key === 'Enter' && !ok.disabled) { e.preventDefault(); ok.click(); }
      };
      ok.onclick = () => {
        try {
          const sale = S.checkout({ items: pos.cart, discount: t.disc, payment: { method, received: parseMoney(recv.value) } });
          pos.cart = []; pos.discount = 0; saveCart();
          close(); onDone?.();
          $('#cartPanel')?.classList.remove('open');
          showTicket(sale, true);
        } catch (err) { toast(err.message, 'err'); }
      };
      calc();
    },
  });
}

// ---------- ticket ----------
function ticketHTML(sale) {
  const b = S.get().business;
  return `<div class="ticket">
    <div class="tk-c"><b class="tk-name">${esc(b.name)}</b><div>${esc(b.address)}</div><div>CUIT ${esc(b.cuit)}${b.phone ? ' · Tel. ' + esc(b.phone) : ''}</div></div>
    <div class="tk-sep"></div>
    <div class="tk-row"><span>Ticket N° ${fmt.ticket(sale.n)}</span><span>${fmt.dateTime(sale.ts)}</span></div>
    ${sale.status === 'void' ? `<div class="tk-void">ANULADO</div>` : ''}
    <div class="tk-sep"></div>
    ${sale.items.map(i => `<div class="tk-item"><div>${esc(i.name)}</div><div class="tk-row"><span>${i.qty} × ${fmt.moneyExact(i.price)}</span><span>${fmt.moneyExact(i.qty * i.price)}</span></div></div>`).join('')}
    <div class="tk-sep"></div>
    <div class="tk-row"><span>Subtotal</span><span>${fmt.moneyExact(sale.subtotal)}</span></div>
    ${sale.discount ? `<div class="tk-row"><span>Descuento</span><span>−${fmt.moneyExact(sale.discount)}</span></div>` : ''}
    <div class="tk-row tk-total"><span>TOTAL</span><span>${fmt.moneyExact(sale.total)}</span></div>
    <div class="tk-row"><span>${PAY_METHODS[sale.payments[0].method].label}</span><span>${fmt.moneyExact(sale.received)}</span></div>
    ${sale.change ? `<div class="tk-row"><span>Vuelto</span><span>${fmt.moneyExact(sale.change)}</span></div>` : ''}
    <div class="tk-sep"></div>
    <div class="tk-c">${esc(b.footer || '')}<div class="tk-small">Comprobante no válido como factura</div></div>
  </div>`;
}

function printHTML(html) {
  $('#print-area').innerHTML = html;
  window.print();
}

function showTicket(sale, fresh = false) {
  modal({
    title: fresh ? 'Venta registrada' : `Ticket #${sale.n}`, size: 'sm',
    body: `${fresh ? `<div class="success">${icon('check')}<div><b>${fmt.money(sale.total)}</b><span>${PAY_METHODS[sale.payments[0].method].label}${sale.change ? ` · vuelto ${fmt.money(sale.change)}` : ''}</span></div></div>` : ''}
      <div class="ticket-prev">${ticketHTML(sale)}</div>`,
    foot: `<button class="btn ghost" id="tkPrint">${icon('print')} Imprimir</button><button class="btn primary" data-close autofocus>${fresh ? 'Nueva venta' : 'Cerrar'}</button>`,
    onMount(w) { $('#tkPrint', w).onclick = () => printHTML(ticketHTML(sale)); },
    onClose() { if (fresh && !isMobile()) setTimeout(() => $('#q')?.focus(), 200); },
  });
}

// ---------- cámara ----------
async function cameraScan(onDone) {
  let stream, raf, alive = true;
  modal({
    title: 'Escanear código', size: 'sm',
    body: `<div class="cam"><video playsinline muted></video><div class="cam-line"></div></div><p class="muted small center">Apuntá al código de barras del producto.</p>`,
    async onMount(w, close) {
      try {
        const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const v = $('video', w); v.srcObject = stream; await v.play();
        const loop = async () => {
          if (!alive) return;
          try {
            const codes = await det.detect(v);
            if (codes[0]) { const code = codes[0].rawValue; close(); current?.scan?.(code); return; }
          } catch {}
          raf = setTimeout(loop, 180);
        };
        loop();
      } catch (e) { toast('No se pudo usar la cámara: ' + (e.message || e.name), 'err'); close(); }
    },
    onClose() { alive = false; clearTimeout(raf); stream?.getTracks().forEach(t => t.stop()); },
  });
}

// =====================================================================
// PRODUCTOS
// =====================================================================
VIEWS.productos = {
  title: 'Productos',
  sub: () => `${S.get().products.length} productos · ${S.lowStock().length} para reponer`,
  mount(root) {
    const f = { q: '', cat: 'all', low: location.hash.includes('bajo=1'), sort: 'name' };
    const st = S.get();
    root.innerHTML = `
    <div class="toolbar">
      <label class="search">${icon('search')}<input id="pq" placeholder="Buscar por nombre o código" autocomplete="off"></label>
      <select id="pcat" aria-label="Categoría"><option value="all">Todas las categorías</option>${st.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      <label class="toggle"><input type="checkbox" id="plow" ${f.low ? 'checked' : ''}><span>Solo para reponer</span></label>
      <div class="sp"></div>
      <button class="btn ghost" id="pimp">${icon('upload')}<span class="hide-sm">Importar</span></button>
      <button class="btn ghost" id="pexp">${icon('download')}<span class="hide-sm">Exportar</span></button>
      <button class="btn primary" id="pnew">${icon('plus')} Nuevo</button>
      <input type="file" id="pfile" accept=".csv,text/csv" hidden>
    </div>
    <div class="card flush"><div class="table-wrap"><table class="table products">
      <thead><tr><th data-s="code">Código</th><th data-s="name">Producto</th><th data-s="cat">Categoría</th><th class="r" data-s="cost">Costo</th><th class="r" data-s="price">Precio</th><th class="r" data-s="margin">Margen</th><th class="r" data-s="stock">Stock</th><th></th></tr></thead>
      <tbody id="ptb"></tbody></table></div></div>`;
    const draw = () => {
      const term = f.q.toLowerCase();
      let list = S.get().products.filter(p => (f.cat === 'all' || p.cat === f.cat) && (!f.low || p.stock <= p.minStock) &&
        (!term || p.name.toLowerCase().includes(term) || (p.code || '').includes(term)));
      const key = { margin: p => (p.price - p.cost) / p.price, cat: p => S.categoryById(p.cat)?.name || '' }[f.sort] || (p => p[f.sort]);
      list.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'string' ? x.localeCompare(y, 'es') : x - y) * (f.desc ? -1 : 1); });
      $$('th[data-s]', root).forEach(th => th.className = (th.classList.contains('r') ? 'r ' : '') + (th.dataset.s === f.sort ? (f.desc ? 'sorted desc' : 'sorted') : ''));
      $('#ptb').innerHTML = list.map(p => {
        const c = S.categoryById(p.cat); const m = p.price ? (p.price - p.cost) / p.price : 0;
        return `<tr>
          <td class="mono muted">${esc(p.code || '—')}</td>
          <td><b>${esc(p.name)}</b></td>
          <td><span class="cat" style="--cc:var(--c${c?.color || 1})">${esc(c?.name || '—')}</span></td>
          <td class="r mono">${fmt.money(p.cost)}</td>
          <td class="r mono"><b>${fmt.money(p.price)}</b></td>
          <td class="r"><span class="${m < .2 ? 'red' : m < .3 ? 'amber' : 'green'}">${fmt.pct(m)}</span></td>
          <td class="r"><div class="stock-ctl"><button class="icon-btn xs" data-sm="${p.id}" aria-label="Restar stock">${icon('minus')}</button><span class="badge ${p.stock <= 0 ? 'red' : p.stock <= p.minStock ? 'amber' : 'plain'}">${p.stock}</span><button class="icon-btn xs" data-sp="${p.id}" aria-label="Sumar stock">${icon('plus')}</button></div></td>
          <td class="r nowrap"><button class="icon-btn sm" data-ed="${p.id}" aria-label="Editar">${icon('edit')}</button><button class="icon-btn sm" data-del="${p.id}" aria-label="Eliminar">${icon('trash')}</button></td>
        </tr>`;
      }).join('') || `<tr><td colspan="8"><div class="empty">${icon('box')}<p>No hay productos con esos filtros.</p></div></td></tr>`;
      $('#pageSub').textContent = VIEWS.productos.sub();
    };
    draw();
    $('#pq').oninput = debounce(e => { f.q = e.target.value; draw(); }, 80);
    $('#pcat').onchange = e => { f.cat = e.target.value; draw(); };
    $('#plow').onchange = e => { f.low = e.target.checked; draw(); };
    $('thead', root).onclick = e => { const th = e.target.closest('th[data-s]'); if (!th) return; f.desc = f.sort === th.dataset.s ? !f.desc : false; f.sort = th.dataset.s; draw(); };
    $('#pnew').onclick = () => productForm();
    $('#pexp').onclick = () => {
      const rows = [['codigo', 'nombre', 'categoria', 'costo', 'precio', 'stock', 'stock_minimo'],
        ...S.get().products.map(p => [p.code, p.name, S.categoryById(p.cat)?.name || '', p.cost, p.price, p.stock, p.minStock])];
      download(`productos-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), 'text/csv');
      toast('Lista de productos exportada');
    };
    $('#pimp').onclick = () => $('#pfile').click();
    $('#pfile').onchange = async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try {
        const rows = parseCSV(await file.text());
        const head = rows.shift().map(h => h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
        const ix = k => head.findIndex(h => h.startsWith(k));
        const [ic, inn, ica, ico, ip, is, im] = ['cod', 'nom', 'cat', 'cos', 'pre', 'stock', 'stock_m'].map(ix);
        if (inn < 0 || ip < 0) throw new Error('El CSV necesita al menos las columnas "nombre" y "precio".');
        const list = rows.map(r => ({ code: (r[ic] || '').trim(), name: (r[inn] || '').trim(), catName: (r[ica] || '').trim(), cost: parseMoney(r[ico]), price: parseMoney(r[ip]), stock: parseMoney(r[is]), minStock: im >= 0 && im !== is ? parseMoney(r[im]) : 0 })).filter(r => r.name && r.price > 0);
        if (!list.length) throw new Error('No encontré filas válidas en el archivo.');
        const ok = await confirmBox({ title: 'Importar productos', text: `Se van a procesar <b>${list.length}</b> productos. Los que tengan un código existente se actualizan; el resto se agrega.`, ok: 'Importar' });
        if (!ok) return;
        const r = S.importProducts(list);
        toast(`${r.added} agregados · ${r.updated} actualizados`);
      } catch (err) { toast(err.message, 'err'); }
    };
    root.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.ed) productForm(S.productById(b.dataset.ed));
      if (b.dataset.sp) S.adjustStock(b.dataset.sp, 1);
      if (b.dataset.sm) S.adjustStock(b.dataset.sm, -1);
      if (b.dataset.del) {
        const p = S.productById(b.dataset.del);
        if (await confirmBox({ title: 'Eliminar producto', text: `¿Eliminar <b>${esc(p.name)}</b>? Las ventas anteriores se conservan.`, ok: 'Eliminar', danger: true })) { S.deleteProduct(p.id); toast('Producto eliminado'); }
      }
    });
    return { update: draw };
  },
};

function productForm(p = null) {
  const st = S.get();
  const v = p || { code: '', name: '', cat: st.categories[0]?.id, cost: '', price: '', stock: 0, minStock: 5 };
  modal({
    title: p ? 'Editar producto' : 'Nuevo producto', size: 'md',
    body: `<form id="pf" class="form-grid" novalidate>
      <label class="field span2"><span>Nombre</span><input name="name" value="${esc(v.name)}" required autofocus></label>
      <label class="field"><span>Código de barras</span><input name="code" value="${esc(v.code)}" inputmode="numeric" placeholder="Escanealo o escribilo"></label>
      <label class="field"><span>Categoría</span><select name="cat">${st.categories.map(c => `<option value="${c.id}" ${c.id === v.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Costo</span><div class="money-in"><i>$</i><input name="cost" value="${v.cost}" inputmode="decimal"></div></label>
      <label class="field"><span>Precio de venta</span><div class="money-in"><i>$</i><input name="price" value="${v.price}" inputmode="decimal" required></div></label>
      <div class="margin-help span2" id="mh"></div>
      <label class="field"><span>Stock actual</span><input name="stock" type="number" value="${v.stock}" inputmode="numeric"></label>
      <label class="field"><span>Avisar cuando quede</span><input name="minStock" type="number" value="${v.minStock}" inputmode="numeric" min="0"></label>
    </form>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="pfOk">${p ? 'Guardar cambios' : 'Crear producto'}</button>`,
    onMount(w, close) {
      const form = $('#pf', w);
      const mh = () => {
        const c = parseMoney(form.cost.value), pr = parseMoney(form.price.value);
        $('#mh', w).innerHTML = pr > 0 && c > 0 ? `Ganás <b>${fmt.money(pr - c)}</b> por unidad · margen <b>${fmt.pct((pr - c) / pr)}</b> · recargo <b>${fmt.pct((pr - c) / c)}</b>
          <span class="mk">${[30, 40, 50].map(m => `<button type="button" data-mk="${m}">+${m}%</button>`).join('')}</span>` : c > 0 ? `Sugerencias: <span class="mk">${[30, 40, 50].map(m => `<button type="button" data-mk="${m}">+${m}% → ${fmt.money(Math.ceil(c * (1 + m / 100) / 10) * 10)}</button>`).join('')}</span>` : 'Cargá el costo para ver el margen.';
      };
      form.oninput = mh; mh();
      w.addEventListener('click', e => { const b = e.target.closest('[data-mk]'); if (b) { form.price.value = Math.ceil(parseMoney(form.cost.value) * (1 + b.dataset.mk / 100) / 10) * 10; mh(); } });
      const save = () => {
        try {
          const data = Object.fromEntries(new FormData(form));
          S.saveProduct({ ...p, ...data, id: p?.id, cost: parseMoney(data.cost), price: parseMoney(data.price), stock: parseInt(data.stock, 10) || 0, minStock: parseInt(data.minStock, 10) || 0 });
          toast(p ? 'Cambios guardados' : 'Producto creado'); close();
        } catch (err) { toast(err.message, 'err'); }
      };
      $('#pfOk', w).onclick = save;
      form.onsubmit = e => { e.preventDefault(); save(); };
      form.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (e.target.name === 'code') form.cat.focus(); else save(); } };
    },
  });
}

// =====================================================================
// VENTAS
// =====================================================================
VIEWS.ventas = {
  title: 'Ventas',
  sub: () => 'Historial, anulaciones y reimpresión de tickets',
  mount(root) {
    const f = { period: 'today', method: 'all', q: '' };
    root.innerHTML = `
    <div class="toolbar">
      <div class="seg" id="vper"><button data-p="today">Hoy</button><button data-p="7">7 días</button><button data-p="30">30 días</button><button data-p="all">Todo</button></div>
      <select id="vmet" aria-label="Medio de pago"><option value="all">Todos los medios</option>${Object.entries(PAY_METHODS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}</select>
      <label class="search">${icon('search')}<input id="vq" placeholder="N° de ticket o producto"></label>
      <div class="sp"></div>
      <button class="btn ghost" id="vexp">${icon('download')}<span class="hide-sm">Exportar CSV</span></button>
    </div>
    <div class="grid kpis sm" id="vsum"></div>
    <div class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Fecha</th><th>Detalle</th><th>Medio</th><th class="r">Total</th></tr></thead><tbody id="vtb"></tbody></table></div></div>`;
    const filtered = () => {
      const t0 = startOfDay();
      const from = f.period === 'today' ? t0 : f.period === 'all' ? 0 : t0 - (+f.period - 1) * DAY;
      const term = f.q.trim().toLowerCase();
      return S.get().sales.filter(s => s.ts >= from && (f.method === 'all' || s.payments[0].method === f.method) &&
        (!term || String(s.n) === term.replace('#', '') || s.items.some(i => i.name.toLowerCase().includes(term)))).slice().reverse();
    };
    let limit = 80;
    const draw = () => {
      $$('#vper button').forEach(b => b.classList.toggle('on', b.dataset.p === f.period));
      const list = filtered();
      const ok = list.filter(s => s.status !== 'void');
      const total = ok.reduce((a, s) => a + s.total, 0);
      $('#vsum').innerHTML = `
        <div class="card kpi"><div class="kpi-h"><span>Facturado</span></div><div class="kpi-v">${fmt.money(total)}</div></div>
        <div class="card kpi"><div class="kpi-h"><span>Tickets</span></div><div class="kpi-v">${fmt.num(ok.length)}</div></div>
        <div class="card kpi"><div class="kpi-h"><span>Promedio</span></div><div class="kpi-v">${fmt.money(ok.length ? total / ok.length : 0)}</div></div>
        <div class="card kpi"><div class="kpi-h"><span>Anuladas</span></div><div class="kpi-v">${fmt.num(list.length - ok.length)}</div></div>`;
      $('#vtb').innerHTML = list.slice(0, limit).map(saleRow).join('') +
        (list.length > limit ? `<tr><td colspan="5" class="center"><button class="btn ghost sm" id="more">Mostrar más (${list.length - limit} restantes)</button></td></tr>` : '') ||
        `<tr><td colspan="5"><div class="empty">${icon('receipt')}<p>No hay ventas en este período.</p></div></td></tr>`;
      if (!list.length) $('#vtb').innerHTML = `<tr><td colspan="5"><div class="empty">${icon('receipt')}<p>No hay ventas en este período.</p></div></td></tr>`;
    };
    draw();
    $('#vper').onclick = e => { const b = e.target.closest('[data-p]'); if (b) { f.period = b.dataset.p; limit = 80; draw(); } };
    $('#vmet').onchange = e => { f.method = e.target.value; draw(); };
    $('#vq').oninput = debounce(e => { f.q = e.target.value; draw(); }, 100);
    $('#vexp').onclick = () => {
      const rows = [['ticket', 'fecha', 'hora', 'estado', 'medio', 'items', 'subtotal', 'descuento', 'total'],
        ...filtered().reverse().map(s => [s.n, fmt.date(s.ts), fmt.time(s.ts), s.status === 'void' ? 'anulada' : 'ok', PAY_METHODS[s.payments[0].method].label, s.items.map(i => `${i.qty}x ${i.name}`).join(' | '), s.subtotal, s.discount, s.total])];
      download(`ventas-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows), 'text/csv'); toast('Ventas exportadas');
    };
    root.addEventListener('click', e => {
      if (e.target.id === 'more') { limit += 120; draw(); return; }
      const tr = e.target.closest('[data-sale]'); if (tr) saleDetail(tr.dataset.sale);
    });
    root.addEventListener('keydown', e => { const tr = e.target.closest?.('[data-sale]'); if (tr && e.key === 'Enter') saleDetail(tr.dataset.sale); });
    return { update: draw };
  },
};

function saleDetail(id) {
  const s = S.get().sales.find(x => x.id === id); if (!s) return;
  modal({
    title: `Venta #${s.n}`, size: 'sm',
    body: `<div class="ticket-prev">${ticketHTML(s)}</div>${s.status === 'void' ? `<p class="muted small center">Anulada el ${fmt.dateTime(s.voidedAt)}${s.voidReason ? ` · ${esc(s.voidReason)}` : ''}</p>` : ''}`,
    foot: `${s.status !== 'void' ? `<button class="btn ghost danger" id="vVoid">${icon('ban')} Anular</button>` : ''}<button class="btn ghost" id="vPrint">${icon('print')} Reimprimir</button><button class="btn primary" data-close>Cerrar</button>`,
    onMount(w, close) {
      $('#vPrint', w).onclick = () => printHTML(ticketHTML(s));
      const vb = $('#vVoid', w);
      if (vb) vb.onclick = async () => {
        const reason = await confirmBox({ title: `Anular venta #${s.n}`, text: `Se devuelve al stock lo vendido y el ticket queda marcado como anulado. Total: <b>${fmt.money(s.total)}</b>.`, ok: 'Anular venta', danger: true, input: 'Motivo (opcional)' });
        if (reason === null) return;
        S.voidSale(s.id, reason); toast(`Venta #${s.n} anulada`); close();
      };
    },
  });
}

// =====================================================================
// CAJA
// =====================================================================
function openCashModal(after) {
  const last = S.get().sessions.filter(s => s.closedAt).slice(-1)[0];
  modal({
    title: 'Abrir caja', size: 'sm',
    body: `<p class="muted">Contá el efectivo con el que arrancás el turno.</p>
      <label class="field"><span>Efectivo inicial</span><div class="money-in"><i>$</i><input id="oa" class="big mono" inputmode="numeric" value="${last ? last.openAmount : 20000}" autofocus></div></label>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="oaOk">${icon('unlock')} Abrir caja</button>`,
    onMount(w, close) {
      const go = () => { try { S.openSession(parseMoney($('#oa', w).value)); toast('Caja abierta'); close(); after?.(); } catch (e) { toast(e.message, 'err'); } };
      $('#oaOk', w).onclick = go; $('#oa', w).onkeydown = e => e.key === 'Enter' && go();
      $('#oa', w).onfocus = e => e.target.select();
    },
  });
}

VIEWS.caja = {
  title: 'Caja',
  sub: () => S.session() ? `Turno iniciado el ${fmt.dateTime(S.session().openedAt)}` : 'Apertura, movimientos y cierre con arqueo',
  mount(root) {
    const draw = () => {
      const s = S.session();
      const hist = S.get().sessions.filter(x => x.closedAt).slice(-15).reverse();
      const histHTML = `<section class="card flush"><div class="card-h pad"><h3>Cierres anteriores</h3></div><div class="table-wrap"><table class="table">
        <thead><tr><th>Fecha</th><th>Horario</th><th class="r">Ventas</th><th class="r">Facturado</th><th class="r">Esperado</th><th class="r">Contado</th><th class="r">Diferencia</th></tr></thead>
        <tbody>${hist.map(h => { const d = h.counted - h.expected; return `<tr><td>${fmt.date(h.openedAt)}</td><td>${fmt.time(h.openedAt)} – ${fmt.time(h.closedAt)}</td><td class="r">${h.count}</td><td class="r mono">${fmt.money(h.total)}</td><td class="r mono">${fmt.money(h.expected)}</td><td class="r mono">${fmt.money(h.counted)}</td><td class="r mono"><span class="${d === 0 ? 'green' : 'red'}">${d === 0 ? 'Exacto' : (d > 0 ? '+' : '−') + fmt.money(Math.abs(d))}</span></td></tr>`; }).join('') || '<tr><td colspan="7"><div class="empty"><p>Todavía no hay cierres.</p></div></td></tr>'}</tbody></table></div></section>`;

      if (!s) {
        root.innerHTML = `<section class="card hero-empty">${icon('lock', 'xl')}<h2>La caja está cerrada</h2><p class="muted">Abrí la caja para empezar a registrar ventas. Al cerrar vas a hacer el arqueo y ver si el efectivo coincide.</p><button class="btn primary lg" id="openBtn">${icon('unlock')} Abrir caja</button></section>${histHTML}`;
        $('#openBtn').onclick = () => openCashModal();
        return;
      }
      const sum = S.sessionSummary(s);
      const other = sum.total - sum.cashSales;
      const moves = [
        { ts: s.openedAt, label: 'Apertura de caja', amount: s.openAmount, kind: 'open' },
        ...s.moves.map(m => ({ ts: m.ts, label: m.note, amount: m.type === 'in' ? m.amount : -m.amount, kind: m.type })),
      ].sort((a, b) => b.ts - a.ts);
      root.innerHTML = `
      <section class="grid cash-grid">
        <div class="card expected">
          <span class="muted">Efectivo esperado en caja</span>
          <b class="mono">${fmt.money(sum.expected)}</b>
          <div class="eq"><span>${fmt.money(s.openAmount)} inicial</span><span>+ ${fmt.money(sum.cashSales)} ventas</span><span>+ ${fmt.money(sum.ins)} ingresos</span><span>− ${fmt.money(sum.outs)} retiros</span></div>
          <div class="actions">
            <button class="btn ghost" data-mv="in">${icon('arrowIn')} Ingreso</button>
            <button class="btn ghost" data-mv="out">${icon('arrowOut')} Retiro</button>
            <button class="btn primary" id="closeBtn">${icon('lock')} Cerrar caja</button>
          </div>
        </div>
        <div class="card">
          <div class="card-h"><h3>Ventas del turno</h3><span class="muted">${sum.count} tickets</span></div>
          <div class="big-n mono">${fmt.money(sum.total)}</div>
          <ul class="legend wide">${Object.entries(PAY_METHODS).map(([k, m]) => `<li><i style="background:${m.color}"></i><span>${m.label}</span><b class="mono">${fmt.money(sum.byMethod[k] || 0)}</b></li>`).join('')}</ul>
          <p class="muted small">En otros medios: ${fmt.money(other)} (no suman al efectivo).</p>
        </div>
      </section>
      <section class="card">
        <div class="card-h"><h3>Movimientos de efectivo</h3></div>
        <ul class="moves">${moves.map(m => `<li><span class="mv-i ${m.kind}">${icon(m.kind === 'out' ? 'arrowOut' : m.kind === 'in' ? 'arrowIn' : 'unlock')}</span><div><b>${esc(m.label)}</b><small>${fmt.time(m.ts)}</small></div><b class="mono ${m.amount < 0 ? 'red' : ''}">${m.amount < 0 ? '−' : '+'}${fmt.money(Math.abs(m.amount))}</b></li>`).join('')}</ul>
      </section>
      ${histHTML}`;
      root.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => moveModal(b.dataset.mv));
      $('#closeBtn').onclick = () => closeCashModal();
    };
    draw();
    return { update: () => { draw(); $('#pageSub').textContent = VIEWS.caja.sub(); } };
  },
};

function moveModal(type) {
  modal({
    title: type === 'in' ? 'Registrar ingreso de efectivo' : 'Registrar retiro de efectivo', size: 'sm',
    body: `<label class="field"><span>Monto</span><div class="money-in"><i>$</i><input id="mvA" class="big mono" inputmode="numeric" autofocus></div></label>
      <label class="field"><span>Concepto</span><input id="mvN" placeholder="${type === 'in' ? 'Ej.: cambio, aporte' : 'Ej.: pago a proveedor, retiro'}"></label>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="mvOk">Registrar</button>`,
    onMount(w, close) {
      const go = () => { try { S.addMove(type, parseMoney($('#mvA', w).value), $('#mvN', w).value.trim()); toast('Movimiento registrado'); close(); } catch (e) { toast(e.message, 'err'); } };
      $('#mvOk', w).onclick = go; w.onkeydown = e => e.key === 'Enter' && go();
    },
  });
}

function closeCashModal() {
  const s = S.session(); const sum = S.sessionSummary(s);
  const DEN = [20000, 10000, 2000, 1000, 500, 200, 100];
  modal({
    title: 'Cerrar caja · arqueo', size: 'md',
    body: `
      <div class="seg block" id="cmode"><button data-cm="total" class="on">Ingresar total</button><button data-cm="bills">Contar billetes</button></div>
      <div id="cmTotal"><label class="field"><span>Efectivo contado</span><div class="money-in"><i>$</i><input id="cnt" class="big mono" inputmode="numeric" autofocus placeholder="0"></div></label></div>
      <div id="cmBills" hidden><div class="bills">${DEN.map(d => `<label><span>${fmt.money(d)}</span><input type="number" min="0" inputmode="numeric" data-den="${d}" placeholder="0"></label>`).join('')}</div></div>
      <div class="arqueo">
        <div><span>Esperado</span><b class="mono">${fmt.money(sum.expected)}</b></div>
        <div><span>Contado</span><b class="mono" id="aqC">${fmt.money(0)}</b></div>
        <div class="diff" id="aqD"><span>Diferencia</span><b class="mono">—</b></div>
      </div>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="cOk" disabled>${icon('lock')} Confirmar cierre</button>`,
    onMount(w, close) {
      let mode = 'total';
      const counted = () => mode === 'total' ? parseMoney($('#cnt', w).value) : $$('[data-den]', w).reduce((a, i) => a + (+i.value || 0) * +i.dataset.den, 0);
      const touched = () => mode === 'total' ? $('#cnt', w).value.trim() !== '' : $$('[data-den]', w).some(i => i.value !== '');
      const calc = () => {
        const c = counted(), d = c - sum.expected;
        $('#aqC', w).textContent = fmt.money(c);
        const el = $('#aqD', w);
        el.className = 'diff ' + (!touched() ? '' : d === 0 ? 'ok' : 'bad');
        el.querySelector('b').textContent = !touched() ? '—' : d === 0 ? 'Cuadra exacto' : (d > 0 ? 'Sobran ' : 'Faltan ') + fmt.money(Math.abs(d));
        $('#cOk', w).disabled = !touched();
      };
      w.addEventListener('input', calc);
      $('#cmode', w).onclick = e => {
        const b = e.target.closest('[data-cm]'); if (!b) return; mode = b.dataset.cm;
        $$('#cmode button', w).forEach(x => x.classList.toggle('on', x === b));
        $('#cmTotal', w).hidden = mode !== 'total'; $('#cmBills', w).hidden = mode === 'total'; calc();
      };
      $('#cOk', w).onclick = () => {
        const z = S.closeSession(counted()); close();
        const d = z.counted - z.expected;
        toast(d === 0 ? 'Caja cerrada · cuadra exacto' : `Caja cerrada · diferencia ${fmt.money(d)}`, d === 0 ? 'ok' : 'err');
        zReport(z);
      };
    },
  });
}

function zReport(z) {
  const b = S.get().business;
  const sum = S.sessionSummary(z);
  const html = `<div class="ticket">
    <div class="tk-c"><b class="tk-name">${esc(b.name)}</b><div>CIERRE DE CAJA</div></div><div class="tk-sep"></div>
    <div class="tk-row"><span>Apertura</span><span>${fmt.dateTime(z.openedAt)}</span></div>
    <div class="tk-row"><span>Cierre</span><span>${fmt.dateTime(z.closedAt)}</span></div><div class="tk-sep"></div>
    <div class="tk-row"><span>Tickets</span><span>${sum.count}</span></div>
    ${Object.entries(PAY_METHODS).map(([k, m]) => `<div class="tk-row"><span>${m.label}</span><span>${fmt.moneyExact(sum.byMethod[k] || 0)}</span></div>`).join('')}
    <div class="tk-row tk-total"><span>TOTAL VENDIDO</span><span>${fmt.moneyExact(sum.total)}</span></div><div class="tk-sep"></div>
    <div class="tk-row"><span>Efectivo inicial</span><span>${fmt.moneyExact(z.openAmount)}</span></div>
    <div class="tk-row"><span>Ingresos</span><span>${fmt.moneyExact(sum.ins)}</span></div>
    <div class="tk-row"><span>Retiros</span><span>−${fmt.moneyExact(sum.outs)}</span></div>
    <div class="tk-row"><span>Esperado</span><span>${fmt.moneyExact(z.expected)}</span></div>
    <div class="tk-row"><span>Contado</span><span>${fmt.moneyExact(z.counted)}</span></div>
    <div class="tk-row tk-total"><span>DIFERENCIA</span><span>${fmt.moneyExact(z.counted - z.expected)}</span></div>
  </div>`;
  modal({
    title: 'Resumen de cierre', size: 'sm', body: `<div class="ticket-prev">${html}</div>`,
    foot: `<button class="btn ghost" id="zP">${icon('print')} Imprimir</button><button class="btn primary" data-close>Listo</button>`,
    onMount(w) { $('#zP', w).onclick = () => printHTML(html); },
  });
}

// =====================================================================
// AJUSTES
// =====================================================================
VIEWS.ajustes = {
  title: 'Ajustes',
  sub: () => 'Datos del comercio y respaldo',
  mount(root) {
    const b = S.get().business;
    root.innerHTML = `
    <section class="grid two">
      <form class="card" id="bizF">
        <div class="card-h"><h3>Datos del comercio</h3><span class="muted small">Aparecen en los tickets</span></div>
        <div class="form-grid">
          <label class="field span2"><span>Nombre del comercio</span><input name="name" value="${esc(b.name)}" required></label>
          <label class="field"><span>CUIT</span><input name="cuit" value="${esc(b.cuit)}"></label>
          <label class="field"><span>Teléfono</span><input name="phone" value="${esc(b.phone)}"></label>
          <label class="field span2"><span>Dirección</span><input name="address" value="${esc(b.address)}"></label>
          <label class="field span2"><span>Mensaje al pie del ticket</span><input name="footer" value="${esc(b.footer)}"></label>
        </div>
        <div class="row-end"><button class="btn primary">Guardar</button></div>
      </form>
      <div class="stack">
        <section class="card">
          <div class="card-h"><h3>Respaldo</h3></div>
          <p class="muted small">Los datos se guardan en este dispositivo. Descargá un respaldo seguido o pasalo a otro equipo.</p>
          <div class="row"><button class="btn ghost" id="bk">${icon('download')} Descargar respaldo</button><button class="btn ghost" id="rs">${icon('upload')} Restaurar</button><input type="file" id="rsF" accept=".json,application/json" hidden></div>
        </section>
        <section class="card">
          <div class="card-h"><h3>Datos de demostración</h3></div>
          <p class="muted small">Volvé a cargar el almacén de ejemplo con dos semanas de ventas, o empezá de cero con tus propios productos.</p>
          <div class="row"><button class="btn ghost" id="demo">Restaurar demo</button><button class="btn ghost danger" id="wipe">${icon('trash')} Empezar de cero</button></div>
        </section>
        <section class="card about">
          <span class="logo sm">${logoSVG()}</span>
          <div><b>Zenix Caja</b><p class="muted small">Punto de venta hecho por Zenix AR — Soluciones Digitales. Funciona sin internet y se instala como app.</p></div>
        </section>
      </div>
    </section>`;
    $('#bizF').onsubmit = e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target)); if (!d.name.trim()) return toast('El nombre es obligatorio', 'err'); S.saveBusiness({ ...d, demo: false }); toast('Datos guardados'); };
    $('#bk').onclick = () => { download(`zenix-caja-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.get()), 'application/json'); toast('Respaldo descargado'); };
    $('#rs').onclick = () => $('#rsF').click();
    $('#rsF').onchange = async e => {
      const file = e.target.files[0]; e.target.value = ''; if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        if (!await confirmBox({ title: 'Restaurar respaldo', text: 'Se reemplazan <b>todos</b> los datos actuales por los del archivo.', ok: 'Restaurar', danger: true })) return;
        S.importBackup(obj); toast('Respaldo restaurado'); route();
      } catch (err) { toast(err.message.includes('JSON') ? 'El archivo no se pudo leer' : err.message, 'err'); }
    };
    $('#demo').onclick = async () => { if (await confirmBox({ title: 'Restaurar demo', text: 'Se reemplazan los datos actuales por el almacén de ejemplo.', ok: 'Restaurar demo', danger: true })) { S.resetDemo(); pos.cart = []; saveCart(); toast('Demo restaurada'); route(); } };
    $('#wipe').onclick = async () => { if (await confirmBox({ title: 'Empezar de cero', text: 'Se borran productos, ventas y cierres. Se mantienen los datos del comercio y las categorías.', ok: 'Borrar todo', danger: true })) { S.wipe(); pos.cart = []; saveCart(); toast('Listo, sistema vacío'); route(); } };
  },
};

// ---------- teclado global y lector de código "tipo teclado" ----------
let scanBuf = '', scanT = 0;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); modalStack[modalStack.length - 1](); return; }
  if (modalStack.length) return;
  if (e.key === 'F2' && document.body.dataset.view !== 'vender') { e.preventDefault(); location.hash = '#/vender'; return; }
  current?.key?.(e);
  const inField = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if (inField || document.body.dataset.view !== 'vender') return;
  const now = performance.now();
  if (now - scanT > 60) scanBuf = '';
  scanT = now;
  if (e.key === 'Enter' && scanBuf.length >= 6) { current?.scan?.(scanBuf); scanBuf = ''; e.preventDefault(); }
  else if (/^\d$/.test(e.key)) scanBuf += e.key;
});

// ---------- PWA ----------
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; const b = $('#installBtn'); if (b) b.hidden = false; });
document.addEventListener('click', async e => {
  if (e.target.closest('#installBtn') && installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('#installBtn').hidden = true; }
});

// ---------- arranque ----------
S.load();
shell();
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
