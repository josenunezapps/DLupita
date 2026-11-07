// Regresión: preparar un mensaje de WhatsApp no significa adjuntar el PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappText } from '../app/lib/quotes.js';

test('WhatsApp muestra los datos y no afirma que el PDF está adjunto', () => {
  const message = whatsappText({
    number: 42,
    title: 'Colocación de ventanas',
    customer: { name: 'Ana' },
    issuer: { name: 'Taller Sur' },
    totals: { total_minor: 250050 },
    currency: 'ARS',
    valid_until: '2026-11-30',
  });

  assert.match(message, /Ana/);
  assert.match(message, /0042/);
  assert.match(message, /\$ 2\.500,50/);
  assert.match(message, /30\/11\/2026/);
  assert.doesNotMatch(message, /te adjunt[éeo]|pdf adjunto|pdf enviado/i);
  assert.match(message, /Cualquier consulta, avisame/);
});
