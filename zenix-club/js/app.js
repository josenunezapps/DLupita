// Zenix Club — fidelización con tarjeta de sellos digital.
import * as S from './store.js';
import { fmt, esc, DAY, debounce, download, toCSV, encodeShare, decodeShare, startOfDay } from './util.js';
import { qrSVG } from './qr.js';

const I = {
  stamp: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8S10.5 3 7.5 3.5 7 8 12 8Zm0 0s1.5-5 4.5-4.5S17 8 12 8Z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.5-4.5"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  wa: '<path d="M3.5 20.5l1.2-4.3A8.5 8.5 0 1 1 8 19.5z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1.2-1 .9c-1-.4-2.2-1.6-2.6-2.6l.9-1-1.2-2z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', cake: '<path d="M4 21h16v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 16c2 1 4 1 6 0s4-1 6 0 3 1 4 0M12 11V7M12 4.5v.5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
  download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5"/><path d="M4 17v3h16v-3"/>', upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M4 17v3h16v-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18z"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>', key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M15 8l2 2"/>',
};
const icon = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NAV = [['sumar', 'Sumar sellos', 'stamp'], ['inicio', 'Tablero', 'home'], ['clientes', 'Clientes', 'users'], ['programa', 'Programa', 'gift']];
const DIAS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const first = name => String(name).split(' ')[0];
const waPhone = p => { const d = S.normPhone(p); return d ? '549' + d : ''; };
const wa = (phone, text) => window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
const ago = ts => { const d = S.daysSince(ts); return d === 0 ? 'hoy' : d === 1 ? 'ayer' : d < 30 ? `hace ${d} días` : d < 60 ? 'hace un mes' : `hace ${Math.round(d / 30)} meses`; };
// corre un comando (puede ir a la nube) y muestra el error si falla
async function act(fn, btn) {
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try { return await fn(); } catch (e) { toast(e.message || 'Algo salió mal', 'err'); if (e.sessionLost) setTimeout(route, 1200); return undefined; } finally { if (btn) btn.disabled = false; }
}
const ask = (title, text, okLabel, cls = 'primary') => new Promise(res => {
  let done = false;
  modal({ title, size: 'sm', body: `<p>${text}</p>`, foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn ${cls}" id="askOk">${esc(okLabel)}</button>`,
    onMount: (w, close) => { $('#askOk', w).onclick = () => { done = true; close(); res(true); }; new MutationObserver((_, o) => { if (!w.isConnected) { o.disconnect(); if (!done) res(false); } }).observe($('#modals'), { childList: true }); } });
});

// ---------- tarjeta (compartida entre la app y el link del cliente) ----------
function cardHTML({ b, c, compact = false }) {
  const g = b.g, filled = c.s % g || (c.s > 0 && c.s % g === 0 ? g : 0), ready = Math.floor(c.s / g);
  const shown = ready > 0 ? g : filled;
  return `<div class="card3d ${compact ? 'compact' : ''}" style="--brand:${esc(b.c)}">
    <div class="card-in">
      <div class="card-top"><span class="card-logo">${esc(b.e || '★')}</span><div><b>${esc(b.n)}</b><small>Club de clientes</small></div></div>
      <div class="card-name">${esc(c.n)}</div>
      <div class="stamps" style="--g:${g}">${Array.from({ length: g }, (_, i) => `<span class="st ${i < shown ? 'on' : ''} ${i === shown && !ready ? 'next' : ''}">${i < shown ? esc(b.e || '★') : i === g - 1 ? '🎁' : ''}</span>`).join('')}</div>
      <div class="card-foot">${ready ? `<b class="ready">🎉 ¡Tenés ${ready > 1 ? ready + ' premios' : 'tu premio'}!</b>` : `<b>${shown} de ${g}</b><span>Te ${g - shown === 1 ? 'falta 1 sello' : `faltan ${g - shown} sellos`}</span>`}</div>
      <div class="card-reward">${icon('gift')} ${esc(b.r)}</div>
    </div>
  </div>`;
}
const cardData = c => ({ b: { n: S.get().biz.name, e: S.get().biz.emoji, c: S.get().biz.color, g: S.goal(), r: S.get().biz.reward }, c: { n: c.name, s: c.stamps } });

// ---------- shell ----------
let current = null;
function shell() {
  document.body.innerHTML = `
  <header class="top">
    <a class="brand" href="#/sumar"><span class="logo">${logo()}</span><span><b>Zenix</b> Club</span></a>
    <nav class="nav">${NAV.map(([id, l, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <span class="biz" id="bizName"></span>
  </header>
  <main id="view"></main>
  <nav class="tabbar">${NAV.map(([id, l, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic)}<span>${l.split(' ')[0]}</span></a>`).join('')}</nav>
  <div id="modals"></div><div id="toasts" aria-live="polite"></div><canvas id="confetti"></canvas>`;
}
function chrome() { const b = S.get().biz; $('#bizName').innerHTML = `<span class="em">${esc(b.emoji)}</span>${esc(b.name)}${S.getMode() === 'demo' ? '<small>demo</small>' : `<small class="who" title="Datos guardados en la nube">${icon('cloud')} ${esc(S.me()?.name || '')}</small>`}`; document.documentElement.style.setProperty('--brand', b.color); }

function toast(msg, type = 'ok', action) {
  // un solo aviso a la vez en el mostrador: el nuevo reemplaza al anterior
  $$('#toasts .toast').forEach(t => t.remove());
  const el = document.createElement('div'); el.className = 'toast ' + type;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) $('button', el).onclick = () => { action.run(); el.remove(); };
  $('#toasts').appendChild(el); requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, action ? 6000 : type === 'err' ? 4000 : 2400);
}
const stack = [];
function modal({ title, body, foot = '', onMount, size = '' }) {
  const w = document.createElement('div'); w.className = 'mw';
  w.innerHTML = `<div class="modal ${size}" role="dialog" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></header><div class="mb">${body}</div>${foot ? `<footer>${foot}</footer>` : ''}</div>`;
  $('#modals').appendChild(w);
  const close = () => { if (!w.isConnected) return; w.classList.remove('in'); stack.splice(stack.indexOf(close), 1); setTimeout(() => w.remove(), 180); };
  w.addEventListener('mousedown', e => { if (e.target === w) close(); }); $$('[data-close]', w).forEach(b => b.onclick = close);
  stack.push(close); requestAnimationFrame(() => w.classList.add('in')); onMount?.(w, close);
  setTimeout(() => $('[autofocus]', w)?.focus(), 40); return close;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1](); });

// confeti cuando alguien completa la tarjeta
function confetti() {
  const cv = $('#confetti'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#0f6b4f'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.4, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 16 - 4, r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4 }));
  let t = 0;
  (function f() {
    ctx.clearRect(0, 0, cv.width, cv.height); t++;
    for (const p of ps) { p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }
    if (t < 150) requestAnimationFrame(f); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ---------- rutas ----------
const VIEWS = {};
async function route() {
  // links públicos: /t/<token> y /u/<club>/<ref> (club.zenix.com.ar) o sus equivalentes con #
  const pm = location.pathname.match(/\/(t|u)\/([A-Za-z0-9-]+)(?:\/([A-Za-z0-9]+))?\/?$/);
  const [id, arg, arg2] = pm && !location.hash ? [pm[1], pm[2], pm[3]] : location.hash.replace(/^#\/?/, '').split('/');
  while (stack.length) stack[stack.length - 1]();
  current?.destroy?.(); current = null;
  if (id === 'tarjeta') return publicCard(arg);
  if (id === 't') return liveCard(arg);
  if (id === 'u' || id === 'unirme') return joinPage(arg, arg2);
  if (S.getMode() === 'none') {
    // embebida en otra página (mockups de Zenix) o con ?demo: abre la demo directo
    let framed = false; try { framed = window.self !== window.top; } catch { framed = true; }
    if (framed || new URLSearchParams(location.search).has('demo')) S.startDemo(); else return onboarding();
  }
  if (!S.get()) return loadingScreen();
  if (!$('.top')) shell();
  const v = VIEWS[id] ? id : 'sumar';
  document.body.dataset.view = v;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === v));
  const old = $('#view'), root = old.cloneNode(false); old.replaceWith(root);
  current = VIEWS[v](root, arg) || {};
  chrome(); window.scrollTo(0, 0);
}
S.subscribe(() => { if ($('.top')) chrome(); if (!stack.length) current?.update?.(); });

// =====================================================================
// SUMAR SELLOS (la pantalla de mostrador)
// =====================================================================
VIEWS.sumar = (root, preId) => {
  let selected = preId ? S.byId(preId) : null;
  const b = S.get().biz;
  root.innerHTML = `
  <div class="counter">
    <section class="find">
      ${S.isDoubleToday() ? `<div class="promo">${icon('bolt')} Hoy es ${DIAS[new Date().getDay()].replace(/s$/, '')}: <b>cada visita suma doble</b></div>` : ''}
      <label class="bigsearch">${icon('search')}<input id="q" placeholder="Teléfono o nombre del cliente" autocomplete="off" inputmode="search"></label>
      <div id="results" class="results"></div>
      <div class="recent"><h3>Últimas visitas</h3><div id="recent"></div></div>
    </section>
    <section class="panel" id="panel"></section>
  </div>`;
  const q = $('#q');
  const row = c => `<button class="crow ${selected?.id === c.id ? 'on' : ''}" data-c="${c.id}"><span class="av" style="--h:${hue(c.name)}">${esc(initials(c.name))}</span><span class="cr-t"><b>${esc(c.name)}</b><small>${esc(c.phone)} · ${ago(S.lastVisit(c))}</small></span><span class="cr-s">${S.rewardsReady(c) ? '🎁' : `${c.stamps % S.goal()}/${S.goal()}`}</span></button>`;
  const drawResults = () => {
    const term = q.value.trim();
    const res = S.search(term);
    $('#results').innerHTML = !term ? '' : res.map(row).join('') + (res.length ? '' : `<div class="none"><p>No hay nadie con “${esc(term)}”.</p></div>`) +
      `<button class="crow new" id="newBtn">${icon('plus')}<span class="cr-t"><b>Sumar cliente nuevo</b><small>${/\d{6,}/.test(term.replace(/\D/g, '')) ? 'Con el teléfono ' + esc(term) : 'En 10 segundos, solo nombre y teléfono'}</small></span></button>`;
    const recent = S.get().customers.slice().sort((a, b) => S.lastVisit(b) - S.lastVisit(a)).slice(0, 6);
    $('#recent').innerHTML = recent.map(row).join('');
    $('.recent').hidden = !!term;
  };
  const drawPanel = () => {
    const p = $('#panel');
    if (!selected) { p.innerHTML = `<div class="hint-empty"><div class="hint-card">${cardHTML({ ...cardData({ name: 'Tu cliente', stamps: 3 }), compact: true })}</div><h2>Buscá al cliente</h2><p class="muted">Escribí su teléfono o nombre. Si es nuevo, lo sumás en un toque y le mandás su tarjeta por WhatsApp.</p></div>`; return; }
    const c = S.byId(selected.id); if (!c) { selected = null; return drawPanel(); }
    selected = c;
    const b = S.get().biz, ready = S.rewardsReady(c), bd = S.birthdaySoon(c, 0), refBy = S.referrerOf(c);
    const askReview = b.reviewUrl && (c.visits || 0) >= (+b.reviewAfter || 3) && !S.reviewAsked(c.id);
    p.innerHTML = `
      <div class="p-head"><button class="icon-btn mob-only" id="backList" aria-label="Volver">${icon('back')}</button><div><h2>${esc(c.name)}</h2><p class="muted">${esc(c.phone)} · ${plural(c.visits || 0, 'visita', 'visitas')} · cliente desde ${fmt.dateShort(c.createdAt)}</p></div></div>
      ${bd === 0 ? `<div class="promo bd">${icon('cake')} ¡Hoy cumple años! Regalo: <b>${esc(b.birthdayGift || 'un detalle de la casa')}</b></div>` : ''}
      ${refBy && !c.refPaid && !(c.visits || 0) && +b.refBonus ? `<div class="promo ref">${icon('share')} <span>Lo recomendó <b>${esc(refBy.name)}</b>: con esta primera visita ganan <b>+${b.refBonus}</b> los dos.</span></div>` : ''}
      ${refBy && c.refPaid && (c.visits || 0) === 1 ? `<div class="promo ref">${icon('share')} <span><b>${esc(first(refBy.name))}</b> ganó +${b.refBonus} por recomendarlo.</span><button class="btn ghost sm" id="tellRef">${icon('wa')} Avisarle</button></div>` : ''}
      <div class="p-card" id="pcard">${cardHTML(cardData(c))}</div>
      <div class="actions">
        <button class="btn primary xl" id="add1">${icon('stamp')} Sumar sello${S.isDoubleToday() ? ' <em>×2</em>' : ''}</button>
        ${ready ? `<button class="btn gift xl" id="redeem">${icon('gift')} Canjear premio</button>` : ''}
        <div class="row2"><button class="btn ghost" id="add2">+2 sellos</button><button class="btn ghost" id="send">${icon('wa')} Enviar tarjeta</button></div>
        ${askReview ? `<button class="btn ghost review" id="review">${icon('star')} Pedirle una reseña en Google</button>` : ''}
      </div>`;
    $('#add1').onclick = e => doStamp(1, e.currentTarget);
    $('#add2').onclick = e => doStamp(2, e.currentTarget);
    $('#redeem')?.addEventListener('click', doRedeem);
    $('#send').onclick = () => sendCard(c);
    $('#review')?.addEventListener('click', () => sendCard(c, 'review'));
    $('#tellRef')?.addEventListener('click', () => sendCard(refBy, 'refgift', c));
    $('#backList')?.addEventListener('click', () => { selected = null; document.body.classList.remove('picked'); drawPanel(); drawResults(); q.focus(); });
  };
  function pick(id) { selected = S.byId(id); document.body.classList.add('picked'); drawPanel(); drawResults(); if (innerWidth > 900) setTimeout(() => $('#add1')?.focus(), 50); }
  const undo = id => act(async () => { await S.undoLast(id); drawPanel(); drawResults(); toast('Listo, se deshizo'); });
  async function doStamp(n, btn, force = false) {
    const id = selected.id;
    let r;
    try { if (btn) btn.disabled = true; r = await S.stamp(id, n, force); }
    catch (e) {
      if (e.code === 'recent') {
        $$('#toasts .toast').forEach(t => t.remove());
        // antifraude: avisa si ya le sumaron hace poco y deja seguir solo a propósito (queda registrado)
        if (await ask('¿Sumar otro sello?', `${esc(e.message)} Si de verdad volvió, podés sumarlo igual: queda marcado en el historial.`, 'Sumar igual')) return doStamp(n, null, true);
        return;
      }
      return toast(e.message, 'err');
    } finally { if (btn?.isConnected) btn.disabled = false; }
    const c = S.byId(id);
    drawPanel(); drawResults();
    $('#pcard .card3d')?.classList.add('bump');
    if (r.justCompleted) { confetti(); toast(`¡${first(c.name)} completó la tarjeta! Ya puede canjear su premio.`, 'ok', { label: 'Avisarle', run: () => sendCard(c, 'ready') }); }
    else if (r.referrer) toast(`+${r.added} para ${first(c.name)} y +${S.get().biz.refBonus} para ${first(r.referrer.name)}, que lo recomendó 🤝`, 'ok', { label: 'Deshacer', run: () => undo(id) });
    else toast(`+${r.added} ${r.added === 1 ? 'sello' : 'sellos'}${r.double ? ' (doble del día)' : ''} para ${first(c.name)}`, 'ok', { label: 'Deshacer', run: () => undo(id) });
  }
  function doRedeem() {
    const c = S.byId(selected.id), b = S.get().biz;
    const recent = S.get().events.filter(e => e.cid === c.id && e.type === 'stamp').slice(-3).reverse();
    modal({ title: 'Canjear premio', size: 'sm', body: `<div class="redeem-box"><span>🎁</span><b>${esc(b.reward)}</b><p class="muted">para ${esc(c.name)}. Se descuentan ${S.goal()} sellos de su tarjeta.</p></div>
      ${recent.length ? `<h4 class="sub">Últimos sellos</h4><ul class="hist">${recent.map(e => `<li><span>+${e.n}${e.flag === 'forced' ? ' ⚠️' : ''}${S.staffName(e.by) ? ' · ' + esc(S.staffName(e.by)) : ''}</span><time>${fmt.dateTime(e.ts)}</time></li>`).join('')}</ul>` : ''}`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn gift" id="okR">Entregar premio</button>`,
      onMount: (w, close) => $('#okR', w).onclick = e => act(async () => { await S.redeem(c.id); close(); drawPanel(); drawResults(); confetti(); toast(`Premio entregado a ${first(c.name)} 🎉`, 'ok', { label: 'Deshacer', run: () => undo(c.id) }); }, e.currentTarget) });
  }
  root.addEventListener('click', e => {
    const r = e.target.closest('[data-c]'); if (r) return pick(r.dataset.c);
    if (e.target.closest('#newBtn')) return newCustomer(q.value.trim(), c => { q.value = ''; pick(c.id); sendCard(c, 'welcome'); });
  });
  q.oninput = debounce(drawResults, 60);
  q.onkeydown = e => { if (e.key === 'Enter') { const r = S.search(q.value); if (r.length === 1 || (r.length && /^\d+$/.test(q.value.replace(/\D/g, '')))) pick(r[0].id); else if (!r.length && q.value.trim()) $('#newBtn')?.click(); } };
  drawResults(); drawPanel();
  if (selected) document.body.classList.add('picked'); else document.body.classList.remove('picked');
  if (innerWidth > 900 && !selected) setTimeout(() => q.focus(), 40);
  return { destroy() { document.body.classList.remove('picked'); }, update() { if (document.activeElement !== q) { drawResults(); drawPanel(); } } };
};

function newCustomer(prefill = '', onDone) {
  const isPhone = /\d{4,}/.test(prefill.replace(/\D/g, '')) && !/[a-zá-ú]/i.test(prefill);
  const b = S.get().biz;
  modal({
    title: 'Cliente nuevo', size: 'sm',
    body: `<form id="nf" class="form" onsubmit="return false">
      <label class="field"><span>Nombre</span><input name="name" ${isPhone ? 'autofocus' : ''} value="${isPhone ? '' : esc(prefill)}" placeholder="Ej.: Valentina Gómez" autocomplete="off"></label>
      <label class="field"><span>Teléfono (WhatsApp)</span><input name="phone" inputmode="tel" value="${isPhone ? esc(prefill) : ''}" placeholder="2901 471353" ${isPhone ? '' : 'autofocus'}></label>
      <label class="field"><span>Cumpleaños <i>opcional</i></span><div class="bd-in"><select name="bdd"><option value="">Día</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select><select name="bdm"><option value="">Mes</option>${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div></label>
      ${+b.welcome ? `<p class="muted small">${icon('gift')} Arranca con ${plural(+b.welcome, 'sello', 'sellos')} de bienvenida.</p>` : ''}
    </form>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="nfOk">Crear y enviar tarjeta</button>`,
    onMount(w, close) {
      let busy = false;
      const go = async () => {
        if (busy) return; busy = true;
        const d = Object.fromEntries(new FormData($('#nf', w)));
        try {
          const c = await S.addCustomer({ name: d.name, phone: d.phone, birthday: d.bdd && d.bdm ? `${String(d.bdm).padStart(2, '0')}-${String(d.bdd).padStart(2, '0')}` : '' });
          close(); toast(`${first(c.name)} ya es parte del club`); onDone?.(c);
        } catch (e) { toast(e.message, 'err'); } finally { busy = false; }
      };
      $('#nfOk', w).onclick = go; $('#nf', w).onkeydown = e => e.key === 'Enter' && e.target.tagName === 'INPUT' && go();
    },
  });
}

// En la nube el link es fijo y siempre muestra los sellos al día; en la demo, la tarjeta viaja dentro del link.
async function cardLink(c) { return S.getMode() === 'cloud' && c.token ? S.liveCardUrl(c) : location.href.split('#')[0] + '#/tarjeta/' + await encodeShare(S.cardPayload(c)); }
async function sendCard(c, kind = 'update', extra = null) {
  const b = S.get().biz, g = S.goal(), cur = Math.min(c.stamps % g || (S.rewardsReady(c) ? g : 0), g), left = g - cur;
  const url = await cardLink(c);
  if (kind === 'review') S.markReviewAsked(c.id);
  const msg = {
    welcome: `¡Hola ${first(c.name)}! 👋 Bienvenido/a al club de ${b.name} ${b.emoji}\nCon ${g} sellos te llevás: ${b.reward}.\nYa tenés ${plural(c.stamps, 'sello', 'sellos')}. Tu tarjeta:\n${url}${S.getMode() === 'cloud' && +b.refBonus ? `\nDesde ahí podés invitar amigos: cuando vengan, ganan +${b.refBonus} los dos.` : ''}`,
    ready: `¡${first(c.name)}, completaste tu tarjeta en ${b.name}! 🎉\nLa próxima vez que vengas te espera: ${b.reward}.\n${url}`,
    update: S.rewardsReady(c) ? `¡${first(c.name)}! Tenés un premio esperándote en ${b.name} 🎁\n${url}` : `¡Gracias por venir, ${first(c.name)}! ${b.emoji}\nLlevás ${cur} de ${g} sellos: te ${left === 1 ? 'falta 1' : `faltan ${left}`} para ${b.reward.toLowerCase()}.\n${url}`,
    miss: `¡Hola ${first(c.name)}! Hace rato que no te vemos por ${b.name} ${b.emoji}\n${cur ? `Tenés ${plural(cur, 'sello', 'sellos')} en tu tarjeta${left <= 3 ? ` y te ${left === 1 ? 'falta solo 1' : `faltan solo ${left}`} para tu premio` : ''}.` : `Tu próxima visita ya suma para tu próximo premio: ${b.reward.toLowerCase()}.`} ¡Te esperamos!\n${url}`,
    bday: `¡Feliz cumpleaños, ${first(c.name)}! 🎂\nEn ${b.name} te regalamos ${(b.birthdayGift || 'un detalle de la casa').toLowerCase()}: pasá a buscarlo esta semana.\n${url}`,
    review: `¡Hola ${first(c.name)}! Gracias por elegirnos siempre ${b.emoji}\n¿Nos regalás 30 segundos? Una reseña en Google nos ayuda muchísimo a que nos conozcan:\n${b.reviewUrl}`,
    refgift: `¡${first(c.name)}, gracias por recomendarnos! 🤝\n${extra ? first(extra.name) + ' vino' : 'Vino alguien'} de tu parte y te sumamos +${b.refBonus} ${+b.refBonus === 1 ? 'sello' : 'sellos'} en ${b.name}.\n${url}`,
  }[kind];
  modal({
    title: 'Enviar por WhatsApp', size: 'sm',
    body: `<div class="send-prev">${cardHTML({ ...cardData(c), compact: true })}</div><label class="field"><span>Mensaje para ${esc(first(c.name))}</span><textarea id="wm" rows="6">${esc(msg)}</textarea></label>`,
    foot: `<button class="btn ghost" id="cp">${icon('link')} Copiar link</button><button class="btn wa" id="go">${icon('wa')} Enviar</button>`,
    onMount(w, close) {
      $('#go', w).onclick = () => { wa(c.phone, $('#wm', w).value); close(); };
      $('#cp', w).onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link copiado'); } catch { toast('No se pudo copiar', 'err'); } };
    },
  });
}

// =====================================================================
// TABLERO
// =====================================================================
VIEWS.inicio = root => {
  const draw = () => {
    const s = S.stats(), b = S.get().biz;
    const delta = s.prevMonthVisits ? (s.monthVisits - s.prevMonthVisits) / s.prevMonthVisits : null;
    const max = Math.max(1, ...s.series.map(d => d.v));
    root.innerHTML = `
    <div class="ph"><h1>Tablero</h1><p class="muted">${s.today ? `Hoy ya ${s.today === 1 ? 'vino 1 cliente' : `vinieron ${s.today} clientes`} del club.` : 'Todavía nadie del club hoy.'}</p></div>
    <section class="kpis">
      <div class="kpi"><span>Visitas este mes</span><b>${s.monthVisits}</b><small>${delta === null ? '' : `<em class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(delta * 100))}%</em> vs. mismo día del mes pasado`}</small></div>
      <div class="kpi"><span>Clientes activos</span><b>${s.active}</b><small>vinieron en los últimos 30 días, de ${s.total}</small></div>
      <div class="kpi"><span>Vuelven</span><b>${Math.round(s.returnRate * 100)}%</b><small>de los clientes vino 2 veces o más</small></div>
      <div class="kpi"><span>Premios entregados</span><b>${s.monthRedeems}</b><small>este mes · ${s.monthNew} socios nuevos${s.monthReferred ? ` · ${s.monthReferred} por recomendación` : ''}${s.monthQr ? ` · ${s.monthQr} por QR` : ''}</small></div>
    </section>
    ${s.alerts.length && S.isOwner() ? `<section class="box alerts"><div class="bh"><h3>${icon('alert')} Sellos sumados pese al aviso</h3><span class="muted small">últimos 7 días</span></div>
      <ul class="list">${s.alerts.map(e => { const c = S.byId(e.cid); return `<li><div class="li"><div><b>${esc(c?.name || 'Cliente borrado')}</b><small>+${e.n} · ${fmt.dateTime(e.ts)}${S.staffName(e.by) ? ' · lo sumó ' + esc(S.staffName(e.by)) : ''}</small></div></div></li>`; }).join('')}</ul></section>` : ''}
    <section class="g21">
      <div class="box"><div class="bh"><h3>Visitas · últimos 30 días</h3><span class="muted small">${b.doubleDay !== '' && b.doubleDay !== null ? `los ${DIAS[b.doubleDay]} suman doble` : ''}</span></div>
        <div class="spark">${s.series.map((d, i) => `<i style="--v:${d.v / max}" class="${new Date(d.ts).getDay() === +b.doubleDay ? 'dbl' : ''} ${i === 29 ? 'today' : ''}" title="${fmt.date(d.ts)}: ${plural(d.v, 'visita', 'visitas')}"></i>`).join('')}</div>
        <div class="spark-x"><span>${fmt.dateShort(s.series[0].ts)}</span><span>hoy</span></div></div>
      <div class="box"><div class="bh"><h3>${icon('gift')} Premios para canjear</h3><span class="muted small">${s.ready.length}</span></div>
        <ul class="list">${s.ready.slice(0, 5).map(c => `<li><a href="#/sumar/${c.id}"><span class="av sm" style="--h:${hue(c.name)}">${esc(initials(c.name))}</span><b>${esc(c.name)}</b><small>${ago(S.lastVisit(c))}</small></a></li>`).join('') || '<li class="empty">Nadie tiene premios pendientes.</li>'}</ul></div>
    </section>
    <section class="g2">
      <div class="box"><div class="bh"><h3>${icon('clock')} Para recuperar</h3><span class="muted small">clientes fieles que dejaron de venir</span></div>
        <ul class="list">${s.lost.map(c => `<li><div class="li"><span class="av sm" style="--h:${hue(c.name)}">${esc(initials(c.name))}</span><div><b>${esc(c.name)}</b><small>${plural(c.visits, 'visita', 'visitas')} · última ${ago(S.lastVisit(c))}</small></div><button class="btn wa sm" data-miss="${c.id}">${icon('wa')} Invitar</button></div></li>`).join('') || '<li class="empty">Todos tus clientes fieles vienen seguido. 👏</li>'}</ul></div>
      <div class="box"><div class="bh"><h3>${icon('cake')} Cumpleaños</h3><span class="muted small">próximos 7 días</span></div>
        <ul class="list">${s.birthdays.map(({ c, d }) => `<li><div class="li"><span class="av sm" style="--h:${hue(c.name)}">${esc(initials(c.name))}</span><div><b>${esc(c.name)}</b><small>${d === 0 ? '🎂 ¡hoy!' : d === 1 ? 'mañana' : `en ${d} días`}</small></div><button class="btn ghost sm" data-bday="${c.id}">${icon('wa')} Saludar</button></div></li>`).join('') || '<li class="empty">No hay cumpleaños esta semana.</li>'}</ul>
        <div class="bh mt"><h3>Más fieles</h3></div>
        <ol class="rank">${s.top.map((c, i) => `<li><span class="n">${i + 1}</span><b>${esc(c.name)}</b><span class="muted">${plural(c.visits, 'visita', 'visitas')}</span></li>`).join('')}</ol></div>
    </section>`;
  };
  draw();
  root.addEventListener('click', e => {
    const m = e.target.closest('[data-miss]'); if (m) sendCard(S.byId(m.dataset.miss), 'miss');
    const bd = e.target.closest('[data-bday]'); if (bd) sendCard(S.byId(bd.dataset.bday), 'bday');
  });
  return { update: draw };
};

// =====================================================================
// CLIENTES
// =====================================================================
VIEWS.clientes = root => {
  const f = { q: '', filter: 'all' };
  root.innerHTML = `
    <div class="ph row"><div><h1>Clientes</h1><p class="muted" id="cnt"></p></div><div class="ph-a"><button class="btn ghost" id="exp">${icon('download')}<span class="hide-sm">Exportar</span></button><button class="btn primary" id="nc">${icon('plus')} Nuevo</button></div></div>
    <div class="toolbar"><label class="search">${icon('search')}<input id="cq" placeholder="Buscar por nombre o teléfono"></label>
      <div class="seg" id="seg"><button data-f="all">Todos</button><button data-f="ready">Con premio</button><button data-f="lost">Sin venir +21 días</button><button data-f="new">Nuevos del mes</button></div></div>
    <div class="box flush"><table class="table"><thead><tr><th>Cliente</th><th>Tarjeta</th><th class="hide-sm">Visitas</th><th class="hide-sm">Última visita</th><th></th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const draw = () => {
    const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime(), t = f.q.toLowerCase(), digits = f.q.replace(/\D/g, '');
    const list = S.get().customers.filter(c => (!t || c.name.toLowerCase().includes(t) || (digits.length >= 3 && S.normPhone(c.phone).includes(digits))) &&
      (f.filter === 'all' || (f.filter === 'ready' && S.rewardsReady(c)) || (f.filter === 'lost' && S.daysSince(S.lastVisit(c)) >= 21) || (f.filter === 'new' && c.createdAt >= m0)))
      .sort((a, b) => S.lastVisit(b) - S.lastVisit(a));
    $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.f === f.filter));
    $('#cnt').textContent = `${plural(list.length, 'cliente', 'clientes')}${f.filter === 'all' && !t ? ' en el club' : ''}`;
    const g = S.goal();
    $('#tb').innerHTML = list.map(c => { const cur = S.rewardsReady(c) ? g : c.stamps % g; return `<tr data-c="${c.id}">
      <td><div class="li"><span class="av sm" style="--h:${hue(c.name)}">${esc(initials(c.name))}</span><div><b>${esc(c.name)}</b><small>${esc(c.phone)}</small></div></div></td>
      <td>${S.rewardsReady(c) ? '<span class="chip gift">🎁 Premio listo</span>' : `<div class="mini"><i style="width:${cur / g * 100}%"></i></div><small class="muted">${cur}/${g}</small>`}</td>
      <td class="hide-sm">${c.visits || 0}</td><td class="hide-sm muted">${ago(S.lastVisit(c))}</td>
      <td class="r"><button class="icon-btn sm" data-edit="${c.id}" aria-label="Editar">${icon('edit')}</button></td></tr>`; }).join('') || `<tr><td colspan="5" class="empty">No hay clientes con ese filtro.</td></tr>`;
  };
  draw();
  $('#cq').oninput = debounce(e => { f.q = e.target.value; draw(); }, 80);
  $('#seg').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { f.filter = b.dataset.f; draw(); } };
  $('#nc').onclick = () => newCustomer('', c => { location.hash = '#/sumar/' + c.id; sendCard(c, 'welcome'); });
  $('#exp').onclick = () => { download(`clientes-club-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([['nombre', 'telefono', 'cumpleaños', 'sellos_actuales', 'sellos_totales', 'visitas', 'premios', 'alta', 'ultima_visita'], ...S.get().customers.map(c => [c.name, c.phone, c.birthday, c.stamps, c.total, c.visits || 0, c.redeemed || 0, fmt.date(c.createdAt), fmt.date(S.lastVisit(c))])]), 'text/csv'); toast('Clientes exportados'); };
  root.addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'); if (ed) { e.stopPropagation(); return editCustomer(ed.dataset.edit); }
    const r = e.target.closest('tr[data-c]'); if (r) location.hash = '#/sumar/' + r.dataset.c;
  });
  return { update: draw };
};

function editCustomer(id) {
  const c = S.byId(id); const [bm, bd] = (c.birthday || '-').split('-');
  const hist = S.get().events.filter(e => e.cid === id).slice(-8).reverse();
  modal({
    title: c.name, size: 'sm',
    body: `<form id="ef" class="form" onsubmit="return false">
      <label class="field"><span>Nombre</span><input name="name" value="${esc(c.name)}"></label>
      <label class="field"><span>Teléfono</span><input name="phone" value="${esc(c.phone)}" inputmode="tel"></label>
      <label class="field"><span>Cumpleaños</span><div class="bd-in"><select name="bdd"><option value="">Día</option>${Array.from({ length: 31 }, (_, i) => `<option ${+bd === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select><select name="bdm"><option value="">Mes</option>${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].map((m, i) => `<option value="${i + 1}" ${+bm === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div></label>
    </form>
    ${S.referrerOf(c) ? `<p class="muted small">${icon('share')} Vino recomendado por ${esc(S.referrerOf(c).name)}</p>` : ''}
    <h4 class="sub">Historial</h4><ul class="hist">${hist.map(e => `<li><span>${e.type === 'stamp' ? `+${e.n} ${e.n === 1 ? 'sello' : 'sellos'}${e.flag === 'forced' ? ' ⚠️' : ''}` : e.type === 'redeem' ? '🎁 Premio canjeado' : e.type === 'ref' ? `🤝 +${e.n} por recomendación` : e.flag === 'qr' ? '👋 Se sumó con el QR' : '👋 Se sumó al club'}${S.staffName(e.by) ? ` <small class="muted">· ${esc(S.staffName(e.by))}</small>` : ''}</span><time>${fmt.dateTime(e.ts)}</time></li>`).join('')}</ul>`,
    foot: `${S.isOwner() ? `<button class="btn ghost danger" id="del">${icon('trash')}</button>` : ''}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="sv">Guardar</button>`,
    onMount(w, close) {
      $('#sv', w).onclick = async e => { const d = Object.fromEntries(new FormData($('#ef', w))); try { e.currentTarget.disabled = true; await S.updateCustomer(id, { name: d.name.trim() || c.name, phone: d.phone, birthday: d.bdd && d.bdm ? `${String(d.bdm).padStart(2, '0')}-${String(d.bdd).padStart(2, '0')}` : '' }); toast('Cliente actualizado'); close(); } catch (err) { toast(err.message, 'err'); $('#sv', w).disabled = false; } };
      $('#del', w)?.addEventListener('click', async () => { if (await ask('Borrar cliente', `¿Borrar a ${esc(c.name)} del club? Se pierde su historial.`, 'Borrar', 'danger-solid')) act(async () => { await S.deleteCustomer(id); toast('Cliente borrado'); close(); }); });
    },
  });
}

// =====================================================================
// PROGRAMA (configuración, equipo y datos)
// =====================================================================
const EMOJIS = ['☕', '🥐', '💈', '🍕', '🍦', '🥩', '🌮', '🍺', '🐾', '💅', '🌿', '⭐'];
const COLORS = ['#0f6b4f', '#6d3df5', '#c2410c', '#be123c', '#1d4ed8', '#111827'];
VIEWS.programa = root => {
  const b = S.get().biz, cloud = S.getMode() === 'cloud', owner = S.isOwner();
  root.innerHTML = `
  <div class="ph"><h1>Tu programa</h1><p class="muted">${owner ? 'Así lo ven tus clientes en su tarjeta.' : 'Solo el dueño puede cambiar el programa.'}</p></div>
  <div class="prog">
    <div class="stackcol">
    <form class="box" id="pf" onsubmit="return false"><fieldset ${owner ? '' : 'disabled'}>
      <div class="form two">
        <label class="field s2"><span>Nombre del comercio</span><input name="name" value="${esc(b.name)}"></label>
        <div class="field s2"><span>Ícono del sello</span><div class="emojis" id="em">${EMOJIS.map(e => `<button type="button" data-e="${e}" class="${e === b.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
        <div class="field s2"><span>Color</span><div class="colors" id="co">${COLORS.map(c => `<button type="button" data-co="${c}" style="--c:${c}" class="${c === b.color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}<input type="color" id="cc" value="${esc(b.color)}" aria-label="Otro color"></div></div>
        <label class="field"><span>Sellos para el premio</span><input name="goal" type="number" min="3" max="20" value="${b.goal}"></label>
        <label class="field"><span>Sellos de bienvenida</span><input name="welcome" type="number" min="0" max="5" value="${b.welcome}"></label>
        <label class="field s2"><span>Premio</span><input name="reward" value="${esc(b.reward)}"></label>
        <label class="field"><span>Día de sellos dobles</span><select name="doubleDay"><option value="">Ninguno</option>${DIAS.map((d, i) => `<option value="${i}" ${String(b.doubleDay) === String(i) ? 'selected' : ''}>Los ${d}</option>`).join('')}</select></label>
        <label class="field"><span>WhatsApp del comercio</span><input name="phone" value="${esc(b.phone)}" inputmode="tel"></label>
        <label class="field s2"><span>Regalo de cumpleaños</span><input name="birthdayGift" value="${esc(b.birthdayGift || '')}"></label>
        <label class="field s2"><span>Dirección</span><input name="address" value="${esc(b.address || '')}"></label>
      </div>
      <h3 class="sec">${icon('share')} Para conseguir clientes nuevos</h3>
      <div class="form two">
        <label class="field"><span>Premio por recomendar <i>sellos para los dos</i></span><input name="refBonus" type="number" min="0" max="5" value="${b.refBonus}"></label>
        <label class="field"><span>Pedir reseña desde la visita n.º</span><input name="reviewAfter" type="number" min="1" max="50" value="${b.reviewAfter}"></label>
        <label class="field s2"><span>Link para dejar reseña en Google <i>opcional</i></span><input name="reviewUrl" value="${esc(b.reviewUrl || '')}" placeholder="https://g.page/r/..." inputmode="url"></label>
        <p class="muted small s2">Lo sacás de tu Perfil de Empresa de Google → "Pedir opiniones". Cuando un cliente llega a esa visita, aparece el botón para pedírsela por WhatsApp.</p>
      </div>
      <h3 class="sec">${icon('alert')} Control</h3>
      <div class="form two">
        <label class="field"><span>Avisar si se suma otro sello antes de <i>horas</i></span><input name="minHours" type="number" min="0" max="48" value="${b.minHours}"></label>
        <p class="muted small">Evita sellos de más. Igual se puede sumar, pero queda marcado y te aparece en el Tablero. 0 = sin aviso.</p>
      </div>
      ${owner ? `<div class="row-end"><button class="btn primary" id="sv">Guardar cambios</button></div>` : ''}
    </fieldset></form>
    ${cloud && owner ? `<div class="box" id="team"></div>` : ''}
    </div>
    <aside class="prev"><div class="sticky"><span class="muted small">Vista previa</span><div id="pv"></div>
      ${cloud ? `
      <div class="box data"><h3>${icon('qr')} Cartel para el mostrador</h3><p class="muted small">Tus clientes escanean el QR y se suman solos al club, sin que tengas que cargarlos.</p>
        <div class="row"><button class="btn primary sm" id="poster">${icon('qr')} Ver e imprimir</button><button class="btn ghost sm" id="cpJoin">${icon('link')} Copiar link</button></div></div>
      <div class="box data"><h3>${icon('cloud')} Cuenta</h3><p class="muted small">Club <b>${esc(S.slug())}</b> · entraste como ${esc(S.me()?.name || '')}. Los datos se guardan en la nube: podés usar la app en varios celulares a la vez.</p>
        <div class="row">${owner ? `<button class="btn ghost sm" id="bk">${icon('download')} Respaldo</button><button class="btn ghost sm" id="pw">${icon('key')} Contraseña</button>` : ''}<button class="btn ghost sm" id="lo">${icon('logout')} Salir</button></div></div>` : `
      <div class="box data"><h3>${icon('cloud')} ¿Ya tenés tu club?</h3><p class="muted small">Esto es una demo: todo se guarda solo en este dispositivo. Con tu cuenta, los datos quedan en la nube, lo usan tus empleados y tus clientes se suman con un QR.</p>
        <div class="row"><button class="btn primary sm" id="li">Entrar a mi club</button></div></div>
      <div class="box data"><h3>Datos</h3><p class="muted small">Todo se guarda en este dispositivo.</p>
        <div class="row"><button class="btn ghost sm" id="bk">${icon('download')} Respaldo</button><button class="btn ghost sm" id="rs">${icon('upload')} Restaurar</button><input type="file" id="rf" accept=".json" hidden></div>
        <div class="row"><button class="btn ghost sm" id="dm">Restaurar demo</button><button class="btn ghost sm danger" id="wp">Empezar de cero</button></div></div>`}
    </div></aside>
  </div>`;
  let emoji = b.emoji, color = b.color;
  const form = $('#pf');
  const preview = () => { const d = Object.fromEntries(new FormData(form)); $('#pv').innerHTML = cardHTML({ b: { n: d.name || b.name || 'Tu comercio', e: emoji, c: color, g: Math.max(3, +(d.goal ?? b.goal) || 8), r: d.reward || b.reward || 'Tu premio' }, c: { n: 'Valentina Gómez', s: Math.min(5, Math.max(3, +(d.goal ?? b.goal) || 8) - 2) } }); };
  form.oninput = preview;
  $('#em').onclick = e => { const x = e.target.closest('[data-e]'); if (x && owner) { emoji = x.dataset.e; $$('#em button').forEach(y => y.classList.toggle('on', y === x)); preview(); } };
  const setC = c => { color = c; $('#cc').value = c; $$('#co button').forEach(y => y.classList.toggle('on', y.dataset.co === c)); preview(); };
  $('#co').onclick = e => { const x = e.target.closest('[data-co]'); if (x && owner) setC(x.dataset.co); };
  $('#cc').oninput = e => setC(e.target.value);
  $('#sv')?.addEventListener('click', e => {
    const d = Object.fromEntries(new FormData(form));
    if (!d.name.trim()) return toast('Poné el nombre del comercio', 'err');
    if (d.reviewUrl && !/^https:\/\/\S+$/.test(d.reviewUrl.trim())) return toast('El link de reseñas tiene que empezar con https://', 'err');
    act(async () => {
      await S.saveBiz({ ...d, reviewUrl: d.reviewUrl.trim(), emoji, color, goal: Math.min(20, Math.max(3, +d.goal || 8)), welcome: Math.min(5, Math.max(0, +d.welcome || 0)), doubleDay: d.doubleDay === '' ? '' : +d.doubleDay,
        refBonus: Math.min(5, Math.max(0, +d.refBonus || 0)), reviewAfter: Math.min(50, Math.max(1, +d.reviewAfter || 3)), minHours: Math.min(48, Math.max(0, +d.minHours || 0)), demo: false });
      toast('Programa actualizado');
    }, e.currentTarget);
  });
  $('#bk')?.addEventListener('click', () => download(`zenix-club-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.get()), 'application/json'));
  if (cloud) {
    $('#poster').onclick = posterModal;
    $('#cpJoin').onclick = async () => { try { await navigator.clipboard.writeText(S.joinUrl()); toast('Link copiado'); } catch { toast('No se pudo copiar', 'err'); } };
    $('#lo').onclick = async () => { if (await ask('Salir', 'Vas a cerrar la sesión en este dispositivo. Los datos quedan guardados en la nube.', 'Salir')) { await S.logout(); location.hash = ''; route(); } };
    $('#pw')?.addEventListener('click', passwordModal);
    if ($('#team')) drawTeam();
  } else {
    $('#li').onclick = () => loginModal();
    $('#rs').onclick = () => $('#rf').click();
    $('#rf').onchange = async e => { const fl = e.target.files[0]; if (!fl) return; try { S.importBackup(JSON.parse(await fl.text())); toast('Respaldo restaurado'); route(); } catch (err) { toast(err.message, 'err'); } };
    $('#dm').onclick = async () => { if (await ask('Restaurar demo', '¿Reemplazar todo por los datos de ejemplo?', 'Reemplazar')) { S.resetDemo(); route(); } };
    $('#wp').onclick = async () => { if (await ask('Empezar de cero', 'Se borran todos los clientes y su historial. ¿Seguro?', 'Borrar todo', 'danger-solid')) { S.wipe(); toast('Listo, club vacío. Configurá tu comercio.'); route(); } };
  }
  preview();
};

function drawTeam() {
  const box = $('#team'); if (!box) return;
  const st = S.get().staff || [];
  box.innerHTML = `<div class="bh"><h3>${icon('users')} Equipo</h3><span class="muted small">cada uno entra con su PIN</span></div>
    <ul class="list">${st.map(x => `<li><div class="li"><span class="av sm" style="--h:${hue(x.name)}">${esc(initials(x.name))}</span><div><b>${esc(x.name)}</b><small>${x.role === 'owner' ? 'Dueño · contraseña' : 'Empleado · PIN'}</small></div>${x.role === 'staff' ? `<button class="icon-btn sm" data-rm="${x.id}" aria-label="Quitar">${icon('trash')}</button>` : ''}</div></li>`).join('')}</ul>
    <form class="form team-add" id="ta" onsubmit="return false"><label class="field"><span>Nombre</span><input name="name" placeholder="Ej.: Lucas" autocomplete="off"></label><label class="field"><span>PIN (4 a 6 números)</span><input name="pin" inputmode="numeric" maxlength="6" pattern="\\d*" autocomplete="off"></label><button class="btn primary" id="taOk">${icon('plus')} Sumar</button></form>
    <p class="muted small">Los empleados pueden sumar sellos, canjear y cargar clientes. No pueden borrar clientes ni cambiar el programa. Cada sello queda registrado con quién lo puso.</p>`;
  $('#taOk').onclick = e => { const d = Object.fromEntries(new FormData($('#ta'))); act(async () => { await S.addStaff(d.name.trim(), d.pin); toast(`${d.name.trim()} ya puede entrar con su PIN`); drawTeam(); }, e.currentTarget); };
  box.onclick = async e => { const r = e.target.closest('[data-rm]'); if (!r) return; const x = st.find(y => y.id === r.dataset.rm); if (await ask('Quitar del equipo', `${esc(x.name)} no va a poder entrar más.`, 'Quitar', 'danger-solid')) act(async () => { await S.removeStaff(x.id); drawTeam(); }); };
}

function passwordModal() {
  modal({ title: 'Cambiar contraseña', size: 'sm', body: `<form class="form" id="pwf" onsubmit="return false"><label class="field"><span>Contraseña actual</span><input type="password" name="cur" autocomplete="current-password" autofocus></label><label class="field"><span>Nueva <i>10+ caracteres, letras y números</i></span><input type="password" name="nw" autocomplete="new-password"></label></form>`,
    foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="pwOk">Cambiar</button>`,
    onMount: (w, close) => $('#pwOk', w).onclick = e => { const d = Object.fromEntries(new FormData($('#pwf', w))); act(async () => { await S.changePassword(d.cur, d.nw); toast('Contraseña cambiada. Se cerraron las otras sesiones.'); close(); }, e.currentTarget); } });
}

// Cartel imprimible con el QR para sumarse al club
function posterModal() {
  const b = S.get().biz, url = S.joinUrl();
  const poster = `<div class="poster" style="--brand:${esc(b.color)}"><div class="po-top"><span class="po-em">${esc(b.emoji)}</span><b>${esc(b.name)}</b></div>
    <h2>Sumate a nuestro club</h2><p>Con <b>${S.goal()} sellos</b> te llevás:<br><span class="po-rw">${esc(b.reward)}</span></p>
    <div class="po-qr">${qrSVG(url)}</div><p class="po-how">Escaneá con la cámara del celular${+b.welcome ? ` y arrancá con <b>${plural(+b.welcome, 'sello', 'sellos')} de regalo</b>` : ''}</p>
    ${+b.refBonus ? `<p class="po-ref">🤝 Invitá a un amigo y ganan <b>+${b.refBonus}</b> los dos</p>` : ''}<small>Club de clientes con Zenix Club</small></div>`;
  modal({ title: 'Cartel para el mostrador', body: poster, foot: `<button class="btn ghost" id="poDl">${icon('download')} Bajar QR</button><button class="btn primary" id="poPr">Imprimir</button>`,
    onMount(w) {
      $('#poPr', w).onclick = () => { const f = document.createElement('div'); f.id = 'printArea'; f.innerHTML = poster; document.body.appendChild(f); document.body.classList.add('printing'); setTimeout(() => { print(); document.body.classList.remove('printing'); f.remove(); }, 60); };
      $('#poDl', w).onclick = () => download(`qr-club-${S.slug()}.svg`, qrSVG(url, { color: '#111' }), 'image/svg+xml');
    } });
}

// =====================================================================
// BIENVENIDA · LOGIN
// =====================================================================
function bare(view, html) { current?.destroy?.(); current = null; document.body.dataset.view = view; document.body.innerHTML = html + '<div id="modals"></div><div id="toasts" aria-live="polite"></div><canvas id="confetti"></canvas>'; }
function loginForm(id = 'lf') {
  let saved = ''; try { saved = localStorage.getItem('zenix-club:last-club') || ''; } catch {}
  return `<form class="form" id="${id}" onsubmit="return false">
    <label class="field"><span>Código del club</span><input name="club" value="${esc(saved)}" placeholder="ej.: cafe-lapataia" autocapitalize="none" autocomplete="username" spellcheck="false"></label>
    <label class="field"><span>Contraseña o PIN</span><input name="secret" type="password" autocomplete="current-password"></label>
    <button class="btn primary xl" type="submit">Entrar</button></form>`;
}
function bindLogin(form, onDone) {
  form.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(form));
    if (!d.club.trim() || !d.secret) return toast('Completá el código del club y la contraseña', 'err');
    act(async () => { await S.login(d.club, d.secret); try { localStorage.setItem('zenix-club:last-club', d.club.trim().toLowerCase()); } catch {} onDone(); }, $('button[type=submit]', form));
  };
}
function loginModal() {
  modal({ title: 'Entrar a mi club', size: 'sm', body: loginForm('lfm'), onMount(w, close) { bindLogin($('#lfm', w), () => { close(); location.hash = '#/sumar'; document.body.innerHTML = ''; route(); toast('¡Listo! Ya estás en tu club'); }); setTimeout(() => $('input[name=' + ($('#lfm input[name=club]', w).value ? 'secret' : 'club') + ']', w)?.focus(), 60); } });
}
function onboarding() {
  bare('bienvenida', `<div class="welcome">
    <div class="w-brand"><span class="logo">${logo()}</span><span><b>Zenix</b> Club</span></div>
    <h1>Que tus clientes vuelvan</h1><p class="muted">Tarjeta de sellos digital por WhatsApp para cafés, panaderías, barberías y comercios de barrio.</p>
    <div class="w-grid">
      <div class="box"><h3>Entrar a mi club</h3>${loginForm()}</div>
      <div class="box w-demo"><h3>Probar la demo</h3><p class="muted">Un café de ejemplo con 60 clientes y 3 meses de visitas. Todo queda en este dispositivo.</p><button class="btn ghost xl" id="demo">Ver la demo</button>
        <p class="muted small">¿Querés Zenix Club para tu comercio? <a href="https://zenix.com.ar" target="_blank" rel="noopener">Escribinos</a>.</p></div>
    </div></div>`);
  document.documentElement.style.setProperty('--brand', '#0f6b4f');
  bindLogin($('#lf'), () => { location.hash = '#/sumar'; document.body.innerHTML = ''; route(); });
  $('#demo').onclick = () => { S.startDemo(); location.hash = '#/sumar'; document.body.innerHTML = ''; route(); };
}
function loadingScreen() {
  bare('cargando', `<div class="pub"><div class="empty big"><div class="spinner"></div><p class="muted">Cargando tu club…</p></div></div>`);
  S.refresh().then(() => { document.body.innerHTML = ''; route(); }).catch(e => { if (S.getMode() === 'none' || e.status === 401) return route(); $('.empty').innerHTML = `<h2>No pudimos cargar tu club</h2><p class="muted">${esc(e.message)}</p><button class="btn primary" id="retry">Reintentar</button>`; $('#retry').onclick = () => route(); });
}

// =====================================================================
// TARJETA DEL CLIENTE
// =====================================================================
function tiltCard() {
  const card = $('.card3d'); if (!card) return;
  const tilt = (x, y) => { const r = card.getBoundingClientRect(); const px = Math.max(-0.5, Math.min(0.5, (x - r.left) / r.width - 0.5)), py = Math.max(-0.5, Math.min(0.5, (y - r.top) / r.height - 0.5)); card.style.transform = `perspective(800px) rotateY(${px * 14}deg) rotateX(${-py * 14}deg)`; card.style.setProperty('--gx', `${(px + 0.5) * 100}%`); card.style.setProperty('--gy', `${(py + 0.5) * 100}%`); };
  addEventListener('pointermove', e => tilt(e.clientX, e.clientY));
  const orient = () => addEventListener('deviceorientation', e => { if (e.gamma == null) return; const r = card.getBoundingClientRect(); tilt(r.left + r.width * (0.5 + e.gamma / 60), r.top + r.height * (0.5 + (e.beta - 40) / 60)); });
  // iPhone pide permiso para leer el giro: se pide con el primer toque
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    addEventListener('pointerdown', () => DeviceOrientationEvent.requestPermission().then(p => p === 'granted' && orient()).catch(() => {}), { once: true });
  } else orient();
}
function cardPage(d, live) {
  const { b, c } = d; document.documentElement.style.setProperty('--brand', b.c);
  document.title = `Mi tarjeta · ${b.n}`;
  const g = b.g, ready = Math.floor(c.s / g), cur = ready ? g : c.s % g;
  const invite = live && b.slug && +b.rb ? `${S.PUBLIC}/u/${b.slug}/${c.k}` : '';
  document.body.dataset.view = 'tarjeta';
  document.body.innerHTML = `
  <div class="pub">
    <p class="pub-hi">Hola, ${esc(first(c.n))} 👋</p>
    ${cardHTML({ b, c })}
    <div class="pub-info">
      ${ready ? `<div class="pub-ready">🎁 <b>¡Tu premio te espera!</b><span>Mostrá esta pantalla en ${esc(b.n)}.</span></div>` : `<div class="pub-left"><b>${g - cur}</b><span>${g - cur === 1 ? 'sello más' : 'sellos más'} para ${esc(String(b.r).charAt(0).toLowerCase() + String(b.r).slice(1))}</span></div>`}
      <dl><div><dt>Visitas</dt><dd>${Math.max(0, c.v ?? c.t)}</dd></div><div><dt>Premios</dt><dd>${c.r}</dd></div><div><dt>Socio desde</dt><dd>${fmt.dateShort(c.j)}</dd></div></dl>
      ${b.d !== '' && b.d !== null && b.d !== undefined ? `<p class="pub-tip">${icon('bolt')} <span>Los ${DIAS[b.d]} cada visita suma <b>doble</b>.</span></p>` : ''}
    </div>
    ${invite ? `<div class="pub-invite"><b>🤝 Invitá a un amigo</b><span>Cuando venga por primera vez, ganan <b>+${b.rb} ${+b.rb === 1 ? 'sello' : 'sellos'}</b> los dos.</span><button class="btn primary" id="inv">${icon('share')} Invitar</button></div>` : ''}
    ${b.rv ? `<a class="btn ghost xl" href="${esc(b.rv)}" target="_blank" rel="noopener">${icon('star')} Dejanos tu reseña en Google</a>` : ''}
    ${b.p ? `<a class="btn wa xl" href="https://wa.me/${waPhone(b.p)}?text=${encodeURIComponent(`¡Hola! Soy ${c.n}, socio/a del club.`)}" target="_blank" rel="noopener">${icon('wa')} Escribirle a ${esc(b.n)}</a>` : ''}
    <p class="pub-foot">${live ? `${icon('cloud')} Se actualiza sola cada vez que venís` : `Actualizada el ${fmt.dateTime(d.ts)}`}${b.a ? ` · ${esc(b.a)}` : ''}<br>Club de clientes con Zenix Club</p>
  </div><div id="toasts" aria-live="polite"></div>`;
  $('#inv')?.addEventListener('click', async () => {
    const text = `Sumate al club de ${b.n} ${b.e}: con ${g} sellos te llevás ${String(b.r).toLowerCase()}. Si te anotás con mi link y vas, ganamos un sello los dos 😉`;
    if (navigator.share) { try { await navigator.share({ title: `Club de ${b.n}`, text, url: invite }); } catch {} }
    else window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + invite)}`, '_blank', 'noopener');
  });
  tiltCard();
}
// link viejo (la tarjeta viaja en el link; se usa en la demo)
async function publicCard(payload) {
  document.body.dataset.view = 'tarjeta';
  let d = null; try { d = await decodeShare(payload || ''); } catch {}
  if (!d?.b) { document.body.innerHTML = `<div class="pub"><div class="empty big"><h2>No pudimos abrir tu tarjeta</h2><p class="muted">Pedile al comercio que te la reenvíe.</p></div></div>`; return; }
  cardPage(d, false);
}
// link fijo: siempre muestra los sellos al día
async function liveCard(token) {
  document.body.dataset.view = 'tarjeta';
  document.body.innerHTML = `<div class="pub"><div class="empty big"><div class="spinner"></div></div></div>`;
  const load = async () => {
    try { const { card } = await S.publicApi('GET', 'card/' + encodeURIComponent(token || '')); try { localStorage.setItem('zenix-club:card:' + token, JSON.stringify(card)); } catch {} cardPage(card, true); }
    catch (e) {
      let cached = null; try { cached = JSON.parse(localStorage.getItem('zenix-club:card:' + token) || 'null'); } catch {}
      if (cached && e.offline) return cardPage(cached, true);
      document.body.innerHTML = `<div class="pub"><div class="empty big"><h2>No pudimos abrir tu tarjeta</h2><p class="muted">${e.offline ? 'Revisá tu conexión a internet.' : 'Pedile al comercio que te la reenvíe.'}</p></div></div>`;
    }
  };
  await load();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
}

// =====================================================================
// ALTA DEL CLIENTE POR QR (y por invitación de un amigo)
// =====================================================================
async function joinPage(slug, ref) {
  document.body.dataset.view = 'tarjeta';
  document.body.innerHTML = `<div class="pub"><div class="empty big"><div class="spinner"></div></div></div>`;
  let club;
  try { ({ club } = await S.publicApi('GET', 'club/' + encodeURIComponent(slug || ''))); }
  catch (e) { document.body.innerHTML = `<div class="pub"><div class="empty big"><h2>No encontramos este club</h2><p class="muted">${esc(e.message)}</p></div></div>`; return; }
  document.documentElement.style.setProperty('--brand', club.color);
  document.title = `Sumate al club · ${club.name}`;
  document.body.innerHTML = `
  <div class="pub join">
    <div class="po-top"><span class="po-em">${esc(club.emoji)}</span><b>${esc(club.name)}</b></div>
    <h1>Sumate al club</h1>
    <p class="muted">Con <b>${club.goal} sellos</b> te llevás: <b>${esc(club.reward)}</b>.${+club.welcome ? ` Arrancás con ${plural(+club.welcome, 'sello', 'sellos')} de regalo.` : ''}</p>
    ${ref && +club.refBonus ? `<div class="pub-tip"><span>🤝 Te invitó un amigo: en tu primera visita ganan <b>+${club.refBonus}</b> los dos.</span></div>` : ''}
    <form class="form box" id="jf" onsubmit="return false">
      <label class="field"><span>Tu nombre</span><input name="name" autocomplete="name" placeholder="Ej.: Valentina Gómez" required></label>
      <label class="field"><span>Tu WhatsApp</span><input name="phone" inputmode="tel" autocomplete="tel" placeholder="2901 471353" required></label>
      <label class="field"><span>Cumpleaños <i>opcional, ¡hay regalo!</i></span><div class="bd-in"><select name="bdd"><option value="">Día</option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('')}</select><select name="bdm"><option value="">Mes</option>${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select></div></label>
      <button class="btn primary xl" type="submit">Quiero mi tarjeta</button>
      <p class="muted small">Usamos tu WhatsApp solo para mandarte tu tarjeta y avisos del club.</p>
    </form>
  </div><div id="toasts" aria-live="polite"></div>`;
  const f = $('#jf');
  f.onsubmit = e => {
    e.preventDefault(); const d = Object.fromEntries(new FormData(f));
    act(async () => {
      const r = await S.publicApi('POST', 'join', { club: club.slug, name: d.name, phone: d.phone, ref: ref || '', birthday: d.bdd && d.bdm ? `${String(d.bdm).padStart(2, '0')}-${String(d.bdd).padStart(2, '0')}` : '' });
      const link = `${S.PUBLIC}/t/${r.token}`;
      document.body.innerHTML = `<div class="pub join"><div class="pub-ready">🎉 <b>¡Ya sos parte del club!</b><span>Guardá tu tarjeta: mandátela por WhatsApp así la tenés siempre a mano.</span></div>
        <a class="btn wa xl" href="https://wa.me/?text=${encodeURIComponent(`Mi tarjeta del club de ${club.name} ${club.emoji}\n${link}`)}" target="_blank" rel="noopener">${icon('wa')} Guardarla en mi WhatsApp</a>
        <a class="btn ghost xl" href="${esc(link)}">Ver mi tarjeta</a></div>`;
    }, $('button[type=submit]', f));
  };
}

// ---------- detalles ----------
function hue(s) { return [...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360; }
function initials(n) { return n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
const logo = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="var(--brand)"/><rect x="8" y="11" width="24" height="18" rx="4" fill="none" stroke="#fff" stroke-width="2.4"/><g fill="#fff"><circle cx="14.5" cy="20" r="2.4"/><circle cx="20" cy="20" r="2.4"/><circle cx="25.5" cy="20" r="2.4" fill-opacity=".35"/></g></svg>`;

S.load();
window.addEventListener('hashchange', route);
route();
// en la nube: se sincroniza solo (varios celulares a la vez)
const sync = () => { if (S.getMode() === 'cloud' && S.get() && document.visibilityState === 'visible' && $('.top')) S.refresh().catch(() => {}); };
setInterval(sync, 45000); sync();
document.addEventListener('visibilitychange', sync);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {});
