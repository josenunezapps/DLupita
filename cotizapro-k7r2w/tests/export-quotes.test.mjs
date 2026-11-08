import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quotesCSV } from '../app/lib/export-quotes.js';

test('exporta filas, decimales argentinos y estados vencidos', () => {
  const out = quotesCSV([{ number: 2, title: 'Trabajo', customers: { name: 'Cliente' },
    status: 'enviado', valid_until: '2026-01-01', created_at: '2025-12-20T12:00:00Z',
    quote_total: 12345, currency: 'ARS' }], 'ARS', '2026-11-08');
  assert.match(out, /"0002";"Trabajo";"Cliente";"vencido"/);
  assert.match(out, /"123,45";"ARS"/);
  assert.ok(out.startsWith('\uFEFFsep=;'));
});

test('escapa caracteres y neutraliza fórmulas', () => {
  const out = quotesCSV([{ title: '=SUM(1+1)', customers: { name: 'Ana;"B"' },
    status: 'borrador', quote_total: 0 }]);
  assert.ok(out.includes('"\'=SUM(1+1)"'));
  assert.ok(out.includes('"Ana;""B"""'));
});

test('permite exportar un listado vacío', () => {
  assert.equal(quotesCSV([]).split('\r\n').length, 3);
});
