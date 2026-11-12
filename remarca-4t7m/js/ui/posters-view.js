// Vista de carteles: elegís producto, estilo y formato; se dibuja en vivo y se descarga o comparte como imagen.
import { formatMoney } from '../core/money.js';
import { makeZip } from '../core/zip.js';
import { FORMATS, TEMPLATES, canvasBlob, renderPoster } from './poster.js';
import { $, $$, download, esc, hydrateIcons, icon, plural, slug } from './dom.js';

export function createPostersView(app) {
  const root = $('#v-posters'), store = app.store;
  root.innerHTML = `
    <header><div><h1>Carteles</h1><p>Imágenes listas para el estado de WhatsApp, Instagram o para imprimir y pegar en la vidriera.</p></div></header>
    <div class="studio">
      <div class="panel">
        <div class="group"><h3>Estilo</h3><div class="choices" role="radiogroup" aria-label="Estilo">${Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="choice" role="radio" data-template="${k}"><b>${t.label}</b><small>${t.multi ? 'Varios productos' : 'Un producto'}</small></button>`).join('')}</div></div>
        <div class="group" id="poOne"><label class="field"><span>Producto</span><select id="poProduct"></select></label></div>
        <div class="group" id="poMany" hidden><h3>Productos de la lista (hasta ${TEMPLATES.lista.max})</h3><div class="picklist" id="poPick"></div>
          <div class="row"><button type="button" class="btn" data-act="pick-offers">Usar las ofertas</button><button type="button" class="btn" data-act="pick-none">Vaciar</button></div></div>
        <div class="group"><h3>Formato</h3><div class="choices" role="radiogroup" aria-label="Formato">${Object.entries(FORMATS).map(([k, f]) => `<button type="button" class="choice" role="radio" data-format="${k}"><b>${f.label}</b><small>${f.hint}</small></button>`).join('')}</div></div>
        <div class="grid2">
          <label class="field"><span>Título</span><input id="poTitle" type="text" maxlength="28" autocomplete="off"></label>
          <label class="field"><span>Frase al pie</span><input id="poNote" type="text" maxlength="40" autocomplete="off" placeholder="Ej.: Solo por hoy"></label>
        </div>
        <label class="check"><input id="poBefore" type="checkbox"><span>Mostrar el precio anterior tachado</span></label>
        <label class="check"><input id="poShop" type="checkbox"><span>Firmar con el nombre del negocio</span></label>
      </div>
      <div class="stage">
        <canvas id="poCanvas" role="img" aria-label="Vista previa del cartel"></canvas>
        <p class="fine" id="poInfo" aria-live="polite"></p>
        <div class="row">
          <button type="button" class="btn primary big" data-act="download">${icon('download')}Descargar imagen</button>
          <button type="button" class="btn big" data-act="share" id="poShare" hidden>${icon('share')}Compartir</button>
        </div>
        <button type="button" class="btn wrap" data-act="zip" id="poZip">${icon('zip')}<span></span></button>
      </div>
    </div>`;
  hydrateIcons(root);
  const canvas = $('#poCanvas');
  let queued = false;

  const spec = () => store.get().poster;
  const patch = (p) => store.set({ poster: { ...spec(), ...p } });

  function draw() {
    queued = false;
    if (store.get().view !== 'posters') return;
    const s = store.get(), sp = s.poster, f = FORMATS[sp.format];
    const info = renderPoster(canvas, { data: s.model, spec: sp, logo: app.logo });
    $('#poInfo').textContent = `${f.w} × ${f.h} píxeles, PNG. ${TEMPLATES[sp.template].multi ? plural(info.count, 'producto', 'productos') : info.product.price ? `${info.product.name}, ${formatMoney(info.product.price)}` : 'Elegí un producto'}`;
  }

  function render() {
    const s = store.get(), data = s.model, sp = s.poster, tpl = TEMPLATES[sp.template];
    $$('[data-template]', root).forEach((b) => b.setAttribute('aria-checked', b.dataset.template === sp.template));
    $$('[data-format]', root).forEach((b) => b.setAttribute('aria-checked', b.dataset.format === sp.format));
    $('#poOne').hidden = tpl.multi; $('#poMany').hidden = !tpl.multi;
    const sorted = [...data.products].sort((a, b) => Number(b.offer) - Number(a.offer) || a.name.localeCompare(b.name, 'es'));
    const chosen = new Set(sp.productIds);
    if (!tpl.multi) {
      $('#poProduct').innerHTML = sorted.length ? sorted.map((p) => `<option value="${p.id}" ${p.id === sp.productIds[0] ? 'selected' : ''}>${p.offer ? '★ ' : ''}${esc(p.name)} (${formatMoney(p.price)})</option>`).join('') : '<option value="">No hay productos cargados</option>';
    } else {
      $('#poPick').innerHTML = sorted.map((p) => `<label><input type="checkbox" data-id="${p.id}" ${chosen.has(p.id) ? 'checked' : ''} ${!chosen.has(p.id) && chosen.size >= tpl.max ? 'disabled' : ''}><span>${p.offer ? '★ ' : ''}${esc(p.name)}</span><em>${formatMoney(p.price)}</em></label>`).join('') || '<p class="hint" style="padding:12px">No hay productos cargados.</p>';
    }
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el && el.value !== v) el.value = v; };
    set('#poTitle', sp.title); $('#poTitle').placeholder = tpl.title; set('#poNote', sp.note);
    $('#poBefore').checked = sp.showBefore; $('#poShop').checked = sp.showShop;
    const offers = data.products.filter((p) => p.offer).length;
    $('#poZip').hidden = tpl.multi || offers < 2;
    $('#poZip span').textContent = `Descargar un cartel por cada oferta (${offers}) en un .zip`;
    if (!queued) { queued = true; requestAnimationFrame(draw); }
  }

  /** Mantiene la selección de productos coherente con el estilo y con lo que existe. */
  function normalize() {
    const s = store.get(), sp = s.poster, tpl = TEMPLATES[sp.template];
    const exists = new Set(s.model.products.map((p) => p.id));
    let ids = sp.productIds.filter((id) => exists.has(id));
    if (!tpl.multi) { if (!ids.length && s.model.products.length) ids = [(s.model.products.find((p) => p.offer) || s.model.products[0]).id]; ids = ids.slice(0, 1); }
    else if (!ids.length && sp.productIds.length === 0 && !sp.touched) ids = s.model.products.filter((p) => p.offer).slice(0, tpl.max).map((p) => p.id);
    if (ids.join() !== sp.productIds.join()) { patch({ productIds: ids }); return true; }
    return false;
  }

  const fileName = (sp, product) => `${slug(TEMPLATES[sp.template].multi ? (sp.title || TEMPLATES[sp.template].title) : `oferta ${product.name}`)}-${sp.format}.png`;

  root.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.template) {
      const multi = TEMPLATES[b.dataset.template].multi, was = TEMPLATES[spec().template].multi;
      patch({ template: b.dataset.template, title: '', productIds: multi === was ? spec().productIds : multi ? [] : spec().productIds.slice(0, 1), touched: false });
    } else if (b.dataset.format) patch({ format: b.dataset.format });
    else if (b.dataset.act === 'pick-offers') patch({ productIds: store.get().model.products.filter((p) => p.offer).slice(0, TEMPLATES.lista.max).map((p) => p.id), touched: true });
    else if (b.dataset.act === 'pick-none') patch({ productIds: [], touched: true });
    else if (b.dataset.act === 'download' || b.dataset.act === 'share') {
      const s = store.get();
      if (!s.model.products.length) return app.toast('Cargá un producto para armar el cartel', { kind: 'error' });
      const info = renderPoster(canvas, { data: s.model, spec: s.poster, logo: app.logo });
      try {
        const blob = await canvasBlob(canvas), name = fileName(s.poster, info.product);
        if (b.dataset.act === 'share') {
          const file = new File([blob], name, { type: 'image/png' });
          try { await navigator.share({ files: [file], title: info.product.name }); } catch (err) { if (err?.name !== 'AbortError') throw err; }
        } else { download(name, blob); app.toast('Cartel descargado'); }
      } catch { app.toast('No se pudo generar la imagen. Probá con otro formato.', { kind: 'error' }); }
    } else if (b.dataset.act === 'zip') zipOffers();
  });

  async function zipOffers() {
    const s = store.get(), offers = s.model.products.filter((p) => p.offer);
    const close = app.toast(`Armando ${offers.length} carteles…`, { duration: 60000 });
    const off = document.createElement('canvas'), files = [];
    try {
      for (const p of offers) {
        const sp = { ...s.poster, productIds: [p.id] };
        renderPoster(off, { data: s.model, spec: sp, logo: app.logo });
        files.push({ name: fileName(sp, p), data: new Uint8Array(await (await canvasBlob(off)).arrayBuffer()) });
        await new Promise((r) => setTimeout(r)); // deja respirar a la interfaz entre carteles
      }
      download(`ofertas-${slug(s.model.shop.name || 'remarca')}.zip`, new Blob([makeZip(files)], { type: 'application/zip' }));
      close(); app.toast(`${offers.length} carteles descargados en un .zip`);
    } catch { close(); app.toast('No se pudieron generar todos los carteles', { kind: 'error' }); }
    draw();
  }

  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'poProduct') patch({ productIds: t.value ? [t.value] : [] });
    else if (t.id === 'poBefore') patch({ showBefore: t.checked });
    else if (t.id === 'poShop') patch({ showShop: t.checked });
    else if (t.dataset.id) { const ids = spec().productIds.filter((id) => id !== t.dataset.id); if (t.checked) ids.push(t.dataset.id); patch({ productIds: ids, touched: true }); }
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'poTitle') patch({ title: e.target.value });
    else if (e.target.id === 'poNote') patch({ note: e.target.value });
  });

  try { $('#poShare').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] })); } catch { /* sin compartir nativo */ }

  return { render() { if (!normalize()) render(); }, draw, canvas };
}
