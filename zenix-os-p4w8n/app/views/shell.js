import { h, mount } from '../lib/dom.js';
import { auth } from '../lib/api.js';
import { ROLE_LABEL, can } from '../lib/roles.js';

const ICONS = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  productos: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  stock: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  clientes: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 4-6 8-6s8 2 8 6',
  equipo: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 11a3 3 0 1 0 0-6M3 20c0-3 3-5 6-5s6 2 6 5M17 15c2.5 0 4 1.6 4 5',
  negocio: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6',
};

export function navItems(role) {
  const items = [
    ['inicio', 'Inicio'],
    ['productos', 'Productos'],
    ['stock', 'Stock'],
    ['clientes', 'Clientes'],
  ];
  if (can.manageTeam(role)) items.push(['equipo', 'Equipo']);
  if (can.editBusiness(role)) items.push(['negocio', 'Negocio']);
  return items;
}

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

export function shell(ctx, { section, title, actions = null, back = null }, ...content) {
  const { org, member } = ctx.state;
  const items = navItems(member?.role);
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

  const link = (cls) => ([route, label]) =>
    h('a', { href: `#/${route}`, class: `${cls}${section === route ? ' active' : ''}`, 'aria-current': section === route ? 'page' : null }, icon(ICONS[route]), h('span', {}, label));

  return mount(
    ctx.app,
    h('div', { class: 'layout' },
      h('aside', { class: 'sidenav' },
        h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, 'Z'), h('span', {}, 'Zenix OS')),
        h('nav', { 'aria-label': 'Secciones' }, items.map(link('nav-item'))),
        h('div', { class: 'sidenav-foot stack-sm' },
          h('span', { class: 'side-role' }, `${member?.email || ''} · ${ROLE_LABEL[member?.role] || ''}`),
          logoutButton(),
        ),
      ),
      h('div', { class: 'main-col' },
        h('header', { class: 'topbar' },
          h('div', { class: 'topbar-org' }, h('span', { class: 'brand-dot', style: 'background:var(--accent)' }), h('span', { class: 'org-name' }, org?.name || '')),
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
        h('nav', { class: 'tabbar', style: `--tabs:${items.length}`, 'aria-label': 'Secciones' }, items.map(link('tab'))),
      ),
    ),
  );
}
