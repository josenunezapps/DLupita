// Construcción de DOM segura: el texto siempre entra como textContent, nunca como HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = Boolean(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

/** Campo de formulario con etiqueta, ayuda y lugar para el error. */
export function field({ name, label, type = 'text', value = '', hint, required, attrs = {}, multiline = false, options }) {
  const id = `f-${name}`;
  let control;
  if (options) {
    control = h(
      'select',
      { id, name, ...attrs },
      options.map(([v, text]) => h('option', { value: v, selected: String(v) === String(value) }, text)),
    );
  } else if (multiline) {
    control = h('textarea', { id, name, rows: 4, ...attrs });
    control.value = value ?? '';
  } else {
    control = h('input', { id, name, type, value: value ?? '', ...attrs });
  }
  if (required) control.setAttribute('aria-required', 'true');
  const err = h('p', { class: 'field-error', id: `${id}-err`, role: 'alert', hidden: true });
  // Al corregir el valor, el error anterior deja de mostrarse hasta el próximo envío.
  const clearError = () => {
    if (err.hidden) return;
    err.hidden = true;
    err.textContent = '';
    control.removeAttribute('aria-invalid');
  };
  control.addEventListener('input', clearError);
  control.addEventListener('change', clearError);
  control.setAttribute('aria-describedby', `${id}-err${hint ? ` ${id}-hint` : ''}`);
  return h(
    'div',
    { class: 'field', dataset: { field: name } },
    h('label', { for: id }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null),
    control,
    hint ? h('p', { class: 'hint', id: `${id}-hint` }, hint) : null,
    err,
  );
}

/** Muestra errores { campo: mensaje } en un formulario y enfoca el primero. */
export function showErrors(form, errors) {
  form.querySelectorAll('.field').forEach((f) => {
    const name = f.dataset.field;
    const err = f.querySelector('.field-error');
    const control = f.querySelector('input, select, textarea');
    if (errors[name]) {
      err.textContent = errors[name];
      err.hidden = false;
      control?.setAttribute('aria-invalid', 'true');
    } else {
      err.textContent = '';
      err.hidden = true;
      control?.removeAttribute('aria-invalid');
    }
  });
  const first = Object.keys(errors)[0];
  if (first) form.querySelector(`[name="${first}"]`)?.focus();
  return Object.keys(errors).length === 0;
}

export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

/** Banner de estado dentro de un formulario o vista. */
export function banner(kind, text) {
  return h('div', { class: `banner banner-${kind}`, role: kind === 'error' ? 'alert' : 'status' }, text);
}

let toastTimer;
export function toast(text) {
  let t = document.getElementById('toast');
  if (!t) {
    t = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/** Deshabilita un botón mientras corre una promesa. */
export async function busy(button, fn, busyText = 'Guardando…') {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
