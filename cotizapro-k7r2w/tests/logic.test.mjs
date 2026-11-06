// Pruebas unitarias de lógica pura. Correr con: node --test cotizapro-k7r2w/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMoney, minorToInput, parsePercentToBp, bpToPercentText, MAX_MINOR } from '../app/lib/money.js';
import * as v from '../app/lib/validate.js';

test('parseMoney: formatos argentinos válidos', () => {
  const cases = [
    ['1500', 150000],
    ['1.500', 150000],
    ['1.500,5', 150050],
    ['1.500,50', 150050],
    ['1500,50', 150050],
    ['1500.50', 150050],
    ['1500.5', 150050],
    ['0,99', 99],
    [',5', 50],
    ['1.234.567,89', 123456789],
    ['$ 2.000', 200000],
    ['  15 000 ', 1500000],
    ['0', 0],
    ['007', 700],
  ];
  for (const [input, expected] of cases) {
    const r = parseMoney(input);
    assert.equal(r.ok, true, `${input} debería ser válido: ${r.error}`);
    assert.equal(r.value, expected, `${input} → ${r.value}, esperado ${expected}`);
  }
});

test('parseMoney: rechaza entradas inválidas', () => {
  for (const input of ['', '-100', 'abc', '1,2,3', '1.50.0', '12,345', '1.5000', '10,505', '1e5', '12.34.567']) {
    const r = parseMoney(input);
    assert.equal(r.ok, false, `${input} debería ser inválido`);
    assert.ok(r.error.length > 0);
  }
  assert.match(parseMoney('-5').error, /negativo/);
  assert.match(parseMoney('1,999').error, /2 decimales/);
});

test('parseMoney: límite superior coincide con la base', () => {
  assert.equal(parseMoney('999.999.999.999,99').value, MAX_MINOR);
  assert.equal(parseMoney('1.000.000.000.000').ok, false);
  assert.ok(Number.isSafeInteger(MAX_MINOR));
});

test('parseMoney: el resultado es siempre un entero (sin floats)', () => {
  for (const input of ['0,1', '0,01', '33,33', '1.000,07', '0.29']) {
    const r = parseMoney(input);
    assert.ok(Number.isInteger(r.value), `${input} → ${r.value}`);
  }
  assert.equal(parseMoney('0.29').value, 29); // 0.29 * 100 en float daría 28.999…
});

test('formatMoney', () => {
  assert.equal(formatMoney(150050), '$ 1.500,50');
  assert.equal(formatMoney(0), '$ 0,00');
  assert.equal(formatMoney(5), '$ 0,05');
  assert.equal(formatMoney(123456789), '$ 1.234.567,89');
  assert.equal(formatMoney(150000, 'USD'), 'USD 1.500,00');
  assert.equal(formatMoney(-2550), '-$ 25,50');
  assert.equal(formatMoney(MAX_MINOR), '$ 999.999.999.999,99');
  assert.equal(formatMoney(null), '');
});

test('ida y vuelta: minorToInput → parseMoney', () => {
  for (const n of [0, 1, 99, 100, 150050, 123456789, MAX_MINOR]) {
    assert.equal(parseMoney(minorToInput(n)).value, n);
  }
  assert.equal(minorToInput(null), '');
});

test('porcentajes en puntos básicos', () => {
  assert.equal(parsePercentToBp('21').value, 2100);
  assert.equal(parsePercentToBp('10,5').value, 1050);
  assert.equal(parsePercentToBp('10.5').value, 1050);
  assert.equal(parsePercentToBp('0').value, 0);
  assert.equal(parsePercentToBp('100').value, 10000);
  assert.equal(parsePercentToBp('100,01').ok, false);
  assert.equal(parsePercentToBp('abc').ok, false);
  assert.equal(parsePercentToBp('').ok, false);
  assert.equal(bpToPercentText(2100), '21');
  assert.equal(bpToPercentText(1050), '10,5');
  assert.equal(bpToPercentText(1025), '10,25');
});

test('validaciones', () => {
  assert.equal(v.email(''), null);
  assert.equal(v.email('a@b.com'), null);
  assert.ok(v.email('a@b'));
  assert.ok(v.email('sin arroba'));
  assert.ok(v.password('corta'));
  assert.equal(v.password('12345678'), null);
  assert.ok(v.password('x'.repeat(73)));
  assert.equal(v.hexColor('#5B3DF5'), null);
  assert.ok(v.hexColor('rojo'));
  assert.equal(v.intRange('15', 1, 365, 'X'), null);
  assert.ok(v.intRange('0', 1, 365, 'X'));
  assert.ok(v.intRange('1.5', 1, 365, 'X'));
  assert.equal(v.emptyToNull('  '), null);
  assert.equal(v.emptyToNull(' a '), 'a');
  assert.deepEqual(v.collect({ a: null, b: ['x', 'y'], c: [null, 'z'] }), { b: 'x', c: 'z' });
});
