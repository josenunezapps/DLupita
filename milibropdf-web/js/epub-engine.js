// Lector EPUB con epub.js: páginas o desplazamiento, temas, tipografía, resaltados,
// búsqueda y lectura en voz alta con continuidad entre capítulos.
import { splitSentences } from './util.js';

const THEMES = {
  light: { bg: '#FBF7EF', ink: '#2B2125', link: '#7A2E56' },
  sepia: { bg: '#F3E7D0', ink: '#4A3626', link: '#7A4A24' },
  dark: { bg: '#16181C', ink: '#D8D2CB', link: '#D9B873' },
};
const FONTS = {
  literata: '"Literata", Georgia, serif',
  serif: 'Georgia, "Times New Roman", serif',
  sans: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", sans-serif',
};
const BLOCKS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD', 'TH', 'DT', 'DD', 'PRE', 'SECTION', 'ARTICLE', 'FIGCAPTION', 'TR', 'BODY']);

export class EpubEngine {
  constructor(stage, book, hooks) {
    this.kind = 'epub';
    this.stage = stage; this.book = book; this.hooks = hooks;
    this.marks = []; this.drawn = new Map(); this.paintAttrs = new Map(); this.loc = null; this.tocFlat = [];
    this.ttsCfi = null; this.settings = null;
  }

  async open(blob, startPos, s) {
    this.settings = s;
    const buf = await blob.arrayBuffer();
    this.epub = ePub(buf, {});
    await this.epub.ready;
    try { await this.epub.loaded.navigation; } catch {}
    const flat = [];
    const walk = (items, depth) => { for (const it of items || []) { flat.push({ label: (it.label || '').trim(), target: it.href, depth }); walk(it.subitems, depth + 1); } };
    walk(this.epub.navigation?.toc, 0);
    this.tocFlat = flat;
    if (this.book.locations) { try { this.epub.locations.load(this.book.locations); } catch {} }
    await this.createRendition(startPos);
    if (!this.epub.locations.length()) this.generateLocations();
  }

  async createRendition(startPos) {
    const s = this.settings;
    this.host?.remove();
    this.host = document.createElement('div'); this.host.className = 'epub-host';
    this.host.style.setProperty('--epub-margin', `${s.margin}%`);
    this.stage.appendChild(this.host);
    this.mo?.disconnect();
    let pt = 0;
    this.mo = new MutationObserver(() => { if (!pt) pt = requestAnimationFrame(() => { pt = 0; this.paint(); }); });
    this.mo.observe(this.host, { childList: true, subtree: true });
    this.zones?.forEach(z => z.remove());
    this.zones = ['l', 'r'].map(side => {
      const z = document.createElement('div'); z.className = `epub-zone ${side}`;
      z.addEventListener('click', () => (side === 'l' ? this.prev() : this.next()));
      this.stage.appendChild(z); return z;
    });
    const scrolled = s.epubFlow === 'scrolled';
    this.scrolled = scrolled;
    this.stage.closest('.reader')?.classList.toggle('scrolled', scrolled);
    this.rendition = this.epub.renderTo(this.host, scrolled
      ? { manager: 'continuous', flow: 'scrolled', width: '100%', height: '100%', allowScriptedContent: false }
      : { flow: 'paginated', width: '100%', height: '100%', spread: 'auto', minSpreadWidth: 1000, allowScriptedContent: false });

    this.rendition.hooks.content.register(contents => this.setupContents(contents));
    this.rendition.on('relocated', loc => { this.loc = loc; this.hooks.onLocation?.(this.getLocation()); });
    this.rendition.on('selected', (cfiRange, contents) => {
      let text = '';
      try { text = this.rendition.getRange(cfiRange).toString(); } catch {}
      text = text.replace(/\s+/g, ' ').trim();
      if (!text) return;
      this.selContents = contents;
      this.hooks.onSelect?.({ text, position: cfiRange, cfiRange, page: null, chapter: this.chapterOf(this.loc?.start?.href) });
    });
    this.rendition.on('click', e => {
      this.hooks.onActivity?.();
      if (e.target?.closest?.('a')) return;
      const sel = e.view?.getSelection?.();
      if (sel && !sel.isCollapsed) return;
      this.hooks.onTap?.(e);
    });
    this.rendition.on('keydown', e => this.hooks.onKey?.(e));
    this.rendition.on('markClicked', (cfi, data) => { if (data?.id) this.hooks.onMarkClick?.(data.id); });

    this.applyTheme();
    await this.rendition.display(startPos || undefined).catch(async () => { await this.rendition.display(); });
    this.redrawMarks();
  }

  // epub.js 0.3 ignora clases y estilos propios en las anotaciones: los pintamos nosotros.
  annot(type, cfi, data, attrs) {
    this.paintAttrs.set(cfi, attrs);
    const cb = data?.id ? () => this.hooks.onMarkClick?.(data.id) : undefined;
    this.rendition.annotations[type](cfi, data, cb);
    this.paint();
  }
  paint() {
    if (!this.host) return;
    for (const g of this.host.querySelectorAll('g[data-epubcfi]')) {
      const a = this.paintAttrs.get(g.getAttribute('data-epubcfi'));
      if (a) for (const [k, v] of Object.entries(a)) if (g.getAttribute(k) !== v) g.setAttribute(k, v);
    }
  }

  setupContents(contents) {
    const doc = contents.document;
    const style = doc.createElement('style'); style.id = 'mlp-style';
    doc.head.appendChild(style);
    this.styleContents(contents);
    const onSel = () => {
      clearTimeout(this.selT);
      this.selT = setTimeout(() => { const sel = contents.window.getSelection(); if (!sel || sel.isCollapsed) this.hooks.onSelect?.(null); }, 200);
    };
    doc.addEventListener('selectionchange', onSel);
    // Gestos de deslizamiento en modo páginas
    let sx = 0, sy = 0, st = 0;
    doc.addEventListener('touchstart', e => { const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); this.hooks.onActivity?.(); }, { passive: true });
    doc.addEventListener('touchend', e => {
      if (this.scrolled) return;
      const t = e.changedTouches[0]; const dx = t.clientX - sx, dy = t.clientY - sy;
      const sel = contents.window.getSelection();
      if (Date.now() - st < 600 && Math.abs(dx) > 50 && Math.abs(dy) < 60 && (!sel || sel.isCollapsed)) { dx < 0 ? this.next() : this.prev(); }
    }, { passive: true });
    doc.addEventListener('scroll', () => this.hooks.onActivity?.(), { passive: true });
  }

  styleCSS() {
    const s = this.settings; const th = THEMES[s.readerTheme] || THEMES.light;
    const font = FONTS[s.fontFamily];
    return `
      html, body { color: ${th.ink} !important; background: transparent !important; }
      body { -webkit-text-size-adjust: 100%; }
      p, li, blockquote, dd, dt, td, div, span { line-height: ${s.lineHeight} !important; }
      ${font ? `body, p, li, blockquote, div, span, td, dd, dt { font-family: ${font} !important; }` : ''}
      a, a:visited { color: ${th.link} !important; }
      ${s.readerTheme === 'dark' ? '* { color: inherit !important; background-color: transparent !important; border-color: #444 !important; } img, svg { filter: brightness(.85); }' : ''}
      ::selection { background: rgba(201, 164, 92, .38); }
      img { max-width: 100% !important; height: auto; }`;
  }
  styleContents(contents) {
    const el = contents.document.getElementById('mlp-style');
    if (el) el.textContent = this.styleCSS();
  }
  applyTheme() {
    const s = this.settings;
    this.rendition.themes.fontSize(`${s.fontSize}%`);
    this.rendition.getContents().forEach(c => this.styleContents(c));
    this.host.style.setProperty('--epub-margin', `${s.margin}%`);
  }
  async applySettings(s, changed = {}) {
    const prev = this.settings; this.settings = s;
    if (changed.epubFlow !== undefined && changed.epubFlow !== prev.epubFlow) {
      const cfi = this.loc?.start?.cfi;
      try { this.rendition.destroy(); } catch {}
      this.drawn.clear();
      await this.createRendition(cfi);
      return;
    }
    const cfi = this.loc?.start?.cfi;
    this.applyTheme();
    if ('fontSize' in changed || 'lineHeight' in changed || 'fontFamily' in changed || 'margin' in changed) {
      setTimeout(async () => { try { this.rendition.resize(); if (cfi) await this.rendition.display(cfi); } catch {} }, 60);
    }
  }
  onResize() {
    clearTimeout(this.rsT);
    this.rsT = setTimeout(() => {
      const cfi = this.loc?.start?.cfi;
      try { this.rendition.resize(); if (cfi && !this.scrolled) this.rendition.display(cfi); } catch {}
    }, 150);
  }

  async generateLocations() {
    try {
      await this.epub.locations.generate(1200);
      if (this.destroyed) return;
      this.hooks.onLocations?.(this.epub.locations.save());
      if (this.loc) this.hooks.onLocation?.(this.getLocation());
    } catch (e) { console.warn('locations', e); }
  }

  // ---------- Posición ----------
  hrefPath(h) { return String(h || '').split('#')[0].replace(/^.*?\/?([^/]+)$/, '$1'); }
  chapterOf(href) {
    if (!href) return '';
    const p = this.hrefPath(href);
    let best = '';
    for (const t of this.tocFlat) if (this.hrefPath(t.target) === p) { best = t.label; break; }
    if (!best) {
      // capítulo anterior más cercano según el orden del spine
      const idx = this.epub.spine.get(href)?.index ?? -1;
      let bi = -1;
      for (const t of this.tocFlat) { const si = this.epub.spine.get(t.target)?.index ?? -1; if (si <= idx && si > bi) { bi = si; best = t.label; } }
    }
    return best;
  }
  getLocation() {
    const loc = this.loc;
    if (!loc) return { position: null, progress: 0, label: '', chapter: '', slider: { value: 0, min: 0, max: 1000 } };
    const cfi = loc.start.cfi;
    const ready = this.epub.locations.length() > 0;
    let progress = ready ? this.epub.locations.percentageFromCfi(cfi) : (loc.start.index / Math.max(1, this.epub.spine.length));
    if (loc.atEnd) progress = 1;
    const chapter = this.chapterOf(loc.start.href);
    const d = loc.start.displayed;
    const pageInfo = !this.scrolled && d?.total ? `pág. ${d.page} de ${d.total}` : '';
    const unit = ready ? this.epub.locations.locationFromCfi(cfi) : loc.start.index * 1000 + (d?.page || 0);
    return {
      position: cfi, page: null, chapter, progress: Math.max(0, Math.min(1, progress || 0)),
      label: [chapter, pageInfo].filter(Boolean).join(' · ') || `${Math.round((progress || 0) * 100)}%`,
      slider: { value: Math.round((progress || 0) * 1000), min: 0, max: 1000, disabled: !ready }, unit, atEnd: loc.atEnd,
    };
  }
  goTo(position) { return this.rendition.display(position).catch(() => {}); }
  goToSlider(v) {
    if (!this.epub.locations.length()) return;
    const cfi = this.epub.locations.cfiFromPercentage(v / 1000);
    if (cfi) this.rendition.display(cfi);
  }
  next() { return this.rendition.next(); }
  prev() { return this.rendition.prev(); }
  zoomLabel() { return ''; }

  async getToc() { return this.tocFlat; }
  goToToc(href) { return this.rendition.display(href).catch(() => {}); }

  // ---------- Búsqueda ----------
  async search(q, onResult, token) {
    const query = q.trim();
    if (!query) return;
    for (const item of this.epub.spine.spineItems) {
      if (token.cancel) return;
      try {
        await item.load(this.epub.load.bind(this.epub));
        const res = item.find(query);
        const where = this.chapterOf(item.href) || `Sección ${item.index + 1}`;
        for (const r of res.slice(0, 30)) {
          const ex = r.excerpt || ''; const i = ex.toLowerCase().indexOf(query.toLowerCase());
          onResult({ target: r.cfi, where, before: i >= 0 ? ex.slice(0, i) : ex, match: i >= 0 ? ex.slice(i, i + query.length) : '', after: i >= 0 ? ex.slice(i + query.length) : '' });
        }
        item.unload();
      } catch (e) { console.warn(e); }
      await new Promise(r => setTimeout(r));
    }
  }
  async goToResult(cfi) {
    await this.rendition.display(cfi).catch(() => {});
    try {
      this.rendition.annotations.remove(this.flashCfi, 'highlight');
      this.flashCfi = cfi;
      this.annot('highlight', cfi, {}, { fill: '#C9A45C', 'fill-opacity': '0.55' });
      setTimeout(() => { try { this.rendition.annotations.remove(cfi, 'highlight'); } catch {} }, 3500);
    } catch {}
  }

  // ---------- Marcas ----------
  clearSelection() { this.rendition.getContents().forEach(c => c.window.getSelection()?.removeAllRanges()); }
  setMarks(marks) { this.marks = marks.filter(m => m.position && m.position.startsWith('epubcfi') && (m.type === 'highlight' || m.type === 'note')); this.redrawMarks(); }
  redrawMarks() {
    if (!this.rendition) return;
    for (const [cfi, type] of this.drawn) { try { this.rendition.annotations.remove(cfi, type); } catch {} }
    this.drawn.clear();
    for (const m of this.marks) {
      try {
        if (m.type === 'highlight') {
          this.annot('highlight', m.position, { id: m.id }, { fill: m.color, 'fill-opacity': this.settings.readerTheme === 'dark' ? '0.3' : '0.45' });
          this.drawn.set(m.position, 'highlight');
        } else {
          this.annot('underline', m.position, { id: m.id }, { stroke: this.settings.readerTheme === 'dark' ? '#D9B873' : '#7A2E56', 'stroke-opacity': '0.9', 'stroke-width': '2', fill: 'transparent' });
          this.drawn.set(m.position, 'underline');
        }
      } catch {}
    }
  }

  // ---------- Texto a voz ----------
  currentContents() {
    const idx = this.loc?.start?.index;
    const all = this.rendition.getContents();
    return all.find(c => c.sectionIndex === idx) || all[0] || null;
  }
  buildText(contents) {
    const doc = contents.document;
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement?.closest('script,style,rt,rp,noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let text = ''; const nodes = []; let prevBlock = null;
    const blockOf = el => { while (el && !BLOCKS.has(el.tagName?.toUpperCase())) el = el.parentElement; return el; };
    let n;
    while ((n = walker.nextNode())) {
      const block = blockOf(n.parentElement);
      if (prevBlock && block !== prevBlock && !/\n$/.test(text)) text += '\n';
      prevBlock = block;
      nodes.push({ node: n, start: text.length });
      text += n.nodeValue;
    }
    // frases por párrafo (los títulos sin punto final quedan como frase propia)
    const sentences = [];
    let off = 0;
    for (const para of text.split('\n')) {
      for (const s of splitSentences(para)) sentences.push({ start: off + s.start, end: off + s.end, text: s.text.replace(/\s+/g, ' ') });
      off += para.length + 1;
    }
    return { text, nodes, sentences, contents };
  }
  offsetOf(built, container, offset) {
    if (container.nodeType !== 3) {
      // primer nodo de texto dentro o después del elemento
      const el = container.childNodes[offset] || container;
      const i = built.nodes.findIndex(x => el === x.node || (el.contains && el.contains(x.node)) || (el.compareDocumentPosition(x.node) & Node.DOCUMENT_POSITION_FOLLOWING));
      return i >= 0 ? built.nodes[i].start : 0;
    }
    const i = built.nodes.findIndex(x => x.node === container);
    return i >= 0 ? built.nodes[i].start + offset : 0;
  }
  rangeFor(built, s) {
    const find = pos => {
      let lo = 0, hi = built.nodes.length - 1, f = 0;
      while (lo <= hi) { const m = (lo + hi) >> 1; if (built.nodes[m].start <= pos) { f = m; lo = m + 1; } else hi = m - 1; }
      const x = built.nodes[f]; return [x.node, Math.min(x.node.nodeValue.length, pos - x.start)];
    };
    const r = built.contents.document.createRange();
    const [a, ao] = find(s.start); const [b, bo] = find(Math.max(s.start, s.end - 1));
    r.setStart(a, ao); r.setEnd(b, Math.min(b.nodeValue.length, bo + 1));
    return r;
  }
  ttsAdapter() {
    let built = null; let sectionIndex = null;
    const loadCurrent = (startOffset) => {
      const c = this.currentContents();
      if (!c) return { sentences: [], index: 0 };
      built = this.buildText(c); sectionIndex = c.sectionIndex;
      let index = 0;
      if (startOffset != null) { const i = built.sentences.findIndex(s => s.end > startOffset); index = i < 0 ? built.sentences.length : i; }
      return { sentences: built.sentences, index };
    };
    return {
      load: async (opts = {}) => {
        if (opts.selection?.cfiRange) {
          const range = this.rendition.getRange(opts.selection.cfiRange);
          const c = this.rendition.getContents().find(x => x.document === range.startContainer.ownerDocument) || this.currentContents();
          built = this.buildText(c); sectionIndex = c.sectionIndex;
          const off = this.offsetOf(built, range.startContainer, range.startOffset);
          const i = built.sentences.findIndex(s => s.end > off);
          return { sentences: built.sentences, index: i < 0 ? 0 : i };
        }
        const cfi = this.loc?.start?.cfi;
        let off = 0;
        try {
          const r = this.rendition.getRange(cfi);
          const tmp = this.buildText(this.currentContents());
          off = this.offsetOf(tmp, r.startContainer, r.startOffset);
        } catch {}
        return loadCurrent(off);
      },
      next: async () => {
        const sec = this.epub.spine.get(sectionIndex);
        let nx = sec?.next?.();
        while (nx && nx.linear === false) nx = nx.next?.();
        if (!nx) return null;
        await this.rendition.display(nx.href);
        await new Promise(r => setTimeout(r, 80));
        const c = this.rendition.getContents().find(x => x.sectionIndex === nx.index) || this.currentContents();
        built = this.buildText(c); sectionIndex = c.sectionIndex;
        return { sentences: built.sentences, index: 0 };
      },
      highlight: (s) => {
        if (this.ttsCfi) { try { this.rendition.annotations.remove(this.ttsCfi, 'highlight'); } catch {} this.ttsCfi = null; }
        if (!s || !built) return;
        let range;
        try { range = this.rangeFor(built, s); } catch { return; }
        let cfi;
        try { cfi = built.contents.cfiFromRange(range); } catch { return; }
        this.ttsCfi = cfi;
        try { this.annot('highlight', cfi, {}, { fill: '#C9A45C', 'fill-opacity': '0.4' }); } catch {}
        this.ensureVisible(cfi, range, built.contents);
      },
    };
  }
  ensureVisible(cfi, range, contents) {
    if (this.scrolled) {
      const frame = contents.window.frameElement;
      const container = this.rendition.manager?.container;
      if (!frame || !container) return;
      const rr = range.getBoundingClientRect(); const fr = frame.getBoundingClientRect(); const cr = container.getBoundingClientRect();
      const top = fr.top + rr.top;
      if (top < cr.top + 40 || top + rr.height > cr.bottom - 160) container.scrollBy({ top: top - cr.top - cr.height * 0.3, behavior: 'smooth' });
      return;
    }
    const loc = this.loc;
    if (!loc) return;
    try {
      // compare() usa el inicio del rango; si la frase cae fuera de la página visible, pasar a esa página
      const cmp = new ePub.CFI();
      if (cmp.compare(cfi, loc.end.cfi) > 0 || cmp.compare(cfi, loc.start.cfi) < 0) this.rendition.display(cfi);
    } catch {
      this.rendition.display(cfi);
    }
  }

  destroy() {
    this.destroyed = true;
    this.mo?.disconnect();
    try { this.rendition?.destroy(); } catch {}
    try { this.epub?.destroy(); } catch {}
    this.host?.remove(); this.zones?.forEach(z => z.remove());
  }
}
