// Conecta la página y el panel con la API (Cloudflare D1).
// Reemplaza al localStorage solo para turnos, bloqueos y ajustes, y maneja el ingreso al panel.
(function () {
  'use strict';
  var API = '/api/';
  var KEYS = { 'sg-demo-bookings-v1': 'bookings', 'sg-demo-blocks-v1': 'blocks', 'sg-demo-settings-v1': 'settings' };
  var ADMIN = /\/admin(\/|$)/.test(location.pathname);
  var LOADED_AT = Date.now();
  var cache = { bookings: [], blocks: [], settings: {} };
  var state = 'ok'; // ok | locked | setup | offline
  var online = false;

  function req(method, path, body) {
    var x = new XMLHttpRequest();
    try {
      x.open(method, API + path, false);
      x.setRequestHeader('Content-Type', 'application/json');
      x.send(body === undefined ? null : JSON.stringify(body));
    } catch (e) { return { status: 0, data: { error: 'Sin conexión. Probá de nuevo.' } }; }
    var d = {};
    try { d = JSON.parse(x.responseText || '{}'); } catch (e) {}
    return { status: x.status, data: d };
  }

  function load() {
    var r = req('GET', ADMIN ? 'admin/state' : 'public');
    if (r.status === 200) {
      cache.bookings = r.data.bookings || [];
      cache.blocks = r.data.blocks || [];
      cache.settings = r.data.settings || {};
      online = true; state = 'ok';
      return true;
    }
    if (r.status === 401) state = 'locked';
    else if (r.status === 403 && r.data.mustChange) state = 'setup';
    else state = 'offline';
    return false;
  }
  load();

  var SGS = {
    lastError: '',
    getItem: function (k) {
      var n = KEYS[k];
      if (!n) { try { return localStorage.getItem(k); } catch (e) { return null; } }
      return JSON.stringify(cache[n]);
    },
    setItem: function (k, v) {
      var n = KEYS[k];
      if (!n) { try { localStorage.setItem(k, v); } catch (e) {} return; }
      var next = JSON.parse(v), r;
      SGS.lastError = '';
      if (ADMIN) {
        var payload = next;
        if (n === 'bookings') { // enviar solo los turnos que cambiaron
          var before = {};
          cache.bookings.forEach(function (b) { before[b.id] = JSON.stringify(b); });
          payload = next.filter(function (b) { return before[b.id] !== JSON.stringify(b); });
          if (!payload.length) { cache[n] = next; return; }
        }
        r = req('PUT', 'admin/' + n, payload);
        if (r.status !== 200) { SGS.lastError = r.data.error || 'No se pudo guardar'; throw new Error(SGS.lastError); }
        cache[n] = next;
        return;
      }
      if (n !== 'bookings') throw new Error('No permitido');
      var prev = {};
      cache.bookings.forEach(function (b) { if (b.id) prev[b.id] = b; });
      next = next.map(function (b) {
        var old = prev[b.id];
        if (!b.id) return b;
        if (!old) {
          var hp = document.getElementById('hp-website');
          var payload = Object.assign({}, b, { _t: LOADED_AT, _hp: hp ? hp.value : '' });
          r = req('POST', 'bookings', payload);
          if (r.status !== 200) { SGS.lastError = r.data.error || 'No se pudo guardar el turno'; throw new Error(SGS.lastError); }
          return Object.assign(b, { price: r.data.booking.price, duration: r.data.booking.duration });
        }
        if (old.status !== 'cancelled' && b.status === 'cancelled') {
          r = req('POST', 'cancel', { id: b.id, phone: b.phone });
          if (r.status !== 200) { SGS.lastError = r.data.error || 'No se pudo cancelar'; throw new Error(SGS.lastError); }
        }
        return b;
      });
      cache.bookings = next;
    },
    removeItem: function (k) {
      var n = KEYS[k];
      if (!n) { try { localStorage.removeItem(k); } catch (e) {} return; }
      SGS.setItem(k, n === 'settings' ? '{}' : '[]');
    },
    // Devuelve '' si encontró los turnos, o el mensaje de error
    loadMine: function (phone, code) {
      var r = req('POST', 'mine', { phone: phone, code: code });
      if (r.status !== 200) return r.data.error || 'No se pudo consultar';
      var map = {};
      cache.bookings.forEach(function (b, i) { map[b.id || ('_' + i)] = b; });
      (r.data.bookings || []).forEach(function (b) { map[b.id] = b; });
      cache.bookings = Object.keys(map).map(function (id) { return map[id]; });
      return '';
    },
    isOnline: function () { return online; }
  };
  window.SGS = SGS;

  // ===== Diálogos propios (reemplazan los de Chrome: "zenix.com.ar dice…") =====
  (function () {
    var css = '.sgd-wrap{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:18px;backdrop-filter:blur(4px);animation:sgdf .15s ease}' +
      '@keyframes sgdf{from{opacity:0}to{opacity:1}}' +
      '.sgd{width:min(100%,400px);background:#181716;border:1px solid #4a3a2b;border-radius:12px;padding:24px 22px 20px;box-shadow:0 30px 90px #000;color:#f4f1ec;font-family:"DM Sans",Arial,sans-serif}' +
      '.sgd small{display:block;color:#c9a06f;font-size:10.5px;letter-spacing:.18em;font-weight:700;margin-bottom:8px}' +
      '.sgd h3{margin:0 0 8px;font-family:"Playfair Display",Georgia,serif;font-size:22px;font-weight:600;line-height:1.25}' +
      '.sgd p{margin:0 0 18px;color:#b9b1a7;font-size:13.5px;line-height:1.6;white-space:pre-line}' +
      '.sgd .acts{display:flex;gap:10px}.sgd button{flex:1;min-height:44px;border-radius:6px;font-weight:700;font-size:12px;letter-spacing:.05em;cursor:pointer;font-family:inherit}' +
      '.sgd .no{background:#262626;border:1px solid #3a3a3a;color:#f4f1ec}.sgd .yes{background:#bf9462;border:1px solid #bf9462;color:#17110b}.sgd .yes.danger{background:#b4473a;border-color:#b4473a;color:#fff}';
    function addCss() { if (document.getElementById('sgd-css')) return; var st = document.createElement('style'); st.id = 'sgd-css'; st.textContent = css; document.head.appendChild(st); }
    function open(o, withCancel) {
      addCss();
      return new Promise(function (resolve) {
        var w = document.createElement('div'); w.className = 'sgd-wrap';
        var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
        w.innerHTML = '<div class="sgd" role="alertdialog" aria-modal="true"><small>ESTUDIO AURORA · TURNOS</small>' +
          (o.title ? '<h3>' + esc(o.title) + '</h3>' : '') + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
          '<div class="acts">' + (withCancel ? '<button type="button" class="no">' + esc(o.cancel || 'CANCELAR') + '</button>' : '') +
          '<button type="button" class="yes' + (o.danger ? ' danger' : '') + '">' + esc(o.ok || 'ACEPTAR') + '</button></div></div>';
        var done = function (v) { w.remove(); document.removeEventListener('keydown', key); resolve(v); };
        var key = function (e) { if (e.key === 'Escape') done(false); };
        w.querySelector('.yes').addEventListener('click', function () { done(true); });
        var no = w.querySelector('.no'); if (no) no.addEventListener('click', function () { done(false); });
        w.addEventListener('click', function (e) { if (e.target === w) done(false); });
        document.addEventListener('keydown', key);
        document.body.appendChild(w);
        setTimeout(function () { (no || w.querySelector('.yes')).focus(); }, 20);
      });
    }
    window.sgConfirm = function (o) { return open(typeof o === 'string' ? { title: o } : o, true); };
    window.sgAlert = function (o) { return open(typeof o === 'string' ? { text: o } : o, false); };
    window.alert = function (msg) { var m = String(msg || ''); var nl = m.indexOf('\n'); window.sgAlert(nl > 0 && nl < 60 ? { title: m.slice(0, nl), text: m.slice(nl + 1) } : { text: m }); };
  })();

  if (!ADMIN) return;

  // ================= Panel: ingreso, primer cambio de contraseña, recuperación y cuenta =================
  var css = '#sg-gate{position:fixed;inset:0;z-index:999;background:#0d0c0c;display:grid;place-items:center;padding:20px;overflow:auto}' +
    '.sg-card{width:min(100%,400px);background:#171615;border:1px solid #3d3024;border-radius:12px;padding:26px;display:grid;gap:10px;color:#f4f1ec;font-family:inherit;box-sizing:border-box}' +
    '.sg-card form{display:grid;gap:10px}' +
    '.sg-card p.k{margin:0;color:#c9a06f;font-size:11px;letter-spacing:.18em;font-weight:700}.sg-card h1{margin:0 0 4px;font-size:25px;font-weight:500}' +
    '.sg-card .t{margin:0 0 6px;color:#b5ada3;font-size:13px;line-height:1.55}.sg-card label{font-size:12px;color:#cfc8be;margin-top:4px}' +
    '.sg-card input{min-height:46px;border-radius:6px;border:1px solid #45403a;background:#0f0f0f;color:#f4f1ec;padding:0 12px;font-size:15px;width:100%;box-sizing:border-box}' +
    '.sg-card input:focus{outline:none;border-color:#bf9462}.sg-card button.go{min-height:46px;border:0;border-radius:6px;background:#bf9462;color:#17110b;font-weight:700;letter-spacing:.05em;cursor:pointer;margin-top:6px}' +
    '.sg-card button.ln{background:none;border:0;color:#c9a06f;font-size:12px;cursor:pointer;text-decoration:underline;padding:4px 0;justify-self:start}' +
    '.sg-card .err{color:#ff9b8c;min-height:16px;font-size:12px}.sg-card .okm{color:#9fe0b8;font-size:13px}' +
    '.sg-rules{list-style:none;margin:2px 0 0;padding:0;display:grid;gap:3px;font-size:12px;color:#8e877e}.sg-rules li::before{content:"○ "}.sg-rules li.ok{color:#9fe0b8}.sg-rules li.ok::before{content:"✓ "}' +
    '.sg-meter{height:6px;border-radius:9px;background:#2a2723;overflow:hidden}.sg-meter i{display:block;height:100%;width:0;background:#d0574a;transition:.2s}' +
    '.sg-pw{position:relative}.sg-pw input{padding-right:48px!important}.sg-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;background:none;color:#a89f94;cursor:pointer;display:grid;place-items:center;border-radius:6px}.sg-eye:hover{color:#e3b983;background:#222}' +
    '.sg-sec{border-top:1px solid #2d2925;padding-top:12px;margin-top:8px}.sg-x{position:absolute;top:14px;right:14px;background:#242424;border:1px solid #353535;color:#ddd;border-radius:6px;width:32px;height:32px;cursor:pointer}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var RULES = [
    ['12 caracteres o más', function (p) { return p.length >= 12; }],
    ['Mayúsculas y minúsculas', function (p) { return /[a-z]/.test(p) && /[A-Z]/.test(p); }],
    ['Al menos un número', function (p) { return /\d/.test(p); }],
    ['Al menos un símbolo (! ? # * …)', function (p) { return /[^A-Za-z0-9]/.test(p); }],
    ['Sin tu nombre ni palabras obvias', function (p) { return !!p && !/aurora|valentina|colorista|123456|qwerty|password|contrase/i.test(p) && !/(.)\1\1/.test(p); }]
  ];
  function pwFields(prefix) {
    return '<label for="' + prefix + '1">Contraseña nueva</label><input id="' + prefix + '1" type="password" autocomplete="new-password" required>' +
      '<div class="sg-meter"><i id="' + prefix + 'm"></i></div><ul class="sg-rules" id="' + prefix + 'r">' + RULES.map(function (r) { return '<li>' + r[0] + '</li>'; }).join('') + '</ul>' +
      '<label for="' + prefix + '2">Repetí la contraseña nueva</label><input id="' + prefix + '2" type="password" autocomplete="new-password" required>';
  }
  function wirePw(root, prefix) {
    var a = root.querySelector('#' + prefix + '1'), m = root.querySelector('#' + prefix + 'm'), list = root.querySelectorAll('#' + prefix + 'r li');
    a.addEventListener('input', function () {
      var n = 0;
      RULES.forEach(function (r, i) { var ok = r[1](a.value); list[i].classList.toggle('ok', ok); if (ok) n++; });
      m.style.width = (n / RULES.length * 100) + '%';
      m.style.background = n === RULES.length ? '#5fbf86' : n >= 3 ? '#d9a441' : '#d0574a';
    });
  }
  function gate(html, onSubmit) {
    var o = document.getElementById('sg-gate');
    if (!o) { o = document.createElement('div'); o.id = 'sg-gate'; document.body.appendChild(o); }
    document.body.style.overflow = 'hidden';
    o.innerHTML = '<form class="sg-card" novalidate>' + html + '<small class="err" id="sg-err"></small></form>';
    var f = o.querySelector('form');
    f.addEventListener('submit', function (e) { e.preventDefault(); onSubmit(f, function (msg) { document.getElementById('sg-err').textContent = msg || ''; }); });
    var first = f.querySelector('input'); if (first) setTimeout(function () { first.focus(); }, 30);
    return f;
  }
  var v = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var go = function () { location.replace(location.pathname); };

  // ojito para ver/ocultar contraseñas
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function eyes(root) {
    root.querySelectorAll('input[type=password]').forEach(function (inp) {
      if (inp.parentNode.classList.contains('sg-pw')) return;
      var w = document.createElement('div'); w.className = 'sg-pw';
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      var b = document.createElement('button'); b.type = 'button'; b.className = 'sg-eye'; b.setAttribute('aria-label', 'Mostrar contraseña'); b.innerHTML = EYE;
      b.addEventListener('click', function () {
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        b.innerHTML = show ? EYE_OFF : EYE;
        b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        inp.focus();
      });
      w.appendChild(b);
    });
  }
  var gate0 = gate;
  gate = function (html, onSubmit) { var f = gate0(html, onSubmit); eyes(f); return f; };

  function showLogin() {
    var f = gate('<p class="k">PANEL DE TURNOS</p><h1>Estudio Aurora</h1><label for="sg-pass">Contraseña</label>' +
      '<input id="sg-pass" type="password" autocomplete="current-password" required><button class="go" type="submit">INGRESAR</button>' +
      '<button class="ln" type="button" id="sg-forgot">¿Olvidaste tu contraseña?</button>', function (f, err) {
        var r = req('POST', 'login', { password: v('sg-pass') });
        if (r.status === 200) go();
        else if (r.data.setup) showActivate();
        else err(r.data.error || 'No se pudo ingresar');
      });
    f.querySelector('#sg-forgot').addEventListener('click', function () { showAskMail('reset'); });
  }
  function showActivate() { showAskMail('setup'); }
  function showAskMail(purpose) {
    var first = purpose === 'setup';
    var f = gate('<p class="k">' + (first ? 'PRIMER INGRESO' : 'RECUPERAR ACCESO') + '</p><h1>' + (first ? 'Activá tu panel' : '¿Olvidaste tu contraseña?') + '</h1>' +
      '<p class="t">' + (first ? 'Ingresá el mail que le diste a Zenix AR. Te vamos a mandar un código de 6 números para entrar y crear tu contraseña.' : 'Ingresá tu mail y te mandamos un código de 6 números para crear una contraseña nueva.') + '</p>' +
      '<label for="sg-am">Tu mail</label><input id="sg-am" type="email" autocomplete="email" inputmode="email" placeholder="tunombre@gmail.com" required>' +
      '<button class="go" type="submit">ENVIARME EL CÓDIGO</button>' + (first ? '' : '<button class="ln" type="button" id="sg-back">Volver</button>'), function (f, err) {
        var mail = v('sg-am').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { err('Ingresá un mail válido'); return; }
        f.querySelector('button.go').disabled = true;
        var r = req('POST', 'send-code', { email: mail, purpose: purpose });
        f.querySelector('button.go').disabled = false;
        if (r.status === 200) showCode(purpose, mail); else err(r.data.error || 'No se pudo enviar el código');
      });
    var back = f.querySelector('#sg-back'); if (back) back.addEventListener('click', showLogin);
  }
  function showCode(purpose, mail) {
    var f = gate('<p class="k">REVISÁ TU MAIL</p><h1>Ingresá el código</h1><p class="t">Si <b>' + mail.replace(/[<>&"]/g, '') + '</b> es el mail registrado, te llegó un código de 6 números. Vence en 10 minutos. Si no lo ves, revisá spam.</p>' +
      '<label for="sg-code">Código</label><input id="sg-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" style="font-size:24px;letter-spacing:10px;text-align:center" required>' +
      '<button class="go" type="submit">CONTINUAR</button><button class="ln" type="button" id="sg-again">Mandarme otro código</button>', function (f, err) {
        var r = req('POST', 'verify-code', { code: v('sg-code'), purpose: purpose });
        if (r.status === 200) showCreate(purpose === 'setup', mail); else err(r.data.error || 'Código incorrecto');
      });
    f.querySelector('#sg-again').addEventListener('click', function () {
      var r = req('POST', 'send-code', { email: mail, purpose: purpose });
      document.getElementById('sg-err').textContent = r.status === 200 ? 'Listo, te mandamos un código nuevo.' : (r.data.error || 'No se pudo enviar');
    });
  }
  function showCreate(first, mail) {
    var f = gate('<p class="k">' + (first ? 'PRIMER INGRESO' : 'RECUPERAR ACCESO') + '</p><h1>Creá tu contraseña</h1>' +
      '<p class="t">' + (first ? 'Elegí una contraseña que solo sepas vos. Con ella vas a entrar a tu panel de ahora en adelante.' : 'Elegí tu contraseña nueva.') + '</p>' + pwFields('sg-np') +
      (first ? '<div class="sg-sec"></div><label for="sg-phone">Tu celular</label><input id="sg-phone" type="tel" autocomplete="tel" placeholder="11 5555 0123" required>' +
        '<p class="t" style="margin:2px 0 0;font-size:12px">Los avisos de turnos nuevos y cancelados te llegan a ' + (mail ? '<b>' + mail.replace(/[<>&"]/g, '') + '</b>' : 'tu mail registrado') + '.</p>' : '') +
      '<button class="go" type="submit">GUARDAR Y ENTRAR</button>', function (f, err) {
        var r = req('POST', 'admin/setup', { password: v('sg-np1'), password2: v('sg-np2'), phone: v('sg-phone') });
        if (r.status !== 200) { err(r.data.error || 'No se pudo guardar'); return; }
        if (first) gate('<p class="k">LISTO</p><h1>¡Tu panel está activado!</h1><p class="t">Ya podés entrar cuando quieras con tu contraseña. Te mandamos un mail de confirmación y desde ahora los avisos de turnos llegan a tu mail.</p><button class="go" type="submit">ENTRAR A MI PANEL</button>', go);
        else go();
      });
    wirePw(f, 'sg-np');
  }
  function showAccount() {
    var acc = req('GET', 'admin/account').data || {};
    var o = document.createElement('div'); o.id = 'sg-gate'; o.style.background = 'rgba(0,0,0,.78)'; document.body.appendChild(o);
    document.body.style.overflow = 'hidden';
    var close = function () { o.remove(); document.body.style.overflow = ''; };
    var q = function (s) { return String(s || '').replace(/["<>&]/g, ''); };
    o.innerHTML = '<div class="sg-card" style="position:relative"><button class="sg-x" type="button" aria-label="Cerrar">✕</button><p class="k">MI CUENTA</p><h1>Seguridad</h1>' +
      '<p class="t" style="margin:0">Mail registrado: <b style="color:#f4f1ec">' + q(acc.email) + '</b><br><span style="font-size:12px">Ahí te llegan los avisos y los códigos. Para cambiarlo, pedíselo a Zenix AR.</span></p>' +
      '<form id="sg-f1" class="sg-sec" novalidate><p class="t" style="margin:4px 0">Cambiar contraseña</p><label for="sg-cur">Contraseña actual</label><input id="sg-cur" type="password" autocomplete="current-password">' + pwFields('sg-cp') +
      '<button class="go" type="submit">CAMBIAR CONTRASEÑA</button><small class="err" id="sg-e1"></small></form>' +
      '<form id="sg-f2" class="sg-sec" novalidate><p class="t" style="margin:4px 0">Celular de contacto</p><label for="sg-rph">Celular</label><input id="sg-rph" type="tel" value="' + q(acc.phone) + '">' +
      '<label for="sg-cur2">Contraseña actual (para confirmar)</label><input id="sg-cur2" type="password" autocomplete="current-password">' +
      '<button class="go" type="submit">GUARDAR CELULAR</button><small class="err" id="sg-e2"></small></form></div>';
    eyes(o);
    o.querySelector('.sg-x').addEventListener('click', close);
    o.addEventListener('click', function (e) { if (e.target === o) close(); });
    wirePw(o, 'sg-cp');
    o.querySelector('#sg-f1').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = req('POST', 'admin/password', { current: v('sg-cur'), password: v('sg-cp1'), password2: v('sg-cp2') });
      var m = document.getElementById('sg-e1');
      if (r.status === 200) { m.className = 'okm'; m.textContent = 'Listo, tu contraseña cambió. Se cerró la sesión en los otros dispositivos.'; this.reset(); }
      else { m.className = 'err'; m.textContent = r.data.error || 'No se pudo cambiar'; }
    });
    o.querySelector('#sg-f2').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = req('POST', 'admin/recovery', { current: v('sg-cur2'), phone: v('sg-rph') });
      var m = document.getElementById('sg-e2');
      if (r.status === 200) { m.className = 'okm'; m.textContent = 'Celular guardado.'; document.getElementById('sg-cur2').value = ''; }
      else { m.className = 'err'; m.textContent = r.data.error || 'No se pudo guardar'; }
    });
  }

  // Actualización automática del panel (cada 45 s, sin interrumpir si estás escribiendo)
  function autoRefresh() {
    setInterval(function () {
      if (document.hidden || document.getElementById('sg-gate')) return;
      var a = document.activeElement;
      if (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
      if (document.querySelector('dialog[open]')) return;
      var sig = function () { return JSON.stringify(cache.bookings.map(function (b) { return b.id + b.status + b.date + b.time; })) + JSON.stringify(cache.blocks); };
      var before = sig();
      if (!load()) { if (state === 'locked' || state === 'setup') go(); return; }
      if (before === sig()) return;
      var cfg = document.getElementById('panel-config');
      if (!cfg || cfg.hidden) window.dispatchEvent(new StorageEvent('storage', { key: 'sg-demo-bookings-v1' }));
      var t = document.title.replace(/^\(nuevo\)\s*/, '');
      document.title = '(nuevo) ' + t;
      setTimeout(function () { document.title = t; }, 10000);
    }, 45000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (state === 'locked') {
      var st = req('GET', 'status').data || {};
      if (st.setup) showActivate(); else showLogin();
      return;
    }
    if (state === 'setup') { showCreate(true, ''); return; }
    if (state === 'offline') {
      var n = document.createElement('div');
      n.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:998;background:#5a2a20;color:#fff;padding:10px;text-align:center;font-size:13px';
      n.textContent = 'No se pudo conectar con la agenda. Revisá tu conexión y recargá la página.';
      document.body.appendChild(n);
      return;
    }
    var bar = document.querySelector('.topin');
    if (bar) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:8px;align-items:center';
      [['Mi cuenta', showAccount], ['Cerrar sesión', function () { req('POST', 'logout', {}); go(); }]].forEach(function (x) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'back'; b.textContent = x[0]; b.style.cssText = 'cursor:pointer;background:none;font:inherit';
        b.addEventListener('click', x[1]);
        wrap.appendChild(b);
      });
      bar.appendChild(wrap);
    }
    autoRefresh();
  });
})();
