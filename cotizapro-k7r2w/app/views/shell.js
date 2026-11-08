import { h, mount } from '../lib/dom.js';
import { auth } from '../lib/api.js';

const NAV = [
  ['inicio', 'Inicio', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  ['clientes', 'Clientes', 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 4-6 8-6s8 2 8 6'],
  ['conceptos', 'Conceptos', 'M4 6h16M4 12h16M4 18h10'],
  ['presupuestos', 'Presupuestos', 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h4'],
  ['configuracion', 'Configuración', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v0l-2 1 1 3 2-.5L7.5 16 7 18l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3z'],
];

function icon(d) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  svg.append(p);
  return svg;
}

/** Layout autenticado: barra superior, navegación (abajo en móvil, al costado en escritorio). */
export function shell(ctx, { section, title, actions = null, back = null }, ...content) {
  const org = ctx.state.org;
  const navItems = NAV.map(([route, label, d]) =>
    h(
      'a',
      { href: `#/${route}`, class: `nav-item${section === route ? ' active' : ''}`, 'aria-current': section === route ? 'page' : null },
      icon(d),
      h('span', {}, label),
    ),
  );

  const logoutButton = () =>
    h('button', {
      class: 'btn btn-ghost btn-sm',
      type: 'button',
      onclick: async (e) => {
        e.currentTarget.disabled = true;
        await auth.signOut();
        ctx.go('ingresar');
      },
    }, 'Salir');

  const brandDot = h('span', { class: 'brand-dot', style: `background:${org?.brand_color || 'var(--accent)'}` });

  return mount(
    ctx.app,
    h('div', { class: `layout section-${section}` },
      h('aside', { class: 'sidenav' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, '▤'), h('span', { class: 'brand-word' }, h('span', {}, 'CotizaPro'), h('span', { class: 'brand-caption' }, 'by Zenix AR'))),
        h('nav', { 'aria-label': 'Secciones' }, navItems, h('a', { href: '#/presupuestos', class: 'nav-item', title: 'Las facturas todavía se preparan desde presupuestos aceptados' }, icon('M5 3h14v18l-3-2-4 2-4-2-3 2zM9 8h6M9 12h6'), h('span', {}, 'Facturación ARCA'))),
        h('div', { class: 'sidenav-foot' }, h('span', { class: 'brand-credit' }, '✦ Zenix AR'), h('span', { class: 'brand-caption' }, 'Soluciones de gestión para tu negocio'), logoutButton()),
      ),
      h('div', { class: 'main-col' },
        h('header', { class: 'topbar' },
          h('form', { class: 'global-search', role: 'search', onsubmit: (e) => { e.preventDefault(); const term=e.currentTarget.elements.namedItem('search')?.value?.trim(); if (term) { sessionStorage.setItem('cotizapro.search', term); ctx.go('presupuestos'); } } }, h('span', { 'aria-hidden':'true' }, '⌕'), h('input', { type:'search', name:'search', placeholder:'Buscar presupuestos o clientes…', 'aria-label':'Buscar presupuestos o clientes' }), h('span', { class:'search-shortcut', 'aria-hidden':'true' }, '↵')),
          h('div', { class: 'topbar-actions' }, h('a', { class:'btn btn-primary top-new', href:'#/presupuestos/nuevo' }, '+ Nuevo presupuesto'), h('div', { class: 'topbar-org' }, brandDot, h('span', { class: 'org-name' }, org?.name || 'Mi negocio'))),
          h('div', { class: 'topbar-right mobile-only' }, logoutButton()),
        ),
        h('main', { class: 'content', id: 'main' },
          h('div', { class: 'page-head' },
            h('div', {},
              back ? h('a', { href: `#/${back}`, class: 'back-link' }, '← Volver') : null,
              h('h1', {}, title),
            ),
            actions,
          ),
          h('div', { class: 'offline-banner', role: 'status' }, 'Sin conexión: los cambios no se van a guardar hasta que vuelva internet.'),
          content,
        ),
        h('nav', { class: 'tabbar', 'aria-label': 'Secciones' }, NAV.map(([route, label, d]) =>
          h('a', { href: `#/${route}`, class: `tab${section === route ? ' active' : ''}`, 'aria-current': section === route ? 'page' : null }, icon(d), h('span', {}, label)),
        )),
      ),
    ),
  );
}
