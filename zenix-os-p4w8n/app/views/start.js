// Primer ingreso: crear un negocio nuevo o unirse a uno con un código de invitación.
import { h, mount, field, showErrors, formValues, banner, busy, toast } from '../lib/dom.js';
import { db, auth } from '../lib/api.js';
import * as v from '../lib/validate.js';

export function startView(ctx) {
  const pendingCode = sessionStorage.getItem(ctx.inviteKey) || '';

  // ---- Unirse con código ----
  const joinStatus = h('div', { class: 'form-status' });
  const joinBtn = h('button', { class: `btn ${pendingCode ? 'btn-primary' : 'btn-secondary'} btn-block`, type: 'submit' }, 'Unirme al equipo');
  const joinForm = h('form', { novalidate: true, class: 'stack' },
    field({ name: 'code', label: 'Código de invitación', value: pendingCode, hint: 'Te lo pasa el dueño del negocio (8 letras y números).', attrs: { class: 'code-input', maxlength: 8, autocomplete: 'off', autocapitalize: 'characters' } }),
    joinStatus,
    joinBtn,
  );
  joinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = formValues(joinForm).code.trim().toUpperCase();
    const errors = v.collect({ code: /^[A-Z0-9]{8}$/.test(code) ? null : 'El código tiene 8 letras y números.' });
    if (!showErrors(joinForm, errors)) return;
    mount(joinStatus);
    try {
      await busy(joinBtn, () => db.rpc('accept_invitation', { p_code: code }), 'Uniéndome…');
      sessionStorage.removeItem(ctx.inviteKey);
      await ctx.refreshOrg();
      toast(`Te uniste a ${ctx.state.org?.name || 'el equipo'}`);
      ctx.go('inicio');
    } catch (err) {
      mount(joinStatus, banner('error', err.message));
    }
  });

  // ---- Crear negocio ----
  const createStatus = h('div', { class: 'form-status' });
  const createBtn = h('button', { class: `btn ${pendingCode ? 'btn-secondary' : 'btn-primary'} btn-block`, type: 'submit' }, 'Crear mi negocio');
  const createForm = h('form', { novalidate: true, class: 'stack' },
    field({ name: 'name', label: 'Nombre del negocio', required: true, attrs: { maxlength: v.LIMITS.orgName, autocomplete: 'organization' } }),
    field({ name: 'currency', label: 'Moneda', value: 'ARS', options: [['ARS', 'Pesos argentinos (ARS)'], ['USD', 'Dólares (USD)']] }),
    createStatus,
    createBtn,
  );
  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(createForm);
    const errors = v.collect({ name: [v.required(val.name, 'El nombre'), v.maxLen(val.name.trim(), v.LIMITS.orgName, 'El nombre')] });
    if (!showErrors(createForm, errors)) return;
    mount(createStatus);
    try {
      await busy(createBtn, () => db.rpc('create_organization', { p_name: val.name.trim(), p_currency: val.currency, p_timezone: 'America/Argentina/Buenos_Aires' }), 'Creando…');
      sessionStorage.removeItem(ctx.inviteKey);
      await ctx.refreshOrg();
      toast('¡Negocio creado!');
      ctx.go('inicio');
    } catch (err) {
      mount(createStatus, banner('error', err.message));
    }
  });

  const joinBlock = h('section', { class: 'stack' }, h('h2', {}, 'Me invitaron a un equipo'), joinForm);
  const createBlock = h('section', { class: 'stack' },
    h('h2', {}, 'Soy el dueño: crear mi negocio'),
    h('p', { class: 'muted' }, 'Vas a poder invitar a tu equipo después.'),
    createForm,
  );

  mount(ctx.app,
    h('main', { class: 'auth-wrap' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark' }, 'Z'), h('span', {}, 'Zenix OS')),
        h('h1', {}, '¡Bienvenido!'),
        pendingCode ? [joinBlock, h('div', { class: 'join-divider' }, 'o'), createBlock] : [createBlock, h('div', { class: 'join-divider' }, 'o'), joinBlock],
        h('div', { class: 'auth-links' },
          h('button', { class: 'link', type: 'button', onclick: async () => { await auth.signOut(); ctx.go('ingresar'); } }, 'Salir'),
        ),
      ),
    ),
  );
}
