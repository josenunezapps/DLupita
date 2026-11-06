// Cliente mínimo para Supabase (Auth + PostgREST) con fetch, sin dependencias externas.
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

const SESSION_KEY = 'cotizapro.session.v1';

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', raw = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.raw = raw;
  }
}

// ---------------- Sesión ----------------

let session = loadSession();
const listeners = new Set();

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return s && s.access_token && s.refresh_token ? s : null;
  } catch {
    return null;
  }
}

function saveSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* almacenamiento bloqueado: la sesión vive solo en memoria */
  }
  listeners.forEach((fn) => fn(s));
}

function normalizeSession(data) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ? Number(data.expires_at) : now + Number(data.expires_in || 3600),
    user: data.user ? { id: data.user.id, email: data.user.email } : session?.user ?? null,
  };
}

export function getSession() {
  return session;
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Toma tokens que Supabase deja en el hash (#access_token=...&type=recovery|signup). */
export function consumeAuthRedirect(hash) {
  if (!hash || !hash.includes('access_token=')) return null;
  const params = new URLSearchParams(hash.replace(/^#\/?/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  saveSession(
    normalizeSession({
      access_token,
      refresh_token,
      expires_in: params.get('expires_in'),
      expires_at: params.get('expires_at'),
      user: decodeUser(access_token),
    }),
  );
  return params.get('type') || 'login';
}

function decodeUser(jwt) {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// ---------------- HTTP ----------------

async function request(path, { method = 'GET', body, headers = {}, auth = true, retry = true } = {}) {
  const h = { apikey: SUPABASE_KEY, ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth) {
    await ensureFreshSession();
    if (!session) throw new ApiError('Tu sesión terminó. Volvé a ingresar.', { status: 401, code: 'no_session' });
    h.Authorization = `Bearer ${session.access_token}`;
  }

  let res;
  try {
    res = await fetch(SUPABASE_URL + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.', { code: 'network' });
  }

  if (res.status === 401 && auth && retry && session) {
    const ok = await refreshSession().catch(() => false);
    if (ok) return request(path, { method, body, headers, auth, retry: false });
    saveSession(null);
    throw new ApiError('Tu sesión terminó. Volvé a ingresar.', { status: 401, code: 'expired' });
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw toApiError(res.status, data);
  return data;
}

function toApiError(status, data) {
  const msg = (data && (data.msg || data.message || data.error_description || data.error)) || '';
  const code = (data && (data.error_code || data.code)) || '';
  const lower = String(msg).toLowerCase();
  let friendly = 'Ocurrió un error. Intentá de nuevo.';
  if (status === 429 || lower.includes('rate limit')) friendly = 'Demasiados intentos seguidos. Esperá unos minutos.';
  else if (lower.includes('invalid login credentials')) friendly = 'Email o contraseña incorrectos.';
  else if (lower.includes('email not confirmed')) friendly = 'Todavía no confirmaste tu email. Revisá tu casilla.';
  else if (lower.includes('already registered') || code === 'user_already_exists') friendly = 'Ese email ya tiene una cuenta. Probá ingresar.';
  else if (lower.includes('password should be') || code === 'weak_password') friendly = 'La contraseña es muy débil. Usá al menos 8 caracteres.';
  else if (lower.includes('ya tiene un negocio')) friendly = 'Tu cuenta ya tiene un negocio creado.';
  else if (lower.includes('row-level security') || status === 403) friendly = 'No tenés permiso para hacer esto.';
  else if (code === '23514') friendly = 'Algún dato no cumple el formato permitido.';
  else if (status >= 500) friendly = 'El servidor no respondió bien. Intentá en unos minutos.';
  return new ApiError(friendly, { status, code, raw: data });
}

async function ensureFreshSession() {
  if (!session) return;
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at - now > 60) return;
  const ok = await refreshSession().catch(() => false);
  if (!ok) saveSession(null);
}

let refreshing = null;
async function refreshSession() {
  if (!session?.refresh_token) return false;
  if (!refreshing) {
    refreshing = request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token },
      auth: false,
    })
      .then((data) => {
        saveSession(normalizeSession(data));
        return true;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function appUrl(hashRoute) {
  const base = location.origin + location.pathname;
  return base + hashRoute;
}

// ---------------- Auth ----------------

export const auth = {
  async signUp(email, password) {
    const data = await request(`/auth/v1/signup?redirect_to=${encodeURIComponent(appUrl(''))}`, {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    if (data && data.access_token) {
      saveSession(normalizeSession(data));
      return { confirmed: true };
    }
    return { confirmed: false };
  },

  async signIn(email, password) {
    const data = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    saveSession(normalizeSession(data));
  },

  async recover(email) {
    await request(`/auth/v1/recover?redirect_to=${encodeURIComponent(appUrl(''))}`, {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  async updatePassword(password) {
    await request('/auth/v1/user', { method: 'PUT', body: { password } });
  },

  async signOut() {
    try {
      if (session) await request('/auth/v1/logout', { method: 'POST', retry: false });
    } catch {
      /* aunque falle en el servidor, se cierra localmente */
    }
    saveSession(null);
  },
};

// ---------------- Datos (PostgREST) ----------------

const RETURN = { Prefer: 'return=representation' };

export const db = {
  select(table, query = '') {
    return request(`/rest/v1/${table}?${query}`);
  },
  async one(table, query) {
    const rows = await request(`/rest/v1/${table}?${query}&limit=1`);
    return rows && rows[0] ? rows[0] : null;
  },
  async insert(table, row) {
    const rows = await request(`/rest/v1/${table}`, { method: 'POST', body: row, headers: RETURN });
    return rows[0];
  },
  async update(table, id, patch) {
    const rows = await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: patch,
      headers: RETURN,
    });
    if (!rows || rows.length === 0) throw new ApiError('No se encontró el registro o no tenés permiso.', { status: 404 });
    return rows[0];
  },
  rpc(fn, args) {
    return request(`/rest/v1/rpc/${fn}`, { method: 'POST', body: args });
  },
  async count(table, query = '') {
    const rows = await request(`/rest/v1/${table}?select=id&${query}`);
    return rows.length;
  },
};

/** Limpia un término de búsqueda para usarlo en filtros PostgREST (ilike). */
export function searchTerm(input) {
  return String(input ?? '')
    .replace(/[,()*%\\:."']/g, ' ')
    .trim()
    .slice(0, 60);
}
