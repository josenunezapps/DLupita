// Genera supabase/tests/0002_presupuestos.sql a partir de calc-cases.json,
// así la base se prueba con exactamente los mismos casos que el navegador.
// Uso: node cotizapro-k7r2w/tests/build-sql-test.mjs
import fs from 'node:fs';

const cases = JSON.parse(fs.readFileSync(new URL('./calc-cases.json', import.meta.url), 'utf8'));
const out = new URL('../supabase/tests/0002_presupuestos.sql', import.meta.url);
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const parity = cases.map((c, i) => {
  const data = {
    title: `Paridad ${i + 1}`,
    discount_type: c.opts.discount_type,
    discount_value: c.opts.discount_value,
    items: c.items.map((it, k) => ({ description: `Línea ${k + 1}`, unit: 'unidad', ...it })),
  };
  const e = c.expect;
  return `
update public.organizations set tax_enabled = ${c.opts.tax_enabled}, tax_rate_bp = ${c.opts.tax_rate_bp} where id = (select val from t_ids where k = 'org_a');
do $$ declare v uuid; r record; begin
  v := public.save_draft(null, ${q(JSON.stringify(data))}::jsonb);
  select * into r from public.calc_quote(v);
  insert into t_results (name, ok, detail) values (${q(`Paridad JS/SQL: ${c.name}`)},
    r.subtotal_minor = ${e.subtotal} and r.discount_minor = ${e.discount} and r.tax_minor = ${e.tax} and r.total_minor = ${e.total},
    format('sub %s desc %s imp %s total %s', r.subtotal_minor, r.discount_minor, r.tax_minor, r.total_minor));
end $$;`;
}).join('\n');

const sql = `-- CotizaPro · Test de presupuestos (0002). GENERADO por tests/build-sql-test.mjs: no editar a mano.
-- Corre dentro de una transacción y termina con un error controlado que la revierte.
-- Resultado esperado: el mensaje empieza con "FALLAS: 0".

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'test-a@cotizapro.test', '', now(), now(), now(), '{}', '{}'),
  ('b0000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated',
   'authenticated', 'test-b@cotizapro.test', '', now(), now(), now(), '{}', '{}');

create temp table t_results (n serial, name text, ok boolean, detail text) on commit drop;
create temp table t_ids (k text primary key, val uuid) on commit drop;
grant all on t_results, t_ids to authenticated, anon;
grant usage on sequence t_results_n_seq to authenticated, anon;

-- =================== Usuario A ===================
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

insert into t_ids values ('org_a', public.create_organization('Negocio A'));
insert into public.customers (organization_id, name) select val, 'Cliente de A' from t_ids where k = 'org_a';
insert into t_ids select 'cust_a', id from public.customers where name = 'Cliente de A';

-- ---------- Paridad de cálculo con app/lib/calc.js ----------
${parity}

update public.organizations set tax_enabled = true, tax_rate_bp = 2100 where id = (select val from t_ids where k = 'org_a');

-- ---------- Borrador y validaciones de emisión ----------
do $$ declare v uuid; begin
  v := public.save_draft(null, '{"title":"Sin cliente","items":[{"description":"X","qty_milli":1000,"unit_price_minor":100}]}');
  begin
    perform public.issue_quote(v);
    insert into t_results (name, ok, detail) values ('No se emite sin cliente', false, 'se emitió');
  exception when others then
    insert into t_results (name, ok, detail) values ('No se emite sin cliente', sqlerrm like '%cliente%', sqlerrm);
  end;
end $$;

do $$ declare v uuid; begin
  v := public.save_draft(null, jsonb_build_object('customer_id', (select val from t_ids where k = 'cust_a'), 'title', 'Vacío', 'items', '[]'::jsonb));
  begin
    perform public.issue_quote(v);
    insert into t_results (name, ok, detail) values ('No se emite sin líneas', false, 'se emitió');
  exception when others then
    insert into t_results (name, ok, detail) values ('No se emite sin líneas', sqlerrm like '%línea%', sqlerrm);
  end;
end $$;

do $$ declare v uuid; begin
  v := public.save_draft(null, jsonb_build_object('customer_id', (select val from t_ids where k = 'cust_a'), 'title', 'Descuento alto',
        'discount_type', 'amount', 'discount_value', 999999, 'items', '[{"description":"X","qty_milli":1000,"unit_price_minor":100}]'::jsonb));
  begin
    perform public.issue_quote(v);
    insert into t_results (name, ok, detail) values ('No se emite con descuento mayor al subtotal', false, 'se emitió');
  exception when others then
    insert into t_results (name, ok, detail) values ('No se emite con descuento mayor al subtotal', sqlerrm like '%descuento%', sqlerrm);
  end;
end $$;

-- Presupuesto real: 3 ventanas + colocación, IVA 21 %
do $$ declare v uuid; r jsonb; tot bigint; begin
  v := public.save_draft(null, jsonb_build_object(
    'customer_id', (select val from t_ids where k = 'cust_a'), 'title', 'Ventanas living', 'notes', 'Incluye retiro de escombros',
    'items', '[{"description":"Ventana 120x100","unit":"unidad","qty_milli":3000,"unit_price_minor":18500000},
               {"description":"Colocación","unit":"unidad","qty_milli":3000,"unit_price_minor":3500000,"discount_bp":1000}]'::jsonb));
  insert into t_ids values ('q1', v);
  select public.quote_total(q) into tot from public.quotes q where q.id = v;
  insert into t_results (name, ok, detail) values ('quote_total calcula el borrador', tot = 78589500, tot::text);
  r := public.issue_quote(v);
  insert into t_results (name, ok, detail) values ('Primera emisión recibe el número 1', (r->>'number')::int = 1, r::text);
end $$;

do $$ declare v uuid; r jsonb; begin
  v := public.save_draft(null, jsonb_build_object('customer_id', (select val from t_ids where k = 'cust_a'), 'title', 'Segundo',
        'items', '[{"description":"Y","qty_milli":1000,"unit_price_minor":5000}]'::jsonb));
  insert into t_ids values ('q2', v);
  r := public.issue_quote(v);
  insert into t_results (name, ok, detail) values ('Segunda emisión recibe el número 2', (r->>'number')::int = 2, r::text);
end $$;

do $$ begin
  perform public.issue_quote((select val from t_ids where k = 'q1'));
  insert into t_results (name, ok, detail) values ('No se emite dos veces', false, 'se emitió de nuevo');
exception when others then
  insert into t_results (name, ok, detail) values ('No se emite dos veces', true, sqlerrm);
end $$;

do $$ declare s jsonb; q public.quotes; begin
  select snapshot into s from public.quote_versions where quote_id = (select val from t_ids where k = 'q1');
  select * into q from public.quotes where id = (select val from t_ids where k = 'q1');
  insert into t_results (name, ok, detail) values ('Snapshot guarda totales, cliente, emisor y líneas',
    (s->'totals'->>'total_minor')::bigint = q.total_minor and s->'customer'->>'name' = 'Cliente de A'
      and s->'issuer'->>'name' = 'Negocio A' and jsonb_array_length(s->'items') = 2 and (s->>'number')::int = 1,
    format('total %s', s->'totals'->>'total_minor'));
  insert into t_results (name, ok, detail) values ('Total emitido: 3×185.000 + 3×35.000 −10 % + IVA 21 %', q.total_minor = 78589500, q.total_minor::text);
end $$;

-- ---------- Inmutabilidad ----------
update public.organizations set name = 'Negocio A renombrado', tax_rate_bp = 1050 where id = (select val from t_ids where k = 'org_a');
update public.customers set name = 'Cliente renombrado' where id = (select val from t_ids where k = 'cust_a');

do $$ declare s jsonb; tot bigint; begin
  select snapshot into s from public.quote_versions where quote_id = (select val from t_ids where k = 'q1');
  select public.quote_total(q) into tot from public.quotes q where q.id = (select val from t_ids where k = 'q1');
  insert into t_results (name, ok, detail) values ('Cambiar negocio, cliente o IVA no altera lo emitido',
    s->'issuer'->>'name' = 'Negocio A' and s->'customer'->>'name' = 'Cliente de A' and tot = 78589500, tot::text);
end $$;

do $$ declare n int; begin
  update public.quotes set title = 'Cambiado' where id = (select val from t_ids where k = 'q1');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Un emitido no se puede editar', n = 0, n || ' filas');
  delete from public.quotes where id = (select val from t_ids where k = 'q1');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Un emitido no se puede borrar', n = 0, n || ' filas');
  update public.quote_items set unit_price_minor = 1 where quote_id = (select val from t_ids where k = 'q1');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Las líneas de un emitido no se pueden editar', n = 0, n || ' filas');
end $$;

do $$ begin
  perform public.save_draft((select val from t_ids where k = 'q1'), '{"title":"x","items":[]}');
  insert into t_results (name, ok, detail) values ('save_draft rechaza un emitido', false, 'se guardó');
exception when others then
  insert into t_results (name, ok, detail) values ('save_draft rechaza un emitido', true, sqlerrm);
end $$;

do $$ begin
  insert into public.quote_items (quote_id, organization_id, position, description, qty_milli, unit_price_minor)
  values ((select val from t_ids where k = 'q1'), (select val from t_ids where k = 'org_a'), 9, 'Agregada', 1000, 1);
  insert into t_results (name, ok, detail) values ('No se agregan líneas a un emitido', false, 'se insertó');
exception when others then
  insert into t_results (name, ok, detail) values ('No se agregan líneas a un emitido', true, sqlerrm);
end $$;

do $$ begin
  update public.quote_versions set snapshot = '{}' where quote_id = (select val from t_ids where k = 'q1');
  insert into t_results (name, ok, detail) values ('El snapshot no se puede modificar', false, 'se modificó');
exception when others then
  insert into t_results (name, ok, detail) values ('El snapshot no se puede modificar', true, sqlerrm);
end $$;

do $$ begin
  update public.quotes set status = 'aceptado' where id = (select val from t_ids where k = 'q2');
  insert into t_results (name, ok, detail) values ('El estado no se cambia por UPDATE directo', false, 'se cambió');
exception when others then
  insert into t_results (name, ok, detail) values ('El estado no se cambia por UPDATE directo', true, sqlerrm);
end $$;

do $$ begin
  perform count(*) from public.org_counters;
  insert into t_results (name, ok, detail) values ('El contador de números no es accesible', false, 'pudo leer');
exception when others then
  insert into t_results (name, ok, detail) values ('El contador de números no es accesible', true, sqlerrm);
end $$;

-- ---------- Estados ----------
do $$ declare q uuid := (select val from t_ids where k = 'q1'); n int; begin
  perform public.set_quote_status(q, 'enviado');
  begin
    perform public.set_quote_status(q, 'emitido');
    insert into t_results (name, ok, detail) values ('No se vuelve de enviado a emitido', false, 'se cambió');
  exception when others then
    insert into t_results (name, ok, detail) values ('No se vuelve de enviado a emitido', true, sqlerrm);
  end;
  perform public.set_quote_status(q, 'aceptado');
  begin
    perform public.set_quote_status(q, 'cancelado');
    insert into t_results (name, ok, detail) values ('Un aceptado queda cerrado', false, 'se cambió');
  exception when others then
    insert into t_results (name, ok, detail) values ('Un aceptado queda cerrado', true, sqlerrm);
  end;
  select count(*) into n from public.quote_events where quote_id = q;
  insert into t_results (name, ok, detail) values ('Historial: emitido → enviado → aceptado', n = 3, n || ' eventos');
end $$;

do $$ declare v uuid; begin
  v := public.save_draft(null, '{"title":"Borrador","items":[]}');
  begin
    perform public.set_quote_status(v, 'aceptado');
    insert into t_results (name, ok, detail) values ('Un borrador no se acepta sin emitir', false, 'se cambió');
  exception when others then
    insert into t_results (name, ok, detail) values ('Un borrador no se acepta sin emitir', true, sqlerrm);
  end;
end $$;

-- ---------- Duplicar y borrar ----------
do $$ declare d uuid; q public.quotes; n int; begin
  d := public.duplicate_quote((select val from t_ids where k = 'q1'));
  insert into t_ids values ('dup', d);
  select * into q from public.quotes where id = d;
  select count(*) into n from public.quote_items where quote_id = d;
  insert into t_results (name, ok, detail) values ('Duplicar crea un borrador sin número con las mismas líneas',
    q.status = 'borrador' and q.number is null and n = 2 and q.title = 'Ventanas living (copia)', format('%s líneas', n));
end $$;

do $$ declare n int; begin
  delete from public.quotes where id = (select val from t_ids where k = 'dup');
  get diagnostics n = row_count;
  insert into t_results (name, ok, detail) values ('Un borrador se puede borrar', n = 1, n || ' filas');
end $$;

-- =================== Usuario B ===================
reset role;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
insert into t_ids values ('org_b', public.create_organization('Negocio B'));

do $$ declare n int; a uuid := (select val from t_ids where k = 'org_a'); begin
  select count(*) into n from public.quotes where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve presupuestos de A', n = 0, n || ' filas');
  select count(*) into n from public.quote_items where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve líneas de A', n = 0, n || ' filas');
  select count(*) into n from public.quote_versions where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve snapshots de A', n = 0, n || ' filas');
  select count(*) into n from public.quote_events where organization_id = a;
  insert into t_results (name, ok, detail) values ('B no ve el historial de A', n = 0, n || ' filas');
end $$;

do $$ begin
  perform public.issue_quote((select val from t_ids where k = 'q2'));
  insert into t_results (name, ok, detail) values ('B no puede emitir presupuestos de A', false, 'emitió');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede emitir presupuestos de A', true, sqlerrm);
end $$;

do $$ begin
  perform public.set_quote_status((select val from t_ids where k = 'q2'), 'cancelado');
  insert into t_results (name, ok, detail) values ('B no puede cambiar estados de A', false, 'cambió');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede cambiar estados de A', true, sqlerrm);
end $$;

do $$ begin
  perform public.duplicate_quote((select val from t_ids where k = 'q2'));
  insert into t_results (name, ok, detail) values ('B no puede duplicar presupuestos de A', false, 'duplicó');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede duplicar presupuestos de A', true, sqlerrm);
end $$;

do $$ begin
  perform public.save_draft(null, jsonb_build_object('customer_id', (select val from t_ids where k = 'cust_a'), 'items', '[]'::jsonb));
  insert into t_results (name, ok, detail) values ('B no puede usar un cliente de A', false, 'se guardó');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede usar un cliente de A', true, sqlerrm);
end $$;

do $$ declare v uuid; begin
  v := public.save_draft(null, '{"title":"De B","items":[{"description":"Z","qty_milli":1000,"unit_price_minor":1}]}');
  begin
    insert into public.quote_items (quote_id, organization_id, position, description, qty_milli, unit_price_minor)
    values (v, (select val from t_ids where k = 'org_a'), 5, 'Con org ajena', 1000, 1);
    insert into t_results (name, ok, detail) values ('B no puede etiquetar líneas con el negocio de A', false, 'se insertó');
  exception when others then
    insert into t_results (name, ok, detail) values ('B no puede etiquetar líneas con el negocio de A', true, sqlerrm);
  end;
end $$;

do $$ begin
  insert into public.quote_items (quote_id, organization_id, position, description, qty_milli, unit_price_minor)
  values ((select val from t_ids where k = 'q2'), (select val from t_ids where k = 'org_b'), 5, 'Intrusa', 1000, 1);
  insert into t_results (name, ok, detail) values ('B no puede agregar líneas a presupuestos de A', false, 'se insertó');
exception when others then
  insert into t_results (name, ok, detail) values ('B no puede agregar líneas a presupuestos de A', true, sqlerrm);
end $$;

-- =================== Sin sesión ===================
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  perform public.save_draft(null, '{}');
  insert into t_results (name, ok, detail) values ('Anon no puede guardar borradores', false, 'guardó');
exception when others then
  insert into t_results (name, ok, detail) values ('Anon no puede guardar borradores', true, sqlerrm);
end $$;
do $$ begin
  perform count(*) from public.quotes;
  insert into t_results (name, ok, detail) values ('Anon no lee presupuestos', false, 'leyó');
exception when others then
  insert into t_results (name, ok, detail) values ('Anon no lee presupuestos', true, sqlerrm);
end $$;

reset role;
do $$ declare n int; begin
  select count(*) into n from pg_tables where schemaname = 'public' and not rowsecurity;
  insert into t_results (name, ok, detail) values ('Todas las tablas públicas tienen RLS', n = 0, n || ' sin RLS');
end $$;

do $$ declare fallas int; txt text; begin
  select count(*) filter (where not ok), string_agg(case when ok then 'OK  ' else 'NG  ' end || name || coalesce(' — ' || nullif(detail, ''), ''), E'\\n' order by n)
    into fallas, txt from t_results;
  raise exception E'FALLAS: %\\n%', fallas, txt;
end $$;
`;

fs.writeFileSync(out, sql);
console.log(`Escrito ${out.pathname} (${cases.length} casos de paridad)`);
