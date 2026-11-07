import { h, mount, field, showErrors, formValues, banner, busy, toast } from '../lib/dom.js';
import { auth } from '../lib/api.js';
import * as v from '../lib/validate.js';

function authLayout(ctx, title, subtitle, ...body) {
  return mount(
    ctx.app,
    h('main', { class: 'auth-wrap' },
      h('div', { class: 'auth-card' },
        h('div', { class: 'brand brand-lg' }, h('span', { class: 'brand-mark' }, 'Z'), h('span', {}, 'Zenix OS')),
        h('h1', {}, title),
        subtitle ? h('p', { class: 'muted' }, subtitle) : null,
        body,
      ),
      h('p', { class: 'auth-foot muted' }, 'Tu negocio, ordenado.'),
    ),
  );
}

function flash() {
  const msg = sessionStorage.getItem('zenixos.flash');
  if (!msg) return null;
  sessionStorage.removeItem('zenixos.flash');
  return banner('info', msg);
}

export function loginView(ctx) {
  const status = h('div', { class: 'form-status' }, flash());
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Ingresar');
  const form = h('form', { novalidate: true, class: 'stack' },
    field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: { autocomplete: 'email', inputmode: 'email' } }),
    field({ name: 'password', label: 'Contraseña', type: 'password', required: true, attrs: { autocomplete: 'current-password' } }),
    status,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({
      email: [v.required(val.email, 'El email'), v.email(val.email)],
      password: v.required(val.password, 'La contraseña'),
    });
    if (!showErrors(form, errors)) return;
    mount(status);
    try {
      await busy(submit, () => auth.signIn(val.email.trim(), val.password), 'Ingresando…');
      ctx.go('inicio');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });
  authLayout(ctx, 'Ingresá a tu cuenta', null,
    form,
    h('div', { class: 'auth-links' },
      h('a', { href: '#/recuperar' }, '¿Olvidaste tu contraseña?'),
      h('span', {}, '¿No tenés cuenta? ', h('a', { href: '#/registro' }, 'Creala gratis')),
    ),
  );
}

export function registerView(ctx) {
  const status = h('div', { class: 'form-status' }, flash());
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Crear cuenta');
  const form = h('form', { novalidate: true, class: 'stack' },
    field({ name: 'email', label: 'Email', type: 'email', required: true, attrs: { autocomplete: 'email', inputmode: 'email' } }),
    field({ name: 'password', label: 'Contraseña', type: 'password', required: true, hint: 'Mínimo 8 caracteres.', attrs: { autocomplete: 'new-password' } }),
    field({ name: 'password2', label: 'Repetí la contraseña', type: 'password', required: true, attrs: { autocomplete: 'new-password' } }),
    status,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({
      email: [v.required(val.email, 'El email'), v.email(val.email)],
      password: v.password(val.password),
      password2: val.password2 !== val.password ? 'Las contraseñas no coinciden.' : null,
    });
    if (!showErrors(form, errors)) return;
    mount(status);
    try {
      const r = await busy(submit, () => auth.signUp(val.email.trim(), val.password), 'Creando…');
      if (r.confirmed) {
        ctx.go('negocio-nuevo');
      } else {
        mount(form,
          banner('success', `Te enviamos un email a ${val.email.trim()} para confirmar la cuenta. Abrí el enlace y después ingresá.`),
          h('a', { class: 'btn btn-secondary btn-block', href: '#/ingresar' }, 'Ir a ingresar'),
        );
      }
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });
  authLayout(ctx, 'Creá tu cuenta', 'Gratis durante el piloto.',
    form,
    h('div', { class: 'auth-links' }, h('span', {}, '¿Ya tenés cuenta? ', h('a', { href: '#/ingresar' }, 'Ingresá'))),
  );
}

export function recoverView(ctx) {
  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Enviar enlace');
  const form = h('form', { novalidate: true, class: 'stack' },
    field({ name: 'email', label: 'Email de tu cuenta', type: 'email', required: true, attrs: { autocomplete: 'email', inputmode: 'email' } }),
    status,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({ email: [v.required(val.email, 'El email'), v.email(val.email)] });
    if (!showErrors(form, errors)) return;
    mount(status);
    try {
      await busy(submit, () => auth.recover(val.email.trim()), 'Enviando…');
      // Mismo mensaje exista o no la cuenta, para no revelar qué emails están registrados.
      mount(form, banner('success', 'Si el email tiene una cuenta, te llegará un enlace para elegir una contraseña nueva.'));
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });
  authLayout(ctx, 'Recuperar contraseña', 'Te mandamos un enlace para elegir una nueva.',
    form,
    h('div', { class: 'auth-links' }, h('a', { href: '#/ingresar' }, 'Volver a ingresar')),
  );
}

export function newPasswordView(ctx) {
  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Guardar contraseña');
  const form = h('form', { novalidate: true, class: 'stack' },
    field({ name: 'password', label: 'Contraseña nueva', type: 'password', required: true, hint: 'Mínimo 8 caracteres.', attrs: { autocomplete: 'new-password' } }),
    field({ name: 'password2', label: 'Repetila', type: 'password', required: true, attrs: { autocomplete: 'new-password' } }),
    status,
    submit,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({
      password: v.password(val.password),
      password2: val.password2 !== val.password ? 'Las contraseñas no coinciden.' : null,
    });
    if (!showErrors(form, errors)) return;
    mount(status);
    try {
      await busy(submit, () => auth.updatePassword(val.password));
      toast('Contraseña actualizada');
      ctx.go('inicio');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });
  authLayout(ctx, 'Elegí una contraseña nueva', null, form);
}
