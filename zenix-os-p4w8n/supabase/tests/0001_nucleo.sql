-- Zenix OS · Test del núcleo (ZOS-H1): roles, invitaciones, stock, inmutabilidad y aislamiento.
-- Corre en una transacción y termina con un error controlado que la revierte. Esperado: "FALLAS: 0".

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a1000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'duenio@zos.test', '', now(), now(), now(), '{}', '{}'),
  ('51000000-0000-4000-8000-000000000051', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'super@zos.test', '', now(), now(), now(), '{}', '{}'),
  ('71000000-0000-4000-8000-000000000071', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vende@zos.test', '', now(), now(), now(), '{}', '{}'),
  ('b1000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'otro@zos.test', '', now(), now(), now(), '{}', '{}');

create temp table t_results (n serial, name text, ok boolean, detail text) on commit drop;
create temp table t_ids (k text primary key, val text) on commit drop;
grant all on t_results, t_ids to authenticated, anon;
grant usage on sequence t_results_n_seq to authenticated, anon;

-- Helper para cambiar de usuario dentro de la transacción
create function pg_temp.como(uid text, mail text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.como(text, text) to authenticated, anon;

-- ================= Dueño A =================
select pg_temp.como('a1000000-0000-4000-8000-0000000000a1', 'duenio@zos.test');
set local role authenticated;
insert into t_ids values ('org_a', public.zos_create_organization('Almacén A')::text);
insert into t_ids values ('inv_v', (public.zos_create_invitation('vendedor'))->>'code');
insert into t_ids values ('inv_s', (public.zos_create_invitation('supervisor'))->>'code');
insert into public.zos_categories (organization_id, name) select val::uuid, 'Bebidas' from t_ids where k = 'org_a';
insert into t_ids select 'cat_a', id::text from public.zos_categories where name = 'Bebidas';
insert into t_ids values ('prod_a', public.zos_create_product(
  jsonb_build_object('name', 'Gaseosa', 'price_minor', 250000, 'category_id', (select val from t_ids where k = 'cat_a'), 'min_stock_milli', 5000), 10000)::text);

do $$ declare s bigint; begin
  select public.stock_milli(p) into s from public.zos_products p where p.id = (select val::uuid from t_ids where k = 'prod_a');
  insert into t_results (name, ok, detail) values ('Producto con stock inicial 10', s = 10000, s::text);
  insert into t_results (name, ok, detail) values ('Código de invitación de 8 caracteres', length((select val from t_ids where k = 'inv_v')) = 8, (select val from t_ids where k = 'inv_v'));
end $$;

do $$ begin
  perform public.zos_update_member('a1000000-0000-4000-8000-0000000000a1', 'vendedor', true);
  insert into t_results (name, ok, detail) values ('El dueño no puede cambiarse a sí mismo', false, 'cambió');
exception when others then insert into t_results (name, ok, detail) values ('El dueño no puede cambiarse a sí mismo', true, sqlerrm); end $$;

-- ================= Vendedor se une =================
reset role; select pg_temp.como('71000000-0000-4000-8000-000000000071', 'vende@zos.test'); set local role authenticated;
do $$ declare o uuid; begin
  o := public.zos_accept_invitation(lower((select val from t_ids where k = 'inv_v')));
  insert into t_results (name, ok, detail) values ('Vendedor se une con el código (sin importar mayúsculas)', o::text = (select val from t_ids where k = 'org_a'), '');
end $$;
do $$ begin
  perform public.zos_accept_invitation((select val from t_ids where k = 'inv_s'));
  insert into t_results (name, ok, detail) values ('Un usuario con negocio no se une a otro', false, 'se unió');
exception when others then insert into t_results (name, ok, detail) values ('Un usuario con negocio no se une a otro', true, sqlerrm); end $$;

do $$ declare n int; begin
  select count(*) into n from public.zos_products;
  insert into t_results (name, ok, detail) values ('Vendedor ve el catálogo', n = 1, n || ' productos');
  select count(*) into n from public.zos_invitations;
  insert into t_results (name, ok, detail) values ('Vendedor no ve invitaciones', n = 0, n || ' filas');
  update public.zos_products set price_minor = 1 where id = (select val::uuid from t_ids where k = 'prod_a');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Vendedor no edita precios', n = 0, n || ' filas');
  insert into public.zos_customers (organization_id, name) select val::uuid, 'Cliente del vendedor' from t_ids where k = 'org_a';
  insert into t_results (name, ok, detail) values ('Vendedor carga clientes', true, '');
end $$;
do $$ begin
  perform public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 1000, 'entrada', 'x');
  insert into t_results (name, ok, detail) values ('Vendedor no mueve stock', false, 'movió');
exception when others then insert into t_results (name, ok, detail) values ('Vendedor no mueve stock', true, sqlerrm); end $$;
do $$ begin
  perform public.zos_create_product('{"name":"X","price_minor":1}', 0);
  insert into t_results (name, ok, detail) values ('Vendedor no crea productos', false, 'creó');
exception when others then insert into t_results (name, ok, detail) values ('Vendedor no crea productos', true, sqlerrm); end $$;
do $$ begin
  insert into public.zos_categories (organization_id, name) select val::uuid, 'Intrusa' from t_ids where k = 'org_a';
  insert into t_results (name, ok, detail) values ('Vendedor no crea categorías', false, 'creó');
exception when others then insert into t_results (name, ok, detail) values ('Vendedor no crea categorías', true, sqlerrm); end $$;
do $$ begin
  perform public.zos_create_invitation('vendedor');
  insert into t_results (name, ok, detail) values ('Vendedor no invita', false, 'invitó');
exception when others then insert into t_results (name, ok, detail) values ('Vendedor no invita', true, sqlerrm); end $$;

-- ================= Supervisor se une y mueve stock =================
reset role; select pg_temp.como('51000000-0000-4000-8000-000000000051', 'super@zos.test'); set local role authenticated;
select public.zos_accept_invitation((select val from t_ids where k = 'inv_s'));
do $$ begin
  perform public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 15000, 'salida', 'Venta grande');
  insert into t_results (name, ok, detail) values ('Salida mayor al stock: bloqueada', false, 'pasó');
exception when others then insert into t_results (name, ok, detail) values ('Salida mayor al stock: bloqueada', sqlerrm like '%stock suficiente%', sqlerrm); end $$;
do $$ begin
  perform public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 1000, 'salida', '');
  insert into t_results (name, ok, detail) values ('Salida sin motivo: rechazada', false, 'pasó');
exception when others then insert into t_results (name, ok, detail) values ('Salida sin motivo: rechazada', true, sqlerrm); end $$;
do $$ declare s bigint; n int; begin
  s := public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 4000, 'salida', 'Rotura');
  insert into t_results (name, ok, detail) values ('Salida de 4: quedan 6', s = 6000, s::text);
  s := public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 8000, 'ajuste', 'Conteo');
  insert into t_results (name, ok, detail) values ('Ajuste por conteo a 8', s = 8000, s::text);
  s := public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 2000, 'entrada', null);
  insert into t_results (name, ok, detail) values ('Entrada de 2: quedan 10', s = 10000, s::text);
  select count(*) into n from public.zos_stock_movements where product_id = (select val::uuid from t_ids where k = 'prod_a');
  insert into t_results (name, ok, detail) values ('Cuatro movimientos registrados', n = 4, n::text);
  update public.zos_products set price_minor = 260000 where id = (select val::uuid from t_ids where k = 'prod_a');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Supervisor edita precios', n = 1, n || ' filas');
  update public.zos_organizations set allow_negative_stock = true where id = (select val::uuid from t_ids where k = 'org_a');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Supervisor no cambia la configuración del negocio', n = 0, n || ' filas');
end $$;
do $$ begin
  perform public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 10000, 'inicial', null);
  insert into t_results (name, ok, detail) values ('No se carga stock inicial dos veces', false, 'pasó');
exception when others then insert into t_results (name, ok, detail) values ('No se carga stock inicial dos veces', true, sqlerrm); end $$;
do $$ begin
  update public.zos_stock_movements set qty_milli = 999000;
  insert into t_results (name, ok, detail) values ('Los movimientos no se editan', false, 'editó');
exception when others then insert into t_results (name, ok, detail) values ('Los movimientos no se editan', true, sqlerrm); end $$;
do $$ begin
  insert into public.zos_stock_movements (organization_id, product_id, qty_milli, kind) select (select val::uuid from t_ids where k = 'org_a'), (select val::uuid from t_ids where k = 'prod_a'), 1000, 'entrada';
  insert into t_results (name, ok, detail) values ('No se insertan movimientos por fuera de la función', false, 'insertó');
exception when others then insert into t_results (name, ok, detail) values ('No se insertan movimientos por fuera de la función', true, sqlerrm); end $$;

-- ================= Dueño: stock negativo opcional, desactivar vendedor =================
reset role; select pg_temp.como('a1000000-0000-4000-8000-0000000000a1', 'duenio@zos.test'); set local role authenticated;
update public.zos_organizations set allow_negative_stock = true where id = (select val::uuid from t_ids where k = 'org_a');
do $$ declare s bigint; begin
  s := public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 15000, 'salida', 'Venta anticipada');
  insert into t_results (name, ok, detail) values ('Con la opción activada, el stock puede quedar negativo', s = -5000, s::text);
end $$;
update public.zos_organizations set allow_negative_stock = false where id = (select val::uuid from t_ids where k = 'org_a');
select public.zos_update_member('71000000-0000-4000-8000-000000000071', 'vendedor', false);
do $$ declare inv text; begin
  inv := (public.zos_create_invitation('vendedor'))->>'code';
  insert into t_ids values ('inv_rev', inv);
  perform public.zos_revoke_invitation((select id from public.zos_invitations where code = inv));
end $$;
do $$ declare n int; begin
  select count(*) into n from public.zos_audit_events where organization_id = (select val::uuid from t_ids where k = 'org_a');
  insert into t_results (name, ok, detail) values ('Auditoría registra cambios', n >= 5, n || ' eventos');
end $$;

-- Vendedor desactivado
reset role; select pg_temp.como('71000000-0000-4000-8000-000000000071', 'vende@zos.test'); set local role authenticated;
do $$ declare n int; begin
  select count(*) into n from public.zos_products;
  insert into t_results (name, ok, detail) values ('Usuario desactivado pierde el acceso', n = 0, n || ' productos');
end $$;

-- ================= Otro negocio B =================
reset role; select pg_temp.como('b1000000-0000-4000-8000-0000000000b1', 'otro@zos.test'); set local role authenticated;
do $$ begin
  perform public.zos_accept_invitation((select val from t_ids where k = 'inv_rev'));
  insert into t_results (name, ok, detail) values ('Invitación revocada no sirve', false, 'se unió');
exception when others then insert into t_results (name, ok, detail) values ('Invitación revocada no sirve', true, sqlerrm); end $$;
do $$ begin
  perform public.zos_accept_invitation((select val from t_ids where k = 'inv_v'));
  insert into t_results (name, ok, detail) values ('Invitación usada no sirve', false, 'se unió');
exception when others then insert into t_results (name, ok, detail) values ('Invitación usada no sirve', true, sqlerrm); end $$;
insert into t_ids values ('org_b', public.zos_create_organization('Kiosco B')::text);
do $$ declare n int; a uuid := (select val::uuid from t_ids where k = 'org_a'); begin
  select count(*) into n from public.zos_products where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve productos de A', n = 0, n || '');
  select count(*) into n from public.zos_stock_movements where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve movimientos de A', n = 0, n || '');
  select count(*) into n from public.zos_customers where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve clientes de A', n = 0, n || '');
  select count(*) into n from public.zos_organization_members where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve el equipo de A', n = 0, n || '');
  select count(*) into n from public.zos_categories where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve categorías de A', n = 0, n || '');
  update public.zos_products set price_minor = 1 where organization_id = a;
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('B no edita productos de A', n = 0, n || '');
end $$;
do $$ begin
  perform public.zos_adjust_stock((select val::uuid from t_ids where k = 'prod_a'), 1000, 'entrada', null);
  insert into t_results (name, ok, detail) values ('B no mueve stock de A', false, 'movió');
exception when others then insert into t_results (name, ok, detail) values ('B no mueve stock de A', true, sqlerrm); end $$;
do $$ begin
  insert into public.zos_customers (organization_id, name) select val::uuid, 'Intruso' from t_ids where k = 'org_a';
  insert into t_results (name, ok, detail) values ('B no carga clientes en A', false, 'cargó');
exception when others then insert into t_results (name, ok, detail) values ('B no carga clientes en A', true, sqlerrm); end $$;
do $$ begin
  perform public.zos_create_product(jsonb_build_object('name', 'Con categoría ajena', 'price_minor', 1, 'category_id', (select val from t_ids where k = 'cat_a')), 0);
  insert into t_results (name, ok, detail) values ('B no usa categorías de A', false, 'usó');
exception when others then insert into t_results (name, ok, detail) values ('B no usa categorías de A', true, sqlerrm); end $$;

-- ================= Anónimo y estructura =================
reset role; select set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
do $$ begin
  perform count(*) from public.zos_products;
  insert into t_results (name, ok, detail) values ('Anon no lee productos', false, 'leyó');
exception when others then insert into t_results (name, ok, detail) values ('Anon no lee productos', true, sqlerrm); end $$;
do $$ begin
  perform public.zos_create_organization('X');
  insert into t_results (name, ok, detail) values ('Anon no crea negocios', false, 'creó');
exception when others then insert into t_results (name, ok, detail) values ('Anon no crea negocios', true, sqlerrm); end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  insert into t_results (name, ok, detail) values ('Todas las tablas públicas tienen RLS (CotizaPro y Zenix OS)', n = 0, n || ' sin RLS');
end $$;

do $$ declare fallas int; txt text; begin
  select count(*) filter (where not ok), string_agg(case when ok then 'OK  ' else 'NG  ' end || name || coalesce(' — ' || nullif(detail, ''), ''), E'\n' order by n)
    into fallas, txt from t_results;
  raise exception E'FALLAS: %\n%', fallas, txt;
end $$;
