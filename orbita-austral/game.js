// Órbita Austral — arcade de un toque. Canvas 2D + WebAudio, sin librerías ni imágenes.
(() => {
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  const $ = s => document.querySelector(s);
  const TAU = Math.PI * 2;
  const params = new URLSearchParams(location.search);
  const store = { get: (k, d) => { try { const v = localStorage.getItem('orbita:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('orbita:' + k, JSON.stringify(v)); } catch {} } };

  // ---------- pantalla ----------
  let W = 0, H = 0, S = 0, DPR = 1;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight; S = Math.min(W, H * 0.92);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeStars();
  }
  const R = i => S * (i ? 0.40 : 0.255);     // radios de las órbitas
  const PR = () => S * 0.026;               // radio de la nave
  const cx = () => W / 2, cy = () => H * 0.54;

  // ---------- sonido ----------
  let ac = null, master = null, muted = store.get('muted', false);
  function audio() {
    if (ac) return ac;
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
    // dron de fondo
    const d = ac.createGain(); d.gain.value = 0.05; d.connect(master);
    [55, 82.4, 110.2].forEach((f, i) => { const o = ac.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = i * 4; const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.07 + i * 0.05; lg.gain.value = 0.02; l.connect(lg).connect(d.gain); l.start(); o.connect(d); o.start(); });
    return ac;
  }
  function tone(freq, dur = 0.12, type = 'sine', vol = 0.25, slide = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur = 0.5, vol = 0.5) {
    if (!ac || muted) return;
    const len = ac.sampleRate * dur, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.setValueAtTime(2400, ac.currentTime); f.frequency.exponentialRampToValueAtTime(120, ac.currentTime + dur);
    g.gain.value = vol; s.connect(f).connect(g).connect(master); s.start();
  }
  const PENTA = [0, 2, 4, 7, 9];
  const note = n => 440 * Math.pow(2, (PENTA[n % 5] + 12 * Math.floor(n / 5) - 9) / 12);
  function setMuted(m) { muted = m; store.set('muted', m); if (master) master.gain.value = m ? 0 : 0.5; $('#mute').textContent = m ? '🔇' : '🔊'; }

  // ---------- estado ----------
  const G = window.__game = {
    mode: 'menu', bot: true, t: 0, score: 0, best: store.get('best', 0), combo: 0, comboT: 0, level: 1,
    a: -Math.PI / 2, ring: 0, rad: 0, radFrom: 0, radT: 1, omega: 1.7, shield: 0, ents: [], parts: [], floats: [],
    shake: 0, slow: 1, dead: false, deadT: 0, spawnT: 0, gemT: 0, laps: 0, lastA: 0, gems: 0, nearMiss: 0,
  };
  function reset(bot) {
    Object.assign(G, { mode: bot ? 'menu' : 'play', bot, t: 0, score: 0, combo: 0, comboT: 0, level: 1, a: -Math.PI / 2, ring: 0, radT: 1, omega: 1.7, shield: 0, ents: [], parts: [], floats: [], shake: 0, slow: 1, dead: false, deadT: 0, spawnT: 1.2, gemT: 0.6, laps: 0, gems: 0, nearMiss: 0 });
    G.rad = R(0); G.radFrom = G.rad; G.lastA = G.a;
  }

  // ---------- entrada ----------
  function flip() {
    if (G.dead) return;
    G.ring ^= 1; G.radFrom = G.rad; G.radT = 0;
    tone(G.ring ? 660 : 440, 0.09, 'triangle', 0.18, G.ring ? 1.25 : 0.8);
    burst(pos(), 6, G.ring ? '#c6ff3d' : '#7cf7ff', 0.6);
    if (!G.bot) checkNearMiss();
  }
  function onPress(e) {
    if (e.target.closest && e.target.closest('button, a')) return;
    audio(); ac?.resume?.();
    if (G.mode === 'menu') { start(); return; }
    if (G.mode === 'over') { if (G.deadT > 0.7) start(); return; }
    if (G.mode === 'play') flip();
  }
  addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; onPress(e); });
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Enter') { e.preventDefault(); onPress(e); }
    if (e.code === 'KeyM') setMuted(!muted);
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  });
  let paused = false;
  function togglePause(force) { if (G.mode !== 'play') return; paused = force ?? !paused; $('#pause').classList.toggle('on', paused); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); });

  function start() { reset(false); ui(); tone(330, 0.2, 'sine', 0.2, 2); }

  // ---------- geometría ----------
  const pos = () => [cx() + Math.cos(G.a) * G.rad, cy() + Math.sin(G.a) * G.rad];
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const entPos = e => [cx() + Math.cos(e.a) * R(e.ring), cy() + Math.sin(e.a) * R(e.ring)];

  // ---------- aparición ----------
  function spawn(dt) {
    G.spawnT -= dt; G.gemT -= dt;
    const lvl = G.level;
    if (G.spawnT <= 0) {
      const r = Math.random();
      if (lvl >= 3 && r < Math.min(0.32, 0.12 + lvl * 0.03)) {
        // compuerta: arco fijo o que gira lento en una órbita
        const ring = Math.random() < 0.5 ? 0 : 1;
        G.ents.push({ type: 'gate', ring, a: G.a + Math.PI * (0.85 + Math.random() * 0.5), span: 0.34 + Math.random() * 0.18, w: 0, spin: (Math.random() - 0.5) * 0.5 * (lvl > 5), life: 9 });
      } else {
        const ring = Math.random() < 0.5 ? 0 : 1;
        const dir = Math.random() < 0.75 ? -1 : 1; // la mayoría viene de frente
        G.ents.push({ type: 'meteor', ring, a: G.a + Math.PI * (0.9 + Math.random() * 0.45), w: dir * (0.5 + Math.random() * 0.5 + lvl * 0.06), size: 0.9 + Math.random() * 0.5, rot: Math.random() * TAU, warn: 0.7, life: 12, seed: Math.random() * 99 });
        if (lvl >= 6 && Math.random() < 0.25) { // pareja que bloquea casi todo
          G.ents.push({ type: 'meteor', ring: ring ^ 1, a: G.a + Math.PI * (1.35 + Math.random() * 0.3), w: -(0.5 + lvl * 0.05), size: 1, rot: 0, warn: 0.7, life: 12, seed: Math.random() * 99 });
        }
      }
      G.spawnT = Math.max(0.42, 1.6 - lvl * 0.12) * (0.7 + Math.random() * 0.6);
    }
    if (G.gemT <= 0) {
      const shield = !G.shield && Math.random() < 0.09 && lvl >= 2;
      G.ents.push({ type: shield ? 'shield' : 'gem', ring: Math.random() < 0.5 ? 0 : 1, a: G.a + Math.PI * (0.55 + Math.random() * 0.9), w: 0, life: 7, born: G.t });
      G.gemT = 0.9 + Math.random() * 0.9;
    }
  }

  // ---------- partículas ----------
  function burst([x, y], n, color, speed = 1, life = 0.6) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (40 + Math.random() * 160) * speed; G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, color, r: 1 + Math.random() * 2.5 }); }
  }
  function floatText(txt, [x, y], color = '#fff', big = false) { G.floats.push({ txt, x, y, life: 1, color, big }); }

  // ---------- reglas ----------
  function checkNearMiss() {
    // si acabás de salir de la órbita de un meteorito que estaba muy cerca: bonus
    for (const e of G.ents) if (e.type === 'meteor' && e.ring !== G.ring && !e.near) {
      const d = Math.abs(angDiff(e.a, G.a)) * R(e.ring);
      if (d < PR() * 4.2 && d > PR() * 1.4) { e.near = true; G.nearMiss++; add(5, pos(), '¡CERCA! +5', '#ffd166'); tone(990, 0.08, 'square', 0.08); }
    }
  }
  function add(pts, p, label, color) { G.score += pts; if (label) floatText(label, p, color); }
  function die() {
    if (G.shield) {
      G.shield = 0; G.shake = 10; burst(pos(), 30, '#7cf7ff', 1.4); tone(220, 0.35, 'sawtooth', 0.18, 0.5); floatText('¡ESCUDO!', pos(), '#7cf7ff', true);
      G.inv = 1.2; return;
    }
    G.dead = true; G.deadT = 0; G.slow = 0.25; G.shake = 22;
    burst(pos(), 70, '#c6ff3d', 2, 1.1); burst(pos(), 40, '#ff4d6d', 1.4, 0.9);
    noise(0.9, 0.7); tone(140, 0.7, 'sawtooth', 0.2, 0.3);
    if (!G.bot) {
      G.newBest = G.score > G.best;
      if (G.newBest) { G.best = G.score; store.set('best', G.best); }
      G.plays = (store.get('plays', 0) + 1); store.set('plays', G.plays);
      try { navigator.vibrate?.([40, 30, 80]); } catch {}
    }
  }

  function update(dt) {
    const sdt = dt * G.slow;
    G.t += sdt;
    if (G.dead) {
      G.deadT += dt; G.slow = Math.min(1, G.slow + dt * 0.6);
      if (G.bot && G.deadT > 1.6) reset(true);
      else if (!G.bot && G.deadT > 0.55 && G.mode === 'play') { G.mode = 'over'; ui(); }
    } else {
      // dificultad
      G.level = 1 + Math.floor(G.t / 14);
      G.omega = Math.min(3.3, 1.7 + G.t * 0.022);
      G.a += G.omega * sdt;
      // vueltas
      const da = G.a - G.lastA; if (da >= Math.PI) { G.lastA += Math.PI; G.laps++; add(1); }
      G.radT = Math.min(1, G.radT + sdt / 0.14);
      const k = 1 - Math.pow(1 - G.radT, 3);
      G.rad = G.radFrom + (R(G.ring) - G.radFrom) * k;
      if (G.comboT > 0) { G.comboT -= sdt; if (G.comboT <= 0) G.combo = 0; }
      if (G.inv) G.inv = Math.max(0, G.inv - sdt);
      spawn(sdt);
      if (G.bot) botThink();
    }
    // entidades
    const [px, py] = pos(), pr = PR();
    for (const e of G.ents) {
      e.life -= sdt; e.a += (e.w || 0) * sdt; if (e.spin) e.a += e.spin * sdt;
      if (e.warn > 0) { e.warn -= sdt; continue; }
      if (e.rot !== undefined) e.rot += sdt * 2;
      if (G.dead) continue;
      if (e.type === 'gate') {
        const on = Math.abs(G.rad - R(e.ring)) < pr * 1.6;
        if (on && Math.abs(angDiff(G.a, e.a)) < e.span / 2 + pr / R(e.ring) * 0.7 && !G.inv) { e.life = 0; die(); }
        continue;
      }
      const [ex, ey] = entPos(e), d = Math.hypot(ex - px, ey - py);
      const er = e.type === 'meteor' ? pr * 1.25 * e.size : pr * 1.2;
      if (d < er + pr * 0.85) {
        if (e.type === 'meteor') { if (!G.inv) { e.life = 0; die(); } }
        else if (e.type === 'gem') {
          e.life = 0; G.combo = Math.min(G.combo + 1, 12); G.comboT = 2.6; G.gems++;
          const pts = 10 * G.combo; add(pts, [ex, ey], `+${pts}`, '#c6ff3d');
          tone(note(G.combo + 4), 0.18, 'sine', 0.22); tone(note(G.combo + 9), 0.22, 'triangle', 0.08);
          burst([ex, ey], 14, '#c6ff3d', 0.8);
        } else if (e.type === 'shield') {
          e.life = 0; G.shield = 1; floatText('ESCUDO', [ex, ey], '#7cf7ff', true); tone(523, 0.25, 'sine', 0.2, 2); burst([ex, ey], 20, '#7cf7ff');
        }
      }
    }
    G.ents = G.ents.filter(e => e.life > 0);
    for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
    G.parts = G.parts.filter(p => p.life > 0);
    for (const f of G.floats) { f.life -= dt * 0.9; f.y -= dt * 40; }
    G.floats = G.floats.filter(f => f.life > 0);
    G.shake = Math.max(0, G.shake - dt * 40);
    // trail
    if (!G.dead) G.parts.push({ x: px, y: py, vx: 0, vy: 0, life: 0.35, max: 0.35, color: G.shield ? '#7cf7ff' : '#c6ff3d', r: pr * 0.55, trail: true });
  }

  // ---------- IA (modo demo y pruebas) ----------
  function botThink() {
    const look = 1.15, danger = [0, 0], gain = [0, 0];
    for (const e of G.ents) {
      if (e.warn > 0.25) continue;
      const rel = angDiff(e.a, G.a); // >0 adelante
      const closing = G.omega - (e.w || 0) - (e.spin || 0);
      const ahead = rel > -0.12 ? rel : rel + TAU;
      const tt = closing > 0.05 ? ahead / closing : 99;
      if (e.type === 'meteor' || e.type === 'gate') {
        const span = e.type === 'gate' ? e.span / 2 + 0.1 : 0.16;
        const hit = (ahead - span) / Math.max(0.05, closing);
        if (hit < look && ahead + span > -0.05) danger[e.ring] = Math.max(danger[e.ring], 1 - Math.max(0, hit) / look);
      } else if (tt < 1.2) gain[e.ring] += e.type === 'shield' ? 2 : 1;
    }
    const cur = G.ring, other = cur ^ 1;
    const want = danger[cur] > 0.45 && danger[other] < danger[cur] - 0.1 ? other
      : danger[other] < 0.2 && gain[other] > gain[cur] && danger[cur] < 0.6 ? other : cur;
    if (want !== cur && G.radT >= 1) flip();
  }

  // ---------- dibujo ----------

  const aur = document.createElement('canvas'), actx = aur.getContext('2d');
  function drawAurora(time) {
    const q = 4, w = Math.ceil(W / q), h = Math.ceil(H * 0.6 / q);
    if (aur.width !== w || aur.height !== h) { aur.width = w; aur.height = h; }
    actx.clearRect(0, 0, w, h);
    actx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      const base = h * (0.34 + b * 0.12), amp = h * 0.075, hgt = h * (0.34 - b * 0.05);
      const col = ['90,255,170', '160,110,255', '70,220,255'][b];
      const yAt = x => base + Math.sin(x * q * 0.005 + time * 0.00028 * (b + 1) + b * 2) * amp + Math.sin(x * q * 0.016 - time * 0.0005 + b) * amp * 0.35;
      actx.save(); actx.beginPath();
      for (let x = -4; x <= w + 4; x += 4) { const y = yAt(x) + 2; x === -4 ? actx.moveTo(x, y) : actx.lineTo(x, y); }
      for (let x = w + 4; x >= -4; x -= 4) actx.lineTo(x, yAt(x) - hgt);
      actx.closePath(); actx.clip();
      const ag = actx.createLinearGradient(0, base - hgt - amp, 0, base + amp);
      ag.addColorStop(0, `rgba(${col},0)`); ag.addColorStop(0.75, `rgba(${col},0.12)`); ag.addColorStop(1, `rgba(${col},0.26)`);
      actx.fillStyle = ag;
      for (let x = 0; x < w; x += 1.5) {
        const X = x * q;
        actx.globalAlpha = (0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(X * 0.045 + time * 0.0011 * (1 + b * 0.3) + Math.sin(X * 0.011 + b) * 3), 3)) * (0.7 + 0.3 * Math.sin(time * 0.0007 + b));
        actx.fillRect(x, 0, 1.2, h);
      }
      actx.restore();
    }
  }
  let stars = [];
  function makeStars() {
    stars = Array.from({ length: Math.round((W * H) / 2600) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), tw: Math.random() * TAU }));
  }
  function draw(time) {
    const sh = G.shake ? [(Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake] : [0, 0];
    ctx.save(); ctx.translate(sh[0], sh[1]);
    // cielo
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05060f'); g.addColorStop(0.55, '#0a0f24'); g.addColorStop(1, '#070812');
    ctx.fillStyle = g; ctx.fillRect(-30, -30, W + 60, H + 60);
    // aurora: se dibuja en un lienzo chico (¼) y se escala; queda suave y cuesta poco
    drawAurora(time);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(aur, 0, 0, W, H * 0.6);
    // estrellas
    for (const s of stars) {
      const a = 0.35 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(time * 0.002 + s.tw));
      ctx.fillStyle = `rgba(220,230,255,${a})`;
      const sx = (s.x - G.t * 6 * s.z) % W; ctx.fillRect(sx < 0 ? sx + W : sx, s.y, s.z * 1.6 + 0.4, s.z * 1.6 + 0.4);
    }
    ctx.globalCompositeOperation = 'source-over';
    const X = cx(), Y = cy();
    // órbitas
    for (let i = 0; i < 2; i++) {
      ctx.beginPath(); ctx.arc(X, Y, R(i), 0, TAU);
      ctx.strokeStyle = i === G.ring ? 'rgba(198,255,61,.32)' : 'rgba(150,170,255,.16)'; ctx.lineWidth = i === G.ring ? 2 : 1.5;
      ctx.setLineDash([3, 9]); ctx.lineDashOffset = -time * 0.01 * (i ? 1 : -1); ctx.stroke(); ctx.setLineDash([]);
    }
    // planeta
    const pr0 = S * 0.12;
    const halo = ctx.createRadialGradient(X, Y, pr0 * 0.8, X, Y, pr0 * 2.2);
    halo.addColorStop(0, 'rgba(120,90,255,.35)'); halo.addColorStop(1, 'rgba(120,90,255,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(X, Y, pr0 * 2.2, 0, TAU); ctx.fill();
    const pg = ctx.createRadialGradient(X - pr0 * 0.4, Y - pr0 * 0.5, pr0 * 0.1, X, Y, pr0);
    pg.addColorStop(0, '#8f7bff'); pg.addColorStop(0.55, '#4b2fd0'); pg.addColorStop(1, '#170d4a');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(X, Y, pr0, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(X, Y, pr0, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = pr0 * 0.09;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); const yy = Y + k * pr0 * 0.28; const off = (time * 0.012 + k * 40) % (pr0 * 2); ctx.moveTo(X - pr0 + off - pr0, yy); ctx.lineTo(X - pr0 + off + pr0 * 0.4, yy); ctx.stroke(); }
    ctx.restore();
    // puntaje grande en el planeta
    if (G.mode !== 'menu') { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = `800 ${Math.round(pr0 * 0.62)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(G.score, X, Y + 2); }
    // entidades
    for (const e of G.ents) {
      const r = R(e.ring);
      if (e.type === 'gate') {
        ctx.beginPath(); ctx.arc(X, Y, r, e.a - e.span / 2, e.a + e.span / 2);
        ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = PR() * 1.5; ctx.lineCap = 'round'; ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0; ctx.lineCap = 'butt';
        continue;
      }
      const [ex, ey] = entPos(e);
      if (e.warn > 0) { // aviso parpadeante
        if (Math.floor(e.warn * 12) % 2) { ctx.strokeStyle = 'rgba(255,77,109,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ex, ey, PR() * 1.6, 0, TAU); ctx.stroke(); }
        continue;
      }
      const fade = Math.min(1, e.life * 2);
      ctx.globalAlpha = fade;
      if (e.type === 'meteor') {
        const s = PR() * 1.25 * e.size;
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(e.rot);
        ctx.shadowColor = '#ff6b3d'; ctx.shadowBlur = 16; ctx.fillStyle = '#ff7a4d';
        ctx.beginPath(); for (let k = 0; k < 8; k++) { const ang = k / 8 * TAU, rr = s * (0.78 + 0.22 * Math.sin(e.seed + k * 2.1)); k ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(80,20,10,.45)'; ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.15, s * 0.25, 0, TAU); ctx.fill();
        ctx.restore();
      } else {
        const pulse = 1 + 0.15 * Math.sin((G.t - (e.born || 0)) * 8), s = PR() * 0.95 * pulse;
        const col = e.type === 'gem' ? '#c6ff3d' : '#7cf7ff';
        ctx.save(); ctx.translate(ex, ey); ctx.rotate(G.t * 1.5);
        ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillStyle = col;
        if (e.type === 'gem') { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.75, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.75, 0); ctx.closePath(); ctx.fill(); }
        else { ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // partículas
    ctx.globalCompositeOperation = 'lighter';
    for (const p of G.parts) {
      const a = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color; ctx.globalAlpha = p.trail ? a * 0.35 : a;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.trail ? p.r * a : p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // nave
    if (!G.dead) {
      const [px, py] = pos(), r = PR();
      if (G.inv && Math.floor(G.inv * 14) % 2) ctx.globalAlpha = 0.35;
      ctx.save(); ctx.translate(px, py); ctx.rotate(G.a + Math.PI / 2 + Math.PI / 2);
      ctx.shadowColor = '#c6ff3d'; ctx.shadowBlur = 20; ctx.fillStyle = '#eaffb0';
      ctx.beginPath(); ctx.moveTo(r * 1.25, 0); ctx.lineTo(-r * 0.9, r * 0.85); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.9, -r * 0.85); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      if (G.shield) { ctx.strokeStyle = 'rgba(124,247,255,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, r * 2 + Math.sin(G.t * 8) * 1.5, 0, TAU); ctx.stroke(); }
    }
    // textos flotantes
    for (const f of G.floats) {
      ctx.globalAlpha = Math.min(1, f.life * 1.6); ctx.fillStyle = f.color;
      ctx.font = `800 ${f.big ? 22 : 17}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(f.txt, f.x, f.y - 18);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------- interfaz ----------
  function ui() {
    $('#menu').hidden = G.mode !== 'menu';
    $('#over').hidden = G.mode !== 'over';
    $('#hud').hidden = G.mode !== 'play';
    $('#pauseBtn').style.visibility = G.mode === 'play' ? 'visible' : 'hidden';
    $('#bestMenu').textContent = G.best ? `Récord: ${G.best}` : 'Primera partida';
    if (G.mode === 'over') {
      $('#finalScore').textContent = G.score;
      $('#finalBest').textContent = G.newBest ? '¡NUEVO RÉCORD!' : `Récord: ${G.best}`;
      $('#finalBest').classList.toggle('new', !!G.newBest);
      const pl = (n, a, b) => `${n} ${n === 1 ? a : b}`, v = Math.floor(G.laps / 2);
      $('#finalStats').textContent = `${pl(G.gems, 'cristal', 'cristales')} · ${pl(v, 'vuelta', 'vueltas')} · nivel ${G.level}${G.nearMiss ? ` · ${pl(G.nearMiss, 'esquive', 'esquives')} al límite` : ''}`;
      $('#overMsg').textContent = G.score < 30 ? 'Tocá en cuanto veas el aviso rojo.' : G.score < 120 ? 'Los cristales seguidos multiplican.' : G.score < 300 ? 'Pasar pegado a un meteorito suma.' : 'Nivel austral. Pocos llegan acá.';
    }
  }
  function hud() {
    if (G.mode !== 'play') return;
    $('#lvl').textContent = `Nivel ${G.level}`;
    const c = $('#combo'); c.textContent = G.combo > 1 ? `×${G.combo}` : ''; c.classList.toggle('on', G.combo > 1);
    $('#comboBar').style.transform = `scaleX(${G.combo > 1 ? Math.max(0, G.comboT / 2.6) : 0})`;
    $('#shieldIc').classList.toggle('on', !!G.shield);
  }
  $('#retry').onclick = () => { audio(); start(); };
  $('#share').onclick = async () => {
    const text = `Hice ${G.score} puntos en Órbita Austral 🌌 ¿Me superás?`;
    const url = location.href.split('?')[0].split('#')[0];
    try { if (navigator.share) await navigator.share({ title: 'Órbita Austral', text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); flash('Copiado para compartir'); } } catch {}
  };
  $('#mute').onclick = () => setMuted(!muted);
  $('#pauseBtn').onclick = () => togglePause();
  $('#resume').onclick = () => togglePause(false);
  function flash(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 1800); }

  // ---------- bucle ----------
  let last = performance.now(), fpsAcc = 0, fpsN = 0;
  function frame(now) {
    let dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused) update(dt);
    draw(now); hud();
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', () => { resize(); G.rad = R(G.ring); G.radFrom = G.rad; });
  resize(); reset(true); setMuted(muted); ui();
  if (params.has('jugar')) start();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
