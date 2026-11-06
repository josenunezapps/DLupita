// Pruebas del cálculo de presupuestos. Los casos de calc-cases.json se prueban también en la base
// (supabase/tests/0002_presupuestos.sql) para garantizar que navegador y servidor dan lo mismo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quoteTotals, lineAmounts, roundDiv, parseQty, formatQty, MAX_QTY_MILLI } from '../app/lib/calc.js';
import { MAX_MINOR } from '../app/lib/money.js';

const cases = JSON.parse(fs.readFileSync(new URL('./calc-cases.json', import.meta.url), 'utf8'));

for (const c of cases) {
  test(`cálculo: ${c.name}`, () => {
    const r = quoteTotals(c.items, c.opts);
    assert.deepEqual(
      { subtotal: r.subtotal, discount: r.discount, tax: r.tax, total: r.total },
      c.expect,
    );
    assert.equal(r.overflow, false);
  });
}

test('roundDiv redondea la mitad hacia arriba', () => {
  assert.equal(roundDiv(5n, 10n), 1n);
  assert.equal(roundDiv(4n, 10n), 0n);
  assert.equal(roundDiv(15n, 10n), 2n);
  assert.equal(roundDiv(14n, 10n), 1n);
  assert.equal(roundDiv(0n, 10n), 0n);
});

test('la línea suma importe, descuento y neto coherentes', () => {
  const a = lineAmounts({ qty_milli: 3000, unit_price_minor: 1999, discount_bp: 1250 });
  assert.equal(a.gross, 5997n);
  assert.equal(a.discount, 750n); // 749,625 → 750
  assert.equal(a.net, a.gross - a.discount);
});

test('descuento fijo mayor al subtotal se marca y no deja total negativo', () => {
  const r = quoteTotals([{ qty_milli: 1000, unit_price_minor: 1000 }], { discount_type: 'amount', discount_value: 5000 });
  assert.equal(r.discountExceeds, true);
  assert.equal(r.total, 0);
});

test('importe que supera el máximo se marca como desborde', () => {
  const r = quoteTotals([{ qty_milli: MAX_QTY_MILLI, unit_price_minor: MAX_MINOR }]);
  assert.equal(r.overflow, true);
  assert.ok(r.total <= MAX_MINOR);
});

test('presupuesto vacío da cero', () => {
  assert.deepEqual(
    (({ subtotal, discount, tax, total }) => ({ subtotal, discount, tax, total }))(quoteTotals([], { tax_enabled: true, tax_rate_bp: 2100 })),
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  );
});

test('parseQty', () => {
  const ok = [['3', 3000], ['2,5', 2500], ['0,333', 333], ['1.250,75', 1250750], ['0.5', 500], ['1.250', 1250000], ['10', 10000]];
  for (const [i, e] of ok) assert.equal(parseQty(i).value, e, i);
  for (const i of ['', '0', '-1', 'x', '1,2345', '2.5.1', '0,0001', '99999999']) assert.equal(parseQty(i).ok, false, i);
});

test('formatQty', () => {
  assert.equal(formatQty(3000), '3');
  assert.equal(formatQty(2500), '2,5');
  assert.equal(formatQty(333), '0,333');
  assert.equal(formatQty(1250750), '1.250,75');
  for (const n of [1, 500, 3000, 1250750, 999999]) assert.equal(parseQty(formatQty(n)).value, n);
});
