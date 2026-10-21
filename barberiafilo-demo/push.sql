-- Avisos push 2 horas antes del turno. Correlo DESPUÉS de supabase.sql.
-- Antes de correrlo, reemplazá TU-PROYECTO y TU_ANON_KEY al final del archivo.

alter table public.turnos add column if not exists push_sub jsonb;
alter table public.turnos add column if not exists push_enviado boolean not null default false;

-- El cliente guarda su permiso de aviso en su propio turno (solo si todavía no tiene uno).
create or replace function public.guardar_push(p_id uuid, p_sub jsonb) returns void
language sql security definer set search_path = public as $$
  update public.turnos set push_sub = p_sub
  where id = p_id and push_sub is null and fecha >= current_date and estado <> 'cancelado';
$$;
revoke all on function public.guardar_push(uuid, jsonb) from public;
grant execute on function public.guardar_push(uuid, jsonb) to anon, authenticated;

-- Turnos que empiezan en las próximas 2 h 15 min y todavía no recibieron el aviso (hora de Argentina).
create or replace function public.turnos_para_avisar()
returns table (id uuid, fecha date, hora text, servicio text, push_sub jsonb)
language sql security definer set search_path = public as $$
  select t.id, t.fecha, t.hora, t.servicio, t.push_sub from public.turnos t
  where t.estado <> 'cancelado' and t.push_sub is not null and not t.push_enviado
    and (t.fecha + t.hora::time) >  (now() at time zone 'America/Argentina/Buenos_Aires')
    and (t.fecha + t.hora::time) <= (now() at time zone 'America/Argentina/Buenos_Aires') + interval '2 hours 15 minutes';
$$;
revoke all on function public.turnos_para_avisar() from public, anon, authenticated;
grant execute on function public.turnos_para_avisar() to service_role;

-- Cada 15 minutos llama a la función que manda los avisos.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('recordatorios-push') where exists (select 1 from cron.job where jobname = 'recordatorios-push');
select cron.schedule('recordatorios-push', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://TU-PROYECTO.supabase.co/functions/v1/recordatorios',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer TU_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  );
$$);
