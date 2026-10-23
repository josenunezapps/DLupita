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
  const screen = $('#screen'), label = $('#phoneLabel');
  let active = null;
  function activate(step) {
    if (!desktop() || active === step) return;
    active = step;
    $$('.step').forEach(s => s.classList.toggle('on', s === step));
    const key = step.dataset.app;
    if (!frames[key]) { const f = makeFrame(step.dataset.src, step.querySelector('.num').textContent); frames[key] = f; screen.appendChild(f); }
    Object.entries(frames).forEach(([k, f]) => f.classList.toggle('show', k === key));
    label.textContent = `${step.querySelector('.num').textContent} · en vivo`;
    $('#phone').classList.remove('swap'); void $('#phone').offsetWidth; $('#phone').classList.add('swap');
  }
  const sio = new IntersectionObserver(es => {
    const vis = es.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (vis) activate(vis.target);
  }, { threshold: [.35, .6, .85], rootMargin: '-25% 0px -25% 0px' });
  $$('.step').forEach(s => sio.observe(s));
  const firstStep = $('.step');
  const initDesktop = () => { if (desktop()) { fitPhone(screen); if (!active) activate(firstStep); } };
  initDesktop();
  addEventListener('resize', () => { initDesktop(); $$('.m-screen').forEach(fitPhone); });

  // en celular: cada app tiene su teléfono y se carga al tocar (ahorra datos)
  $$('.step').forEach(step => {
    const holder = step.querySelector('.m-phone');
    holder.innerHTML = `<div class="phone small"><div class="island"></div><div class="screen m-screen"><div class="status"><span>9:41</span><i>●●● ▮</i></div><button class="tap"><span>▶</span>Tocá para probar ${step.querySelector('.num').textContent}</button></div></div>`;
    const sc = holder.querySelector('.m-screen');
    fitPhone(sc);
    sc.querySelector('.tap').onclick = () => { const f = makeFrame(step.dataset.src, step.querySelector('.num').textContent); f.classList.add('show'); sc.appendChild(f); sc.querySelector('.tap').remove(); };
  });

  // íconos y capturas de las tiendas: si no cargan, se reemplazan con algo prolijo
  $$('.st-icon').forEach(img => img.addEventListener('error', () => { const d = document.createElement('div'); d.className = 'st-icon fb'; d.textContent = img.dataset.fallback || '★'; img.replaceWith(d); }));
  $$('.shots img').forEach(img => img.addEventListener('error', () => { img.classList.add('err'); const box = img.parentElement; if (![...box.children].some(x => !x.classList.contains('err'))) box.remove(); }));
})();
