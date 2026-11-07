// Utilidades de presupuestos: estados, fechas, número y modelo del documento.
import { quoteTotals, lineAmounts } from './calc.js';
import { formatMoney } from './money.js';

export const TZ = 'America/Argentina/Buenos_Aires';

export const STATUS = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  emitido: { label: 'Emitido', tone: 'info' },
  enviado: { label: 'Enviado', tone: 'info' },
  aceptado: { label: 'Aceptado', tone: 'ok' },
  rechazado: { label: 'Rechazado', tone: 'err' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
  vencido: { label: 'Vencido', tone: 'warn' },
};

/** Transiciones permitidas (igual que set_quote_status en la base). */
export const NEXT_STATUS = {
  emitido: ['enviado', 'aceptado', 'rechazado', 'cancelado'],
  enviado: ['aceptado', 'rechazado', 'cancelado'],
};

/** Fecha de hoy en Argentina como "AAAA-MM-DD". */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-21" → "21/11/2026" (sin pasar por zona horaria). */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Fecha y hora de emisión (timestamp) en hora argentina: "06/11/2026". */
export function formatIssued(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(ts));
}

/** "Vencido" no se guarda: emitido o enviado con validez pasada. */
export function effectiveStatus(q, today = todayISO()) {
  if ((q.status === 'emitido' || q.status === 'enviado') && q.valid_until && q.valid_until < today) return 'vencido';
  return q.status;
}

export function quoteNumber(n) {
  return n ? String(n).padStart(4, '0') : '';
}

/**
 * Arma el modelo del documento con la misma forma que el snapshot de la base (schema 1),
 * para que la vista previa del borrador y el PDF emitido usen el mismo dibujo.
 */
export function draftModel({ org, customer, title, valid_until, notes, discount_type, discount_value, items }) {
  const opts = { discount_type, discount_value, tax_enabled: org.tax_enabled, tax_rate_bp: org.tax_rate_bp };
  const t = quoteTotals(items, opts);
  return {
    schema: 1,
    number: null,
    title: title || '',
    currency: org.currency,
    issued_at: null,
    valid_until,
    notes: notes || '',
    issuer: {
      name: org.name, legal_name: org.legal_name, tax_id: org.tax_id, phone: org.phone, email: org.email,
      address: org.address, brand_color: org.brand_color, logo_data_url: org.logo_data_url, terms: org.terms,
    },
    customer: customer
      ? { name: customer.name, tax_id: customer.tax_id, phone: customer.phone, email: customer.email, address: customer.address }
      : null,
    items: items.map((it) => {
      const a = lineAmounts(it);
      return {
        description: it.description, unit: it.unit, qty_milli: it.qty_milli, unit_price_minor: it.unit_price_minor,
        discount_bp: it.discount_bp || 0, gross_minor: Number(a.gross), discount_minor: Number(a.discount), net_minor: Number(a.net),
      };
    }),
    discount: { type: discount_type, value: discount_value },
    tax: { enabled: org.tax_enabled, name: org.tax_name, rate_bp: org.tax_rate_bp },
    totals: { subtotal_minor: t.subtotal, discount_minor: t.discount, tax_minor: t.tax, total_minor: t.total },
    warnings: { discountExceeds: t.discountExceeds, overflow: t.overflow },
  };
}

/** Nombre de archivo del PDF: PRES-0001-Ferreteria-El-Tornillo */
export function pdfFileName(model) {
  const who = (model.customer?.name || 'cliente')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return model.number ? `PRES-${quoteNumber(model.number)}-${who}` : `BORRADOR-${who}`;
}

/** Teléfono argentino a formato wa.me (solo dígitos, con 549). Null si no parece completo. */
export function waPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2'); // quita el 15 de celulares viejos
  if (d.length !== 10) return null;
  return `549${d}`;
}

export function whatsappText(model) {
  const parts = [
    `Hola${model.customer?.name ? ` ${model.customer.name}` : ''}!`,
    `Te paso el presupuesto N.º ${quoteNumber(model.number)} de ${model.issuer.name}${model.title ? `: ${model.title}` : ''}.`,
    `Total: ${formatMoney(model.totals.total_minor, model.currency)}.`,
    model.valid_until ? `Válido hasta el ${formatDate(model.valid_until)}.` : '',
    'Cualquier consulta, avisame.',
  ];
  return parts.filter(Boolean).join(' ');
}
