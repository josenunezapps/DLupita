import { h, mount, field, showErrors, formValues, banner, busy, toast } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { parsePercentToBp, bpToPercentText } from '../lib/money.js';
import * as v from '../lib/validate.js';
import { shell } from './shell.js?v=20261108-fix2';

const MAX_LOGO_CHARS = 300000;

export function settingsView(ctx, route) {
  const org = ctx.state.org;
  const welcome = location.hash.includes('bienvenida=1');
  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar');
  let logo = org.logo_data_url || null;

  // ---- Logo ----
  const logoImg = h('img', { class: 'logo-preview', alt: 'Logo del negocio' });
  const logoEmpty = h('div', { class: 'logo-empty', 'aria-hidden': 'true' }, 'Sin logo');
  const logoInput = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 'logo-file', class: 'sr-only' });
  const logoRemove = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'Quitar');
  const logoErr = h('p', { class: 'field-error', role: 'alert', hidden: true });
  function paintLogo() {
    logoImg.hidden = !logo;
    logoEmpty.hidden = Boolean(logo);
    logoRemove.hidden = !logo;
    if (logo) logoImg.src = logo;
  }
  logoInput.addEventListener('change', async () => {
    const file = logoInput.files[0];
    logoErr.hidden = true;
    if (!file) return;
    try {
      logo = await resizeImage(file);
      paintLogo();
    } catch (err) {
      logoErr.textContent = err.message;
      logoErr.hidden = false;
    }
    logoInput.value = '';
  });
  logoRemove.addEventListener('click', () => {
    logo = null;
    paintLogo();
  });
  paintLogo();

  // ---- Color ----
  const colorField = field({ name: 'brand_color', label: 'Color de marca', type: 'color', value: org.brand_color, hint: 'Se usa en el encabezado de tus presupuestos.' });

  // ---- Impuesto ----
  const taxToggle = h('input', { type: 'checkbox', name: 'tax_enabled', id: 'f-tax_enabled', checked: org.tax_enabled });
  const taxFields = h('div', { class: 'form-grid nested' },
    field({ name: 'tax_name', label: 'Nombre del impuesto', value: org.tax_name, attrs: { maxlength: v.LIMITS.taxName } }),
    field({ name: 'tax_rate', label: 'Tasa (%)', value: bpToPercentText(org.tax_rate_bp), hint: 'Ej: 21 o 10,5', attrs: { inputmode: 'decimal' } }),
  );
  const syncTax = () => { taxFields.hidden = !taxToggle.checked; };
  taxToggle.addEventListener('change', syncTax);
  syncTax();

  const form = h('form', { novalidate: true, class: 'stack' },
    h('section', { class: 'card form-grid' },
      h('h2', { class: 'span-all' }, 'Datos que ve tu cliente'),
      field({ name: 'name', label: 'Nombre del negocio', value: org.name, required: true, attrs: { maxlength: v.LIMITS.orgName } }),
      field({ name: 'legal_name', label: 'Razón social', value: org.legal_name, attrs: { maxlength: v.LIMITS.legalName } }),
      field({ name: 'tax_id', label: 'CUIT', value: org.tax_id, attrs: { maxlength: v.LIMITS.taxId, inputmode: 'numeric' } }),
      field({ name: 'phone', label: 'Teléfono / WhatsApp', type: 'tel', value: org.phone, attrs: { maxlength: v.LIMITS.phone, inputmode: 'tel' } }),
      field({ name: 'email', label: 'Email', type: 'email', value: org.email, attrs: { maxlength: v.LIMITS.email, inputmode: 'email' } }),
      field({ name: 'address', label: 'Dirección', value: org.address, attrs: { maxlength: v.LIMITS.address } }),
    ),
    h('section', { class: 'card form-grid' },
      h('h2', { class: 'span-all' }, 'Marca'),
      h('div', { class: 'field logo-field' },
        h('span', { class: 'label' }, 'Logo'),
        h('div', { class: 'logo-row' },
          h('div', { class: 'logo-box' }, logoImg, logoEmpty),
          h('label', { for: 'logo-file', class: 'btn btn-secondary btn-sm' }, 'Elegir imagen'),
          logoInput,
          logoRemove,
        ),
        h('p', { class: 'hint' }, 'PNG, JPG o WebP. Se achica automáticamente.'),
        logoErr,
      ),
      colorField,
    ),
    h('section', { class: 'card form-grid' },
      h('h2', { class: 'span-all' }, 'Presupuestos'),
      field({ name: 'currency', label: 'Moneda', value: org.currency, options: [['ARS', 'Pesos argentinos (ARS)'], ['USD', 'Dólares (USD)']] }),
      field({ name: 'default_validity_days', label: 'Validez por defecto (días)', type: 'number', value: org.default_validity_days, attrs: { min: 1, max: 365, inputmode: 'numeric' } }),
      h('div', { class: 'span-all' },
        field({ name: 'terms', label: 'Condiciones y notas', value: org.terms, multiline: true, hint: 'Ej: forma de pago, plazos, qué incluye. Aparecen al pie del presupuesto.', attrs: { maxlength: v.LIMITS.terms } }),
      ),
      h('div', { class: 'span-all' },
        h('label', { class: 'toggle', for: 'f-tax_enabled' }, taxToggle, ' Sumar un impuesto al total'),
        h('p', { class: 'hint' }, 'Desactivado por defecto. CotizaPro no emite comprobantes fiscales.'),
        taxFields,
      ),
    ),
    status,
    h('div', { class: 'form-actions sticky-actions' }, submit),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const rate = val.tax_enabled ? parsePercentToBp(val.tax_rate) : { ok: true, value: org.tax_rate_bp };
    const errors = v.collect({
      name: [v.required(val.name, 'El nombre'), v.maxLen(val.name.trim(), v.LIMITS.orgName, 'El nombre')],
      email: v.email(val.email),
      brand_color: v.hexColor(val.brand_color),
      default_validity_days: v.intRange(val.default_validity_days, 1, 365, 'La validez'),
      tax_name: val.tax_enabled ? v.required(val.tax_name, 'El nombre del impuesto') : null,
      tax_rate: rate.ok ? null : rate.error,
    });
    if (!showErrors(form, errors)) return;
    const patch = {
      name: val.name.trim(),
      legal_name: v.emptyToNull(val.legal_name),
      tax_id: v.emptyToNull(val.tax_id),
      phone: v.emptyToNull(val.phone),
      email: v.emptyToNull(val.email),
      address: v.emptyToNull(val.address),
      brand_color: val.brand_color.toUpperCase(),
      logo_data_url: logo,
      currency: val.currency,
      default_validity_days: Number(val.default_validity_days),
      terms: v.emptyToNull(val.terms),
      tax_enabled: Boolean(val.tax_enabled),
      tax_name: val.tax_enabled ? val.tax_name.trim() : org.tax_name,
      tax_rate_bp: rate.value,
    };
    mount(status);
    try {
      const saved = await busy(submit, () => db.update('organizations', org.id, patch));
      ctx.setOrg(saved);
      toast('Datos del negocio guardados');
      ctx.go(welcome ? 'inicio' : 'configuracion');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  shell(ctx, { section: 'configuracion', title: welcome ? 'Paso 2 de 2: tus datos' : 'Tu negocio' },
    welcome ? banner('success', '¡Listo, tu negocio está creado! Completá lo que quieras ahora; todo se puede cambiar después.') : null,
    form,
  );
}

/** Achica la imagen a 400 px de lado mayor y la devuelve como data URL (WebP, o PNG si no hay soporte). */
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Formato no admitido. Usá PNG, JPG o WebP.'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('La imagen pesa más de 8 MB.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 400 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/webp', 0.85);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/png');
      if (data.length > MAX_LOGO_CHARS) data = canvas.toDataURL('image/jpeg', 0.8);
      if (data.length > MAX_LOGO_CHARS) return reject(new Error('El logo quedó muy pesado. Probá con una imagen más simple.'));
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = url;
  });
}
