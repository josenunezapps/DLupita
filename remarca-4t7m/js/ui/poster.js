// Motor de carteles: dibuja sobre canvas a tamaño real de exportación, ajustando la tipografía al espacio.
import { fitText } from '../core/fit.js';
import { moneyParts, formatMoney } from '../core/money.js';
import { discount, unitShort } from '../core/products.js';

export const FORMATS = {
  story: { w: 1080, h: 1920, label: 'Estado o historia', hint: 'WhatsApp e Instagram, vertical' },
  post: { w: 1080, h: 1080, label: 'Publicación', hint: 'Cuadrada, para el muro' },
  a4: { w: 1654, h: 2339, label: 'Hoja A4', hint: 'Para imprimir y pegar en la vidriera' },
};
export const TEMPLATES = {
  estallido: { label: 'Estallido', title: 'OFERTA', multi: false },
  fibron: { label: 'Fibrón', title: '¡Oferta!', multi: false },
  sobrio: { label: 'Sobrio', title: 'Oferta', multi: false },
  lista: { label: 'Lista', title: 'Ofertas de la semana', multi: true, max: 8 },
};

const DISPLAY = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Roboto Condensed", sans-serif-condensed, "Arial Black", sans-serif';
const HAND = '"Marker Felt", "Comic Sans MS", "Chalkboard SE", "Segoe Print", casual, cursive';
const TEXT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Negro o blanco según cuál se lea mejor sobre el color dado. */
export function contrast(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.32 ? '#14161F' : '#FFFFFF';
}

function tools(ctx) {
  const font = (family, size, weight = 400) => { ctx.font = `${weight} ${size}px ${family}`; };
  const measureAt = (family, weight) => (size) => { font(family, size, weight); return (s) => ctx.measureText(s).width; };
  /** Texto ajustado a una caja. Devuelve la altura ocupada. */
  function block(text, { x, y, maxWidth, maxSize, minSize = 14, maxLines = 2, family = TEXT, weight = 700, color, align = 'center', lineHeight = 1.08 }) {
    if (!text) return 0;
    const f = fitText(measureAt(family, weight), text, { maxWidth, maxSize, minSize, maxLines });
    font(family, f.size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    f.lines.forEach((l, i) => ctx.fillText(l, x, y + f.size * 0.82 + i * f.size * lineHeight));
    return f.lines.length * f.size * lineHeight;
  }
  /** Precio con el signo y los centavos chicos y elevados. `anchor`: center | left | right. */
  function price(value, { x, y, maxWidth, maxSize, family = DISPLAY, weight = 700, color, anchor = 'center', shadow = null }) {
    const parts = moneyParts(value);
    const widthAt = (s) => { font(family, s * 0.46, weight); const a = ctx.measureText('$').width + s * 0.05, d = parts.dec ? ctx.measureText(parts.dec).width + s * 0.04 : 0; font(family, s, weight); return a + ctx.measureText(parts.int).width + d; };
    const size = Math.min(maxSize, (maxWidth / widthAt(100)) * 100);
    const total = widthAt(size);
    let cx = anchor === 'center' ? x - total / 2 : anchor === 'right' ? x - total : x;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const draw = (dx, dy, fill) => {
      let px = cx + dx; ctx.fillStyle = fill;
      font(family, size * 0.46, weight); ctx.fillText('$', px, y + dy - size * 0.36); px += ctx.measureText('$').width + size * 0.05;
      font(family, size, weight); ctx.fillText(parts.int, px, y + dy); px += ctx.measureText(parts.int).width + size * 0.04;
      if (parts.dec) { font(family, size * 0.46, weight); ctx.fillText(parts.dec, px, y + dy - size * 0.36); }
    };
    if (shadow) draw(size * 0.035, size * 0.035, shadow);
    draw(0, 0, color);
    return { size, width: total, left: cx };
  }
  function struck(text, { x, y, size, family = TEXT, weight = 600, color, align = 'center', wobble = false }) {
    font(family, size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width, left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, size * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(left - size * 0.1, y - size * (wobble ? 0.2 : 0.32)); ctx.lineTo(left + w + size * 0.1, y - size * (wobble ? 0.46 : 0.32)); ctx.stroke();
    return w;
  }
  return { font, block, price, struck };
}

function footer(ctx, t, { W, y, u, shop, note, color, logo, family = TEXT, show }) {
  if (note) t.block(note, { x: W / 2, y, maxWidth: W * 0.84, maxSize: 58 * u, maxLines: 1, family, weight: 800, color });
  if (!show || !shop.name) return;
  const ny = y + 96 * u, size = 34 * u;
  t.font(TEXT, size, 700);
  const nameW = Math.min(ctx.measureText(shop.name).width, W * 0.7), lw = logo ? size * 1.5 : 0, total = nameW + (logo ? lw + size * 0.4 : 0);
  let x = W / 2 - total / 2;
  if (logo) { ctx.drawImage(logo, x, ny - size * 1.1, lw, lw * (logo.height / logo.width || 1)); x += lw + size * 0.4; }
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(shop.name, x, ny, W * 0.7);
  if (shop.tagline) { t.font(TEXT, 24 * u, 500); ctx.textAlign = 'center'; ctx.globalAlpha = 0.8; ctx.fillText(shop.tagline, W / 2, ny + 40 * u, W * 0.86); ctx.globalAlpha = 1; }
}

function starPath(ctx, cx, cy, R, r, points, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = rot + (i * Math.PI) / points, rad = i % 2 ? r : R; ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
  ctx.closePath();
}

const DRAW = {
  estallido(ctx, t, { W, H, u, p, shop, spec, c1, c2, logo }) {
    const on1 = contrast(c1), on2 = contrast(c2), cy = H * 0.6;
    ctx.fillStyle = c2; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,.26)';
    for (let i = 0; i < 18; i++) { const a = (i * Math.PI) / 9, far = Math.hypot(W, H); ctx.beginPath(); ctx.moveTo(W / 2, cy); ctx.lineTo(W / 2 + Math.cos(a) * far, cy + Math.sin(a) * far); ctx.lineTo(W / 2 + Math.cos(a + Math.PI / 18) * far, cy + Math.sin(a + Math.PI / 18) * far); ctx.closePath(); ctx.fill(); }
    const band = H * 0.15;
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, band);
    t.block(spec.title, { x: W / 2, y: band * 0.14, maxWidth: W * 0.86, maxSize: band * 0.78, maxLines: 1, family: DISPLAY, color: on1 });
    const R = Math.min(W * 0.47, H * 0.255);
    const off = discount(p), showBefore = spec.showBefore && p.prev > p.price;
    const nameTop = band + H * 0.03, room = cy - R - nameTop - (showBefore ? 74 * u : 16 * u);
    const nameH = t.block(p.name, { x: W / 2, y: nameTop, maxWidth: W * 0.88, maxSize: Math.min(H * 0.075, room / 2.2), maxLines: 2, family: DISPLAY, color: on2 });
    if (showBefore) t.struck(`Antes ${formatMoney(p.prev)}`, { x: W / 2, y: nameTop + nameH + 56 * u, size: 44 * u, color: on2, weight: 700 });
    ctx.fillStyle = 'rgba(0,0,0,.22)'; starPath(ctx, W / 2 + 12 * u, cy + 14 * u, R, R * 0.83, 16, 0.1); ctx.fill();
    ctx.fillStyle = c1; starPath(ctx, W / 2, cy, R, R * 0.83, 16, 0.1); ctx.fill();
    const pr = t.price(p.price, { x: W / 2, y: cy + R * 0.2, maxWidth: R * 1.42, maxSize: R * 0.82, color: on1 });
    t.block(unitShort(p.unit), { x: W / 2, y: cy + R * 0.2 + pr.size * 0.1, maxWidth: R, maxSize: 44 * u, maxLines: 1, weight: 700, color: on1 });
    if (off >= 3) {
      const bx = W / 2 + R * 0.72, by = cy - R * 0.74, br = R * 0.3;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(0.2);
      ctx.fillStyle = on2; ctx.beginPath(); ctx.arc(0, 0, br, 0, Math.PI * 2); ctx.fill();
      t.block(`−${off}%`, { x: 0, y: -br * 0.42, maxWidth: br * 1.5, maxSize: br * 0.85, maxLines: 1, family: DISPLAY, color: c2 });
      ctx.restore();
    }
    footer(ctx, t, { W, y: H * 0.865, u, shop, note: spec.note, color: on2, logo, show: spec.showShop });
  },

  fibron(ctx, t, { W, H, u, p, shop, spec, c1, c2, logo }) {
    const on2 = contrast(c2);
    ctx.fillStyle = c2; ctx.fillRect(0, 0, W, H);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = on2; ctx.globalAlpha = 0.05;
    for (let i = 0; i < 1400; i++) ctx.fillRect(rnd() * W, rnd() * H, 2 * u + rnd() * 3 * u, 2 * u);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(W / 2, H * 0.115); ctx.rotate(-0.05);
    t.block(spec.title, { x: 0, y: -H * 0.05, maxWidth: W * 0.8, maxSize: H * 0.1, maxLines: 1, family: HAND, color: c1 });
    ctx.strokeStyle = c1; ctx.lineWidth = 9 * u; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= 24; i++) { const x = -W * 0.3 + (i / 24) * W * 0.6, y = H * 0.062 + Math.sin(i * 1.3) * 7 * u; ctx[i ? 'lineTo' : 'moveTo'](x, y); }
    ctx.stroke(); ctx.restore();
    const nameH = t.block(p.name, { x: W / 2, y: H * 0.22, maxWidth: W * 0.86, maxSize: H * 0.07, maxLines: 2, family: HAND, color: on2, lineHeight: 1.15 });
    const showBefore = spec.showBefore && p.prev > p.price;
    if (showBefore) t.struck(`antes ${formatMoney(p.prev)}`, { x: W / 2, y: H * 0.22 + nameH + 78 * u, size: 54 * u, family: HAND, color: on2, wobble: true });
    ctx.save(); ctx.translate(W / 2, H * 0.62); ctx.rotate(-0.035);
    const pr = t.price(p.price, { x: 0, y: 0, maxWidth: W * 0.84, maxSize: Math.min(H * 0.24, W * 0.5), family: HAND, color: c1, shadow: on2 });
    t.block(unitShort(p.unit), { x: 0, y: pr.size * 0.14, maxWidth: W * 0.6, maxSize: 60 * u, maxLines: 1, family: HAND, color: on2 });
    const off = discount(p);
    if (off >= 3) t.block(`¡${off}% menos!`, { x: 0, y: pr.size * 0.14 + 84 * u, maxWidth: W * 0.6, maxSize: 70 * u, maxLines: 1, family: HAND, color: c1 });
    ctx.restore();
    footer(ctx, t, { W, y: H * 0.86, u, shop, note: spec.note, color: on2, logo, family: HAND, show: spec.showShop });
  },

  sobrio(ctx, t, { W, H, u, p, shop, spec, c1, logo }) {
    const ink = '#14161F', m = W * 0.085;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, 22 * u);
    let x = m;
    if (spec.showShop && shop.name) {
      if (logo) { const lh = 64 * u; ctx.drawImage(logo, m, H * 0.05, lh * (logo.width / logo.height || 1), lh); x += lh * (logo.width / logo.height || 1) + 18 * u; }
      t.font(TEXT, 34 * u, 700); ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(shop.name, x, H * 0.05 + 44 * u, W - x - m);
    }
    t.block(spec.title, { x: m, y: H * 0.16, maxWidth: W - 2 * m, maxSize: 66 * u, maxLines: 1, weight: 800, color: c1, align: 'left' });
    const nameH = t.block(p.name, { x: m, y: H * 0.16 + 92 * u, maxWidth: W - 2 * m, maxSize: H * 0.085, maxLines: 3, weight: 800, color: ink, align: 'left', lineHeight: 1.04 });
    const py = Math.max(H * 0.16 + 92 * u + nameH + H * 0.2, H * 0.66);
    const pr = t.price(p.price, { x: m, y: py, maxWidth: W - 2 * m, maxSize: H * 0.2, color: ink, anchor: 'left' });
    t.block(unitShort(p.unit), { x: m, y: py + pr.size * 0.1, maxWidth: W * 0.5, maxSize: 42 * u, maxLines: 1, weight: 600, color: '#5C6170', align: 'left' });
    const off = discount(p);
    let by = py + pr.size * 0.1 + 86 * u;
    if (spec.showBefore && p.prev > p.price) {
      const w = t.struck(`Antes ${formatMoney(p.prev)}`, { x: m, y: by + 44 * u, size: 44 * u, color: '#5C6170', align: 'left' });
      if (off >= 3) { const bw = 190 * u; ctx.fillStyle = c1; ctx.fillRect(m + w + 40 * u, by - 6 * u, bw, 68 * u); t.block(`−${off} %`, { x: m + w + 40 * u + bw / 2, y: by + 4 * u, maxWidth: bw * 0.84, maxSize: 46 * u, maxLines: 1, weight: 800, color: contrast(c1) }); }
    }
    ctx.fillStyle = ink; ctx.fillRect(m, H * 0.905, W - 2 * m, 3 * u);
    if (spec.note) t.block(spec.note, { x: m, y: H * 0.918, maxWidth: W - 2 * m, maxSize: 40 * u, maxLines: 1, weight: 600, color: ink, align: 'left' });
  },

  lista(ctx, t, { W, H, u, list, shop, spec, c1, c2, logo }) {
    const ink = '#14161F', on1 = contrast(c1), on2 = contrast(c2), m = W * 0.07;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    const band = Math.min(H * 0.16, 300 * u);
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, band);
    ctx.beginPath(); ctx.moveTo(0, band); ctx.lineTo(W, band); ctx.lineTo(W, band + 36 * u); ctx.closePath(); ctx.fill();
    t.block(spec.title, { x: W / 2, y: band * 0.2, maxWidth: W * 0.86, maxSize: band * 0.62, maxLines: 1, family: DISPLAY, color: on1 });
    const top = band + 70 * u, bottom = H * 0.86, n = Math.max(list.length, 1), rowH = Math.min((bottom - top) / n, 250 * u);
    list.forEach((p, i) => {
      const y = top + i * rowH, tagW = W * 0.34, tagH = rowH * 0.7, tx = W - m - tagW, ty = y + (rowH - tagH) / 2;
      ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(tx + tagH * 0.3, ty); ctx.lineTo(tx + tagW, ty); ctx.lineTo(tx + tagW, ty + tagH); ctx.lineTo(tx + tagH * 0.3, ty + tagH); ctx.lineTo(tx, ty + tagH / 2); ctx.closePath(); ctx.fill();
      t.price(p.price, { x: tx + tagW - tagH * 0.2, y: ty + tagH * 0.76, maxWidth: tagW - tagH * 0.62, maxSize: tagH * 0.78, color: on2, anchor: 'right' });
      const sub = `${unitShort(p.unit)}${spec.showBefore && p.prev > p.price ? `, antes ${formatMoney(p.prev)}` : ''}`;
      const nh = t.block(p.name, { x: m, y: y + rowH * 0.17, maxWidth: tx - m - 30 * u, maxSize: rowH * 0.32, maxLines: 2, weight: 800, color: ink, align: 'left', lineHeight: 1.05 });
      t.block(sub, { x: m, y: y + rowH * 0.17 + nh + 4 * u, maxWidth: tx - m - 30 * u, maxSize: rowH * 0.17, maxLines: 1, weight: 500, color: '#5C6170', align: 'left' });
      if (i < list.length - 1) { ctx.fillStyle = '#D9DCE3'; ctx.fillRect(m, y + rowH - 1.5 * u, W - 2 * m, 3 * u); }
    });
    if (!list.length) t.block('Elegí productos para armar la lista', { x: W / 2, y: H * 0.45, maxWidth: W * 0.8, maxSize: 52 * u, maxLines: 2, weight: 600, color: '#5C6170' });
    footer(ctx, t, { W, y: H * 0.875, u, shop, note: spec.note, color: ink, logo, show: spec.showShop });
  },
};

/** Dibuja el cartel completo en el canvas (se redimensiona al formato elegido). */
export function renderPoster(canvas, { data, spec, logo = null }) {
  const format = FORMATS[spec.format] || FORMATS.story, tpl = TEMPLATES[spec.template] ? spec.template : 'estallido';
  canvas.width = format.w; canvas.height = format.h;
  const ctx = canvas.getContext('2d');
  const byId = new Map(data.products.map((p) => [p.id, p]));
  const list = spec.productIds.map((id) => byId.get(id)).filter(Boolean).slice(0, TEMPLATES.lista.max);
  const p = list[0] || { name: 'Elegí un producto', price: 0, prev: null, unit: 'un', offer: false };
  const full = { ...spec, title: (spec.title || '').trim() || TEMPLATES[tpl].title };
  DRAW[tpl](ctx, tools(ctx), { W: format.w, H: format.h, u: format.w / 1080, p, list, shop: data.shop, spec: full, c1: data.shop.color, c2: data.shop.color2, logo });
  return { product: p, count: list.length };
}

export const canvasBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen'))), 'image/png'));
