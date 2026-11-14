(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const story = $("#inicio");
  const stage = $("#storyStage");
  const artifact = $("#artifact");
  const copies = $$("[data-story]");
  const chapter = $("#chapterCurrent");
  const progressTrack = $("#storyProgress");
  const header = $("#siteHeader");
  const nav = $(".desktop-nav");
  const navLinks = $$("[data-nav]");
  const navHighlight = $("#navHighlight");
  const navBeam = $("#navBeam");
  const menuButton = $("#menuButton");
  const menu = $("#mobileMenu");
  let scrollProgress = 0;
  let mouseX = 0, mouseY = 0, currentSection = "inicio";
  let scrollPending = false;

  function updateStory() {
    if (!story || !stage) return;
    const maxScroll = Math.max(1, story.offsetHeight - stage.offsetHeight);
    scrollProgress = clamp((window.scrollY - story.offsetTop) / maxScroll);
    const p = scrollProgress;
    const weights = [
      1 - smooth(0.12, 0.29, p),
      smooth(0.23, 0.37, p) * (1 - smooth(0.48, 0.65, p)),
      smooth(0.60, 0.77, p)
    ];
    copies.forEach((el, i) => {
      const w = weights[i];
      el.style.opacity = String(w);
      el.style.visibility = w < 0.008 ? "hidden" : "visible";
      el.style.transform = "translate3d(0," + ((1 - w) * 34).toFixed(1) + "px,0)";
      el.style.pointerEvents = w > 0.8 ? "auto" : "none";
      el.setAttribute("aria-hidden", w > 0.7 ? "false" : "true");
      $$("a,button", el).forEach(control => {
        if (w > .8) control.removeAttribute("tabindex");
        else control.setAttribute("tabindex", "-1");
      });
    });
    chapter.textContent = p < 0.30 ? "01" : (p < 0.66 ? "02" : "03");
    progressTrack.style.transform = "scaleX(" + p.toFixed(4) + ")";
    const mobile = window.innerWidth < 820;
    const dx = reduced.matches ? 0 : mouseX * (mobile ? 3 : 19);
    const dy = reduced.matches ? 0 : mouseY * (mobile ? 3 : 13);
    const sc = 1 + p * (mobile ? .10 : .2);
    artifact.style.transform = "translate(calc(-50% + " + dx.toFixed(1) + "px),calc(-50% + " + dy.toFixed(1) + "px)) scale(" + sc.toFixed(3) + ") rotate(" + (p * 13).toFixed(1) + "deg)";
    header.classList.toggle("scrolled", window.scrollY > 28);
  }

  function scrollSection() {
    const candidates = ["inicio", "servicios", "apps", "proyectos", "proceso", "contacto"];
    let candidate = "inicio";
    const testY = window.scrollY + window.innerHeight * 0.34;
    for (const id of candidates) {
      const section = document.getElementById(id);
      if (section && section.getBoundingClientRect().top + window.scrollY <= testY) candidate = id;
    }
    if (candidate === "proceso" || candidate === "contacto") candidate = "proyectos";
    if (candidate !== currentSection) {
      currentSection = candidate;
      navLinks.forEach(link => link.classList.toggle("is-active", link.dataset.nav === currentSection));
      setNavTarget();
    }
  }

  function onScroll() {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(() => {
      updateStory();
      scrollSection();
      scrollPending = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("pointermove", e => {
    mouseX = clamp((e.clientX / Math.max(1, window.innerWidth) - .5) * 2, -1, 1);
    mouseY = clamp((e.clientY / Math.max(1, window.innerHeight) - .5) * 2, -1, 1);
    if (window.scrollY < story.offsetHeight) updateArtifactPointer();
  }, { passive: true });
  function updateArtifactPointer() {
    const p = scrollProgress;
    const mobile = window.innerWidth < 820;
    const dx = reduced.matches ? 0 : mouseX * (mobile ? 3 : 19);
    const dy = reduced.matches ? 0 : mouseY * (mobile ? 3 : 13);
    artifact.style.transform = "translate(calc(-50% + " + dx.toFixed(1) + "px),calc(-50% + " + dy.toFixed(1) + "px)) scale(" + (1 + p * (mobile ? .10 : .2)).toFixed(3) + ") rotate(" + (p * 13).toFixed(1) + "deg)";
  }

  // Spotlight navigation: a spring moves the glass pill, the softer light follows it.
  const navState = { x: 5, w: 85, vx: 0, vw: 0, tx: 5, tw: 85, beamX: 5 };
  function setNavTarget() {
    if (!nav) return;
    const active = navLinks.find(x => x.classList.contains("is-active")) || navLinks[0];
    if (!active) return;
    navState.tx = active.offsetLeft;
    navState.tw = active.offsetWidth;
  }
  function stepNav() {
    if (!nav || window.innerWidth <= 820) return;
    const s = navState;
    s.vx = (s.vx + (s.tx - s.x) * .17) * .76;
    s.vw = (s.vw + (s.tw - s.w) * .21) * .7;
    s.x += s.vx;
    s.w += s.vw;
    s.beamX += ((s.x + s.w / 2) - s.beamX) * .095;
    navHighlight.style.width = s.w.toFixed(2) + "px";
    navHighlight.style.transform = "translateX(" + s.x.toFixed(2) + "px)";
    navBeam.style.transform = "translateX(" + (s.beamX - 38).toFixed(2) + "px)";
  }
  navLinks.forEach(link => link.addEventListener("mouseenter", () => {
    navState.tx = link.offsetLeft;
    navState.tw = link.offsetWidth;
  }));
  nav?.addEventListener("mouseleave", setNavTarget);
  navLinks.forEach(link => link.addEventListener("click", () => {
    currentSection = link.dataset.nav;
    navLinks.forEach(x => x.classList.toggle("is-active", x === link));
    setNavTarget();
  }));

  function setMenu(open) {
    menu.classList.toggle("open", open);
    menu.inert = !open;
    menuButton.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $("a", menu)?.focus({ preventScroll: true });
  }
  menuButton?.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  $$("a", menu).forEach(el => el.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.classList.contains("open")) {
      setMenu(false);
      menuButton.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (innerWidth > 820 && menu.classList.contains("open")) setMenu(false);
    setNavTarget();
  }, { passive: true });

  // Original canvas data corridor. Depth is projected from a virtual camera, no downloaded frames.
  const canvas = $("#universe");
  const ctx = canvas?.getContext("2d", { alpha: true });
  let cw = 0, ch = 0, scale = 1;
  let lastFrame = 0;
  const seeds = (() => {
    let seed = 7491201;
    function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    const particles = [];
    for (let i = 0; i < 210; i++) {
      const theta = rand() * Math.PI * 2, rr = 140 + rand() * 950;
      particles.push({ x: Math.cos(theta) * rr, y: Math.sin(theta) * rr, z: rand() * 2800, size: .3 + rand() * 1.6, c: rand() });
    }
    return particles;
  })();

  function resizeCanvas() {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    cw = rect.width; ch = rect.height;
    scale = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.65);
    canvas.width = Math.round(cw * scale);
    canvas.height = Math.round(ch * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    if (reduced.matches) renderUniverse(performance.now());
  }

  function renderUniverse(now) {
    if (!ctx || !cw || !ch) return;
    const t = reduced.matches ? 0 : now * .001;
    const p = scrollProgress;
    const w = cw, h = ch;
    const centerX = w * (w < 700 ? .50 : .555) + mouseX * 11;
    const centerY = h * (w < 700 ? .36 : .445) + mouseY * 8;
    const fov = Math.min(w, h) * .89;
    const travel = p * 1720 + t * 17;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, Math.max(w, h) * .65);
    glow.addColorStop(0, "rgba(97,136,245,.085)");
    glow.addColorStop(.32, "rgba(76,65,190,.052)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    for (let k = 33; k >= 0; k--) {
      const z = 100 + (((k * 83 - travel) % 2822) + 2822) % 2822;
      const perspective = fov / z;
      const r = perspective * 225;
      if (r < 8 || r > Math.max(w, h) * 1.3) continue;
      const fade = Math.pow(1 - z / 3100, 2) * (w < 700 ? .13 : .22);
      const angle = k * .069 + t * .019 + p * .85;
      const sides = 8;
      ctx.beginPath();
      for (let n = 0; n <= sides; n++) {
        const a = angle + n * Math.PI * 2 / sides;
        const xx = centerX + Math.cos(a) * r * 1.08;
        const yy = centerY + Math.sin(a) * r * .84;
        if (n === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.closePath();
      ctx.strokeStyle = (k % 4 === 0 ? "rgba(142,218,255," : "rgba(127,132,245,") + fade.toFixed(3) + ")";
      ctx.lineWidth = Math.min(2, .45 + perspective * .6);
      ctx.stroke();
      if (k % 3 === 0) {
        ctx.beginPath();
        for (let n = 0; n < sides; n += 2) {
          const a = angle + n * Math.PI * 2 / sides;
          ctx.moveTo(centerX + Math.cos(a) * r * .95, centerY + Math.sin(a) * r * .75);
          ctx.lineTo(centerX + Math.cos(a) * r * 1.06, centerY + Math.sin(a) * r * .84);
        }
        ctx.strokeStyle = "rgba(177,232,255," + Math.min(.36, fade * 1.8).toFixed(3) + ")";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Perspective dust. The camera moves forwards as the page scrolls.
    for (let i = 0; i < seeds.length; i++) {
      const dot = seeds[i];
      const z = 90 + (((dot.z - travel * (dot.c > .7 ? 1.4 : .8)) % 2800) + 2800) % 2800;
      const pz = fov / z;
      const x = centerX + dot.x * pz;
      const y = centerY + dot.y * pz * .75;
      if (x < 0 || x > w || y < 0 || y > h) continue;
      const alpha = clamp((1 - z / 2900) * .65, 0, .6);
      ctx.fillStyle = dot.c > .78 ? "rgba(157,249,229," + alpha.toFixed(3) + ")" : "rgba(164,187,255," + alpha.toFixed(3) + ")";
      const size = Math.min(3, dot.size * pz * .75);
      ctx.fillRect(x, y, Math.max(.45, size), Math.max(.45, size));
    }
    const outer = Math.min(w, h) * (.25 + p * .065);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-t * .035 + p * .65);
    ctx.strokeStyle = "rgba(133,202,252,.19)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, outer, -.7, .86);
    ctx.stroke();
    ctx.strokeStyle = "rgba(195,174,255,.14)";
    ctx.beginPath();
    ctx.arc(0, 0, outer * 1.18, 1.2, 2.78);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  if (ctx) {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
    document.addEventListener("visibilitychange", () => { lastFrame = 0; });
  }

  // A small, fixed set of real applications. The illustrated device above is not claimed as an exact screenshot.
  const apps = {
    caja: {
      index: "01", category: "SISTEMA DE VENTAS", short: "CAJA",
      title: "Vendé, cobrá y cerrá la caja sin papeles.",
      desc: "Un punto de venta práctico para administrar el día a día de almacenes, kioscos y comercios.",
      features: ["Control de stock con lector de códigos", "Ventas y múltiples medios de pago", "Arqueo de caja y resumen diario"],
      src: "../zenix-caja/", url: "https://zenix.com.ar/zenix-caja/",
      preview: '<div class="mock-top"><b>Resumen de hoy</b><span>● EN LÍNEA</span></div><div class="mock-grid"><div class="mock-metric"><small>VENTAS</small><strong>$158.400</strong></div><div class="mock-metric"><small>OPERACIONES</small><strong>24</strong></div><div class="mock-metric"><small>PRODUCTOS</small><strong>186</strong></div></div><div class="mock-bars"><span style="--height:42%"></span><span style="--height:68%"></span><span style="--height:48%"></span><span style="--height:82%"></span><span style="--height:66%"></span><span style="--height:95%"></span><span style="--height:74%"></span></div>'
    },
    cotiza: {
      index: "02", category: "PRESUPUESTOS DIGITALES", short: "COTIZA",
      title: "Presupuestos que llegan listos para aceptar.",
      desc: "Creá una cotización profesional, compartila por WhatsApp y seguí su estado.",
      features: ["Presupuestos claros y con identidad propia", "Envío por enlace y exportación PDF", "Seguimiento de propuestas y respuestas"],
      src: "../zenix-cotiza/", url: "https://zenix.com.ar/zenix-cotiza/",
      preview: '<div class="mock-top"><b>Presupuesto #0048</b><span>VISTA PREVIA</span></div><div class="mock-quote"><div class="q-line"><span>Servicio de instalación</span><span>$75.000</span></div><div class="q-line"><span>Materiales y accesorios</span><span>$42.000</span></div><div class="q-line"><span>TOTAL</span><span>$117.000</span></div></div>'
    },
    club: {
      index: "03", category: "FIDELIZACIÓN DIGITAL", short: "CLUB",
      title: "Que tus clientes vuelvan. Y vuelvan.",
      desc: "Una tarjeta de beneficios digital que ayuda a fortalecer el vínculo con quienes te eligen.",
      features: ["Sellos digitales desde el celular", "Beneficios para clientes frecuentes", "Comunicación directa por WhatsApp"],
      src: "../zenix-club/", url: "https://zenix.com.ar/zenix-club/",
      preview: '<div class="mock-top"><b>Tu tarjeta de beneficios</b><span>ZENIX CLUB</span></div><div class="mock-club-title">¡Ya casi alcanzás tu premio!</div><div class="mock-stamps"><span>✓</span><span>✓</span><span>✓</span><span class="empty">+</span><span class="empty">+</span></div><div class="mock-quote"><div class="q-line"><span>Tu progreso</span><span>3 de 5 sellos</span></div></div>'
    },
    escaner: {
      index: "04", category: "DOCUMENTOS INTELIGENTES", short: "ESCÁNER",
      title: "Un documento perfecto desde tu cámara.",
      desc: "Digitalizá facturas, remitos y documentos con una herramienta simple para el trabajo real.",
      features: ["Detección y corrección de páginas", "Varias hojas en un solo documento", "Archivos PDF listos para compartir"],
      src: "../zenix-escaner/", url: "https://zenix.com.ar/zenix-escaner/",
      preview: '<div class="mock-top"><b>Escanear documento</b><span>DETECCIÓN ACTIVA</span></div><div style="position:relative"><div class="mock-scan-page"><b>DOCUMENTO</b><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="mock-scan-corners"></div></div>'
    }
  };

  let selectedApp = "caja";
  const appTabs = $$("[data-app]");
  const previewContent = $("#previewContent");
  const modal = $("#demoDialog");
  function selectApp(name, focusTab = false) {
    const item = apps[name];
    if (!item) return;
    selectedApp = name;
    appTabs.forEach(btn => {
      const chosen = btn.dataset.app === name;
      btn.classList.toggle("active", chosen);
      btn.setAttribute("aria-selected", String(chosen));
      btn.tabIndex = chosen ? 0 : -1;
      if (chosen && focusTab) btn.focus();
    });
    $("#appIndex").textContent = item.index;
    $("#appCategory").textContent = item.category;
    $("#appTitle").textContent = item.title;
    $("#appDescription").textContent = item.desc;
    $("#previewDomain").textContent = "ZENIX / " + item.short;
    $("#appFeatures").replaceChildren(...item.features.map(str => {
      const li = document.createElement("li"); li.textContent = str; return li;
    }));
    $("#externalDemo").href = item.url;
    previewContent.innerHTML = item.preview;
    $(".app-preview").dataset.theme = name;
  }
  appTabs.forEach((btn, i) => {
    btn.addEventListener("click", () => selectApp(btn.dataset.app));
    btn.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const names = Object.keys(apps);
      let next = event.key === "Home" ? 0 : event.key === "End" ? names.length - 1 : (i + (event.key === "ArrowRight" ? 1 : -1) + names.length) % names.length;
      selectApp(names[next], true);
    });
  });
  $("#openDemo")?.addEventListener("click", () => {
    const item = apps[selectedApp];
    $("#demoTitle").textContent = "ZENIX " + item.short;
    $("#demoNewWindow").href = item.url;
    $("#demoFrame").src = item.src;
    if (typeof modal.showModal === "function") modal.showModal();
    else window.open(item.url, "_blank", "noopener,noreferrer");
  });
  function closeDemo() {
    if (modal.open) modal.close();
    $("#demoFrame").removeAttribute("src");
  }
  $("#closeDemo")?.addEventListener("click", closeDemo);
  modal?.addEventListener("click", event => { if (event.target === modal) closeDemo(); });
  modal?.addEventListener("close", () => $("#demoFrame").removeAttribute("src"));
  selectApp("caja");

  // Keep the opening short and remove the overlay completely after the radial dissolve.
  const loader = $("#preloader");
  const count = $("#loadNumber");
  const bar = $("#loadFill");
  function startLoader() {
    if (!loader) return;
    const start = performance.now();
    const duration = reduced.matches ? 80 : 1650;
    function countFrame(now) {
      const p = clamp((now - start) / duration);
      const v = Math.round((1 - Math.pow(1 - p, 2.1)) * 100);
      count.textContent = String(v).padStart(2, "0");
      bar.style.transform = "scaleX(" + (v / 100) + ")";
      if (p < 1) requestAnimationFrame(countFrame);
      else {
        count.textContent = "100";
        bar.style.transform = "scaleX(1)";
        const revealAt = performance.now();
        const revealDuration = reduced.matches ? 20 : 720;
        function revealFrame(time) {
          const t = clamp((time - revealAt) / revealDuration);
          const eased = smooth(0, 1, t);
          loader.style.setProperty("--melt", (eased * 100).toFixed(2) + "%");
          loader.style.opacity = String(1 - smooth(.7, 1, t));
          if (t < 1) requestAnimationFrame(revealFrame);
          else { loader.classList.add("done"); loader.remove(); }
        }
        requestAnimationFrame(revealFrame);
      }
    }
    requestAnimationFrame(countFrame);
  }

  function loop(now) {
    stepNav();
    if (ctx && !document.hidden) {
      const delta = now - lastFrame;
      if (delta > (window.innerWidth <= 700 ? 33 : 19) || reduced.matches && lastFrame === 0) {
        renderUniverse(now);
        lastFrame = now;
      }
    }
    if (!reduced.matches) requestAnimationFrame(loop);
  }

  $("#year").textContent = String(new Date().getFullYear());
  setNavTarget();
  navState.x = navState.tx;
  navState.w = navState.tw;
  navState.beamX = navState.x + navState.w / 2;
  updateStory();
  scrollSection();
  if (reduced.matches) { stepNav(); renderUniverse(0); }
  else requestAnimationFrame(loop);
  startLoader();
})();