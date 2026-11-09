import { h, mount, banner, busy, toast, debounce } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { parseMoney, formatMoney, minorToInput, parsePercentToBp, bpToPercentText } from '../lib/money.js';
import { parseQty, formatQty, lineAmounts } from '../lib/calc.js';
import {
  STATUS, NEXT_STATUS, effectiveStatus, quoteNumber, formatDate, formatIssued, todayISO, addDaysISO,
  draftModel, pdfFileName, whatsappText, waPhone,
} from '../lib/quotes.js';
import { renderDoc, docFrame, printDoc } from './quote-doc.js';
import { shell } from './shell.js?v=approved-20261109-3';
import { quotesCSV } from '../lib/export-quotes.js';
import { listTemplates, saveTemplate, removeTemplate } from '../lib/quote-templates.js';
import { invoiceChecklist, invoiceSummary } from '../lib/invoice-prep.js';

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

const FILTERS = [
  ['todos', 'Todos', () => true],
  ['borrador', 'Borradores', (s) => s === 'borrador'],
  ['abiertos', 'Emitidos', (s) => s === 'emitido' || s === 'enviado'],
  ['aceptado', 'Aceptados', (s) => s === 'aceptado'],
  ['vencido', 'Vencidos', (s) => s === 'vencido'],
  ['cerrados', 'Cerrados', (s) => s === 'rechazado' || s === 'cancelado'],
];

export function statusBadge(status) {
  const s = STATUS[status] || { label: status, tone: 'neutral' };
  return h('span', { class: `badge badge-${s.tone}` }, s.label);
}

export async function quotesView(ctx) {
  const currency = ctx.state.org.currency;
  const list = h('div', { class: 'list', 'aria-live': 'polite' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar por título o cliente', 'aria-label': 'Buscar presupuestos', autocomplete: 'off' });
  const exportBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm', disabled: true }, 'Exportar CSV');
  let filter = 'todos';
  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Filtrar por estado' });

  shell(ctx, {
    section: 'presupuestos',
    title: 'Presupuestos',
    actions: h('a', { class: 'btn btn-primary', href: '#/presupuestos/nuevo' }, '+ Nuevo presupuesto'),
  }, chips, h('div', { class: 'toolbar' }, search, exportBtn), list);

  let rows = [];
  const today = todayISO();

  function paintChips() {
    chips.replaceChildren(...FILTERS.map(([key, label, test]) => {
      const n = rows.filter((r) => test(effectiveStatus(r, today))).length;
      return h('button', {
        type: 'button', role: 'tab', class: `chip${filter === key ? ' active' : ''}`, 'aria-selected': String(filter === key),
        onclick: () => { filter = key; paintChips(); paintList(); },
      }, label, h('span', { class: 'chip-n' }, String(n)));
    }));
  }

  function filteredRows() {
    const test = FILTERS.find(([k]) => k === filter)[2];
    const term = search.value.trim().toLowerCase();
    return rows.filter((r) => test(effectiveStatus(r, today)) && (!term
      || (r.title || '').toLowerCase().includes(term)
      || (r.customers?.name || '').toLowerCase().includes(term)
      || quoteNumber(r.number).includes(term)));
  }

  exportBtn.addEventListener('click', () => {
    const selected = filteredRows();
    if (!selected.length) return;
    const url = URL.createObjectURL(new Blob([quotesCSV(selected, currency, today)], { type: 'text/csv;charset=utf-8' }));
    const link = h('a', { href: url, download: `cotizapro-presupuestos-${today}.csv` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  function paintList() {
    const visible = filteredRows();
    exportBtn.disabled = visible.length === 0;
    if (rows.length === 0) {
      list.replaceChildren(h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Todavía no hiciste presupuestos'),
        h('p', { class: 'muted' }, 'Elegí un cliente, sumá líneas de tu catálogo y emitilo con número.'),
        h('a', { class: 'btn btn-primary', href: '#/presupuestos/nuevo' }, 'Hacer el primero'),
      ));
      return;
    }
    if (visible.length === 0) {
      list.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'No hay presupuestos con ese filtro.')));
      return;
    }
    list.replaceChildren(...visible.map((q) => {
      const st = effectiveStatus(q, today);
      return h('a', { class: 'row-item', href: `#/presupuestos/${q.id}` },
        h('span', { class: 'qnum', 'aria-hidden': q.number ? null : 'true' }, q.number ? quoteNumber(q.number) : '—'),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, q.title || 'Sin título'),
          h('span', { class: 'row-sub' },
            statusBadge(st), ' ',
            q.customers?.name || 'Sin cliente',
            q.valid_until && st !== 'borrador' ? ` · vence ${formatDate(q.valid_until)}` : '',
          ),
        ),
        h('span', { class: 'amount' }, formatMoney(q.quote_total ?? 0, q.currency || currency)),
        h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'),
      );
    }));
  }

  list.replaceChildren(...[1, 2, 3].map(() => h('div', { class: 'skeleton row' })));
  try {
    rows = await db.select('quotes', 'select=id,number,title,status,valid_until,currency,created_at,quote_total,customers(name)&order=created_at.desc&limit=300');
  } catch (err) {
    list.replaceChildren(banner('error', err.message));
    return;
  }
  paintChips();
  paintList();
  const initialSearch = sessionStorage.getItem('cotizapro.search');
  if (initialSearch) {
    sessionStorage.removeItem('cotizapro.search');
    search.value = initialSearch;
    paintList();
  }
  search.addEventListener('input', debounce(paintList, 150));
}

// ---------------------------------------------------------------------------
// Detalle: borrador → editor; emitido → documento con acciones
// ---------------------------------------------------------------------------

export async function quoteRouteView(ctx, route) {
  if (route.id === 'nuevo') return quoteEditor(ctx, null);
  shell(ctx, { section: 'presupuestos', title: 'Presupuesto', back: 'presupuestos' }, h('div', { class: 'skeleton card-lg' }));
  let q;
  try {
    q = await db.one('quotes', `select=*&id=eq.${encodeURIComponent(route.id)}`);
  } catch (err) {
    return shell(ctx, { section: 'presupuestos', title: 'Presupuesto', back: 'presupuestos' }, banner('error', err.message));
  }
  if (!q) return shell(ctx, { section: 'presupuestos', title: 'Presupuesto', back: 'presupuestos' }, banner('error', 'No encontramos ese presupuesto.'));
  if (q.status === 'borrador') return quoteEditor(ctx, q);
  return issuedView(ctx, q);
}

// ---------------------------------------------------------------------------
// Editor de borrador
// ---------------------------------------------------------------------------

let lineSeq = 0;
function newLine(data = {}) {
  return {
    key: ++lineSeq,
    description: data.description || '',
    unit: data.unit || 'unidad',
    qty: data.qty_milli ? formatQty(data.qty_milli) : '1',
    price: data.unit_price_minor !== undefined ? minorToInput(data.unit_price_minor) : '',
    disc: data.discount_bp ? bpToPercentText(data.discount_bp) : '',
  };
}

/** Convierte una línea del formulario en números; devuelve errores por campo. */
function parseLine(l) {
  const errors = {};
  const description = l.description.trim();
  if (!description) errors.description = 'Falta la descripción.';
  else if (description.length > 300) errors.description = 'Máximo 300 caracteres.';
  const unit = l.unit.trim() || 'unidad';
  if (unit.length > 20) errors.unit = 'Máximo 20 caracteres.';
  const qty = parseQty(l.qty);
  if (!qty.ok) errors.qty = qty.error;
  const price = parseMoney(l.price);
  if (!price.ok) errors.price = price.error;
  let disc = { ok: true, value: 0 };
  if (String(l.disc).trim() !== '') disc = parsePercentToBp(l.disc);
  if (!disc.ok) errors.disc = disc.error;
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { description, unit, qty_milli: qty.value, unit_price_minor: price.value, discount_bp: disc.value },
  };
}

export async function quoteEditor(ctx, quote) {
  const org = ctx.state.org;
  const isNew = !quote;
  shell(ctx, { section: 'presupuestos', title: isNew ? 'Nuevo presupuesto' : 'Editar borrador', back: 'presupuestos' }, h('div', { class: 'skeleton card-lg' }));

  let customers;
  let catalog;
  let items = [];
  try {
    [customers, catalog, items] = await Promise.all([
      db.select('customers', 'select=id,name,tax_id,phone,email,address&archived=eq.false&order=name.asc&limit=500'),
      db.select('catalog_items', 'select=id,description,unit,price_minor,kind&archived=eq.false&order=description.asc&limit=500'),
      isNew ? Promise.resolve([]) : db.select('quote_items', `select=*&quote_id=eq.${encodeURIComponent(quote.id)}&order=position.asc`),
    ]);
  } catch (err) {
    return shell(ctx, { section: 'presupuestos', title: 'Presupuesto', back: 'presupuestos' }, banner('error', err.message));
  }

  const state = {
    id: quote?.id || null,
    customer_id: quote?.customer_id || '',
    title: quote?.title || '',
    valid_until: quote?.valid_until || addDaysISO(todayISO(), org.default_validity_days || 15),
    notes: quote?.notes || '',
    discount_type: quote?.discount_type || 'none',
    discount_text: quote?.discount_type === 'percent' ? bpToPercentText(quote.discount_value)
      : quote?.discount_type === 'amount' ? minorToInput(quote.discount_value) : '',
    lines: items.map(newLine),
  };
  if (isNew && ctx.preset?.customer_id) state.customer_id = ctx.preset.customer_id;
  let dirty = false;
  const markDirty = () => { dirty = true; ctx.setDirty?.(true); };

  // ---------- Cabecera ----------
  const status = h('div', { class: 'form-status' });
  const customerSel = h('select', { id: 'q-customer', name: 'customer_id' },
    h('option', { value: '' }, customers.length ? 'Elegí un cliente…' : 'No tenés clientes cargados'),
    customers.map((c) => h('option', { value: c.id, selected: c.id === state.customer_id }, c.name)),
  );
  customerSel.addEventListener('change', () => { state.customer_id = customerSel.value; markDirty(); });
  const titleIn = h('input', { id: 'q-title', name: 'title', maxlength: 160, value: state.title, placeholder: 'Ej: Ventanas del living' });
  titleIn.addEventListener('input', () => { state.title = titleIn.value; markDirty(); });
  const validIn = h('input', { id: 'q-valid', name: 'valid_until', type: 'date', value: state.valid_until, min: todayISO() });
  validIn.addEventListener('change', () => { state.valid_until = validIn.value; markDirty(); });

  const headCard = h('section', { class: 'card form-grid' },
    h('div', { class: 'field', dataset: { field: 'customer_id' } },
      h('label', { for: 'q-customer' }, 'Cliente', h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')),
      customerSel,
      h('p', { class: 'hint' }, '¿Es nuevo? ', h('a', { href: '#/clientes/nuevo' }, 'Cargalo en Clientes'), ' y volvé.'),
      h('p', { class: 'field-error', hidden: true, role: 'alert' }),
    ),
    h('div', { class: 'field', dataset: { field: 'title' } },
      h('label', { for: 'q-title' }, 'Título del trabajo', h('span', { class: 'req', 'aria-hidden': 'true' }, ' *')),
      titleIn,
      h('p', { class: 'field-error', hidden: true, role: 'alert' }),
    ),
    h('div', { class: 'field', dataset: { field: 'valid_until' } },
      h('label', { for: 'q-valid' }, 'Válido hasta'),
      validIn,
      h('p', { class: 'hint' }, `Por defecto, ${org.default_validity_days} días. Se cambia en Negocio.`),
    ),
  );

  // ---------- Líneas ----------
  const linesBox = h('div', { class: 'lines' });
  const linesErr = h('p', { class: 'field-error', hidden: true, role: 'alert' });

  function paintLines() {
    if (state.lines.length === 0) {
      linesBox.replaceChildren(h('div', { class: 'lines-empty' }, 'Agregá líneas desde tu catálogo o escribí una nueva.'));
      return;
    }
    linesBox.replaceChildren(...state.lines.map((l, idx) => lineRow(l, idx)));
  }

  function lineRow(l, idx) {
    const amount = h('span', { class: 'line-amount amount' });
    const errs = h('p', { class: 'field-error line-errors', hidden: true, role: 'alert' });
    const input = (name, attrs = {}) => {
      const el = h('input', { name, value: l[name], 'aria-label': attrs.label, ...attrs, label: null });
      el.addEventListener('input', () => {
        l[name] = el.value;
        el.removeAttribute('aria-invalid');
        errs.hidden = true;
        markDirty();
        paintAmount();
        updateTotals();
      });
      return el;
    };
    function paintAmount() {
      const p = parseLine(l);
      amount.textContent = p.ok ? formatMoney(Number(lineAmounts(p.value).net), org.currency) : '—';
    }
    paintAmount();
    const move = (dir) => {
      const j = idx + dir;
      if (j < 0 || j >= state.lines.length) return;
      [state.lines[idx], state.lines[j]] = [state.lines[j], state.lines[idx]];
      markDirty();
      paintLines();
    };
    const row = h('div', { class: 'line', dataset: { key: String(l.key) } },
      h('div', { class: 'line-top' },
        h('span', { class: 'line-n', 'aria-hidden': 'true' }, String(idx + 1)),
        input('description', { class: 'line-desc', placeholder: 'Descripción', label: `Descripción de la línea ${idx + 1}`, maxlength: 300 }),
      ),
      h('div', { class: 'line-grid' },
        h('label', { class: 'mini' }, h('span', {}, 'Cant.'), input('qty', { inputmode: 'decimal', label: `Cantidad de la línea ${idx + 1}` })),
        h('label', { class: 'mini' }, h('span', {}, 'Unidad'), input('unit', { list: 'units-q', maxlength: 20, label: `Unidad de la línea ${idx + 1}` })),
        h('label', { class: 'mini mini-price' }, h('span', {}, 'Precio unit.'), input('price', { inputmode: 'decimal', placeholder: '0', label: `Precio unitario de la línea ${idx + 1}` })),
        h('label', { class: 'mini' }, h('span', {}, 'Desc. %'), input('disc', { inputmode: 'decimal', placeholder: '0', label: `Descuento de la línea ${idx + 1}` })),
      ),
      h('div', { class: 'line-foot' },
        h('div', { class: 'line-tools' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Subir línea ${idx + 1}`, disabled: idx === 0, onclick: () => move(-1) }, '↑'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Bajar línea ${idx + 1}`, disabled: idx === state.lines.length - 1, onclick: () => move(1) }, '↓'),
          h('button', { type: 'button', class: 'icon-btn icon-danger', 'aria-label': `Quitar línea ${idx + 1}`, onclick: () => { state.lines.splice(idx, 1); markDirty(); paintLines(); updateTotals(); } }, '✕'),
        ),
        amount,
      ),
      errs,
    );
    row._showErrors = (e) => {
      const msgs = Object.values(e);
      errs.textContent = msgs.join(' ');
      errs.hidden = msgs.length === 0;
      for (const k of Object.keys(e)) row.querySelector(`[name="${k}"]`)?.setAttribute('aria-invalid', 'true');
    };
    return row;
  }

  // Selector de catálogo
  const pickerSearch = h('input', { type: 'search', class: 'search', placeholder: 'Buscar en tu catálogo', 'aria-label': 'Buscar en el catálogo', autocomplete: 'off' });
  const pickerList = h('div', { class: 'picker-list' });
  const picker = h('div', { class: 'picker', hidden: true },
    h('div', { class: 'picker-head' }, pickerSearch, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { picker.hidden = true; } }, 'Cerrar')),
    pickerList,
  );
  function paintPicker() {
    const term = pickerSearch.value.trim().toLowerCase();
    const found = catalog.filter((c) => !term || c.description.toLowerCase().includes(term)).slice(0, 50);
    if (catalog.length === 0) {
      pickerList.replaceChildren(h('p', { class: 'muted pad' }, 'Tu catálogo está vacío. ', h('a', { href: '#/conceptos/nuevo' }, 'Cargá conceptos'), ' o usá una línea libre.'));
      return;
    }
    pickerList.replaceChildren(...(found.length ? found.map((c) =>
      h('button', {
        type: 'button', class: 'picker-item',
        onclick: () => {
          state.lines.push(newLine({ description: c.description, unit: c.unit, qty_milli: 1000, unit_price_minor: c.price_minor }));
          markDirty(); paintLines(); updateTotals();
          toast('Línea agregada');
        },
      }, h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, c.description), h('span', { class: 'row-sub' }, `por ${c.unit}`)),
         h('span', { class: 'amount' }, formatMoney(c.price_minor, org.currency)), h('span', { class: 'plus', 'aria-hidden': 'true' }, '+')),
    ) : [h('p', { class: 'muted pad' }, 'Nada coincide con esa búsqueda.')]));
  }
  pickerSearch.addEventListener('input', debounce(paintPicker, 120));

  const linesCard = h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, 'Líneas'), h('span', { class: 'muted small' }, 'Materiales, mano de obra, servicios')),
    linesBox,
    h('datalist', { id: 'units-q' }, ['unidad', 'm²', 'm', 'ml', 'kg', 'litro', 'hora', 'jornada', 'viaje', 'global'].map((u) => h('option', { value: u }))),
    linesErr,
    h('div', { class: 'line-actions' },
      h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => { picker.hidden = false; paintPicker(); pickerSearch.focus(); } }, '+ Del catálogo'),
      h('button', {
        type: 'button', class: 'btn btn-secondary btn-sm',
        onclick: () => {
          state.lines.push(newLine());
          markDirty(); paintLines(); updateTotals();
          linesBox.querySelector('.line:last-child .line-desc')?.focus();
        },
      }, '+ Línea libre'),
    ),
    picker,
  );

  // ---------- Ajustes ----------
  const discType = h('select', { id: 'q-dtype', name: 'discount_type' },
    [['none', 'Sin descuento'], ['percent', 'Porcentaje (%)'], ['amount', `Monto (${org.currency})`]].map(([v, t]) => h('option', { value: v, selected: v === state.discount_type }, t)),
  );
  const discVal = h('input', { id: 'q-dval', name: 'discount_value', inputmode: 'decimal', value: state.discount_text, placeholder: '0' });
  const discErr = h('p', { class: 'field-error', hidden: true, role: 'alert' });
  const syncDisc = () => { discVal.disabled = state.discount_type === 'none'; if (discVal.disabled) discVal.value = ''; };
  discType.addEventListener('change', () => { state.discount_type = discType.value; state.discount_text = ''; discVal.value = ''; syncDisc(); discErr.hidden = true; markDirty(); updateTotals(); });
  discVal.addEventListener('input', () => { state.discount_text = discVal.value; discErr.hidden = true; markDirty(); updateTotals(); });
  syncDisc();
  const notesIn = h('textarea', { id: 'q-notes', name: 'notes', rows: 3, maxlength: 4000, placeholder: 'Ej: Incluye retiro de escombros. No incluye pintura.' });
  notesIn.value = state.notes;
  notesIn.addEventListener('input', () => { state.notes = notesIn.value; markDirty(); });

  const adjustCard = h('section', { class: 'card form-grid' },
    h('div', { class: 'field' }, h('label', { for: 'q-dtype' }, 'Descuento general'), discType),
    h('div', { class: 'field', dataset: { field: 'discount_value' } }, h('label', { for: 'q-dval' }, 'Valor del descuento'), discVal, discErr),
    h('div', { class: 'field span-all' }, h('label', { for: 'q-notes' }, 'Notas para el cliente'), notesIn,
      h('p', { class: 'hint' }, org.terms ? 'Tus condiciones generales se agregan solas al pie.' : 'Tus condiciones generales se configuran en Negocio.')),
  );

  // ---------- Totales ----------
  const totalsBox = h('div', { class: 'totals-box', 'aria-live': 'polite' });

  function parseDiscount() {
    if (state.discount_type === 'none') return { ok: true, value: 0 };
    if (String(state.discount_text).trim() === '') return { ok: true, value: 0 };
    return state.discount_type === 'percent' ? parsePercentToBp(state.discount_text) : parseMoney(state.discount_text);
  }

  function currentModel() {
    const parsed = state.lines.map(parseLine);
    const valid = parsed.filter((p) => p.ok).map((p) => p.value);
    const d = parseDiscount();
    const customer = customers.find((c) => c.id === state.customer_id) || null;
    return draftModel({
      org, customer, title: state.title.trim(), valid_until: state.valid_until, notes: state.notes.trim(),
      discount_type: state.discount_type, discount_value: d.ok ? d.value : 0, items: valid,
    });
  }

  function updateTotals() {
    const m = currentModel();
    const t = m.totals;
    const money = (v) => formatMoney(v, org.currency);
    totalsBox.replaceChildren(
      h('dl', { class: 'totals' },
        h('dt', {}, 'Subtotal'), h('dd', {}, money(t.subtotal_minor)),
        t.discount_minor > 0 ? [h('dt', {}, 'Descuento'), h('dd', {}, `−${money(t.discount_minor)}`)] : null,
        org.tax_enabled ? [h('dt', {}, `${org.tax_name} ${bpToPercentText(org.tax_rate_bp)} %`), h('dd', {}, money(t.tax_minor))] : null,
        h('dt', { class: 'total-label' }, 'Total'), h('dd', { class: 'total-value' }, money(t.total_minor)),
      ),
      ...[
        m.warnings.discountExceeds ? h('p', { class: 'field-error' }, 'El descuento supera el subtotal.') : null,
        m.warnings.overflow ? h('p', { class: 'field-error' }, 'El total supera el máximo permitido.') : null,
      ].filter(Boolean),
    );
  }

  // ---------- Validación y guardado ----------
  function collectForSave(forIssue) {
    let ok = true;
    // Limpia errores anteriores
    for (const f of headCard.querySelectorAll('.field-error')) f.hidden = true;
    linesErr.hidden = true;
    discErr.hidden = true;
    const setErr = (field, msg) => {
      const box = headCard.querySelector(`[data-field="${field}"] .field-error`);
      if (box) { box.textContent = msg; box.hidden = false; }
      ok = false;
    };
    if (forIssue && !state.customer_id) setErr('customer_id', 'Elegí un cliente para emitir.');
    if (forIssue && !state.title.trim()) setErr('title', 'Poné un título para emitir.');

    const rows = [...linesBox.querySelectorAll('.line')];
    const parsed = state.lines.map(parseLine);
    parsed.forEach((p, i) => rows[i]?._showErrors(p.ok ? {} : p.errors));
    if (parsed.some((p) => !p.ok)) { ok = false; linesErr.textContent = 'Revisá las líneas marcadas.'; linesErr.hidden = false; }
    if (forIssue && state.lines.length === 0) { ok = false; linesErr.textContent = 'Agregá al menos una línea para emitir.'; linesErr.hidden = false; }

    const d = parseDiscount();
    if (!d.ok) { ok = false; discErr.textContent = d.error; discErr.hidden = false; }
    const m = currentModel();
    if (forIssue && m.warnings.discountExceeds) { ok = false; discErr.textContent = 'El descuento no puede superar el subtotal.'; discErr.hidden = false; }
    if (m.warnings.overflow) ok = false;

    if (!ok) {
      const first = [...document.querySelectorAll('.field-error:not([hidden])')][0];
      first?.closest('.field, .line, .card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    return {
      customer_id: state.customer_id || null,
      title: state.title.trim(),
      valid_until: state.valid_until || null,
      notes: state.notes.trim(),
      discount_type: state.discount_type,
      discount_value: d.value || 0,
      items: parsed.map((p) => p.value),
    };
  }

  async function save() {
    const data = collectForSave(false);
    if (!data) return null;
    const id = await db.rpc('save_draft', { p_id: state.id, p_data: data });
    state.id = id;
    dirty = false;
    ctx.setDirty?.(false);
    if (isNew && location.hash !== `#/presupuestos/${id}`) ctx.replaceHash(`#/presupuestos/${id}`);
    return id;
  }

  // Plantillas del trabajo: sin datos del cliente; guardadas en este dispositivo.
  const templateSelect = h('select', { 'aria-label': 'Elegir plantilla de presupuesto' });
  const templateStatus = h('p', { class: 'hint' }, 'Las plantillas se guardan solo en este navegador; no se sincronizan.');
  const templateSaveBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, 'Guardar como plantilla');
  const templateApplyBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, 'Usar plantilla');
  const templateDeleteBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Eliminar plantilla');
  function refreshTemplates() {
    const all = listTemplates(org.id);
    const previous = templateSelect.value;
    templateSelect.replaceChildren(h('option', { value: '' }, 'Elegí una plantilla…'),
      ...all.map(t => h('option', { value: t.id }, t.name)));
    if (all.some(t => t.id === previous)) templateSelect.value = previous;
    templateApplyBtn.disabled = templateDeleteBtn.disabled = !templateSelect.value;
  }
  templateSelect.addEventListener('change', () => {
    templateApplyBtn.disabled = templateDeleteBtn.disabled = !templateSelect.value;
  });
  templateSaveBtn.addEventListener('click', () => {
    if (!collectForSave(false)) return;
    const name = window.prompt('Nombre de la plantilla (máximo 80 caracteres):', state.title.trim());
    if (name === null) return;
    try {
      const saved = saveTemplate(org.id, name, state);
      refreshTemplates();
      templateSelect.value = saved.id;
      templateApplyBtn.disabled = templateDeleteBtn.disabled = false;
      toast('Plantilla guardada en este dispositivo');
    } catch (err) { mount(status, banner('error', err.message)); }
  });
  templateApplyBtn.addEventListener('click', async () => {
    const t = listTemplates(org.id).find(t => t.id === templateSelect.value);
    if (!t) return;
    if (dirty && !(await confirmDialog({ title: 'Usar plantilla', body: ['Esto reemplazará las líneas y condiciones actuales sin guardar. No cambia el cliente seleccionado.'], confirm: 'Aplicar' }))) return;
    state.title = t.title;
    state.notes = t.notes;
    state.discount_type = t.discount_type;
    state.discount_text = t.discount_text;
    state.lines = t.lines.map(l => ({ ...l, key: ++lineSeq }));
    markDirty();
    titleIn.value = state.title;
    notesIn.value = state.notes;
    discType.value = state.discount_type;
    syncDisc();
    discVal.value = state.discount_text;
    paintLines();
    updateTotals();
    toast('Plantilla aplicada; guardá el borrador cuando esté listo');
  });
  templateDeleteBtn.addEventListener('click', async () => {
    const t = listTemplates(org.id).find(t => t.id === templateSelect.value);
    if (!t) return;
    if (!(await confirmDialog({ title: 'Eliminar plantilla', body: [`Se eliminará «${t.name}» de este dispositivo. No afecta presupuestos existentes.`], confirm: 'Eliminar', danger: true }))) return;
    try { removeTemplate(org.id, t.id); refreshTemplates(); toast('Plantilla eliminada'); }
    catch (err) { mount(status, banner('error', err.message)); }
  });
  refreshTemplates();
  const templateCard = h('section', { class: 'card stack-sm' },
    h('h2', {}, 'Plantillas reutilizables'),
    h('div', { class: 'toolbar' }, templateSelect, templateApplyBtn, templateSaveBtn, templateDeleteBtn),
    templateStatus);
  const saveBtn = h('button', { type: 'button', class: 'btn btn-secondary' }, 'Guardar borrador');
  const dupDraftBtn = !isNew ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Duplicar borrador') : null;
  dupDraftBtn?.addEventListener('click', async () => {
    if (dirty && !(await confirmDialog({ title: 'Duplicar borrador', body: ['Los cambios sin guardar no se incluirán en la copia.'], confirm: 'Duplicar' }))) return;
    try {
      const id = await busy(dupDraftBtn, () => db.rpc('duplicate_quote', { p_id: state.id }), 'Duplicando…');
      ctx.setDirty?.(false);
      toast('Copia creada como nuevo borrador');
      ctx.go(`presupuestos/${id}`);
    } catch (err) { mount(status, banner('error', err.message)); }
  });
  const previewBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Vista previa');
  const issueBtn = h('button', { type: 'button', class: 'btn btn-primary' }, 'Emitir');
  const deleteBtn = isNew ? null : h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Borrar borrador');

  saveBtn.addEventListener('click', async () => {
    mount(status);
    try {
      const id = await busy(saveBtn, save);
      if (id) toast('Borrador guardado');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  previewBtn.addEventListener('click', () => {
    const m = currentModel();
    openPreview(renderDoc(m, { draft: true }), pdfFileName(m));
  });

  issueBtn.addEventListener('click', async () => {
    const data = collectForSave(true);
    if (!data) return;
    const m = currentModel();
    const ok = await confirmDialog({
      title: 'Emitir presupuesto',
      body: [
        `Se le asigna el próximo número y queda guardado tal como está: ${formatMoney(m.totals.total_minor, org.currency)} para ${m.customer?.name}.`,
        'Después no se puede editar. Si necesitás cambiarlo, lo duplicás.',
      ],
      confirm: 'Emitir',
    });
    if (!ok) return;
    mount(status);
    try {
      await busy(issueBtn, async () => {
        await save();
        const r = await db.rpc('issue_quote', { p_id: state.id });
        toast(`Presupuesto N.º ${quoteNumber(r.number)} emitido`);
      }, 'Emitiendo…');
      ctx.go(`presupuestos/${state.id}`);
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  deleteBtn?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Borrar borrador', body: ['Se borra este borrador y sus líneas. No se puede deshacer.'], confirm: 'Borrar', danger: true });
    if (!ok) return;
    try {
      await busy(deleteBtn, () => db.remove('quotes', state.id), '…');
      ctx.setDirty?.(false);
      toast('Borrador borrado');
      ctx.go('presupuestos');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  shell(ctx, {
    section: 'presupuestos',
    title: isNew ? 'Nuevo presupuesto' : `Borrador${state.title ? `: ${state.title}` : ''}`,
    back: 'presupuestos',
    actions: h('div', { class: 'toolbar' }, dupDraftBtn, deleteBtn),
  },
    customers.length === 0 ? banner('info', 'Para emitir necesitás al menos un cliente. Podés armar el borrador igual.') : null,
    h('div', { class: 'editor' },
      h('div', { class: 'editor-main' }, templateCard, headCard, linesCard, adjustCard, status),
      h('aside', { class: 'editor-side' },
        h('div', { class: 'summary card' },
          h('h2', {}, 'Resumen'),
          totalsBox,
          h('div', { class: 'summary-actions' }, issueBtn, saveBtn, previewBtn),
          h('p', { class: 'hint' }, 'El borrador no tiene número. Al emitirlo se numera y ya no cambia.'),
        ),
      ),
    ),
  );
  // Sin catálogo, el presupuesto nuevo arranca con una línea libre lista para completar.
  if (isNew && state.lines.length === 0 && catalog.length === 0) state.lines.push(newLine());
  paintLines();
  updateTotals();
}

// ---------------------------------------------------------------------------
// Presupuesto emitido
// ---------------------------------------------------------------------------

async function issuedView(ctx, q) {
  let version;
  let events;
  try {
    [version, events] = await Promise.all([
      db.one('quote_versions', `select=snapshot&quote_id=eq.${encodeURIComponent(q.id)}&order=version.desc`),
      db.select('quote_events', `select=from_status,to_status,created_at&quote_id=eq.${encodeURIComponent(q.id)}&order=created_at.asc`),
    ]);
  } catch (err) {
    return shell(ctx, { section: 'presupuestos', title: 'Presupuesto', back: 'presupuestos' }, banner('error', err.message));
  }
  if (!version) return shell(ctx, { section: 'presupuestos', title: 'Presupuesto', back: 'presupuestos' }, banner('error', 'Falta el documento emitido.'));

  const m = version.snapshot;
  const st = effectiveStatus(q);
  const doc = renderDoc(m);
  const status = h('div', { class: 'form-status' });
  const fileName = pdfFileName(m);

  const pdfBtn = h('button', { type: 'button', class: 'btn btn-primary', onclick: () => printDoc(doc, fileName) }, 'Guardar como PDF');
  const phone = waPhone(m.customer?.phone);
  const waHref = `https://wa.me/${phone || ''}?text=${encodeURIComponent(whatsappText(m))}`;
  const waBtn = h('a', { class: 'btn btn-secondary', href: waHref, target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp');
  const copyBtn = h('button', {
    type: 'button', class: 'btn btn-ghost',
    onclick: async () => {
      try { await navigator.clipboard.writeText(whatsappText(m)); toast('Texto copiado'); } catch { toast('No se pudo copiar'); }
    },
  }, 'Copiar texto');
  // Etapa 1: preparación, sin certificado ni conexión al webservice de ARCA.
  const invoiceBtn = q.status === 'aceptado'
    ? h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => {
      const issues = invoiceChecklist(m);
      const dlg = h('dialog', { class: 'dialog', 'aria-label': 'Preparar factura ARCA' },
        h('h2', {}, 'Preparar factura · ARCA'),
        banner('info', 'Esto NO emite facturas, NO genera CAE ni modifica el presupuesto.'),
        h('p', {}, 'Antes de facturar verificá tipo de comprobante, condición fiscal, documento del receptor, IVA y punto de venta en ARCA.'),
        issues.length ? banner('error', issues.join(' ')) : banner('info', 'Los datos comerciales básicos están completos. Aún falta verificar los datos fiscales.'),
        h('div', { class: 'action-bar' },
          h('button', { type: 'button', class: 'btn btn-secondary', onclick: async () => {
            try { await navigator.clipboard.writeText(invoiceSummary(m)); toast('Resumen copiado'); }
            catch { toast('No se pudo copiar el resumen'); }
          } }, 'Copiar datos'),
          h('a', { class: 'btn btn-secondary', href: 'https://www.arca.gob.ar/fe/emision-autorizacion/solicitud-autorizacion.asp', target: '_blank', rel: 'noopener noreferrer' }, 'Guía oficial ARCA'),
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close() }, 'Cerrar'),
        ),
      );
      dlg.addEventListener('close', () => dlg.remove());
      document.body.append(dlg);
      dlg.showModal();
    } }, 'Preparar factura ARCA')
    : null;
  const dupBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, 'Duplicar');
  dupBtn.addEventListener('click', async () => {
    try {
      const id = await busy(dupBtn, () => db.rpc('duplicate_quote', { p_id: q.id }), 'Duplicando…');
      toast('Copia creada como borrador');
      ctx.go(`presupuestos/${id}`);
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  const LABELS = { enviado: 'Marcar como enviado', aceptado: 'Aceptado', rechazado: 'Rechazado', cancelado: 'Cancelar' };
  const next = NEXT_STATUS[q.status] || [];
  const statusBtns = next.map((s) => {
    const b = h('button', { type: 'button', class: `btn btn-sm ${s === 'aceptado' ? 'btn-ok' : s === 'enviado' ? 'btn-secondary' : 'btn-ghost'}` }, LABELS[s]);
    b.addEventListener('click', async () => {
      if (s === 'cancelado' || s === 'rechazado') {
        const ok = await confirmDialog({ title: LABELS[s], body: [`El presupuesto N.º ${quoteNumber(q.number)} queda como ${STATUS[s].label.toLowerCase()} y se cierra.`], confirm: 'Confirmar', danger: s === 'cancelado' });
        if (!ok) return;
      }
      try {
        await busy(b, () => db.rpc('set_quote_status', { p_id: q.id, p_status: s }), '…');
        toast(`Estado: ${STATUS[s].label}`);
        ctx.go(`presupuestos/${q.id}`);
      } catch (err) {
        mount(status, banner('error', err.message));
      }
    });
    return b;
  });

  const history = h('ol', { class: 'timeline' }, events.map((e) =>
    h('li', {}, h('span', { class: 'tl-dot', 'aria-hidden': 'true' }), h('span', {}, STATUS[e.to_status]?.label || e.to_status), h('span', { class: 'muted small' }, formatIssued(e.created_at))),
  ));

  shell(ctx, {
    section: 'presupuestos',
    title: `N.º ${quoteNumber(q.number)} · ${m.title}`,
    back: 'presupuestos',
  },
    h('div', { class: 'issued-head' },
      statusBadge(st),
      h('span', { class: 'muted' }, `${m.customer?.name || ''} · ${formatMoney(m.totals.total_minor, m.currency)}`),
    ),
    st === 'vencido' ? banner('info', `Venció el ${formatDate(q.valid_until)}. Si el cliente lo acepta igual, podés marcarlo como aceptado o duplicarlo con precios nuevos.`) : null,
    h('div', { class: 'action-bar' }, pdfBtn, waBtn, copyBtn, dupBtn, invoiceBtn),
    phone ? null : h('p', { class: 'hint' }, 'El cliente no tiene un celular completo cargado: WhatsApp te va a pedir que elijas el contacto.'),
    h('p', { class: 'hint' }, 'Para obtener el archivo, elegí «Guardar como PDF» en el diálogo del navegador. Si lo compartís por WhatsApp, adjuntalo manualmente en el chat.'),
    statusBtns.length ? h('section', { class: 'card status-card' }, h('h2', {}, 'Estado'), h('div', { class: 'status-actions' }, statusBtns)) : null,
    status,
    docFrame(doc),
    h('section', { class: 'card' }, h('h2', {}, 'Historial'), history),
  );
}

// ---------------------------------------------------------------------------
// Diálogos
// ---------------------------------------------------------------------------

export function confirmDialog({ title, body = [], confirm = 'Aceptar', danger = false }) {
  return new Promise((resolve) => {
    const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, title),
      body.map((p) => h('p', {}, p)),
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', value: 'no', onclick: () => dlg.close('no') }, 'Volver'),
        h('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'si', onclick: () => dlg.close('si') }, confirm),
      ),
    );
    dlg.addEventListener('close', () => { resolve(dlg.returnValue === 'si'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

function openPreview(docEl, fileName) {
  const dlg = h('dialog', { class: 'dialog dialog-wide', 'aria-label': 'Vista previa del presupuesto' },
    h('div', { class: 'dialog-bar' },
      h('strong', {}, 'Vista previa'),
      h('div', { class: 'dialog-bar-actions' },
        h('button', { type: 'button', class: 'btn btn-secondary btn-sm', onclick: () => printDoc(docEl, fileName) }, 'Imprimir borrador'),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => dlg.close() }, 'Cerrar'),
      ),
    ),
    docFrame(docEl),
  );
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
