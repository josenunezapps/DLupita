import { h, mount, banner, busy, toast, debounce } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { can, formatQty, parseQty, stockState } from '../lib/roles.js';
import { stockCell } from './products.js';
import { shell } from './shell.js';

const KIND = {
  inicial: ['Stock inicial', 'mov-in'],
  entrada: ['Entrada', 'mov-in'],
  salida: ['Salida', 'mov-out'],
  ajuste: ['Ajuste', ''],
  venta: ['Venta', 'mov-out'],
  anulacion: ['Anulación', 'mov-in'],
};

function fmtDateTime(ts, tz) {
  return new Intl.DateTimeFormat('es-AR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

export async function stockView(ctx) {
  const { org, member } = ctx.state;
  const canMove = can.moveStock(member.role);
  const focus = new URLSearchParams(location.hash.split('?')[1] || '').get('producto');
  const list = h('div', { class: 'list', 'aria-live': 'polite' });
  const history = h('div', { class: 'list' });
  const historyTitle = h('h2', {}, 'Últimos movimientos');
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar producto', 'aria-label': 'Buscar producto', autocomplete: 'off' });
  let onlyAlerts = false;
  const chips = h('div', { class: 'chips' });
  let products = [];

  shell(ctx, { section: 'stock', title: 'Stock' },
    canMove ? h('p', { class: 'muted' }, 'Tocá un producto para registrar una entrada, una salida o un ajuste por conteo.') : h('p', { class: 'muted' }, 'Podés consultar el stock. Los movimientos los registran el dueño o el supervisor.'),
    chips,
    h('div', { class: 'toolbar' }, search),
    list,
    h('section', { class: 'stack-sm' }, h('div', { class: 'section-head' }, historyTitle, focus ? h('a', { href: '#/stock' }, 'Ver todos') : null), history),
  );

  function paintChips() {
    const alerts = products.filter((p) => ['low', 'out'].includes(stockState(p))).length;
    chips.replaceChildren(
      h('button', { type: 'button', class: `chip${!onlyAlerts ? ' active' : ''}`, onclick: () => { onlyAlerts = false; paintChips(); paint(); } }, 'Todos', h('span', { class: 'chip-n' }, String(products.length))),
      h('button', { type: 'button', class: `chip${onlyAlerts ? ' active' : ''}`, onclick: () => { onlyAlerts = true; paintChips(); paint(); } }, 'Bajo o agotado', h('span', { class: 'chip-n' }, String(alerts))),
    );
  }

  function paint() {
    const term = search.value.trim().toLowerCase();
    const visible = products.filter((p) => (!onlyAlerts || ['low', 'out'].includes(stockState(p)))
      && (!term || p.name.toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term)));
    if (products.length === 0) {
      list.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'No hay productos que controlen stock.'), h('a', { href: '#/productos' }, 'Ir a Productos')));
      return;
    }
    if (visible.length === 0) {
      list.replaceChildren(h('div', { class: 'empty' }, h('p', {}, onlyAlerts ? 'Ningún producto está bajo el mínimo.' : 'No hay productos con esa búsqueda.')));
      return;
    }
    list.replaceChildren(...visible.map((p) => {
      const inner = [
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, p.name),
          h('span', { class: 'row-sub' }, [p.unit, p.min_stock_milli !== null ? `mínimo ${formatQty(p.min_stock_milli)}` : null].filter(Boolean).join(' · ')),
        ),
        stockCell(p),
      ];
      return canMove
        ? h('button', { type: 'button', class: 'row-item picker-item', onclick: () => movementDialog(p, org, reload) }, inner)
        : h('div', { class: 'row-item' }, inner);
    }));
  }

  async function loadHistory() {
    try {
      const q = `select=id,product_id,qty_milli,kind,reason,created_at,zos_products(name,unit)&order=created_at.desc&limit=50${focus ? `&product_id=eq.${encodeURIComponent(focus)}` : ''}`;
      const rows = await db.select('stock_movements', q);
      if (focus) historyTitle.textContent = `Movimientos de ${rows[0]?.zos_products?.name || products.find((p) => p.id === focus)?.name || 'este producto'}`;
      history.replaceChildren(...(rows.length ? rows.map((m) => {
        const [label, cls] = KIND[m.kind] || [m.kind, ''];
        return h('div', { class: 'row-item' },
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, focus ? label : m.zos_products?.name),
            h('span', { class: 'row-sub' }, [focus ? null : label, m.reason && m.reason !== label ? m.reason : null, fmtDateTime(m.created_at, org.timezone)].filter(Boolean).join(' · ')),
          ),
          h('span', { class: `stock ${cls}` }, `${m.qty_milli > 0 ? '+' : ''}${formatQty(m.qty_milli)}`),
        );
      }) : [h('p', { class: 'muted pad' }, 'Todavía no hay movimientos.')]));
    } catch (err) {
      history.replaceChildren(banner('error', err.message));
    }
  }

  async function reload() {
    list.replaceChildren(...[1, 2, 3].map(() => h('div', { class: 'skeleton row' })));
    try {
      products = await db.select('products', 'select=id,name,sku,unit,track_stock,min_stock_milli,stock_milli&active=eq.true&track_stock=eq.true&order=name.asc&limit=2000');
      paintChips();
      paint();
    } catch (err) {
      list.replaceChildren(banner('error', err.message));
    }
    loadHistory();
  }

  search.addEventListener('input', debounce(paint, 150));
  await reload();
  if (focus && canMove) {
    const p = products.find((x) => x.id === focus);
    if (p) movementDialog(p, org, reload);
  }
}

function movementDialog(p, org, onDone) {
  let kind = 'entrada';
  const qty = h('input', { id: 'm-qty', inputmode: 'decimal', autocomplete: 'off' });
  const qtyLabel = h('label', { for: 'm-qty' });
  const reason = h('input', { id: 'm-reason', maxlength: 200, autocomplete: 'off' });
  const reasonLabel = h('label', { for: 'm-reason' });
  const preview = h('p', { class: 'hint', 'aria-live': 'polite' });
  const err = h('p', { class: 'field-error', hidden: true, role: 'alert' });
  const kindChips = h('div', { class: 'chips' });
  const current = Number(p.stock_milli || 0);

  function sync() {
    kindChips.replaceChildren(...[['entrada', 'Entrada'], ['salida', 'Salida'], ['ajuste', 'Ajuste por conteo']].map(([k, t]) =>
      h('button', { type: 'button', class: `chip${kind === k ? ' active' : ''}`, onclick: () => { kind = k; err.hidden = true; sync(); } }, t)));
    qtyLabel.textContent = kind === 'ajuste' ? `Cantidad contada (${p.unit})` : `Cantidad (${p.unit})`;
    reasonLabel.textContent = kind === 'entrada' ? 'Motivo (opcional)' : 'Motivo *';
    reason.placeholder = kind === 'entrada' ? 'Ej: Compra a proveedor' : kind === 'salida' ? 'Ej: Rotura, vencido, uso interno' : 'Ej: Conteo semanal';
    const q = parseQty(qty.value, { allowZero: kind === 'ajuste' });
    if (!q.ok || qty.value.trim() === '') { preview.textContent = `Stock actual: ${formatQty(current)} ${p.unit}`; return; }
    const after = kind === 'entrada' ? current + q.value : kind === 'salida' ? current - q.value : q.value;
    preview.textContent = `Stock actual: ${formatQty(current)} → queda en ${formatQty(after)} ${p.unit}`;
  }
  qty.addEventListener('input', () => { err.hidden = true; sync(); });

  const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Registrar');
  const form = h('form', { novalidate: true },
    kindChips,
    h('div', { class: 'field' }, qtyLabel, qty),
    h('div', { class: 'field' }, reasonLabel, reason),
    preview,
    err,
    h('div', { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => dlg.close() }, 'Cancelar'),
      saveBtn,
    ),
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = parseQty(qty.value, { allowZero: kind === 'ajuste' });
    const show = (msg) => { err.textContent = msg; err.hidden = false; };
    if (!q.ok) return show(q.error);
    if (kind !== 'entrada' && !reason.value.trim()) return show('Indicá el motivo.');
    if (kind === 'salida' && !org.allow_negative_stock && q.value > current) return show(`No hay stock suficiente: hay ${formatQty(current)} ${p.unit}.`);
    if (kind === 'ajuste' && q.value === current) return show('Esa cantidad es igual al stock actual: no hay nada que ajustar.');
    try {
      await busy(saveBtn, () => db.rpc('adjust_stock', { p_product: p.id, p_qty_milli: q.value, p_kind: kind, p_reason: reason.value.trim() }), 'Registrando…');
      toast('Movimiento registrado');
      dlg.close();
      onDone();
    } catch (e2) {
      show(e2.message);
    }
  });

  const dlg = h('dialog', { class: 'dialog', 'aria-labelledby': 'mov-title' },
    h('h2', { id: 'mov-title' }, p.name),
    form,
  );
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  sync();
  qty.focus();
}
