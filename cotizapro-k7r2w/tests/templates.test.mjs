import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listTemplates, saveTemplate, removeTemplate } from '../app/lib/quote-templates.js';

function store() {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}
const sample = { title: 'Instalación', notes: 'Validez', discount_type: 'percent', discount_text: '10',
  lines: [{ description: 'Mano de obra', unit: 'hora', qty: '2,5', price: '1000', disc: '5' }] };
test('guarda y recupera los conceptos sin mezclar negocios', () => {
  const s = store();
  saveTemplate('negocio-1', 'Trabajo usual', sample, s);
  assert.equal(listTemplates('negocio-1', s)[0].lines[0].qty, '2,5');
  assert.equal(listTemplates('negocio-2', s).length, 0);
});
test('sobrescribe una plantilla con el mismo nombre y elimina por ID', () => {
  const s = store();
  const a = saveTemplate('negocio-1', 'Trabajo usual', sample, s);
  const b = saveTemplate('negocio-1', 'TRABAJO USUAL', { ...sample, title: 'Nuevo' }, s);
  assert.equal(a.id, b.id);
  assert.equal(listTemplates('negocio-1', s).length, 1);
  assert.equal(removeTemplate('negocio-1', a.id, s), true);
  assert.equal(listTemplates('negocio-1', s).length, 0);
});
test('rechaza plantillas sin líneas y nombres vacíos', () => {
  const s = store();
  assert.throws(() => saveTemplate('negocio-1', '', sample, s));
  assert.throws(() => saveTemplate('negocio-1', 'Vacía', { lines: [] }, s));
});
