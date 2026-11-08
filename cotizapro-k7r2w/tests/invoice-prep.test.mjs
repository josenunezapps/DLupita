import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceChecklist, invoiceSummary } from '../app/lib/invoice-prep.js';

const model = { number: 8, currency: 'ARS', issuer: { name: 'Empresa', tax_id: '20123456789' },
  customer: { name: 'Cliente', tax_id: '30123456789' }, title: 'Instalación',
  items: [{ description: 'Trabajo' }], totals: { total_minor: 230000 } };
test('prepara presupuesto válido sin generar comprobante fiscal', () => {
  assert.deepEqual(invoiceChecklist(model), []);
  const text = invoiceSummary(model);
  assert.match(text, /NO ES UNA FACTURA/);
  assert.match(text, /No se solicitó CAE/);
  assert.match(text, /2300.00/);
});
test('informa faltantes y monedas no soportadas', () => {
  const bad = { ...model, currency: 'USD', issuer: {}, customer: {}, totals: { total_minor: 0 } };
  assert.equal(invoiceChecklist(bad).length, 5);
});
