// Configuración pública. La clave publicable de Supabase está pensada para el navegador:
// la seguridad la dan las políticas RLS de la base, no el secreto de esta clave.
// Nunca poner acá la clave service_role ni ningún otro secreto.
// Zenix OS usa el mismo proyecto Supabase que CotizaPro (tablas con prefijo zos_).
export const SUPABASE_URL = 'https://wqnlbyrpoygqruskfagr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_oh890vH4eoyGd1L7F-Ag8g_fBQIpafm';
export const APP_VERSION = 'ZOS-H1 · 0.1.0';
