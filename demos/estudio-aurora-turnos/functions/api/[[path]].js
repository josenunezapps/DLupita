// API de turnos de Sebastián González (Cloudflare D1). Proyecto de Cloudflare Pages propio. Binding: SG_DB · Secreto: RESEND_API_KEY
// Mails: usa RESEND_API_KEY (ya configurado en el sitio).
//
// Públicas:  GET public · POST bookings · POST mine {phone,code} · POST cancel {id,phone}
// Cuenta:    GET status · POST send-code {email,purpose} · POST verify-code {code,purpose} · POST login · POST logout
// Panel:     GET admin/state · PUT admin/bookings|blocks|settings
//            POST admin/setup {password,password2,phone} (primer ingreso o recuperación, tras el código)
//            GET admin/account · POST admin/password {current,password,password2}
//            POST admin/recovery {current,phone}  (el mail solo lo cambia Zenix AR)

const SITE = "https://estudioaurora.zenix.com.ar";
const BUSINESS = "Estudio Aurora";
const MAIL_FROM = "Turnos Estudio Aurora <turnos@zenix.com.ar>";
const COOKIE = "sg_admin";
const SESSION_HOURS = 24 * 14;
const TZ_OFFSET_MIN = -180; // Argentina, UTC-3
const CANCEL_LIMIT_HOURS = 24;

// Catálogo base (el panel puede cambiar nombre, precio, duración, activo, "desde", categoría y sumar servicios)
const SERVICES = {
  raices: ["Color (raíces)", 50000, 90], balayage: ["Balayage", 140000, 180], iluminacion: ["Iluminación / Babylights", 140000, 180],
  fantasia: ["Fantasías de color", 80000, 150], botox: ["Botox capilar / Shock de keratina", 65000, 90], alisado: ["Alisado", 90000, 150],
  alisadosf: ["Alisado sin formol", 120000, 180], ondulacion: ["Ondulación / Permanente", 70000, 120], cortedama: ["Corte dama", 30000, 60],
  tendencia: ["Corte en tendencia", 30000, 60], caballero: ["Corte caballero", 25000, 45], brushcorto: ["Brushing corto", 18000, 30],
  brushlargo: ["Brushing largo", 20000, 45], urbano: ["Peinado urbano", 50000, 60], gala: ["Peinado recogido de gala", 50000, 90], lavado: ["Lavado", 7000, 30],
};
const STAFF = ["sebastian"];

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...extra },
  });

const digits = (s) => String(s || "").replace(/\D/g, "");
const mins = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(String(t || "")); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const str = (v, max) => String(v ?? "").slice(0, max);
const isEmail = (v) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(v || ""));
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (v) => "$ " + Number(v || 0).toLocaleString("es-AR");

function nowLocal() {
  const d = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
// milisegundos (UTC) del inicio de un turno en hora argentina
const startMs = (date, time) => Date.parse(date + "T00:00:00Z") + (mins(time) - TZ_OFFSET_MIN) * 60000;

function prettyDate(date) {
  const d = new Date(date + "T12:00:00Z");
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}

function closeFor(date) {
  const dow = new Date(date + "T12:00:00Z").getUTCDay(); // 0 dom … 6 sáb
  if (dow === 0 || dow === 1) return null; // domingo y lunes cerrado
  return dow === 6 ? 960 : 1080; // sáb 16:00, mar-vie 18:00
}

function cookieOf(request, name) {
  const c = request.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : "";
}
const ipOf = (request) => request.headers.get("CF-Connecting-IP") || (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() || "unknown";

// ---------- kv ----------
async function kvGet(env, key, fallback = "") {
  const r = await env.SG_DB.prepare("SELECT value FROM kv WHERE key=?").bind(key).first();
  return r ? r.value : fallback;
}
const kvSet = (env, key, value) => env.SG_DB.prepare("INSERT OR REPLACE INTO kv (key,value) VALUES (?,?)").bind(key, String(value));

// ---------- contraseñas ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password || "")), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$100000$${b64(salt)}$${await pbkdf2(password, salt, 100000)}`;
}
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function checkPassword(env, password) {
  const stored = await kvGet(env, "admin_hash");
  if (!stored) return false;
  const [, iter, salt, hash] = stored.split("$");
  return sameText(await pbkdf2(password, unb64(salt), Number(iter)), hash);
}
function passwordProblem(p, p2) {
  p = String(p || "");
  if (p !== String(p2 || "")) return "Las contraseñas no coinciden";
  if (p.length < 12) return "La contraseña debe tener al menos 12 caracteres";
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p)) return "Usá mayúsculas y minúsculas";
  if (!/\d/.test(p)) return "Incluí al menos un número";
  if (!/[^A-Za-z0-9]/.test(p)) return "Incluí al menos un símbolo (por ejemplo ! ? # *)";
  if (/(.)\1\1/.test(p)) return "No repitas el mismo carácter 3 veces seguidas";
  if (/aurora|valentina|colorista|123456|qwerty|password|contrase/i.test(p)) return "No uses tu nombre ni palabras fáciles de adivinar";
  return "";
}
const sha256 = async (s) => b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
const randomToken = () => b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[^a-zA-Z0-9]/g, "");

async function session(env, request) {
  const token = cookieOf(request, COOKIE);
  if (!token) return null;
  const row = await env.SG_DB.prepare("SELECT token,expires FROM sessions WHERE token=?").bind(token).first();
  return row && row.expires > Date.now() ? row.token : null;
}
async function newSession(env) {
  const token = randomToken(), expires = Date.now() + SESSION_HOURS * 3600000;
  await env.SG_DB.batch([
    env.SG_DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(Date.now()),
    env.SG_DB.prepare("INSERT INTO sessions (token,expires) VALUES (?,?)").bind(token, expires),
  ]);
  return { "Set-Cookie": `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}` };
}

// ---------- mails ----------
function mailLayout(title, intro, rows, button, preview = "") {
  const rowsHtml = rows.map(([k, v]) => `<tr><td style="padding:8px 0;color:#8a8178;font-size:13px;width:130px;vertical-align:top;border-bottom:1px solid #f0ece6">${esc(k)}</td><td style="padding:8px 0;color:#1d1a17;font-size:14px;font-weight:600;border-bottom:1px solid #f0ece6">${v}</td></tr>`).join("");
  const btn = button ? `<p style="margin:26px 0 6px"><a href="${button[1]}" style="background:#bf9462;color:#17110b;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:.04em;padding:13px 22px;border-radius:6px;display:inline-block">${esc(button[0])}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview || title)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<div style="max-width:520px;margin:0 auto;padding:28px 18px">
<div style="background:#0d0d0d;border-radius:12px 12px 0 0;padding:22px 26px"><div style="color:#bf9462;font-size:11px;letter-spacing:.2em;font-weight:700">APP DE TURNOS</div><div style="color:#f4f1ec;font-size:20px;font-family:Georgia,serif;margin-top:4px">${BUSINESS} · Estilista y colorista</div></div>
<div style="background:#fff;border-radius:0 0 12px 12px;padding:26px">
<h1 style="margin:0 0 8px;font-size:21px;color:#1d1a17">${esc(title)}</h1><p style="margin:0 0 16px;color:#4b443d;font-size:14px;line-height:1.6">${intro}</p>
<table style="width:100%;border-collapse:collapse">${rowsHtml}</table>${btn}
</div><p style="color:#9b9289;font-size:11px;text-align:center;margin:16px 0 0">App de turnos de ${BUSINESS} · desarrollada por Zenix AR</p></div></body></html>`;
}
function htmlToText(html) {
  return String(html).replace(/<div style="display:none[^]*?<\/div>/, "").replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2: $1").replace(/<(br|\/p|\/tr|\/h1|\/div)[^>]*>/g, "\n").replace(/<td[^>]*>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#8199;|&#65279;|&#847;/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}
async function sendMail(env, to, subject, html, replyTo) {
  if (!env.RESEND_API_KEY || !isEmail(to)) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, text: htmlToText(html), ...(isEmail(replyTo) ? { reply_to: replyTo } : {}) }),
    });
    let info = "";
    try { info = (await r.text()).slice(0, 300); } catch {}
    try { await env.SG_DB.prepare("INSERT OR REPLACE INTO kv (key,value) VALUES ('last_mail',?)").bind(JSON.stringify({ at: new Date().toISOString(), to, subject, status: r.status, info })).run(); } catch {}
    return r.ok;
  } catch (e) {
    try { await env.SG_DB.prepare("INSERT OR REPLACE INTO kv (key,value) VALUES ('last_mail',?)").bind(JSON.stringify({ at: new Date().toISOString(), to, subject, error: String(e) })).run(); } catch {}
    return false;
  }
}
async function notifyOwner(env, kind, b, svcName) {
  const to = await kvGet(env, "notify_email");
  const wa = digits(b.phone);
  const waLink = wa ? `<a href="https://wa.me/${wa.length <= 10 ? "549" + wa : wa}" style="color:#9a6b38">${esc(b.phone)}</a>` : esc(b.phone);
  const rows = [["Servicio", esc(svcName)], ["Día", esc(prettyDate(b.date))], ["Hora", esc(b.time) + " h · " + b.duration + " min"], ["Clienta/e", esc(b.name)], ["WhatsApp", waLink]];
  if (b.email) rows.push(["Email", esc(b.email)]);
  if (b.notes) rows.push(["Nota", esc(b.notes)]);
  rows.push(["Precio", money(b.price)], ["Nº de turno", esc(b.id)]);
  const isNew = kind === "new";
  const title = isNew ? "Tenés un turno nuevo" : "Se canceló un turno";
  const intro = isNew ? "Reservaron desde tu página. El turno ya está en tu agenda y ese horario quedó ocupado." : "Cancelaron este turno desde tu página. El horario volvió a quedar libre para otra reserva.";
  const subject = `${isNew ? "Nuevo turno" : "Turno cancelado"}: ${svcName} · ${prettyDate(b.date)} ${b.time} h`;
  const preview = `${b.name} ${isNew ? "reservó" : "canceló"} ${svcName} para el ${prettyDate(b.date)} a las ${b.time} h`;
  return sendMail(env, to, subject, mailLayout(title, intro, rows, ["ABRIR MI PANEL", SITE + "/admin/"], preview), b.email);
}
async function mailClient(env, b, svcName) {
  if (!isEmail(b.email)) return false;
  const rows = [["Servicio", esc(svcName)], ["Día", esc(prettyDate(b.date))], ["Hora", esc(b.time) + " h"], ["Dirección", "Palermo, CABA"], ["Nº de turno", esc(b.id)]];
  return sendMail(env, b.email, `Tu turno con ${BUSINESS}: ${prettyDate(b.date)} ${b.time} h`,
    mailLayout("¡Tu turno está confirmado!", `Hola ${esc(b.name)}, te esperamos. Si necesitás cancelar, entrá en "Mis turnos" con tu teléfono y este número de turno, hasta ${CANCEL_LIMIT_HOURS} h antes.`, rows, ["VER MIS TURNOS", SITE + "/"], `Te esperamos el ${prettyDate(b.date)} a las ${b.time} h en Palermo, CABA`));
}

async function mailClientCancel(env, b, svcName) {
  if (!isEmail(b.email)) return false;
  const rows = [["Servicio", esc(svcName)], ["Día", esc(prettyDate(b.date))], ["Hora", esc(b.time) + " h"], ["Nº de turno", esc(b.id)]];
  return sendMail(env, b.email, `Cancelaste tu turno con ${BUSINESS}`,
    mailLayout("Tu turno fue cancelado", `Hola ${esc(b.name)}, cancelamos tu turno como pediste. Cuando quieras, podés reservar uno nuevo desde la página.`, rows, ["RESERVAR OTRO TURNO", SITE + "/"], `Cancelaste tu turno del ${prettyDate(b.date)} a las ${b.time} h`));
}

// ---------- datos ----------
async function catalog(env) {
  let st = {};
  try { st = JSON.parse(await kvGet(env, "settings", "{}")); } catch {}
  const out = {};
  for (const [id, [name, price, duration]] of Object.entries(SERVICES)) out[id] = { name, price, duration, active: true };
  for (const o of Array.isArray(st.services) ? st.services : []) {
    if (!o || typeof o.id !== "string" || !/^[a-z0-9_-]{2,40}$/i.test(o.id)) continue;
    const base = out[o.id] || { name: "Servicio", price: 0, duration: 60, active: true };
    out[o.id] = {
      name: str(o.name || base.name, 60),
      price: Number.isFinite(Number(o.price)) && Number(o.price) >= 0 ? Number(o.price) : base.price,
      duration: Number(o.duration) >= 15 && Number(o.duration) <= 300 ? Number(o.duration) : base.duration,
      active: o.active !== false,
    };
  }
  const staffOff = new Set((st.staff || []).filter((x) => x && x.active === false).map((x) => x.id));
  return { services: out, staff: STAFF.filter((x) => !staffOff.has(x)) };
}

async function loadAll(env) {
  const [bk, bl, st] = await Promise.all([
    env.SG_DB.prepare("SELECT data FROM bookings ORDER BY date, time").all(),
    env.SG_DB.prepare("SELECT id,date,start,end,barber_id,note FROM blocks ORDER BY date, start").all(),
    kvGet(env, "settings", "{}"),
  ]);
  return {
    bookings: bk.results.map((r) => JSON.parse(r.data)),
    blocks: bl.results.map((r) => ({ id: r.id, date: r.date, start: r.start, end: r.end, barberId: r.barber_id, note: r.note })),
    settings: JSON.parse(st || "{}"),
  };
}

function cleanBooking(b) {
  return {
    id: str(b.id, 60), name: str(b.name, 80).trim(), phone: str(b.phone, 30), email: str(b.email, 120).trim(), notes: str(b.notes, 500),
    serviceId: str(b.serviceId, 40), barberId: str(b.barberId, 40), date: str(b.date, 10), time: str(b.time, 5),
    duration: Math.max(15, Math.min(300, Number(b.duration) || 30)), price: Math.max(0, Number(b.price) || 0),
    status: ["confirmed", "pending", "cancelled"].includes(b.status) ? b.status : "confirmed",
    createdAt: str(b.createdAt || new Date().toISOString(), 40),
  };
}

async function slotProblem(env, b, exceptId = "") {
  const close = closeFor(b.date);
  const a = mins(b.time), end = a + b.duration;
  if (!isDate(b.date) || close === null || !Number.isFinite(a) || a < 600 || end > close || a % 30) return "Horario fuera de atención";
  const now = nowLocal();
  if (b.date < now.date || (b.date === now.date && a <= now.minutes)) return "Ese horario ya pasó";
  if (startMs(b.date, b.time) - Date.now() > 76 * 86400000) return "Solo se puede reservar hasta 75 días antes";
  const blocks = await env.SG_DB.prepare("SELECT start,end,barber_id FROM blocks WHERE date=?").bind(b.date).all();
  if (blocks.results.some((x) => (x.barber_id === b.barberId || x.barber_id === "all") && a < mins(x.end) && end > mins(x.start))) return "Ese horario no está disponible";
  const taken = await env.SG_DB.prepare("SELECT time,duration FROM bookings WHERE date=? AND barber_id=? AND status!='cancelled' AND id!=?").bind(b.date, b.barberId, exceptId).all();
  if (taken.results.some((x) => a < mins(x.time) + x.duration && end > mins(x.time))) return "Ese horario ya está ocupado";
  return "";
}

const saveBooking = (env, b, ip = "") =>
  env.SG_DB.prepare("INSERT INTO bookings (id,date,time,duration,barber_id,service_id,status,phone,data,created_at,ip) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,time=excluded.time,duration=excluded.duration,barber_id=excluded.barber_id,service_id=excluded.service_id,status=excluded.status,phone=excluded.phone,data=excluded.data")
    .bind(b.id, b.date, b.time, b.duration, b.barberId, b.serviceId, b.status, digits(b.phone), JSON.stringify(b), b.createdAt, ip);

const normCode = (c) => { const x = String(c || "").toUpperCase().replace(/[^A-Z0-9-]/g, ""); return x.startsWith("SG-") ? x : "SG-" + x; };

// ---------- handler ----------
export async function onRequest({ request, env, params, waitUntil }) {
  if (!env.SG_DB) return json({ error: "Falta configurar la base de datos (binding SG_DB)" }, 500);
  const later = (p) => Promise.race([Promise.resolve(p).then((r) => r, () => false), new Promise((res) => setTimeout(() => res("timeout"), 6000))]);
  const path = (Array.isArray(params.path) ? params.path.join("/") : String(params.path || "")).replace(/\/+$/, "");
  const method = request.method;
  let body = {};
  if (method === "POST" || method === "PUT") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Solicitud no permitida" }, 403);
    try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  }

  try {
    // ===== públicas =====
    if (path === "public" && method === "GET") {
      const all = await loadAll(env);
      const bookings = all.bookings.filter((b) => b.status !== "cancelled").map((b) => ({ id: "", date: b.date, time: b.time, duration: b.duration, barberId: b.barberId, serviceId: b.serviceId, status: b.status, price: 0, phone: "", name: "" }));
      return json({ bookings, blocks: all.blocks.map((x) => ({ ...x, note: "" })), settings: all.settings });
    }

    if (path === "bookings" && method === "POST") {
      // anti-bots: campo trampa y tiempo mínimo en la página
      if (str(body._hp, 100)) return json({ ok: true, booking: cleanBooking(body) });
      const elapsed = Date.now() - Number(body._t || 0);
      if (!Number.isFinite(elapsed) || elapsed < 4000) return json({ error: "Esperá unos segundos y volvé a intentar" }, 429);
      const b = cleanBooking(body);
      b.status = "confirmed";
      b.createdAt = new Date().toISOString();
      if (!/^SG-[A-Z0-9]{4,30}(-[A-Z0-9]{2,8})?$/.test(b.id) || b.name.length < 3 || digits(b.phone).length < 8) return json({ error: "Completá nombre y teléfono válidos" }, 400);
      if (b.email && !isEmail(b.email)) return json({ error: "El email no es válido" }, 400);
      const cat = await catalog(env);
      const svc = cat.services[b.serviceId];
      if (!svc || !svc.active || !cat.staff.includes(b.barberId)) return json({ error: "Servicio no disponible" }, 400);
      b.duration = svc.duration;
      b.price = svc.price;
      const ip = ipOf(request);
      const hourAgo = new Date(Date.now() - 3600000).toISOString();
      const [byIp, byPhone, exists] = await Promise.all([
        env.SG_DB.prepare("SELECT count(*) n FROM bookings WHERE ip=? AND created_at>?").bind(ip, hourAgo).first(),
        env.SG_DB.prepare("SELECT count(*) n FROM bookings WHERE phone=? AND status!='cancelled' AND date>=?").bind(digits(b.phone), nowLocal().date).first(),
        env.SG_DB.prepare("SELECT 1 FROM bookings WHERE id=?").bind(b.id).first(),
      ]);
      if (byIp.n >= 6) return json({ error: "Demasiadas reservas seguidas. Probá más tarde o escribí por WhatsApp." }, 429);
      if (byPhone.n >= 3) return json({ error: "Ya tenés 3 turnos reservados. Para otro, escribí por WhatsApp." }, 429);
      if (exists) return json({ error: "Probá de nuevo" }, 409);
      const problem = await slotProblem(env, b);
      if (problem) return json({ error: problem }, 409);
      await saveBooking(env, b, ip).run();
      const mailed = await later(Promise.all([notifyOwner(env, "new", b, svc.name), mailClient(env, b, svc.name)]));
      return json({ ok: true, booking: b, mailed });
    }

    if (path === "mine" && method === "POST") {
      const phone = digits(body.phone), code = normCode(body.code);
      if (phone.length < 8 || code.length < 7) return json({ error: "Ingresá tu teléfono y el número de turno" }, 400);
      const match = await env.SG_DB.prepare("SELECT 1 FROM bookings WHERE id=? AND phone=?").bind(code, phone).first();
      if (!match) return json({ error: "No encontramos un turno con ese teléfono y ese número" }, 404);
      // solo los turnos activos que todavía no pasaron
      const r = await env.SG_DB.prepare("SELECT data FROM bookings WHERE phone=? AND status!='cancelled' AND date>=? ORDER BY date, time LIMIT 30").bind(phone, nowLocal().date).all();
      const now = Date.now();
      return json({ bookings: r.results.map((x) => JSON.parse(x.data)).filter((b) => startMs(b.date, b.time) > now), cancelLimitHours: CANCEL_LIMIT_HOURS });
    }

    if (path === "cancel" && method === "POST") {
      const row = await env.SG_DB.prepare("SELECT data FROM bookings WHERE id=? AND phone=?").bind(str(body.id, 60), digits(body.phone)).first();
      if (!row) return json({ error: "Turno no encontrado" }, 404);
      const b = JSON.parse(row.data);
      if (b.status === "cancelled") return json({ ok: true });
      if (startMs(b.date, b.time) - Date.now() < CANCEL_LIMIT_HOURS * 3600000) return json({ error: `Faltan menos de ${CANCEL_LIMIT_HOURS} h para el turno. Para cancelarlo escribí por WhatsApp.` }, 403);
      b.status = "cancelled";
      await saveBooking(env, b).run();
      const svc = (await catalog(env)).services[b.serviceId];
      const mailed = await later(Promise.all([notifyOwner(env, "cancel", b, svc ? svc.name : b.serviceId), mailClientCancel(env, b, svc ? svc.name : b.serviceId)]));
      return json({ ok: true, mailed });
    }

    // ===== cuenta =====
    // El mail del dueño lo registra Zenix AR (kv owner_email). Nadie puede crear una cuenta con otro mail.
    if (path === "status" && method === "GET") {
      const owner = await kvGet(env, "owner_email");
      return json({ setup: (await kvGet(env, "must_change")) === "1", hasOwner: isEmail(owner) });
    }

    if (path === "send-code" && method === "POST") {
      const owner = (await kvGet(env, "owner_email")).toLowerCase();
      const email = str(body.email, 120).trim().toLowerCase();
      const purpose = body.purpose === "reset" ? "reset" : "setup";
      const generic = { ok: true, hint: isEmail(owner) ? owner.replace(/^(.).*(@.*)$/, "$1•••$2") : "" };
      if (!isEmail(owner) || email !== owner) return json(generic); // no revela si el mail existe
      if (purpose === "setup" && (await kvGet(env, "must_change")) !== "1") return json({ error: "Tu cuenta ya está creada. Entrá con tu contraseña o usá \"¿Olvidaste tu contraseña?\"." }, 400);
      const last = Number(await kvGet(env, "code_sent", "0"));
      if (Date.now() - last < 60000) return json({ error: "Esperá un minuto antes de pedir otro código" }, 429);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
      await env.SG_DB.batch([
        kvSet(env, "code_hash", await sha256(code + ":" + purpose)), kvSet(env, "code_expires", Date.now() + 600000),
        kvSet(env, "code_tries", 0), kvSet(env, "code_sent", Date.now()),
      ]);
      const title = purpose === "setup" ? "Tu código para activar el panel" : "Tu código para cambiar la contraseña";
      const intro = purpose === "setup"
        ? "Usá este código para entrar por primera vez a tu panel de turnos y crear tu contraseña."
        : "Usá este código para crear una contraseña nueva en tu panel de turnos. Si no lo pediste vos, ignorá este mail: tu contraseña actual sigue funcionando.";
      const html = mailLayout(title, intro + "<br><br><span style=\"display:inline-block;font-size:32px;letter-spacing:10px;font-weight:700;color:#1d1a17;background:#f4f1ec;border-radius:8px;padding:12px 18px\">" + code + "</span><br><br>Vence en 10 minutos.", [], null, `Tu código es ${code}. Vence en 10 minutos.`);
      const sent = await later(sendMail(env, owner, `${code} es tu código del panel de turnos`, html));
      if (sent !== true) return json({ error: "No pudimos enviar el mail. Probá de nuevo en un rato." }, 502);
      return json(generic);
    }

    if (path === "verify-code" && method === "POST") {
      const purpose = body.purpose === "reset" ? "reset" : "setup";
      const [h, exp, tries] = await Promise.all([kvGet(env, "code_hash"), kvGet(env, "code_expires", "0"), kvGet(env, "code_tries", "0")]);
      if (!h || Number(exp) < Date.now()) return json({ error: "El código venció. Pedí uno nuevo." }, 400);
      if (Number(tries) >= 5) return json({ error: "Demasiados intentos. Pedí un código nuevo." }, 429);
      if (!sameText(await sha256(digits(body.code) + ":" + purpose), h)) {
        await kvSet(env, "code_tries", Number(tries) + 1).run();
        return json({ error: "Código incorrecto" }, 400);
      }
      await env.SG_DB.batch([env.SG_DB.prepare("DELETE FROM kv WHERE key IN ('code_hash','code_expires','code_tries')"), kvSet(env, "pw_reset_ok", Date.now() + 900000)]);
      return json({ ok: true }, 200, await newSession(env));
    }

    if (path === "login" && method === "POST") {
      if ((await kvGet(env, "must_change")) === "1") return json({ error: "Tu panel todavía no está activado. Entrá con el código que te llega por mail.", setup: true }, 400);
      const lockUntil = Number(await kvGet(env, "lock_until", "0"));
      if (lockUntil > Date.now()) return json({ error: "Demasiados intentos. Esperá 10 minutos." }, 429);
      if (!(await checkPassword(env, body.password))) {
        const fails = Number(await kvGet(env, "fails", "0")) + 1;
        await env.SG_DB.batch([kvSet(env, "fails", fails >= 5 ? 0 : fails), ...(fails >= 5 ? [kvSet(env, "lock_until", Date.now() + 600000)] : [])]);
        return json({ error: fails >= 5 ? "Demasiados intentos. Esperá 10 minutos." : "Contraseña incorrecta" }, 401);
      }
      await kvSet(env, "fails", 0).run();
      return json({ ok: true }, 200, await newSession(env));
    }

    if (path === "logout" && method === "POST") {
      const token = cookieOf(request, COOKIE);
      if (token) await env.SG_DB.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
      return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
    }

    // ===== panel =====
    if (path.startsWith("admin/")) {
      const token = await session(env, request);
      if (!token) return json({ error: "No autorizado" }, 401);
      const mustChange = (await kvGet(env, "must_change")) === "1";
      const canSetPw = mustChange || Number(await kvGet(env, "pw_reset_ok", "0")) > Date.now();

      // crear contraseña: primer ingreso o después de verificar el código de recuperación
      if (path === "admin/setup" && method === "POST") {
        if (!canSetPw) return json({ error: "Pedí un código nuevo para cambiar la contraseña" }, 400);
        const problem = passwordProblem(body.password, body.password2);
        if (problem) return json({ error: problem }, 400);
        const phone = str(body.phone, 30).trim();
        if (mustChange && digits(phone).length < 10) return json({ error: "Ingresá tu celular con código de área (por ejemplo 11 5555 0123)" }, 400);
        const owner = await kvGet(env, "owner_email");
        await env.SG_DB.batch([
          kvSet(env, "admin_hash", await hashPassword(body.password)), kvSet(env, "must_change", "0"),
          ...(mustChange ? [kvSet(env, "recovery_phone", phone), kvSet(env, "notify_email", owner)] : []),
          env.SG_DB.prepare("DELETE FROM kv WHERE key IN ('pw_reset_ok','fails','lock_until')"),
          env.SG_DB.prepare("DELETE FROM sessions WHERE token!=?").bind(token),
        ]);
        if (mustChange) {
          await later(sendMail(env, owner, "Tu app de turnos ya está lista",
            mailLayout("¡Tu app de turnos ya está lista!", "Activaste tu panel y creaste tu contraseña. Desde ahora vas a recibir en este mail un aviso cada vez que reserven o cancelen un turno desde tu página.", [["Tu página", `<a href="${SITE}/" style="color:#9a6b38">sebastiancolorista.zenix.com.ar</a>`], ["Tu panel", `<a href="${SITE}/admin/" style="color:#9a6b38">sebastiancolorista.zenix.com.ar/admin</a>`], ["Celular de contacto", esc(phone)]], ["ABRIR MI PANEL", SITE + "/admin/"], "Desde ahora te avisamos por acá cada turno nuevo o cancelado")));
        }
        return json({ ok: true, first: mustChange });
      }

      if (mustChange) return json({ error: "Tenés que crear tu contraseña", mustChange: true }, 403);

      if (path === "admin/account" && method === "GET") {
        return json({ email: await kvGet(env, "owner_email"), phone: await kvGet(env, "recovery_phone") });
      }
      if (path === "admin/password" && method === "POST") {
        if (!(await checkPassword(env, body.current))) return json({ error: "La contraseña actual no es correcta" }, 400);
        const problem = passwordProblem(body.password, body.password2);
        if (problem) return json({ error: problem }, 400);
        if (body.password === body.current) return json({ error: "La nueva contraseña tiene que ser distinta" }, 400);
        await env.SG_DB.batch([kvSet(env, "admin_hash", await hashPassword(body.password)), env.SG_DB.prepare("DELETE FROM sessions WHERE token!=?").bind(token)]);
        return json({ ok: true });
      }
      if (path === "admin/recovery" && method === "POST") {
        if (!(await checkPassword(env, body.current))) return json({ error: "La contraseña actual no es correcta" }, 400);
        const phone = str(body.phone, 30).trim();
        if (digits(phone).length < 10) return json({ error: "Ingresá tu celular con código de área" }, 400);
        await kvSet(env, "recovery_phone", phone).run();
        return json({ ok: true });
      }
      if (path === "admin/state" && method === "GET") return json(await loadAll(env));

      if (path === "admin/account" && method === "GET") {
        return json({ email: await kvGet(env, "recovery_email"), phone: await kvGet(env, "recovery_phone") });
      }
      if (path === "admin/password" && method === "POST") {
        if (!(await checkPassword(env, body.current))) return json({ error: "La contraseña actual no es correcta" }, 400);
        const problem = passwordProblem(body.password, body.password2);
        if (problem) return json({ error: problem }, 400);
        if (body.password === body.current) return json({ error: "La nueva contraseña tiene que ser distinta" }, 400);
        await env.SG_DB.batch([kvSet(env, "admin_hash", await hashPassword(body.password)), env.SG_DB.prepare("DELETE FROM sessions WHERE token!=?").bind(token)]);
        return json({ ok: true });
      }
      if (path === "admin/recovery" && method === "POST") {
        if (!(await checkPassword(env, body.current))) return json({ error: "La contraseña actual no es correcta" }, 400);
        const email = str(body.email, 120).trim().toLowerCase(), phone = str(body.phone, 30).trim();
        if (!isEmail(email)) return json({ error: "Ingresá un email válido" }, 400);
        if (digits(phone).length < 10) return json({ error: "Ingresá tu celular con código de área" }, 400);
        await env.SG_DB.batch([kvSet(env, "recovery_email", email), kvSet(env, "recovery_phone", phone), kvSet(env, "notify_email", email)]);
        return json({ ok: true });
      }
      if (path === "admin/bookings" && method === "PUT") {
        // Solo actualiza los turnos enviados (nunca borra): no pisa reservas nuevas hechas con el panel abierto
        const list = (Array.isArray(body) ? body : []).map(cleanBooking).filter((b) => b.id && isDate(b.date));
        if (list.length) await env.SG_DB.batch(list.map((b) => saveBooking(env, b)));
        return json({ ok: true });
      }
      if (path === "admin/blocks" && method === "PUT") {
        const list = (Array.isArray(body) ? body : []).filter((x) => x && x.id && isDate(x.date));
        await env.SG_DB.batch([
          env.SG_DB.prepare("DELETE FROM blocks"),
          ...list.map((x) => env.SG_DB.prepare("INSERT INTO blocks (id,date,start,end,barber_id,note) VALUES (?,?,?,?,?,?)").bind(str(x.id, 60), x.date, str(x.start, 5), str(x.end, 5), str(x.barberId || "all", 40), str(x.note, 200))),
        ]);
        return json({ ok: true });
      }
      if (path === "admin/settings" && method === "PUT") {
        const value = JSON.stringify(body && typeof body === "object" ? body : {});
        if (value.length > 60000) return json({ error: "Ajustes demasiado grandes" }, 400);
        await kvSet(env, "settings", value).run();
        return json({ ok: true });
      }
    }

    return json({ error: "Ruta no encontrada" }, 404);
  } catch (err) {
    return json({ error: "Error del servidor" }, 500);
  }
}
