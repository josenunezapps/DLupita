/* ZENIX AR — Núcleo Z
 * Motor de secuencia cinematográfica: fotogramas pre-renderizados sobre canvas,
 * sincronizados con el scroll mediante GSAP ScrollTrigger.
 * - Carga progresiva por prioridad (pasada gruesa de toda la película, luego relleno
 *   alrededor de la posición actual y en la dirección del scroll).
 * - Memoria acotada: sólo se mantienen decodificados (ImageBitmap) los fotogramas
 *   cercanos al cabezal; el resto queda comprimido.
 * - Interpolación entre fotogramas vecinos (fundido sub-frame) + inercia suave.
 */
(() => {
  'use strict';
  const N = 540;
  const SETS = {
    d: { path: 'seq/d/', w: 1600, h: 900, ahead: 16, behind: 6, conc: 6 },
    m: { path: 'seq/m/', w: 720, h: 1280, ahead: 12, behind: 5, conc: 5 },
  };
  const COARSE = 12;
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const canBitmap = 'createImageBitmap' in window;

  const pickSet = () => (innerWidth / innerHeight < 0.9 ? 'm' : 'd');

  /* ------------------------------------------------------------------ */
  /* Secuencia: descarga + decodificación con prioridades                 */
  /* ------------------------------------------------------------------ */
  class Sequence {
    constructor(key) {
      this.key = key; this.cfg = SETS[key];
      this.blobs = new Array(N); this.fail = new Uint8Array(N);
      this.loading = new Set(); this.active = 0; this.count = 0;
      this.bmp = new Map(); this.decoding = new Set(); this.decActive = 0;
      this.cur = 0; this.dir = 1; this.dead = false;
      this.coarse = []; for (let i = 0; i < N; i += COARSE) this.coarse.push(i);
      if (this.coarse[this.coarse.length - 1] !== N - 1) this.coarse.push(N - 1);
      this.coarseLeft = this.coarse.length;
      this.onProgress = null; this.onFrame = null;
    }
    url(i) { return this.cfg.path + String(i).padStart(4, '0') + '.webp'; }
    level(i) { return i % 12 === 0 ? 0 : i % 6 === 0 ? 1 : i % 3 === 0 ? 2 : 3; }
    has(i) { return !!this.blobs[i]; }
    pick() {
      // 1) pasada gruesa: toda la película navegable cuanto antes
      if (this.coarseLeft > 0) {
        for (const i of this.coarse) if (!this.blobs[i] && !this.loading.has(i) && this.fail[i] < 3) return i;
      }
      // 2) relleno por puntaje: cercanía al cabezal (más barato hacia adelante) + nivel
      let best = -1, bs = Infinity;
      for (let i = 0; i < N; i++) {
        if (this.blobs[i] || this.loading.has(i) || this.fail[i] >= 3) continue;
        const d = i - this.cur;
        const dist = (d * this.dir >= 0 ? Math.abs(d) * 0.55 : Math.abs(d) * 1.25);
        const s = dist + this.level(i) * 14;
        if (s < bs) { bs = s; best = i; }
      }
      return best;
    }
    pump() {
      const conc = saveData ? 2 : this.cfg.conc;
      while (!this.dead && this.active < conc) {
        const i = this.pick(); if (i < 0) break;
        this.fetchOne(i);
      }
    }
    async fetchOne(i) {
      this.active++; this.loading.add(i);
      try {
        const r = await fetch(this.url(i), { cache: 'force-cache' });
        if (!r.ok) throw new Error(r.status);
        const b = await r.blob();
        if (this.dead) return;
        this.blobs[i] = b; this.count++;
        if (this.coarse.includes(i)) this.coarseLeft--;
        this.onProgress && this.onProgress(this);
      } catch (e) {
        this.fail[i]++;
        if (this.fail[i] >= 3 && this.coarse.includes(i)) { this.coarseLeft--; this.onProgress && this.onProgress(this); }
      } finally {
        this.active--; this.loading.delete(i);
        if (!this.dead) { this.decodeAround(); this.pump(); }
      }
    }
    setHead(i, dir) {
      if (dir) this.dir = dir;
      if (i === this.cur) return;
      this.cur = i; this.decodeAround();
    }
    decodeAround() {
      if (this.dead) return;
      const { ahead, behind } = this.cfg;
      const lo = this.dir > 0 ? this.cur - behind : this.cur - ahead;
      const hi = this.dir > 0 ? this.cur + ahead : this.cur + behind;
      for (const [i, bm] of this.bmp) {
        if (i < lo - 3 || i > hi + 3) { bm.close && bm.close(); this.bmp.delete(i); }
      }
      const maxDec = 2;
      for (let d = 0; d <= Math.max(ahead, behind) && this.decActive < maxDec; d++) {
        for (const i of d === 0 ? [this.cur] : [this.cur + d * this.dir, this.cur - d * this.dir]) {
          if (i < lo || i > hi || i < 0 || i >= N) continue;
          if (this.blobs[i] && !this.bmp.has(i) && !this.decoding.has(i)) {
            this.decode(i); if (this.decActive >= maxDec) break;
          }
        }
      }
    }
    async decode(i) {
      this.decActive++; this.decoding.add(i);
      try {
        let bm;
        if (canBitmap) bm = await createImageBitmap(this.blobs[i]);
        else {
          bm = new Image(); bm.src = URL.createObjectURL(this.blobs[i]);
          await bm.decode(); bm.close = () => URL.revokeObjectURL(bm.src);
        }
        if (this.dead) { bm.close && bm.close(); return; }
        this.bmp.set(i, bm);
        this.onFrame && this.onFrame(i);
      } catch (e) { /* fotograma ilegible: se usa el vecino */ }
      finally { this.decActive--; this.decoding.delete(i); this.decodeAround(); }
    }
    nearest(i, radius = 40) {
      if (this.bmp.has(i)) return i;
      for (let d = 1; d <= radius; d++) {
        const a = i - d * this.dir, b = i + d * this.dir;
        if (this.bmp.has(a)) return a;
        if (this.bmp.has(b)) return b;
      }
      return -1;
    }
    destroy() { this.dead = true; for (const bm of this.bmp.values()) bm.close && bm.close(); this.bmp.clear(); }
  }

  /* ------------------------------------------------------------------ */
  /* Canvas                                                               */
  /* ------------------------------------------------------------------ */
  const canvas = qs('#film');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  let seq = null, fit = { x: 0, y: 0, w: 1, h: 1 }, drawn = -1, drawnBlend = -1, shown = false, cvw = 0, cvh = 0;

  function resize() {
    const cfg = seq.cfg;
    const cw = canvas.clientWidth || innerWidth, ch = canvas.clientHeight || innerHeight;
    cvw = canvas.clientWidth; cvh = canvas.clientHeight;
    // resolución útil: no tiene sentido superar ~1.25x la del fotograma
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const scaleCap = Math.max(cfg.w / cw, cfg.h / ch) * 1.25;
    const k = Math.max(1, Math.min(dpr, scaleCap));
    canvas.width = Math.round(cw * k); canvas.height = Math.round(ch * k);
    const s = Math.max(canvas.width / cfg.w, canvas.height / cfg.h);
    fit = { w: cfg.w * s, h: cfg.h * s, x: (canvas.width - cfg.w * s) / 2, y: (canvas.height - cfg.h * s) / 2 };
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    drawn = -1; render(true);
  }

  function paint(f) {
    const i0 = Math.floor(f), frac = f - i0;
    const a = seq.nearest(i0);
    if (a < 0) return false;
    const blend = a === i0 && frac > 0.04 && seq.bmp.has(i0 + 1) ? Math.round(frac * 16) / 16 : 0;
    if (a === drawn && blend === drawnBlend) return true;
    ctx.globalAlpha = 1;
    ctx.drawImage(seq.bmp.get(a), fit.x, fit.y, fit.w, fit.h);
    if (blend > 0) { ctx.globalAlpha = blend; ctx.drawImage(seq.bmp.get(i0 + 1), fit.x, fit.y, fit.w, fit.h); ctx.globalAlpha = 1; }
    drawn = a; drawnBlend = blend;
    if (!shown) { shown = true; canvas.classList.add('is-on'); }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Cabezal: objetivo (scroll) -> actual (inercia)                       */
  /* ------------------------------------------------------------------ */
  let target = 0, head = 0, lastHead = -1, raf = 0;
  const hudFrame = qs('#hudFrame'), railFill = qs('#railFill'), hudStatus = qs('#hudStatus'), hudChapter = qs('#hudChapter');
  const status = (f) => f < 150 ? 'SELLADO' : f < 176 ? 'INICIANDO' : f < 214 ? 'APERTURA' : f < 262 ? 'DESPLIEGUE' : f < 334 ? 'RECONFIGURACIÓN' : f < 455 ? 'ÓRBITA · SERVICIO 0' + (1 + Math.min(5, Math.floor((f - 334) / 20))) : f < 515 ? 'ENSAMBLAJE' : 'EN LÍNEA';
  let lastStatus = '';

  function render(force) {
    const ease = reduced ? 1 : (seq.key === 'm' ? 0.22 : 0.14);
    const diff = target - head;
    head = Math.abs(diff) > 90 ? target : head + diff * ease; // saltos largos (menú) sin barrido
    if (Math.abs(target - head) < 0.01) head = target;
    const f = clamp(head, 0, N - 1);
    const fi = Math.round(f);
    seq.setHead(fi, diff > 0.01 ? 1 : diff < -0.01 ? -1 : 0);
    paint(f);
    if (fi !== lastHead || force) {
      lastHead = fi;
      hudFrame.textContent = String(fi + 1).padStart(3, '0');
      railFill.style.transform = `scaleY(${(f / (N - 1)).toFixed(4)})`;
      const st = status(fi); if (st !== lastStatus) { hudStatus.textContent = st; lastStatus = st; }
    }
    raf = (Math.abs(target - head) > 0.005) ? requestAnimationFrame(() => render()) : 0;
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
      const p = (s.coarse.length - s.coarseLeft) / s.coarse.length;
      if (!started) { lpct.textContent = Math.round(p * 100); lbar.style.transform = `scaleX(${p})`; }
      if (!started && s.coarseLeft <= 0) begin();
    };
    seq.onFrame = (i) => { if (Math.abs(i - head) < 2.5 || drawn < 0) { drawn = -1; kick(); } };
    resize();
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
        const blur = !reduced && seq.key === 'd';
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
      window.scrollTo({ top: sec.offsetTop + extra, behavior: 'auto' });
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
    setTimeout(() => { if (!started && seq.count > 0) begin(); }, 9000);
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { drawn = -1; kick(); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
