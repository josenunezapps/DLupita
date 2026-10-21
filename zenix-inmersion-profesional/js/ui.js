import { CHAPTERS } from './camera.js';
import { clamp, smooth } from './util.js';

// Capa HTML: carga, textos de cada capítulo, navegación, progreso y alternativa sin WebGL.
export class UI {
  constructor() {
    this.root = document.documentElement;
    this.scrollway = document.getElementById('scrollway');
    this.panels = [...document.querySelectorAll('.panel')];
    this.finale = document.getElementById('finale');
    this.bar = document.getElementById('progressbar');
    this.counter = document.getElementById('counter');
    this.loader = document.getElementById('loader');
    this.loaderBar = document.getElementById('loader-bar');
    this.loaderLabel = document.getElementById('loader-label');
    this.noticeEl = document.getElementById('notice');
    this.dots = [];
    // Evita repetir escrituras DOM si el resultado visual del fotograma no cambió.
    this._panelStyles = new WeakMap();
    this._finaleStyles = null;
    this._lastBarScale = null;
    this.max = 1;
    this.manual = false;
    this.buildNav();
    this.measure();
    addEventListener('scroll', () => { this._dirty = true; }, { passive: true });
    // Por si el usuario toca la barra de progreso o usa teclado tras una navegación por capítulos
    ['wheel', 'touchstart', 'keydown'].forEach((e) => addEventListener(e, () => { if (window.__zenix) window.__zenix.release(); }, { passive: true }));
  }

  buildNav() {
    const nav = document.getElementById('chapters');
    CHAPTERS.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', `Ir al capítulo ${i + 1}: ${c.name}`);
      b.innerHTML = `<span class="dot-label">${String(i + 1).padStart(2, '0')} · ${c.name}</span><span class="dot-mark"></span>`;
      b.addEventListener('click', () => this.goTo(i));
      nav.appendChild(b);
      this.dots.push(b);
    });
  }

  goTo(i) {
    const c = CHAPTERS[i];
    // Cada capítulo se abre en el punto donde su texto ya está visible
    const p = [0.0, 0.2, 0.4, 0.565, 0.725, 0.985][i];
    if (window.__zenix) window.__zenix.release();
    window.scrollTo({ top: p * this.max, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  measure() {
    this.max = Math.max(1, this.scrollway.offsetHeight - window.innerHeight);
  }

  scrollProgress() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    return clamp(y / this.max);
  }

  progress(f, label) {
    if (this.loaderBar) this.loaderBar.style.transform = `scaleX(${clamp(f)})`;
    if (this.loaderLabel && label) this.loaderLabel.textContent = label;
  }

  ready() {
    this.progress(1, 'Listo');
    this.root.classList.add('ready');
    setTimeout(() => { if (this.loader) this.loader.remove(); }, 900);
  }

  notice(msg) {
    if (!this.noticeEl) return;
    this.noticeEl.textContent = msg;
    this.noticeEl.classList.toggle('on', !!msg);
  }

  debug(msg) { console.info('[Zenix]', msg); }

  showFallback() {
    this.root.classList.add('no-webgl');
    this.root.classList.add('ready');
    if (this.loader) this.loader.remove();
    window.scrollTo(0, 0);
  }

  update(p) {
    // Textos de capítulo: ventanas de visibilidad que nunca se solapan entre sí
    for (const el of this.panels) {
      const a = +el.dataset.in, b = +el.dataset.inEnd, c = +el.dataset.out, d = +el.dataset.outEnd;
      const vin = a < 0 ? 1 : smooth(a, b, p);
      const vout = 1 - smooth(c, d, p);
      const v = vin * vout;
      const opacity = v.toFixed(3);
      const transform = `translate3d(0, ${((1 - vin) * 26 - (1 - vout) * 18).toFixed(1)}px, 0)`;
      const visibility = v > 0.01 ? 'visible' : 'hidden';
      const ariaHidden = v > 0.3 ? 'false' : 'true';
      let prev = this._panelStyles.get(el);
      if (!prev) { prev = {}; this._panelStyles.set(el, prev); }
      if (opacity !== prev.opacity) { el.style.opacity = opacity; prev.opacity = opacity; }
      if (transform !== prev.transform) { el.style.transform = transform; prev.transform = transform; }
      if (visibility !== prev.visibility) { el.style.visibility = visibility; prev.visibility = visibility; }
      if (ariaHidden !== prev.ariaHidden) { el.setAttribute('aria-hidden', ariaHidden); prev.ariaHidden = ariaHidden; }
    }
    // Cierre: título y llamado a la acción aparecen con la revelación del logo
    if (this.finale) {
      const t = smooth(0.935, 0.975, p);
      const cta = smooth(0.965, 0.995, p);
      const state = {
        opacity: t.toFixed(3),
        visibility: t > 0.01 ? 'visible' : 'hidden',
        cta: cta.toFixed(3),
        on: cta > 0.55,
      };
      const prev = this._finaleStyles || {};
      if (state.opacity !== prev.opacity) this.finale.style.opacity = state.opacity;
      if (state.visibility !== prev.visibility) this.finale.style.visibility = state.visibility;
      if (state.cta !== prev.cta) this.finale.style.setProperty('--cta', state.cta);
      if (state.on !== prev.on) this.finale.classList.toggle('cta-on', state.on);
      this._finaleStyles = state;
    }
    // Navegación y progreso
    let idx = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (p >= CHAPTERS[i].from - 1e-6) idx = i;
    if (idx !== this._idx) {
      this._idx = idx;
      this.dots.forEach((d, i) => d.classList.toggle('on', i === idx));
      if (this.counter) this.counter.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`;
      this.root.dataset.chapter = CHAPTERS[idx].id;
    }
    if (this.bar) {
      const scale = `scaleY(${p.toFixed(4)})`;
      if (scale !== this._lastBarScale) { this.bar.style.transform = scale; this._lastBarScale = scale; }
    }
  }
}
