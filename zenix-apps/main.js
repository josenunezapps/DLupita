// Interacciones de la landing: título letra por letra, revelado al hacer scroll, teléfono con apps en vivo.
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const desktop = () => matchMedia('(min-width: 961px)').matches;

  // título: cada palabra entra con un pequeño retraso
  const h1 = $('.split');
  h1.innerHTML = h1.textContent.split(' ').map((w, i) => `<span class="w"><span style="--d:${i * 70 + 120}ms">${w}</span></span>`).join(' ');
  requestAnimationFrame(() => document.body.classList.add('ready'));

  // revelado
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => io.observe(el));

  // barra de navegación
  addEventListener('scroll', () => { $('#nav').classList.toggle('solid', scrollY > 40); $('#touch').classList.toggle('gone', scrollY > 60); }, { passive: true });

  // ---------- teléfono con apps en vivo ----------
  const W = 390, H = 844;
  const frames = {};
  function makeFrame(src, title) {
    const f = document.createElement('iframe');
    f.src = src; f.title = title; f.loading = 'lazy'; f.width = W; f.height = H;
    f.setAttribute('allow', 'camera; clipboard-write');
    return f;
  }
  function fitPhone(screen) {
    if (!screen.clientWidth) return;
    const s = screen.clientWidth / W;
    screen.style.setProperty('--s', s); screen.style.height = H * s + 'px';
  }
  // cada app tiene su propio teléfono. En PC se carga sola al acercarse; en celular, al tocar (ahorra datos).
  const load = (step, sc) => {
    if (sc.querySelector('iframe')) return;
    const f = makeFrame(step.dataset.src, step.querySelector('.num').textContent); f.loading = 'eager';
    sc.appendChild(f); requestAnimationFrame(() => f.classList.add('show'));
    sc.querySelector('.tap')?.remove();
  };
  const lazy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && desktop()) { const step = e.target.closest('.step'); load(step, e.target); lazy.unobserve(e.target); }
  }), { rootMargin: '300px 0px' });
  $$('.step').forEach(step => {
    const holder = step.querySelector('.m-phone'), name = step.querySelector('.num').textContent;
    holder.innerHTML = `<div class="phone small"><div class="island"></div><div class="screen m-screen"><div class="status"><span>9:41</span><i>●●● ▮</i></div><button class="tap"><span>▶</span>Tocá para probar ${name}</button></div></div><div class="phone-label">${name} · en vivo</div>`;
    const sc = holder.querySelector('.m-screen');
    fitPhone(sc);
    sc.querySelector('.tap').onclick = () => load(step, sc);
    lazy.observe(sc);
  });
  addEventListener('resize', () => $$('.m-screen').forEach(fitPhone));

  // íconos y capturas de las tiendas: si no cargan, se reemplazan con algo prolijo
  $$('.st-icon').forEach(img => img.addEventListener('error', () => { const d = document.createElement('div'); d.className = 'st-icon fb'; d.textContent = img.dataset.fallback || '★'; img.replaceWith(d); }));
  $$('.shots img').forEach(img => img.addEventListener('error', () => { img.classList.add('err'); const box = img.parentElement; if (![...box.children].some(x => !x.classList.contains('err'))) box.remove(); }));
})();
