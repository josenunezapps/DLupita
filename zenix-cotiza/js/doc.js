// Documento A4 del presupuesto. Lo usan el editor, el link del cliente y la impresión/PDF.
import { fmt, esc, pesosEnLetras, DAY, startOfDay } from './util.js';
import { calc, IVA_COND } from './store.js';

const initials = name => String(name || '?').replace(/[—–-].*$/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const nl = s => esc(s).replace(/\n/g, '<br>');

export function docHTML({ company: c, client: cl, quote: q, number }) {
  const t = calc(q, c);
  const until = startOfDay(new Date(q.date)) + q.validity * DAY;
  const money = fmt.moneyExact;
  const rates = Object.keys(t.ivaBy).map(Number).sort((a, b) => b - a);
  return `
  <article class="doc" style="--brand:${esc(c.color || '#6d3df5')}">
    <header class="doc-h">
      <div class="doc-brand">
        ${c.logo ? `<img src="${esc(c.logo)}" alt="" class="doc-logo">` : `<span class="doc-mono">${esc(initials(c.name))}</span>`}
        <div>
          <b class="doc-co">${esc(c.name)}</b>
          <div class="doc-meta">${[c.address, c.phone && 'Tel. ' + c.phone, c.email, c.web].filter(Boolean).map(esc).join(' · ')}</div>
          <div class="doc-meta">CUIT ${esc(c.cuit || '—')} · ${esc(IVA_COND[c.iva] || '')}</div>
        </div>
      </div>
      <div class="doc-id">
        <span class="doc-kind">Presupuesto</span>
        <b class="doc-num">N° ${esc(number)}</b>
        <dl><dt>Fecha</dt><dd>${fmt.date(q.date)}</dd><dt>Válido hasta</dt><dd>${fmt.date(until)}</dd></dl>
      </div>
    </header>

    <section class="doc-parties">
      <div><span class="doc-lbl">Cliente</span>
        ${cl ? `<b>${esc(cl.name)}</b><div>${[cl.doc && 'CUIT/DNI ' + cl.doc, cl.address].filter(Boolean).map(esc).join('<br>')}</div><div class="doc-meta">${[cl.email, cl.phone].filter(Boolean).map(esc).join(' · ')}</div>` : '<i class="doc-ph">Sin cliente asignado</i>'}
      </div>
      ${q.title ? `<div><span class="doc-lbl">Proyecto</span><b>${esc(q.title)}</b>${q.delivery ? `<div>Plazo de entrega: ${esc(q.delivery)}</div>` : ''}</div>` : q.delivery ? `<div><span class="doc-lbl">Plazo de entrega</span><b>${esc(q.delivery)}</b></div>` : ''}
    </section>

    <table class="doc-t">
      <thead><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio unit.</th>${t.lines.some(l => +l.disc) ? '<th class="r">Bonif.</th>' : ''}${t.ri ? '<th class="r">IVA</th>' : ''}<th class="r">Importe</th></tr></thead>
      <tbody>${t.lines.length ? t.lines.map(l => `<tr>
        <td>${nl(l.desc) || '<i class="doc-ph">Sin descripción</i>'}</td>
        <td class="r nowrap">${fmt.num(+l.qty || 0)} ${esc(l.unit || '')}</td>
        <td class="r nowrap">${money(+l.price || 0)}</td>
        ${t.lines.some(x => +x.disc) ? `<td class="r">${+l.disc ? fmt.num(+l.disc) + '%' : '—'}</td>` : ''}
        ${t.ri ? `<td class="r">${fmt.num(+l.iva || 0)}%</td>` : ''}
        <td class="r nowrap">${money(l.net)}</td></tr>`).join('') : `<tr><td colspan="6" class="doc-empty">Agregá ítems para armar el presupuesto.</td></tr>`}
      </tbody>
    </table>

    <section class="doc-sum">
      <div class="doc-words">${t.total > 0 ? esc(pesosEnLetras(t.total)) : ''}</div>
      <dl class="doc-tot">
        <dt>Subtotal</dt><dd>${money(t.subtotal)}</dd>
        ${t.discAmt ? `<dt>Descuento ${fmt.num(+q.discount)}%</dt><dd>−${money(t.discAmt)}</dd>` : ''}
        ${t.ri ? (t.discAmt ? `<dt>Neto gravado</dt><dd>${money(t.base)}</dd>` : '') + rates.map(r => `<dt>IVA ${fmt.num(r)}%</dt><dd>${money(t.ivaBy[r])}</dd>`).join('') : ''}
        <dt class="doc-grand">Total</dt><dd class="doc-grand">${money(t.total)}</dd>
      </dl>
    </section>
    ${!t.ri ? `<p class="doc-note">${c.iva === 'MT' ? 'Precios finales. Emisor monotributista: el IVA no se discrimina.' : 'Operación exenta de IVA.'}</p>` : ''}

    ${(q.payment || q.terms || q.notes) ? `<section class="doc-cond">
      ${q.payment ? `<div><span class="doc-lbl">Forma de pago</span><p>${nl(q.payment)}</p></div>` : ''}
      ${q.terms ? `<div><span class="doc-lbl">Condiciones</span><p>${nl(q.terms)}</p></div>` : ''}
      ${q.notes ? `<div><span class="doc-lbl">Observaciones</span><p>${nl(q.notes)}</p></div>` : ''}
    </section>` : ''}

    <footer class="doc-f">
      <div class="doc-sign"><span></span>Firma y aclaración del cliente</div>
      <div class="doc-legal">Documento no válido como factura · Presupuesto válido por ${q.validity} días desde su emisión</div>
    </footer>
  </article>`;
}
