import { h, banner } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { ROLE_LABEL, can, formatQty, stockState } from '../lib/roles.js';
import { shell } from './shell.js';

export async function homeView(ctx) {
  const { member } = ctx.state;
  const stats = h('div', { class: 'stats' }, [1, 2, 3].map(() => h('div', { class: 'skeleton stat' })));
  const low = h('div', { class: 'list' }, [1, 2].map(() => h('div', { class: 'skeleton row' })));

  shell(ctx, { section: 'inicio', title: 'Inicio' },
    h('p', { class: 'muted' }, `Hola${member?.email ? `, ${member.email.split('@')[0]}` : ''}. Tu rol: ${ROLE_LABEL[member?.role] || ''}.`),
    stats,
    h('section', { class: 'stack-sm' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Stock bajo o agotado'), h('a', { href: '#/stock' }, 'Ver stock')),
      low,
    ),
    h('section', { class: 'card card-soon' },
      h('h2', {}, 'Ventas y caja'),
      h('p', { class: 'muted' }, 'El mostrador de ventas, la caja y los reportes llegan en el próximo hito. Mientras tanto, dejá cargados productos, stock y clientes.'),
    ),
  );

  try {
    const [products, customers] = await Promise.all([
      db.select('products', 'select=id,name,unit,track_stock,min_stock_milli,stock_milli&active=eq.true&order=name.asc&limit=1000'),
      db.count('customers', 'archived=eq.false'),
    ]);
    const alerts = products.filter((p) => ['low', 'out'].includes(stockState(p)));
    stats.replaceChildren(
      stat('Productos activos', products.length, '#/productos'),
      stat('Con stock bajo', alerts.length, '#/stock', alerts.length ? 'warn' : null),
      stat('Clientes', customers, '#/clientes'),
    );
    if (products.length === 0) {
      low.replaceChildren(h('div', { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Empezá cargando tus productos'),
        can.editCatalog(member?.role)
          ? h('a', { class: 'btn btn-primary', href: '#/productos/nuevo' }, 'Cargar el primero')
          : h('p', { class: 'muted' }, 'Pedile al dueño o al supervisor que cargue el catálogo.'),
      ));
    } else if (alerts.length === 0) {
      low.replaceChildren(h('div', { class: 'empty' }, h('p', {}, 'Todo en orden: ningún producto está por debajo del mínimo.')));
    } else {
      low.replaceChildren(...alerts.slice(0, 8).map((p) => {
        const st = stockState(p);
        return h('a', { class: 'row-item', href: `#/stock?producto=${p.id}` },
          h('span', { class: 'row-main' },
            h('span', { class: 'row-title' }, p.name),
            h('span', { class: 'row-sub' }, p.min_stock_milli !== null ? `Mínimo: ${formatQty(p.min_stock_milli)} ${p.unit}` : 'Sin mínimo definido'),
          ),
          h('span', { class: 'row-end' },
            h('span', { class: `stock ${st === 'out' ? 'stock-out' : 'stock-low'}` }, formatQty(p.stock_milli)),
            h('span', { class: `badge ${st === 'out' ? 'badge-err' : 'badge-warn'}` }, st === 'out' ? 'Agotado' : 'Bajo'),
          ),
        );
      }));
    }
  } catch (err) {
    stats.replaceChildren(banner('error', err.message));
    low.replaceChildren();
  }
}

function stat(label, n, href, tone = null) {
  return h('a', { class: 'stat', href },
    h('span', { class: `stat-n${tone === 'warn' ? ' stock-low' : ''}` }, String(n)),
    h('span', { class: 'stat-label' }, label),
  );
}
