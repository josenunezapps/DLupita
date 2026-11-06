import { h, mount, field, showErrors, formValues, banner, busy } from '../lib/dom.js';
import { db, auth } from '../lib/api.js';
import * as v from '../lib/validate.js';

export function createOrgView(ctx) {
  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Crear mi negocio');
  const form = h('form', { novalidate: true, class: 'stack' },
    field({
      name: 'name',
      label: 'Nombre del negocio',
      required: true,
      hint: 'Así aparecerá en tus presupuestos. Lo podés cambiar después.',
      attrs: { maxlength: v.LIMITS.orgName, autocomplete: 'organization' },
    }),
    status,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({ name: [v.required(val.name, 'El nombre'), v.maxLen(val.name.trim(), v.LIMITS.orgName, 'El nombre')] });
    if (!showErrors(form, errors)) return;
    mount(status);
    try {
      await busy(submit, () => db.rpc('create_organization', { p_name: val.name.trim() }), 'Creando…');
      await ctx.refreshOrg();
      ctx.go('configuracion?bienvenida=1');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  mount(
    ctx.app,
    h('main', { class: 'auth-wrap' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark' }, 'C'), h('span', {}, 'CotizaPro')),
        h('p', { class: 'step' }, 'Paso 1 de 2'),
        h('h1', {}, '¿Cómo se llama tu negocio?'),
        h('p', { class: 'muted' }, 'Con esto armamos tu espacio. Nadie más puede ver tus datos.'),
        form,
        h('div', { class: 'auth-links' },
          h('button', { class: 'link', type: 'button', onclick: async () => { await auth.signOut(); ctx.go('ingresar'); } }, 'Salir'),
        ),
      ),
    ),
  );
  form.querySelector('input').focus();
}
