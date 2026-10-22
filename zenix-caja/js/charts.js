// Gráficos SVG livianos, sin librerías. Usan variables CSS para tema claro/oscuro.
import { fmt, esc } from './util.js';

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
export const short = v => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace('.', ',') + ' M' : v >= 1e3 ? Math.round(v / 1e3) + ' k' : String(Math.round(v));

/** Barras verticales. data: [{label, value, title, highlight}] */
export function bars(data, { height = 220, unit = 'money', width = 640 } = {}) {
  const W = width, H = height, padL = 44, padB = 26, padT = 12, padR = 6;
  const max = niceMax(Math.max(...data.map(d => d.value), 0));
  const iw = W - padL - padR, ih = H - padT - padB;
  const bw = iw / data.length;
  const ticks = 4;
  let g = '';
  for (let i = 0; i <= ticks; i++) {
    const y = padT + ih - (ih * i) / ticks;
    g += `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" class="grid"/>`;
    g += `<text x="${padL - 8}" y="${y + 4}" class="axis" text-anchor="end">${unit === 'money' ? '$' + short((max * i) / ticks) : short((max * i) / ticks)}</text>`;
  }
  const every = Math.ceil(data.length / 14);
  data.forEach((d, i) => {
    const h = max ? (d.value / max) * ih : 0;
    const x = padL + i * bw + bw * 0.18, w = bw * 0.64;
    const y = padT + ih - h;
    const r = Math.min(4, w / 2, h);
    g += `<g class="bar${d.highlight ? ' hi' : ''}"><title>${esc(d.title || d.label)}: ${unit === 'money' ? fmt.money(d.value) : fmt.num(d.value)}</title>
      <rect x="${padL + i * bw}" y="${padT}" width="${bw}" height="${ih}" class="hit"/>
      ${h > 0 ? `<path d="M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z" class="fill"/>` : ''}</g>`;
    if (i % every === 0 || i === data.length - 1) g += `<text x="${padL + i * bw + bw / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" preserveAspectRatio="none">${g}</svg>`;
}

/** Anillo. data: [{label, value, color}] */
export function donut(data, { size = 168, center = '' } = {}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const R = 70, r = 48, C = 84;
  let a0 = -Math.PI / 2, g = '';
  const gap = data.filter(d => d.value > 0).length > 1 ? 0.025 : 0;
  for (const d of data) {
    if (d.value <= 0) continue;
    const a1 = a0 + (d.value / total) * Math.PI * 2;
    const s = a0 + gap / 2, e = Math.max(s + 0.001, a1 - gap / 2);
    const large = e - s > Math.PI ? 1 : 0;
    const p = (ang, rad) => `${C + rad * Math.cos(ang)},${C + rad * Math.sin(ang)}`;
    if (data.filter(x => x.value > 0).length === 1) {
      g += `<circle cx="${C}" cy="${C}" r="${(R + r) / 2}" fill="none" stroke="${d.color}" stroke-width="${R - r}"/>`;
    } else {
      g += `<path d="M${p(s, R)} A${R},${R} 0 ${large} 1 ${p(e, R)} L${p(e, r)} A${r},${r} 0 ${large} 0 ${p(s, r)} Z" fill="${d.color}"><title>${esc(d.label)}: ${fmt.money(d.value)} (${fmt.pct(d.value / total)})</title></path>`;
    }
    a0 = a1;
  }
  return `<svg viewBox="0 0 168 168" width="${size}" height="${size}" class="donut" role="img">${g}
    <text x="84" y="80" text-anchor="middle" class="donut-k">${esc(center)}</text>
    <text x="84" y="100" text-anchor="middle" class="donut-l">total</text></svg>`;
}

/** Mini línea de tendencia */
export function spark(values, { w = 120, h = 34 } = {}) {
  if (!values.length) return '';
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => [i * (w / Math.max(1, values.length - 1)), h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spark" aria-hidden="true">
    <path d="${d} L${w},${h} L0,${h} Z" class="spark-a"/><path d="${d}" class="spark-l"/></svg>`;
}
