// Neurona — interfaz: pizarra, predicción en vivo, visualización de la red, enseñar clases nuevas y desafío.
(() => {
  const { Shapes, NN } = window;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem('neurona:' + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('neurona:' + k, JSON.stringify(v)); return true; } catch { return false; } }, del(k) { try { localStorage.removeItem('neurona:' + k); } catch {} } };
  const VERSION = 3; // cambia si se modifica el generador → reentrena

  let custom = store.get('custom', []);
  let net = null, training = false;
  const classes = () => [...Shapes.CLASSES, ...custom.map(c => ({ id: c.id, name: c.name, emoji: c.emoji || '✏️', custom: true }))];

  // =================================================================
  // PIZARRA
  // =================================================================
  function Board(canvas, onChange) {
    const ctx = canvas.getContext('2d');
    let strokes = [], cur = null, dpr = 1;
    const fit = () => { dpr = Math.min(2, devicePixelRatio || 1); const r = canvas.getBoundingClientRect(); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); redraw(); };
    const pt = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr]; };
    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(250,250,240,.95)'; ctx.lineWidth = 7 * dpr;
      ctx.shadowColor = 'rgba(255,255,255,.25)'; ctx.shadowBlur = 3 * dpr;
      for (const s of strokes.concat(cur ? [cur] : [])) {
        if (!s.length) continue; ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
        if (s.length === 1) ctx.lineTo(s[0][0] + .1, s[0][1]);
        for (let i = 1; i < s.length - 1; i++) { const mx = (s[i][0] + s[i + 1][0]) / 2, my = (s[i][1] + s[i + 1][1]) / 2; ctx.quadraticCurveTo(s[i][0], s[i][1], mx, my); }
        if (s.length > 1) ctx.lineTo(s[s.length - 1][0], s[s.length - 1][1]);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); cur = [pt(e)]; redraw(); onChange?.(api.all()); });
    canvas.addEventListener('pointermove', e => { if (!cur) return; const p = pt(e), l = cur[cur.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2 * dpr) return; cur.push(p); redraw(); onChange?.(api.all()); });
    const end = () => { if (!cur) return; strokes.push(cur); cur = null; redraw(); onChange?.(api.all(), true); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    const ro = new ResizeObserver(fit); ro.observe(canvas);
    const api = {
      all: () => strokes.concat(cur ? [cur] : []).filter(s => s.length),
      clear() { strokes = []; cur = null; redraw(); onChange?.([], true); },
      undo() { strokes.pop(); redraw(); onChange?.(api.all(), true); },
      set(s) { strokes = s; redraw(); onChange?.(api.all(), true); },
      empty: () => !api.all().length,
      destroy: () => ro.disconnect(),
    };
    fit(); return api;
  }
  // normaliza los trazos a una caja ~[-1,1] (para guardar ejemplos propios)
  function normalize(strokes) {
    const all = strokes.flat(); let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const [x, y] of all) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
    const s = Math.max(c - a, d - b, 1) / 2, cx = (a + c) / 2, cy = (b + d) / 2;
    return strokes.map(st => st.map(([x, y]) => [+((x - cx) / s).toFixed(3), +((y - cy) / s).toFixed(3)]));
  }

  // =================================================================
  // PREDICCIÓN Y VISUALIZACIÓN
  // =================================================================
  const input = new Float32Array(784);
  let last = null;
  function predict(strokes) {
    if (!net || !strokes.length) { last = null; renderPred(null); drawNet(null); return null; }
    Shapes.rasterize(strokes, input, 1.4);
    const out = Array.from(net.forward(input));
    last = { out, h1: Float32Array.from(net.acts[1]), h2: Float32Array.from(net.acts[2]), x: Float32Array.from(input) };
    renderPred(out); drawNet(last);
    return out;
  }
  function ranked(out) { const cl = classes(); return out.map((p, i) => ({ p, i, c: cl[i] })).sort((a, b) => b.p - a.p); }
  function renderPred(out) {
    const el = $('#pred');
    if (!out) { el.innerHTML = `<div class="guess idle"><span class="g-em">✏️</span><div><b>Dibujá algo en la pizarra</b><small>${net ? 'Te digo qué es mientras dibujás.' : 'Primero tengo que aprender…'}</small></div></div>`; $('#seeCv').getContext('2d').clearRect(0, 0, 28, 28); return; }
    const r = ranked(out), top = r[0];
    const sure = top.p > .85 ? 'Estoy seguro:' : top.p > .55 ? 'Creo que es…' : top.p > .3 ? 'No sé… ¿será?' : 'Ni idea. ¿Quizás?';
    const q = top.p <= .55;
    el.innerHTML = `<div class="guess ${top.p > .55 ? 'ok' : ''}"><span class="g-em">${top.c.emoji}</span><div><small>${sure}</small><b>${esc(top.c.name)}${q ? '?' : ''}</b></div><span class="g-p">${Math.round(top.p * 100)}%</span></div>
      <ul class="bars">${r.slice(0, 5).map(x => `<li class="${x === top ? 'top' : ''}"><span>${x.c.emoji} ${esc(x.c.name)}</span><i style="--w:${Math.max(.5, x.p * 100)}%"></i><b>${(x.p * 100).toFixed(x.p < .1 ? 1 : 0)}%</b></li>`).join('')}</ul>`;
    // lo que ve la red
    const c = $('#seeCv').getContext('2d'), img = c.createImageData(28, 28);
    for (let i = 0; i < 784; i++) { const v = 255 * input[i]; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  }

  // dibujo de la red: entrada → 128 → 64 → salidas
  const netCv = $('#netCv'), nctx = netCv.getContext('2d');
  function layout() {
    const r = netCv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    netCv.width = r.width * dpr; netCv.height = r.height * dpr; nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { W: r.width, H: r.height };
  }
  let netLayout = null;
  function drawNet(st) {
    if (!net) return;
    netLayout ||= layout();
    const { W, H } = netLayout, cl = classes(), K = cl.length;
    nctx.clearRect(0, 0, W, H);
    const pad = 14, colX = [pad + 40, W * .37, W * .6, W - 110];
    const grid = (n, cols, x, w) => { const rows = Math.ceil(n / cols), cw = w / cols, ch = Math.min(cw, (H - pad * 2) / rows); const y0 = (H - rows * ch) / 2; return Array.from({ length: n }, (_, i) => [x - w / 2 + (i % cols + .5) * cw, y0 + (Math.floor(i / cols) + .5) * ch, Math.min(cw, ch) * .36]); };
    const h1 = grid(128, 8, colX[1], Math.min(120, W * .2)), h2 = grid(64, 4, colX[2], Math.min(64, W * .11));
    const outY = i => H / 2 + (i - (K - 1) / 2) * Math.min(22, (H - 20) / K);
    // entrada (miniatura)
    const s = 72, ix = colX[0] - s / 2, iy = H / 2 - s / 2;
    nctx.fillStyle = '#0f2a22'; nctx.fillRect(ix - 2, iy - 2, s + 4, s + 4);
    if (st) { const cell = s / 28; for (let i = 0; i < 784; i++) if (st.x[i] > .05) { nctx.fillStyle = `rgba(245,245,230,${st.x[i]})`; nctx.fillRect(ix + (i % 28) * cell, iy + Math.floor(i / 28) * cell, cell + .3, cell + .3); } }
    nctx.strokeStyle = 'rgba(255,255,255,.15)'; nctx.strokeRect(ix - 2, iy - 2, s + 4, s + 4);
    const norm = a => { let m = 1e-6; for (const v of a) if (v > m) m = v; return m; };
    const m1 = st ? norm(st.h1) : 1, m2 = st ? norm(st.h2) : 1;
    // conexiones más fuertes que se activan
    if (st) {
      const top1 = [...st.h1].map((v, i) => [v, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 14);
      const top2 = [...st.h2].map((v, i) => [v, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 10);
      const best = st.out.indexOf(Math.max(...st.out));
      nctx.lineWidth = 1;
      for (const [v, i] of top1) { nctx.strokeStyle = `rgba(255,214,102,${.12 + .35 * v / m1})`; nctx.beginPath(); nctx.moveTo(ix + s + 2, H / 2); nctx.lineTo(h1[i][0], h1[i][1]); nctx.stroke(); }
      for (const [v1, i] of top1) for (const [v2, j] of top2) { const w = net.W[1][i * 64 + j] * v1; if (w <= 0) continue; nctx.strokeStyle = `rgba(255,214,102,${Math.min(.6, w / m2 * .9)})`; nctx.beginPath(); nctx.moveTo(h1[i][0], h1[i][1]); nctx.lineTo(h2[j][0], h2[j][1]); nctx.stroke(); }
      for (const [v, j] of top2) { const w = net.W[2][j * K + best] * v; if (w <= 0) continue; nctx.strokeStyle = `rgba(198,255,61,${Math.min(.8, .2 + w / m2)})`; nctx.lineWidth = 1.5; nctx.beginPath(); nctx.moveTo(h2[j][0], h2[j][1]); nctx.lineTo(colX[3] - 10, outY(best)); nctx.stroke(); }
    }
    const node = ([x, y, r], a) => { nctx.beginPath(); nctx.arc(x, y, r, 0, Math.PI * 2); nctx.fillStyle = a > .02 ? `rgba(255,214,102,${.25 + .75 * a})` : 'rgba(255,255,255,.08)'; nctx.fill(); };
    h1.forEach((p, i) => node(p, st ? st.h1[i] / m1 : 0)); h2.forEach((p, i) => node(p, st ? st.h2[i] / m2 : 0));
    // salidas
    nctx.font = '600 12px Inter, system-ui, sans-serif'; nctx.textBaseline = 'middle';
    cl.forEach((c, i) => {
      const p = st ? st.out[i] : 0, y = outY(i);
      nctx.beginPath(); nctx.arc(colX[3] - 10, y, 5, 0, Math.PI * 2); nctx.fillStyle = p > .02 ? `rgba(198,255,61,${.3 + .7 * p})` : 'rgba(255,255,255,.1)'; nctx.fill();
      nctx.fillStyle = p > .3 ? '#fff' : 'rgba(255,255,255,.45)'; nctx.fillText(`${c.emoji} ${c.name}`, colX[3], y);
    });
    nctx.fillStyle = 'rgba(255,255,255,.4)'; nctx.font = '600 10px Inter, system-ui, sans-serif'; nctx.textAlign = 'center';
    [['ENTRADA 28×28', colX[0]], ['128 NEURONAS', colX[1]], ['64 NEURONAS', colX[2]]].forEach(([t, x]) => nctx.fillText(t, x, H - 8));
    nctx.textAlign = 'left';
  }

  // =================================================================
  // ENTRENAMIENTO
  // =================================================================
  let worker = null;
  function train({ samples, init = null, focus = null, removeIdx = null, title, onDone }) {
    training = true; document.body.classList.add('training');
    worker?.terminate(); worker = new Worker('worker.js');
    const ov = $('#trainOv'); ov.hidden = false;
    $('#trTitle').textContent = title;
    const hist = [];
    const chart = $('#lossCv'), cctx = chart.getContext('2d');
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress') {
        $('#trBar').style.transform = `scaleX(${m.seen / m.total})`;
        $('#trSeen').textContent = `${m.seen.toLocaleString('es-AR')} dibujos vistos`;
        $('#trAcc').textContent = `${Math.round(m.acc * 100)}%`;
        if (m.loss != null) hist.push(m.loss);
        drawLoss(cctx, chart, hist);
        if (m.preview) { const c = $('#trSample').getContext('2d'), img = c.createImageData(28, 28); for (let i = 0; i < 784; i++) { const v = 255 * m.preview.x[i]; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; } c.putImageData(img, 0, 0); const cc = classes()[m.preview.y]; $('#trSampleL').textContent = cc ? `${cc.emoji} ${cc.name}` : ''; }
      } else if (m.type === 'done') {
        net = NN.unpack(m.model); netLayout = null;
        const saved = store.set('model', { v: VERSION, sig: sig(), model: m.model, acc: m.acc, ms: m.ms, when: Date.now() });
        training = false; document.body.classList.remove('training');
        $('#trAcc').textContent = `${Math.round(m.acc * 100)}%`;
        setTimeout(() => { ov.hidden = true; }, 650);
        worker.terminate(); worker = null;
        renderInfo({ acc: m.acc, ms: m.ms });
        renderFeatures(); renderCustom();
        predict(board.all());
        onDone?.(m, saved);
      }
    };
    worker.postMessage({ cmd: 'train', samples, init, focus, removeIdx, custom: custom.map(c => ({ examples: c.examples })) });
  }
  function drawLoss(ctx, cv, h) {
    const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    if (h.length < 2) return; const mx = Math.max(...h, .1);
    ctx.beginPath(); h.forEach((v, i) => { const x = i / (h.length - 1) * W, y = H - 4 - (v / mx) * (H - 8); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = '#c6ff3d'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = 'rgba(198,255,61,.12)'; ctx.fill();
  }
  const sig = () => classes().map(c => c.id).join(',');
  function renderInfo(m) {
    $('#info').innerHTML = `<b>${Math.round(m.acc * 100)}%</b> de aciertos en dibujos que nunca vio · ${classes().length} cosas aprendidas${m.ms ? ` · entrenó en ${(m.ms / 1000).toFixed(1).replace('.', ',')} s` : ''}`;
  }
  // qué aprendió la primera capa: pesos de 12 neuronas como imágenes
  function renderFeatures() {
    if (!net) return;
    const el = $('#feats'); el.innerHTML = '';
    const W = net.W[0], m = net.sizes[1];
    const energy = Array.from({ length: m }, (_, j) => { let s = 0; for (let i = 0; i < 784; i++) s += Math.abs(W[i * m + j]); return [s, j]; }).sort((a, b) => b[0] - a[0]).slice(0, 16);
    for (const [, j] of energy) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 28; const c = cv.getContext('2d'), img = c.createImageData(28, 28);
      let mx = 1e-6; for (let i = 0; i < 784; i++) mx = Math.max(mx, Math.abs(W[i * m + j]));
      for (let i = 0; i < 784; i++) { const v = W[i * m + j] / mx; img.data[i * 4] = v > 0 ? 255 * v : 0; img.data[i * 4 + 1] = v > 0 ? 200 * v : 0; img.data[i * 4 + 2] = v < 0 ? -255 * v : 0; img.data[i * 4 + 3] = 255; }
      c.putImageData(img, 0, 0); el.appendChild(cv);
    }
  }

  // =================================================================
  // ENSEÑAR ALGO NUEVO
  // =================================================================
  const EMOJIS = ['🐟', '🌲', '🍕', '🚗', '☂️', '🔑', '👓', '🎵', '🌸', '⚓', '🐱', '☕', '✏️'];
  const NEED = 6;
  function teach() {
    if (training) return;
    const ov = $('#teachOv'); ov.hidden = false;
    let examples = [], emoji = EMOJIS[0];
    ov.innerHTML = `<div class="sheet">
      <header><h2>Enseñale algo nuevo</h2><button class="icon" id="tX" aria-label="Cerrar">✕</button></header>
      <div class="t-step" id="tS1">
        <label class="fld"><span>¿Qué le vas a enseñar?</span><input id="tName" placeholder="Ej.: pez, árbol, paraguas" maxlength="18" autocomplete="off"></label>
        <div class="fld"><span>Ícono</span><div class="emos">${EMOJIS.map((e, i) => `<button data-e="${e}" class="${i ? '' : 'on'}">${e}</button>`).join('')}</div></div>
        <p class="muted">Vas a dibujarlo ${NEED} veces, cada una un poco distinta. Con eso la red aprende la idea, no un dibujo puntual.</p>
        <button class="btn primary" id="tGo">Empezar a dibujar</button>
      </div>
      <div class="t-step" id="tS2" hidden>
        <div class="t-head"><b id="tCount"></b><div class="dots" id="tDots"></div></div>
        <canvas class="board small" id="tBoard"></canvas>
        <div class="t-actions"><button class="btn ghost" id="tClr">Borrar</button><button class="btn primary" id="tSave" disabled>Guardar dibujo</button></div>
        <div class="t-thumbs" id="tThumbs"></div>
      </div>
    </div>`;
    const close = () => { tb?.destroy(); ov.hidden = true; ov.innerHTML = ''; };
    $('#tX').onclick = close;
    ov.querySelector('.emos').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; emoji = b.dataset.e; ov.querySelectorAll('.emos button').forEach(x => x.classList.toggle('on', x === b)); };
    let tb = null;
    setTimeout(() => $('#tName').focus(), 50);
    const goDraw = () => {
      const name = $('#tName').value.trim();
      if (!name) { $('#tName').focus(); $('#tName').classList.add('bad'); return; }
      if (classes().some(c => c.name.toLowerCase() === name.toLowerCase())) { toast('Ya sé reconocer eso. Probá con otra cosa.'); return; }
      $('#tS1').hidden = true; $('#tS2').hidden = false;
      tb = Board($('#tBoard'), s => { $('#tSave').disabled = !s.length; });
      const upd = () => { $('#tCount').textContent = examples.length < NEED ? `Dibujá «${name}» · ${examples.length + 1} de ${NEED}` : '¡Listo!'; $('#tDots').innerHTML = Array.from({ length: NEED }, (_, i) => `<i class="${i < examples.length ? 'on' : ''}"></i>`).join(''); };
      upd();
      $('#tClr').onclick = () => tb.clear();
      $('#tSave').onclick = () => {
        const s = tb.all(); if (!s.length) return;
        examples.push(normalize(s));
        const th = document.createElement('canvas'); th.width = th.height = 28; const c = th.getContext('2d'), img = c.createImageData(28, 28), r = Shapes.rasterize(s, undefined, 1.4);
        for (let i = 0; i < 784; i++) { img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255 * r[i]; img.data[i * 4 + 3] = 255; } c.putImageData(img, 0, 0); $('#tThumbs').appendChild(th);
        tb.clear(); upd();
        if (examples.length >= NEED) {
          const id = 'u' + Date.now().toString(36);
          custom.push({ id, name, emoji, examples });
          store.set('custom', custom);
          close();
          const cur = store.get('model', null);
          train({ samples: 4200, init: cur?.model || NN.pack(net), focus: classes().length - 1, title: `Aprendiendo «${name}»…`, onDone: m => toast(`¡Aprendí «${name}»! Dibujalo y fijate si lo reconozco.`) });
        }
      };
    };
    $('#tGo').onclick = goDraw; $('#tName').onkeydown = e => { if (e.key === 'Enter') goDraw(); };
  }
  function renderCustom() {
    const el = $('#customList');
    el.innerHTML = custom.length ? custom.map((c, i) => `<li><span>${c.emoji} ${esc(c.name)}</span><button class="link" data-forget="${i}">Olvidar</button></li>`).join('') : '<li class="muted">Todavía no le enseñaste nada propio.</li>';
  }
  $('#customList').addEventListener('click', e => {
    const b = e.target.closest('[data-forget]'); if (!b || training) return;
    const i = +b.dataset.forget, c = custom[i];
    custom.splice(i, 1); store.set('custom', custom);
    const cur = store.get('model', null);
    train({ samples: 2400, init: cur?.model || NN.pack(net), removeIdx: Shapes.CLASSES.length + i, title: `Olvidando «${c.name}»…` });
  });

  // =================================================================
  // DESAFÍO
  // =================================================================
  let game = null;
  function startGame() {
    if (training || !net) return;
    const pool = classes().map((c, i) => i).sort(() => Math.random() - .5).slice(0, 6);
    game = { round: 0, pool, score: 0, times: [], t0: 0, timer: 0 };
    document.body.classList.add('playing'); nextRound();
  }
  function nextRound() {
    clearInterval(game.timer);
    if (game.round >= game.pool.length) return endGame();
    const c = classes()[game.pool[game.round]];
    board.clear();
    $('#gamePrompt').innerHTML = `<small>Ronda ${game.round + 1} de ${game.pool.length}</small><b>Dibujá: ${c.emoji} ${esc(c.name)}</b>`;
    game.t0 = performance.now(); game.done = false;
    game.timer = setInterval(() => {
      const left = Math.max(0, 20 - (performance.now() - game.t0) / 1000);
      $('#gameTime').style.transform = `scaleX(${left / 20})`;
      if (left <= 0) { toast(`Se acabó el tiempo. No me di cuenta de que era ${c.name.toLowerCase()} 😅`); game.round++; nextRound(); }
    }, 100);
  }
  function checkGame(out) {
    if (!game || game.done || !out) return;
    const target = game.pool[game.round], r = ranked(out);
    if (r[0].i === target && r[0].p > .7) {
      game.done = true; clearInterval(game.timer);
      const t = (performance.now() - game.t0) / 1000; game.times.push(t); game.score++;
      $('#gamePrompt').innerHTML = `<b class="win">¡${r[0].c.emoji} ${esc(r[0].c.name)}! Lo adiviné en ${t.toFixed(1).replace('.', ',')} s</b>`;
      setTimeout(() => { game.round++; nextRound(); }, 1300);
    }
  }
  function endGame() {
    clearInterval(game.timer);
    const avg = game.times.length ? game.times.reduce((a, b) => a + b, 0) / game.times.length : 0;
    $('#gamePrompt').innerHTML = `<b>Adiviné ${game.score} de ${game.pool.length}</b><small>${game.score ? `en ${avg.toFixed(1).replace('.', ',')} s promedio · ` : ''}<button class="link" id="again">Jugar otra vez</button> · <button class="link" id="quit">Salir</button></small>`;
    $('#gameTime').style.transform = 'scaleX(0)';
    $('#again').onclick = startGame; $('#quit').onclick = stopGame;
    game = null;
  }
  function stopGame() { if (game) clearInterval(game.timer); game = null; document.body.classList.remove('playing'); board.clear(); }

  // =================================================================
  // ARRANQUE
  // =================================================================
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3200); }
  let raf = 0;
  const board = Board($('#board'), (strokes, ended) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { const out = predict(strokes); checkGame(out); });
    $('#hintDraw').hidden = strokes.length > 0;
  });
  $('#clear').onclick = () => board.clear();
  $('#undo').onclick = () => board.undo();
  $('#teach').onclick = teach;
  $('#play').onclick = startGame;
  $('#stopGame').onclick = stopGame;
  $('#retrain').onclick = () => { if (!training) train({ samples: 9000, title: 'Aprendiendo desde cero…' }); };
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); board.undo(); } if (e.key === 'Escape' && !$('#teachOv').hidden) $('#tX')?.click(); });
  addEventListener('resize', () => { netLayout = null; drawNet(last); });
  window.__neurona = { predict: s => predict(s), classes, get net() { return net; }, get training() { return training; }, board };

  const saved = store.get('model', null);
  if (saved && saved.v === VERSION && saved.sig === sig()) {
    net = NN.unpack(saved.model); renderInfo(saved); renderFeatures(); renderCustom(); renderPred(null); drawNet(null);
    $('#trainOv').hidden = true;
  } else {
    renderCustom(); renderPred(null);
    if (saved && saved.sig !== sig()) store.del('model');
    train({ samples: 9000, title: 'La red está aprendiendo a reconocer dibujos…' });
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
