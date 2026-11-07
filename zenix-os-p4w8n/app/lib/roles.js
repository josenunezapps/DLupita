// Roles de Zenix OS. La base valida todo; esto solo decide qué mostrar.
export const ROLE_LABEL = { owner: 'Dueño', supervisor: 'Supervisor', vendedor: 'Vendedor' };

export const can = {
  editCatalog: (role) => role === 'owner' || role === 'supervisor',
  moveStock: (role) => role === 'owner' || role === 'supervisor',
  manageTeam: (role) => role === 'owner',
  editBusiness: (role) => role === 'owner',
  seeCost: (role) => role === 'owner' || role === 'supervisor',
};

/** Cantidad en milésimas a texto: 2500 → "2,5"; null → "". */
export function formatQty(milli) {
  if (milli === null || milli === undefined) return '';
  const n = Number(milli);
  const neg = n < 0;
  const a = Math.abs(n);
  const int = Math.trunc(a / 1000);
  const dec = String(a % 1000).padStart(3, '0').replace(/0+$/, '');
  const intText = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(int);
  return `${neg ? '-' : ''}${intText}${dec ? `,${dec}` : ''}`;
}

/** "3", "2,5", "1.250" → milésimas. Acepta 0 si allowZero. */
export function parseQty(input, { allowZero = false } = {}) {
  const raw = String(input ?? '').trim().replace(/\s+/g, '');
  if (raw === '') return { ok: false, error: 'Ingresá una cantidad.' };
  if (raw.startsWith('-')) return { ok: false, error: 'La cantidad no puede ser negativa.' };
  if (!/^[0-9.,]+$/.test(raw)) return { ok: false, error: 'Cantidad inválida.' };
  let int;
  let dec = '';
  if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length > 2) return { ok: false, error: 'Cantidad inválida.' };
    [int, dec] = parts;
    if (int.includes('.')) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(int)) return { ok: false, error: 'Cantidad inválida.' };
      int = int.replace(/\./g, '');
    }
  } else if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length === 2 && parts[1].length <= 2) [int, dec] = parts;
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) int = raw.replace(/\./g, '');
    else return { ok: false, error: 'Cantidad inválida. Usá coma para decimales (ej: 2,5).' };
  } else int = raw;
  if (int === '') int = '0';
  if (!/^\d+$/.test(int) || !/^\d*$/.test(dec)) return { ok: false, error: 'Cantidad inválida.' };
  if (dec.length > 3) return { ok: false, error: 'Usá como máximo 3 decimales.' };
  if (int.length > 7) return { ok: false, error: 'La cantidad es demasiado grande.' };
  const value = Number(int) * 1000 + Number(dec.padEnd(3, '0') || '0');
  if (value === 0 && !allowZero) return { ok: false, error: 'La cantidad tiene que ser mayor a cero.' };
  if (value > 1_000_000_000) return { ok: false, error: 'La cantidad es demasiado grande.' };
  return { ok: true, value };
}

/** Estado del stock de un producto para mostrar. */
export function stockState(p) {
  if (!p.track_stock) return 'none';
  const s = Number(p.stock_milli || 0);
  if (s <= 0) return 'out';
  if (p.min_stock_milli !== null && p.min_stock_milli !== undefined && s <= Number(p.min_stock_milli)) return 'low';
  return 'ok';
}
