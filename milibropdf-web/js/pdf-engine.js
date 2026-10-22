// Lector PDF con PDF.js: desplazamiento continuo, zoom, rotación, capa de texto,
// resaltados, búsqueda y frases para la lectura en voz alta.
import { splitSentences, normalize } from './util.js';

const MAX_PIXELS = 16e6;

export class PdfEngine {
  constructor(stage, book, hooks) {
    this.kind = 'pdf';
    this.stage = stage; this.book = book; this.hooks = hooks;
    this.zoom = 'width'; this.rotation = 0; this.scale = 1;
    this.pages = []; this.raw = new Map(); this.texts = new Map();
    this.marks = []; this.current = 1; this.renderKey = 0; this.visible = new Set();
    this.ttsSentence = null; this.flash = null; this.hasText = null;
  }

  async open(blob, startPos, s) {
    this.zoom = s.pdfZoom === 'width' ? 'width' : Number(s.pdfZoom) || 'width';
    const data = new Uint8Array(await blob.arrayBuffer());
    this.doc = await pdfjsLib.getDocument({
      data, cMapUrl: 'vendor/cmaps/', cMapPacked: true, standardFontDataUrl: 'vendor/standard_fonts/',
    }).promise;
    this.n = this.doc.numPages;
    const p1 = await this.doc.getPage(1);
    const vp = p1.getViewport({ scale: 1 });
    this.base = { w: vp.width, h: vp.height };

    this.scroller = document.createElement('div'); this.scroller.className = 'pdf-scroll';
    this.wrap = document.createElement('div'); this.wrap.className = 'pdf-pages';
    this.scroller.appendChild(this.wrap);
    for (let i = 1; i <= this.n; i++) {
      const el = document.createElement('div'); el.className = 'pdf-page'; el.dataset.p = i;
      el.innerHTML = `<span class="pnum">${i}</span>`;
      this.wrap.appendChild(el);
      this.pages.push({ num: i, el, size: null, vp: null, textDivs: null, rendered: -1, rendering: false });
    }
    this.stage.appendChild(this.scroller);
    this.layout();

    this.io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const num = +e.target.dataset.p;
        if (e.isIntersecting) { this.visible.add(num); this.renderPage(num); }
        else { this.visible.delete(num); this.releasePage(num); }
      }
    }, { root: this.scroller, rootMargin: '120% 0px' });
    this.pages.forEach(p => this.io.observe(p.el));

    let raf = 0;
    this.scroller.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; this.updateCurrent(); });
      this.hooks.onActivity?.();
    }, { passive: true });
    this.scroller.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      this.setZoom(this.numericScale() * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    }, { passive: false });
    this.scroller.addEventListener('click', e => {
      if (e.target.closest('a')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      this.hooks.onTap?.(e);
    });
    this.onSelChange = () => {
      clearTimeout(this.selT);
      this.selT = setTimeout(() => this.checkSelection(), 220);
    };
    document.addEventListener('selectionchange', this.onSelChange);

    this.goTo(startPos || '1:0', true);
    this.updateCurrent(true);
    // Detectar PDF escaneado (sin texto) mirando las primeras páginas
    this.detectText();
  }

  async detectText() {
    let chars = 0;
    const upto = Math.min(this.n, 4);
    for (let i = 1; i <= upto; i++) chars += (await this.pageText(i)).text.trim().length;
    this.hasText = chars > 20;
    if (!this.hasText) this.hooks.onNotice?.('Modo compatibilidad: este PDF es escaneado o de imágenes. Se puede leer y navegar, pero no tiene texto para seleccionar ni escuchar.');
  }

  // ---------- Medidas ----------
  numericScale() { return this.scale; }
  computeScale() {
    const rot = this.rotation % 180 !== 0;
    const w = rot ? this.base.h : this.base.w;
    if (this.zoom === 'width') {
      const avail = Math.max(200, this.scroller.clientWidth - 24);
      return Math.min(avail, 1100) / w;
    }
    return this.zoom;
  }
  pageSize(rec) {
    const s = rec.size || this.base;
    const rot = this.rotation % 180 !== 0;
    return { w: (rot ? s.h : s.w) * this.scale, h: (rot ? s.w : s.h) * this.scale };
  }
  layout() {
    this.scale = this.computeScale();
    for (const rec of this.pages) {
      const { w, h } = this.pageSize(rec);
      rec.el.style.width = `${Math.floor(w)}px`; rec.el.style.height = `${Math.floor(h)}px`;
    }
  }
  relayout(keep = true) {
    const pos = keep ? this.getPosition() : null;
    this.renderKey++;
    this.layout();
    for (const rec of this.pages) { rec.rendered = -1; }
    if (pos) this.goTo(pos, true);
    // volver a dibujar las visibles
    requestAnimationFrame(() => this.visible.forEach(n => this.renderPage(n)));
    this.hooks.onZoom?.(this.zoomLabel());
  }
  zoomLabel() { return this.zoom === 'width' ? 'Ancho' : `${Math.round(this.scale * 100)}%`; }
  setZoom(z) {
    if (z !== 'width') z = Math.max(0.4, Math.min(5, z));
    this.zoom = z; this.relayout();
  }
  zoomIn() { this.setZoom(this.scale * 1.2); }
  zoomOut() { this.setZoom(this.scale / 1.2); }
  fitWidth() { this.setZoom('width'); }
  rotate() { this.rotation = (this.rotation + 90) % 360; this.relayout(); }
  onResize() { if (this.zoom === 'width') this.relayout(); }

  // ---------- Render ----------
  async rawText(num) {
    if (!this.raw.has(num)) this.raw.set(num, this.doc.getPage(num).then(p => p.getTextContent()));
    return this.raw.get(num);
  }
  async pageText(num) {
    if (this.texts.has(num)) return this.texts.get(num);
    const tc = await this.rawText(num);
    let text = ''; const spans = [];
    for (const it of tc.items) {
      if (it.str === undefined) continue;
      const a = text.length; text += it.str; spans.push([a, text.length]);
      if (it.hasEOL && !/\s$/.test(text)) text += ' ';
    }
    const res = { text, spans };
    this.texts.set(num, res);
    return res;
  }

  async renderPage(num) {
    const rec = this.pages[num - 1];
    if (!rec || rec.rendering || rec.rendered === this.renderKey) return;
    rec.rendering = true;
    const key = this.renderKey;
    try {
      const page = await this.doc.getPage(num);
      if (!rec.size) {
        const v1 = page.getViewport({ scale: 1 });
        if (Math.abs(v1.width - this.base.w) > 1 || Math.abs(v1.height - this.base.h) > 1) {
          rec.size = { w: v1.width, h: v1.height };
          const { w, h } = this.pageSize(rec);
          rec.el.style.width = `${Math.floor(w)}px`; rec.el.style.height = `${Math.floor(h)}px`;
        } else rec.size = this.base;
      }
      const vp = page.getViewport({ scale: this.scale, rotation: this.rotation });
      if (key !== this.renderKey || !this.visible.has(num)) return;
      let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      if (vp.width * vp.height * dpr * dpr > MAX_PIXELS) dpr = Math.sqrt(MAX_PIXELS / (vp.width * vp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width * dpr); canvas.height = Math.floor(vp.height * dpr);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      rec.task = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      await rec.task.promise;
      if (key !== this.renderKey) return;
      rec.el.querySelector('canvas')?.remove();
      rec.el.prepend(canvas);
      rec.vp = vp;
      // Capa de texto
      const tc = await this.rawText(num);
      if (key !== this.renderKey) return;
      const layer = document.createElement('div'); layer.className = 'textLayer';
      rec.el.style.setProperty('--scale-factor', vp.scale);
      const textDivs = [];
      await pdfjsLib.renderTextLayer({ textContentSource: tc, container: layer, viewport: vp, textDivs }).promise;
      if (key !== this.renderKey) return;
      rec.el.querySelector('.textLayer')?.remove();
      const end = document.createElement('div'); end.className = 'endOfContent'; layer.appendChild(end);
      layer.addEventListener('mousedown', () => layer.classList.add('selecting'));
      layer.addEventListener('mouseup', () => layer.classList.remove('selecting'));
      rec.el.appendChild(layer);
      rec.textDivs = textDivs;
      rec.rendered = key;
      this.drawMarks(rec);
      this.drawOverlay(rec);
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.warn('PDF render', num, err);
    } finally {
      rec.rendering = false;
      rec.task = null;
    }
  }
  releasePage(num) {
    const rec = this.pages[num - 1];
    if (!rec) return;
    // conservar las páginas cercanas a la actual
    if (Math.abs(num - this.current) <= 2) return;
    try { rec.task?.cancel(); } catch {}
    rec.el.querySelector('canvas')?.remove();
    rec.el.querySelector('.textLayer')?.remove();
    rec.el.querySelector('.marks-layer')?.remove();
    rec.el.querySelector('.tts-layer')?.remove();
    rec.textDivs = null; rec.rendered = -1;
  }

  // ---------- Posición ----------
  updateCurrent(force = false) {
    const top = this.scroller.scrollTop + this.scroller.clientHeight * 0.5;
    let lo = 0, hi = this.pages.length - 1, found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.pages[mid].el.offsetTop <= top) { found = mid; lo = mid + 1; } else hi = mid - 1;
    }
    const num = found + 1;
    if (num !== this.current || force) { this.current = num; }
    this.hooks.onLocation?.(this.getLocation());
  }
  getPosition() {
    const rec = this.pages[this.current - 1];
    if (!rec) return '1:0';
    const frac = Math.max(0, Math.min(1, (this.scroller.scrollTop - rec.el.offsetTop + 8) / rec.el.offsetHeight));
    return `${this.current}:${frac.toFixed(3)}`;
  }
  getLocation() {
    const atEnd = this.scroller.scrollTop + this.scroller.clientHeight >= this.scroller.scrollHeight - 4;
    return {
      position: this.getPosition(), page: this.current, chapter: '',
      progress: atEnd ? 1 : (this.n > 1 ? (this.current - 1) / (this.n - 1) : 1),
      label: `Página ${this.current} de ${this.n}`, slider: { value: this.current, min: 1, max: this.n }, unit: this.current, atEnd,
    };
  }
  goTo(position, instant = false) {
    const [p, f] = String(position).split(':');
    const num = Math.max(1, Math.min(this.n, parseInt(p, 10) || 1));
    const rec = this.pages[num - 1];
    const y = rec.el.offsetTop + (parseFloat(f) || 0) * rec.el.offsetHeight - 8;
    this.scroller.scrollTo({ top: Math.max(0, y), behavior: instant ? 'auto' : 'auto' });
    this.current = num;
  }
  goToSlider(v) { this.goTo(`${v}:0`); }
  goToPage(num) { this.goTo(`${num}:0`); }
  next() {
    // Si la página es más alta que la pantalla, avanzar una pantalla; si no, ir a la siguiente página
    const rec = this.pages[this.current - 1];
    const bottom = rec.el.offsetTop + rec.el.offsetHeight;
    const viewBottom = this.scroller.scrollTop + this.scroller.clientHeight;
    if (bottom - viewBottom > 40) this.scroller.scrollBy({ top: this.scroller.clientHeight * 0.88 });
    else if (this.current < this.n) this.goToPage(this.current + 1);
  }
  prev() {
    const rec = this.pages[this.current - 1];
    if (this.scroller.scrollTop - rec.el.offsetTop > 40) this.scroller.scrollBy({ top: -this.scroller.clientHeight * 0.88 });
    else if (this.current > 1) this.goTo(`${this.current - 1}:0`);
  }

  // ---------- Índice ----------
  async getToc() {
    const out = [];
    let outline = null;
    try { outline = await this.doc.getOutline(); } catch {}
    const walk = (items, depth) => { for (const it of items || []) { out.push({ label: it.title, target: it.dest, depth }); walk(it.items, depth + 1); } };
    walk(outline, 0);
    return out;
  }
  async goToToc(dest) {
    try {
      const explicit = typeof dest === 'string' ? await this.doc.getDestination(dest) : dest;
      if (!explicit) return;
      const idx = typeof explicit[0] === 'object' ? await this.doc.getPageIndex(explicit[0]) : explicit[0];
      this.goToPage(idx + 1);
    } catch (e) { console.warn(e); }
  }

  // ---------- Búsqueda ----------
  async search(q, onResult, token) {
    const nq = normalize(q);
    if (!nq) return;
    for (let p = 1; p <= this.n; p++) {
      if (token.cancel) return;
      const { text } = await this.pageText(p);
      const nt = normalize(text);
      let i = nt.indexOf(nq), count = 0;
      while (i >= 0 && count < 20) {
        const a = Math.max(0, i - 50), b = Math.min(text.length, i + nq.length + 70);
        onResult({ target: { page: p, start: i, end: i + nq.length }, where: `Página ${p}`, before: text.slice(a, i), match: text.slice(i, i + nq.length), after: text.slice(i + nq.length, b) });
        i = nt.indexOf(nq, i + nq.length); count++;
      }
      if (p % 8 === 0) await new Promise(r => setTimeout(r));
    }
  }
  goToResult(t) {
    this.goToPage(t.page);
    this.flash = { page: t.page, start: t.start, end: t.end };
    const rec = this.pages[t.page - 1];
    if (rec.rendered === this.renderKey) this.drawOverlay(rec, true);
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { const f = this.flash; this.flash = null; if (f) { const r = this.pages[f.page - 1]; r && this.drawOverlay(r); } }, 4000);
  }

  // ---------- Rects de texto ----------
  rangeRects(rec, start, end) {
    const out = [];
    const t = this.texts.get(rec.num);
    if (!t || !rec.textDivs) return out;
    const base = rec.el.getBoundingClientRect();
    for (let i = 0; i < t.spans.length; i++) {
      const [a, b] = t.spans[i];
      if (b <= start) continue;
      if (a >= end) break;
      const div = rec.textDivs[i];
      const node = div?.firstChild;
      if (!node || node.nodeType !== 3) continue;
      const r = document.createRange();
      const len = node.nodeValue.length;
      r.setStart(node, Math.max(0, Math.min(len, start - a)));
      r.setEnd(node, Math.max(0, Math.min(len, end - a)));
      for (const cr of r.getClientRects()) {
        if (cr.width < 1 || cr.height < 1) continue;
        out.push({ x: cr.left - base.left, y: cr.top - base.top, w: cr.width, h: cr.height });
      }
    }
    return out;
  }

  drawOverlay(rec, scroll = false) {
    rec.el.querySelector('.tts-layer')?.remove();
    const items = [];
    if (this.ttsSentence && this.ttsSentence.page === rec.num) items.push({ ...this.ttsSentence, cls: '' });
    if (this.flash && this.flash.page === rec.num) items.push({ ...this.flash, cls: 'flash' });
    if (!items.length || rec.rendered !== this.renderKey) return;
    const layer = document.createElement('div'); layer.className = 'tts-layer';
    let first = null;
    for (const it of items) {
      for (const r of this.rangeRects(rec, it.start, it.end)) {
        const i = document.createElement('i'); if (it.cls) i.className = it.cls;
        Object.assign(i.style, { left: `${r.x - 1}px`, top: `${r.y - 1}px`, width: `${r.w + 2}px`, height: `${r.h + 2}px` });
        layer.appendChild(i);
        if (!first) first = r;
      }
    }
    rec.el.appendChild(layer);
    if (scroll && first) this.ensureVisible(rec, first);
  }
  ensureVisible(rec, r) {
    const y = rec.el.offsetTop + r.y;
    const top = this.scroller.scrollTop, h = this.scroller.clientHeight;
    if (y < top + 60 || y + r.h > top + h - 140) this.scroller.scrollTo({ top: Math.max(0, y - h * 0.3), behavior: 'smooth' });
  }

  // ---------- Selección y marcas ----------
  pageOfNode(node) { const el = (node?.nodeType === 3 ? node.parentElement : node)?.closest?.('.pdf-page'); return el && this.wrap.contains(el) ? el : null; }
  checkSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { this.hooks.onSelect?.(null); return; }
    const range = sel.getRangeAt(0);
    const pageEl = this.pageOfNode(range.startContainer);
    if (!pageEl) return;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text) { this.hooks.onSelect?.(null); return; }
    const page = +pageEl.dataset.p;
    // offset de caracteres en el texto de la página (para "escuchar desde aquí")
    let charOffset = 0;
    const rec = this.pages[page - 1];
    const t = this.texts.get(page);
    if (rec.textDivs && t) {
      const span = (range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer).closest('span');
      const idx = rec.textDivs.indexOf(span);
      if (idx >= 0) charOffset = t.spans[idx][0] + (range.startContainer.nodeType === 3 ? range.startOffset : 0);
    }
    // rects en coordenadas PDF para guardar
    const rects = [];
    for (const cr of range.getClientRects()) {
      if (cr.width < 1 || cr.height < 1) continue;
      const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      const el = document.elementsFromPoint(cx, cy).find(e => e.classList?.contains('pdf-page'));
      const pr = el ? this.pages[+el.dataset.p - 1] : rec;
      if (!pr.vp) continue;
      const b = pr.el.getBoundingClientRect();
      if (cr.width > b.width * 0.95 && cr.height > b.height * 0.5) continue;
      const [x1, y1] = pr.vp.convertToPdfPoint(cr.left - b.left, cr.top - b.top);
      const [x2, y2] = pr.vp.convertToPdfPoint(cr.right - b.left, cr.bottom - b.top);
      rects.push({ p: pr.num, r: [x1, y1, x2, y2].map(v => Math.round(v * 10) / 10) });
    }
    const frac = Math.max(0, ((range.getBoundingClientRect().top - pageEl.getBoundingClientRect().top) / pageEl.offsetHeight) - 0.05);
    this.hooks.onSelect?.({ text, page, chapter: '', position: `${page}:${frac.toFixed(3)}`, rects, charOffset });
  }
  clearSelection() { window.getSelection()?.removeAllRanges(); }

  setMarks(marks) {
    this.marks = marks.filter(m => m.rects?.length && (m.type === 'highlight' || m.type === 'note'));
    for (const rec of this.pages) if (rec.rendered === this.renderKey) this.drawMarks(rec);
  }
  drawMarks(rec) {
    rec.el.querySelector('.marks-layer')?.remove();
    if (!rec.vp) return;
    const mine = [];
    for (const m of this.marks) for (const r of m.rects) if (r.p === rec.num) mine.push([m, r.r]);
    if (!mine.length) return;
    const layer = document.createElement('div'); layer.className = 'marks-layer';
    for (const [m, r] of mine) {
      const [a, b, c, d] = rec.vp.convertToViewportRectangle(r);
      const i = document.createElement('i');
      if (m.type === 'note') i.className = 'note'; else i.style.background = m.color;
      Object.assign(i.style, { left: `${Math.min(a, c)}px`, top: `${Math.min(b, d)}px`, width: `${Math.abs(c - a)}px`, height: `${Math.abs(d - b)}px` });
      layer.appendChild(i);
    }
    rec.el.insertBefore(layer, rec.el.querySelector('.textLayer'));
  }

  // ---------- Texto a voz ----------
  ttsAdapter() {
    let page = this.current;
    const load = async (num, fromOffset = null) => {
      page = num;
      const { text } = await this.pageText(num);
      const sentences = splitSentences(text).map(s => ({ ...s, page: num }));
      let index = 0;
      if (fromOffset != null) { const i = sentences.findIndex(s => s.end > fromOffset); index = i < 0 ? 0 : i; }
      return { sentences, index };
    };
    return {
      load: async (opts = {}) => {
        if (opts.selection) return load(opts.selection.page, opts.selection.charOffset);
        // empezar en la primera frase visible de la página actual
        const rec = this.pages[this.current - 1];
        const r = await load(this.current);
        if (rec.rendered === this.renderKey && rec.textDivs) {
          const visTop = this.scroller.scrollTop - rec.el.offsetTop;
          const i = r.sentences.findIndex(s => { const rr = this.rangeRects(rec, s.start, s.end)[0]; return rr && rr.y >= visTop - 4; });
          if (i > 0) r.index = i;
        }
        return r;
      },
      next: async () => {
        if (page >= this.n) return null;
        const r = await load(page + 1);
        return r;
      },
      highlight: (s) => {
        const prev = this.ttsSentence;
        this.ttsSentence = s ? { page: s.page, start: s.start, end: s.end } : null;
        if (prev && (!s || prev.page !== s.page)) { const pr = this.pages[prev.page - 1]; pr && this.drawOverlay(pr); }
        if (!s) return;
        const rec = this.pages[s.page - 1];
        if (rec.rendered === this.renderKey) this.drawOverlay(rec, true);
        else {
          this.goToPage(s.page);
          const wait = () => { if (this.ttsSentence?.page !== s.page) return; if (rec.rendered === this.renderKey) this.drawOverlay(rec, true); else setTimeout(wait, 120); };
          setTimeout(wait, 120);
        }
      },
    };
  }

  destroy() {
    document.removeEventListener('selectionchange', this.onSelChange);
    this.io?.disconnect();
    try { this.doc?.destroy(); } catch {}
    this.scroller?.remove();
  }
}
