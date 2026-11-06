import { h, banner } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { shell } from './shell.js';

export async function homeView(ctx) {
  const stats = h('div', { class: 'stats' }, h('div', { class: 'skeleton stat' }), h('div', { class: 'skeleton stat' }));
  const checklist = h('ol', { class: 'checklist' });
  shell(ctx, { section: 'inicio', title: 'Inicio' },
    stats,
    h('section', { class: 'card' },
      h('h2', {}, 'Para empezar'),
      checklist,
    ),
    h('section', { class: 'card card-soon' },
      h('h2', {}, 'Presupuestos'),
      h('p', { class: 'muted' }, 'El editor de presupuestos y el PDF llegan en el próximo hito. Mientras tanto, dejá cargados tus clientes y conceptos para tenerlos listos.'),
    ),
  );

  try {
    const [customers, items] = await Promise.all([
      db.count('customers', 'archived=eq.false'),
      db.count('catalog_items', 'archived=eq.false'),
    ]);
    const org = ctx.state.org;
    stats.replaceChildren(
      statCard('Clientes', customers, '#/clientes'),
      statCard('Conceptos', items, '#/conceptos'),
    );
    const configured = Boolean(org.phone || org.email || org.logo_data_url || org.terms);
    checklist.replaceChildren(
      task('Completá los datos de tu negocio', configured, '#/configuracion'),
      task('Cargá tu primer cliente', customers > 0, '#/clientes/nuevo'),
      task('Cargá materiales, mano de obra o servicios', items > 0, '#/conceptos/nuevo'),
    );
  } catch (err) {
    stats.replaceChildren(banner('error', err.message));
  }
}

function statCard(label, n, href) {
  return h('a', { class: 'stat', href }, h('span', { class: 'stat-n' }, String(n)), h('span', { class: 'stat-label' }, label));
}

function task(text, done, href) {
  return h('li', { class: done ? 'done' : '' },
    h('span', { class: 'check', 'aria-hidden': 'true' }, done ? '✓' : ''),
    done ? h('span', {}, text, h('span', { class: 'sr-only' }, ' (hecho)')) : h('a', { href }, text),
  );
}
