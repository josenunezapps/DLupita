// Ajuste de texto: encuentra el cuerpo de letra más grande con el que un texto entra en un ancho y una cantidad de renglones.

/** Parte el texto en renglones que no superen maxWidth, según `measure(texto) → ancho`. */
export function wrap(measure, text, maxWidth) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const tryLine = line ? line + ' ' + w : w;
    if (line && measure(tryLine) > maxWidth) { lines.push(line); line = w; } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * measureAt(size) devuelve la función de medida para ese cuerpo.
 * Devuelve {size, lines}: el mayor cuerpo entre min y max que entra en maxLines renglones de maxWidth.
 */
export function fitText(measureAt, text, { maxWidth, maxSize, minSize = 8, maxLines = 2 }) {
  let lo = minSize, hi = maxSize, best = null;
  const attempt = (size) => {
    const m = measureAt(size), lines = wrap(m, text, maxWidth);
    return lines.length <= maxLines && lines.every((l) => m(l) <= maxWidth) ? lines : null;
  };
  for (let i = 0; i < 14 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2, lines = attempt(mid);
    if (lines) { best = { size: mid, lines }; lo = mid; } else hi = mid;
  }
  if (best) return { size: best.size, lines: balance(measureAt(best.size), text, maxWidth, best.lines) };
  const m = measureAt(minSize);
  return { size: minSize, lines: wrap(m, text, maxWidth).slice(0, maxLines) };
}

/** Reparte el texto en renglones parejos (evita dejar una sola palabra colgando), sin sumar renglones. */
export function balance(measure, text, maxWidth, lines) {
  if (lines.length < 2) return lines;
  let lo = Math.max(...String(text).trim().split(/\s+/).map(measure)), hi = maxWidth, best = lines;
  for (let i = 0; i < 12 && hi - lo > 1; i++) {
    const mid = (lo + hi) / 2, tryLines = wrap(measure, text, mid);
    if (tryLines.length <= lines.length && tryLines.every((l) => measure(l) <= maxWidth)) { best = tryLines; hi = mid; } else lo = mid;
  }
  return best;
}
