import { simulate, snapshot, presets, validate } from "./engine.js";
import { Store } from "./store.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const store = new Store();
let section = [
    "estudio",
    "laboratorio",
    "escenarios",
    "informe",
    "guia",
  ].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "estudio",
  selected = store.model.stations[0].id,
  result = simulate(store.model),
  time = store.model.duration * 0.48,
  playing = false,
  last = 0,
  speed = 2,
  opt = null,
  busy = false,
  job = 0,
  worker = null,
  budget = 2,
  dragId = null,
  stressResult = null,
  stressBusy = false,
  stressWorker = null,
  stressJob = 0;
const fmt = (n, d = 1) =>
  n.toLocaleString("es-AR", {
    maximumFractionDigits: d,
    minimumFractionDigits: d,
  });
const toast = (text) => {
  const e = $("#toast");
  e.textContent = text;
  e.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => e.classList.remove("show"), 4000);
};
function dialog(title, body, action, label = "Confirmar") {
  const d = $("#dialog");
  d.innerHTML = `<h2>${esc(title)}</h2>${body}<div class="toolbar"><button id="cancelDialog">Cancelar</button><button class="primary" id="confirmDialog">${label}</button></div>`;
  d.showModal();
  $("#cancelDialog").onclick = () => d.close();
  $("#confirmDialog").onclick = () => {
    if (action() !== false) d.close();
  };
}
function changed(next) {
  store.set(next);
  refresh();
  if (store.warning) toast(store.warning);
}
function refresh() {
  stressJob++;
  stressResult = null;
  stressBusy = false;
  stressWorker?.terminate();
  stressWorker = null;
  playing = false;
  opt = null;
  busy = false;
  job++;
  worker?.terminate();
  worker = null;
  result = simulate(store.model);
  time = Math.min(time, store.model.duration);
  if (!store.model.stations.some((s) => s.id === selected))
    selected = store.model.stations[0].id;
  render();
}
function update(fn) {
  const m = structuredClone(store.model);
  fn(m);
  changed(m);
}
function nav(to) {
  section = to;
  location.hash = to;
  playing = false;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
const stat = (label, value, unit, sub) =>
  `<div class="stat"><span>${label}</span><strong>${value} <small>${unit}</small></strong><span>${sub}</span></div>`;
function header() {
  return `<header><div class="brand"><img src="./icon.svg" alt="">CAUCE<small>FLOW DESIGN STUDIO</small></div><nav aria-label="Principal">${[
    ["estudio", "Estudio"],
    ["laboratorio", "Laboratorio"],
    ["escenarios", "Escenarios"],
    ["informe", "Informe"],
  ]
    .map(
      ([id, label]) =>
        `<button data-nav="${id}" class="${section === id ? "active" : ""}" ${section === id ? 'aria-current="page"' : ""}>${label}</button>`,
    )
    .join(
      "",
    )}</nav><div class="tools"><span class="save">${store.warning ? "Guardado limitado" : "Guardado local"}</span><button class="quiet small" data-action="theme" aria-label="Cambiar tema">${store.theme === "light" ? "◐" : "☀"}</button><button class="quiet small" data-nav="guia" aria-label="Abrir guía">?</button></div></header>`;
}
function intro(kicker, title, subtitle, actions = "") {
  return `<div class="intro"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="toolbar">${actions}</div></div>`;
}
function studio() {
  const m = store.model,
    s = m.stations.find((s) => s.id === selected),
    i = m.stations.indexOf(s),
    b = result.stations.reduce(
      (a, x) => (x.wait > a.wait ? x : a),
      result.stations[0],
    ),
    bname = m.stations.find((s) => s.id === b.id).name;
  return (
    intro(
      "UN PEQUEÑO CAMBIO. UN GRAN FLUJO.",
      "Las buenas ideas <em>fluyen.</em>",
      "Probá el próximo movimiento de tu negocio antes de hacerlo realidad.",
      `<button data-action="save">＋ Guardar escenario</button><button class="primary" data-nav="laboratorio">Encontrar una mejora ↗</button>`,
    ) +
    `<div class="workspace"><aside class="panel"><div class="panel-head"><h2>Tu sistema</h2><span class="tag orange">MODELO EDITABLE</span></div><div class="pad"><label for="preset">Plantillas de ejemplo</label><select id="preset"><option value="">Elegí una plantilla…</option value="cafe">Cafetería</option><option value="taller">Taller de bicicletas</option><option value="envios">Preparación de envíos</option></select><label for="projectName">Nombre del proyecto</label><input id="projectName" maxlength="80" value="${esc(m.name)}"><label for="rate" class="value-row">Llegadas por hora <strong id="rateValue">${m.rate}</strong></label><input id="rate" type="range" min="1" max="240" value="${m.rate}"><div class="fields2"><div><label for="duration">Jornada · min</label><input id="duration" type="number" min="15" max="480" value="${m.duration}"></div><div><label for="seed">Semilla</label><input id="seed" type="number" min="1" max="999999" value="${m.seed}"></div></div><div class="rule"></div><div class="title-row"><h3>Recorrido</h3><button class="quiet small" data-action="add" ${m.stations.length >= 6 ? "disabled" : ""} aria-label="Agregar estación">＋</button></div><p class="subtle">Arrastrá para ordenar. Tocá para editar.</p><div class="station-list">${m.stations.map((s, i) => `<button class="station-row ${s.id === selected ? "selected" : ""}" draggable="true" data-station="${s.id}"><span class="number">0${i + 1}</span><span>${esc(s.name)}</span><b>×${s.servers}</b></button>`).join("")}</div><div class="toolbar" style="margin-top:16px"><button class="small" data-action="undo" ${!store.history.length ? "disabled" : ""} title="Ctrl + Z">↶ Deshacer</button><button class="small" data-action="redo" ${!store.future.length ? "disabled" : ""} title="Ctrl + Shift + Z">↷</button></div></div></aside><div class="center"><div class="panel"><div class="panel-head"><h2>${esc(m.name)}</h2><span class="tag">● SIMULACIÓN LOCAL</span></div><div class="flow-wrap"><span class="flow-top">MAPA DE EXPERIENCIA / ${m.stations.length} ESTACIONES</span><svg id="flow" viewBox="0 0 660 355" role="img" aria-label="Recorrido de clientes simulado"></svg><div class="legend"><span><i></i>En espera</span><span><i></i>En atención</span><span>Cada punto = 1 cliente · máx. 30 visibles</span></div></div><div class="replay"><button class="small primary" data-action="play" aria-label="Reproducir simulación">▶</button><input id="timeline" aria-label="Minuto de la simulación" type="range" min="0" max="${m.duration}" step="0.1" value="${time}"><span class="clock" id="clock"></span><button class="quiet small" data-action="speed" title="Minutos simulados por segundo">${speed}×</button></div></div><div class="stats">${stat("Espera promedio", fmt(result.wait), "min", "Todas las llegadas")}${stat("Finalizados", result.completed, "/" + result.arrived, "Dentro de la jornada")}${stat("Espera del 95%", fmt(result.p95), "min", "Percentil 95")}</div><div class="panel pad" style="margin-top:16px"><div class="title-row"><h2>El pulso de la jornada</h2><span class="subtle">Clientes en espera</span></div>${chart(result)}<p class="subtle">${result.arrived - result.completed} clientes siguen en el sistema al cierre. Las esperas incluyen su atención posterior.</p></div></div><aside class="inspector"><div class="panel"><div class="panel-head"><h2>Editar estación</h2><span class="number">0${i + 1}</span></div><div class="pad"><label for="stationName">Nombre</label><input id="stationName" maxlength="35" value="${esc(s.name)}"><div class="fields2"><div><label for="serviceTime">Atención · min</label><input id="serviceTime" type="number" min="0.1" max="30" step="0.1" value="${s.time}"></div><div><label for="servers">Puestos</label><input id="servers" type="number" min="1" max="10" value="${s.servers}"></div></div><label for="variation" class="value-row">Variabilidad <strong>±${Math.round(s.variation * 100)}%</strong></label><input id="variation" type="range" min="0" max="100" step="5" value="${s.variation * 100}"><p class="subtle">Cada cliente requiere entre ${fmt(s.time * (1 - s.variation))} y ${fmt(s.time * (1 + s.variation))} min.</p><div class="rule"></div><div class="value-row"><span class="subtle">Ocupación en la jornada</span><strong>${Math.round(result.stations[i].utilization * 100)}%</strong></div><div class="bar"><span style="width:${result.stations[i].utilization * 100}%"></span></div><div class="toolbar"><button class="small" data-action="up" ${i === 0 ? "disabled" : ""} aria-label="Mover antes">↑</button><button class="small" data-action="down" ${i === m.stations.length - 1 ? "disabled" : ""} aria-label="Mover después">↓</button><button class="quiet small" data-action="delete" ${m.stations.length === 1 ? "disabled" : ""}>Eliminar</button></div></div></div><div class="insight"><div class="eyebrow">LECTURA DEL SISTEMA</div><h3>${b.wait > 0.1 ? `El flujo se frena en ${esc(bname)}.` : "Tu sistema tiene margen para crecer."}</h3><p class="subtle">${b.wait > 0.1 ? `${fmt(b.wait)} minutos de espera media se concentran en esta estación.` : "La espera media por estación es menor a 0,1 minutos en esta jornada."}</p><button data-nav="laboratorio">Explorar alternativas →</button></div></aside></div>`
  );
}
function chart(r) {
  const values = Array.from({ length: 41 }, (_, i) =>
      snapshot(r, (i * r.duration) / 40).reduce((a, s) => a + s.queue, 0),
    ),
    max = Math.max(1, ...values),
    points = values.map((v, i) => `${35 + i * 13},${130 - (v / max) * 105}`);
  return `<svg class="chart" viewBox="0 0 580 165" role="img" aria-label="Cola total: máximo observado ${max} clientes"><line x1="35" y1="130" x2="555" y2="130"/><line x1="35" y1="25" x2="555" y2="25"/><text x="8" y="30">${max}</text><text x="15" y="134">0</text><path class="area" d="M35,130 L${points.join(" L")} L555,130 Z"/><path d="M${points.join(" L")}"/><text x="35" y="153">0 min</text><text x="275" y="153">${r.duration / 2} min</text><text x="515" y="153">${r.duration} min</text></svg>`;
}
function stressPanel() {
  const r = stressResult;
  let content =
    "<p>Ensayá hasta 12 niveles de demanda con cinco jornadas por nivel. Encontrá cuándo el sistema deja de absorber nuevas llegadas.</p>";
  if (r) {
    const max = Math.max(1, ...r.points.map((p) => p.wait)),
      ps = r.points.map(
        (p, i) =>
          `${40 + (i * 470) / Math.max(1, r.points.length - 1)},${155 - (p.wait / max) * 120}`,
      );
    content = `<div class="wide-grid"><div><svg class="chart" viewBox="0 0 560 190" role="img" aria-label="Curva de espera según demanda"><line x1="40" y1="155" x2="515" y2="155"/><text x="4" y="38">${fmt(max, 0)}m</text><text x="8" y="158">0m</text><path d="M${ps.join(" L")}"/>${r.points.map((p, i) => `<circle cx="${40 + (i * 470) / Math.max(1, r.points.length - 1)}" cy="${155 - (p.wait / max) * 120}" r="4" fill="var(--accent)"/>`).join("")}<text x="40" y="180">${r.points[0].rate} llegadas/h</text><text x="445" y="180">${r.points.at(-1).rate}/h</text></svg></div><div><div class="result-number" style="font-size:42px">${fmt(r.capacity)} <small style="font-size:17px">clientes/h</small></div><h3>Capacidad teórica del cuello de botella</h3><p class="subtle">Es un límite promedio, no una demanda recomendada. Las esperas pueden crecer mucho antes de alcanzarlo por la variabilidad.</p></div></div><p class="subtle">Abrí cualquier nivel en el estudio. El gráfico muestra medias de 5 jornadas; el estudio reproduce la semilla elegida.</p><div class="stress-points">${r.points.map((p) => `<button data-rate="${p.rate}"><strong>${p.rate}/h</strong><span>${fmt(p.wait)} min</span></button>`).join("")}</div>`;
  }
  return `<div class="panel pad" style="margin-top:24px"><div class="title-row"><div><div class="eyebrow">MOTOR 03 / PRUEBA DE ESTRÉS</div><h2 style="margin-top:12px">¿Hasta dónde puede crecer?</h2></div><button data-action="stress" ${stressBusy ? "disabled" : ""}>${stressBusy ? "Ensayando…" : r ? "Volver a calcular" : "Explorar demanda ↗"}</button></div>${content}</div>`;
}
function runStress() {
  stressBusy = true;
  render();
  const id = ++stressJob;
  try {
    stressWorker?.terminate();
    stressWorker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    stressWorker.onmessage = ({ data }) => {
      if (id !== stressJob) return;
      stressBusy = false;
      stressWorker.terminate();
      stressWorker = null;
      if (data.error) toast(data.error);
      else stressResult = data.result;
      if (section === "laboratorio") render();
    };
    stressWorker.onerror = () => {
      stressBusy = false;
      stressWorker?.terminate();
      toast("No se pudo completar la prueba de estrés.");
      render();
    };
    stressWorker.postMessage({ id, type: "stress", model: store.model });
  } catch {
    stressBusy = false;
    toast("El motor no pudo iniciarse.");
    render();
  }
}
function laboratory() {
  return (
    intro(
      "MOTOR 02 / EXPLORACIÓN DE POSIBILIDADES",
      "Encontrá tu <em>punto de equilibrio.</em>",
      "Un puesto extra puede cambiarlo todo. Descubrí dónde hace la diferencia.",
    ) +
    `<div class="wide-grid"><div><div class="hero-card"><div class="eyebrow">OPTIMIZADOR DE RECURSOS</div><h2>El mejor lugar para<br>tu próxima inversión.</h2><p>CAUCE evalúa todas las distribuciones posibles de puestos adicionales y busca la menor espera promedio.</p><label for="budget" style="color:inherit">¿Cuántos puestos podés sumar?</label><select id="budget">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${budget === n ? "selected" : ""}>${n} ${n === 1 ? "puesto adicional" : "puestos adicionales"}</option>`).join("")}</select><button class="coral" data-action="optimize" style="margin-top:20px;width:100%" ${busy ? "disabled" : ""}>${busy ? "Evaluando jornadas…" : "✧ Explorar todas las combinaciones"}</button></div><div class="note">Se comparan 5 jornadas idénticas por alternativa. Después, 20 jornadas nuevas validan el ahorro. Se asume que todos los puestos tienen el mismo costo y trabajan durante toda la jornada.</div></div><div class="panel pad">${busy ? '<div class="empty loading"><h2>Probando otras posibilidades…</h2><p>El cálculo corre en segundo plano. Podés seguir navegando.</p></div>' : opt ? `<span class="tag">${opt.tested} COMBINACIONES EVALUADAS</span><div class="result-number">${fmt(Math.max(0, opt.improvement))}<small style="font-size:22px"> min</small></div><h2>menos de espera por cliente</h2><p>Validación independiente: ${fmt(opt.improvement)} ± ${fmt(opt.margin)} min de ahorro medio. Intervalo aproximado del 95%.</p>${opt.model.stations.map((s, i) => `<div class="alloc"><span>${esc(s.name)}</span><b>${store.model.stations[i].servers} → ${s.servers} ${opt.allocation[i] ? `<span class="tag orange">+${opt.allocation[i]}</span>` : ""}</b></div>`).join("")}<p class="subtle">Espera de entrenamiento: ${fmt(opt.baseline)} → ${fmt(opt.wait)} min. ${opt.improvement - opt.margin <= 0 ? "La mejora no es concluyente: el intervalo incluye cero." : "La mejora se mantuvo en las jornadas de validación."}</p><button class="primary" data-action="apply" style="width:100%;margin-top:18px">Aplicar y guardar comparación →</button>` : `<div class="empty"><div style="font:90px Georgia;color:var(--accent)">↗</div><h2>Las decisiones se pueden ensayar.</h2><p>Elegí tu margen de crecimiento y dejá que el motor explore tu sistema.</p><p class="subtle">Proyecto actual: ${esc(store.model.name)}<br>${store.model.stations.length} estaciones · ${store.model.rate} llegadas/h</p></div>`}</div></div>` +
    stressPanel()
  );
}
function scenarios() {
  return (
    intro(
      "TU BIBLIOTECA DE POSIBILIDADES",
      "Una idea. <em>Muchos futuros.</em>",
      "Guardá variantes, compará sus resultados y recuperá cualquier punto de partida.",
      `<button data-action="import">Importar JSON</button><button data-action="export">Exportar proyecto</button><button class="primary" data-action="save">＋ Guardar actual</button>`,
    ) +
    (!store.scenarios.length
      ? `<div class="panel empty"><h2>Tu primera alternativa empieza acá.</h2><p>Guardá el sistema actual, cambiá una variable y compará qué sucede.</p><button class="primary" data-action="save">Guardar primer escenario</button></div>`
      : `<div class="scenario-grid">${store.scenarios
          .map((m, i) => {
            const r = simulate(m);
            return `<article class="panel pad scenario"><div class="title-row"><span class="eyebrow">ESCENARIO 0${i + 1}</span><button class="quiet small" data-remove="${i}" aria-label="Eliminar ${esc(m.name)}">×</button></div><h2>${esc(m.name)}</h2><p>${m.stations.length} estaciones · ${m.rate} llegadas/h</p><div class="metrics"><span><b>${fmt(r.wait)}</b><small>min de espera</small></span><span><b>${r.completed}</b><small>finalizados</small></span></div>${chart(r)}<button data-load="${i}" style="width:100%">Abrir en el estudio ↗</button></article>`;
          })
          .join(
            "",
          )}</div><div class="panel pad" style="margin-top:22px"><h2>Comparación de escenarios</h2><p class="subtle">Cada escenario usa su propia semilla y demanda. Para aislar un cambio, conservá esos parámetros.</p><div class="comparison"><table><thead><tr><th>Escenario</th><th>Puestos</th><th>Espera media</th><th>Percentil 95</th><th>Finalizados / llegadas</th></tr></thead><tbody>${store.scenarios
          .map((m) => {
            const r = simulate(m);
            return `<tr><td>${esc(m.name)}</td><td>${m.stations.reduce((a, s) => a + s.servers, 0)}</td><td>${fmt(r.wait)} min</td><td>${fmt(r.p95)} min</td><td>${r.completed} / ${r.arrived}</td></tr>`;
          })
          .join("")}</tbody></table></div></div>`)
  );
}
function report() {
  const m = store.model;
  return (
    intro(
      "DEL EXPERIMENTO A LA DECISIÓN",
      "Los números <em>cuentan una historia.</em>",
      esc(m.name) + " · Jornada simulada de " + m.duration + " minutos",
      `<button data-action="csv">Descargar CSV</button><button class="primary" data-action="print">Imprimir / PDF</button>`,
    ) +
    `<div class="stats">${stat("Espera promedio", fmt(result.wait), "min", "Incluye atención posterior al cierre")}${stat("Tiempo total promedio", fmt(result.cycle), "min", "Espera + atención")}${stat("Llegadas simuladas", result.arrived, "clientes", `${result.completed} finalizados al cierre`)}</div><div class="wide-grid" style="margin-top:22px"><div class="panel pad"><h2>Presión por estación</h2>${result.stations.map((s, i) => `<div class="value-row"><h3>${esc(m.stations[i].name)}</h3><strong>${Math.round(s.utilization * 100)}%</strong></div><div class="bar"><span style="width:${s.utilization * 100}%"></span></div><p class="subtle">${fmt(s.wait)} min de espera media · ${s.maxQueue} en cola como máximo (incluye después del cierre)</p>`).join("")}</div><div class="panel pad"><h2>La espera a lo largo del tiempo</h2>${chart(result)}<div class="rule"></div><h3>Un experimento reproducible</h3><p>Semilla ${m.seed} · ${m.rate} llegadas/h · ${m.stations.reduce((a, s) => a + s.servers, 0)} puestos. Al mantener la semilla, los cambios se comparan con las mismas llegadas.</p><p class="subtle">El modelo representa un recorrido secuencial sin abandonos, pausas ni límites de cola. Las llegadas siguen un proceso de Poisson y los tiempos de servicio una distribución uniforme. Es una herramienta de exploración, no una predicción garantizada de tu negocio.</p></div></div>`
  );
}
function guide() {
  return (
    intro(
      "BIENVENIDO A CAUCE",
      "Antes de cambiarlo, <em>ensayalo.</em>",
      "Un espacio para transformar intuiciones en experimentos concretos.",
    ) +
    `<div class="tour-grid">${[
      [
        "01",
        "Diseñá el recorrido",
        "Elegí una plantilla o renombrá las estaciones. Ajustá llegadas por hora, tiempos de atención y puestos. Arrastrá las estaciones o usá las flechas para reordenarlas.",
      ],
      [
        "02",
        "Mirá qué sucede",
        "Reproducí la jornada o mové el tiempo. Los puntos muestran clientes reales de la simulación; el contador incluye a todos, aunque se dibujan hasta 30 por estación.",
      ],
      [
        "03",
        "Probá otro futuro",
        "Abrí el laboratorio para redistribuir recursos. Guardá variantes, compará resultados y exportá una copia de tu proyecto.",
      ],
    ]
      .map(
        ([n, h, p]) =>
          `<article class="panel pad"><b>${n}</b><h3>${h}</h3><p>${p}</p></article>`,
      )
      .join(
        "",
      )}</div><div class="wide-grid" style="margin-top:22px"><div class="panel pad"><h2>Tu trabajo se queda con vos.</h2><p>Los proyectos se guardan únicamente en este navegador. No se envían datos a servidores. Exportá un JSON antes de borrar los datos del navegador o cambiar de dispositivo.</p><div class="toolbar"><button data-action="export">Exportar copia</button><button data-action="import">Importar proyecto</button><button data-action="theme">Cambiar tema</button></div></div><div class="panel pad"><h2>Menos clics, más ideas.</h2><p><kbd>Ctrl / ⌘ + Z</kbd> Deshacer · <kbd>Ctrl / ⌘ + Shift + Z</kbd> Rehacer<br><kbd>Espacio</kbd> Reproducir / pausar el estudio<br><kbd>1 — 4</kbd> Cambiar de sección</p><p class="subtle">Sin atajos mientras escribís. Compatible con teclado y preferencias de movimiento reducido. Los ejemplos son ficticios y sus parámetros son ilustrativos.</p></div></div><button class="primary" data-nav="estudio" style="margin-top:22px">Entrar al estudio →</button>`
  );
}
function selectStation(id) {
  selected = id;
  render();
  if (window.innerWidth <= 700)
    document
      .querySelector(".inspector")
      .scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
}
function render() {
  playing = false;
  document.body.dataset.theme = store.theme;
  $("#app").innerHTML =
    `<div class="shell">${header()}<main id="main" class="page">${{ estudio: studio, laboratorio: laboratory, escenarios: scenarios, informe: report, guia: guide }[section]()}</main><footer class="footer"><span>CAUCE / Diseñado para hacer espacio a mejores ideas.</span><span>100% local · Sin cuentas · v1.0</span></footer></div>`;
  bind();
  if (section === "estudio") draw();
}
function positions() {
  const n = store.model.stations.length;
  if (window.innerWidth <= 700)
    return store.model.stations.map((s, i) => ({ x: 180, y: 82 + i * 120 }));
  return store.model.stations.map((s, i) => ({
    x: 110 + (i % 3) * 220,
    y: n <= 3 ? 176 : i < 3 ? 119 : 253,
  }));
}
function draw() {
  const svg = $("#flow");
  if (!svg) return;
  const m = store.model,
    states = snapshot(result, time),
    pos = positions();
  const mobile = window.innerWidth <= 700,
    height = mobile ? store.model.stations.length * 120 + 48 : 355;
  svg.setAttribute("viewBox", `0 0 ${mobile ? 360 : 660} ${height}`);
  svg.style.height = mobile ? height + "px" : "";
  svg.parentElement.style.height = mobile ? height + "px" : "";
  let html = "";
  for (let i = 0; i < pos.length - 1; i++) {
    const a = pos[i],
      b = pos[i + 1];
    html += `<path class="edge" d="M${a.x},${a.y} C${a.x + 100},${a.y + 55} ${b.x - 100},${b.y + 55} ${b.x},${b.y}"/>`;
  }
  pos.forEach((p, i) => {
    const s = m.stations[i],
      v = states[i];
    html += `<g class="flow-node ${selected === s.id ? "selected" : ""}" data-node="${s.id}" tabindex="0" role="button" aria-label="Editar ${esc(s.name)}: ${v.queue} en espera"><rect x="${p.x - 86}" y="${p.y - 39}" width="172" height="84" rx="14"/><text x="${p.x - 70}" y="${p.y - 17}" class="caption">0${i + 1} / ${s.servers} ${s.servers === 1 ? "PUESTO" : "PUESTOS"}</text><text x="${p.x - 70}" y="${p.y + 5}" font-size="12" font-weight="600">${esc(s.name.length > 23 ? s.name.slice(0, 21) + "…" : s.name)}</text><text x="${p.x - 70}" y="${p.y + 27}" class="caption">${v.busy} atendiendo · ${v.queue} esperando</text></g>`;
    for (let j = 0; j < Math.min(v.queue, 30); j++)
      html += `<circle cx="${p.x - 72 + (j % 15) * 10}" cy="${p.y + 58 + Math.floor(j / 15) * 10}" r="3" fill="var(--accent)"/>`;
    for (let j = 0; j < v.busy; j++)
      html += `<circle cx="${p.x + 70 - j * 8}" cy="${p.y - 18}" r="2.5" fill="var(--green)"/>`;
  });
  svg.innerHTML = html;
  $("#clock").textContent = `${fmt(time, 0)} / ${m.duration} min`;
  $("#timeline").value = time;
  svg.querySelectorAll("[data-node]").forEach((e) => {
    e.onclick = () => {
      selectStation(e.dataset.node);
    };
    e.onkeydown = (k) => {
      if (k.key === "Enter" || k.key === " ") {
        k.preventDefault();
        e.onclick();
      }
    };
  });
}
function saveScenario() {
  if (store.scenarios.length >= 8)
    return toast("Ya tenés 8 escenarios. Eliminá uno para guardar otro.");
  dialog(
    "Guardar una posibilidad",
    `<label for="scenarioName">Nombre del escenario</label><input id="scenarioName" maxlength="80" value="${esc(store.model.name)}">`,
    () => {
      const name = $("#scenarioName").value.trim();
      if (!name) {
        toast("Escribí un nombre.");
        return false;
      }
      const m = structuredClone(store.model);
      m.name = name;
      store.scenarios.push(m);
      store.save();
      render();
      toast("Escenario guardado en este navegador.");
    },
    "Guardar",
  );
}
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function importFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const f = input.files[0];
    if (!f) return;
    if (f.size > 100000) return toast("El archivo supera el límite de 100 KB.");
    try {
      const m = validate(JSON.parse(await f.text()));
      dialog(
        "Abrir proyecto",
        `<p>Se abrirá “${esc(m.name)}”. Podés recuperar tu sistema anterior con Deshacer.</p>`,
        () => {
          changed(m);
          nav("estudio");
          toast("Proyecto importado.");
        },
        "Abrir",
      );
    } catch (e) {
      toast(e.message || "No se pudo leer el archivo.");
    }
  };
  input.click();
}
function optimize() {
  busy = true;
  opt = null;
  render();
  const id = ++job;
  try {
    worker?.terminate();
    worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.id !== job) return;
      busy = false;
      if (data.error) toast(data.error);
      else opt = data.result;
      worker.terminate();
      worker = null;
      if (section === "laboratorio") render();
      else toast("La comparación está lista en el laboratorio.");
    };
    worker.onerror = () => {
      busy = false;
      worker?.terminate();
      toast("No se pudo iniciar el motor. Recargá e intentá de nuevo.");
      if (section === "laboratorio") render();
    };
    worker.postMessage({ id, model: store.model, budget });
  } catch {
    busy = false;
    render();
    toast("Este navegador no pudo iniciar el motor de cálculo.");
  }
}
const actions = {
  stress: runStress,
  theme: () => {
    store.theme = store.theme === "light" ? "dark" : "light";
    store.save();
    document.body.dataset.theme = store.theme;
    render();
  },
  save: saveScenario,
  undo: () => {
    store.undo();
    refresh();
  },
  redo: () => {
    store.redo();
    refresh();
  },
  add: () =>
    update((m) => {
      if (m.stations.length >= 6) return;
      const id = "s" + Date.now().toString(36);
      m.stations.push({
        id,
        name: "Nueva estación",
        time: 2,
        servers: 1,
        variation: 0.3,
      });
      selected = id;
    }),
  delete: () =>
    dialog(
      "Eliminar estación",
      `<p>Se quitará esta estación del recorrido. Podés deshacer este cambio.</p>`,
      () =>
        update(
          (m) => (m.stations = m.stations.filter((s) => s.id !== selected)),
        ),
      "Eliminar",
    ),
  up: () => move(-1),
  down: () => move(1),
  play: () => {
    if (time >= store.model.duration) time = 0;
    playing = !playing;
    const b = $("[data-action=play]");
    b.textContent = playing ? "Ⅱ" : "▶";
    b.setAttribute(
      "aria-label",
      playing ? "Pausar simulación" : "Reproducir simulación",
    );
    last = performance.now();
  },
  speed: () => {
    speed = speed === 2 ? 5 : speed === 5 ? 10 : 2;
    $("[data-action=speed]").textContent = speed + "×";
  },
  optimize,
  apply: () => {
    if (!opt) return;
    if (store.scenarios.length > 6)
      return toast(
        "Liberá dos espacios en Escenarios antes de aplicar la comparación.",
      );
    const before = structuredClone(store.model),
      after = structuredClone(opt.model);
    before.name = (before.name + " · base").slice(0, 80);
    after.name = (after.name + " · optimizado").slice(0, 80);
    store.scenarios.push(before, after);
    changed(after);
    nav("estudio");
    toast("Mejora aplicada. Ambos escenarios quedaron guardados.");
  },
  export: () =>
    download(
      "cauce-proyecto.json",
      JSON.stringify(store.model, null, 2),
      "application/json",
    ),
  import: importFile,
  print: () => window.print(),
  csv: () => {
    const safe = (s) =>
      '"' +
      String(s)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Estacion",
        "Puestos",
        "Atencion_min",
        "Espera_media_min",
        "Ocupacion",
        "Cola_max",
      ],
      ...store.model.stations.map((s, i) => [
        s.name,
        s.servers,
        s.time,
        result.stations[i].wait,
        result.stations[i].utilization,
        result.stations[i].maxQueue,
      ]),
    ];
    download(
      "cauce-resultados.csv",
      "\uFEFF" + rows.map((r) => r.map(safe).join(";")).join("\r\n"),
      "text/csv;charset=utf-8",
    );
  },
};
function move(d) {
  update((m) => {
    const i = m.stations.findIndex((s) => s.id === selected),
      j = i + d;
    if (j < 0 || j >= m.stations.length) return;
    [m.stations[i], m.stations[j]] = [m.stations[j], m.stations[i]];
  });
}
function bind() {
  document.querySelectorAll("[data-rate]").forEach(
    (b) =>
      (b.onclick = () => {
        update((m) => (m.rate = +b.dataset.rate));
        nav("estudio");
        toast("Nivel de demanda aplicado. Podés deshacer el cambio.");
      }),
  );
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => (b.onclick = () => nav(b.dataset.nav)));
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => actions[b.dataset.action]?.()));
  document.querySelectorAll("[data-station]").forEach((b) => {
    b.onclick = () => {
      selectStation(b.dataset.station);
    };
    b.ondragstart = (e) => {
      dragId = b.dataset.station;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
    };
    b.ondragover = (e) => e.preventDefault();
    b.ondrop = (e) => {
      e.preventDefault();
      if (!dragId || dragId === b.dataset.station) return;
      update((m) => {
        const from = m.stations.findIndex((s) => s.id === dragId),
          to = m.stations.findIndex((s) => s.id === b.dataset.station);
        if (from < 0 || to < 0) return;
        const [s] = m.stations.splice(from, 1);
        m.stations.splice(to, 0, s);
      });
      dragId = null;
    };
  });
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () =>
        dialog(
          "Eliminar escenario",
          "<p>Esta copia guardada se eliminará. El proyecto abierto no cambia.</p>",
          () => {
            store.scenarios.splice(+b.dataset.remove, 1);
            store.save();
            render();
          },
          "Eliminar",
        )),
  );
  document.querySelectorAll("[data-load]").forEach(
    (b) =>
      (b.onclick = () =>
        dialog(
          "Abrir escenario",
          "<p>Tu proyecto actual se reemplazará. Podés recuperarlo con Deshacer.</p>",
          () => {
            changed(store.scenarios[+b.dataset.load]);
            nav("estudio");
          },
          "Abrir",
        )),
  );
  if ($("#budget"))
    $("#budget").onchange = (e) => {
      budget = +e.target.value;
      opt = null;
      render();
    };
  if (section !== "estudio") return;
  $("#preset").onchange = (e) => {
    const key = e.target.value;
    if (!key) return;
    dialog(
      "Cambiar punto de partida",
      "<p>Se cargará una plantilla ficticia. Tu proyecto actual se puede recuperar con Deshacer.</p>",
      () => changed(presets[key]),
      "Cargar plantilla",
    );
  };
  const field = (id, fn) => {
    $("#" + id).onchange = (e) => {
      if (!e.target.checkValidity()) {
        toast("Revisá el rango permitido.");
        render();
        return;
      }
      try {
        update((m) => fn(m, e.target.value));
      } catch (err) {
        toast(err.message);
        render();
      }
    };
  };
  field("projectName", (m, v) => (m.name = v.trim() || "Mi sistema"));
  field("rate", (m, v) => (m.rate = +v));
  field("duration", (m, v) => (m.duration = +v));
  field("seed", (m, v) => (m.seed = +v));
  $("#rate").oninput = (e) => ($("#rateValue").textContent = e.target.value);
  for (const [id, key, num] of [
    ["stationName", "name", false],
    ["serviceTime", "time", true],
    ["servers", "servers", true],
    ["variation", "variation", true],
  ])
    field(id, (m, v) => {
      m.stations.find((s) => s.id === selected)[key] =
        key === "variation" ? +v / 100 : num ? +v : v.trim();
    });
  $("#timeline").oninput = (e) => {
    playing = false;
    time = +e.target.value;
    $("[data-action=play]").textContent = "▶";
    draw();
  };
}
window.addEventListener("keydown", (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $("#dialog").open)
    return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    actions[e.shiftKey ? "redo" : "undo"]();
  } else if (e.code === "Space" && section === "estudio") {
    e.preventDefault();
    actions.play();
  } else if (["1", "2", "3", "4"].includes(e.key))
    nav(["estudio", "laboratorio", "escenarios", "informe"][+e.key - 1]);
});
window.addEventListener("resize", () => {
  if (section === "estudio") draw();
});
window.addEventListener("hashchange", () => {
  const s = location.hash.slice(1);
  if (
    ["estudio", "laboratorio", "escenarios", "informe", "guia"].includes(s) &&
    s !== section
  ) {
    section = s;
    playing = false;
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playing = false;
    if ($("[data-action=play]")) $("[data-action=play]").textContent = "▶";
  }
});
function tick(now) {
  if (playing && section === "estudio" && now - last > 60) {
    time = Math.min(
      store.model.duration,
      time + Math.min((now - last) / 1000, 0.25) * speed,
    );
    last = now;
    draw();
    if (time >= store.model.duration) {
      playing = false;
      $("[data-action=play]").textContent = "▶";
    }
  }
  requestAnimationFrame(tick);
}
render();
requestAnimationFrame(tick);
if (store.warning) toast(store.warning);
