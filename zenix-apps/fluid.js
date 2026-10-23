// Simulación de fluidos en la GPU (Navier–Stokes, "stable fluids") en WebGL, escrita a mano.
// Reacciona al mouse / dedo y se mueve sola cuando nadie la toca.
// En celular corre más liviana; si el equipo no da abasto, baja la calidad sola y, como último paso, se apaga con un fundido.
(function () {
  const canvas = document.getElementById('fluid');
  if (!canvas) return;
  const params = { SIM: 128, DYE: 1024, DISS_D: 0.985, DISS_V: 0.992, PRESSURE_IT: 18, CURL: 26, RADIUS: 0.22, FORCE: 6200 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(pointer: coarse)').matches;
  if (isMobile) { params.DYE = 384; params.SIM = 64; params.PRESSURE_IT = 10; params.FORCE = 4200; params.CURL = 18; }
  let dprCap = isMobile ? 1 : 1.5, level = 0;      // level: 0 normal · 1 liviano · 2 mínimo · 3 apagado
  const intensity = isMobile ? .7 : 1;

  let gl = canvas.getContext('webgl2', { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false });
  const isGL2 = !!gl;
  if (!gl) gl = canvas.getContext('webgl', { alpha: true, depth: false, stencil: false, antialias: false }) || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.classList.add('off'); return; }
  let halfFloat, linear;
  if (isGL2) { gl.getExtension('EXT_color_buffer_float'); linear = gl.getExtension('OES_texture_float_linear') || gl.getExtension('OES_texture_half_float_linear'); }
  else { halfFloat = gl.getExtension('OES_texture_half_float'); linear = gl.getExtension('OES_texture_half_float_linear'); }
  const HF = isGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
  if (!HF) { canvas.classList.add('off'); return; }
  const fmt = (internal, format) => ({ internal, format });
  const RGBA = isGL2 ? fmt(gl.RGBA16F, gl.RGBA) : fmt(gl.RGBA, gl.RGBA);
  const RG = isGL2 ? fmt(gl.RG16F, gl.RG) : RGBA;
  const R = isGL2 ? fmt(gl.R16F, gl.RED) : RGBA;
  const filtering = linear ? gl.LINEAR : gl.NEAREST;

  // ---------- shaders ----------
  const vs = `precision highp float; attribute vec2 aPos; varying vec2 vUv, vL, vR, vT, vB; uniform vec2 texel;
    void main(){ vUv = aPos*.5+.5; vL = vUv-vec2(texel.x,0.); vR = vUv+vec2(texel.x,0.); vT = vUv+vec2(0.,texel.y); vB = vUv-vec2(0.,texel.y); gl_Position = vec4(aPos,0.,1.); }`;
  const FS = {
    splat: `precision highp float; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspect, radius; uniform vec3 color; uniform vec2 point;
      void main(){ vec2 p = vUv-point; p.x *= aspect; vec3 s = exp(-dot(p,p)/radius)*color; gl_FragColor = vec4(texture2D(uTarget,vUv).xyz+s,1.); }`,
    advect: `precision highp float; varying vec2 vUv; uniform sampler2D uVel, uSrc; uniform vec2 texel; uniform float dt, diss;
      void main(){ vec2 c = vUv - dt*texture2D(uVel,vUv).xy*texel; gl_FragColor = diss*texture2D(uSrc,c); }`,
    div: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVel;
      void main(){ float L=texture2D(uVel,vL).x, R=texture2D(uVel,vR).x, T=texture2D(uVel,vT).y, B=texture2D(uVel,vB).y; vec2 C=texture2D(uVel,vUv).xy;
        if(vL.x<0.)L=-C.x; if(vR.x>1.)R=-C.x; if(vT.y>1.)T=-C.y; if(vB.y<0.)B=-C.y; gl_FragColor=vec4(.5*(R-L+T-B),0.,0.,1.); }`,
    curl: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVel;
      void main(){ float L=texture2D(uVel,vL).y, R=texture2D(uVel,vR).y, T=texture2D(uVel,vT).x, B=texture2D(uVel,vB).x; gl_FragColor=vec4(.5*(R-L-T+B),0.,0.,1.); }`,
    vort: `precision highp float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uVel, uCurl; uniform float curl, dt;
      void main(){ float L=texture2D(uCurl,vL).x, R=texture2D(uCurl,vR).x, T=texture2D(uCurl,vT).x, B=texture2D(uCurl,vB).x, C=texture2D(uCurl,vUv).x;
        vec2 f=.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); f/=length(f)+1e-4; f*=curl*C; f.y*=-1.; vec2 v=texture2D(uVel,vUv).xy+f*dt; gl_FragColor=vec4(clamp(v,-1000.,1000.),0.,1.); }`,
    pressure: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uP, uDiv;
      void main(){ float L=texture2D(uP,vL).x, R=texture2D(uP,vR).x, T=texture2D(uP,vT).x, B=texture2D(uP,vB).x, d=texture2D(uDiv,vUv).x; gl_FragColor=vec4((L+R+B+T-d)*.25,0.,0.,1.); }`,
    grad: `precision mediump float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uP, uVel;
      void main(){ float L=texture2D(uP,vL).x, R=texture2D(uP,vR).x, T=texture2D(uP,vT).x, B=texture2D(uP,vB).x; vec2 v=texture2D(uVel,vUv).xy-vec2(R-L,T-B); gl_FragColor=vec4(v,0.,1.); }`,
    clear: `precision mediump float; varying vec2 vUv; uniform sampler2D uT; uniform float v; void main(){ gl_FragColor=v*texture2D(uT,vUv); }`,
    display: `precision highp float; varying vec2 vUv, vL, vR, vT, vB; uniform sampler2D uT;
      void main(){ vec3 c=texture2D(uT,vUv).rgb; vec3 l=texture2D(uT,vL).rgb, r=texture2D(uT,vR).rgb, t=texture2D(uT,vT).rgb, b=texture2D(uT,vB).rgb;
        float dx=length(r)-length(l), dy=length(t)-length(b); vec3 n=normalize(vec3(dx,dy,.35)); float diff=clamp(dot(n,normalize(vec3(.3,.6,1.)))+.6,.6,1.25);
        c*=diff; float a=max(c.r,max(c.g,c.b)); gl_FragColor=vec4(c, clamp(a*1.4,0.,1.)); }`,
  };
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const vShader = compile(gl.VERTEX_SHADER, vs);
  function program(fsrc) {
    const p = gl.createProgram(); gl.attachShader(p, vShader); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsrc)); gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }
  let P;
  try { P = Object.fromEntries(Object.entries(FS).map(([k, v]) => [k, program(v)])); } catch (e) { console.warn('Fluido no disponible:', e.message); canvas.classList.add('off'); return; }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
  const blit = target => { if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); } else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); } gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); };

  function fbo(w, h, f) {
    gl.activeTexture(gl.TEXTURE0); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filtering); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filtering);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, f.internal, w, h, 0, f.format, HF, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    return { t, fb, w, h, ok, texel: [1 / w, 1 / h], bind(i) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t); return i; } };
  }
  const dbl = (w, h, f) => { let a = fbo(w, h, f), b = fbo(w, h, f); return { get r() { return a; }, get w() { return b; }, swap() { [a, b] = [b, a]; }, ok: a.ok && b.ok }; };
  const res = n => { const ar = gl.drawingBufferWidth / gl.drawingBufferHeight; const mn = Math.round(n), mx = Math.round(n * Math.max(ar, 1 / ar)); return ar > 1 ? [mx, mn] : [mn, mx]; };

  let dye, vel, divergence, curl, pressure;
  function initFBOs() {
    const [sw, sh] = res(params.SIM), [dw, dh] = res(params.DYE);
    dye = dbl(dw, dh, RGBA); vel = dbl(sw, sh, RG); divergence = fbo(sw, sh, R); curl = fbo(sw, sh, R); pressure = dbl(sw, sh, R);
    if (!dye.ok || !vel.ok) { canvas.classList.add('off'); throw new Error('framebuffer'); }
  }
  function resize() {
    const dpr = Math.min(dprCap, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; initFBOs(); return true; }
    return false;
  }
  try { resize(); } catch { return; }
  if (!dye) initFBOs();

  // ---------- interacción ----------
  const PALETTE = [[0.43, 0.24, 0.96], [0.13, 0.83, 0.93], [0.78, 1, 0.24], [0.55, 0.3, 1], [0.1, 0.6, 1]];
  const pickColor = () => { const c = PALETTE[Math.floor(Math.random() * PALETTE.length)]; return c.map(v => v * .16 * intensity); };
  function splat(x, y, dx, dy, color, r = params.RADIUS) {
    const ar = canvas.width / canvas.height;
    gl.useProgram(P.splat.p);
    gl.uniform1i(P.splat.u.uTarget, vel.r.bind(0)); gl.uniform1f(P.splat.u.aspect, ar); gl.uniform2f(P.splat.u.point, x, y);
    gl.uniform3f(P.splat.u.color, dx, dy, 0); gl.uniform1f(P.splat.u.radius, (r / 100) * (ar > 1 ? ar : 1)); blit(vel.w); vel.swap();
    gl.uniform1i(P.splat.u.uTarget, dye.r.bind(0)); gl.uniform3f(P.splat.u.color, ...color); blit(dye.w); dye.swap();
  }
  const pointer = { x: 0, y: 0, dx: 0, dy: 0, down: false, moved: false, color: pickColor(), last: 0 };
  const onMove = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    if (cy < r.top || cy > r.bottom) return;
    const x = (cx - r.left) / r.width, y = 1 - (cy - r.top) / r.height;
    if (pointer.last) { pointer.dx = (x - pointer.x) * params.FORCE * (r.width / r.height > 1 ? 1 : .6); pointer.dy = (y - pointer.y) * params.FORCE; pointer.moved = Math.abs(pointer.dx) + Math.abs(pointer.dy) > 0; }
    pointer.x = x; pointer.y = y; pointer.last = performance.now();
  };
  addEventListener('pointermove', e => onMove(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', e => { pointer.color = pickColor(); onMove(e.clientX, e.clientY); });
  addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });

  // ---------- simulación ----------
  function step(dt) {
    gl.disable(gl.BLEND);
    const tx = vel.r.texel;
    const set = (prog) => { gl.useProgram(prog.p); if (prog.u.texel) gl.uniform2f(prog.u.texel, tx[0], tx[1]); return prog.u; };
    let u = set(P.curl); gl.uniform1i(u.uVel, vel.r.bind(0)); blit(curl);
    u = set(P.vort); gl.uniform1i(u.uVel, vel.r.bind(0)); gl.uniform1i(u.uCurl, curl.bind(1)); gl.uniform1f(u.curl, params.CURL); gl.uniform1f(u.dt, dt); blit(vel.w); vel.swap();
    u = set(P.div); gl.uniform1i(u.uVel, vel.r.bind(0)); blit(divergence);
    u = set(P.clear); gl.uniform1i(u.uT, pressure.r.bind(0)); gl.uniform1f(u.v, .8); blit(pressure.w); pressure.swap();
    u = set(P.pressure); gl.uniform1i(u.uDiv, divergence.bind(0));
    for (let i = 0; i < params.PRESSURE_IT; i++) { gl.uniform1i(u.uP, pressure.r.bind(1)); blit(pressure.w); pressure.swap(); }
    u = set(P.grad); gl.uniform1i(u.uP, pressure.r.bind(0)); gl.uniform1i(u.uVel, vel.r.bind(1)); blit(vel.w); vel.swap();
    u = set(P.advect); gl.uniform1i(u.uVel, vel.r.bind(0)); gl.uniform1i(u.uSrc, vel.r.bind(0)); gl.uniform1f(u.dt, dt); gl.uniform1f(u.diss, params.DISS_V); blit(vel.w); vel.swap();
    gl.uniform1i(u.uVel, vel.r.bind(0)); gl.uniform1i(u.uSrc, dye.r.bind(1)); gl.uniform1f(u.diss, params.DISS_D); blit(dye.w); dye.swap();
  }
  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.BLEND);
    gl.useProgram(P.display.p); gl.uniform2f(P.display.u.texel, 1 / canvas.width, 1 / canvas.height); gl.uniform1i(P.display.u.uT, dye.r.bind(0));
    gl.clearColor(0, 0, 0, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.clear(gl.COLOR_BUFFER_BIT);
    blit(null);
  }

  let last = performance.now(), visible = true, auto = 0, t = 0, skip = false;
  // monitor de rendimiento: mide el promedio de cuadros y degrada en escalones
  const perf = { n: 0, sum: 0, since: performance.now() };
  function degrade() {
    level++; perf.since = performance.now();
    if (level === 1) { dprCap = Math.max(.75, dprCap * .75); params.DYE = Math.round(params.DYE * .6); params.PRESSURE_IT = Math.max(8, params.PRESSURE_IT - 6); canvas.width = 0; }
    else if (level === 2) { params.SIM = Math.max(48, Math.round(params.SIM * .7)); dprCap = .6; canvas.width = 0; }
    else { canvas.style.transition = 'opacity 1.2s'; canvas.style.opacity = '0'; setTimeout(() => canvas.classList.add('off'), 1300); }
  }
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  // ráfaga inicial
  for (let i = 0; i < (reduce ? 3 : isMobile ? 4 : 6); i++) splat(.2 + Math.random() * .6, .25 + Math.random() * .5, (Math.random() - .5) * 900, (Math.random() - .5) * 900, pickColor().map(v => v * 1.6));
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    if (level >= 3) return;
    const raw = now - last;
    // en celular (o en modo mínimo) se simula a ~30 cuadros por segundo: la mitad de trabajo para la GPU
    if ((isMobile || level >= 2) && (skip = !skip)) return;
    const dt = Math.max(0, Math.min(.033, raw / 1000)); last = now; t += dt;   // el reloj de rAF puede venir antes que performance.now()
    if (now - perf.since > 600) { perf.n++; perf.sum += raw; }
    if (perf.n >= 45) { const avg = perf.sum / perf.n, budget = (isMobile || level >= 2) ? 50 : 30; perf.n = perf.sum = 0; if (avg > budget) degrade(); }
    resize();
    if (pointer.moved) { splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color); pointer.moved = false; if (Math.random() < .03) pointer.color = pickColor(); }
    // movimiento propio: dos "corrientes" que dibujan curvas de Lissajous
    if (!reduce && level < 2 && now - pointer.last > 1800) {
      auto += dt;
      if (auto > (isMobile ? .09 : .05)) {
        auto = 0;
        for (let k = 0; k < (isMobile ? 1 : 2); k++) {
          const a = t * (.35 + k * .17) + k * 2.1, x = .5 + Math.cos(a) * .32, y = .5 + Math.sin(a * 1.3 + k) * .28;
          const dx = -Math.sin(a) * 420, dy = Math.cos(a * 1.3 + k) * 360;
          splat(x, y, dx * intensity, dy * intensity, PALETTE[(Math.floor(t / 3) + k) % PALETTE.length || 0].map(v => v * .045 * intensity), .12);
        }
      }
    }
    step(dt); render();
  }
  requestAnimationFrame(frame);
  window.__fluid = { ok: true, get level() { return level; }, splat: (x, y) => splat(x, y, 500, 300, pickColor()) };
})();
