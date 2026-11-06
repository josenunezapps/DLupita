import { consumeAuthRedirect, getSession, onSessionChange, db } from './lib/api.js';
import { h, mount, banner } from './lib/dom.js';
import { loginView, registerView, recoverView, newPasswordView } from './views/auth.js';
import { createOrgView } from './views/onboarding.js';
import { homeView } from './views/home.js';
import { customersView, customerFormView } from './views/customers.js';
import { catalogView, catalogFormView } from './views/catalog.js';
import { settingsView } from './views/settings.js';
import { quotesView, quoteRouteView } from './views/quotes.js';

// Todos los módulos cargaron: el aviso de error de index.html ya no aplica.
window.__cpStarted = true;

const app = document.getElementById('app');
const state = { org: null, orgLoaded: false };

const PUBLIC = new Set(['ingresar', 'registro', 'recuperar']);
const NO_ORG_OK = new Set(['negocio-nuevo', 'nueva-clave']);

export function go(route) {
  const target = `#/${route}`;
  if (location.hash === target) render();
  else location.hash = target;
}

async function loadOrg() {
  state.org = await db.one('organizations', 'select=*');
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
  async refreshOrg() {
    await loadOrg();
  },
  setOrg(org) {
    state.org = org;
    state.orgLoaded = true;
  },
  // Cambios sin guardar (editor de presupuestos): se pide confirmación antes de salir.
  setDirty(value) {
    dirty = Boolean(value);
  },
  replaceHash(hash) {
    history.replaceState(null, '', hash);
    lastHash = hash;
  },
};

let dirty = false;
let lastHash = location.hash;
window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
function onHashChange() {
  if (dirty && location.hash !== lastHash) {
    if (!window.confirm('Tenés cambios sin guardar en el presupuesto. ¿Salir igual?')) {
      history.replaceState(null, '', lastHash);
      return;
    }
    dirty = false;
  }
  lastHash = location.hash;
  render();
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const route = parseRoute();
  const session = getSession();

  if (!session) {
    state.org = null;
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
        return mount(
          app,
          h('main', { class: 'auth-wrap' },
            h('div', { class: 'auth-card' },
              banner('error', e.message),
              h('button', { class: 'btn btn-primary', onclick: () => render() }, 'Reintentar'),
            ),
          ),
        );
      }
      if (seq !== renderSeq) return;
    }
    if (!state.org && !NO_ORG_OK.has(route.name)) return go('negocio-nuevo');
    if (state.org && route.name === 'negocio-nuevo') return go('inicio');
  }

  lastHash = location.hash;
  const view = pickView(route);
  if (!view) return go(session ? 'inicio' : 'ingresar');
  window.scrollTo(0, 0);
  await view(ctx, route);
}

function pickView(route) {
  switch (route.name) {
    case 'ingresar': return loginView;
    case 'registro': return registerView;
    case 'recuperar': return recoverView;
    case 'nueva-clave': return newPasswordView;
    case 'negocio-nuevo': return createOrgView;
    case 'inicio': return homeView;
    case 'clientes': return route.id ? customerFormView : customersView;
    case 'conceptos': return route.id ? catalogFormView : catalogView;
    case 'configuracion': return settingsView;
    case 'presupuestos': return route.id ? quoteRouteView : quotesView;
    default: return null;
  }
}

// Volver de un email de Supabase (confirmación o recuperación) con tokens en el hash.
const redirectType = consumeAuthRedirect(location.hash);
if (redirectType === 'recovery') history.replaceState(null, '', `${location.pathname}#/nueva-clave`);
else if (redirectType) history.replaceState(null, '', `${location.pathname}#/inicio`);
// Errores que Supabase devuelve en el hash (link vencido, etc.).
if (location.hash.includes('error_description=')) {
  const p = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  sessionStorage.setItem('cotizapro.flash', p.get('error_description') || 'El enlace no es válido o venció.');
  history.replaceState(null, '', `${location.pathname}#/ingresar`);
}

onSessionChange((s) => {
  if (!s) {
    state.org = null;
    state.orgLoaded = false;
  }
});

function updateOnline() {
  document.body.classList.toggle('offline', !navigator.onLine);
}
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();

window.addEventListener('hashchange', onHashChange);
render();
