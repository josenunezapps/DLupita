// Demo: Zenix AR cotizando proyectos digitales a comercios (ficticios) de Ushuaia.
import { startOfDay, DAY } from './util.js';

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const CATALOG = [
  ['c1', 'Landing page (una página, responsive)', 'u.', 450000, 21],
  ['c2', 'Sitio web institucional (hasta 6 secciones)', 'u.', 950000, 21],
  ['c3', 'Tienda online con catálogo y pedidos por WhatsApp', 'u.', 1650000, 21],
  ['c4', 'Sistema de turnos online con panel de administración', 'u.', 1200000, 21],
  ['c5', 'Punto de venta Zenix Caja (instalación y carga inicial)', 'u.', 380000, 21],
  ['c6', 'Mantenimiento y soporte mensual', 'mes', 95000, 21],
  ['c7', 'Hosting y certificado SSL', 'año', 140000, 21],
  ['c8', 'Registro de dominio .com.ar', 'año', 28000, 21],
  ['c9', 'Sesión de fotos de producto (hasta 40 fotos)', 'u.', 220000, 21],
  ['c10', 'Gestión de redes sociales (12 publicaciones)', 'mes', 260000, 21],
  ['c11', 'Hora de desarrollo a medida', 'h', 32000, 21],
  ['c12', 'Capacitación al personal', 'h', 25000, 21],
];

const CLIENTS = [
  ['k1', 'Panadería La Cumbre', '30-71654321-9', 'compras@lacumbre.com.ar', '2901 512340', 'Gobernador Paz 845, Ushuaia'],
  ['k2', 'Barbería Filo', '20-35123456-3', 'filo.barber@gmail.com', '2901 498812', 'Maipú 1230, Ushuaia'],
  ['k3', 'Excursiones Canal Austral', '30-70998877-1', 'info@canalaustral.tur.ar', '2901 437765', 'Av. Maipú 505, Ushuaia'],
  ['k4', 'Ferretería El Faro', '30-71234567-5', 'ventas@ferreelfaro.com.ar', '2901 421190', 'Kuanip 312, Ushuaia'],
  ['k5', 'Estudio Contable Lapataia', '27-28765432-4', 'estudio@lapataia.com.ar', '2901 556021', 'San Martín 980, piso 2, Ushuaia'],
  ['k6', 'Hostería Glaciar Martial', '30-69887766-2', 'reservas@glaciarmartial.com', '2901 443300', 'Luis F. Martial 2355, Ushuaia'],
  ['k7', 'Veterinaria Huellas del Sur', '20-31456789-0', 'huellasdelsur@gmail.com', '2901 470145', 'Perito Moreno 1650, Ushuaia'],
  ['k8', 'Almacén Los Lupinos', '20-30123456-7', 'loslupinos@gmail.com', '2901 471353', 'Av. San Martín 1234, Ushuaia'],
];

// [cliente, título, días atrás, estado, [[ítem, cant, desc%], ...], desc general %]
const QUOTES = [
  ['k1', 'Tienda online con pedidos', 148, 'accepted', [['c3', 1, 0], ['c9', 1, 0], ['c7', 1, 0], ['c8', 1, 0]], 5],
  ['k3', 'Sitio web bilingüe', 140, 'accepted', [['c2', 1, 0], ['c11', 12, 0], ['c7', 1, 0]], 0],
  ['k4', 'Landing de ofertas', 131, 'rejected', [['c1', 1, 0], ['c10', 2, 0]], 0],
  ['k2', 'Sistema de turnos', 118, 'accepted', [['c4', 1, 10], ['c6', 6, 0], ['c12', 2, 0]], 0],
  ['k6', 'Web de reservas', 104, 'accepted', [['c2', 1, 0], ['c11', 20, 0], ['c9', 1, 0], ['c7', 1, 0]], 0],
  ['k5', 'Sitio institucional', 92, 'rejected', [['c2', 1, 0], ['c8', 1, 0]], 0],
  ['k7', 'Turnos + web', 80, 'accepted', [['c4', 1, 0], ['c1', 1, 50], ['c6', 3, 0]], 0],
  ['k8', 'Punto de venta', 66, 'accepted', [['c5', 1, 0], ['c12', 3, 0], ['c6', 12, 15]], 0],
  ['k3', 'Gestión de redes temporada', 55, 'accepted', [['c10', 4, 10], ['c9', 1, 0]], 0],
  ['k4', 'Tienda online', 47, 'sent', [['c3', 1, 0], ['c9', 1, 0], ['c7', 1, 0]], 0],
  ['k1', 'Mantenimiento anual', 34, 'accepted', [['c6', 12, 10], ['c7', 1, 0]], 0],
  ['k5', 'Landing para campaña impositiva', 26, 'rejected', [['c1', 1, 0]], 0],
  ['k6', 'Fotos y redes invierno', 18, 'accepted', [['c9', 1, 0], ['c10', 3, 0]], 0],
  ['k7', 'Tienda de accesorios', 12, 'sent', [['c3', 1, 0], ['c6', 6, 0]], 0],
  ['k2', 'Segunda sucursal en turnos', 9, 'accepted', [['c11', 16, 0], ['c12', 2, 0]], 0],
  ['k8', 'Web del almacén', 5, 'sent', [['c1', 1, 0], ['c8', 1, 0], ['c7', 1, 0]], 0],
  ['k3', 'App de reservas de excursiones', 2, 'sent', [['c4', 1, 0], ['c11', 40, 0], ['c6', 12, 0]], 10],
  ['k6', 'Rediseño de marca digital', 0, 'draft', [['c2', 1, 0], ['c9', 1, 0]], 0],
];

export function buildDemo() {
  const r = rng(2901);
  const today = startOfDay();
  const catalog = CATALOG.map(([id, name, unit, price, iva]) => ({ id, name, unit, price, iva }));
  const clients = CLIENTS.map(([id, name, doc, email, phone, address], i) => ({ id, name, doc, email, phone, address, notes: '', createdAt: today - (160 - i * 6) * DAY }));
  const company = {
    name: 'Zenix AR — Soluciones Digitales', cuit: '20-38765432-1', iva: 'RI',
    address: 'Ushuaia, Tierra del Fuego', phone: '2901 471353', email: 'hola@zenix.com.ar', web: 'zenix.com.ar',
    logo: '', color: '#6d3df5', prefix: '0001', validity: 15,
    terms: 'Los precios están expresados en pesos argentinos. El trabajo comienza con el pago del anticipo. Incluye dos rondas de cambios por entregable.',
    payment: '50% de anticipo y 50% contra entrega. Transferencia bancaria o Mercado Pago.',
    demo: true,
  };
  let n = 1;
  const quotes = QUOTES.map(([clientId, title, ago, status, items, discount]) => {
    const now = Date.now();
    const date = Math.min(today - ago * DAY + Math.floor((9 + r() * 9) * 36e5), now - 3 * 36e5);
    const sentAt = status === 'draft' ? null : Math.min(date + Math.floor(r() * 5 * 36e5), now - 2 * 36e5);
    const decidedAt = status === 'accepted' || status === 'rejected' ? Math.min(sentAt + Math.floor((1 + r() * 8) * DAY), now - 36e5) : null;
    const history = [{ ts: date, status: 'draft' }];
    if (sentAt) history.push({ ts: sentAt, status: 'sent' });
    if (decidedAt) history.push({ ts: decidedAt, status });
    return {
      id: 'q' + n, n: n++, clientId, title, date, validity: 15, status,
      items: items.map(([cid, qty, disc], j) => { const c = catalog.find(x => x.id === cid); return { id: `q${n}i${j}`, desc: c.name, qty, unit: c.unit, price: c.price, disc, iva: c.iva }; }),
      discount, notes: '', terms: company.terms, payment: company.payment, delivery: status === 'draft' ? '' : `${10 + Math.floor(r() * 4) * 5} días hábiles`,
      createdAt: date, updatedAt: decidedAt || sentAt || date, sentAt, decidedAt, history,
    };
  });
  return { version: 1, company, clients, catalog, quotes, seq: n };
}
