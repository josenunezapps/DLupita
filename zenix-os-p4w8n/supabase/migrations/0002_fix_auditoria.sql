-- Zenix OS · 0002_fix_auditoria
-- Corrige zos_write_audit: con CASE, PL/pgSQL resuelve new.organization_id aunque la tabla sea
-- zos_organizations (que no tiene esa columna) y el alta del negocio fallaba. Con IF solo se evalúa
-- la rama que corresponde. Lo detectó el test supabase/tests/0001_nucleo.sql antes de publicar.
create or replace function public.zos_write_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  if tg_table_name = 'zos_organizations' then
    v_org := new.id;
  else
    v_org := new.organization_id;
  end if;
  insert into public.zos_audit_events (organization_id, actor_id, action, entity, entity_id)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, new.id::text);
  return new;
end;
$$;
revoke execute on function public.zos_write_audit() from public, anon, authenticated;
