/* Doña Lupita — funciones exclusivas de la portada */
(function () {
  'use strict';

  var ZONE = 'America/Argentina/Ushuaia';
  var HOURS = { lunchStart: 12 * 60, lunchEnd: 15 * 60, dinnerStart: 20 * 60, dinnerEnd: 24 * 60 };
  var clock = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function timeInUshuaia(date) {
    var parts = {};
    clock.formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
    return { weekday: parts.weekday, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) };
  }

  function renderBusinessHours() {
    var el = document.getElementById('business-status');
    var caption = document.getElementById('business-hours-detail');
    var dot = document.getElementById('business-status-dot');
    if (!el || !caption || !dot) return;

    var now = timeInUshuaia(new Date());
    var sunday = now.weekday === 'Sun';
    var morning = now.minuteOfDay >= HOURS.lunchStart && now.minuteOfDay < HOURS.lunchEnd;
    var evening = now.minuteOfDay >= HOURS.dinnerStart && now.minuteOfDay < HOURS.dinnerEnd;
    var open = !sunday && (morning || evening);
    var explanation = '';

    if (sunday) {
      explanation = 'Domingos cerrado · abre el lunes a las 12:00';
    } else if (morning) {
      explanation = 'Abierto hasta las 15:00 · vuelve a las 20:00';
    } else if (evening) {
      explanation = 'Abierto hasta las 00:00';
    } else if (now.minuteOfDay < HOURS.lunchStart) {
      explanation = 'Abre hoy a las 12:00';
    } else {
      explanation = 'Vuelve a abrir hoy a las 20:00';
    }

    el.textContent = open ? 'Abierto ahora' : 'Cerrado ahora';
    caption.textContent = explanation;
    dot.classList.toggle('is-open', open);
    dot.classList.toggle('is-closed', !open);
  }

  function updateCartCount() {
    var quantity = 0;
    try {
      var cart = JSON.parse(localStorage.getItem('lupita-cart') || '{}');
      if (cart && typeof cart === 'object' && !Array.isArray(cart)) {
        quantity = Object.values(cart).reduce(function (sum, value) {
          var n = Number(value);
          return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
        }, 0);
      }
    } catch (err) { quantity = 0; }
    document.querySelectorAll('.cartcount').forEach(function (el) {
      el.textContent = String(quantity);
    });
  }

  function setupMenu() {
    var toggle = document.getElementById('menu-toggle');
    var nav = document.getElementById('mobile-nav');
    if (!toggle || !nav) return;
    function setMenu(open) {
      document.body.classList.toggle('is-menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      nav.setAttribute('aria-hidden', String(!open));
      if (open) {
        var firstLink = nav.querySelector('a');
        if (firstLink) firstLink.focus();
      }
    }
    toggle.addEventListener('click', function () {
      setMenu(!document.body.classList.contains('is-menu-open'));
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setMenu(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 820 && document.body.classList.contains('is-menu-open')) {
        setMenu(false);
      }
    });
  }

  function initialize() {
    renderBusinessHours();
    updateCartCount();
    setupMenu();
    window.setInterval(renderBusinessHours, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) { renderBusinessHours(); updateCartCount(); }
    });
    window.addEventListener('focus', function () {
      renderBusinessHours();
      updateCartCount();
    });
    window.addEventListener('storage', updateCartCount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else { initialize(); }
})();
