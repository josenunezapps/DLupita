// Exportación CSV del listado de presupuestos (compatible con Excel en español).
// Protege contra interpretación de fórmulas en hojas de cálculo.
import { effectiveStatus, quoteNumber, todayISO } from './quotes.js';

function cell(value) {
  let s = String(value ?? '').replace(/\r\n?/g, '\n');
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function quotesCSV(rows, currency = 'ARS', today = todayISO()) {
  const columns = ['Número', 'Título', 'Cliente', 'Estado', 'Fecha de creación', 'Válido hasta', 'Total', 'Moneda'];
  const lines = rows.map(q => [
    q.number ? quoteNumber(q.number) : '',
    q.title || '',
    q.customers?.name || '',
    effectiveStatus(q, today),
    q.created_at ? String(q.created_at).slice(0, 10) : '',
    q.valid_until || '',
    (Number(q.quote_total || 0) / 100).toFixed(2).replace('.', ','),
    q.currency || currency,
  ]);
  return '\uFEFFsep=;\r\n' + [columns, ...lines].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
