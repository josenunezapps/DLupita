// Paneles: inspector de la selección, tabla de barras, opciones de cálculo y biblioteca de proyectos.
import { MATERIALS, PROFILES, kgPerMeter, materialOf, profileOf } from '../core/catalog.js';
import { analyze } from '../core/analysis.js';
import { EXAMPLES } from '../core/examples.js';
import { toSVG } from '../core/io.js';
import { LIMITS, SUPPORT_LABEL, bounds, memberById, nodeById } from '../core/model.js';
import { $, $$, esc, hydrateIcons, icon, kg, num, parseNum, pct, signed } from './dom.js';

const level = (u) => (u > 1.0005 ? 'over' : u > 0.85 ? 'warn' : 'ok');
const SUPPORT_ICON = {
  none: '<circle cx="13" cy="11" r="4"/>',
  pin: '<path d="M13 3l8 13H5z"/><path d="M3 19h20"/>',
  rollerX: '<path d="M13 2l7 11H6z"/><circle cx="9" cy="16" r="2.2"/><circle cx="17" cy="16" r="2.2"/><path d="M3 20h20"/>',
  rollerY: '<path d="M4 11l11-7v14z"/><circle cx="18" cy="7" r="2.2"/><circle cx="18" cy="15" r="2.2"/><path d="M22 1v20"/>',
};

export function createPanels(app) {
  const store = app.store;
  const el = { sel: $('#tab-sel'), bars: $('#tab-bars'), calc: $('#tab-calc'), lib: $('#tab-lib') };
  const table = { query: '', filter: 'all', sort: 'u', dir: -1 };
  const lib = { query: '', sort: 'recent' };
  const weightCache = new Map();

  // ═════════ Inspector ═════════
  function renderInspector() {
    const { model, sel } = store.get(), res = app.results, ok = !!res?.ok;
    const nodes = sel.nodes.map((id) => nodeById(model, id)).filter(Boolean);
    const members = sel.members.map((id) => memberById(model, id)).filter(Boolean);
    let html = '';

    if (nodes.length === 1 && !members.length) {
      const n = nodes[0], i = model.nodes.indexOf(n);
      const sup = n.support || 'none';
      const react = ok ? res.reactions.find((r) => r.id === n.id) : null;
      const connected = model.members.filter((m) => m.a === n.id || m.b === n.id).length;
      html = `
        <div class="head"><h2>Nudo ${esc(n.id)}</h2><small>${connected} ${connected === 1 ? 'barra' : 'barras'}</small></div>
        <div class="group"><h3>Posición</h3><div class="grid2">
          ${field('x', 'Horizontal (m)', num(n.x, 2))}${field('y', 'Altura (m)', num(n.y, 2))}
        </div></div>
        <div class="group"><h3>Apoyo</h3>
          <div class="choices" role="radiogroup" aria-label="Tipo de apoyo">
            ${[['none', 'Libre'], ['pin', 'Fijo'], ['rollerX', 'Rueda ↔'], ['rollerY', 'Rueda ↕']].map(([k, label]) =>
              `<button type="button" role="radio" aria-checked="${sup === k}" data-act="support" data-value="${k}" title="${k === 'none' ? 'Sin apoyo' : SUPPORT_LABEL[k]}"><svg viewBox="0 0 26 22">${SUPPORT_ICON[k]}</svg>${label}</button>`).join('')}
          </div>
          <p class="fine">${sup === 'pin' ? 'No se mueve en ninguna dirección.' : sup === 'rollerX' ? 'Sostiene hacia arriba y deja deslizar hacia los costados.' : sup === 'rollerY' ? 'Sostiene hacia los costados y deja deslizar en vertical.' : 'El nudo queda libre: sólo lo sostienen las barras.'}</p>
        </div>
        <div class="group"><h3>Carga aplicada</h3><div class="grid2">
          ${field('down', 'Hacia abajo (kN)', num(-(n.load?.fy || 0), 1))}${field('right', 'Hacia la derecha (kN)', num(n.load?.fx || 0, 1))}
        </div><p class="fine">10 kN equivalen aproximadamente a una tonelada. Un valor negativo invierte el sentido.</p></div>
        ${ok && connected ? `<div class="group"><h3>Resultado</h3><dl class="facts">
          <dt>Se desplaza</dt><dd>${num(Math.abs(res.disp[2 * i + 1]) * 1000, 1)} mm ${res.disp[2 * i + 1] <= 0 ? 'hacia abajo' : 'hacia arriba'}, ${num(Math.abs(res.disp[2 * i]) * 1000, 1)} mm al costado</dd>
          ${react ? `<dt>Reacción del apoyo</dt><dd class="t-ok">${num(Math.abs(react.ry), 1)} kN ${react.ry >= 0 ? '↑' : '↓'}${Math.abs(react.rx) > 0.05 ? `, ${num(Math.abs(react.rx), 1)} kN ${react.rx > 0 ? '→' : '←'}` : ''}</dd>` : ''}
        </dl></div>` : ''}
        <button type="button" class="btn danger" data-act="delete">${icon('trash')}Borrar nudo</button>`;
    } else if (members.length && !nodes.length) {
      const one = members.length === 1, m = members[0];
      const mat = materialOf(model);
      const sameProfile = members.every((k) => k.profile === m.profile);
      const allDeck = members.every((k) => k.deck), someDeck = members.some((k) => k.deck);
      const r = ok && one ? res.byId.get(m.id) : null;
      html = `
        <div class="head"><h2>${one ? `Barra ${esc(m.id)}` : `${members.length} barras`}</h2><small>${one ? `${esc(m.a)} a ${esc(m.b)}` : 'edición conjunta'}</small></div>
        <div class="group">
          <label class="field"><span>Tubo de ${esc(mat.name.toLowerCase())} (diámetro × espesor, mm)</span>
            <select data-field="profile">${sameProfile ? '' : '<option value="" selected>Perfiles distintos</option>'}
              ${PROFILES.map((p) => `<option value="${p.id}" ${sameProfile && p.id === m.profile ? 'selected' : ''}>${p.label} (${num(kgPerMeter(p, mat), 1)} kg/m)</option>`).join('')}
            </select></label>
          <label class="check"><input type="checkbox" data-field="deck" ${allDeck ? 'checked' : ''} ${someDeck && !allDeck ? 'data-mixed' : ''}><span>Es parte del tablero: por acá pasa el vehículo</span></label>
        </div>
        ${r ? `<div class="group"><h3>Resultado</h3>
          <div class="meter" data-level="${level(r.u)}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(r.u, 9.99) * 100)}" aria-label="Aprovechamiento"><i style="width:${Math.min(100, r.u * 100)}%"></i></div>
          <p>${r.u > 1.0005 ? `<b class="t-danger">No resiste:</b> trabaja al ${pct(r.u)} de lo admisible, por ${r.mode}.` : r.mode === 'sin esfuerzo' ? 'No está trabajando: con estas cargas no recibe esfuerzo.' : `Trabaja al <b>${pct(r.u)}</b> de lo admisible. La condiciona la ${r.mode === 'pandeo' ? 'posibilidad de pandeo' : r.mode}.`}</p>
          <dl class="facts">
            <dt>Largo</dt><dd>${num(r.L, 2)} m</dd>
            <dt>Esfuerzo</dt><dd>${Math.abs(r.Nmax - r.Nmin) < 0.05
              ? `<span class="${r.Nmax > 0 ? 't-tension' : 't-compression'}">${signed(r.Nmax, 1)} kN</span>`
              : `de <span class="t-compression">${signed(r.Nmin, 1)}</span> a <span class="t-tension">${signed(r.Nmax, 1)} kN</span>`}</dd>
            <dt>Admite en tracción</dt><dd>${num(r.capT, 0)} kN</dd>
            <dt>Admite en compresión</dt><dd>${num(r.capC, 0)} kN${r.buckling ? ' (pandea antes)' : ''}</dd>
            <dt>Pesa</dt><dd>${num(r.mass, 1)} kg</dd>
          </dl>
          <p class="fine">Positivo es tracción (se estira), negativo es compresión (se aplasta).${res.chain ? ' Debajo de la estructura se dibuja su línea de influencia.' : ''}</p>
        </div>` : ''}
        <button type="button" class="btn danger" data-act="delete">${icon('trash')}${one ? 'Borrar barra' : 'Borrar las barras'}</button>`;
    } else if (nodes.length + members.length > 1) {
      html = `<div class="head"><h2>${nodes.length + members.length} elementos</h2></div>
        <p class="hint">${nodes.length} ${nodes.length === 1 ? 'nudo' : 'nudos'} y ${members.length} ${members.length === 1 ? 'barra' : 'barras'}. Con las flechas del teclado movés los nudos.</p>
        <button type="button" class="btn danger" data-act="delete">${icon('trash')}Borrar la selección</button>`;
    } else {
      const b = bounds(model);
      const overs = ok ? res.members.filter((r) => r.u > 1.0005).sort((p, q) => q.u - p.u) : [];
      html = `<div class="head"><h2>${esc(model.name)}</h2>${model.example ? '<span class="tag">Ejemplo</span>' : ''}</div>
        ${!res || res.status === 'empty' ? `<p class="callout">${esc(res?.message || 'La hoja está vacía.')}</p>`
          : !ok ? `<p class="callout bad">${esc(res.message)}</p>`
          : overs.length ? `<div class="callout bad"><p><b>${overs.length} ${overs.length === 1 ? 'barra no resiste' : 'barras no resisten'}.</b> Engrosalas, acortalas o usá «Aligerar» en Cálculo para redimensionar todo.</p></div>
              <div class="pill-list">${overs.slice(0, 14).map((r) => `<button type="button" class="pill t-danger" data-act="pick" data-id="${r.id}">${r.id} ${pct(r.u)}</button>`).join('')}</div>`
          : `<p class="callout good">Todas las barras resisten. La más exigida es <button type="button" class="link" data-act="pick" data-id="${res.totals.worstId}">${res.totals.worstId}</button>, al ${pct(res.totals.maxU)}.</p>`}
        <dl class="facts">
          <dt>Nudos y barras</dt><dd>${model.nodes.length} y ${model.members.length}</dd>
          <dt>Largo y alto</dt><dd>${b.empty ? '0' : num(b.maxX - b.minX, 2)} m por ${b.empty ? '0' : num(b.maxY - b.minY, 2)} m</dd>
          <dt>Material</dt><dd>${esc(materialOf(model).name)}</dd>
          ${ok ? `<dt>Peso</dt><dd>${kg(res.totals.mass)}</dd>` : ''}
        </dl>
        ${model.example ? '<p class="fine">Las cargas y medidas de este ejemplo son inventadas para la demostración. Los resultados sí se calculan de verdad con esos datos.</p>' : ''}
        <p class="hint">Tocá un nudo o una barra para ver sus datos. Arrastrá un nudo y el cálculo se rehace mientras lo movés.</p>`;
    }
    el.sel.innerHTML = html;
  }

  const field = (name, label, value) => `<label class="field"><span>${label}</span><input type="text" inputmode="decimal" data-field="${name}" value="${value}" autocomplete="off"><span class="err" role="alert"></span></label>`;

  function fail(input, message) {
    input.setAttribute('aria-invalid', 'true');
    input.parentElement.querySelector('.err').textContent = message;
    return false;
  }

  el.sel.addEventListener('change', (e) => {
    const input = e.target, name = input.dataset.field;
    if (!name) return;
    const { sel } = store.get();
    if (name === 'profile') {
      if (!input.value) return;
      store.mutate((m) => sel.members.forEach((id) => { memberById(m, id).profile = input.value; }), { label: 'cambiar perfil' });
    } else if (name === 'deck') {
      store.mutate((m) => sel.members.forEach((id) => { memberById(m, id).deck = input.checked; }), { label: 'cambiar tablero' });
    } else {
      const v = parseNum(input.value), id = sel.nodes[0];
      if (v == null) return fail(input, 'Escribí un número, por ejemplo 12,5.');
      const coord = name === 'x' || name === 'y';
      const max = coord ? LIMITS.coord : LIMITS.load;
      if (Math.abs(v) > max) return fail(input, coord ? `Tiene que estar entre −${max} y ${max} m.` : `El máximo es ${num(max)} kN.`);
      if (coord) {
        const other = store.get().model.nodes.find((n) => n.id !== id && Math.abs(n.x - (name === 'x' ? v : nodeById(store.get().model, id).x)) < 1e-6 && Math.abs(n.y - (name === 'y' ? v : nodeById(store.get().model, id).y)) < 1e-6);
        if (other) return fail(input, `Ahí ya está el nudo ${other.id}.`);
      }
      store.mutate((m) => {
        const n = nodeById(m, id);
        if (coord) n[name] = v;
        else {
          const load = { fx: n.load?.fx || 0, fy: n.load?.fy || 0 };
          if (name === 'down') load.fy = -v; else load.fx = v;
          n.load = load.fx || load.fy ? load : null;
        }
      }, { label: coord ? 'mover nudo' : 'cambiar carga' });
    }
  });
  el.sel.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); e.target.parentElement.querySelector('.err').textContent = ''; } });
  el.sel.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input[type="text"]')) e.target.blur(); });
  el.sel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const { sel } = store.get();
    if (btn.dataset.act === 'support') store.mutate((m) => { nodeById(m, sel.nodes[0]).support = btn.dataset.value === 'none' ? null : btn.dataset.value; }, { label: 'cambiar apoyo' });
    else if (btn.dataset.act === 'delete') app.actions.deleteSelection();
    else if (btn.dataset.act === 'pick') app.actions.pickMember(btn.dataset.id);
  });

  // ═════════ Tabla de barras ═════════
  el.bars.innerHTML = `
    <div class="group">
      <label class="search"><span class="sr">Buscar barras</span>${'<i data-icon="search"></i>'}<input id="barQuery" type="search" placeholder="Buscar: B7, pandeo, uso>80, n<-100" autocomplete="off" spellcheck="false"></label>
      <div class="filters" role="group" aria-label="Filtrar por estado">
        ${[['all', 'Todas'], ['tension', 'Tracción'], ['compression', 'Compresión'], ['over', 'No resisten'], ['idle', 'Sin esfuerzo']].map(([k, label]) => `<button type="button" data-filter="${k}" aria-pressed="${k === 'all'}">${label}</button>`).join('')}
      </div>
    </div>
    <table class="bars"><thead><tr>
      ${[['id', 'Barra'], ['profile', 'Tubo'], ['L', 'Largo'], ['N', 'Esfuerzo'], ['u', 'Uso']].map(([k, label]) => `<th scope="col" data-sort="${k}"><button type="button">${label}</button></th>`).join('')}
    </tr></thead><tbody id="barRows"></tbody></table>
    <p class="fine" id="barCount" aria-live="polite"></p>`;

  /** Búsqueda con operadores: uso>80, n<-100, l>=4, y texto libre (id, nudos, tubo, modo). */
  function matcher(query) {
    const tests = query.trim().toLowerCase().split(/\s+/).filter(Boolean).map((tok) => {
      const m = tok.match(/^(uso|n|l|largo)(>=|<=|>|<|=)(-?\d+(?:[.,]\d+)?)$/);
      if (m) {
        const v = Number(m[3].replace(',', '.')), op = m[2];
        const get = m[1] === 'uso' ? (row) => (row.r ? row.r.u * 100 : NaN) : m[1] === 'n' ? (row) => (row.r ? row.r.Ngov : NaN) : (row) => row.L;
        return (row) => { const x = get(row); return op === '>' ? x > v : op === '<' ? x < v : op === '>=' ? x >= v : op === '<=' ? x <= v : Math.abs(x - v) < 0.5; };
      }
      return (row) => row.text.includes(tok);
    });
    return (row) => tests.every((t) => t(row));
  }

  function renderTable() {
    const { model, sel } = store.get(), res = app.results, ok = !!res?.ok;
    const node = new Map(model.nodes.map((n) => [n.id, n]));
    let rows = model.members.map((m) => {
      const r = ok ? res.byId.get(m.id) : null;
      const a = node.get(m.a), b = node.get(m.b);
      const p = profileOf(m);
      return { m, r, p, L: Math.hypot(b.x - a.x, b.y - a.y), text: `${m.id} ${m.a} ${m.b} ${p.label} ${p.id} ${r?.mode || ''} ${m.deck ? 'tablero' : ''}`.toLowerCase() };
    });
    const total = rows.length;
    const match = matcher(table.query);
    rows = rows.filter((row) => {
      if (!match(row)) return false;
      const r = row.r;
      if (table.filter === 'tension') return r && r.Ngov > 1e-6;
      if (table.filter === 'compression') return r && r.Ngov < -1e-6;
      if (table.filter === 'over') return r && r.u > 1.0005;
      if (table.filter === 'idle') return r && Math.abs(r.Ngov) <= 1e-6;
      return true;
    });
    const key = { id: (x) => parseInt(x.m.id.slice(1), 10) || 0, profile: (x) => x.p.index, L: (x) => x.L, N: (x) => x.r?.Ngov ?? 0, u: (x) => x.r?.u ?? 0 }[table.sort];
    rows.sort((p, q) => (key(p) - key(q)) * table.dir || p.m.id.localeCompare(q.m.id, 'es', { numeric: true }));

    $$('th[data-sort]', el.bars).forEach((th) => th.dataset.sort === table.sort ? th.setAttribute('aria-sort', table.dir > 0 ? 'ascending' : 'descending') : th.removeAttribute('aria-sort'));
    const selected = new Set(sel.members);
    $('#barRows').innerHTML = rows.length ? rows.map(({ m, r, p, L }) => `
      <tr tabindex="0" data-id="${m.id}" aria-selected="${selected.has(m.id)}">
        <td>${m.id}${m.deck ? ' <span class="tag" title="Parte del tablero">T</span>' : ''}</td><td>${p.label}</td><td>${num(L, 2)} m</td>
        <td class="${!r || Math.abs(r.Ngov) < 1e-6 ? '' : r.Ngov > 0 ? 't-tension' : 't-compression'}">${r ? signed(r.Ngov) : '–'}</td>
        <td>${r ? `<span class="mini" data-level="${level(r.u)}"><i style="width:${Math.min(100, r.u * 100)}%"></i></span>${pct(r.u)}` : '–'}</td>
      </tr>`).join('')
      : `<tr><td colspan="5"><div class="blank">${total ? `<p>Ninguna barra coincide con la búsqueda.</p><button type="button" class="btn" data-act="clear">Quitar filtros</button>` : '<p>Todavía no hay barras. Elegí la herramienta Barra y uní dos puntos de la hoja.</p>'}</div></td></tr>`;
    $('#barCount').textContent = total ? `${rows.length} de ${total} barras. Esfuerzo en kN: positivo tracción, negativo compresión.${ok ? '' : ' Sin resultados hasta que la estructura sea estable.'}` : '';
  }

  el.bars.addEventListener('input', (e) => { if (e.target.id === 'barQuery') { table.query = e.target.value; renderTable(); } });
  el.bars.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]'), th = e.target.closest('th[data-sort]'), tr = e.target.closest('tr[data-id]');
    if (f) { table.filter = f.dataset.filter; $$('[data-filter]', el.bars).forEach((b) => b.setAttribute('aria-pressed', b === f)); renderTable(); }
    else if (th) { if (table.sort === th.dataset.sort) table.dir *= -1; else { table.sort = th.dataset.sort; table.dir = th.dataset.sort === 'id' ? 1 : -1; } renderTable(); }
    else if (tr) app.actions.pickMember(tr.dataset.id, { additive: e.shiftKey || e.ctrlKey || e.metaKey, keepTab: true });
    else if (e.target.closest('[data-act="clear"]')) { table.query = ''; table.filter = 'all'; $('#barQuery').value = ''; $$('[data-filter]', el.bars).forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === 'all')); renderTable(); }
  });
  el.bars.addEventListener('keydown', (e) => {
    const tr = e.target.closest?.('tr[data-id]'); if (!tr) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); app.actions.pickMember(tr.dataset.id, { keepTab: true }); $(`tr[data-id="${tr.dataset.id}"]`, el.bars)?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); tr.nextElementSibling?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); tr.previousElementSibling?.focus(); }
  });

  // ═════════ Cálculo ═════════
  el.calc.innerHTML = `
    <div class="group"><h3>Material y seguridad</h3>
      <label class="field"><span>Material de todos los tubos</span><select id="cMaterial">${Object.values(MATERIALS).map((m) => `<option value="${m.id}">${m.name}</option>`).join('')}</select></label>
      <div class="grid2">
        <label class="field"><span>Coeficiente de seguridad</span><input id="cSafety" type="text" inputmode="decimal" autocomplete="off"><span class="err" role="alert"></span></label>
        <label class="field"><span>Precio por kilo (USD)</span><input id="cPrice" type="text" inputmode="decimal" autocomplete="off"><span class="err" role="alert"></span></label>
      </div>
      <p class="fine">El precio es un valor de ejemplo editable, no una cotización.</p>
      <label class="check"><input id="cSelf" type="checkbox"><span>Contar el peso propio de los tubos</span></label>
    </div>
    <div class="group"><h3>Vehículo que cruza</h3>
      <label class="check"><input id="cMoving" type="checkbox"><span>Hacer pasar un vehículo por el tablero</span></label>
      <label class="field"><span>Peso del vehículo (kN)</span><input id="cP" type="text" inputmode="decimal" autocomplete="off"><span class="err" role="alert"></span></label>
      <p class="fine" id="cMovingNote"></p>
    </div>
    <div class="group"><h3>Qué se dibuja</h3>
      <label class="field"><span>Exageración de la deformada</span><input id="cDeform" type="range" min="0" max="3" step="0.1"></label>
      <label class="check"><input id="cLabels" type="checkbox"><span>Esfuerzos y reacciones escritos sobre la hoja</span></label>
      <label class="check"><input id="cFlow" type="checkbox"><span>Animar el sentido del esfuerzo</span></label>
    </div>
    <div class="group"><h3>Aligerar</h3>
      <p class="hint">Elige para cada barra el tubo más liviano que resiste, repitiendo el cálculo hasta que nada cambia.</p>
      <button type="button" class="btn primary wide" id="cOptimize">Aligerar la estructura</button>
      <p class="fine" id="cOptimizeNote" aria-live="polite"></p>
    </div>
    <div class="group"><h3>Ensayo destructivo</h3>
      <p class="hint">Multiplica toda la carga hasta que algo cede y muestra cómo se cae. No modifica tu estructura.</p>
      <button type="button" class="btn wide" id="cTest">Cargar hasta que se caiga</button>
    </div>
    <p class="fine">Tirante calcula reticulados planos con nudos articulados por el método de rigidez directa: tracción por fluencia y compresión por fluencia o pandeo de Euler. Sirve para aprender y predimensionar; no reemplaza el cálculo de un profesional según el reglamento vigente.</p>`;

  function syncCalc() {
    const { model, view } = store.get(), s = model.settings, res = app.results;
    const set = (id, v) => { const i = $(id); if (document.activeElement !== i) i.value = v; };
    $('#cMaterial').value = s.material;
    set('#cSafety', num(s.safety, 2)); set('#cPrice', num(s.pricePerKg, 2)); set('#cP', num(s.moving.P, 0));
    $('#cSelf').checked = s.selfWeight; $('#cMoving').checked = s.moving.enabled;
    $('#cDeform').value = view.deform; $('#cLabels').checked = view.labels; $('#cFlow').checked = view.flow;
    const hasDeck = model.members.some((m) => m.deck);
    $('#cMovingNote').textContent = !hasDeck ? 'Esta estructura no tiene tablero. Elegí las barras por donde pasa el vehículo y marcalas como tablero.'
      : s.moving.enabled ? 'Cada barra se verifica con el vehículo en la posición que más la exige.' : '';
    $('#cOptimize').disabled = !res?.ok; $('#cTest').disabled = !res?.ok;
  }

  const numeric = (id, { min, max, apply, label, hint }) => {
    const input = $(id);
    input.addEventListener('change', () => {
      const v = parseNum(input.value);
      if (v == null || v < min || v > max) return fail(input, hint);
      store.mutate((m) => apply(m.settings, v), { label });
    });
    input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); input.parentElement.querySelector('.err').textContent = ''; });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  };
  numeric('#cSafety', { min: 1, max: 5, label: 'cambiar seguridad', hint: 'Entre 1 y 5. Lo habitual es 1,5.', apply: (s, v) => { s.safety = v; } });
  numeric('#cPrice', { min: 0, max: 1000, label: 'cambiar precio', hint: 'Entre 0 y 1.000.', apply: (s, v) => { s.pricePerKg = v; } });
  numeric('#cP', { min: 0, max: LIMITS.load, label: 'cambiar vehículo', hint: `Entre 0 y ${num(LIMITS.load)} kN.`, apply: (s, v) => { s.moving.P = v; } });
  $('#cMaterial').addEventListener('change', (e) => store.mutate((m) => { m.settings.material = e.target.value; }, { label: 'cambiar material' }));
  $('#cSelf').addEventListener('change', (e) => store.mutate((m) => { m.settings.selfWeight = e.target.checked; }, { label: 'peso propio' }));
  $('#cMoving').addEventListener('change', (e) => { store.mutate((m) => { m.settings.moving.enabled = e.target.checked; }, { label: 'vehículo' }); if (!e.target.checked) store.set({ vehiclePos: null }); });
  $('#cDeform').addEventListener('input', (e) => app.actions.setView({ deform: +e.target.value }));
  $('#cLabels').addEventListener('change', (e) => app.actions.setView({ labels: e.target.checked }));
  $('#cFlow').addEventListener('change', (e) => app.actions.setView({ flow: e.target.checked }));
  $('#cOptimize').addEventListener('click', () => app.actions.optimize());
  $('#cTest').addEventListener('click', () => app.actions.runTest());

  // ═════════ Biblioteca ═════════
  el.lib.innerHTML = `
    <div class="row"><button type="button" class="btn primary" data-act="new">${icon('plus')}Nuevo</button><button type="button" class="btn" data-act="import">${icon('upload')}Importar</button></div>
    <div class="group"><h3>Guardados en este navegador</h3>
      <div class="lib-tools">
        <label class="search"><span class="sr">Buscar proyectos</span><i data-icon="search"></i><input id="libQuery" type="search" placeholder="Buscar por nombre" autocomplete="off"></label>
        <label class="sort"><span class="sr">Ordenar</span><select id="libSort"><option value="recent">Recientes</option><option value="name">Nombre</option><option value="mass">Más livianos</option></select></label>
      </div>
      <div class="cards" id="libCards"></div>
      <p class="fine" id="libNote"></p>
    </div>
    <div class="group"><h3>Exportar el proyecto abierto</h3>
      <div class="row">
        <button type="button" class="btn" data-act="export-json">${icon('download')}Proyecto</button>
        <button type="button" class="btn" data-act="export-svg">${icon('download')}Plano SVG</button>
        <button type="button" class="btn" data-act="export-csv">${icon('download')}Tabla CSV</button>
      </div>
      <p class="fine">El archivo de proyecto se puede volver a importar acá, en cualquier dispositivo.</p>
    </div>
    <div class="group"><h3>Empezar desde un ejemplo</h3>
      <div class="examples">${EXAMPLES.map((x) => `<button type="button" class="example" data-act="example" data-key="${x.key}"><b>${x.title}</b><small>${x.blurb}</small></button>`).join('')}</div>
      <p class="fine">Los ejemplos traen cargas inventadas. Abrirlos crea una copia tuya.</p>
    </div>`;

  function massOf(p) {
    const k = p.id + ':' + p.updatedAt;
    if (!weightCache.has(k)) { const r = analyze(p); weightCache.set(k, r.ok ? r.totals.mass : p.members.length ? Infinity : 0); }
    return weightCache.get(k);
  }

  function renderLibrary() {
    const current = store.get().model.id;
    const q = lib.query.trim().toLowerCase();
    const all = app.persist.list();
    let list = all.filter((p) => !q || p.name.toLowerCase().includes(q));
    list.sort(lib.sort === 'name' ? (a, b) => a.name.localeCompare(b.name, 'es') : lib.sort === 'mass' ? (a, b) => massOf(a) - massOf(b) : (a, b) => b.updatedAt - a.updatedAt);
    const fmtDate = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    $('#libCards').innerHTML = list.length ? list.map((p) => {
      const mass = massOf(p);
      return `<div class="card" aria-current="${p.id === current}">
        <button type="button" class="card-open" data-act="open" data-id="${p.id}" aria-label="Abrir ${esc(p.name)}">
          <span class="thumb">${p.members.length ? toSVG(p, null, { mini: true }) : ''}</span>
          <span class="meta"><b>${p.example ? '<span class="tag">Ejemplo</span>' : ''}${esc(p.name)}</b>
          <small>${p.members.length} barras, ${Number.isFinite(mass) ? kg(mass) : 'inestable'}. ${fmtDate.format(p.updatedAt)}</small></span>
        </button>
        <span class="card-actions">
          <button type="button" class="icon-btn" data-act="duplicate" data-id="${p.id}" aria-label="Duplicar ${esc(p.name)}" title="Duplicar">${icon('copy')}</button>
          <button type="button" class="icon-btn" data-act="remove" data-id="${p.id}" aria-label="Borrar ${esc(p.name)}" title="Borrar">${icon('trash')}</button>
        </span></div>`;
    }).join('') : `<div class="blank"><p>${all.length ? `Ningún proyecto se llama «${esc(lib.query)}».` : 'Todavía no hay proyectos guardados.'}</p></div>`;
    $('#libNote').textContent = app.persist.volatile
      ? 'Este navegador no permite guardar (modo privado o almacenamiento bloqueado). Exportá el proyecto para no perderlo.'
      : 'Se guarda solo, únicamente en este navegador y este dispositivo. Si borrás los datos del sitio, se pierden: exportá lo que quieras conservar.';
  }

  el.lib.addEventListener('input', (e) => { if (e.target.id === 'libQuery') { lib.query = e.target.value; renderLibrary(); } });
  el.lib.addEventListener('change', (e) => { if (e.target.id === 'libSort') { lib.sort = e.target.value; renderLibrary(); } });
  el.lib.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = app.actions, id = b.dataset.id;
    ({ new: a.newProject, import: a.importFile, 'export-json': a.exportJSON, 'export-svg': a.exportSVG, 'export-csv': a.exportCSV,
      example: () => a.loadExample(b.dataset.key), open: () => a.openProject(id), duplicate: () => a.duplicateProject(id), remove: () => a.deleteProject(id) })[b.dataset.act]?.();
  });

  hydrateIcons(el.bars); hydrateIcons(el.lib);

  return {
    /** Redibuja lo que corresponde a la pestaña visible. */
    render() {
      const { tab } = store.get();
      if (tab === 'sel') renderInspector();
      else if (tab === 'bars') renderTable();
      else if (tab === 'calc') syncCalc();
      else renderLibrary();
    },
    renderLibrary,
  };
}
