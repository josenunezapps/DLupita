// Datos de demostración: un almacén de Ushuaia con dos semanas de movimiento real simulado.
import { startOfDay, DAY } from './util.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const CATS = [
  ['bebidas', 'Bebidas', 1], ['almacen', 'Almacén', 2], ['lacteos', 'Lácteos', 3],
  ['panaderia', 'Panadería', 4], ['limpieza', 'Limpieza', 5], ['kiosco', 'Kiosco', 6],
];

// [código, nombre, categoría, costo, precio, stock, mínimo, popularidad]
const PRODUCTS = [
  ['7790895000997', 'Coca-Cola 1,5 L', 'bebidas', 2150, 3200, 48, 12, 10],
  ['7790895067556', 'Sprite 1,5 L', 'bebidas', 1950, 2900, 22, 10, 5],
  ['7798062540017', 'Agua mineral 2 L', 'bebidas', 900, 1450, 60, 15, 7],
  ['7790240030121', 'Cerveza rubia lata 473 ml', 'bebidas', 1300, 2100, 96, 24, 9],
  ['7790070411235', 'Jugo de naranja 1 L', 'bebidas', 1150, 1850, 7, 8, 4],
  ['7792170000011', 'Vino tinto Malbec 750 ml', 'bebidas', 4300, 6900, 18, 6, 4],
  ['7790387000016', 'Yerba mate 1 kg', 'almacen', 3900, 5600, 30, 10, 8],
  ['7790070318633', 'Fideos tirabuzón 500 g', 'almacen', 950, 1490, 40, 12, 6],
  ['7792900000105', 'Arroz largo fino 1 kg', 'almacen', 1400, 2150, 26, 10, 5],
  ['7790060233038', 'Aceite de girasol 1,5 L', 'almacen', 3100, 4600, 14, 6, 4],
  ['7790150006247', 'Azúcar 1 kg', 'almacen', 1050, 1600, 4, 10, 5],
  ['7790580660016', 'Puré de tomate 520 g', 'almacen', 720, 1150, 35, 10, 5],
  ['7791866001125', 'Café molido 250 g', 'almacen', 3900, 5900, 12, 5, 3],
  ['7790742303004', 'Galletitas de agua 3 pack', 'almacen', 1150, 1790, 28, 8, 6],
  ['7793940448003', 'Leche entera 1 L', 'lacteos', 1050, 1550, 36, 18, 10],
  ['7791337003238', 'Yogur bebible frutilla 1 L', 'lacteos', 1700, 2600, 15, 6, 4],
  ['7790742000019', 'Queso cremoso x kg (porción 250 g)', 'lacteos', 2600, 3900, 10, 4, 4],
  ['7793940000126', 'Manteca 200 g', 'lacteos', 1900, 2850, 3, 6, 3],
  ['2000000000015', 'Pan francés x kg', 'panaderia', 1500, 2400, 20, 5, 9],
  ['2000000000022', 'Medialunas x docena', 'panaderia', 3800, 6000, 8, 3, 5],
  ['2000000000039', 'Facturas surtidas x docena', 'panaderia', 4200, 6800, 6, 3, 3],
  ['7790520986725', 'Lavandina 1 L', 'limpieza', 650, 1050, 25, 8, 3],
  ['7791290786415', 'Detergente 750 ml', 'limpieza', 1500, 2350, 18, 6, 3],
  ['7790990589924', 'Papel higiénico 4 rollos', 'limpieza', 2100, 3250, 2, 6, 4],
  ['7791290012446', 'Jabón en polvo 800 g', 'limpieza', 3300, 4950, 9, 4, 2],
  ['7790580120039', 'Alfajor de chocolate', 'kiosco', 650, 1100, 72, 20, 9],
  ['7622300862473', 'Chocolate con leche 100 g', 'kiosco', 1800, 2800, 24, 8, 4],
  ['7790040002463', 'Chicles menta', 'kiosco', 480, 800, 50, 15, 5],
  ['7790310000012', 'Papas fritas 150 g', 'kiosco', 1900, 2950, 16, 8, 5],
  ['7798110860050', 'Pilas AA x 4', 'kiosco', 3200, 5200, 11, 4, 2],
];

export function buildDemo() {
  const r = rng(54_48);
  const categories = CATS.map(([id, name, color]) => ({ id, name, color }));
  const products = PRODUCTS.map(([code, name, cat, cost, price, stock, minStock], i) => ({ id: 'p' + (i + 1), code, name, cat, cost, price, stock, minStock, active: true }));
  const weights = PRODUCTS.map(p => p[7]);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pick = () => { let x = r() * wsum; for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; } return 0; };

  const sales = [], sessions = [];
  let seq = 1;
  const today = startOfDay();
  const now = Date.now();
  // curva de clientes por hora (almacén de barrio: pico mañana y pico tarde-noche)
  const curve = { 8: .5, 9: 1, 10: 1.2, 11: 1.3, 12: 1.1, 13: .7, 14: .4, 15: .5, 16: .8, 17: 1.2, 18: 1.6, 19: 1.8, 20: 1.5, 21: .8 };
  const methods = [['cash', .38], ['debit', .27], ['qr', .17], ['credit', .1], ['transfer', .08]];
  const pickMethod = () => { let x = r(); for (const [m, w] of methods) { x -= w; if (x <= 0) return m; } return 'cash'; };

  for (let d = 13; d >= 0; d--) {
    const day = today - d * DAY;
    const dow = new Date(day).getDay();
    const dayFactor = (dow === 0 ? .6 : dow === 6 ? 1.25 : dow === 5 ? 1.15 : 1) * (.9 + r() * .25);
    const open = day + 8 * 36e5;
    if (open > now) break;
    const s = { id: 'demo-s' + d, openedAt: open + Math.floor(r() * 9e5), openAmount: 20000, note: '', moves: [], closedAt: null, counted: null };
    sessions.push(s);
    for (let h = 8; h <= 21; h++) {
      const n = Math.round(curve[h] * 3.2 * dayFactor + (r() - .5) * 2);
      for (let k = 0; k < n; k++) {
        const ts = day + h * 36e5 + Math.floor(r() * 36e5);
        if (ts > now - 6e4) continue;
        const nItems = 1 + Math.floor(Math.pow(r(), 1.8) * 5);
        const map = new Map();
        for (let j = 0; j < nItems; j++) { const i = pick(); map.set(i, (map.get(i) || 0) + (r() < .2 ? 2 : 1)); }
        const items = [...map].map(([i, qty]) => { const p = products[i]; return { pid: p.id, code: p.code, name: p.name, qty, price: p.price, cost: p.cost }; });
        const subtotal = items.reduce((a, l) => a + l.qty * l.price, 0);
        const discount = r() < .06 ? Math.round(subtotal * .1) : 0;
        const total = subtotal - discount;
        const method = pickMethod();
        let received = total, change = 0;
        if (method === 'cash') { const bills = [1000, 2000, 5000, 10000, 20000]; received = bills.find(b => b >= total) ?? Math.ceil(total / 1000) * 1000; if (r() < .3) received = total; change = received - total; }
        sales.push({ id: 'demo-v' + seq, n: seq++, ts, items, subtotal, discount, total, payments: [{ method, amount: total }], received, change, status: 'ok', sessionId: s.id });
      }
    }
    if (r() < .5) s.moves.push({ id: 'm' + d, ts: day + 13 * 36e5, type: 'out', amount: 15000 + Math.round(r() * 20) * 1000, note: 'Pago a proveedor' });
    if (d > 0) {
      const daySales = sales.filter(v => v.sessionId === s.id);
      const cash = daySales.filter(v => v.payments[0].method === 'cash').reduce((a, v) => a + v.total, 0);
      const outs = s.moves.reduce((a, m) => a + (m.type === 'out' ? -m.amount : m.amount), 0);
      s.closedAt = day + 21.9 * 36e5;
      s.expected = s.openAmount + cash + outs;
      s.counted = s.expected + (r() < .7 ? 0 : Math.round((r() - .5) * 6) * 100);
      s.total = daySales.reduce((a, v) => a + v.total, 0);
      s.count = daySales.length;
    }
  }
  sales.sort((a, b) => a.ts - b.ts).forEach((v, i) => { v.n = i + 1; v.id = 'demo-v' + (i + 1); });
  seq = sales.length + 1;
  // una venta anulada para mostrar el flujo
  const anul = sales[sales.length - 8];
  if (anul) { anul.status = 'void'; anul.voidedAt = anul.ts + 12e4; anul.voidReason = 'Cliente se arrepintió'; }

  const todaySession = sessions.find(s => s.closedAt === null);
  return {
    version: 1,
    business: { name: 'Almacén Los Lupinos', cuit: '20-30123456-7', address: 'Av. San Martín 1234, Ushuaia, Tierra del Fuego', phone: '2901 471353', footer: '¡Gracias por tu compra!', demo: true },
    categories, products, sales, sessions,
    currentSession: todaySession ? todaySession.id : null,
    seq,
  };
}
