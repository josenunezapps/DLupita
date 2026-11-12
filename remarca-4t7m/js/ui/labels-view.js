// Vista de etiquetas de góndola: hojas A4 en milímetros reales, con código de barras vectorial.
import { eanSVG } from '../core/ean.js';
import { moneyParts, formatMoney } from '../core/money.js';
import { categories, unitShort } from '../core/products.js';
import { $, $$, esc, hydrateIcons, icon, plural } from './dom.js';

export const SIZES = {
  chica: { label: 'Chica', hint: '24 por hoja, 66 × 35 mm', perPage: 24 },
  mediana: { label: 'Mediana', hint: '10 por hoja, 99 × 56 mm', perPage: 10 },
  grande: { label: 'Grande', hint: '6 por hoja, 99 × 93 mm', perPage: 6 },
};

export function labelProducts(data, spec, sel) {
  const ps = data.products;
  const list = spec.scope === 'pending' ? ps.filter((p) => p.pending) : spec.scope === 'offer' ? ps.filter((p) => p.offer)
    : spec.scope === 'cat' ? ps.filter((p) => p.category === spec.category) : spec.scope === 'sel' ? ps.filter((p) => sel.includes(p.id)) : ps;
  return [...list].sort((a, b) => (a.category || 'zzz').localeCompare(b.category || 'zzz', 'es') || a.name.localeCompare(b.name, 'es'));
}

export function labelHTML(p, spec, shop, date) {
  const m = moneyParts(p.price);
  const foot = [spec.shopName && shop.name ? esc(shop.name) : '', spec.date ? `Precio al ${date}` : '', !spec.barcode && p.code ? esc(p.code) : ''].filter(Boolean).join('<br>');
  const bars = spec.barcode ? eanSVG(p.code) : '';
  return `<div class="lab ${p.offer ? 'is-offer' : ''}">
    ${p.offer ? '<span class="lab-offer">OFERTA</span>' : ''}
    <div class="lab-name">${esc(p.name)}</div>
    <div class="lab-price"><i>$</i><b class="${m.int.length > 6 ? 'long' : ''}">${m.int}</b>${m.dec ? `<sup>${m.dec}</sup>` : ''}<span>${unitShort(p.unit)}</span></div>
    <div class="lab-foot"><div>${p.offer && p.prev > p.price ? `<s>Antes ${formatMoney(p.prev)}</s>` : ''}${foot}</div>${bars || (spec.barcode && p.code ? `<div>${esc(p.code)}</div>` : '')}</div>
  </div>`;
}

export function pagesHTML(list, spec, shop, date = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(new Date())) {
  const per = SIZES[spec.size].perPage, pages = [];
  for (let i = 0; i < list.length; i += per) pages.push(`<div class="page" data-size="${spec.size}">${list.slice(i, i + per).map((p) => labelHTML(p, spec, shop, date)).join('')}</div>`);
  return pages;
}

export function createLabelsView(app) {
  const root = $('#v-labels'), store = app.store;
  root.innerHTML = `
    <header><div><h1>Etiquetas</h1><p>Hojas A4 para recortar y poner en la góndola. Después de remarcar, imprimí sólo las que cambiaron.</p></div></header>
    <div class="labels-layout">
      <div class="panel">
        <div class="group"><h3>Qué imprimir</h3><div class="chips" id="lbScope" role="radiogroup" aria-label="Qué imprimir"></div>
          <label class="field" id="lbCatField" hidden><span class="sr">Categoría</span><select id="lbCat"></select></label></div>
        <div class="group"><h3>Tamaño</h3><div class="choices" role="radiogroup" aria-label="Tamaño">${Object.entries(SIZES).map(([k, s]) => `<button type="button" class="choice" role="radio" data-size="${k}"><b>${s.label}</b><small>${s.hint}</small></button>`).join('')}</div></div>
        <div class="group"><h3>Qué lleva cada etiqueta</h3>
          <label class="check"><input id="lbBarcode" type="checkbox"><span>Código de barras, si el producto lo tiene</span></label>
          <label class="check"><input id="lbDate" type="checkbox"><span>Fecha del precio</span></label>
          <label class="check"><input id="lbShop" type="checkbox"><span>Nombre del negocio</span></label>
        </div>
        <p class="summary" id="lbSummary" aria-live="polite"></p>
        <button type="button" class="btn primary big wide" data-act="print">${icon('print')}Imprimir o guardar en PDF</button>
        <button type="button" class="btn wide" data-act="done" id="lbDone">${icon('check')}Ya las imprimí: marcarlas como impresas</button>
        <p class="fine">En el cuadro de impresión elegí tamaño A4, escala 100 % y sin márgenes. Para guardarlas, elegí «Guardar como PDF» como impresora.</p>
      </div>
      <div class="sheets" id="lbSheets"></div>
    </div>`;
  hydrateIcons(root);
  const spec = () => store.get().labels;
  const patch = (p) => store.set({ labels: { ...spec(), ...p } });

  function scale() {
    $$('.page-wrap', root).forEach((wrap) => {
      const page = wrap.firstElementChild, k = wrap.clientWidth / page.offsetWidth;
      page.style.transform = `scale(${k})`; wrap.style.height = page.offsetHeight * k + 'px';
    });
  }
  new ResizeObserver(scale).observe($('#lbSheets'));

  function render() {
    const s = store.get(), data = s.model, sp = s.labels;
    const count = { all: data.products.length, pending: data.products.filter((p) => p.pending).length, offer: data.products.filter((p) => p.offer).length, sel: s.sel.length };
    const scopes = [['pending', 'Sin imprimir'], ['all', 'Todas'], ['offer', 'Ofertas'], ...(count.sel ? [['sel', 'Las elegidas']] : []), ...(categories(data).length ? [['cat', 'Una categoría']] : [])];
    $('#lbScope').innerHTML = scopes.map(([k, label]) => `<button type="button" class="chip" role="radio" data-scope="${k}" aria-checked="${sp.scope === k}">${label}${count[k] != null ? ` <small>${count[k]}</small>` : ''}</button>`).join('');
    $('#lbCatField').hidden = sp.scope !== 'cat';
    $('#lbCat').innerHTML = categories(data).map((c) => `<option ${c === sp.category ? 'selected' : ''}>${esc(c)}</option>`).join('');
    $$('[data-size]', root).forEach((b) => b.setAttribute('aria-checked', b.dataset.size === sp.size));
    $('#lbBarcode').checked = sp.barcode; $('#lbDate').checked = sp.date; $('#lbShop').checked = sp.shopName;
    const list = labelProducts(data, sp, s.sel), pages = pagesHTML(list, sp, data.shop);
    $('#lbSummary').textContent = list.length ? `${plural(list.length, 'etiqueta', 'etiquetas')} en ${plural(pages.length, 'hoja', 'hojas')} A4.` : 'No hay etiquetas para imprimir con esta elección.';
    $('#lbDone').hidden = !list.some((p) => p.pending);
    root.querySelector('[data-act="print"]').disabled = !list.length;
    $('#lbSheets').innerHTML = list.length
      ? pages.slice(0, 3).map((p) => `<div class="page-wrap">${p}</div>`).join('') + (pages.length > 3 ? `<p class="hint">Se muestran 3 de ${pages.length} hojas. Se imprimen todas.</p>` : '')
      : `<div class="blank" style="width:100%"><h2>${sp.scope === 'pending' && data.products.length ? 'Todo al día' : 'Nada para imprimir'}</h2><p>${sp.scope === 'pending' && data.products.length ? 'No hay etiquetas pendientes. Cuando cambies un precio, su etiqueta aparece acá.' : 'Elegí otro grupo de productos o cargá productos primero.'}</p>${data.products.length ? '<button type="button" class="btn" data-scope="all">Ver todas</button>' : ''}</div>`;
    scale();
  }

  function print() {
    const s = store.get(), list = labelProducts(s.model, s.labels, s.sel);
    if (!list.length) return;
    $('#printRoot').innerHTML = pagesHTML(list, s.labels, s.model.shop).join('');
    window.print();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.scope) patch({ scope: b.dataset.scope, category: spec().category || categories(store.get().model)[0] || '' });
    else if (b.dataset.size) patch({ size: b.dataset.size });
    else if (b.dataset.act === 'print') print();
    else if (b.dataset.act === 'done') {
      const s = store.get(), ids = new Set(labelProducts(s.model, s.labels, s.sel).filter((p) => p.pending).map((p) => p.id));
      store.mutate((d) => d.products.forEach((p) => { if (ids.has(p.id)) p.pending = false; }), { label: 'marcar impresas' });
      app.toast(`${plural(ids.size, 'etiqueta marcada como impresa', 'etiquetas marcadas como impresas')}`, { action: { label: 'Deshacer', run: () => store.undo() } });
    }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'lbCat') patch({ category: t.value });
    else if (t.id === 'lbBarcode') patch({ barcode: t.checked });
    else if (t.id === 'lbDate') patch({ date: t.checked });
    else if (t.id === 'lbShop') patch({ shopName: t.checked });
  });

  return { render, print };
}
