import { h, mount, field, showErrors, formValues, banner, busy, toast, debounce } from '../lib/dom.js';
import { db, searchTerm } from '../lib/api.js';
import { parseMoney, formatMoney, minorToInput } from '../lib/money.js';
import * as v from '../lib/validate.js';
import { shell } from './shell.js?v=approved-20261109-3';

export const KINDS = [
  ['material', 'Material'],
  ['mano_de_obra', 'Mano de obra'],
  ['servicio', 'Servicio'],
  ['otro', 'Otro'],
];
const KIND_LABEL = Object.fromEntries(KINDS);
const UNITS = ['unidad', 'm²', 'm', 'ml', 'kg', 'litro', 'hora', 'jornada', 'viaje', 'global'];

export async function catalogView(ctx) {
  const currency = ctx.state.org.currency;
  const list = h('div', { class: 'list', 'aria-live': 'polite' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar concepto', 'aria-label': 'Buscar conceptos', autocomplete: 'off' });
  const kind = h('select', { 'aria-label': 'Filtrar por tipo', class: 'select-sm' },
    h('option', { value: '' }, 'Todos los tipos'),
    KINDS.map(([val, label]) => h('option', { value: val }, label)),
  );
  const archived = h('input', { type: 'checkbox', id: 'show-archived' });

  shell(ctx, {
    section: 'conceptos',
    title: 'Conceptos',
    actions: h('a', { class: 'btn btn-primary', href: '#/conceptos/nuevo' }, '+ Nuevo concepto'),
  },
    h('p', { class: 'muted lead' }, 'Tu lista de materiales, mano de obra y servicios con su precio de referencia.'),
    h('div', { class: 'toolbar' }, search, kind, h('label', { class: 'toggle', for: 'show-archived' }, archived, ' Ver archivados')),
    list,
  );

  let seq = 0;
  async function load() {
    const my = ++seq;
    list.replaceChildren(...[1, 2, 3].map(() => h('div', { class: 'skeleton row' })));
    const term = searchTerm(search.value);
    let q = `select=id,description,kind,unit,price_minor,archived&order=description.asc&limit=300&archived=eq.${archived.checked}`;
    if (term) q += `&description=ilike.${encodeURIComponent(`*${term}*`)}`;
    if (kind.value) q += `&kind=eq.${encodeURIComponent(kind.value)}`;
    try {
      const rows = await db.select('catalog_items', q);
      if (my !== seq) return;
      if (rows.length === 0) {
        list.replaceChildren(
          term || kind.value || archived.checked
            ? h('div', { class: 'empty' }, h('p', {}, 'No hay conceptos con ese filtro.'))
            : h('div', { class: 'empty' },
                h('p', { class: 'empty-title' }, 'Tu catálogo está vacío'),
                h('p', { class: 'muted' }, 'Cargá lo que más cotizás: materiales, horas de trabajo, traslados.'),
                h('a', { class: 'btn btn-primary', href: '#/conceptos/nuevo' }, 'Cargar el primero'),
              ),
        );
        return;
      }
      list.replaceChildren(...rows.map((it) =>
        h('a', { class: 'row-item', href: `#/conceptos/${it.id}` },
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, it.description),
            h('span', { class: 'row-sub' }, h('span', { class: `kind kind-${it.kind}` }, KIND_LABEL[it.kind] || it.kind), ` por ${it.unit}`),
          ),
          h('span', { class: 'amount' }, formatMoney(it.price_minor, currency)),
          h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'),
        ),
      ));
    } catch (err) {
      if (my === seq) list.replaceChildren(banner('error', err.message));
    }
  }

  search.addEventListener('input', debounce(load, 250));
  kind.addEventListener('change', load);
  archived.addEventListener('change', load);
  await load();
}

export async function catalogFormView(ctx, route) {
  const isNew = route.id === 'nuevo';
  const currency = ctx.state.org.currency;
  let item = null;

  if (!isNew) {
    shell(ctx, { section: 'conceptos', title: 'Concepto', back: 'conceptos' }, h('div', { class: 'skeleton card-lg' }));
    try {
      item = await db.one('catalog_items', `select=*&id=eq.${encodeURIComponent(route.id)}`);
    } catch (err) {
      return shell(ctx, { section: 'conceptos', title: 'Concepto', back: 'conceptos' }, banner('error', err.message));
    }
    if (!item) return shell(ctx, { section: 'conceptos', title: 'Concepto', back: 'conceptos' }, banner('error', 'No encontramos ese concepto.'));
  }

  const it = item || { kind: 'material', unit: 'unidad' };
  const status = h('div', { class: 'form-status' });
  const marginOut = h('p', { class: 'hint margin-out', 'aria-live': 'polite' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, isNew ? 'Guardar concepto' : 'Guardar cambios');

  const unitInput = field({ name: 'unit', label: 'Unidad', value: it.unit, required: true, attrs: { maxlength: v.LIMITS.unit, list: 'units' } });
  const form = h('form', { novalidate: true, class: 'card form-grid' },
    field({ name: 'description', label: 'Descripción', value: it.description, required: true, hint: 'Como querés que aparezca en el presupuesto.', attrs: { maxlength: v.LIMITS.description } }),
    field({ name: 'kind', label: 'Tipo', value: it.kind, options: KINDS }),
    unitInput,
    h('datalist', { id: 'units' }, UNITS.map((u) => h('option', { value: u }))),
    field({ name: 'price', label: `Precio de venta por unidad (${currency})`, value: isNew ? '' : minorToInput(it.price_minor), required: true, hint: 'Ej: 15.000 o 1.250,50', attrs: { inputmode: 'decimal', autocomplete: 'off' } }),
    field({ name: 'cost', label: `Costo por unidad (${currency}) — opcional`, value: minorToInput(it.cost_minor), hint: 'Solo para vos: te muestra cuánto ganás.', attrs: { inputmode: 'decimal', autocomplete: 'off' } }),
    marginOut,
    status,
    h('div', { class: 'form-actions' }, submit),
  );

  function updateMargin() {
    const val = formValues(form);
    const p = parseMoney(val.price);
    const c = String(val.cost).trim() === '' ? null : parseMoney(val.cost);
    if (!p.ok || !c || !c.ok || c.value === 0 || p.value === 0) {
      marginOut.textContent = '';
      return;
    }
    // Recargo sobre costo y margen sobre precio son cosas distintas: se muestran las dos.
    const markup = ((p.value - c.value) / c.value) * 100;
    const margin = ((p.value - c.value) / p.value) * 100;
    const fmt = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
    marginOut.textContent = `Ganancia: ${formatMoney(p.value - c.value, currency)} por ${val.unit || 'unidad'} · recargo sobre costo ${fmt(markup)} % · margen sobre precio ${fmt(margin)} %`;
  }
  form.addEventListener('input', updateMargin);
  updateMargin();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const price = parseMoney(val.price);
    const cost = String(val.cost).trim() === '' ? { ok: true, value: null } : parseMoney(val.cost);
    const errors = v.collect({
      description: [v.required(val.description, 'La descripción'), v.maxLen(val.description.trim(), v.LIMITS.description, 'La descripción')],
      unit: [v.required(val.unit, 'La unidad'), v.maxLen(val.unit.trim(), v.LIMITS.unit, 'La unidad')],
      price: price.ok ? null : price.error,
      cost: cost.ok ? null : cost.error,
    });
    if (!showErrors(form, errors)) return;
    const row = {
      description: val.description.trim(),
      kind: val.kind,
      unit: val.unit.trim(),
      price_minor: price.value,
      cost_minor: cost.value,
    };
    mount(status);
    try {
      await busy(submit, () =>
        isNew ? db.insert('catalog_items', { ...row, organization_id: ctx.state.org.id }) : db.update('catalog_items', it.id, row),
      );
      toast(isNew ? 'Concepto guardado' : 'Cambios guardados');
      ctx.go('conceptos');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  let archiveBtn = null;
  if (!isNew) {
    archiveBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, it.archived ? 'Restaurar' : 'Archivar');
    archiveBtn.addEventListener('click', async () => {
      try {
        await busy(archiveBtn, () => db.update('catalog_items', it.id, { archived: !it.archived }), '…');
        toast(it.archived ? 'Concepto restaurado' : 'Concepto archivado');
        ctx.go('conceptos');
      } catch (err) {
        mount(status, banner('error', err.message));
      }
    });
  }

  shell(ctx, { section: 'conceptos', title: isNew ? 'Nuevo concepto' : it.description, back: 'conceptos', actions: archiveBtn },
    it.archived ? banner('info', 'Este concepto está archivado: no se va a ofrecer en presupuestos nuevos.') : null,
    form,
  );
  if (isNew) form.querySelector('[name="description"]').focus();
}
