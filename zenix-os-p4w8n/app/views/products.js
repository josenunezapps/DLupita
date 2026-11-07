import { h, mount, field, showErrors, formValues, banner, busy, toast, debounce } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { parseMoney, formatMoney, minorToInput } from '../lib/money.js';
import { can, formatQty, parseQty, stockState } from '../lib/roles.js';
import * as v from '../lib/validate.js';
import { shell } from './shell.js';

const UNITS = ['unidad', 'kg', 'g', 'litro', 'm', 'm²', 'caja', 'paquete', 'par', 'docena'];

export function stockCell(p) {
  if (!p.track_stock) return h('span', { class: 'row-end' }, h('span', { class: 'badge badge-neutral' }, 'Sin control'));
  const st = stockState(p);
  return h('span', { class: 'row-end' },
    h('span', { class: `stock ${st === 'out' ? 'stock-out' : st === 'low' ? 'stock-low' : ''}` }, formatQty(p.stock_milli)),
    st === 'out' ? h('span', { class: 'badge badge-err' }, 'Agotado') : st === 'low' ? h('span', { class: 'badge badge-warn' }, 'Bajo') : null,
  );
}

export async function productsView(ctx) {
  const { org, member } = ctx.state;
  const editable = can.editCatalog(member.role);
  const list = h('div', { class: 'list', 'aria-live': 'polite' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar por nombre o código', 'aria-label': 'Buscar productos', autocomplete: 'off' });
  const chips = h('div', { class: 'chips', 'aria-label': 'Filtrar por categoría' });
  const inactive = h('input', { type: 'checkbox', id: 'show-inactive' });
  let category = '';
  let categories = [];
  let products = [];

  const catBtn = editable ? h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => categoriesDialog(org, () => load()) }, 'Categorías') : null;
  shell(ctx, {
    section: 'productos',
    title: 'Productos',
    actions: editable ? h('div', { class: 'cat-bar' }, catBtn, h('a', { class: 'btn btn-primary', href: '#/productos/nuevo' }, '+ Nuevo producto')) : null,
  },
    editable ? null : h('p', { class: 'muted' }, 'Podés consultar precios y stock. El catálogo lo editan el dueño o el supervisor.'),
    chips,
    h('div', { class: 'toolbar' }, search, h('label', { class: 'toggle', for: 'show-inactive' }, inactive, ' Ver inactivos')),
    list,
  );

  function paint() {
    chips.replaceChildren(
      h('button', { type: 'button', class: `chip${category === '' ? ' active' : ''}`, onclick: () => { category = ''; paint(); } }, 'Todas'),
      ...categories.filter((c) => !c.archived).map((c) =>
        h('button', { type: 'button', class: `chip${category === c.id ? ' active' : ''}`, onclick: () => { category = c.id; paint(); } }, c.name)),
    );
    chips.hidden = categories.filter((c) => !c.archived).length === 0;
    const term = search.value.trim().toLowerCase();
    const visible = products.filter((p) => (inactive.checked ? !p.active : p.active)
      && (!category || p.category_id === category)
      && (!term || p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term)));
    if (products.length === 0) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Tu catálogo está vacío'),
        editable ? h('a', { class: 'btn btn-primary', href: '#/productos/nuevo' }, 'Cargar el primero') : h('p', { class: 'muted' }, 'Todavía no hay productos cargados.'),
      ));
      return;
    }
    if (visible.length === 0) {
      list.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'No hay productos con ese filtro.')));
      return;
    }
    const catName = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    list.replaceChildren(...visible.map((p) => {
      const inner = [
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, p.name),
          h('span', { class: 'row-sub' }, [formatMoney(p.price_minor, org.currency), p.unit !== 'unidad' ? `por ${p.unit}` : null, catName[p.category_id], p.sku ? `Cód. ${p.sku}` : null].filter(Boolean).join(' · ')),
        ),
        stockCell(p),
      ];
      return editable
        ? h('a', { class: 'row-item', href: `#/productos/${p.id}` }, inner, h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'))
        : h('div', { class: 'row-item' }, inner);
    }));
  }

  async function load() {
    list.replaceChildren(...[1, 2, 3].map(() => h('div', { class: 'skeleton row' })));
    try {
      [categories, products] = await Promise.all([
        db.select('categories', 'select=id,name,archived&order=name.asc'),
        db.select('products', 'select=id,name,sku,unit,price_minor,category_id,track_stock,min_stock_milli,active,stock_milli&order=name.asc&limit=2000'),
      ]);
      paint();
    } catch (err) {
      list.replaceChildren(banner('error', err.message));
    }
  }
  search.addEventListener('input', debounce(paint, 150));
  inactive.addEventListener('change', paint);
  await load();
}

export async function productFormView(ctx, route) {
  const { org, member } = ctx.state;
  const isNew = route.id === 'nuevo';
  const seeCost = can.seeCost(member.role);
  shell(ctx, { section: 'productos', title: isNew ? 'Nuevo producto' : 'Producto', back: 'productos' }, h('div', { class: 'skeleton card-lg' }));

  let p = { unit: 'unidad', track_stock: true, active: true };
  let categories = [];
  try {
    const reqs = [db.select('categories', 'select=id,name,archived&archived=eq.false&order=name.asc')];
    if (!isNew) reqs.push(db.one('products', `select=*,stock_milli&id=eq.${encodeURIComponent(route.id)}`));
    const [cats, prod] = await Promise.all(reqs);
    categories = cats;
    if (!isNew) {
      if (!prod) return shell(ctx, { section: 'productos', title: 'Producto', back: 'productos' }, banner('error', 'No encontramos ese producto.'));
      p = prod;
    }
  } catch (err) {
    return shell(ctx, { section: 'productos', title: 'Producto', back: 'productos' }, banner('error', err.message));
  }

  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, isNew ? 'Guardar producto' : 'Guardar cambios');
  const catOptions = [['', 'Sin categoría'], ...categories.map((c) => [c.id, c.name])];
  const trackToggle = h('input', { type: 'checkbox', name: 'track_stock', id: 'f-track_stock', checked: p.track_stock });
  const stockFields = h('div', { class: 'form-grid nested span-all' },
    field({ name: 'min_stock', label: `Stock mínimo (${p.unit})`, value: p.min_stock_milli !== null && p.min_stock_milli !== undefined ? formatQty(p.min_stock_milli) : '', hint: 'Te avisamos cuando quede igual o menos. Opcional.', attrs: { inputmode: 'decimal' } }),
    isNew ? field({ name: 'initial', label: 'Stock inicial', hint: 'Lo que tenés hoy. Después se mueve desde Stock.', attrs: { inputmode: 'decimal', placeholder: '0' } })
      : h('div', { class: 'field' }, h('span', { class: 'label' }, 'Stock actual'), h('p', { class: 'stock', style: 'text-align:left' }, `${formatQty(p.stock_milli)} ${p.unit}`), h('p', { class: 'hint' }, h('a', { href: `#/stock?producto=${p.id}` }, 'Registrar un movimiento'))),
  );
  const syncTrack = () => { stockFields.hidden = !trackToggle.checked; };
  trackToggle.addEventListener('change', syncTrack);

  const form = h('form', { novalidate: true, class: 'card form-grid' },
    h('div', { class: 'span-all' }, field({ name: 'name', label: 'Nombre', value: p.name, required: true, attrs: { maxlength: 160 } })),
    field({ name: 'sku', label: 'Código interno o de barras', value: p.sku, hint: 'Opcional. No se puede repetir.', attrs: { maxlength: 40, autocomplete: 'off' } }),
    field({ name: 'category_id', label: 'Categoría', value: p.category_id || '', options: catOptions }),
    field({ name: 'price', label: `Precio de venta (${org.currency})`, value: isNew ? '' : minorToInput(p.price_minor), required: true, attrs: { inputmode: 'decimal', autocomplete: 'off' } }),
    field({ name: 'unit', label: 'Se vende por', value: p.unit, required: true, attrs: { maxlength: 20, list: 'units' } }),
    h('datalist', { id: 'units' }, UNITS.map((u) => h('option', { value: u }))),
    seeCost ? field({ name: 'cost', label: `Costo (${org.currency}) — opcional`, value: minorToInput(p.cost_minor), attrs: { inputmode: 'decimal', autocomplete: 'off' } }) : null,
    h('div', { class: 'span-all' }, h('label', { class: 'toggle', for: 'f-track_stock' }, trackToggle, ' Controlar stock de este producto'),
      h('p', { class: 'hint' }, 'Desactivalo para servicios o cosas que no se cuentan.')),
    stockFields,
    status,
    h('div', { class: 'form-actions span-all' }, submit),
  );
  syncTrack();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const price = parseMoney(val.price);
    const cost = !seeCost || String(val.cost ?? '').trim() === '' ? { ok: true, value: seeCost ? null : p.cost_minor ?? null } : parseMoney(val.cost);
    const min = String(val.min_stock ?? '').trim() === '' ? { ok: true, value: null } : parseQty(val.min_stock, { allowZero: true });
    const initial = !isNew || String(val.initial ?? '').trim() === '' ? { ok: true, value: 0 } : parseQty(val.initial, { allowZero: true });
    const errors = v.collect({
      name: [v.required(val.name, 'El nombre'), v.maxLen(val.name.trim(), 160, 'El nombre')],
      sku: v.maxLen(val.sku.trim(), 40, 'El código'),
      unit: [v.required(val.unit, 'La unidad'), v.maxLen(val.unit.trim(), 20, 'La unidad')],
      price: price.ok ? null : price.error,
      cost: cost.ok ? null : cost.error,
      min_stock: val.track_stock && !min.ok ? min.error : null,
      initial: val.track_stock && !initial.ok ? initial.error : null,
    });
    if (!showErrors(form, errors)) return;
    const data = {
      name: val.name.trim(),
      sku: v.emptyToNull(val.sku),
      category_id: val.category_id || null,
      unit: val.unit.trim(),
      price_minor: price.value,
      cost_minor: cost.value,
      track_stock: Boolean(val.track_stock),
      min_stock_milli: val.track_stock ? min.value : null,
    };
    mount(status);
    try {
      await busy(submit, async () => {
        if (isNew) await db.rpc('create_product', { p_data: data, p_initial_milli: val.track_stock ? initial.value : 0 });
        else await db.update('products', p.id, data);
      });
      toast(isNew ? 'Producto guardado' : 'Cambios guardados');
      ctx.go('productos');
    } catch (err) {
      const msg = err.code === '23505' ? 'Ya hay otro producto con ese código.' : err.message;
      mount(status, banner('error', msg));
    }
  });

  let activeBtn = null;
  if (!isNew) {
    activeBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, p.active ? 'Desactivar' : 'Reactivar');
    activeBtn.addEventListener('click', async () => {
      try {
        await busy(activeBtn, () => db.update('products', p.id, { active: !p.active }), '…');
        toast(p.active ? 'Producto desactivado' : 'Producto reactivado');
        ctx.go('productos');
      } catch (err) {
        mount(status, banner('error', err.message));
      }
    });
  }

  shell(ctx, { section: 'productos', title: isNew ? 'Nuevo producto' : p.name, back: 'productos', actions: activeBtn },
    !isNew && !p.active ? banner('info', 'Producto inactivo: no se ofrece para vender. Su historial se conserva.') : null,
    form,
  );
  if (isNew) form.querySelector('[name="name"]').focus();
}

function categoriesDialog(org, onChange) {
  const list = h('div', { class: 'list' });
  const input = h('input', { name: 'cat', maxlength: 60, placeholder: 'Ej: Bebidas', 'aria-label': 'Nueva categoría' });
  const err = h('p', { class: 'field-error', hidden: true, role: 'alert' });
  let changed = false;

  async function paint() {
    const cats = await db.select('categories', 'select=id,name,archived&order=name.asc');
    list.replaceChildren(...(cats.length ? cats.map((c) => h('div', { class: 'row-item' },
      h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, c.name), c.archived ? h('span', { class: 'row-sub' }, 'Archivada') : null),
      h('button', {
        type: 'button', class: 'btn btn-ghost btn-sm',
        onclick: async () => { await db.update('categories', c.id, { archived: !c.archived }); changed = true; paint(); },
      }, c.archived ? 'Restaurar' : 'Archivar'),
    )) : [h('p', { class: 'muted pad' }, 'Todavía no hay categorías.')]));
  }

  const addBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-sm' }, 'Agregar');
  const form = h('form', { novalidate: true },
    h('div', { class: 'toolbar' }, input, addBtn),
    err,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const name = input.value.trim();
    if (!name) { err.textContent = 'Escribí un nombre.'; err.hidden = false; return; }
    try {
      await busy(addBtn, () => db.insert('categories', { organization_id: org.id, name }), '…');
      input.value = '';
      changed = true;
      paint();
    } catch (e2) {
      err.textContent = e2.code === '23505' ? 'Esa categoría ya existe.' : e2.message;
      err.hidden = false;
    }
  });

  const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'cat-title' },
    h('h2', { id: 'cat-title' }, 'Categorías'),
    form,
    list,
    h('div', { class: 'dialog-actions' }, h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => dlg.close() }, 'Listo')),
  );
  dlg.addEventListener('close', () => { dlg.remove(); if (changed) onChange(); });
  document.body.append(dlg);
  dlg.showModal();
  paint();
  input.focus();
}
