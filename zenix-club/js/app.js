// Zenix Club — fidelización con tarjeta de sellos digital.
import * as S from './store.js';
import { fmt, esc, DAY, debounce, download, toCSV, encodeShare, decodeShare, startOfDay } from './util.js';

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
function chrome() { const b = S.get().biz; $('#bizName').innerHTML = `<span class="em">${esc(b.emoji)}</span>${esc(b.name)}${b.demo ? '<small>demo</small>' : ''}`; document.documentElement.style.setProperty('--brand', b.color); }

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
  const [id, arg] = location.hash.replace(/^#\/?/, '').split('/');
  while (stack.length) stack[stack.length - 1]();
  current?.destroy?.();
  if (id === 'tarjeta') return publicCard(arg);
  if (!$('.top')) shell();
  const v = VIEWS[id] ? id : 'sumar';
  document.body.dataset.view = v;
  $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === v));
  const old = $('#view'), root = old.cloneNode(false); old.replaceWith(root);
  current = VIEWS[v](root, arg) || {};
  chrome(); window.scrollTo(0, 0);
}
S.subscribe(() => { if ($('.top')) chrome(); current?.update?.(); });

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
    const ready = S.rewardsReady(c), bd = S.birthdaySoon(c, 0);
    p.innerHTML = `
      <div class="p-head"><button class="icon-btn mob-only" id="backList" aria-label="Volver">${icon('back')}</button><div><h2>${esc(c.name)}</h2><p class="muted">${esc(c.phone)} · ${plural(c.visits || 0, 'visita', 'visitas')} · cliente desde ${fmt.dateShort(c.createdAt)}</p></div></div>
      ${bd === 0 ? `<div class="promo bd">${icon('cake')} ¡Hoy cumple años! Regalo: <b>${esc(b.birthdayGift || 'un detalle de la casa')}</b></div>` : ''}
      <div class="p-card" id="pcard">${cardHTML(cardData(c))}</div>
      <div class="actions">
        <button class="btn primary xl" id="add1">${icon('stamp')} Sumar sello${S.isDoubleToday() ? ' <em>×2</em>' : ''}</button>
        ${ready ? `<button class="btn gift xl" id="redeem">${icon('gift')} Canjear premio</button>` : ''}
        <div class="row2"><button class="btn ghost" id="add2">+2 sellos</button><button class="btn ghost" id="send">${icon('wa')} Enviar tarjeta</button></div>
      </div>`;
    $('#add1').onclick = () => doStamp(1);
    $('#add2').onclick = () => doStamp(2);
    $('#redeem')?.addEventListener('click', doRedeem);
    $('#send').onclick = () => sendCard(c);
    $('#backList')?.addEventListener('click', () => { selected = null; document.body.classList.remove('picked'); drawPanel(); drawResults(); q.focus(); });
  };
  function pick(id) { selected = S.byId(id); document.body.classList.add('picked'); drawPanel(); drawResults(); if (innerWidth > 900) setTimeout(() => $('#add1')?.focus(), 50); }
  function doStamp(n) {
    const r = S.stamp(selected.id, n);
    const c = S.byId(selected.id);
    drawPanel(); drawResults();
    $('#pcard .card3d')?.classList.add('bump');
    if (r.justCompleted) { confetti(); toast(`¡${first(c.name)} completó la tarjeta! Ya puede canjear su premio.`, 'ok', { label: 'Avisarle', run: () => sendCard(c, 'ready') }); }
    else toast(`+${r.added} ${r.added === 1 ? 'sello' : 'sellos'}${r.double ? ' (doble del día)' : ''} para ${first(c.name)}`, 'ok', { label: 'Deshacer', run: () => { S.undoLast(c.id); drawPanel(); drawResults(); } });
  }
  function doRedeem() {
    const c = S.byId(selected.id);
    modal({ title: 'Canjear premio', size: 'sm', body: `<div class="redeem-box"><span>🎁</span><b>${esc(b.reward)}</b><p class="muted">para ${esc(c.name)}. Se descuentan ${S.goal()} sellos de su tarjeta.</p></div>`,
      foot: `<button class="btn ghost" data-close>Cancelar</button><button class="btn gift" id="okR">Entregar premio</button>`,
      onMount: (w, close) => $('#okR', w).onclick = () => { S.redeem(c.id); close(); drawPanel(); drawResults(); confetti(); toast(`Premio entregado a ${first(c.name)} 🎉`, 'ok', { label: 'Deshacer', run: () => { S.undoLast(c.id); drawPanel(); drawResults(); } }); } });
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
  return { destroy() { document.body.classList.remove('picked'); } };
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
      const go = () => {
        const d = Object.fromEntries(new FormData($('#nf', w)));
        try {
          const c = S.addCustomer({ name: d.name, phone: d.phone, birthday: d.bdd && d.bdm ? `${String(d.bdm).padStart(2, '0')}-${String(d.bdd).padStart(2, '0')}` : '' });
          close(); toast(`${first(c.name)} ya es parte del club`); onDone?.(c);
        } catch (e) { toast(e.message, 'err'); }
      };
      $('#nfOk', w).onclick = go; $('#nf', w).onkeydown = e => e.key === 'Enter' && e.target.tagName === 'INPUT' && go();
    },
  });
}

async function cardLink(c) { return location.href.split('#')[0] + '#/tarjeta/' + await encodeShare(S.cardPayload(c)); }
async function sendCard(c, kind = 'update') {
  const b = S.get().biz, g = S.goal(), cur = Math.min(c.stamps % g || (S.rewardsReady(c) ? g : 0), g), left = g - cur;
  const url = await cardLink(c);
  const msg = {
    welcome: `¡Hola ${first(c.name)}! 👋 Bienvenido/a al club de ${b.name} ${b.emoji}\nCon ${g} sellos te llevás: ${b.reward}.\nYa tenés ${plural(c.stamps, 'sello', 'sellos')}. Tu tarjeta:\n${url}`,
    ready: `¡${first(c.name)}, completaste tu tarjeta en ${b.name}! 🎉\nLa próxima vez que vengas te espera: ${b.reward}.\n${url}`,
    update: S.rewardsReady(c) ? `¡${first(c.name)}! Tenés un premio esperándote en ${b.name} 🎁\n${url}` : `¡Gracias por venir, ${first(c.name)}! ${b.emoji}\nLlevás ${cur} de ${g} sellos: te ${left === 1 ? 'falta 1' : `faltan ${left}`} para ${b.reward.toLowerCase()}.\n${url}`,
    miss: `¡Hola ${first(c.name)}! Hace rato que no te vemos por ${b.name} ${b.emoji}\n${cur ? `Tenés ${plural(cur, 'sello', 'sellos')} en tu tarjeta${left <= 3 ? ` y te ${left === 1 ? 'falta solo 1' : `faltan solo ${left}`} para tu premio` : ''}.` : `Tu próxima visita ya suma para tu próximo premio: ${b.reward.toLowerCase()}.`} ¡Te esperamos!\n${url}`,
    bday: `¡Feliz cumpleaños, ${first(c.name)}! 🎂\nEn ${b.name} te regalamos ${(b.birthdayGift || 'un detalle de la casa').toLowerCase()}: pasá a buscarlo esta semana.\n${url}`,
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
      <div class="kpi"><span>Premios entregados</span><b>${s.monthRedeems}</b><small>este mes · ${s.monthNew} socios nuevos</small></div>
    </section>
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
    <h4 class="sub">Historial</h4><ul class="hist">${hist.map(e => `<li><span>${e.type === 'stamp' ? `+${e.n} ${e.n === 1 ? 'sello' : 'sellos'}` : e.type === 'redeem' ? '🎁 Premio canjeado' : '👋 Se sumó al club'}</span><time>${fmt.dateTime(e.ts)}</time></li>`).join('')}</ul>`,
    foot: `<button class="btn ghost danger" id="del">${icon('trash')}</button><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="sv">Guardar</button>`,
    onMount(w, close) {
      $('#sv', w).onclick = () => { const d = Object.fromEntries(new FormData($('#ef', w))); try { S.updateCustomer(id, { name: d.name.trim() || c.name, phone: d.phone, birthday: d.bdd && d.bdm ? `${String(d.bdm).padStart(2, '0')}-${String(d.bdd).padStart(2, '0')}` : '' }); toast('Cliente actualizado'); close(); } catch (e) { toast(e.message, 'err'); } };
      $('#del', w).onclick = () => { if (confirm(`¿Borrar a ${c.name} del club? Se pierde su historial.`)) { S.deleteCustomer(id); toast('Cliente borrado'); close(); } };
    },
  });
}

// =====================================================================
// PROGRAMA (configuración)
// =====================================================================
const EMOJIS = ['☕', '🥐', '💈', '🍕', '🍦', '🥩', '🌮', '🍺', '🐾', '💅', '🌿', '⭐'];
const COLORS = ['#0f6b4f', '#6d3df5', '#c2410c', '#be123c', '#1d4ed8', '#111827'];
VIEWS.programa = root => {
  const b = S.get().biz;
  root.innerHTML = `
  <div class="ph"><h1>Tu programa</h1><p class="muted">Así lo ven tus clientes en su tarjeta.</p></div>
  <div class="prog">
    <form class="box" id="pf" onsubmit="return false">
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
      <div class="row-end"><button class="btn primary" id="sv">Guardar cambios</button></div>
    </form>
    <aside class="prev"><div class="sticky"><span class="muted small">Vista previa</span><div id="pv"></div>
      <div class="box data"><h3>Datos</h3><p class="muted small">Todo se guarda en este dispositivo.</p>
        <div class="row"><button class="btn ghost sm" id="bk">${icon('download')} Respaldo</button><button class="btn ghost sm" id="rs">${icon('upload')} Restaurar</button><input type="file" id="rf" accept=".json" hidden></div>
        <div class="row"><button class="btn ghost sm" id="dm">Restaurar demo</button><button class="btn ghost sm danger" id="wp">Empezar de cero</button></div></div></div></aside>
  </div>`;
  let emoji = b.emoji, color = b.color;
  const form = $('#pf');
  const preview = () => { const d = Object.fromEntries(new FormData(form)); $('#pv').innerHTML = cardHTML({ b: { n: d.name || 'Tu comercio', e: emoji, c: color, g: Math.max(3, +d.goal || 8), r: d.reward || 'Tu premio' }, c: { n: 'Valentina Gómez', s: Math.min(5, Math.max(3, +d.goal || 8) - 2) } }); };
  form.oninput = preview;
  $('#em').onclick = e => { const x = e.target.closest('[data-e]'); if (x) { emoji = x.dataset.e; $$('#em button').forEach(y => y.classList.toggle('on', y === x)); preview(); } };
  const setC = c => { color = c; $('#cc').value = c; $$('#co button').forEach(y => y.classList.toggle('on', y.dataset.co === c)); preview(); };
  $('#co').onclick = e => { const x = e.target.closest('[data-co]'); if (x) setC(x.dataset.co); };
  $('#cc').oninput = e => setC(e.target.value);
  $('#sv').onclick = () => {
    const d = Object.fromEntries(new FormData(form));
    if (!d.name.trim()) return toast('Poné el nombre del comercio', 'err');
    S.saveBiz({ ...d, emoji, color, goal: Math.min(20, Math.max(3, +d.goal || 8)), welcome: Math.min(5, Math.max(0, +d.welcome || 0)), doubleDay: d.doubleDay === '' ? '' : +d.doubleDay, demo: false });
    toast('Programa actualizado');
  };
  $('#bk').onclick = () => download(`zenix-club-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S.get()), 'application/json');
  $('#rs').onclick = () => $('#rf').click();
  $('#rf').onchange = async e => { const fl = e.target.files[0]; if (!fl) return; try { S.importBackup(JSON.parse(await fl.text())); toast('Respaldo restaurado'); route(); } catch (err) { toast(err.message, 'err'); } };
  $('#dm').onclick = () => { if (confirm('¿Reemplazar todo por los datos de ejemplo?')) { S.resetDemo(); route(); } };
  $('#wp').onclick = () => { if (confirm('Se borran todos los clientes y su historial. ¿Seguro?')) { S.wipe(); toast('Listo, club vacío'); route(); } };
  preview();
};

// =====================================================================
// TARJETA DEL CLIENTE (link público, sin datos del comercio)
// =====================================================================
async function publicCard(payload) {
  document.body.dataset.view = 'tarjeta';
  let d = null; try { d = await decodeShare(payload || ''); } catch {}
  if (!d?.b) { document.body.innerHTML = `<div class="pub"><div class="empty big"><h2>No pudimos abrir tu tarjeta</h2><p class="muted">Pedile al comercio que te la reenvíe.</p></div></div>`; return; }
  const { b, c } = d; document.documentElement.style.setProperty('--brand', b.c);
  document.title = `Mi tarjeta · ${b.n}`;
  const g = b.g, ready = Math.floor(c.s / g), cur = ready ? g : c.s % g;
  document.body.innerHTML = `
  <div class="pub">
    <p class="pub-hi">Hola, ${esc(first(c.n))} 👋</p>
    ${cardHTML({ b, c })}
    <div class="pub-info">
      ${ready ? `<div class="pub-ready">🎁 <b>¡Tu premio te espera!</b><span>Mostrá esta pantalla en ${esc(b.n)}.</span></div>` : `<div class="pub-left"><b>${g - cur}</b><span>${g - cur === 1 ? 'sello más' : 'sellos más'} para ${esc(String(b.r).charAt(0).toLowerCase() + String(b.r).slice(1))}</span></div>`}
      <dl><div><dt>Visitas</dt><dd>${Math.max(0, c.v ?? c.t)}</dd></div><div><dt>Premios</dt><dd>${c.r}</dd></div><div><dt>Socio desde</dt><dd>${fmt.dateShort(c.j)}</dd></div></dl>
      ${b.d !== '' && b.d !== null && b.d !== undefined ? `<p class="pub-tip">${icon('bolt')} Los ${DIAS[b.d]} cada visita suma <b>doble</b>.</p>` : ''}
    </div>
    ${b.p ? `<a class="btn wa xl" href="https://wa.me/${waPhone(b.p)}?text=${encodeURIComponent(`¡Hola! Soy ${c.n}, socio/a del club.`)}" target="_blank" rel="noopener">${icon('wa')} Escribirle a ${esc(b.n)}</a>` : ''}
    <p class="pub-foot">Actualizada el ${fmt.dateTime(d.ts)}${b.a ? ` · ${esc(b.a)}` : ''}<br>Club de clientes con Zenix Club</p>
  </div>`;
  // efecto 3D con el dedo / mouse
  const card = $('.card3d');
  const tilt = (x, y) => { const r = card.getBoundingClientRect(); const px = (x - r.left) / r.width - 0.5, py = (y - r.top) / r.height - 0.5; card.style.transform = `perspective(800px) rotateY(${px * 14}deg) rotateX(${-py * 14}deg)`; card.style.setProperty('--gx', `${(px + 0.5) * 100}%`); card.style.setProperty('--gy', `${(py + 0.5) * 100}%`); };
  addEventListener('pointermove', e => tilt(e.clientX, e.clientY));
  addEventListener('deviceorientation', e => { if (e.gamma == null) return; const r = card.getBoundingClientRect(); tilt(r.left + r.width * (0.5 + e.gamma / 60), r.top + r.height * (0.5 + (e.beta - 40) / 60)); });
}

// ---------- detalles ----------
function hue(s) { return [...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 37 % 360; }
function initials(n) { return n.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
const logo = () => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="var(--brand)"/><rect x="8" y="11" width="24" height="18" rx="4" fill="none" stroke="#fff" stroke-width="2.4"/><g fill="#fff"><circle cx="14.5" cy="20" r="2.4"/><circle cx="20" cy="20" r="2.4"/><circle cx="25.5" cy="20" r="2.4" fill-opacity=".35"/></g></svg>`;

S.load();
window.addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
