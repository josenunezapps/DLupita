/* ZENIX AR — Núcleo Z
 * Motor de secuencia cinematográfica: fotogramas pre-renderizados sobre canvas,
 * sincronizados con el scroll mediante GSAP ScrollTrigger.
 * - Capa de previsualización (540 fotogramas en 15 hojas, ~1 MB): continuidad total.
 * - Fotogramas nítidos decodificados en Web Workers, alrededor del cabezal y hacia
 *   donde se mueve el scroll. Memoria acotada.
 * - Fundido sub-fotograma entre vecinos + inercia basada en tiempo (igual a 60/120 Hz).
 */
(() => {
  'use strict';
  const N = 540;
  const SETS = {
    d: { path: 'seq/d/', atlas: 'seq/dp/', w: 1600, h: 900, pw: 320, ph: 180, ahead: 44, behind: 16, conc: 8, workers: 3, keepAtlas: 15 },
    m: { path: 'seq/m/', atlas: 'seq/mp/', w: 720, h: 1280, pw: 180, ph: 320, ahead: 30, behind: 10, conc: 8, workers: 3, keepAtlas: 2 },
  };
  const PER = 36, ATLASES = 15, COLS = 6, START_SHARP = 120; // capítulo 1 nítido antes de mostrar
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const DBG = /[?&]debug/.test(location.search) ? (window.__zx = { paints: 0, f: 0, p: 0, n: 0, maxJump: 0, last: -1 }) : null;
  const pickSet = () => (innerWidth / innerHeight < 0.9 ? 'm' : 'd');

  /* ------------------------------------------------------------------ */
  /* Decodificación fuera del hilo principal (pool de Web Workers)        */
  /* ------------------------------------------------------------------ */
  class DecoderPool {
    constructor(n) {
      this.jobs = new Map(); this.seq = 0; this.workers = [];
      try { for (let i = 0; i < n; i++) { const w = new Worker('js/decoder.js?v=5'); w.onmessage = (e) => this.done(e.data); w.busy = 0; this.workers.push(w); } }
      catch (e) { this.workers = []; }
    }
    get capacity() { return Math.max(2, this.workers.length); }
    done({ id, bm, err }) {
      const j = this.jobs.get(id); if (!j) { bm && bm.close(); return; }
      this.jobs.delete(id); j.w && j.w.busy--;
      err ? j.reject(err) : j.resolve(bm);
    }
    decode(blob) {
      if (!this.workers.length) return createImageBitmap(blob); // respaldo: hilo principal
      const w = this.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
      const id = ++this.seq; w.busy++;
      return new Promise((resolve, reject) => { this.jobs.set(id, { resolve, reject, w }); w.postMessage({ id, blob }); });
    }
    destroy() { this.workers.forEach((w) => w.terminate()); this.jobs.clear(); }
  }

  /* ------------------------------------------------------------------ */
  /* Secuencia de dos capas:                                              */
  /*  · previsualización: los 540 fotogramas en 15 hojas (~1 MB) -> nunca */
  /*    hay huecos, la película es continua desde el primer segundo       */
  /*  · nítida: fotogramas completos decodificados alrededor del cabezal  */
  /* ------------------------------------------------------------------ */
  class Sequence {
    constructor(key) {
      this.key = key; this.cfg = SETS[key]; this.dead = false;
      this.pool = new DecoderPool(this.cfg.workers);
      this.blobs = new Array(N); this.fail = new Uint8Array(N); this.loading = new Set(); this.active = 0; this.count = 0;
      this.bmp = new Map(); this.decoding = new Set();
      this.aBlob = new Array(ATLASES); this.aBmp = new Array(ATLASES); this.aDec = new Set(); this.aLoaded = 0;
      this.cur = 0; this.dir = 1; this.onProgress = null; this.onFrame = null;
    }
    url(i) { return this.cfg.path + String(i).padStart(4, '0') + '.webp'; }
    /* --- previsualización --- */
    loadAtlases() {
      const order = Array.from({ length: ATLASES }, (_, a) => a).sort((a, b) => Math.abs(a * PER - this.cur) - Math.abs(b * PER - this.cur));
      let next = 0;
      const one = async () => {
        while (next < order.length && !this.dead) {
          const a = order[next++];
          for (let t = 0; t < 3 && !this.aBlob[a]; t++) {
            try { const r = await fetch(this.cfg.atlas + String(a).padStart(2, '0') + '.webp'); if (r.ok) this.aBlob[a] = await r.blob(); } catch (e) {}
          }
          this.aLoaded++; this.onProgress && this.onProgress(this);
          this.manageAtlases();
        }
      };
      for (let k = 0; k < 4; k++) one();
    }
    manageAtlases() {
      if (this.dead) return;
      const ca = Math.floor(this.cur / PER), keep = this.cfg.keepAtlas;
      for (let a = 0; a < ATLASES; a++) {
        const near = Math.abs(a - ca) <= keep;
        if (!near && this.aBmp[a]) { this.aBmp[a].close(); this.aBmp[a] = null; }
        if (near && this.aBlob[a] && !this.aBmp[a] && !this.aDec.has(a)) {
          this.aDec.add(a);
          this.pool.decode(this.aBlob[a]).then((bm) => {
            if (this.dead || Math.abs(a - Math.floor(this.cur / PER)) > keep + 1) { bm.close(); return; }
            this.aBmp[a] = bm; this.onFrame && this.onFrame(a * PER + PER / 2, true);
          }).catch(() => {}).finally(() => this.aDec.delete(a));
        }
      }
    }
    proxy(i) { const a = Math.floor(i / PER), bm = this.aBmp[a]; if (!bm) return null; const j = i - a * PER; return { bm, sx: (j % COLS) * this.cfg.pw, sy: Math.floor(j / COLS) * this.cfg.ph }; }
    /* --- nítida --- */
    pick() {
      let best = -1, bs = Infinity;
      for (let i = 0; i < N; i++) {
        if (this.blobs[i] || this.loading.has(i) || this.fail[i] >= 3) continue;
        const d = i - this.cur, s = d >= 0 ? d : -d * 1.6; // siempre adelante primero: la película completa se baja en segundos
        if (s < bs) { bs = s; best = i; }
      }
      return best;
    }
    pump() {
      const conc = saveData ? 2 : this.cfg.conc;
      while (!this.dead && this.active < conc) { const i = this.pick(); if (i < 0) break; this.fetchOne(i); }
    }
    async fetchOne(i) {
      this.active++; this.loading.add(i);
      try {
        const r = await fetch(this.url(i)); if (!r.ok) throw 0;
        const b = await r.blob(); if (this.dead) return;
        this.blobs[i] = b; this.count++;
        this.onProgress && this.onProgress(this);
      } catch (e) { this.fail[i]++; }
      finally { this.active--; this.loading.delete(i); if (!this.dead) { this.decodeAround(); this.pump(); } }
    }
    setHead(i, dir) {
      if (dir) this.dir = dir;
      if (i === this.cur) return;
      const moved = Math.floor(i / PER) !== Math.floor(this.cur / PER);
      this.cur = i; this.decodeAround(); if (moved) this.manageAtlases();
    }
    decodeAround() {
      if (this.dead) return;
      const { ahead, behind } = this.cfg;
      const lo = this.dir > 0 ? this.cur - behind : this.cur - ahead;
      const hi = this.dir > 0 ? this.cur + ahead : this.cur + behind;
      for (const [i, bm] of this.bmp) if (i < lo - 8 || i > hi + 8) { bm.close(); this.bmp.delete(i); }
      const cap = this.pool.capacity + 1;
      for (let d = 0; d <= Math.max(ahead, behind) && this.decoding.size < cap; d++) {
        for (const i of d === 0 ? [this.cur] : [this.cur + d * this.dir, this.cur - d * this.dir]) {
          if (i < lo || i > hi || i < 0 || i >= N || !this.blobs[i] || this.bmp.has(i) || this.decoding.has(i)) continue;
          this.decoding.add(i);
          this.pool.decode(this.blobs[i]).then((bm) => {
            if (this.dead) { bm.close(); return; }
            this.bmp.set(i, bm); this.onFrame && this.onFrame(i, false);
          }).catch(() => {}).finally(() => { this.decoding.delete(i); this.decodeAround(); });
          if (this.decoding.size >= cap) break;
        }
      }
    }
    destroy() {
      this.dead = true; this.pool.destroy();
      for (const bm of this.bmp.values()) bm.close(); this.bmp.clear();
      this.aBmp.forEach((b) => b && b.close());
    }
  }

  /* ------------------------------------------------------------------ */
  /* Canvas                                                               */
  /* ------------------------------------------------------------------ */
  const canvas = qs('#film');
  const ctx = canvas.getContext('2d', { alpha: false });
  let seq = null, fit = { x: 0, y: 0, w: 1, h: 1 }, drawnKey = '', shown = false, cvw = 0, cvh = 0;

  function resize() {
    const cfg = seq.cfg;
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    cvw = canvas.clientWidth; cvh = canvas.clientHeight;
    // nunca más píxeles que los del fotograma: menos relleno por cuadro = más FPS
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const k = Math.max(1, Math.min(dpr, Math.max(cfg.w / cw, cfg.h / ch)));
    canvas.width = Math.round(cw * k); canvas.height = Math.round(ch * k);
    const s = Math.max(canvas.width / cfg.w, canvas.height / cfg.h);
    fit = { w: cfg.w * s, h: cfg.h * s, x: (canvas.width - cfg.w * s) / 2, y: (canvas.height - cfg.h * s) / 2 };
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    drawnKey = ''; render(true);
  }

  function drawSrc(src, alpha) {
    ctx.globalAlpha = alpha;
    if (src.bm) ctx.drawImage(src.bm, src.sx, src.sy, seq.cfg.pw, seq.cfg.ph, fit.x, fit.y, fit.w, fit.h);
    else ctx.drawImage(src, fit.x, fit.y, fit.w, fit.h);
  }
  let sharpIn = 1, lastTier = 'f', lastI = -1;
  function paint(f, dt) {
    const i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1), frac = f - i0;
    const blend = frac > 0.03 ? Math.round(frac * 12) / 12 : 0;
    let a = seq.bmp.get(i0), b = null, tier = 'f';
    if (a) b = blend ? seq.bmp.get(i1) || null : null;       // nítido: si falta el vecino, sin fundido (nunca volver a borroso)
    else {
      // ¿hay un nítido a 1-2 fotogramas? retenerlo es imperceptible y evita el borroso
      for (let d = 1; d <= 2 && !a; d++) a = seq.bmp.get(i0 - d * seq.dir) || seq.bmp.get(i0 + d * seq.dir);
      if (a) tier = 'n';
      else {
        const pa = seq.proxy(i0);
        if (pa) { a = pa; b = blend ? seq.proxy(i1) : null; tier = 'p'; }
        else { for (let d = 3; d < 12 && !a; d++) a = seq.bmp.get(i0 - d * seq.dir) || seq.bmp.get(i0 + d * seq.dir); if (!a) return false; tier = 'n'; }
      }
    }
    // al pasar de borroso a nítido: fundido corto en vez de salto
    if (tier !== 'p' && lastTier === 'p') sharpIn = 0;
    if (sharpIn < 1) sharpIn = Math.min(1, sharpIn + (dt || 16) / 140);
    const key = tier + i0 + ':' + (b ? blend : 0) + ':' + sharpIn;
    if (key === drawnKey) return sharpIn < 1;
    if (sharpIn < 1 && lastI >= 0) {
      const p = seq.proxy(i0);
      if (p) { drawSrc(p, 1); drawSrc(a, sharpIn); if (b) drawSrc(b, blend * sharpIn); }
      else { drawSrc(a, 1); if (b) drawSrc(b, blend); }
    } else { drawSrc(a, 1); if (b) drawSrc(b, blend); }
    ctx.globalAlpha = 1; drawnKey = key; lastTier = tier; lastI = i0;
    if (DBG) { DBG.paints++; DBG[tier]++; if (DBG.last >= 0) DBG.maxJump = Math.max(DBG.maxJump, Math.abs(i0 - DBG.last)); DBG.last = i0; }
    if (!shown) { shown = true; canvas.classList.add('is-on'); }
    return sharpIn < 1;
  }

  /* ------------------------------------------------------------------ */
  /* Cabezal: objetivo (scroll) -> actual (inercia)                       */
  /* ------------------------------------------------------------------ */
  let target = 0, head = 0, lastHead = -1, raf = 0;
  const hudFrame = qs('#hudFrame'), railFill = qs('#railFill'), hudStatus = qs('#hudStatus'), hudChapter = qs('#hudChapter');
  const status = (f) => f < 150 ? 'SELLADO' : f < 176 ? 'INICIANDO' : f < 214 ? 'APERTURA' : f < 262 ? 'DESPLIEGUE' : f < 334 ? 'RECONFIGURACIÓN' : f < 455 ? 'ÓRBITA · SERVICIO 0' + (1 + Math.min(5, Math.floor((f - 334) / 20))) : f < 515 ? 'LIBERACIÓN' : 'MARCA ZX · EN LÍNEA';
  let lastStatus = '';

  let lastT = 0, jumpTo = false;
  function render(force) {
    const t0 = DBG ? performance.now() : 0;
    const now = performance.now(), dt = Math.min(64, lastT ? now - lastT : 16); lastT = now;
    const tau = reduced ? 1 : (seq.key === 'm' ? 70 : 95);            // ms: constante de inercia
    const diff = target - head;
    // salto directo sólo al usar el menú; el scroll siempre recorre los fotogramas intermedios
    if (jumpTo) { head = target; jumpTo = false; }
    else {
      // velocidad máxima por cuadro: en equipos lentos se reparte el recorrido en vez de saltar
      const step = diff * (1 - Math.exp(-dt / tau)), maxStep = 6 * (dt / 16.7);
      head += clamp(step, -maxStep, maxStep);
    }
    if (Math.abs(target - head) < 0.02) head = target;
    const f = clamp(head, 0, N - 1), fi = Math.round(f);
    seq.setHead(fi, diff > 0.02 ? 1 : diff < -0.02 ? -1 : 0);
    const fading = paint(f, dt);
    if (fi !== lastHead || force) {
      lastHead = fi;
      hudFrame.textContent = String(fi + 1).padStart(3, '0');
      railFill.style.transform = `scaleY(${(f / (N - 1)).toFixed(4)})`;
      const st = status(fi); if (st !== lastStatus) { hudStatus.textContent = st; lastStatus = st; }
    }
    if (DBG) { const c = performance.now() - t0; DBG.js = (DBG.js || 0) + c; DBG.calls = (DBG.calls || 0) + 1; DBG.jsMax = Math.max(DBG.jsMax || 0, c); }
    if (head !== target || fading) raf = requestAnimationFrame(() => render());
    else { raf = 0; lastT = 0; }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(() => render()); };

  /* ------------------------------------------------------------------ */
  /* Arranque                                                             */
  /* ------------------------------------------------------------------ */
  const loader = qs('#loader'), lpct = qs('#loaderPct'), lbar = qs('#loaderBar');
  let started = false;

  function startSeq(key) {
    const prev = seq;
    seq = new Sequence(key);
    if (prev) {
      // conservar lo ya descargado si se repite el mismo set
      prev.destroy();
    }
    seq.cur = Math.round(head);
    seq.onProgress = (s) => {
      let sharp = 0; for (let i = 0; i < START_SHARP; i++) if (s.blobs[i]) sharp++;
      const p = (s.aLoaded / ATLASES) * 0.35 + (sharp / START_SHARP) * 0.65;
      if (!started) { lpct.textContent = Math.round(p * 100); lbar.style.transform = `scaleX(${p})`; }
      if (!started && s.aLoaded >= ATLASES && sharp >= START_SHARP) begin();
    };
    seq.onFrame = (i, isProxy) => { if ((isProxy ? Math.abs(i - head) < PER : Math.abs(i - head) < 2.5) || !shown) { drawnKey = ''; kick(); } };
    resize();
    seq.loadAtlases();
    seq.pump();
  }

  function begin() {
    started = true;
    document.body.classList.remove('is-loading');
    loader.classList.add('is-done');
    ScrollTrigger.refresh();
    intro();
    kick();
  }

  function setupScroll() {
    gsap.registerPlugin(ScrollTrigger);
    const chapters = qsa('.chapter');
    // cada capítulo mapea su recorrido a un rango de fotogramas (continuidad total)
    chapters.forEach((sec) => {
      const f0 = +sec.dataset.f0, f1 = +sec.dataset.f1;
      ScrollTrigger.create({
        trigger: sec, start: 'top top', end: 'bottom bottom',
        onUpdate: (self) => { target = f0 + (f1 - f0) * self.progress; kick(); },
        onToggle: (self) => { if (self.isActive) { hudChapter.textContent = sec.dataset.label; navOn(sec.id); } },
      });
      // textos: cada .beat aparece/desaparece en su ventana de progreso
      const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 0.7 } });
      tl.set({}, {}, 1); // duración normalizada = 1
      qsa('.beat', sec).forEach((b) => {
        const tin = +b.dataset.in, tout = +b.dataset.out;
        const kids = b.classList.contains('stage__kicker') ? [b] : Array.from(b.children);
        const blur = false;
        if (!b.classList.contains('stage__kicker')) gsap.set(b, { autoAlpha: 1 });
        gsap.set(kids, Object.assign({ autoAlpha: 0, y: 46 }, blur ? { filter: 'blur(12px)' } : {}));
        const d = 0.055;
        tl.to(kids, Object.assign({ autoAlpha: 1, y: 0, duration: d, stagger: d * 0.25, ease: 'power3.out' }, blur ? { filter: 'blur(0px)' } : {}), Math.max(0, tin));
        if (tout < 1) tl.to(kids, Object.assign({ autoAlpha: 0, y: -34, duration: d * 0.8, stagger: d * 0.12, ease: 'power2.in' }, blur ? { filter: 'blur(10px)' } : {}), tout - d * 0.8);
        if (b.classList.contains('cta')) {
          ScrollTrigger.create({ trigger: sec, start: () => `top+=${(sec.offsetHeight - innerHeight) * tin} top`, end: 'max',
            onToggle: (self) => b.classList.toggle('is-live', self.isActive) });
        }
      });
    });
    // hero: se disuelve al empezar el recorrido
    gsap.timeline({ scrollTrigger: { trigger: '#apertura', start: 'top top', end: () => `+=${innerHeight * 1.1}`, scrub: 0.5 } })
      .to('#hero', { autoAlpha: 0, y: -60, ease: 'none' }, 0)
      .to('.hud__scroll', { autoAlpha: 0, ease: 'none' }, 0);
    // indicador de servicios
    const dots = qsa('.svc-dots li');
    ScrollTrigger.create({ trigger: '#servicios', start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { const k = Math.min(5, Math.floor(self.progress * 6)); dots.forEach((d, j) => d.classList.toggle('is-on', j === k)); } });
    // la sombra lateral se atenúa en el final
    gsap.to('.film__shade', { opacity: 0.75, scrollTrigger: { trigger: '#contacto', start: 'top top', end: 'bottom bottom', scrub: true } });
    // navegación
    qsa('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
      const sec = document.getElementById(a.dataset.jump); if (!sec) return;
      e.preventDefault();
      const extra = a.dataset.jump === 'contacto' ? (sec.offsetHeight - innerHeight) * 0.62 : a.dataset.jump === 'apertura' ? 0 : innerHeight * 0.12;
      jumpTo = true; window.scrollTo({ top: sec.offsetTop + extra, behavior: 'auto' });
    }));
  }
  const navLinks = qsa('.nav a');
  function navOn(id) { navLinks.forEach((a) => a.classList.toggle('is-on', a.dataset.jump === id)); }

  function intro() {
    if (reduced) return;
    const title = qs('.hero__title');
    qsa('.split', title).forEach((el) => {
      el.innerHTML = el.textContent.split('').map((c) => `<span class="ch">${c}</span>`).join('');
    });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero__title .ch', { yPercent: 110, opacity: 0, rotateX: -60, duration: 1.4, stagger: 0.06 }, 0.15)
      .from('.hero .eyebrow', { opacity: 0, x: -20, duration: 1 }, 0.1)
      .from('.hero__lead', { opacity: 0, y: 24, duration: 1.1 }, 0.55)
      .from('.hero__cue', { opacity: 0, y: 16, duration: 1 }, 0.8)
      .from('.top', { opacity: 0, y: -18, duration: 1 }, 0.3)
      .from('.hud > *', { opacity: 0, duration: 1.2, stagger: 0.05 }, 0.5);
  }

  function init() {
    if (!window.gsap || !window.ScrollTrigger) { document.body.classList.remove('is-loading'); loader.classList.add('is-done'); return; }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    startSeq(pickSet());
    setupScroll();
    // red de seguridad: si la red es muy lenta, mostrar igual a los 9 s
    setTimeout(() => { if (!started) begin(); }, 12000);
    let rt = 0, lw = innerWidth, lh = innerHeight;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const k = pickSet();
        // en celulares la barra del navegador cambia el alto: no recalcular por eso
        const big = Math.abs(innerWidth - lw) > 2 || Math.abs(innerHeight - lh) > 140;
        if (k !== seq.key) startSeq(k);
        else if (canvas.clientWidth !== cvw || canvas.clientHeight !== cvh) resize();
        if (big) { lw = innerWidth; lh = innerHeight; ScrollTrigger.refresh(); }
      }, 180);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { drawnKey = ''; kick(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
