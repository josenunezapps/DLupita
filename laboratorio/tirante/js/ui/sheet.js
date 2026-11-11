// La hoja: dibujo de la estructura sobre canvas, cámara, y todas las herramientas de edición.
import { profileOf } from '../core/catalog.js';
import { addMember, addNode, bounds, mergeNodes, nodeById, removeMember, removeNode, snap, splitMember, SUPPORTS } from '../core/model.js';
import { vehiclePoint } from '../core/analysis.js';
import { isCompact, num, reducedMotion, signed } from './dom.js';

const TAU = Math.PI * 2;

export function createSheet({ canvas, app }) {
  const ctx = canvas.getContext('2d');
  const store = app.store;
  const cam = { x: 0, y: 0, scale: 40 };
  let camTarget = null;
  let W = 1, H = 1, dpr = 1;
  let colors = {};
  let hover = { node: null, member: null, point: null };
  let pending = null;          // nudo de inicio al dibujar barras con toques sucesivos
  let gesture = null;
  const pointers = new Map();
  let pinch = null;
  let spaceDown = false;
  const shown = new Map();     // grosor y aprovechamiento mostrados (interpolados) por barra
  let last = performance.now(), clock = 0;

  // ───── Cámara ─────
  const sx = (x) => W / 2 + (x - cam.x) * cam.scale;
  const sy = (y) => H / 2 - (y - cam.y) * cam.scale;
  const toWorld = (px, py) => ({ x: cam.x + (px - W / 2) / cam.scale, y: cam.y - (py - H / 2) / cam.scale });

  function fitCamera() {
    const b = bounds(store.get().model);
    const compact = isCompact();
    const sheetOpen = compact && document.querySelector('#panel').classList.contains('open');
    const pad = sheetOpen ? { l: 70, r: 60, t: 84, b: Math.min(innerHeight * 0.52, 520) - 34 }
      : compact ? { l: 70, r: 48, t: 120, b: 120 } : { l: 150, r: 70, t: 90, b: 170 };
    const bw = Math.max(b.maxX - b.minX, 2), bh = Math.max(b.maxY - b.minY, 1.5);
    const scale = Math.min(Math.max(Math.min((W - pad.l - pad.r) / bw, (H - pad.t - pad.b) / bh), 6), 64);
    return {
      scale,
      x: (b.minX + b.maxX) / 2 - (pad.l - pad.r) / 2 / scale,
      y: (b.minY + b.maxY) / 2 - (pad.b - pad.t) / 2 / scale,
    };
  }
  function fit(animate = true) {
    const t = fitCamera();
    if (animate && !reducedMotion()) camTarget = t; else { Object.assign(cam, t); camTarget = null; }
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }

  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['sheet', 'ink', 'ink-soft', 'grid', 'grid-strong', 'tension', 'compression', 'danger', 'ok', 'neutral', 'accent', 'panel']) colors[k] = cs.getPropertyValue('--' + k).trim();
    colors.font = cs.getPropertyValue('--font').trim();
  }

  // ───── Detección de lo que hay bajo el puntero ─────
  function hitTest(px, py, touch) {
    const { model } = store.get();
    const rn = touch ? 24 : 13, rm = touch ? 15 : 8;
    let node = null, best = rn;
    for (const n of model.nodes) {
      const d = Math.hypot(sx(n.x) - px, sy(n.y) - py);
      if (d < best) { best = d; node = n; }
    }
    // Cerca del centro del nudo gana el nudo; en la zona ampliada para dedos, una barra bajo el dedo tiene prioridad.
    const nodeDist = best;
    if (node && nodeDist < 13) return { node, member: null };
    let member = null; best = rm;
    const byId = new Map(model.nodes.map((n) => [n.id, n]));
    for (const m of model.members) {
      const a = byId.get(m.a), b = byId.get(m.b);
      const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
      const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
      const d = Math.hypot(ax + t * (bx - ax) - px, ay + t * (by - ay) - py);
      if (d < best) { best = d; member = m; }
    }
    return member && (!node || best < nodeDist * 0.6) ? { node: null, member } : { node, member: null };
  }

  const snapped = (w, free = false) => {
    const { settings } = store.get().model;
    if (free || !settings.snap) return { x: Math.round(w.x * 100) / 100, y: Math.round(w.y * 100) / 100 };
    return { x: snap(w.x, settings.grid), y: snap(w.y, settings.grid) };
  };

  // ───── Acciones de edición ─────
  const select = (nodes, members, additive = false) => {
    const cur = store.get().sel;
    if (additive) {
      const toggle = (list, ids) => { const s = new Set(list); ids.forEach((id) => (s.has(id) ? s.delete(id) : s.add(id))); return [...s]; };
      store.set({ sel: { nodes: toggle(cur.nodes, nodes), members: toggle(cur.members, members) } });
    } else store.set({ sel: { nodes, members } });
  };

  function createMember(fromRef, toRef) {
    let made = null;
    store.mutate((m) => {
      const a = typeof fromRef === 'string' ? nodeById(m, fromRef) : addNode(m, fromRef.x, fromRef.y);
      const b = typeof toRef === 'string' ? nodeById(m, toRef) : addNode(m, toRef.x, toRef.y);
      if (!a || !b || a.id === b.id) return false;
      made = { member: addMember(m, a.id, b.id), end: b.id, start: a.id };
      if (!made.member && typeof fromRef === 'string' && typeof toRef === 'string') return false;
    }, { label: 'dibujar barra' });
    return made;
  }

  function tap(p, hit, e) {
    const { tool } = store.get();
    const w = snapped(toWorld(p.x, p.y), e.altKey);
    if (tool === 'select') {
      if (hit.node) select([hit.node.id], [], e.shiftKey);
      else if (hit.member) select([], [hit.member.id], e.shiftKey);
      else if (!e.shiftKey) select([], []);
    } else if (tool === 'node') {
      if (hit.node) return select([hit.node.id], []);
      let id = null;
      store.mutate((m) => { id = (hit.member ? splitMember(m, hit.member.id, w.x, w.y) : addNode(m, w.x, w.y))?.id; }, { label: hit.member ? 'partir barra' : 'agregar nudo' });
      if (id) select([id], []);
    } else if (tool === 'member') {
      const ref = hit.node ? hit.node.id : w;
      if (pending == null) {
        if (typeof ref !== 'string') { let id; store.mutate((m) => { id = addNode(m, w.x, w.y).id; }, { label: 'agregar nudo' }); pending = id; }
        else pending = ref;
      } else if (ref === pending) pending = null;
      else { const made = createMember(pending, ref); pending = made ? made.end : (typeof ref === 'string' ? ref : pending); }
    } else if (tool === 'support' && hit.node) {
      const id = hit.node.id;
      store.mutate((m) => { const n = nodeById(m, id); const order = [null, ...SUPPORTS]; n.support = order[(order.indexOf(n.support) + 1) % order.length]; }, { label: 'cambiar apoyo' });
      select([id], []);
    } else if (tool === 'load' && hit.node) {
      const id = hit.node.id;
      if (!hit.node.load) store.mutate((m) => { nodeById(m, id).load = { fx: 0, fy: -50 }; }, { label: 'agregar carga' });
      select([id], []);
      app.showTab?.('sel');
    } else if (tool === 'erase') {
      if (hit.node) store.mutate((m) => removeNode(m, hit.node.id), { label: 'borrar nudo' });
      else if (hit.member) store.mutate((m) => removeMember(m, hit.member.id), { label: 'borrar barra' });
      if (hit.node || hit.member) select([], []);
    }
  }

  // ───── Puntero ─────
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  canvas.addEventListener('pointerdown', (e) => {
    if (app.test) return;
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      if (gesture?.type === 'dragNode' && gesture.started) { store.commit(); }
      gesture = null;
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    const touch = e.pointerType !== 'mouse';
    const hit = hitTest(p.x, p.y, touch);
    const { tool } = store.get();
    gesture = { start: p, last: p, hit, moved: false, type: 'tap', touch };
    camTarget = null;
    if (e.button === 1 || e.button === 2 || spaceDown) gesture.type = 'pan';
    else if ((tool === 'select' || tool === 'node') && hit.node) gesture.type = 'dragNode';
    else if (tool === 'member') gesture.type = 'draw', gesture.from = hit.node ? hit.node.id : snapped(toWorld(p.x, p.y), e.altKey);
    else if (!hit.node && !hit.member) gesture.type = tool === 'select' ? 'pan' : 'tapOrPan';
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      zoomAt(pinch.mx, pinch.my, d / (pinch.d || 1));
      cam.x -= (mx - pinch.mx) / cam.scale; cam.y += (my - pinch.my) / cam.scale;
      pinch = { d, mx, my };
      return;
    }
    if (!gesture) {
      if (e.pointerType === 'mouse' && !app.test) {
        const hit = hitTest(p.x, p.y, false);
        hover = { node: hit.node?.id || null, member: hit.member?.id || null, point: p };
        const { tool } = store.get();
        canvas.style.cursor = tool === 'select' ? (hit.node ? 'grab' : hit.member ? 'pointer' : 'default') : tool === 'erase' ? (hit.node || hit.member ? 'pointer' : 'default') : 'crosshair';
      }
      return;
    }
    const dx = p.x - gesture.last.x, dy = p.y - gesture.last.y;
    if (!gesture.moved && Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y) > (gesture.touch ? 9 : 4)) gesture.moved = true;
    gesture.last = p;
    hover.point = p;
    if (!gesture.moved) return;
    if (gesture.type === 'pan' || gesture.type === 'tapOrPan') {
      gesture.type = 'pan';
      cam.x -= dx / cam.scale; cam.y += dy / cam.scale;
      canvas.style.cursor = 'grabbing';
    } else if (gesture.type === 'dragNode') {
      const id = gesture.hit.node.id;
      if (!gesture.started) { gesture.started = true; store.begin('mover nudo'); select([id], []); canvas.style.cursor = 'grabbing'; }
      const w = snapped(toWorld(p.x, p.y), e.altKey);
      const n = nodeById(store.get().model, id);
      if (n && (n.x !== w.x || n.y !== w.y)) store.mutate((m) => { const k = nodeById(m, id); k.x = w.x; k.y = w.y; }, { record: false });
      const over = hitTestExcluding(p, id, gesture.touch);
      gesture.mergeInto = over;
    }
  });

  function hitTestExcluding(p, id, touch) {
    const r = touch ? 20 : 12;
    for (const n of store.get().model.nodes) if (n.id !== id && Math.hypot(sx(n.x) - p.x, sy(n.y) - p.y) < r) return n.id;
    return null;
  }

  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    const g = gesture; gesture = null;
    if (!g) return;
    const p = local(e);
    canvas.style.cursor = '';
    if (e.type === 'pointercancel') { if (g.started) store.commit(); return; }
    if (g.type === 'dragNode' && g.started) {
      const id = g.hit.node.id;
      if (g.mergeInto) {
        store.mutate((m) => mergeNodes(m, id, g.mergeInto), { record: false });
        select([g.mergeInto], []);
        app.toast?.('Nudos unidos');
      }
      store.commit();
    } else if (g.type === 'draw' && g.moved) {
      const hit = hitTest(p.x, p.y, g.touch);
      const to = hit.node ? hit.node.id : snapped(toWorld(p.x, p.y), e.altKey);
      const made = createMember(g.from, to);
      pending = null;
      if (made?.member) select([], [made.member.id]);
    } else if (!g.moved || g.type === 'tapOrPan') tap(g.start, g.hit, e);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => { if (!gesture) hover = { node: null, member: null, point: null }; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function zoomAt(px, py, factor) {
    const before = toWorld(px, py);
    cam.scale = Math.min(400, Math.max(4, cam.scale * factor));
    const after = toWorld(px, py);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
    camTarget = null;
  }
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)));
  }, { passive: false });

  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && document.activeElement === canvas) { spaceDown = true; e.preventDefault(); } });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

  // ───── Dibujo ─────
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  function text(str, x, y, { size = 12, color = colors.ink, align = 'center', halo = true, weight = 400 } = {}) {
    ctx.font = `${weight} ${size}px ${colors.font}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (halo) { ctx.lineWidth = 4; ctx.strokeStyle = colors.sheet; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }
  function arrow(x1, y1, x2, y2, color, width = 2.2) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 9;
    ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
    line(x1, y1, x2 - Math.cos(a) * h * 0.8, y2 - Math.sin(a) * h * 0.8);
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(a - 0.42) * h, y2 - Math.sin(a - 0.42) * h);
    ctx.lineTo(x2 - Math.cos(a + 0.42) * h, y2 - Math.sin(a + 0.42) * h);
    ctx.closePath(); ctx.fill();
  }

  function drawGrid(grid) {
    const step = grid * ([1, 2, 5, 10, 20, 50, 100, 200].find((k) => grid * k * cam.scale >= 11) || 500);
    const major = step * 5;
    const a = toWorld(0, H), b = toWorld(W, 0);
    ctx.lineWidth = 1;
    for (const [s, color] of [[step, colors.grid], [major, colors['grid-strong']]]) {
      ctx.strokeStyle = color; ctx.beginPath();
      for (let x = Math.floor(a.x / s) * s; x <= b.x; x += s) { const px = Math.round(sx(x)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, H); }
      for (let y = Math.floor(a.y / s) * s; y <= b.y; y += s) { const py = Math.round(sy(y)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(W, py); }
      ctx.stroke();
    }
  }

  function drawSupport(x, y, kind) {
    ctx.save(); ctx.translate(x, y);
    if (kind === 'rollerY') ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = colors.ink; ctx.fillStyle = colors.sheet; ctx.lineWidth = 1.8; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(13, 24); ctx.lineTo(-13, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    let base = 24;
    if (kind !== 'pin') {
      for (const cx of [-7, 7]) { ctx.beginPath(); ctx.arc(cx, 28.5, 3.6, 0, TAU); ctx.stroke(); }
      base = 33;
    }
    line(-18, base, 18, base);
    ctx.lineWidth = 1; ctx.strokeStyle = colors['ink-soft'];
    for (let i = -16; i <= 16; i += 6.4) line(i, base, i - 5, base + 6);
    ctx.restore();
  }

  function drawTruck(x, y, P) {
    ctx.save(); ctx.translate(x, y - 5);
    ctx.fillStyle = colors.accent; ctx.strokeStyle = colors.sheet; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-22, -6); ctx.lineTo(-22, -22); ctx.lineTo(6, -22); ctx.lineTo(6, -17); ctx.lineTo(15, -17); ctx.lineTo(22, -11); ctx.lineTo(22, -6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.ink;
    for (const wx of [-13, 13]) { ctx.beginPath(); ctx.arc(wx, -4, 5, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    text(`${num(P)} kN`, x, y - 40, { size: 12.5, color: colors.accent });
  }

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    if (canvas.hidden) return;
    if (camTarget) {
      const k = 1 - Math.exp(-dt * 9);
      cam.x += (camTarget.x - cam.x) * k; cam.y += (camTarget.y - cam.y) * k; cam.scale += (camTarget.scale - cam.scale) * k;
      if (Math.abs(camTarget.scale - cam.scale) < 0.01 && Math.abs(camTarget.x - cam.x) < 0.002) { Object.assign(cam, camTarget); camTarget = null; }
    }
    const state = store.get(), { model, sel, view, tool } = state;
    const res = app.results, test = app.test;
    const ok = !!res?.ok, calm = reducedMotion();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawGrid(model.settings.grid);

    const b = bounds(model);
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
    const idx = new Map(model.nodes.map((n, i) => [n.id, i]));

    // Posición en pantalla de cada nudo según el estado (reposo, mecanismo oscilando, derrumbe)
    let pos;
    if (test?.sim) pos = test.sim.particles.map((p) => [sx(p.x), sy(p.y)]);
    else if (!ok && res?.mode && !calm) {
      const amp = 0.07 * span * Math.sin(clock * 2.6);
      pos = model.nodes.map((n, i) => [sx(n.x + res.mode[2 * i] * amp), sy(n.y + res.mode[2 * i + 1] * amp)]);
    } else pos = model.nodes.map((n) => [sx(n.x), sy(n.y)]);
    const P = (id) => pos[idx.get(id)];

    // Cotas generales, como en un plano
    if (!b.empty && model.members.length && !test) {
      const y0 = sy(b.minY) + 62, x1 = sx(b.minX), x2 = sx(b.maxX);
      if (x2 - x1 > 70) {
        ctx.strokeStyle = colors['ink-soft']; ctx.lineWidth = 1;
        line(x1, y0, x2, y0); line(x1, y0 - 7, x1, y0 + 7); line(x2, y0 - 7, x2, y0 + 7);
        line(x1 - 4, y0 + 4, x1 + 4, y0 - 4); line(x2 - 4, y0 + 4, x2 + 4, y0 - 4);
        text(`${num(b.maxX - b.minX, 2)} m`, (x1 + x2) / 2, y0, { color: colors['ink-soft'], size: 12.5 });
      }
      const yTop = sy(b.maxY), yBot = sy(b.minY), xd = sx(b.maxX) + 40;
      if (yBot - yTop > 70) {
        ctx.strokeStyle = colors['ink-soft']; ctx.lineWidth = 1;
        line(xd, yTop, xd, yBot); line(xd - 7, yTop, xd + 7, yTop); line(xd - 7, yBot, xd + 7, yBot);
        ctx.save(); ctx.translate(xd, (yTop + yBot) / 2); ctx.rotate(-Math.PI / 2);
        text(`${num(b.maxY - b.minY, 2)} m`, 0, 0, { color: colors['ink-soft'], size: 12.5 });
        ctx.restore();
      }
    }

    // Línea de influencia de la barra seleccionada
    if (ok && res.chain && sel.members.length === 1 && !sel.nodes.length && !test) {
      const r = res.byId.get(sel.members[0]);
      const peak = r?.infl ? Math.max(...r.infl.map(Math.abs)) : 0;
      if (peak > 1e-9) {
        const base = sy(b.minY) + 118, k = 34 / peak;
        const pts = res.chain.nodes.map((n, j) => [sx(n.x), base - r.infl[j] * k]);
        for (const [sign, color] of [[1, colors.tension], [-1, colors.compression]]) {
          ctx.save(); ctx.beginPath();
          ctx.rect(0, sign > 0 ? 0 : base, W, sign > 0 ? base : H - base); ctx.clip();
          ctx.beginPath(); ctx.moveTo(pts[0][0], base); pts.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(pts[pts.length - 1][0], base); ctx.closePath();
          ctx.globalAlpha = 0.3; ctx.fillStyle = color; ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = colors['ink-soft']; ctx.lineWidth = 1; line(pts[0][0], base, pts[pts.length - 1][0], base);
        text(`Línea de influencia de ${r.id}: cuánto la exige el vehículo según dónde esté`, pts[0][0], base + 48, { align: 'left', size: 12.5, color: colors['ink-soft'] });
      }
    }

    // Deformada (exagerada)
    if (ok && view.deform > 0 && res.totals.maxDisp > 1e-9 && !test) {
      const k = (view.deform * 0.035 * span) / res.totals.maxDisp;
      ctx.strokeStyle = colors['ink-soft']; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
      ctx.beginPath();
      for (const m of model.members) {
        const ia = idx.get(m.a), ib = idx.get(m.b), na = model.nodes[ia], nb = model.nodes[ib];
        ctx.moveTo(sx(na.x + res.disp[2 * ia] * k), sy(na.y + res.disp[2 * ia + 1] * k));
        ctx.lineTo(sx(nb.x + res.disp[2 * ib] * k), sy(nb.y + res.disp[2 * ib + 1] * k));
      }
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Barras
    const zoomK = Math.min(1.5, Math.max(0.6, cam.scale / 34));
    const selM = new Set(sel.members), selN = new Set(sel.nodes);
    const lambda = test ? test.lambda : 0;
    const stage = test ? test.stageAt(lambda) : null;
    const seen = new Set();
    const labels = [];
    ctx.lineCap = 'round';
    for (const m of model.members) {
      seen.add(m.id);
      if (test && (test.fired.has(m.id) || (test.sim && !test.alive(m.id)))) continue;
      const [x1, y1] = P(m.a), [x2, y2] = P(m.b);
      const r = ok ? res.byId.get(m.id) : null;
      let N = 0, u = 0;
      if (test && stage) { const e = stage.u1[m.id]; if (e) { u = e.u * lambda; N = e.sign; } }
      else if (r) { N = res.instant ? r.Nnow : r.Ngov; u = res.instant ? (N > 0 ? N / r.capT : -N / r.capC) : r.u; }
      const targetW = (2.6 + profileOf(m).D / 36) * zoomK;
      const s = shown.get(m.id) || { w: targetW, u };
      const k = calm ? 1 : 1 - Math.exp(-dt * 7);
      s.w += (targetW - s.w) * k; s.u += (u - s.u) * k;
      shown.set(m.id, s);
      const over = s.u > 1.0005;
      const quiet = Math.abs(N) < 1e-6;
      const color = !ok && !test ? colors.neutral : over ? colors.danger : quiet ? colors.neutral : N > 0 ? colors.tension : colors.compression;

      if (selM.has(m.id)) { ctx.strokeStyle = colors.accent; ctx.lineWidth = s.w + 8; line(x1, y1, x2, y2); }
      else if (hover.member === m.id && !gesture) { ctx.strokeStyle = colors['ink-soft']; ctx.lineWidth = s.w + 6; line(x1, y1, x2, y2); }
      ctx.strokeStyle = colors.sheet; ctx.lineWidth = s.w + 3.2; line(x1, y1, x2, y2);
      if (over && !calm) { ctx.shadowColor = colors.danger; ctx.shadowBlur = 10 + 8 * Math.sin(clock * 7); }
      ctx.globalAlpha = quiet || (!ok && !test) ? 0.75 : 0.42 + 0.58 * Math.min(1, s.u);
      ctx.strokeStyle = color; ctx.lineWidth = s.w; line(x1, y1, x2, y2);
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.28;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s.w * 0.22); line(x1, y1, x2, y2);
      ctx.globalAlpha = 1;

      // Flujo: los trazos se alejan del centro en tracción y se acercan en compresión
      if (view.flow && ok && !quiet && !calm && !test && s.w > 3) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        ctx.strokeStyle = colors.sheet; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1.2, s.w * 0.3); ctx.lineCap = 'butt';
        ctx.setLineDash([3, 11]); ctx.lineDashOffset = (N > 0 ? -1 : 1) * clock * (10 + 22 * Math.min(1, s.u));
        line(mx, my, x1, y1); line(mx, my, x2, y2);
        ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineCap = 'round';
      }
      if (m.deck && !test) {
        const L = Math.hypot(x2 - x1, y2 - y1) || 1, ox = ((y2 - y1) / L) * (s.w / 2 + 4), oy = (-(x2 - x1) / L) * (s.w / 2 + 4);
        const flip = oy > 0 ? -1 : 1;
        ctx.strokeStyle = colors.ink; ctx.lineWidth = 1.4; ctx.lineCap = 'butt';
        line(x1 + ox * flip, y1 + oy * flip, x2 + ox * flip, y2 + oy * flip); ctx.lineCap = 'round';
      }
      if (ok && !test && (view.labels || selM.has(m.id) || hover.member === m.id) && Math.hypot(x2 - x1, y2 - y1) > 58) {
        labels.push([selM.has(m.id) || hover.member === m.id ? `${m.id}  ${signed(N)} kN` : signed(N), (x1 + x2) / 2, (y1 + y2) / 2, color]);
      }
    }
    for (const id of shown.keys()) if (!seen.has(id)) shown.delete(id);
    ctx.lineCap = 'butt';

    // Chispazos de rotura en el ensayo
    if (test) for (const f of test.flashes) {
      const age = test.clock - f.t; if (age > 0.7) continue;
      const m = model.members.find((k) => k.id === f.id); if (!m) continue;
      const [x1, y1] = P(m.a), [x2, y2] = P(m.b);
      ctx.strokeStyle = colors.danger; ctx.globalAlpha = 1 - age / 0.7; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, 6 + age * 70, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (test?.sim) {
      const gy = sy(test.sim.groundY) + 4;
      ctx.strokeStyle = colors['ink-soft']; ctx.lineWidth = 1.5; line(0, gy, W, gy);
    }

    // Apoyos, cargas y nudos
    const maxLoad = Math.max(1, ...model.nodes.map((n) => (n.load ? Math.hypot(n.load.fx, n.load.fy) : 0)));
    model.nodes.forEach((n, i) => {
      const [x, y] = pos[i];
      if (n.support && !test?.sim) drawSupport(x, y, n.support);
      if (n.load && !test?.sim) {
        const F = Math.hypot(n.load.fx, n.load.fy) || 1, ux = n.load.fx / F, uy = -n.load.fy / F;
        const len = 30 + 30 * (F / maxLoad);
        arrow(x - ux * (len + 10), y - uy * (len + 10), x - ux * 10, y - uy * 10, colors.accent, 2.6);
        text(`${num(F * (test ? Math.max(lambda, 0) : 1))} kN`, x - ux * (len + 22), y - uy * (len + 22), { size: 12.5, color: colors.accent });
      }
    });
    if (ok && !test && view.labels) for (const r of res.reactions) {
      const [x, y] = P(r.id);
      const parts = [];
      if (Math.abs(r.ry) > 0.05) parts.push(`${r.ry > 0 ? '↑' : '↓'} ${num(Math.abs(r.ry))} kN`);
      if (Math.abs(r.rx) > 0.05) parts.push(`${r.rx > 0 ? '→' : '←'} ${num(Math.abs(r.rx))} kN`);
      if (parts.length) text(parts.join('   '), x, y + 50, { size: 12.5, color: colors.ok });
    }
    for (const [str, x, y, color] of labels) text(str, x, y, { size: 12, color });

    model.nodes.forEach((n, i) => {
      const [x, y] = pos[i];
      const isSel = selN.has(n.id), isHover = hover.node === n.id && !gesture;
      const merge = gesture?.mergeInto === n.id;
      ctx.beginPath(); ctx.arc(x, y, merge ? 10 : isSel ? 7 : 5.2, 0, TAU);
      ctx.fillStyle = isSel || merge ? colors.accent : colors.sheet; ctx.fill();
      ctx.strokeStyle = isHover ? colors.accent : colors.ink; ctx.lineWidth = 2; ctx.stroke();
      if ((isSel || isHover) && !test) text(n.id, x + 12, y - 13, { size: 12, align: 'left' });
    });

    // Vehículo
    if (ok && res.P > 0 && state.vehiclePos != null && !test) {
      const w = vehiclePoint(res.chain, state.vehiclePos);
      drawTruck(sx(w.x), sy(w.y) - 6, res.P);
    }

    // Guía al dibujar
    if (!test && !gesture?.touch && hover.point && (tool === 'node' || tool === 'member')) {
      const w = snapped(toWorld(hover.point.x, hover.point.y));
      const gx = hover.node ? P(hover.node)[0] : sx(w.x), gy = hover.node ? P(hover.node)[1] : sy(w.y);
      ctx.strokeStyle = colors.accent; ctx.lineWidth = 1;
      line(gx - 9, gy, gx + 9, gy); line(gx, gy - 9, gx, gy + 9);
      text(`${num(w.x, 2)} ; ${num(w.y, 2)}`, gx + 14, gy + 16, { size: 11.5, align: 'left', color: colors['ink-soft'] });
    }
    const from = gesture?.type === 'draw' && gesture.moved ? gesture.from : pending;
    if (from != null && tool === 'member' && hover.point) {
      const a = typeof from === 'string' ? P(from) : [sx(from.x), sy(from.y)];
      if (a) {
        const w = snapped(toWorld(hover.point.x, hover.point.y));
        const end = hover.node && hover.node !== from ? P(hover.node) : [sx(w.x), sy(w.y)];
        ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.setLineDash([7, 6]); line(a[0], a[1], end[0], end[1]); ctx.setLineDash([]);
        const wa = toWorld(a[0], a[1]), we = toWorld(end[0], end[1]);
        text(`${num(Math.hypot(we.x - wa.x, we.y - wa.y), 2)} m`, (a[0] + end[0]) / 2, (a[1] + end[1]) / 2 - 12, { size: 12, color: colors.accent });
      }
    }
    if (pending && tool === 'member') { const a = P(pending); if (a) { ctx.strokeStyle = colors.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a[0], a[1], 11 + 2 * Math.sin(clock * 6), 0, TAU); ctx.stroke(); } }
  }

  function loop(now) { app.test?.advance(now); draw(now); requestAnimationFrame(loop); }

  store.subscribe((s, prev) => {
    if (s.tool !== prev.tool) { pending = null; canvas.style.cursor = ''; }
    if (pending && !nodeById(s.model, pending)) pending = null;
  });

  new ResizeObserver(() => { resize(); }).observe(canvas.parentElement);
  resize(); readTheme(); fit(false);
  requestAnimationFrame(loop);

  return {
    fit, resize, readTheme,
    cancel() { const had = pending != null; pending = null; return had; },
    zoom: (f) => zoomAt(W / 2, H / 2, f),
    /** Lleva una barra o un nudo al centro si quedó fuera de la vista. */
    reveal(x, y) {
      const px = sx(x), py = sy(y);
      if (px < 80 || px > W - 80 || py < 80 || py > H - 120) camTarget = { x, y, scale: cam.scale };
    },
    // Para pruebas automáticas: coordenadas de pantalla de un punto del modelo.
    project: (x, y) => { const r = canvas.getBoundingClientRect(); return { x: r.left + sx(x), y: r.top + sy(y) }; },
  };
}
