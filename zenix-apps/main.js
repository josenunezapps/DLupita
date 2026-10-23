// Interacciones de la landing: título letra por letra, revelado al hacer scroll, teléfono con apps en vivo.
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const desktop = () => matchMedia('(min-width: 961px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 960px), (pointer: coarse)').matches;
  // las apps viven en GitHub Pages: desde ahí (o en local) se usan rutas relativas; en zenix.com.ar, la URL completa
  const APPS = /github\.io$|^localhost$|^127\.|^$/.test(location.hostname) ? '../' : 'https://josenunezapps.github.io/DLupita/';
  $$('.step').forEach(st => { st.querySelector('.open').href = APPS + st.dataset.open; });

  // título: cada palabra entra con un pequeño retraso
  const h1 = $('.split');
  h1.innerHTML = h1.textContent.split(' ').map((w, i) => `<span class="w"><span style="--d:${i * 70 + 120}ms">${w}</span></span>`).join(' ');
  requestAnimationFrame(() => document.body.classList.add('ready'));

  // revelado
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15, rootMargin: '0px 0px -8% 0px' });
  if (reduced) $$('.reveal').forEach(el => el.classList.add('in')); else $$('.reveal').forEach(el => io.observe(el));

  // barra de navegación (una sola lectura por cuadro)
  let navQ = false;
  addEventListener('scroll', () => { if (navQ) return; navQ = true; requestAnimationFrame(() => { navQ = false; $('#nav').classList.toggle('solid', scrollY > 40); $('#touch').classList.toggle('gone', scrollY > 60); }); }, { passive: true });

  // ---------- cintas cruzadas: sentidos opuestos, aceleran con el scroll y se ondulan ----------
  // En celular se mueven más tranquilas; con "reducir movimiento" solo avanzan despacio, sin empujes ni ondas.
  (() => {
    const rows = $$('.ticker .row'); if (!rows.length) return;
    const bands = $$('.ticker .band'), tickerEl = $('.ticker');
    rows.forEach(r => { const set = r.querySelector('.set'); const need = Math.ceil((innerWidth * 1.3 * 2) / Math.max(1, set.offsetWidth)) + 1; for (let i = 0; i < need; i++) r.appendChild(set.cloneNode(true)); });
    // posiciones de cada palabra medidas una vez (no en cada cuadro)
    const measure = s => { s.w = s.r.querySelector('.set').offsetWidth; s.left = s.r.parentElement.offsetLeft + tickerEl.getBoundingClientRect().left; s.pos = s.items.map(it => ({ it, c: it.offsetLeft + it.offsetWidth / 2, h: it.offsetWidth / 2 })); };
    const st = rows.map(r => ({ r, x: 0, dir: +r.dataset.dir, items: [...r.querySelectorAll('.tk')] }));
    st.forEach(measure);
    const base = reduced ? 22 : mobile ? 48 : 70, boostMax = reduced ? 0 : mobile ? 600 : 1400, wobble = reduced ? 0 : mobile ? .5 : 1;
    let boost = 0, lastY = scrollY, last = performance.now(), hover = 1, t = 0, visible = true;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(tickerEl);
    addEventListener('scroll', () => { const d = scrollY - lastY; lastY = scrollY; if (boostMax) boost = Math.max(-boostMax, Math.min(boostMax, boost + d * (mobile ? 5 : 9))); }, { passive: true });
    tickerEl.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hover = .25; }); tickerEl.addEventListener('pointerleave', () => hover = 1);
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => st.forEach(measure), 150); });
    const cx = () => innerWidth / 2;
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      boost *= Math.pow(.04, dt);
      if (!visible || document.hidden) return;
      t += dt;
      const c = cx();
      st.forEach(s => {
        const speed = base * hover + Math.abs(boost) * .35, way = boost < -40 ? -1 : 1;
        s.x += speed * s.dir * way * dt;
        s.x = ((s.x % s.w) + s.w) % s.w - s.w;
        s.r.style.transform = `translate3d(${s.x.toFixed(1)}px,0,0)`;
        // la palabra que pasa por el centro se enciende
        for (const p of s.pos) { const on = Math.abs(s.left + s.x + p.c - c) < p.h + 30; if (on !== p.on) { p.on = on; p.it.classList.toggle('hot', on); } }
      });
      if (wobble) {
        const k = Math.max(-1, Math.min(1, boost / 900)) * wobble;
        bands[0].style.transform = `rotate(${-3.2 - k * 1.6 + Math.sin(t * .8) * .35 * wobble}deg) translateY(${Math.sin(t * 1.1) * 3 * wobble}px)`;
        bands[1].style.transform = `rotate(${2.4 + k * 1.6 + Math.sin(t * .7 + 1) * .35 * wobble}deg) translateY(${Math.cos(t * .9) * 3 * wobble}px)`;
        tickerEl.style.setProperty('--spin', `${(t * 90) % 360}deg`);
      }
    }
    requestAnimationFrame(frame);
  })();

  // ---------- teléfono con apps en vivo ----------
  const W = 390, H = 844;
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
    const f = makeFrame(APPS + step.dataset.src, step.querySelector('.num').textContent); f.loading = 'eager';
    sc.appendChild(f); requestAnimationFrame(() => f.classList.add('show'));
    sc.querySelector('.tap')?.remove();
  };
  const lazy = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting && desktop()) { const step = e.target.closest('.step'); load(step, e.target); lazy.unobserve(e.target); }
  }), { rootMargin: '300px 0px' });
  $$('.step').forEach(step => {
    const holder = step.querySelector('.m-phone'), name = step.querySelector('.num').textContent;
    holder.innerHTML = `<div class="phone small"><div class="island"></div><div class="screen m-screen"><div class="status"><span>9:41</span><i>●●● ▮</i></div><img class="preview" src="assets/preview-${step.dataset.app}.webp" alt="Vista previa de ${name}" width="585" height="1194" loading="lazy" decoding="async"><button class="tap"><span>▶</span>Tocá para probar ${name}</button></div></div><div class="phone-label">${name} · en vivo</div>`;
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
