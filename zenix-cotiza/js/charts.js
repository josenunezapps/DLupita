// Barras agrupadas en SVG (emitido vs. ganado por mes).
import { fmt, esc } from './util.js';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
export const short = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' M' : v >= 1e3 ? '$' + Math.round(v / 1e3) + ' k' : '$' + Math.round(v);

export function grouped(data, keys, { W = 640, H = 240 } = {}) {
  const padL = 52, padB = 28, padT = 10, padR = 4;
  const max = niceMax(Math.max(1, ...data.flatMap(d => keys.map(k => d[k.key]))));
  const iw = W - padL - padR, ih = H - padT - padB, gw = iw / data.length;
  const bw = Math.min(26, (gw * 0.62) / keys.length);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = padT + ih - (ih * i) / 4;
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="gl"/><text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="ax">${short((max * i) / 4)}</text>`;
  }
  data.forEach((d, i) => {
    const cx = padL + gw * i + gw / 2, x0 = cx - (bw * keys.length + 4 * (keys.length - 1)) / 2;
    keys.forEach((k, j) => {
      const h = (d[k.key] / max) * ih, x = x0 + j * (bw + 4), y = padT + ih - h, r = Math.min(4, h);
      if (h > 0) g += `<path d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z" class="${k.cls}"><title>${esc(d.label)} · ${k.label}: ${fmt.money(d[k.key])}</title></path>`;
    });
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="ax">${esc(d.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${g}</svg>`;
}
