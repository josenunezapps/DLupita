// Documento del presupuesto en formato A4. Lo usan la vista previa del borrador, la vista del emitido
// y la impresión/PDF: un solo dibujo garantiza que el PDF muestre exactamente lo mismo que la pantalla.
import { h } from '../lib/dom.js';
import { formatMoney } from '../lib/money.js';
import { formatQty } from '../lib/calc.js';
import { formatDate, formatIssued, quoteNumber, todayISO } from '../lib/quotes.js';

const A4_WIDTH = 794; // px a 96 dpi

function pct(bp) {
  const n = Number(bp) || 0;
  const i = Math.trunc(n / 100);
  const d = n % 100;
  return d ? `${i},${String(d).padStart(2, '0').replace(/0$/, '')} %` : `${i} %`;
}

export function renderDoc(m, { draft = false } = {}) {
  const money = (v) => formatMoney(v, m.currency);
  const color = /^#[0-9A-Fa-f]{6}$/.test(m.issuer.brand_color || '') ? m.issuer.brand_color : '#C2410C';
  const contact = [m.issuer.phone, m.issuer.email, m.issuer.address].filter(Boolean);
  const hasLineDiscount = m.items.some((it) => Number(it.discount_bp) > 0);
  const t = m.totals;

  return h('article', { class: `doc${draft ? ' doc-draft' : ''}`, style: `--doc-accent:${color}`, lang: 'es-AR' },
    draft ? h('div', { class: 'doc-watermark', 'aria-hidden': 'true' }, 'BORRADOR') : null,
    h('div', { class: 'doc-bar' }),
    h('header', { class: 'doc-head' },
      h('div', { class: 'doc-issuer' },
        m.issuer.logo_data_url ? h('img', { class: 'doc-logo', src: m.issuer.logo_data_url, alt: '' }) : null,
        h('div', {},
          h('div', { class: 'doc-issuer-name' }, m.issuer.name),
          m.issuer.legal_name && m.issuer.legal_name !== m.issuer.name ? h('div', { class: 'doc-small' }, m.issuer.legal_name) : null,
          m.issuer.tax_id ? h('div', { class: 'doc-small' }, `CUIT ${m.issuer.tax_id}`) : null,
          contact.length ? h('div', { class: 'doc-small' }, contact.join(' · ')) : null,
        ),
      ),
      h('div', { class: 'doc-meta' },
        h('div', { class: 'doc-kind' }, 'Presupuesto'),
        h('div', { class: 'doc-number' }, draft ? 'Borrador' : `N.º ${quoteNumber(m.number)}`),
        h('dl', {},
          h('dt', {}, 'Fecha'), h('dd', {}, m.issued_at ? formatIssued(m.issued_at) : formatDate(todayISO())),
          m.valid_until ? [h('dt', {}, 'Válido hasta'), h('dd', {}, formatDate(m.valid_until))] : null,
        ),
      ),
    ),

    h('section', { class: 'doc-parties' },
      h('div', {},
        h('div', { class: 'doc-label' }, 'Cliente'),
        m.customer
          ? [
              h('div', { class: 'doc-strong' }, m.customer.name),
              m.customer.tax_id ? h('div', { class: 'doc-small' }, `CUIT/DNI ${m.customer.tax_id}`) : null,
              [m.customer.phone, m.customer.email].filter(Boolean).length
                ? h('div', { class: 'doc-small' }, [m.customer.phone, m.customer.email].filter(Boolean).join(' · '))
                : null,
              m.customer.address ? h('div', { class: 'doc-small' }, m.customer.address) : null,
            ]
          : h('div', { class: 'doc-small doc-missing' }, 'Sin cliente elegido'),
      ),
      m.title ? h('div', {}, h('div', { class: 'doc-label' }, 'Trabajo'), h('div', { class: 'doc-strong' }, m.title)) : null,
    ),

    h('table', { class: 'doc-table' },
      h('thead', {}, h('tr', {},
        h('th', { class: 'c-desc' }, 'Descripción'),
        h('th', { class: 'c-num' }, 'Cant.'),
        h('th', { class: 'c-unit' }, 'Unidad'),
        h('th', { class: 'c-num' }, 'Precio unit.'),
        hasLineDiscount ? h('th', { class: 'c-num' }, 'Desc.') : null,
        h('th', { class: 'c-num' }, 'Importe'),
      )),
      h('tbody', {},
        m.items.length
          ? m.items.map((it) => h('tr', {},
              h('td', { class: 'c-desc' }, it.description),
              h('td', { class: 'c-num' }, formatQty(it.qty_milli)),
              h('td', { class: 'c-unit' }, it.unit),
              h('td', { class: 'c-num' }, money(it.unit_price_minor)),
              hasLineDiscount ? h('td', { class: 'c-num' }, Number(it.discount_bp) > 0 ? pct(it.discount_bp) : '—') : null,
              h('td', { class: 'c-num' }, money(it.net_minor)),
            ))
          : h('tr', {}, h('td', { class: 'doc-missing', colspan: hasLineDiscount ? 6 : 5 }, 'Todavía no hay líneas')),
      ),
    ),

    h('section', { class: 'doc-totals' },
      h('dl', {},
        h('dt', {}, 'Subtotal'), h('dd', {}, money(t.subtotal_minor)),
        t.discount_minor > 0
          ? [h('dt', {}, m.discount.type === 'percent' ? `Descuento ${pct(m.discount.value)}` : 'Descuento'), h('dd', {}, `−${money(t.discount_minor)}`)]
          : null,
        m.tax.enabled ? [h('dt', {}, `${m.tax.name} ${pct(m.tax.rate_bp)}`), h('dd', {}, money(t.tax_minor))] : null,
        h('dt', { class: 'doc-total-label' }, 'Total'), h('dd', { class: 'doc-total' }, money(t.total_minor)),
      ),
    ),

    m.notes ? h('section', { class: 'doc-notes' }, h('div', { class: 'doc-label' }, 'Notas'), h('p', {}, m.notes)) : null,
    m.issuer.terms ? h('section', { class: 'doc-notes' }, h('div', { class: 'doc-label' }, 'Condiciones'), h('p', {}, m.issuer.terms)) : null,

    h('footer', { class: 'doc-foot' },
      h('span', {}, 'Documento no válido como factura.'),
      h('span', {}, 'Hecho con CotizaPro'),
    ),
  );
}

/** Contenedor que escala el A4 para que entre en pantallas angostas sin cambiar su diseño. */
export function docFrame(docEl) {
  const inner = h('div', { class: 'doc-scale' }, docEl);
  const frame = h('div', { class: 'doc-frame' }, inner);
  const fit = () => {
    const w = frame.clientWidth;
    if (!w) return;
    const scale = Math.min(1, w / A4_WIDTH);
    inner.style.transform = `scale(${scale})`;
    frame.style.height = `${Math.ceil(docEl.offsetHeight * scale)}px`;
  };
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(frame);
  requestAnimationFrame(fit);
  setTimeout(fit, 300); // por si el logo tarda en cargar
  return frame;
}

/** Imprime solo el documento (el navegador ofrece "Guardar como PDF"). */
export function printDoc(docEl, fileName) {
  document.getElementById('print-root')?.remove();
  const root = h('div', { id: 'print-root' }, docEl.cloneNode(true));
  document.body.append(root);
  document.body.classList.add('print-mode');
  const prevTitle = document.title;
  document.title = fileName; // Chrome usa el título como nombre del PDF
  const done = () => {
    document.body.classList.remove('print-mode');
    root.remove();
    document.title = prevTitle;
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // Esperar a que el logo esté cargado antes de abrir el diálogo.
  const imgs = [...root.querySelectorAll('img')];
  Promise.all(imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })))).then(() => {
    window.print();
    // Algunos navegadores móviles no disparan afterprint.
    setTimeout(() => { if (document.body.classList.contains('print-mode')) done(); }, 60000);
  });
}
