import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DEFAULT_BUSINESS_SLUG } from './config.js';
export const configured=Boolean(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'));
export const db=configured?createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}):null;
export const slug=new URLSearchParams(location.search).get('comercio')||DEFAULT_BUSINESS_SLUG;
export const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const price=x=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(x)||0);
export function errorView(title,body){return `<main class="center"><section class="notice"><span class="eyebrow">Zenix Web</span><h1>${html(title)}</h1><p>${html(body)}</p></section></main>`;}
export function goodUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return ''}}
export function alertError(e){return e?.message||'No se pudo completar la operación.'}
