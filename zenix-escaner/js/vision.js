// Visión por computadora, escrita a mano: detección de la hoja, enderezado de perspectiva y limpieza.
// Sin librerías. Todo opera sobre ImageData / Uint8ClampedArray.

// ---------- utilidades ----------
export function toGray(img) {
  const { data, width: w, height: h } = img;
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  return g;
}

// desenfoque de caja separable (r = radio), repetido da casi una gaussiana
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / d;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / d;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
export const blur = (src, w, h, r, passes = 2) => { let o = src; for (let i = 0; i < passes; i++) o = boxBlur(o, w, h, r); return o; };

function otsu(g) {
  const hist = new Float64Array(256);
  for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = g.length - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

// ---------- geometría ----------
function cross(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
function convexHull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
export function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a) / 2; }

// cuadrilátero de área máxima inscripto en el casco convexo
function maxAreaQuad(hull) {
  let h = hull;
  if (h.length > 36) { const step = h.length / 36; h = Array.from({ length: 36 }, (_, i) => hull[Math.floor(i * step)]); }
  const n = h.length; if (n < 4) return null;
  let best = -1, q = null;
  for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
    // para la diagonal i-k, el mejor j y l son los más lejanos de cada lado
    let a1 = -1, jb = -1, a2 = -1, lb = -1;
    for (let j = i + 1; j < k; j++) { const a = Math.abs(cross(h[i], h[k], h[j])); if (a > a1) { a1 = a; jb = j; } }
    for (let l = k + 1; l < n + i; l++) { const a = Math.abs(cross(h[i], h[k], h[l % n])); if (a > a2) { a2 = a; lb = l % n; } }
    if (jb < 0 || lb < 0) continue;
    if (a1 + a2 > best) { best = a1 + a2; q = [h[i], h[jb], h[k], h[lb]]; }
  }
  return q;
}

export function orderQuad(q) {
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4;
  const s = q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  // empezar por el de arriba a la izquierda (menor x+y)
  let k = 0; for (let i = 1; i < 4; i++) if (s[i][0] + s[i][1] < s[k][0] + s[k][1]) k = i;
  return [0, 1, 2, 3].map(i => s[(k + i) % 4]); // TL, TR, BR, BL (en sentido horario, eje y hacia abajo)
}

/**
 * Detecta la hoja en una imagen pequeña (~256 px de ancho).
 * Devuelve { quad: [[x,y]x4] en coordenadas de esa imagen, score 0..1 } o null.
 */
export function detectDocument(img) {
  const { width: w, height: h } = img;
  const g = blur(toGray(img), w, h, 2);
  const thr = otsu(g);
  let best = null;
  const consider = c => { if (c && (!best || c.score > best.score)) best = c; };
  // 1) por brillo: hoja clara sobre fondo oscuro (o al revés)
  for (const bright of [true, false]) {
    const bin = new Uint8Array(w * h);
    for (let i = 0; i < bin.length; i++) bin[i] = (bright ? g[i] > thr : g[i] < thr) ? 1 : 0;
    consider(bestQuadInBinary(bin, w, h, 1));
  }
  // 2) por bordes: regiones separadas por gradientes fuertes (sirve con poco contraste y sombras)
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
    const gy = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
    mag[i] = Math.hypot(gx, gy);
  }
  const sorted = Float32Array.from(mag).sort();
  const T = Math.max(14, sorted[Math.floor(sorted.length * 0.86)]);
  const edge = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (mag[i] >= T) { edge[i] = 1; edge[i - 1] = edge[i + 1] = edge[i - w] = edge[i + w] = 1; }
  }
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = edge[i] ? 0 : 1;
  consider(bestQuadInBinary(bin, w, h, 0.97));
  // 3) fondo = zonas sin bordes conectadas al marco de la foto; la hoja es lo que queda adentro
  const bg = new Uint8Array(w * h), st = new Int32Array(w * h); let sp = 0;
  const seed = i => { if (bin[i] && !bg[i]) { bg[i] = 1; st[sp++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (sp) {
    const p = st[--sp], x = p % w;
    if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (p >= w) seed(p - w); if (p < w * (h - 1)) seed(p + w);
  }
  const inner = new Uint8Array(w * h);
  for (let i = 0; i < inner.length; i++) inner[i] = bg[i] ? 0 : 1;
  consider(bestQuadInBinary(inner, w, h, 1));
  return best;
}

function bestQuadInBinary(bin, w, h, weight) {
  const label = new Uint8Array(w * h), stack = new Int32Array(w * h);
  const rowMin = new Int32Array(h), rowMax = new Int32Array(h);
  let best = null;
  for (let s = 0; s < bin.length; s++) {
    if (!bin[s] || label[s]) continue;
    let sp = 0, size = 0, touches = 0; stack[sp++] = s; label[s] = 1;
    let minX = w, maxX = 0, minY = h, maxY = 0;
    rowMin.fill(w); rowMax.fill(-1);
    while (sp) {
      const p = stack[--sp], x = p % w, y = (p / w) | 0; size++;
      if (x < rowMin[y]) rowMin[y] = x; if (x > rowMax[y]) rowMax[y] = x;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches++;
      if (x > 0 && bin[p - 1] && !label[p - 1]) { label[p - 1] = 1; stack[sp++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !label[p + 1]) { label[p + 1] = 1; stack[sp++] = p + 1; }
      if (y > 0 && bin[p - w] && !label[p - w]) { label[p - w] = 1; stack[sp++] = p - w; }
      if (y < h - 1 && bin[p + w] && !label[p + w]) { label[p + w] = 1; stack[sp++] = p + w; }
    }
    const pts = []; let span = 0;
    for (let y = minY; y <= maxY; y++) if (rowMax[y] >= 0) { pts.push([rowMin[y], y]); pts.push([rowMax[y] + 1, y]); span += rowMax[y] - rowMin[y] + 1; }
    // el área por contorno ignora los huecos que dejan las letras
    if (size < span * 0.45) continue;
    size = span;
    const frac = size / (w * h);
    if (frac < 0.05 || frac > 0.97) continue;
    const hull = convexHull(pts);
    const quad = maxAreaQuad(hull); if (!quad) continue;
    const qa = polyArea(quad), ha = polyArea(hull);
    const fill = size / qa, rect = qa / ha;
    const borderPenalty = Math.min(1, touches / ((w + h) * 0.9));
    const score = weight * Math.min(1, fill) * rect * (0.4 + 0.6 * Math.min(1, frac / 0.35)) * (1 - 0.7 * borderPenalty);
    if (rect > 0.86 && fill > 0.72 && (!best || score > best.score)) best = { quad: orderQuad(quad), score };
  }
  return best;
}

// ---------- homografía ----------
function solve(A, b) { // eliminación gaussiana con pivoteo parcial
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
  return x;
}
// matriz que lleva puntos de "from" a "to"
export function homography(from, to) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b); return [...h, 1];
}

/**
 * Proporción real (ancho/alto) del rectángulo fotografiado, recuperando la distancia focal desde
 * los puntos de fuga (método de Zhang y He, "Whiteboard scanning"). Si la geometría es degenerada
 * (foto casi de frente), devuelve null y se usa el largo de los bordes.
 */
export function trueAspect(q, imgW, imgH) {
  if (!imgW || !imgH) return null;
  const u0 = imgW / 2, v0 = imgH / 2;
  const P = p => [p[0], p[1], 1];
  const m1 = P(q[0]), m2 = P(q[1]), m3 = P(q[3]), m4 = P(q[2]); // TL, TR, BL, BR
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const k2 = dot(cr(m1, m4), m3) / dot(cr(m2, m4), m3);
  const k3 = dot(cr(m1, m4), m2) / dot(cr(m3, m4), m2);
  const n2 = [k2 * m2[0] - m1[0], k2 * m2[1] - m1[1], k2 * m2[2] - m1[2]];
  const n3 = [k3 * m3[0] - m1[0], k3 * m3[1] - m1[1], k3 * m3[2] - m1[2]];
  if (Math.abs(n2[2]) < 1e-5 || Math.abs(n3[2]) < 1e-5) return null;
  const f2 = -((n2[0] * n3[0] - (n2[0] * n3[2] + n2[2] * n3[0]) * u0 + n2[2] * n3[2] * u0 * u0) +
               (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)) / (n2[2] * n3[2]);
  if (!(f2 > 0)) return null;
  const f = Math.sqrt(f2);
  // focal razonable para cámaras de celular: entre 0,5× y 4× el lado mayor
  const L = Math.max(imgW, imgH); if (f < L * 0.5 || f > L * 4) return null;
  const qf = n => { const x = n[0] - u0 * n[2], y = n[1] - v0 * n[2]; return (x * x + y * y) / f2 + n[2] * n[2]; };
  const r = Math.sqrt(qf(n2) / qf(n3));
  return isFinite(r) && r > 0.1 && r < 10 ? r : null;
}

export function outputSize(q, maxSide = 2200, imgW = 0, imgH = 0) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let w = Math.max(d(q[0], q[1]), d(q[3], q[2])), h = Math.max(d(q[0], q[3]), d(q[1], q[2]));
  const r = trueAspect(q, imgW, imgH);
  if (r) { const area = w * h; w = Math.sqrt(area * r); h = w / r; }   // misma resolución, proporción real
  const s = Math.min(1, maxSide / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

/** Endereza el cuadrilátero q de src (ImageData) a un rectángulo W×H, con muestreo bilineal. */
export function warp(src, q, W, H) {
  const H8 = homography([[0, 0], [W, 0], [W, H], [0, H]], q);
  const out = new ImageData(W, H), od = out.data, sd = src.data, sw = src.width, sh = src.height;
  const [a, b, c, d, e, f, g, h] = H8;
  let o = 0;
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < W; x++, o += 4) {
      const xx = x + 0.5, den = g * xx + h * yy + 1;
      let sx = (a * xx + b * yy + c) / den - 0.5, sy = (d * xx + e * yy + f) / den - 0.5;
      if (sx < 0) sx = 0; else if (sx > sw - 1.001) sx = sw - 1.001;
      if (sy < 0) sy = 0; else if (sy > sh - 1.001) sy = sh - 1.001;
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const p00 = (y0 * sw + x0) * 4, p10 = p00 + 4, p01 = p00 + sw * 4, p11 = p01 + 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      od[o] = sd[p00] * w00 + sd[p10] * w10 + sd[p01] * w01 + sd[p11] * w11;
      od[o + 1] = sd[p00 + 1] * w00 + sd[p10 + 1] * w10 + sd[p01 + 1] * w01 + sd[p11 + 1] * w11;
      od[o + 2] = sd[p00 + 2] * w00 + sd[p10 + 2] * w10 + sd[p01 + 2] * w01 + sd[p11 + 2] * w11;
      od[o + 3] = 255;
    }
  }
  return out;
}

// ---------- limpieza ----------
// Estima la iluminación del papel (fondo) ignorando el texto: achica, dilata (máximo) y suaviza.
function illumination(gray, w, h) {
  const k = Math.max(1, Math.round(Math.max(w, h) / 160));
  const sw = Math.ceil(w / k), sh = Math.ceil(h / k);
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let m = 0;
    for (let yy = y * k; yy < Math.min(h, y * k + k); yy++) for (let xx = x * k; xx < Math.min(w, x * k + k); xx++) { const v = gray[yy * w + xx]; if (v > m) m = v; }
    small[y * sw + x] = m;
  }
  // dilatación para tapar letras gruesas, después suavizado
  const r = 3, dil = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    let m = 0;
    for (let yy = Math.max(0, y - r); yy <= Math.min(sh - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(sw - 1, x + r); xx++) { const v = small[yy * sw + xx]; if (v > m) m = v; }
    dil[y * sw + x] = m;
  }
  const sm = blur(dil, sw, sh, 3, 3);
  return { sm, sw, sh, k };
}
function sampleIllum(I, x, y) {
  const fx = Math.min(I.sw - 1.001, Math.max(0, x / I.k - 0.5)), fy = Math.min(I.sh - 1.001, Math.max(0, y / I.k - 0.5));
  const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, s = I.sm, w = I.sw;
  return s[y0 * w + x0] * (1 - ax) * (1 - ay) + s[y0 * w + x0 + 1] * ax * (1 - ay) + s[(y0 + 1) * w + x0] * (1 - ax) * ay + s[(y0 + 1) * w + x0 + 1] * ax * ay;
}

export const FILTERS = {
  original: 'Original',
  color: 'Mejorado',
  gray: 'Grises',
  bw: 'Blanco y negro',
};

/** Aplica el filtro en el lugar. */
export function applyFilter(img, mode) {
  if (mode === 'original') return img;
  const { data, width: w, height: h } = img;
  const gray = toGray(img);
  const I = illumination(gray, w, h);
  for (let y = 0, p = 0; y < h; y++) {
    for (let x = 0; x < w; x++, p += 4) {
      const bg = Math.max(30, sampleIllum(I, x, y));
      const f = 255 / bg;
      if (mode === 'color') {
        let r = data[p] * f, g = data[p + 1] * f, b = data[p + 2] * f;
        // curva: blanqueá el papel, profundizá la tinta, levantá un poco la saturación
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        const s = 1.25;
        r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
        const curve = v => v >= 235 ? 255 : v <= 0 ? 0 : 255 * Math.pow(v / 235, 1.35);
        data[p] = curve(r); data[p + 1] = curve(g); data[p + 2] = curve(b);
      } else {
        let v = gray[y * w + x] * f;
        if (mode === 'gray') v = v >= 240 ? 255 : 255 * Math.pow(Math.max(0, v) / 240, 1.5);
        else v = 255 / (1 + Math.exp(-(v - 185) / 11));   // blanco y negro suave, sin dientes
        data[p] = data[p + 1] = data[p + 2] = v;
      }
    }
  }
  return img;
}

/** Rota un canvas en múltiplos de 90°. */
export function rotateCanvas(cv, turns) {
  turns = ((turns % 4) + 4) % 4;
  if (!turns) return cv;
  const out = document.createElement('canvas');
  out.width = turns % 2 ? cv.height : cv.width; out.height = turns % 2 ? cv.width : cv.height;
  const ctx = out.getContext('2d');
  ctx.translate(out.width / 2, out.height / 2); ctx.rotate(turns * Math.PI / 2);
  ctx.drawImage(cv, -cv.width / 2, -cv.height / 2);
  return out;
}

/** Imagen chica para detectar (≈256 px de ancho) desde cualquier fuente dibujable. */
export function smallFrame(source, sw, sh, target = 256) {
  const s = target / Math.max(sw, sh);
  const w = Math.max(1, Math.round(sw * s)), h = Math.max(1, Math.round(sh * s));
  const cv = smallFrame.cv ||= document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  return { img: ctx.getImageData(0, 0, w, h), scale: 1 / s };
}

// ---------- refinamiento fino de bordes ----------
// Busca el borde real a lo largo de cada lado (máximo gradiente sobre la normal), ajusta una recta
// robusta por lado e intersecta las rectas. Trabaja sobre una imagen mediana (gray Float32, w, h).
export function refineQuad(gray, w, h, quad) {
  const at = (x, y) => {
    if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return -1;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return gray[i] * (1 - fx) * (1 - fy) + gray[i + 1] * fx * (1 - fy) + gray[i + w] * (1 - fx) * fy + gray[i + w + 1] * fx * fy;
  };
  const diag = Math.hypot(w, h), R = Math.max(6, diag * 0.02);
  const cx = quad.reduce((a, p) => a + p[0], 0) / 4, cy = quad.reduce((a, p) => a + p[1], 0) / 4;
  const lines = [];
  for (let s = 0; s < 4; s++) {
    const a = quad[s], b = quad[(s + 1) % 4];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len, ny = dx / len;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if ((cx - mx) * nx + (cy - my) * ny > 0) { nx = -nx; ny = -ny; } // normal hacia afuera
    const pts = [];
    for (let k = 1; k < 24; k++) {
      const t = 0.08 + 0.84 * k / 24, px = a[0] + dx * t, py = a[1] + dy * t;
      // perfil de gradiente sobre la normal; el borde de la hoja es el escalón fuerte más externo
      const prof = [];
      for (let d = -R; d <= R; d += 0.5) {
        const inn = at(px + nx * (d - 1.5), py + ny * (d - 1.5)), out = at(px + nx * (d + 1.5), py + ny * (d + 1.5));
        prof.push(inn < 0 || out < 0 ? 0 : Math.abs(inn - out));
      }
      const maxG = Math.max(...prof);
      if (maxG <= 12) continue;
      let bi = -1;
      for (let i = prof.length - 1; i >= 0; i--) {
        if (prof[i] >= maxG * 0.55 && (i === 0 || prof[i] >= prof[i - 1]) && (i === prof.length - 1 || prof[i] >= prof[i + 1])) { bi = i; break; }
      }
      if (bi >= 0) { const bd = -R + bi * 0.5; pts.push([px + nx * bd, py + ny * bd]); }
    }
    if (pts.length < 6) { lines.push(null); continue; }
    lines.push(fitLine(pts));
  }
  const out = quad.map(p => p.slice());
  for (let i = 0; i < 4; i++) {
    const L1 = lines[(i + 3) % 4], L2 = lines[i]; // lados que llegan y salen del vértice i
    if (!L1 || !L2) continue;
    const p = intersect(L1, L2);
    if (p && Math.hypot(p[0] - quad[i][0], p[1] - quad[i][1]) < R * 2) out[i] = p;
  }
  return out;
}
function fitLine(pts) {
  let use = pts;
  for (let it = 0; it < 2; it++) {
    const mx = use.reduce((a, p) => a + p[0], 0) / use.length, my = use.reduce((a, p) => a + p[1], 0) / use.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of use) { const x = p[0] - mx, y = p[1] - my; sxx += x * x; syy += y * y; sxy += x * y; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), dx = Math.cos(ang), dy = Math.sin(ang);
    const L = { mx, my, dx, dy };
    if (it === 1) return L;
    const dist = p => Math.abs((p[0] - mx) * dy - (p[1] - my) * dx);
    const ds = pts.map(dist).sort((a, b) => a - b), med = ds[ds.length >> 1];
    use = pts.filter(p => dist(p) <= Math.max(1, med * 2.5));
    if (use.length < 4) return L;
  }
}
function intersect(A, B) {
  const den = A.dx * B.dy - A.dy * B.dx; if (Math.abs(den) < 1e-6) return null;
  const t = ((B.mx - A.mx) * B.dy - (B.my - A.my) * B.dx) / den;
  return [A.mx + A.dx * t, A.my + A.dy * t];
}
