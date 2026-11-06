-- CotizaPro · Test de aislamiento entre organizaciones (0001)
-- Corre todo dentro de una transacción y termina con un error controlado que la revierte:
-- no queda ningún dato de prueba en la base. El mensaje del error trae los resultados.
-- Uso: pegar en el editor SQL de Supabase (o execute_sql). Resultado esperado: "FALLAS: 0".

begin;

-- Dos usuarios ficticios
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'test-a@cotizapro.test', '', now(), now(), now(), '{}', '{}'),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'test-b@cotizapro.test', '', now(), now(), now(), '{}', '{}');

create temp table t_results (n serial, name text, ok boolean, detail text) on commit drop;
create temp table t_ids (k text primary key, v uuid) on commit drop;
grant all on t_results, t_ids to authenticated, anon;
grant usage on sequence t_results_n_seq to authenticated, anon;

-- ---------- Usuario A crea su negocio y datos ----------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

insert into t_ids values ('org_a', public.create_organization('Negocio A'));
insert into public.customers (organization_id, name) select v, 'Cliente de A' from t_ids where k = 'org_a';
insert into public.catalog_items (organization_id, description, price_minor) select v, 'Concepto de A', 150000 from t_ids where k = 'org_a';
insert into t_ids select 'cust_a', id from public.customers where name = 'Cliente de A';

do $$ begin
  perform public.create_organization('Segundo negocio de A');
  insert into t_results (name, ok, detail) values ('A no puede crear un segundo negocio', false, 'se creó');
exception when others then
  insert into t_results (name, ok, detail) values ('A no puede crear un segundo negocio', true, sqlerrm);
end $$;

do $$ declare n int; begin
  update public.organizations set name = 'Negocio A editado' where id = (select v from t_ids where k = 'org_a');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('A edita su propio negocio', n = 1, n || ' filas');
end $$;

do $$ begin
  update public.organizations set created_by = 'b0000000-0000-4000-8000-00000000000b' where id = (select v from t_ids where k = 'org_a');
  insert into t_results (name, ok, detail) values ('A no puede cambiar el dueño (created_by)', false, 'se actualizó');
exception when others then
  insert into t_results (name, ok, detail) values ('A no puede cambiar el dueño (created_by)', true, sqlerrm);
end $$;

do $$ declare n int; begin
  select count(*) into n from public.audit_events where organization_id = (select v from t_ids where k = 'org_a');
  insert into t_results (name, ok, detail) values ('Auditoría registra los cambios de A', n >= 4, n || ' eventos');
end $$;

-- ---------- Usuario B crea su negocio e intenta ver/modificar lo de A ----------
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

insert into t_ids values ('org_b', public.create_organization('Negocio B'));
insert into public.customers (organization_id, name) select v, 'Cliente de B' from t_ids where k = 'org_b';
insert into t_ids select 'cust_b', id from public.customers where name = 'Cliente de B';

do $$ declare n int; a uuid := (select v from t_ids where k = 'org_a'); begin
  select count(*) into n from public.organizations where id = a;
  insert into t_results (name, ok, detail) values ('B no ve el negocio de A', n = 0, n || ' filas');
  select count(*) into n from public.customers where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve clientes de A', n = 0, n || ' filas');
  select count(*) into n from public.catalog_items where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve conceptos de A', n = 0, n || ' filas');
  select count(*) into n from public.audit_events where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve la auditoría de A', n = 0, n || ' filas');
  select count(*) into n from public.organization_members where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve miembros de A', n = 0, n || ' filas');
  insert into t_results (name, ok, detail) values ('is_member(A) es falso para B', not public.is_member(a), '');
  select count(*) into n from public.customers;
  insert into t_results (name, ok, detail) values ('B ve solo su cliente', n = 1, n || ' filas');
end $$;

do $$ begin
  insert into public.customers (organization_id, name) values ((select v from t_ids where k = 'org_a'), 'Intruso');
  insert into t_results (name, ok, detail) values ('B no puede crear clientes en A', false, 'se insertó');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede crear clientes en A', true, sqlerrm);
end $$;

do $$ begin
  insert into public.catalog_items (organization_id, description, price_minor) values ((select v from t_ids where k = 'org_a'), 'Intruso', 1);
  insert into t_results (name, ok, detail) values ('B no puede crear conceptos en A', false, 'se insertó');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede crear conceptos en A', true, sqlerrm);
end $$;

do $$ declare n int; begin
  update public.customers set name = 'Hackeado' where id = (select v from t_ids where k = 'cust_a');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('B no puede editar clientes de A', n = 0, n || ' filas');
  update public.organizations set name = 'Hackeado' where id = (select v from t_ids where k = 'org_a');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('B no puede editar el negocio de A', n = 0, n || ' filas');
end $$;

do $$ begin
  update public.customers set organization_id = (select v from t_ids where k = 'org_a') where id = (select v from t_ids where k = 'cust_b');
  insert into t_results (name, ok, detail) values ('B no puede mover su cliente a A', false, 'se movió');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede mover su cliente a A', true, sqlerrm);
end $$;

do $$ begin
  delete from public.customers where id = (select v from t_ids where k = 'cust_b');
  insert into t_results (name, ok, detail) values ('Nadie puede borrar clientes (se archivan)', false, 'se borró');
exception when others then
  insert into t_results (name, ok, detail) values ('Nadie puede borrar clientes (se archivan)', true, sqlerrm);
end $$;

do $$ begin
  insert into public.organization_members (organization_id, user_id) values ((select v from t_ids where k = 'org_a'), 'b0000000-0000-4000-8000-00000000000b');
  insert into t_results (name, ok, detail) values ('B no puede sumarse como miembro de A', false, 'se insertó');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede sumarse como miembro de A', true, sqlerrm);
end $$;

do $$ begin
  insert into public.organizations (name) values ('Negocio directo');
  insert into t_results (name, ok, detail) values ('No se crean negocios fuera de la RPC', false, 'se insertó');
exception when others then
  insert into t_results (name, ok, detail) values ('No se crean negocios fuera de la RPC', true, sqlerrm);
end $$;

-- ---------- Sin sesión (anon) ----------
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$ begin
  perform count(*) from public.customers;
  insert into t_results (name, ok, detail) values ('Anon no lee clientes', false, 'pudo leer');
exception when others then
  insert into t_results (name, ok, detail) values ('Anon no lee clientes', true, sqlerrm);
end $$;

do $$ begin
  perform public.create_organization('Anon');
  insert into t_results (name, ok, detail) values ('Anon no crea negocios', false, 'se creó');
exception when others then
  insert into t_results (name, ok, detail) values ('Anon no crea negocios', true, sqlerrm);
end $$;

-- ---------- Estructura ----------
reset role;

do $$ declare n int; begin
  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  insert into t_results (name, ok, detail) values ('Todas las tablas públicas tienen RLS', n = 0, n || ' sin RLS');
end $$;

-- ---------- Resultado (revierte todo) ----------
do $$ declare fallas int; txt text; begin
  select count(*) filter (where not ok), string_agg(case when ok then 'OK  ' else 'NG  ' end || name || coalesce(' — ' || nullif(detail, ''), ''), E'\n' order by n)
    into fallas, txt from t_results;
  raise exception E'FALLAS: %\n%', fallas, txt;
end $$;
