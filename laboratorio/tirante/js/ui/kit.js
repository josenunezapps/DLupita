// Componentes transversales: avisos con acción, diálogos y paleta de comandos.
import { $, esc, icon } from './dom.js';

export function toast(message, { kind = 'info', action = null, duration = 4200 } = {}) {
  const host = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast'; el.dataset.kind = kind;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span>${esc(message)}</span>`;
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (action) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = action.label;
    b.addEventListener('click', () => { action.run(); close(); });
    el.append(b);
  }
  host.append(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  const timer = setTimeout(close, action ? Math.max(duration, 7000) : duration);
  return () => { clearTimeout(timer); close(); };
}

/** Diálogo modal propio. `buttons`: [{label, value, primary, danger}]. Resuelve con el value elegido o null. */
export function dialog({ title, html = '', buttons = [{ label: 'Cerrar', value: null, primary: true }] }) {
  const dlg = $('#dialog');
  dlg.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2><div class="dlg-scroll">${html}</div><div class="row">${
    buttons.map((b, i) => `<button class="btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}" value="${i}" ${b.primary ? 'autofocus' : ''}>${esc(b.label)}</button>`).join('')
  }</div></form>`;
  return new Promise((resolve) => {
    dlg.addEventListener('close', () => { const i = dlg.returnValue; resolve(i === '' ? null : buttons[+i]?.value ?? null); }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Coincidencia difusa: todas las letras en orden; puntúa mejor los aciertos seguidos y al inicio de palabra.
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function fuzzy(query, text) {
  const q = norm(query), t = norm(text);
  if (!q) return 1;
  let score = 0, ti = 0, streak = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = t.indexOf(ch, ti);
    if (at < 0) return 0;
    streak = at === ti ? streak + 1 : 0;
    score += 1 + streak * 2 + (at === 0 || t[at - 1] === ' ' ? 3 : 0);
    ti = at + 1;
  }
  return score / (1 + t.length * 0.02);
}

export function createPalette(getCommands) {
  const dlg = $('#palette'), input = $('#paletteInput'), list = $('#paletteList');
  let items = [], active = 0;

  const render = () => {
    const q = input.value.trim();
    items = getCommands().map((c) => ({ c, s: fuzzy(q, c.title + ' ' + (c.keywords || '')) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).slice(0, q ? 30 : 60).map((x) => x.c);
    active = Math.min(active, Math.max(0, items.length - 1));
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" id="cmd-${i}" data-i="${i}" aria-selected="${i === active}"><span>${esc(c.title)}</span>${c.keys ? `<kbd>${esc(c.keys)}</kbd>` : c.group ? `<small>${esc(c.group)}</small>` : ''}</li>`).join('')
      : `<li class="none">Ninguna acción coincide con «${esc(q)}». Probá con otra palabra.</li>`;
    input.setAttribute('aria-activedescendant', items.length ? `cmd-${active}` : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const run = (i) => { const c = items[i]; if (!c) return; dlg.close(); c.run(); };

  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = (active + 1) % Math.max(1, items.length); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % Math.max(1, items.length); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { run(active); e.preventDefault(); }
  });
  list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
  list.addEventListener('pointermove', (e) => { const li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== active) { active = +li.dataset.i; render(); } });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  return {
    open() { if (dlg.open) return dlg.close(); input.value = ''; active = 0; dlg.showModal(); render(); input.focus(); },
    isOpen: () => dlg.open,
  };
}

export { icon };
