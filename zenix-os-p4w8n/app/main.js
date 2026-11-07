import { consumeAuthRedirect, getSession, onSessionChange, db } from './lib/api.js';
import { h, mount, banner } from './lib/dom.js';
import { can } from './lib/roles.js';
import { loginView, registerView, recoverView, newPasswordView } from './views/auth.js';
import { startView } from './views/start.js';
import { homeView } from './views/home.js';
import { productsView, productFormView } from './views/products.js';
import { stockView } from './views/stock.js';
import { customersView, customerFormView } from './views/customers.js';
import { teamView } from './views/team.js';
import { businessView } from './views/business.js';

// Todos los módulos cargaron: el aviso de error de index.html ya no aplica.
window.__cpStarted = true;

const app = document.getElementById('app');
const state = { org: null, member: null, orgLoaded: false };

const PUBLIC = new Set(['ingresar', 'registro', 'recuperar']);
const NO_ORG_OK = new Set(['empezar', 'nueva-clave']);
const INVITE_KEY = 'zenixos.invite';

export function go(route) {
  const target = `#/${route}`;
  if (location.hash === target) render();
  else location.hash = target;
}

async function loadOrg() {
  const uid = getSession()?.user?.id;
  state.member = uid ? await db.one('organization_members', `select=*&user_id=eq.${encodeURIComponent(uid)}`) : null;
  state.org = state.member?.active ? await db.one('organizations', `select=*&id=eq.${state.member.organization_id}`) : null;
  state.orgLoaded = true;
}

function parseRoute() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || '', id: parts[1] || null, path };
}

const ctx = {
  app,
  state,
  go,
  inviteKey: INVITE_KEY,
  async refreshOrg() { await loadOrg(); },
  setOrg(org) { state.org = org; },
};

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const route = parseRoute();
  const session = getSession();

  // Enlace de invitación: #/unirme/CODIGO
  if (route.name === 'unirme') {
    if (route.id) sessionStorage.setItem(INVITE_KEY, route.id.toUpperCase());
    if (!session) {
      sessionStorage.setItem('zenixos.flash', 'Te invitaron a un equipo en Zenix OS. Creá tu cuenta o ingresá para unirte.');
      return go('registro');
    }
    return go('empezar');
  }

  if (!session) {
    state.org = null;
    state.member = null;
    state.orgLoaded = false;
    if (!PUBLIC.has(route.name)) return go('ingresar');
  } else {
    if (PUBLIC.has(route.name) || route.name === '') return go('inicio');
    if (!state.orgLoaded) {
      mount(app, h('div', { class: 'boot' }, h('div', { class: 'spinner', 'aria-hidden': 'true' }), h('p', {}, 'Cargando tu negocio…')));
      try {
        await loadOrg();
      } catch (e) {
        if (seq !== renderSeq) return;
        if (!getSession()) return go('ingresar');
        return mount(app, h('main', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
          banner('error', e.message),
          h('button', { class: 'btn btn-primary', onclick: () => render() }, 'Reintentar'),
        )));
      }
      if (seq !== renderSeq) return;
    }
    if (state.member && !state.member.active) {
      return mount(app, h('main', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
        h('h1', {}, 'Acceso desactivado'),
        h('p', { class: 'muted' }, 'El dueño del negocio desactivó tu usuario. Si es un error, pedile que lo vuelva a activar.'),
      )));
    }
    if (!state.org && !NO_ORG_OK.has(route.name)) return go('empezar');
    if (state.org && route.name === 'empezar') return go('inicio');
  }

  const view = pickView(route, state.member?.role);
  if (!view) return go(session ? 'inicio' : 'ingresar');
  window.scrollTo(0, 0);
  await view(ctx, route);
}

function pickView(route, role) {
  switch (route.name) {
    case 'ingresar': return loginView;
    case 'registro': return registerView;
    case 'recuperar': return recoverView;
    case 'nueva-clave': return newPasswordView;
    case 'empezar': return startView;
    case 'inicio': return homeView;
    case 'productos': return route.id ? (can.editCatalog(role) ? productFormView : null) : productsView;
    case 'stock': return stockView;
    case 'clientes': return route.id ? customerFormView : customersView;
    case 'equipo': return can.manageTeam(role) ? teamView : null;
    case 'negocio': return can.editBusiness(role) ? businessView : null;
    default: return null;
  }
}

const redirectType = consumeAuthRedirect(location.hash);
if (redirectType === 'recovery') history.replaceState(null, '', `${location.pathname}#/nueva-clave`);
else if (redirectType) history.replaceState(null, '', `${location.pathname}#/inicio`);
if (location.hash.includes('error_description=')) {
  const p = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  sessionStorage.setItem('zenixos.flash', p.get('error_description') || 'El enlace no es válido o venció.');
  history.replaceState(null, '', `${location.pathname}#/ingresar`);
}

onSessionChange((s) => {
  if (!s) {
    state.org = null;
    state.member = null;
    state.orgLoaded = false;
  }
});

function updateOnline() { document.body.classList.toggle('offline', !navigator.onLine); }
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

window.addEventListener('hashchange', render);
render();
