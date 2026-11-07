import { h, mount, field, showErrors, formValues, banner, busy, toast } from '../lib/dom.js';
import { db } from '../lib/api.js';
import * as v from '../lib/validate.js';
import { shell } from './shell.js';

export function businessView(ctx) {
  const org = ctx.state.org;
  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Guardar');
  const negToggle = h('input', { type: 'checkbox', name: 'allow_negative_stock', id: 'f-neg', checked: org.allow_negative_stock });

  const form = h('form', { novalidate: true, class: 'stack' },
    h('section', { class: 'card form-grid' },
      h('h2', { class: 'span-all' }, 'Datos del negocio'),
      field({ name: 'name', label: 'Nombre', value: org.name, required: true, attrs: { maxlength: v.LIMITS.orgName } }),
      field({ name: 'phone', label: 'Teléfono / WhatsApp', type: 'tel', value: org.phone, attrs: { maxlength: v.LIMITS.phone, inputmode: 'tel' } }),
      h('div', { class: 'span-all' }, field({ name: 'address', label: 'Dirección', value: org.address, attrs: { maxlength: v.LIMITS.address } })),
    ),
    h('section', { class: 'card form-grid' },
      h('h2', { class: 'span-all' }, 'Funcionamiento'),
      field({ name: 'currency', label: 'Moneda', value: org.currency, options: [['ARS', 'Pesos argentinos (ARS)'], ['USD', 'Dólares (USD)']] }),
      field({ name: 'timezone', label: 'Zona horaria', value: org.timezone, options: [
        ['America/Argentina/Buenos_Aires', 'Argentina (Buenos Aires)'],
        ['America/Argentina/Ushuaia', 'Argentina (Ushuaia)'],
        ['America/Montevideo', 'Uruguay'],
        ['America/Santiago', 'Chile'],
      ] }),
      h('div', { class: 'span-all' },
        h('label', { class: 'toggle', for: 'f-neg' }, negToggle, ' Permitir stock negativo'),
        h('p', { class: 'hint' }, 'Desactivado: no se puede sacar más de lo que hay. Activalo solo si a veces vendés antes de cargar la mercadería.'),
      ),
    ),
    status,
    h('div', { class: 'form-actions' }, submit),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({ name: [v.required(val.name, 'El nombre'), v.maxLen(val.name.trim(), v.LIMITS.orgName, 'El nombre')] });
    if (!showErrors(form, errors)) return;
    mount(status);
    try {
      const saved = await busy(submit, () => db.update('organizations', org.id, {
        name: val.name.trim(),
        phone: v.emptyToNull(val.phone),
        address: v.emptyToNull(val.address),
        currency: val.currency,
        timezone: val.timezone,
        allow_negative_stock: Boolean(val.allow_negative_stock),
      }));
      ctx.setOrg(saved);
      toast('Datos guardados');
      ctx.go('negocio');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  shell(ctx, { section: 'negocio', title: 'Tu negocio' }, form);
}
