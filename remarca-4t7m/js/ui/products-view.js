// Vista de productos: alta rápida, búsqueda, filtros, selección múltiple, edición y remarcado.
import { formatMoney, moneyParts, ROUNDINGS } from '../core/money.js';
import { UNITS, addProduct, categories, discount, previewReprice, queryProducts, removeProducts, reprice, unitShort, updateProduct, validateProduct } from '../core/products.js';
import { $, $$, esc, hydrateIcons, icon, plural } from './dom.js';

export const priceTag = (p) => { const m = moneyParts(p.price); return `<span class="tag-price ${p.offer ? 'offer' : ''}"><small>$</small>${m.int}${m.dec ? `<small>,${m.dec}</small>` : ''}</span>`; };

export function createProductsView(app) {
  const root = $('#v-products'), store = app.store;
  root.innerHTML = `
    <header><div><h1>Productos</h1><p>Cargalos una sola vez. De acá salen los carteles, las etiquetas y el remarcado.</p></div>
      <button type="button" class="btn primary big" data-act="reprice">${icon('percent')}Remarcar precios</button></header>
    <form class="quick" id="quickAdd" novalidate>
      <label class="field"><span>Producto nuevo</span><input name="name" type="text" placeholder="Ej.: Yerba mate 1 kg" autocomplete="off" maxlength="80" enterkeyhint="next"><span class="err" role="alert"></span></label>
      <label class="field"><span>Precio</span><span class="money"><input name="price" type="text" inputmode="decimal" placeholder="4.850" autocomplete="off" enterkeyhint="done"></span><span class="err" role="alert"></span></label>
      <button class="btn dark" style="margin-top:24px">${icon('plus')}Agregar</button>
    </form>
    <div class="toolbar">
      <label class="search"><span class="sr">Buscar productos</span><i data-icon="search"></i><input id="pQuery" type="search" placeholder="Buscar: yerba, lácteos, oferta, >3000" autocomplete="off" spellcheck="false"></label>
      <label><span class="sr">Ordenar</span><select id="pSort" class="bare-select">
        <option value="category">Por categoría</option><option value="name">Por nombre</option><option value="priceUp">Más baratos primero</option><option value="priceDown">Más caros primero</option><option value="recent">Últimos cambios</option>
      </select></label>
    </div>
    <div class="chips scroll" id="pChips" role="group" aria-label="Filtrar"></div>
    <div id="pList"></div>
    <div class="bulk" id="pBulk" hidden></div>`;
  hydrateIcons(root);

  function render() {
    const { model: data, filter, sel } = store.get();
    const cats = categories(data);
    const nOffer = data.products.filter((p) => p.offer).length, nPending = data.products.filter((p) => p.pending).length;
    const chip = (key, value, label, n) => `<button type="button" class="chip" data-chip="${key}" data-value="${esc(value)}" aria-pressed="${(key === 'category' ? filter.category : filter.flag) === value}">${esc(label)}${n != null ? ` <small>${n}</small>` : ''}</button>`;
    $('#pChips').innerHTML = `<button type="button" class="chip" data-chip="all" aria-pressed="${filter.category == null && filter.flag == null}">Todos <small>${data.products.length}</small></button>`
      + (nOffer ? chip('flag', 'offer', 'En oferta', nOffer) : '') + (nPending ? chip('flag', 'pending', 'Sin imprimir', nPending) : '')
      + cats.map((c) => chip('category', c, c, data.products.filter((p) => p.category === c).length)).join('');
    if ($('#pSort').value !== filter.sort) $('#pSort').value = filter.sort;

    const list = queryProducts(data, filter), selected = new Set(sel);
    let html = '', lastCat = null;
    list.forEach((p, i) => {
      if (filter.sort === 'category' && p.category !== lastCat) { lastCat = p.category; html += `<li class="prow cat">${esc(p.category || 'Sin categoría')}</li>`; }
      const off = discount(p);
      html += `<li class="prow" aria-selected="${selected.has(p.id)}" style="animation-delay:${Math.min(i, 14) * 16}ms">
        <label class="pick"><input type="checkbox" data-pick="${p.id}" ${selected.has(p.id) ? 'checked' : ''} aria-label="Elegir ${esc(p.name)}"></label>
        <button type="button" class="popen" data-edit="${p.id}" aria-label="Editar ${esc(p.name)}, ${formatMoney(p.price)}">
          <span class="pinfo"><b>${esc(p.name)}</b><span>${unitShort(p.unit)}${p.offer ? ` <span class="badge offer">Oferta${off ? ` −${off}%` : ''}</span>` : ''}${p.offer && p.prev > p.price ? ` <s>${formatMoney(p.prev)}</s>` : ''}${p.pending ? ' <span class="badge pending">Sin imprimir</span>' : ''}</span></span>
          ${priceTag(p)}
        </button></li>`;
    });
    $('#pList').innerHTML = list.length ? `<ul class="plist">${html}</ul><p class="fine" style="margin-top:8px">${list.length === data.products.length ? plural(list.length, 'producto', 'productos') : `${list.length} de ${plural(data.products.length, 'producto', 'productos')}`}. Tocá uno para editarlo.</p>`
      : data.products.length
        ? `<div class="blank"><h2>Nada coincide</h2><p>Ningún producto coincide con la búsqueda o el filtro.</p><button type="button" class="btn" data-act="clear">Quitar filtros</button></div>`
        : `<div class="blank"><h2>Todavía no hay productos</h2><p>Escribí el primero arriba, o traé tu lista desde Excel en un solo paso.</p><div class="row"><button type="button" class="btn primary" data-act="import">${icon('upload')}Importar lista</button><button type="button" class="btn" data-act="demo">Ver con un ejemplo</button></div></div>`;

    const bulk = $('#pBulk');
    bulk.hidden = !sel.length;
    if (sel.length) bulk.innerHTML = `<b>${plural(sel.length, 'elegido', 'elegidos')}</b>
      <button type="button" class="btn primary" data-act="reprice">${icon('percent')}Remarcar</button>
      <button type="button" class="btn" data-act="offer">Oferta sí/no</button>
      <button type="button" class="btn" data-act="poster">Cartel</button>
      <button type="button" class="btn" data-act="labels">Etiquetas</button>
      <button type="button" class="btn" data-act="delete" aria-label="Borrar los elegidos">${icon('trash')}</button>
      <button type="button" class="btn" data-act="none">Soltar</button>`;
  }

  // Alta rápida
  const quick = $('#quickAdd');
  quick.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(quick);
    const { filter } = store.get();
    const v = validateProduct({ name: fd.get('name'), price: fd.get('price'), category: filter.category || '' });
    showErrors(quick, v.errors);
    if (!v.ok) return quick.querySelector('[aria-invalid="true"]')?.focus();
    store.mutate((d) => { addProduct(d, v.value); }, { label: 'agregar producto' });
    quick.reset(); quick.elements.name.focus();
    app.toast(`${v.value.name} agregado a ${formatMoney(v.value.price)}`, { duration: 2200 });
  });
  quick.addEventListener('input', (e) => clearError(e.target));

  root.addEventListener('input', (e) => { if (e.target.id === 'pQuery') store.set({ filter: { ...store.get().filter, query: e.target.value } }); });
  root.addEventListener('change', (e) => {
    if (e.target.id === 'pSort') store.set({ filter: { ...store.get().filter, sort: e.target.value } });
    const pick = e.target.dataset?.pick;
    if (pick) { const s = new Set(store.get().sel); e.target.checked ? s.add(pick) : s.delete(pick); store.set({ sel: [...s] }); }
  });
  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-chip]'), edit = e.target.closest('[data-edit]'), act = e.target.closest('[data-act]')?.dataset.act;
    const { filter, sel } = store.get();
    if (chip) {
      const k = chip.dataset.chip, v = chip.dataset.value;
      store.set({ filter: { ...filter, category: k === 'category' ? v : null, flag: k === 'flag' ? v : null } });
    } else if (edit) editProduct(app, edit.dataset.edit);
    else if (act === 'reprice') openReprice(app);
    else if (act === 'clear') { $('#pQuery').value = ''; store.set({ filter: { ...filter, query: '', category: null, flag: null } }); }
    else if (act === 'import') app.actions.importList();
    else if (act === 'demo') app.actions.loadDemo();
    else if (act === 'none') store.set({ sel: [] });
    else if (act === 'offer') {
      const on = !sel.every((id) => store.get().model.products.find((p) => p.id === id)?.offer);
      store.mutate((d) => sel.forEach((id) => updateProduct(d, id, { offer: on })), { label: on ? 'poner en oferta' : 'quitar oferta' });
      app.toast(on ? `${plural(sel.length, 'producto', 'productos')} en oferta` : 'Oferta quitada', { action: { label: 'Deshacer', run: () => store.undo() } });
    } else if (act === 'delete') app.actions.deleteProducts(sel);
    else if (act === 'poster') app.actions.posterFor(sel);
    else if (act === 'labels') app.actions.labelsFor(sel);
  });

  return { render, focusAdd() { quick.elements.name.focus(); }, focusSearch() { $('#pQuery').focus(); } };
}

// ───────── Formularios ─────────
export function showErrors(form, errors) {
  $$('.field', form).forEach((f) => {
    const input = f.querySelector('input, select, textarea'), err = f.querySelector('.err');
    if (!input || !err) return;
    const msg = errors[input.name] || '';
    err.textContent = msg;
    msg ? input.setAttribute('aria-invalid', 'true') : input.removeAttribute('aria-invalid');
  });
}
export function clearError(input) {
  if (!input.getAttribute?.('aria-invalid')) return;
  input.removeAttribute('aria-invalid');
  const err = input.closest('.field')?.querySelector('.err'); if (err) err.textContent = '';
}

/** Ficha de producto (alta completa o edición). */
export function editProduct(app, id = null) {
  const store = app.store, data = store.get().model;
  const p = id ? data.products.find((k) => k.id === id) : null;
  if (id && !p) return;
  const dlg = $('#sheet');
  const num = (v) => (v == null ? '' : String(v).replace('.', ','));
  dlg.innerHTML = `<form method="dialog" novalidate>
    <h2>${p ? 'Editar producto' : 'Producto nuevo'}</h2>
    <div class="dlg-scroll">
      <label class="field"><span>Nombre</span><input name="name" type="text" value="${esc(p?.name || '')}" maxlength="80" autocomplete="off"><span class="err" role="alert"></span></label>
      <div class="grid2">
        <label class="field"><span>Precio</span><span class="money"><input name="price" type="text" inputmode="decimal" value="${num(p?.price)}" autocomplete="off"></span><span class="err" role="alert"></span></label>
        <label class="field"><span>Se vende</span><select name="unit">${UNITS.map((u) => `<option value="${u.id}" ${u.id === (p?.unit || 'un') ? 'selected' : ''}>${u.label}</option>`).join('')}</select></label>
      </div>
      <div class="grid2">
        <label class="field"><span>Categoría</span><input name="category" type="text" list="catList" value="${esc(p?.category || '')}" maxlength="30" autocomplete="off" placeholder="Ej.: Almacén"><span class="err" role="alert"></span></label>
        <label class="field"><span>Código de barras (opcional)</span><input name="code" type="text" inputmode="numeric" value="${esc(p?.code || '')}" autocomplete="off" placeholder="13 dígitos"><span class="err" role="alert"></span></label>
      </div>
      <datalist id="catList">${categories(data).map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
      <label class="check"><input name="offer" type="checkbox" ${p?.offer ? 'checked' : ''}><span>Está en oferta</span></label>
      <label class="field"><span>Precio anterior, el que se muestra tachado</span><span class="money"><input name="prev" type="text" inputmode="decimal" value="${num(p?.prev)}" autocomplete="off" placeholder="Opcional"></span><span class="err" role="alert"></span></label>
      ${p ? `<p class="fine">${p.pending ? 'Su etiqueta está sin imprimir.' : 'Su etiqueta ya fue impresa con este precio.'} Si cambiás el precio, el actual pasa a ser el anterior.</p>` : ''}
    </div>
    <div class="row end">
      ${p ? `<button type="button" class="btn danger" data-act="delete" style="margin-right:auto">${icon('trash')}Borrar</button>` : ''}
      <button type="button" class="btn" data-act="cancel">Cancelar</button>
      <button class="btn primary" value="save">Guardar</button>
    </div></form>`;
  const form = dlg.querySelector('form');
  form.addEventListener('input', (e) => clearError(e.target));
  form.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cancel') dlg.close();
    if (act === 'delete') { dlg.close(); app.actions.deleteProducts([p.id]); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const v = validateProduct({ name: fd.get('name'), price: fd.get('price'), unit: fd.get('unit'), category: fd.get('category'), code: fd.get('code'), prev: fd.get('prev'), offer: fd.get('offer') === 'on' });
    showErrors(form, v.errors);
    if (!v.ok) return form.querySelector('[aria-invalid="true"]')?.focus();
    if (p) store.mutate((d) => { updateProduct(d, p.id, v.value); }, { label: 'editar producto' });
    else store.mutate((d) => { addProduct(d, v.value); }, { label: 'agregar producto' });
    dlg.close();
    app.toast(p ? 'Cambios guardados' : `${v.value.name} agregado`, { duration: 2000 });
  });
  dlg.showModal();
  form.elements.name.focus();
  if (p) form.elements.name.select?.();
}

/** Remarcado en bloque con vista previa del antes y el después. */
export function openReprice(app) {
  const store = app.store, { model: data, sel, filter } = store.get();
  if (!data.products.length) return app.toast('Primero cargá algún producto', { kind: 'error' });
  const dlg = $('#sheet'), cats = categories(data);
  const startScope = sel.length ? 'sel' : filter.category ? 'cat' : 'all';
  dlg.innerHTML = `<form method="dialog" novalidate>
    <h2>Remarcar precios</h2>
    <div class="dlg-scroll">
      <div class="group"><h3>A qué productos</h3>
        <div class="chips" role="radiogroup" aria-label="Alcance">
          <button type="button" class="chip" role="radio" data-scope="all">Todos <small>${data.products.length}</small></button>
          ${sel.length ? `<button type="button" class="chip" role="radio" data-scope="sel">Los elegidos <small>${sel.length}</small></button>` : ''}
          ${cats.length ? '<button type="button" class="chip" role="radio" data-scope="cat">Una categoría</button>' : ''}
        </div>
        <label class="field" id="rpCatField" hidden><span class="sr">Categoría</span><select name="category">${cats.map((c) => `<option ${c === filter.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div class="group"><h3>Cuánto</h3>
        <div class="grid2">
          <div class="chips" role="radiogroup" aria-label="Sentido">
            <button type="button" class="chip" role="radio" data-dir="1" aria-checked="true">Aumentar</button>
            <button type="button" class="chip" role="radio" data-dir="-1" aria-checked="false">Bajar</button>
          </div>
          <label class="field pct"><span class="sr">Porcentaje</span><input name="pct" type="text" inputmode="decimal" value="10" autocomplete="off"><span class="err" role="alert"></span></label>
        </div>
        <div class="chips" aria-label="Porcentajes frecuentes">${[3, 5, 8, 10, 15, 20].map((n) => `<button type="button" class="chip" data-pct="${n}">${n} %</button>`).join('')}</div>
      </div>
      <label class="field"><span>Redondeo</span><select name="rounding">${ROUNDINGS.map((r) => `<option value="${r.id}" ${r.id === (app.persist.prefs().rounding || '10') ? 'selected' : ''}>${r.label}</option>`).join('')}</select></label>
      <div class="group"><h3>Así quedan</h3><ul class="preview" id="rpPreview"></ul><p class="summary" id="rpSummary" aria-live="polite"></p></div>
    </div>
    <div class="row end"><button type="button" class="btn" data-act="cancel">Cancelar</button><button class="btn primary" id="rpApply">Aplicar</button></div></form>`;
  const form = dlg.querySelector('form');
  let scope = startScope, dir = 1;

  const options = () => {
    const raw = String(form.elements.pct.value).trim().replace(',', '.').replace('%', '');
    const pct = /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
    const ids = scope === 'sel' ? sel : scope === 'cat' ? data.products.filter((p) => p.category === form.elements.category.value).map((p) => p.id) : null;
    return { pct, ids, rounding: form.elements.rounding.value };
  };
  const refresh = () => {
    $$('[data-scope]', form).forEach((b) => b.setAttribute('aria-checked', b.dataset.scope === scope));
    $$('[data-dir]', form).forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.dir) === dir));
    $('#rpCatField').hidden = scope !== 'cat';
    const o = options(), err = form.querySelector('.err'), apply = $('#rpApply');
    const bad = !Number.isFinite(o.pct) ? 'Escribí un porcentaje, por ejemplo 12 o 7,5.' : o.pct > 500 ? 'El máximo es 500 %.' : dir < 0 && o.pct >= 100 ? 'No se puede bajar 100 % o más.' : '';
    err.textContent = bad; bad ? form.elements.pct.setAttribute('aria-invalid', 'true') : form.elements.pct.removeAttribute('aria-invalid');
    if (bad) { $('#rpPreview').innerHTML = ''; $('#rpSummary').textContent = 'Sin vista previa.'; apply.disabled = true; return null; }
    const pv = previewReprice(data, { ...o, pct: o.pct * dir });
    $('#rpPreview').innerHTML = pv.changes.slice(0, 5).map((c) => `<li><span>${esc(c.name)}</span><s>${formatMoney(c.before)}</s><b class="${c.after > c.before ? 'up' : 'down'}">${formatMoney(c.after)}</b></li>`).join('')
      + (pv.count > 5 ? `<li><span class="fine">y ${plural(pv.count - 5, 'producto más', 'productos más')}</span><s></s><b></b></li>` : '');
    $('#rpSummary').textContent = pv.count
      ? `Cambian ${pv.count} de ${plural(pv.total, 'precio', 'precios')}. Con el redondeo, ${pv.realPct >= 0 ? 'el aumento' : 'la baja'} real es de ${Math.abs(pv.realPct).toFixed(1).replace('.', ',')} %.`
      : 'Con ese porcentaje y redondeo no cambia ningún precio.';
    apply.disabled = !pv.count; apply.textContent = pv.count ? `Remarcar ${plural(pv.count, 'precio', 'precios')}` : 'Aplicar';
    return { o, pv };
  };
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.scope) scope = b.dataset.scope;
    else if (b.dataset.dir) dir = Number(b.dataset.dir);
    else if (b.dataset.pct) form.elements.pct.value = b.dataset.pct;
    else if (b.dataset.act === 'cancel') return dlg.close();
    else return;
    refresh();
  });
  form.addEventListener('input', refresh);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = refresh(); if (!r || !r.pv.count) return;
    store.mutate((d) => { reprice(d, { ...r.o, pct: r.o.pct * dir }); }, { label: 'remarcar' });
    app.persist.savePrefs({ rounding: r.o.rounding });
    dlg.close();
    app.toast(`${plural(r.pv.count, 'precio remarcado', 'precios remarcados')}. Sus etiquetas quedaron sin imprimir.`, { action: { label: 'Deshacer', run: () => store.undo() } });
  });
  dlg.showModal(); refresh(); form.elements.pct.focus(); form.elements.pct.select();
}

export { removeProducts };
