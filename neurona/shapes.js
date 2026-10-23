// Generador de dibujos sintéticos + rasterizado tipo MNIST. Script clásico: funciona en la página y en el Worker.
(function (G) {
  const TAU = Math.PI * 2;
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- clases base: cada una devuelve trazos [[x,y],...] en coordenadas ~[-1,1], y hacia abajo ----------
  const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = a0 + (a1 - a0) * i / n; return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]; });
  const poly = (pts, close) => { const p = pts.map(q => q.slice()); if (close) p.push(pts[0].slice()); return p; };
  const regular = (n, r = 1, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [Math.cos(rot + i * TAU / n) * r, Math.sin(rot + i * TAU / n) * r]);

  const CLASSES = [
    { id: 'circulo', name: 'Círculo', emoji: '⭕', gen() { const a = R(0, TAU); return [arc(0, 0, R(.85, 1.1), R(.85, 1.1), a, a + TAU + R(-.15, .35), 48)]; } },
    { id: 'cuadrado', name: 'Cuadrado', emoji: '⬜', gen() { const w = R(.8, 1.1), h = w * R(.85, 1.15); const pts = [[-w, -h], [w, -h], [w, h], [-w, h]]; const s = Math.floor(R(0, 4)); return [poly([...pts.slice(s), ...pts.slice(0, s)], true)]; } },
    { id: 'triangulo', name: 'Triángulo', emoji: '🔺', gen() { const p = regular(3, 1, -Math.PI / 2 + R(-.12, .12)).map(([x, y]) => [x * R(.9, 1.1), y * R(.9, 1.1)]); return [poly(p, true)]; } },
    { id: 'estrella', name: 'Estrella', emoji: '⭐', gen() {
        if (Math.random() < .55) { const v = regular(5, 1); return [poly([0, 2, 4, 1, 3].map(i => v[i]), true)]; }
        const k = R(.38, .5); const p = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? k : 1, t = -Math.PI / 2 + i * TAU / 10; return [Math.cos(t) * r, Math.sin(t) * r]; }); return [poly(p, true)];
      } },
    { id: 'corazon', name: 'Corazón', emoji: '❤️', gen() { const p = Array.from({ length: 60 }, (_, i) => { const t = i / 59 * TAU; return [16 * Math.pow(Math.sin(t), 3) / 16, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; }); return [p]; } },
    { id: 'rayo', name: 'Rayo', emoji: '⚡', gen() { const w = R(.35, .55); return [[[.3, -1], [-w, R(-.05, .15)], [w * .9, R(-.15, .05)], [-.3, 1]]]; } },
    { id: 'flecha', name: 'Flecha', emoji: '➡️', gen() { const h = R(.35, .55), a = R(.45, .75); const body = [[-1, 0], [1, 0]]; const head = [[1 - h, -h * a * 1.6], [1, 0], [1 - h, h * a * 1.6]]; return Math.random() < .5 ? [body, head] : [[[-1, 0], [1, 0], [1 - h, -h * a * 1.6]], [[1, 0], [1 - h, h * a * 1.6]]]; }, rotate: true },
    { id: 'casa', name: 'Casa', emoji: '🏠', gen() { const w = R(.7, .9), roof = R(.45, .75), top = R(-.2, .05); const walls = [[-w, top], [-w, 1], [w, 1], [w, top]]; const r = [[-w * R(1, 1.15), top], [0, top - roof - .3], [w * R(1, 1.15), top]]; return Math.random() < .5 ? [poly(walls, true), r] : [[...walls, [-w, top]], r]; } },
    { id: 'luna', name: 'Luna', emoji: '🌙', gen() { const o = R(.2, .55); const outer = arc(0, 0, 1, 1, Math.PI * (.5 - o / 2.2), Math.PI * (1.5 + o / 2.2), 36).map(([x, y]) => [x, y]); const a0 = outer[0], a1 = outer[outer.length - 1]; const inner = arc(o, 0, .85, 1, Math.PI * 1.45, Math.PI * .55, 30); return [[...outer, ...inner.slice(1), a0]]; } },
    { id: 'carita', name: 'Carita', emoji: '🙂', gen() { const e = R(.28, .4), ey = R(-.4, -.2), a = R(0, TAU); const dot = (x, y) => arc(x, y, .07, .07, 0, TAU, 8); const sm = R(.15, .35); return [arc(0, 0, 1, R(.92, 1.08), a, a + TAU, 44), dot(-e, ey), dot(e, ey), arc(0, R(.05, .2), R(.45, .6), R(.3, .45), sm, Math.PI - sm, 16)]; } },
    { id: 'espiral', name: 'Espiral', emoji: '🌀', gen() { const turns = R(2.2, 3.2), a0 = R(0, TAU), dir = Math.random() < .5 ? 1 : -1; return [Array.from({ length: 90 }, (_, i) => { const t = i / 89, r = .08 + t * .95; const a = a0 + dir * t * turns * TAU; return [Math.cos(a) * r, Math.sin(a) * r]; })]; } },
    { id: 'ola', name: 'Ola', emoji: '〰️', gen() { const k = R(1.6, 2.6), amp = R(.18, .35), ph = R(0, TAU); return [Array.from({ length: 50 }, (_, i) => { const x = -1 + 2 * i / 49; return [x, Math.sin(x * k * Math.PI + ph) * amp]; })]; } },
  ];

  // ---------- aumentación: deformaciones como las de una mano real ----------
  function smoothNoise() { const a = [R(0, TAU), R(0, TAU), R(0, TAU)], f = [R(1, 2.5), R(2.5, 5), R(5, 9)], m = [1, .5, .25]; return t => a.reduce((s, ph, i) => s + Math.sin(t * f[i] + ph) * m[i], 0) / 1.75; }
  function augment(strokes, opts = {}) {
    const rot = opts.rotate ? R(0, TAU) : R(-.3, .3);
    const sx = R(.82, 1.18), sy = R(.82, 1.18), sh = R(-.16, .16);
    const c = Math.cos(rot), s = Math.sin(rot);
    const nx = smoothNoise(), ny = smoothNoise(), amt = R(.015, opts.wobble ?? .08);
    return strokes.map(st => {
      // remuestreo uniforme para que el temblor se reparta por el trazo
      let pts = resample(st, 2 + Math.round(polylineLength(st) * 18));
      // a veces la mano corta antes o se pasa un poco
      if (pts.length > 12 && Math.random() < .5) { const cut = Math.floor(pts.length * R(0, .07)); pts = Math.random() < .5 ? pts.slice(cut) : pts.slice(0, pts.length - cut); }
      return pts.map(([x, y], i) => {
        const t = (x + y) * 1.7 + i * .03;
        let X = x * sx + y * sh, Y = y * sy;
        X += nx(t) * amt; Y += ny(t + 9) * amt;
        return [X * c - Y * s, X * s + Y * c];
      });
    });
  }
  function polylineLength(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
  function resample(p, n) {
    if (p.length < 2) return p.slice();
    const L = polylineLength(p); if (L === 0) return [p[0].slice()];
    const out = [p[0].slice()], step = L / (n - 1); let acc = 0;
    for (let i = 1; i < p.length; i++) {
      let [x0, y0] = p[i - 1]; const [x1, y1] = p[i]; let d = Math.hypot(x1 - x0, y1 - y0);
      while (acc + d >= step && d > 0) { const t = (step - acc) / d; x0 += (x1 - x0) * t; y0 += (y1 - y0) * t; out.push([x0, y0]); d = Math.hypot(x1 - x0, y1 - y0); acc = 0; }
      acc += d;
    }
    while (out.length < n) out.push(p[p.length - 1].slice());
    return out;
  }

  // ---------- rasterizado tipo MNIST: recorta, escala a 20 px, centra por centro de masa en 28×28 ----------
  const N = 28;
  function rasterize(strokes, out = new Float32Array(N * N), thick = 1.35) {
    out.fill(0);
    const all = strokes.flat(); if (!all.length) return out;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of all) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const w = maxX - minX, h = maxY - minY, size = Math.max(w, h, 1e-6);
    const sc = 20 / size;
    // centro de masa de los puntos remuestreados (aprox. de la tinta)
    let mx = 0, my = 0, cnt = 0;
    const segs = strokes.map(st => resample(st, Math.max(2, Math.round(polylineLength(st) * sc * 3))));
    for (const st of segs) for (const [x, y] of st) { mx += x; my += y; cnt++; }
    mx /= cnt; my /= cnt;
    const ox = 14 - mx * sc, oy = 14 - my * sc;
    const r = thick;
    const stamp = (px, py) => {
      const x0 = Math.max(0, Math.floor(px - r - 1)), x1 = Math.min(N - 1, Math.ceil(px + r + 1));
      const y0 = Math.max(0, Math.floor(py - r - 1)), y1 = Math.min(N - 1, Math.ceil(py + r + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + .5 - px, y + .5 - py), v = Math.max(0, Math.min(1, r + .5 - d));
        const i = y * N + x; if (v > out[i]) out[i] = v;
      }
    };
    for (const st of segs) {
      if (st.length === 1) { stamp(st[0][0] * sc + ox, st[0][1] * sc + oy); continue; }
      for (let i = 1; i < st.length; i++) {
        const ax = st[i - 1][0] * sc + ox, ay = st[i - 1][1] * sc + oy, bx = st[i][0] * sc + ox, by = st[i][1] * sc + oy;
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / .35));
        for (let k = 0; k <= n; k++) stamp(ax + (bx - ax) * k / n, ay + (by - ay) * k / n);
      }
    }
    return out;
  }

  /** Muestra de entrenamiento para la clase idx. custom: [{id,name,examples:[strokes...]}] */
  function sample(idx, custom = []) {
    if (idx < CLASSES.length) { const c = CLASSES[idx]; return rasterize(augment(c.gen(), { rotate: c.rotate }), undefined, R(1.05, 1.75)); }
    const cc = custom[idx - CLASSES.length];
    return rasterize(augment(pick(cc.examples), { wobble: .05 }), undefined, R(1.05, 1.75));
  }

  G.Shapes = { CLASSES, augment, rasterize, sample, resample, N };
})(typeof self !== 'undefined' ? self : globalThis);
