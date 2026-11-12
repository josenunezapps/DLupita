// Datos de ejemplo: un almacén inventado. Precios ficticios, sólo para mostrar cómo funciona.
import { addProduct, emptyData } from './products.js';

const ITEMS = [
  ['Yerba mate 1 kg', 4850, 5400, 'Almacén', '7790001000019', 'un', true],
  ['Azúcar común 1 kg', 1290, null, 'Almacén', '7790001000026', 'un', false],
  ['Fideos tirabuzón 500 g', 1150, null, 'Almacén', '7790001000033', 'un', false],
  ['Aceite de girasol 900 ml', 2990, 3450, 'Almacén', '7790001000040', 'un', true],
  ['Arroz largo fino 1 kg', 1890, null, 'Almacén', '7790001000057', 'un', false],
  ['Galletitas de agua x3', 2100, null, 'Almacén', '', 'pack', false],
  ['Leche entera 1 L', 1450, null, 'Lácteos', '7790001000064', 'un', false],
  ['Queso cremoso', 8900, 9900, 'Lácteos', '', 'kg', true],
  ['Manteca 200 g', 2650, null, 'Lácteos', '7790001000071', 'un', false],
  ['Jamón cocido', 1390, null, 'Fiambres', '', '100g', false],
  ['Salame milán', 1750, null, 'Fiambres', '', '100g', false],
  ['Gaseosa cola 2,25 L', 3200, 3600, 'Bebidas', '7790001000088', 'un', true],
  ['Agua mineral 2 L', 1100, null, 'Bebidas', '7790001000095', 'un', false],
  ['Huevos', 3900, null, 'Frescos', '', 'doc', false],
  ['Pan francés', 2400, null, 'Frescos', '', 'kg', false],
  ['Detergente 750 ml', 1990, null, 'Limpieza', '7790001000101', 'un', false],
  ['Lavandina 1 L', 990, null, 'Limpieza', '7790001000118', 'un', false],
  ['Papel higiénico x4', 2750, 3100, 'Limpieza', '7790001000125', 'pack', true],
];

export function demoData(now = Date.now()) {
  const d = emptyData();
  d.demo = true;
  d.shop = { ...d.shop, name: 'Almacén Don Ejemplo', tagline: 'Av. Siempreviva 742, abierto de 8 a 21' };
  ITEMS.forEach(([name, price, prev, category, code, unit, offer], i) => {
    const p = addProduct(d, { name, price, prev, category, code, unit, offer }, now - i * 60000);
    p.pending = offer;
  });
  return d;
}
