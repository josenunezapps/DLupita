// Vista del negocio: identidad (nombre, colores, logo) y manejo de datos (importar, exportar, copias).
import { parseCSV, rowsToProducts } from '../core/csv.js';
import { mergeImport } from '../core/products.js';
import { contrast } from './poster.js';
import { $, $$, esc, hydrateIcons, icon, plural } from './dom.js';

const PRESETS = [['#E4002B', '#FFE600'], ['#0B5FFF', '#FFFFFF'], ['#14161F', '#FFD000'], ['#0B7A43', '#F4FF61'], ['#FF5A00', '#FFF3D6'], ['#7A1FA2', '#FFE600'], ['#D4006A', '#D8FFF4'], ['#FFFFFF', '#14161F']];

export function createShopView(app) {
  const root = $('#v-shop'), store = app.store;
  root.innerHTML = `
    <header><div><h1>Negocio</h1><p>El nombre, los colores y el logo se aplican a todos los carteles y etiquetas.</p></div></header>
    <div class="shop-grid">
      <div class="panel">
        <h2>Identidad</h2>
        <label class="field"><span>Nombre del negocio</span><input id="shName" type="text" maxlength="50" autocomplete="organization" placeholder="Ej.: Almacén La Esquina"></label>
        <label class="field"><span>Dirección, horario o teléfono (una línea)</span><input id="shTagline" type="text" maxlength="80" autocomplete="off" placeholder="Ej.: San Martín 450, de 9 a 21"></label>
        <div class="group"><h3>Colores de los carteles</h3>
          <div class="swatches" id="shPresets">${PRESETS.map(([a, b], i) => `<button type="button" class="swatch" data-preset="${i}" aria-label="Combinación ${i + 1}"><span style="background:${a}"></span><span style="background:${b}"></span></button>`).join('')}</div>
          <div class="colors">
            <label class="field"><span>Principal</span><input id="shColor" type="color"></label>
            <label class="field"><span>Fondo</span><input id="shColor2" type="color"></label>
          </div>
          <div class="sample" id="shSample"></div>
        </div>
        <div class="group"><h3>Logo (opcional)</h3>
          <div class="logo-box" id="shLogo"></div>
          <p class="fine">Se achica a 320 píxeles y se guarda en este dispositivo. No se sube a ningún lado.</p>
        </div>
      </div>
      <div class="panel">
        <h2>Tus datos</h2>
        <div class="group"><h3>Lista de precios</h3>
          <div class="row"><button type="button" class="btn primary" data-act="import-list">${icon('upload')}Importar desde Excel</button><button type="button" class="btn" data-act="export-csv">${icon('download')}Exportar a Excel</button></div>
          <p class="fine">Al importar una lista nueva, los productos que ya tenías actualizan su precio y sólo esos quedan con la etiqueta sin imprimir.</p>
        </div>
        <div class="group"><h3>Copia de seguridad</h3>
          <div class="row"><button type="button" class="btn" data-act="backup">${icon('download')}Guardar una copia</button><button type="button" class="btn" data-act="restore">${icon('upload')}Recuperar una copia</button></div>
          <p class="fine" id="shStorage"></p>
        </div>
        <div class="group"><h3>Empezar de nuevo</h3>
          <div class="row"><button type="button" class="btn" data-act="demo">Cargar el almacén de ejemplo</button><button type="button" class="btn danger" data-act="wipe">${icon('trash')}Borrar todo</button></div>
        </div>
      </div>
    </div>`;
  hydrateIcons(root);

  function render() {
    const { shop } = store.get().model;
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el && el.value !== v) el.value = v; };
    set('#shName', shop.name); set('#shTagline', shop.tagline); set('#shColor', shop.color.toLowerCase()); set('#shColor2', shop.color2.toLowerCase());
    $$('[data-preset]', root).forEach((b) => { const [a, c] = PRESETS[+b.dataset.preset]; b.setAttribute('aria-pressed', a.toLowerCase() === shop.color.toLowerCase() && c.toLowerCase() === shop.color2.toLowerCase()); });
    $('#shSample').innerHTML = `<span style="background:${shop.color2};color:${contrast(shop.color2)};padding:10px 16px;font:400 26px/1 var(--display);text-transform:uppercase">Oferta</span><span style="background:${shop.color};color:${contrast(shop.color)};padding:10px 18px;font:400 26px/1 var(--display)">$ 4.850</span><span class="fine">Así se combinan en un cartel.</span>`;
    $('#shLogo').innerHTML = shop.logo
      ? `<img src="${esc(shop.logo)}" alt="Logo del negocio"><button type="button" class="btn" data-act="logo">Cambiar</button><button type="button" class="btn danger" data-act="logo-remove">Quitar</button>`
      : `<button type="button" class="btn" data-act="logo">${icon('upload')}Elegir una imagen</button>`;
    $('#shStorage').textContent = app.persist.volatile
      ? 'Este navegador no deja guardar (modo privado o almacenamiento bloqueado). Guardá una copia antes de cerrar.'
      : 'Todo queda guardado sólo en este navegador y este dispositivo. Si borrás los datos del sitio o cambiás de teléfono, se pierde: guardá una copia cada tanto.';
  }

  const text = (id, key, label) => $(id).addEventListener('change', (e) => store.mutate((d) => { d.shop[key] = e.target.value.replace(/\s+/g, ' ').trim(); }, { label }));
  text('#shName', 'name', 'cambiar nombre'); text('#shTagline', 'tagline', 'cambiar datos del negocio');
  // Los selectores de color disparan muchos eventos al arrastrar: se agrupan en un solo paso del historial.
  for (const [id, key] of [['#shColor', 'color'], ['#shColor2', 'color2']]) {
    let open = false;
    $(id).addEventListener('input', (e) => { if (!open) { store.begin('cambiar color'); open = true; } store.mutate((d) => { d.shop[key] = e.target.value.toUpperCase(); }, { record: false }); });
    $(id).addEventListener('change', () => { store.commit(); open = false; });
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const A = app.actions;
    if (b.dataset.preset != null) { const [a, c] = PRESETS[+b.dataset.preset]; store.mutate((d) => { d.shop.color = a; d.shop.color2 = c; }, { label: 'cambiar colores' }); }
    else ({ 'import-list': A.importList, 'export-csv': A.exportCSV, backup: A.backup, restore: A.restore, demo: A.loadDemo, wipe: A.wipe, logo: () => $('#fileLogo').click(), 'logo-remove': () => store.mutate((d) => { d.shop.logo = null; }, { label: 'quitar logo' }) })[b.dataset.act]?.();
  });
  return { render };
}

/** Lee una imagen, la achica y devuelve un data URL PNG liviano. */
export function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('El archivo no es una imagen.'));
    if (file.size > 8e6) return reject(new Error('La imagen pesa más de 8 MB. Elegí una más liviana.'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const out = c.toDataURL('image/png');
      out.length < 380000 ? resolve(out) : reject(new Error('El logo quedó demasiado pesado. Probá con una imagen más simple.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer esa imagen.')); };
    img.src = url;
  });
}

/** Diálogo para importar una lista: pegar desde Excel o elegir un archivo, revisar y confirmar. */
export function openImport(app, initialText = '') {
  const dlg = $('#sheet'), store = app.store;
  dlg.innerHTML = `<form method="dialog" novalidate>
    <h2>Importar lista de precios</h2>
    <div class="dlg-scroll">
      <p class="hint">Copiá las filas en Excel o Google Sheets y pegalas acá, o elegí un archivo CSV. Alcanza con dos columnas: nombre y precio. También se aceptan categoría, código y unidad.</p>
      <label class="field"><span>Filas de la lista</span><textarea id="imText" spellcheck="false" placeholder="Yerba mate 1 kg	4850	Almacén&#10;Leche entera 1 L	1450	Lácteos"></textarea></label>
      <div class="row"><button type="button" class="btn" data-act="file">${icon('upload')}Elegir un archivo</button></div>
      <div id="imResult" aria-live="polite"></div>
    </div>
    <div class="row end"><button type="button" class="btn" data-act="cancel">Cancelar</button><button class="btn primary" id="imApply" disabled>Importar</button></div></form>`;
  const form = dlg.querySelector('form'), area = $('#imText');
  let parsed = null;
  const review = () => {
    const txt = area.value;
    if (!txt.trim()) { parsed = null; $('#imResult').innerHTML = ''; $('#imApply').disabled = true; return; }
    parsed = rowsToProducts(parseCSV(txt));
    const { items, errors } = parsed;
    $('#imResult').innerHTML = `<p class="summary">${items.length ? `${plural(items.length, 'producto listo', 'productos listos')} para importar.` : 'No se reconoció ningún producto.'}${errors.length ? ` ${plural(errors.length, 'renglón tiene', 'renglones tienen')} problemas y no se importan.` : ''}</p>`
      + (errors.length ? `<ul class="errors" style="margin-top:12px">${errors.slice(0, 6).map((e) => `<li>Renglón ${e.line}: ${esc(e.message)} <span class="fine">(${esc(e.text)})</span></li>`).join('')}${errors.length > 6 ? `<li>y ${errors.length - 6} más.</li>` : ''}</ul>` : '');
    $('#imApply').disabled = !items.length;
    $('#imApply').textContent = items.length ? `Importar ${plural(items.length, 'producto', 'productos')}` : 'Importar';
  };
  area.addEventListener('input', review);
  form.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cancel') dlg.close();
    if (act === 'file') $('#fileCsv').click();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!parsed?.items.length) return;
    let r;
    store.mutate((d) => { r = mergeImport(d, parsed.items); }, { label: 'importar lista' });
    dlg.close();
    const bits = [r.added && plural(r.added, 'nuevo', 'nuevos'), r.updated && plural(r.updated, 'precio actualizado', 'precios actualizados'), r.unchanged && `${r.unchanged} sin cambios`, r.skipped && `${r.skipped} no entraron por el límite`].filter(Boolean);
    app.toast(`Lista importada: ${bits.join(', ')}`, { duration: 6000, action: { label: 'Deshacer', run: () => store.undo() } });
    store.set({ view: 'products' });
  });
  app.fillImport = (text) => { area.value = text; review(); };
  dlg.addEventListener('close', () => { app.fillImport = null; }, { once: true });
  dlg.showModal();
  if (initialText) app.fillImport(initialText); else area.focus();
}
