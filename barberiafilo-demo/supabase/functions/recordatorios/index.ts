// Función de Supabase: manda el aviso push a los turnos que empiezan en ~2 horas.
// La llama el cron de push.sql cada 15 minutos.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const NEGOCIO = Deno.env.get("NEGOCIO") ?? "Barbería Filo";
const DIRECCION = Deno.env.get("DIRECCION") ?? "";
const SITIO = Deno.env.get("SITIO_URL") ?? "https://josenunezapps.github.io/DLupita/barberiafilo-demo/";

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:turnos@example.com",
  Deno.env.get("VAPID_PUBLIC")!,
  Deno.env.get("VAPID_PRIVATE")!,
);

Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.rpc("turnos_para_avisar");
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let enviados = 0, fallidos = 0;
  for (const t of data ?? []) {
    const payload = JSON.stringify({
      title: `Hoy a las ${t.hora} tenés turno`,
      body: `En ${NEGOCIO}${DIRECCION ? ", " + DIRECCION : ""}. ¡No te olvides!`,
      url: SITIO,
    });
    try {
      await webpush.sendNotification(t.push_sub, payload, { TTL: 3600 });
      await sb.from("turnos").update({ push_enviado: true }).eq("id", t.id);
      enviados++;
    } catch (e) {
      fallidos++;
      // 404/410: el cliente quitó el permiso o el navegador ya no existe. No reintentar.
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await sb.from("turnos").update({ push_enviado: true, push_sub: null }).eq("id", t.id);
      }
    }
  }
  return new Response(JSON.stringify({ enviados, fallidos }), { headers: { "Content-Type": "application/json" } });
});
