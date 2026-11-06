import { h, banner } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { formatMoney } from '../lib/money.js';
import { effectiveStatus, quoteNumber, todayISO } from '../lib/quotes.js';
import { shell } from './shell.js';
import { statusBadge } from './quotes.js';

export async function homeView(ctx) {
  const org = ctx.state.org;
  const stats = h('div', { class: 'stats' }, [1, 2, 3].map(() => h('div', { class: 'skeleton stat' })));
  const recent = h('div', { class: 'list' }, [1, 2].map(() => h('div', { class: 'skeleton row' })));
  const checklist = h('ol', { class: 'checklist' });
  const checkCard = h('section', { class: 'card' }, h('h2', {}, 'Para empezar'), checklist);

  shell(ctx, {
    section: 'inicio',
    title: 'Inicio',
    actions: h('a', { class: 'btn btn-primary', href: '#/presupuestos/nuevo' }, '+ Nuevo presupuesto'),
  },
    stats,
    h('section', { class: 'stack-sm' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Últimos presupuestos'), h('a', { href: '#/presupuestos' }, 'Ver todos')),
      recent,
    ),
    checkCard,
  );

  try {
    const [quotes, customers, items] = await Promise.all([
      db.select('quotes', 'select=id,number,title,status,valid_until,currency,quote_total,customers(name)&order=created_at.desc&limit=200'),
      db.count('customers', 'archived=eq.false'),
      db.count('catalog_items', 'archived=eq.false'),
    ]);
    const today = todayISO();
    const open = quotes.filter((q) => ['emitido', 'enviado'].includes(effectiveStatus(q, today)));
    const accepted = quotes.filter((q) => q.status === 'aceptado');
    const acceptedTotal = accepted.reduce((s, q) => s + (Number(q.quote_total) || 0), 0);

    stats.replaceChildren(
      statCard('Esperando respuesta', String(open.length), '#/presupuestos'),
      statCard('Aceptados', String(accepted.length), '#/presupuestos', accepted.length ? formatMoney(acceptedTotal, org.currency) : null),
      statCard('Clientes', String(customers), '#/clientes'),
    );

    if (quotes.length === 0) {
      recent.replaceChildren(h('div', { class: 'empty' },
        h('p', {}, 'Todavía no hiciste presupuestos.'),
        h('a', { class: 'btn btn-secondary btn-sm', href: '#/presupuestos/nuevo' }, 'Hacer el primero'),
      ));
    } else {
      recent.replaceChildren(...quotes.slice(0, 5).map((q) => h('a', { class: 'row-item', href: `#/presupuestos/${q.id}` },
        h('span', { class: 'qnum' }, q.number ? quoteNumber(q.number) : '—'),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, q.title || 'Sin título'),
          h('span', { class: 'row-sub' }, statusBadge(effectiveStatus(q, today)), ' ', q.customers?.name || 'Sin cliente'),
        ),
        h('span', { class: 'amount' }, formatMoney(q.quote_total ?? 0, q.currency || org.currency)),
      )));
    }

    const configured = Boolean(org.phone || org.email || org.logo_data_url || org.terms);
    const issued = quotes.some((q) => q.status !== 'borrador');
    const steps = [
      ['Completá los datos de tu negocio', configured, '#/configuracion'],
      ['Cargá tu primer cliente', customers > 0, '#/clientes/nuevo'],
      ['Cargá materiales, mano de obra o servicios', items > 0, '#/conceptos/nuevo'],
      ['Emití tu primer presupuesto', issued, '#/presupuestos/nuevo'],
    ];
    if (steps.every(([, done]) => done)) checkCard.remove();
    else checklist.replaceChildren(...steps.map(([text, done, href]) => task(text, done, href)));
  } catch (err) {
    stats.replaceChildren(banner('error', err.message));
    recent.replaceChildren();
  }
}

function statCard(label, n, href, extra = null) {
  return h('a', { class: 'stat', href },
    h('span', { class: 'stat-n' }, n),
    h('span', { class: 'stat-label' }, label),
    extra ? h('span', { class: 'stat-extra' }, extra) : null,
  );
}

function task(text, done, href) {
  return h('li', { class: done ? 'done' : '' },
    h('span', { class: 'check', 'aria-hidden': 'true' }, done ? '✓' : ''),
    done ? h('span', {}, text, h('span', { class: 'sr-only' }, ' (hecho)')) : h('a', { href }, text),
  );
}
