// OBRIVA · Asistente IA (Cloudflare Worker + Workers AI)
// Despliegue: Workers & Pages → Create → Worker → pegar este código → Deploy.
// Luego: Settings → Bindings → Add → Workers AI → nombre de variable: AI.
// La IA solo propone acciones; la app las muestra y el usuario las confirma.

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ALLOWED_ORIGINS = [
  "https://josenunezapps.github.io",
  "https://zenix.com.ar",
  "https://www.zenix.com.ar",
];
const MAX_BODY = 40000;          // bytes por pedido
const MAX_PER_MINUTE = 12;       // pedidos por IP y por minuto (aproximado)

const ACTION_TYPES = [
  "create_client", "create_staff", "create_job", "create_quote",
  "register_payment", "update_job_status",
];

const SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ACTION_TYPES },
          client_id: { type: "string" },
          client_name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          address: { type: "string" },
          staff_id: { type: "string" },
          staff_name: { type: "string" },
          role: { type: "string" },
          job_id: { type: "string" },
          title: { type: "string" },
          category: { type: "string" },
          date: { type: "string" },
          time: { type: "string" },
          amount: { type: "number" },
          status: { type: "string" },
          notes: { type: "string" },
        },
        required: ["type"],
      },
    },
  },
  required: ["reply", "actions"],
};

function systemPrompt(ctx) {
  return `Sos el asistente de OBRIVA, una app para empresas de servicios técnicos (electricidad, plomería, climatización, mantenimiento) en Argentina. Hablás en español rioplatense, breve y claro.

Tu trabajo: convertir los pedidos del usuario en acciones sobre sus datos, o responder preguntas usando el CONTEXTO. Respondé SIEMPRE con un JSON: {"reply": "...", "actions": [...]}.

Acciones posibles:
- create_client: client_name (obligatorio), phone, email, address, notes
- create_staff: staff_name (obligatorio), role
- create_job (orden de trabajo): title (obligatorio), client_id o client_name, staff_id o staff_name, date (YYYY-MM-DD), time (HH:MM), amount (importe total en pesos), category, notes
- create_quote (presupuesto): title (obligatorio), client_id o client_name, amount, notes
- register_payment (cobro): job_id (obligatorio), amount
- update_job_status: job_id (obligatorio), status: "scheduled" | "working" | "completed" | "cancelled"

Reglas:
- Hoy es ${ctx.today} (${ctx.weekday}). Convertí "mañana", "el viernes", etc. a fecha YYYY-MM-DD.
- Importes como número: "95 mil" = 95000, "1,2 millones" = 1200000.
- Usá los id del CONTEXTO cuando el cliente, técnico u orden ya existe. Si el cliente no existe y el usuario pide una orden o presupuesto para él, agregá primero un create_client y en la orden usá client_name.
- Un pedido puede generar varias acciones (por ejemplo, "agregá a Juan y a Pedro" = dos create_client).
- Si falta un dato obligatorio o el pedido es ambiguo (dos clientes con nombre parecido), no inventes: preguntá en "reply" y dejá "actions" vacío.
- Si es una pregunta (cuánto me deben, qué hay hoy, etc.), respondé en "reply" con datos del CONTEXTO y "actions" vacío.
- En "reply", resumí en una o dos oraciones lo que vas a hacer. El usuario confirma antes de que se guarde.
- Nunca inventes teléfonos, emails ni importes que el usuario no dijo.

CONTEXTO (datos actuales del negocio "${ctx.business}"):
${JSON.stringify({ clientes: ctx.clients, equipo: ctx.staff, ordenes: ctx.jobs, presupuestos: ctx.quotes })}`;
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_MINUTE;
}

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function clean(s, max) {
  return String(s == null ? "" : s).slice(0, max || 200);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Usá POST." }, 405, headers);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "Origen no permitido." }, 403, headers);

    const ip = request.headers.get("CF-Connecting-IP") || "?";
    if (rateLimited(ip)) return json({ error: "Demasiados pedidos. Esperá un minuto." }, 429, headers);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "Pedido demasiado grande." }, 413, headers);

    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "JSON inválido." }, 400, headers); }

    const message = clean(body.message, 1500).trim();
    if (!message) return json({ error: "Mensaje vacío." }, 400, headers);
    const c = body.context || {};
    const ctx = {
      business: clean(c.business, 90),
      today: clean(c.today, 10),
      weekday: clean(c.weekday, 20),
      clients: (c.clients || []).slice(0, 200),
      staff: (c.staff || []).slice(0, 50),
      jobs: (c.jobs || []).slice(0, 60),
      quotes: (c.quotes || []).slice(0, 40),
    };
    const history = (body.history || []).slice(-6).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: clean(m.content, 1500),
    }));

    if (!env.AI) return json({ error: "Falta el binding de Workers AI (variable AI)." }, 500, headers);

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: systemPrompt(ctx) },
          ...history,
          { role: "user", content: message },
        ],
        response_format: { type: "json_schema", json_schema: SCHEMA },
        max_tokens: 900,
        temperature: 0.2,
      });

      let out = result && result.response;
      if (typeof out === "string") {
        const m = out.match(/\{[\s\S]*\}/);
        out = m ? JSON.parse(m[0]) : { reply: out, actions: [] };
      }
      const reply = clean(out && out.reply, 1500) || "Listo.";
      const actions = (Array.isArray(out && out.actions) ? out.actions : [])
        .filter((a) => a && ACTION_TYPES.includes(a.type))
        .slice(0, 10);
      return json({ reply, actions }, 200, headers);
    } catch (err) {
      return json({ error: "La IA no pudo procesar el pedido. Probá reformularlo." }, 502, headers);
    }
  },
};
