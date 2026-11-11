// Vista 3D: el reticulado plano se duplica en dos planos paralelos unidos por travesaños y tablero.
// Proyección en perspectiva propia sobre canvas 2D (sin librerías), con orden de pintado por profundidad.
import { profileOf } from '../core/catalog.js';
import { bounds } from '../core/model.js';
import { reducedMotion } from './dom.js';

export function createView3D({ canvas, app }) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, dpr = 1, yaw = -0.55, pitch = 0.28, zoom = 1, auto = true, raf = 0, last = 0;
  let colors = {};
  const pointers = new Map();
  let pinchD = 0;

  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['sheet', 'ink', 'ink-soft', 'grid-strong', 'tension', 'compression', 'danger', 'neutral', 'accent']) colors[k] = cs.getPropertyValue('--' + k).trim();
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr;
  }

  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); auto = false; pinchD = 0; });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD) zoom = Math.min(3, Math.max(0.4, zoom * d / pinchD));
      pinchD = d; return;
    }
    yaw += (e.clientX - p.x) * 0.008; pitch = Math.min(1.3, Math.max(-0.2, pitch + (e.clientY - p.y) * 0.006));
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const up = (e) => { pointers.delete(e.pointerId); pinchD = 0; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.min(3, Math.max(0.4, zoom * Math.exp(-e.deltaY * 0.0015))); auto = false; }, { passive: false });

  function draw(now) {
    raf = requestAnimationFrame(draw);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (auto && !reducedMotion()) yaw += dt * 0.16;
    const { model } = app.store.get(), res = app.results, ok = !!res?.ok;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    if (!model.nodes.length) return;
    const b = bounds(model);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 2);
    const depth = Math.min(8, Math.max(2.4, span * 0.17));
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const dist = span * 1.55 / zoom, focal = Math.min(W, H) * 1.05;
    const cyaw = Math.cos(yaw), syaw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const project = (x, y, z) => {
      const X = x - cx, Y = y - cy;
      const x1 = X * cyaw + z * syaw, z1 = -X * syaw + z * cyaw;
      const y2 = Y * cp - z1 * sp, z2 = Y * sp + z1 * cp + dist;
      const k = focal / Math.max(z2, 0.1);
      return [W / 2 + x1 * k, H * 0.52 - y2 * k, z2, k];
    };
    const node = new Map(model.nodes.map((n) => [n.id, n]));
    const items = [];
    const seg = (a, b2, color, width, alpha = 1) => { const p = project(...a), q = project(...b2); items.push({ z: (p[2] + q[2]) / 2, p, q, color, width: width * (p[3] + q[3]) / 2, alpha }); };

    // Suelo
    const gy = b.minY - span * 0.12, gs = Math.max(1, Math.round(span / 12));
    for (let x = Math.floor((b.minX - span * 0.3) / gs) * gs; x <= b.maxX + span * 0.3; x += gs) seg([x, gy, -depth * 1.6], [x, gy, depth * 1.6], colors['grid-strong'], 0.02);
    for (let z = -depth * 1.6; z <= depth * 1.6 + 1e-6; z += depth * 0.8) seg([b.minX - span * 0.3, gy, z], [b.maxX + span * 0.3, gy, z], colors['grid-strong'], 0.02);

    const deckNodes = new Set();
    for (const m of model.members) {
      const a = node.get(m.a), c = node.get(m.b);
      const r = ok ? res.byId.get(m.id) : null;
      const N = r ? r.Ngov : 0;
      const color = !r ? colors.neutral : r.u > 1 ? colors.danger : Math.abs(N) < 1e-6 ? colors.neutral : N > 0 ? colors.tension : colors.compression;
      const w = profileOf(m).D / 1000 * 1.25 + 0.05;
      const alpha = r ? 0.5 + 0.5 * Math.min(1, r.u) : 0.8;
      for (const z of [-depth / 2, depth / 2]) seg([a.x, a.y, z], [c.x, c.y, z], color, w, alpha);
      if (m.deck) {
        deckNodes.add(m.a); deckNodes.add(m.b);
        const pts = [[a.x, a.y, -depth / 2], [c.x, c.y, -depth / 2], [c.x, c.y, depth / 2], [a.x, a.y, depth / 2]].map((p) => project(...p));
        items.push({ z: pts.reduce((s, p) => s + p[2], 0) / 4 + 0.01, poly: pts });
      }
    }
    for (const n of model.nodes) {
      seg([n.x, n.y, -depth / 2], [n.x, n.y, depth / 2], colors['ink-soft'], 0.06, 0.8);
      if (n.support) for (const z of [-depth / 2, depth / 2]) {
        const h = span * 0.045;
        seg([n.x, n.y, z], [n.x - h * 0.7, n.y - h * 1.3, z], colors.ink, 0.05); seg([n.x, n.y, z], [n.x + h * 0.7, n.y - h * 1.3, z], colors.ink, 0.05);
        seg([n.x - h * 0.9, n.y - h * 1.3, z], [n.x + h * 0.9, n.y - h * 1.3, z], colors.ink, 0.05);
      }
      if (n.load) { const F = Math.hypot(n.load.fx, n.load.fy) || 1, L = span * 0.1; seg([n.x - n.load.fx / F * L, n.y - n.load.fy / F * L, 0], [n.x, n.y, 0], colors.accent, 0.09); }
    }

    items.sort((p, q) => q.z - p.z);
    ctx.lineCap = 'round';
    for (const it of items) {
      const fog = Math.min(1, Math.max(0.25, 1.25 - (it.z - dist * 0.6) / (dist * 1.1)));
      if (it.poly) {
        ctx.globalAlpha = 0.16 * fog; ctx.fillStyle = colors.ink;
        ctx.beginPath(); it.poly.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
        continue;
      }
      ctx.globalAlpha = it.alpha * fog; ctx.strokeStyle = it.color; ctx.lineWidth = Math.max(0.8, it.width);
      ctx.beginPath(); ctx.moveTo(it.p[0], it.p[1]); ctx.lineTo(it.q[0], it.q[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  return {
    readTheme,
    start() { canvas.hidden = false; resize(); readTheme(); auto = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); },
    stop() { canvas.hidden = true; cancelAnimationFrame(raf); },
  };
}
