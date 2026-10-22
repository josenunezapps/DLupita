// Demo: "Café Lapataia" (ficticio) con 60 clientes y 3 meses de visitas.
import { startOfDay, DAY } from './util.js';
function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const NOMBRES = ['Valentina', 'Mateo', 'Sofía', 'Benjamín', 'Martina', 'Santiago', 'Catalina', 'Joaquín', 'Lucía', 'Tomás', 'Camila', 'Lautaro', 'Julieta', 'Facundo', 'Agustina', 'Nicolás', 'Florencia', 'Ignacio', 'Milagros', 'Franco', 'Rocío', 'Gonzalo', 'Antonella', 'Ezequiel', 'Micaela', 'Matías', 'Daniela', 'Ramiro', 'Paula', 'Federico', 'Belén', 'Lisandro', 'Abril', 'Emiliano', 'Carolina', 'Damián', 'Natalia', 'Bruno', 'Victoria', 'Leandro'];
const APELLIDOS = ['Gómez', 'Fernández', 'Rodríguez', 'Pérez', 'Sosa', 'Romero', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Pereyra', 'Giménez', 'Molina', 'Castro'];

export function buildDemo() {
  const r = rng(4351), now = Date.now(), today = startOfDay();
  const goal = 8;
  const customers = [], events = [];
  for (let i = 0; i < 60; i++) {
    const name = `${NOMBRES[Math.floor(r() * NOMBRES.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]}`;
    const joinedAgo = Math.floor(Math.pow(r(), 0.8) * 95);
    const createdAt = Math.min(now - 36e5, today - joinedAgo * DAY + Math.floor((8 + r() * 11) * 36e5));
    const loyalty = r(); // qué tan seguido viene
    const every = loyalty > 0.8 ? 2 + r() * 2 : loyalty > 0.45 ? 4 + r() * 5 : 9 + r() * 20;
    const churn = r() < 0.22 ? Math.floor(22 + r() * 50) : 0; // dejó de venir hace N días
    const id = 'c' + (i + 1);
    const c = { id, name, phone: `2901 ${String(Math.floor(400000 + r() * 199999))}`, birthday: r() < 0.6 ? `${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}` : '', createdAt, last: createdAt, stamps: 1, total: 1, visits: 0, redeemed: 0 };
    events.push({ id: 'e' + events.length, cid: id, ts: createdAt, type: 'join', n: 1 });
    let t = createdAt + every * DAY * (0.5 + r());
    const stop = churn ? now - churn * DAY : now - 30 * 60e3;
    while (t < stop) {
      const d = new Date(t); const h = 8 + Math.floor(r() * 12); d.setHours(h, Math.floor(r() * 60));
      const ts = Math.min(d.getTime(), stop);
      const n = d.getDay() === 2 ? 2 : 1; // martes doble
      c.stamps += n; c.total += n; c.visits++; c.last = ts;
      events.push({ id: 'e' + events.length, cid: id, ts, type: 'stamp', n });
      if (c.stamps >= goal && r() < 0.85) { c.stamps -= goal; c.redeemed++; events.push({ id: 'e' + events.length, cid: id, ts: ts + 6e4, type: 'redeem', n: goal }); }
      t += every * DAY * (0.6 + r() * 0.8);
    }
    customers.push(c);
  }
  // un par de cumpleaños esta semana para que se vea la función
  const soon = d => { const x = new Date(today + d * DAY); return `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  customers[3].birthday = soon(0); customers[11].birthday = soon(2); customers[27].birthday = soon(5);
  events.sort((a, b) => a.ts - b.ts);
  customers.sort((a, b) => b.last - a.last);
  return {
    version: 1,
    biz: { name: 'Café Lapataia', emoji: '☕', color: '#0f6b4f', phone: '2901 471353', address: 'San Martín 640, Ushuaia', goal, reward: 'Un café con medialunas de regalo', welcome: 1, doubleDay: 2, birthdayGift: 'Una porción de torta de regalo', demo: true },
    customers, events,
  };
}
