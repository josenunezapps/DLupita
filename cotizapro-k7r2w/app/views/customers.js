import { h, mount, field, showErrors, formValues, banner, busy, toast, debounce } from '../lib/dom.js';
import { db, searchTerm } from '../lib/api.js';
import * as v from '../lib/validate.js';
import { shell } from './shell.js';

export async function customersView(ctx) {
  const list = h('div', { class: 'list', 'aria-live': 'polite' });
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar por nombre, teléfono o email', 'aria-label': 'Buscar clientes', autocomplete: 'off' });
  const archived = h('input', { type: 'checkbox', id: 'show-archived' });

  shell(ctx, {
    section: 'clientes',
    title: 'Clientes',
    actions: h('a', { class: 'btn btn-primary', href: '#/clientes/nuevo' }, '+ Nuevo cliente'),
  },
    h('div', { class: 'toolbar' },
      search,
      h('label', { class: 'toggle', for: 'show-archived' }, archived, ' Ver archivados'),
    ),
    list,
  );

  let seq = 0;
  async function load() {
    const my = ++seq;
    list.replaceChildren(...[1, 2, 3].map(() => h('div', { class: 'skeleton row' })));
    const term = searchTerm(search.value);
    let q = `select=id,name,phone,email,archived&order=name.asc&limit=200&archived=eq.${archived.checked}`;
    if (term) {
      const t = encodeURIComponent(`"*${term}*"`);
      q += `&or=(name.ilike.${t},phone.ilike.${t},email.ilike.${t})`;
    }
    try {
      const rows = await db.select('customers', q);
      if (my !== seq) return;
      if (rows.length === 0) {
        list.replaceChildren(empty(term, archived.checked));
        return;
      }
      list.replaceChildren(...rows.map((c) =>
        h('a', { class: 'row-item', href: `#/clientes/${c.id}` },
          h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(c.name)),
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, c.name),
            h('span', { class: 'row-sub' }, [c.phone, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'),
          ),
          h('span', { class: 'chev', 'aria-hidden': 'true' }, '›'),
        ),
      ));
    } catch (err) {
      if (my === seq) list.replaceChildren(banner('error', err.message));
    }
  }

  search.addEventListener('input', debounce(load, 250));
  archived.addEventListener('change', load);
  await load();
}

function empty(term, archived) {
  if (term) return h('div', { class: 'empty' }, h('p', {}, `No hay clientes que coincidan con "${term}".`));
  if (archived) return h('div', { class: 'empty' }, h('p', {}, 'No tenés clientes archivados.'));
  return h('div', { class: 'empty' },
    h('p', { class: 'empty-title' }, 'Todavía no cargaste clientes'),
    h('p', { class: 'muted' }, 'Guardalos una vez y reutilizalos en cada presupuesto.'),
    h('a', { class: 'btn btn-primary', href: '#/clientes/nuevo' }, 'Cargar el primero'),
  );
}

function initials(name) {
  return String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export async function customerFormView(ctx, route) {
  const isNew = route.id === 'nuevo';
  let customer = null;

  if (!isNew) {
    shell(ctx, { section: 'clientes', title: 'Cliente', back: 'clientes' }, h('div', { class: 'skeleton card-lg' }));
    try {
      customer = await db.one('customers', `select=*&id=eq.${encodeURIComponent(route.id)}`);
    } catch (err) {
      return shell(ctx, { section: 'clientes', title: 'Cliente', back: 'clientes' }, banner('error', err.message));
    }
    if (!customer) {
      return shell(ctx, { section: 'clientes', title: 'Cliente', back: 'clientes' }, banner('error', 'No encontramos ese cliente.'));
    }
  }

  const c = customer || {};
  const status = h('div', { class: 'form-status' });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, isNew ? 'Guardar cliente' : 'Guardar cambios');
  const form = h('form', { novalidate: true, class: 'card form-grid' },
    field({ name: 'name', label: 'Nombre o razón social', value: c.name, required: true, attrs: { maxlength: v.LIMITS.customerName } }),
    field({ name: 'phone', label: 'Teléfono / WhatsApp', type: 'tel', value: c.phone, attrs: { maxlength: v.LIMITS.phone, inputmode: 'tel', autocomplete: 'off' } }),
    field({ name: 'email', label: 'Email', type: 'email', value: c.email, attrs: { maxlength: v.LIMITS.email, inputmode: 'email', autocomplete: 'off' } }),
    field({ name: 'tax_id', label: 'CUIT / DNI', value: c.tax_id, attrs: { maxlength: v.LIMITS.taxId, inputmode: 'numeric' } }),
    field({ name: 'address', label: 'Dirección', value: c.address, attrs: { maxlength: v.LIMITS.address } }),
    field({ name: 'notes', label: 'Notas internas', value: c.notes, multiline: true, hint: 'Solo las ves vos; no salen en el presupuesto.', attrs: { maxlength: v.LIMITS.notes } }),
    status,
    h('div', { class: 'form-actions' }, submit),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = formValues(form);
    const errors = v.collect({
      name: [v.required(val.name, 'El nombre'), v.maxLen(val.name.trim(), v.LIMITS.customerName, 'El nombre')],
      email: v.email(val.email),
      phone: v.maxLen(val.phone, v.LIMITS.phone, 'El teléfono'),
      tax_id: v.maxLen(val.tax_id, v.LIMITS.taxId, 'El CUIT/DNI'),
    });
    if (!showErrors(form, errors)) return;
    const row = {
      name: val.name.trim(),
      phone: v.emptyToNull(val.phone),
      email: v.emptyToNull(val.email),
      tax_id: v.emptyToNull(val.tax_id),
      address: v.emptyToNull(val.address),
      notes: v.emptyToNull(val.notes),
    };
    mount(status);
    try {
      await busy(submit, () =>
        isNew ? db.insert('customers', { ...row, organization_id: ctx.state.org.id }) : db.update('customers', c.id, row),
      );
      toast(isNew ? 'Cliente guardado' : 'Cambios guardados');
      ctx.go('clientes');
    } catch (err) {
      mount(status, banner('error', err.message));
    }
  });

  let archiveBtn = null;
  if (!isNew) {
    archiveBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, c.archived ? 'Restaurar cliente' : 'Archivar cliente');
    archiveBtn.addEventListener('click', async () => {
      try {
        await busy(archiveBtn, () => db.update('customers', c.id, { archived: !c.archived }), '…');
        toast(c.archived ? 'Cliente restaurado' : 'Cliente archivado');
        ctx.go('clientes');
      } catch (err) {
        mount(status, banner('error', err.message));
      }
    });
  }

  shell(ctx, {
    section: 'clientes',
    title: isNew ? 'Nuevo cliente' : c.name,
    back: 'clientes',
    actions: archiveBtn,
  },
    c.archived ? banner('info', 'Este cliente está archivado: no aparece en la lista principal.') : null,
    form,
  );
  if (isNew) form.querySelector('[name="name"]').focus();
}
