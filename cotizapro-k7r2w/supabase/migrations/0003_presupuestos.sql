-- CotizaPro · 0003_presupuestos
-- Presupuestos: borradores editables, emisión con número correlativo y snapshot inmutable,
-- estados con historial. El cálculo replica app/lib/calc.js (ver tests de paridad).

-- ---------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------

create table public.org_counters (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,
  last_quote_number integer not null default 0
);

create table public.quotes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id     uuid references public.customers (id),
  number          integer,
  title           text check (title is null or char_length(title) <= 160),
  status          text not null default 'borrador'
                  check (status in ('borrador', 'emitido', 'enviado', 'aceptado', 'rechazado', 'cancelado')),
  currency        text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  valid_until     date,
  notes           text check (notes is null or char_length(notes) <= 4000),
  discount_type   text not null default 'none' check (discount_type in ('none', 'percent', 'amount')),
  discount_value  bigint not null default 0 check (discount_value >= 0 and discount_value <= 99999999999999),
  -- Se completan al emitir:
  tax_enabled     boolean,
  tax_name        text,
  tax_rate_bp     integer,
  subtotal_minor  bigint,
  discount_minor  bigint,
  tax_minor       bigint,
  total_minor     bigint,
  issued_at       timestamptz,
  created_by      uuid not null default auth.uid() references auth.users (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, number),
  check (discount_type <> 'percent' or discount_value <= 10000),
  check ((status = 'borrador') = (number is null))
);
create index quotes_org_created_idx on public.quotes (organization_id, created_at desc);
create index quotes_customer_idx on public.quotes (customer_id);

create table public.quote_items (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references public.quotes (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  position         integer not null check (position >= 0),
  description      text not null check (char_length(btrim(description)) between 1 and 300),
  unit             text not null default 'unidad' check (char_length(btrim(unit)) between 1 and 20),
  qty_milli        bigint not null check (qty_milli between 1 and 1000000000),
  unit_price_minor bigint not null check (unit_price_minor between 0 and 99999999999999),
  discount_bp      integer not null default 0 check (discount_bp between 0 and 10000)
);
create index quote_items_quote_idx on public.quote_items (quote_id, position);

create table public.quote_versions (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references public.quotes (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version         integer not null,
  snapshot        jsonb not null,
  created_at      timestamptz not null default now(),
  unique (quote_id, version)
);

create table public.quote_events (
  id              bigint generated always as identity primary key,
  quote_id        uuid not null references public.quotes (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid default auth.uid(),
  from_status     text,
  to_status       text not null,
  created_at      timestamptz not null default now()
);
create index quote_events_quote_idx on public.quote_events (quote_id, created_at);

-- ---------------------------------------------------------------
-- Funciones de apoyo
-- ---------------------------------------------------------------

-- División entera redondeando la mitad hacia arriba (n >= 0). Igual a roundDiv() de calc.js.
create function public.round_div(n numeric, d numeric)
returns bigint
language sql
immutable
set search_path = ''
as $$ select floor((n * 2 + d) / (d * 2))::bigint $$;

-- ¿El presupuesto es un borrador del negocio del usuario? (para RLS de líneas, sin recursión)
create function public.quote_is_editable(qid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.quotes q
    where q.id = qid and q.status = 'borrador' and public.is_member(q.organization_id)
  );
$$;

-- Totales de un presupuesto con las reglas de calc.js. Para borradores usa la configuración
-- de impuesto actual del negocio; para emitidos devuelve lo guardado al emitir.
create function public.calc_quote(p_quote uuid)
returns table (subtotal_minor bigint, discount_minor bigint, tax_minor bigint, total_minor bigint)
language plpgsql
stable
set search_path = ''
as $$
declare
  q public.quotes;
  o public.organizations;
  v_sub bigint;
  v_disc bigint;
  v_tax bigint;
begin
  select * into q from public.quotes where id = p_quote;
  if not found then return; end if;
  if q.status <> 'borrador' then
    return query select q.subtotal_minor, q.discount_minor, q.tax_minor, q.total_minor;
    return;
  end if;
  select * into o from public.organizations where id = q.organization_id;

  select coalesce(sum(g - public.round_div(g * i.discount_bp, 10000)), 0)
    into v_sub
  from (
    select public.round_div(it.qty_milli::numeric * it.unit_price_minor, 1000) as g, it.discount_bp
    from public.quote_items it where it.quote_id = p_quote
  ) i;

  v_disc := case q.discount_type
    when 'percent' then public.round_div(v_sub::numeric * q.discount_value, 10000)
    when 'amount'  then least(q.discount_value, v_sub)
    else 0 end;
  v_tax := case when o.tax_enabled then public.round_div((v_sub - v_disc)::numeric * o.tax_rate_bp, 10000) else 0 end;
  return query select v_sub, v_disc, v_tax, v_sub - v_disc + v_tax;
end;
$$;

-- Columna calculada para PostgREST: select=...,quote_total
create function public.quote_total(q public.quotes)
returns bigint
language sql
stable
set search_path = ''
as $$ select total_minor from public.calc_quote(q.id) $$;

-- Al crear: moneda y validez por defecto del negocio; cliente del mismo negocio.
create function public.quotes_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  o public.organizations;
begin
  if tg_op = 'INSERT' then
    select * into o from public.organizations where id = new.organization_id;
    new.currency := coalesce(o.currency, 'ARS');
    if new.valid_until is null then
      new.valid_until := (now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(o.default_validity_days, 15);
    end if;
  else
    if new.organization_id is distinct from old.organization_id then
      raise exception 'No se puede cambiar la organización de un registro' using errcode = 'P0001';
    end if;
    new.updated_at := now();
  end if;
  if new.customer_id is not null and not exists (
    select 1 from public.customers c where c.id = new.customer_id and c.organization_id = new.organization_id
  ) then
    raise exception 'El cliente no pertenece a este negocio' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger quotes_before_write before insert or update on public.quotes
  for each row execute function public.quotes_before_write();

-- ---------------------------------------------------------------
-- Operaciones (RPC)
-- ---------------------------------------------------------------

-- Guarda un borrador completo (cabecera + líneas) en una transacción. Corre con los permisos
-- del usuario: RLS decide. p_id null = presupuesto nuevo. Devuelve el id.
create function public.save_draft(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select m.organization_id into v_org from public.organization_members m where m.user_id = auth.uid() limit 1;
  if v_org is null then
    raise exception 'No autenticado o sin negocio' using errcode = '28000';
  end if;

  if p_id is null then
    insert into public.quotes (organization_id, customer_id, title, valid_until, notes, discount_type, discount_value)
    values (
      v_org,
      nullif(p_data->>'customer_id', '')::uuid,
      nullif(btrim(p_data->>'title'), ''),
      nullif(p_data->>'valid_until', '')::date,
      nullif(btrim(p_data->>'notes'), ''),
      coalesce(p_data->>'discount_type', 'none'),
      coalesce((p_data->>'discount_value')::bigint, 0)
    )
    returning id into v_id;
  else
    update public.quotes set
      customer_id    = nullif(p_data->>'customer_id', '')::uuid,
      title          = nullif(btrim(p_data->>'title'), ''),
      valid_until    = coalesce(nullif(p_data->>'valid_until', '')::date, valid_until),
      notes          = nullif(btrim(p_data->>'notes'), ''),
      discount_type  = coalesce(p_data->>'discount_type', 'none'),
      discount_value = coalesce((p_data->>'discount_value')::bigint, 0)
    where id = p_id and status = 'borrador'
    returning id into v_id;
    if v_id is null then
      raise exception 'Este presupuesto ya fue emitido o no existe: no se puede editar' using errcode = 'P0001';
    end if;
    delete from public.quote_items where quote_id = v_id;
  end if;

  insert into public.quote_items (quote_id, organization_id, position, description, unit, qty_milli, unit_price_minor, discount_bp)
  select v_id, v_org, (e.ord - 1)::int,
         btrim(e.item->>'description'),
         coalesce(nullif(btrim(e.item->>'unit'), ''), 'unidad'),
         (e.item->>'qty_milli')::bigint,
         (e.item->>'unit_price_minor')::bigint,
         coalesce((e.item->>'discount_bp')::int, 0)
  from jsonb_array_elements(coalesce(p_data->'items', '[]'::jsonb)) with ordinality as e(item, ord);

  return v_id;
end;
$$;

-- Emite: valida, recalcula en el servidor, asigna número, guarda el snapshot inmutable.
create function public.issue_quote(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes;
  o public.organizations;
  c public.customers;
  t record;
  v_num integer;
  v_items jsonb;
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  select * into q from public.quotes where id = p_id for update;
  if not found or not public.is_member(q.organization_id) then
    raise exception 'No se encontró el presupuesto' using errcode = 'P0002';
  end if;
  if q.status <> 'borrador' then
    raise exception 'Este presupuesto ya fue emitido' using errcode = 'P0001';
  end if;
  if q.customer_id is null then
    raise exception 'Elegí un cliente antes de emitir' using errcode = 'P0001';
  end if;
  if coalesce(btrim(q.title), '') = '' then
    raise exception 'Poné un título antes de emitir' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.quote_items where quote_id = p_id) then
    raise exception 'Agregá al menos una línea antes de emitir' using errcode = 'P0001';
  end if;

  select * into o from public.organizations where id = q.organization_id;
  select * into c from public.customers where id = q.customer_id;
  select * into t from public.calc_quote(p_id);

  if q.discount_type = 'amount' and q.discount_value > t.subtotal_minor then
    raise exception 'El descuento es mayor que el subtotal' using errcode = 'P0001';
  end if;
  if t.total_minor > 99999999999999 then
    raise exception 'El total supera el máximo permitido' using errcode = 'P0001';
  end if;

  insert into public.org_counters as oc (organization_id, last_quote_number)
  values (q.organization_id, 1)
  on conflict (organization_id) do update set last_quote_number = oc.last_quote_number + 1
  returning last_quote_number into v_num;

  select coalesce(jsonb_agg(jsonb_build_object(
           'description', it.description, 'unit', it.unit, 'qty_milli', it.qty_milli,
           'unit_price_minor', it.unit_price_minor, 'discount_bp', it.discount_bp,
           'gross_minor', it.g, 'discount_minor', public.round_div(it.g * it.discount_bp, 10000),
           'net_minor', it.g - public.round_div(it.g * it.discount_bp, 10000)
         ) order by it.position), '[]'::jsonb)
    into v_items
  from (
    select x.*, public.round_div(x.qty_milli::numeric * x.unit_price_minor, 1000) as g
    from public.quote_items x where x.quote_id = p_id
  ) it;

  v_snapshot := jsonb_build_object(
    'schema', 1,
    'number', v_num,
    'title', q.title,
    'currency', q.currency,
    'issued_at', now(),
    'valid_until', q.valid_until,
    'notes', q.notes,
    'issuer', jsonb_build_object(
      'name', o.name, 'legal_name', o.legal_name, 'tax_id', o.tax_id, 'phone', o.phone,
      'email', o.email, 'address', o.address, 'brand_color', o.brand_color,
      'logo_data_url', o.logo_data_url, 'terms', o.terms),
    'customer', jsonb_build_object(
      'name', c.name, 'tax_id', c.tax_id, 'phone', c.phone, 'email', c.email, 'address', c.address),
    'items', v_items,
    'discount', jsonb_build_object('type', q.discount_type, 'value', q.discount_value),
    'tax', jsonb_build_object('enabled', o.tax_enabled, 'name', o.tax_name, 'rate_bp', o.tax_rate_bp),
    'totals', jsonb_build_object(
      'subtotal_minor', t.subtotal_minor, 'discount_minor', t.discount_minor,
      'tax_minor', t.tax_minor, 'total_minor', t.total_minor)
  );

  update public.quotes set
    status = 'emitido', number = v_num, issued_at = now(),
    tax_enabled = o.tax_enabled, tax_name = o.tax_name, tax_rate_bp = o.tax_rate_bp,
    subtotal_minor = t.subtotal_minor, discount_minor = t.discount_minor,
    tax_minor = t.tax_minor, total_minor = t.total_minor
  where id = p_id;

  insert into public.quote_versions (quote_id, organization_id, version, snapshot)
  values (p_id, q.organization_id, 1, v_snapshot);

  insert into public.quote_events (quote_id, organization_id, actor_id, from_status, to_status)
  values (p_id, q.organization_id, auth.uid(), 'borrador', 'emitido');

  return jsonb_build_object('id', p_id, 'number', v_num, 'total_minor', t.total_minor);
end;
$$;

-- Cambia el estado de un presupuesto emitido. "Enviado" lo marca el usuario a mano.
-- "Vencido" no se guarda: se deriva de valid_until.
create function public.set_quote_status(p_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quotes;
  allowed text[];
begin
  if auth.uid() is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  select * into q from public.quotes where id = p_id for update;
  if not found or not public.is_member(q.organization_id) then
    raise exception 'No se encontró el presupuesto' using errcode = 'P0002';
  end if;
  allowed := case q.status
    when 'emitido' then array['enviado', 'aceptado', 'rechazado', 'cancelado']
    when 'enviado' then array['aceptado', 'rechazado', 'cancelado']
    else array[]::text[] end;
  if not (p_status = any (allowed)) then
    raise exception 'No se puede pasar de % a %', q.status, p_status using errcode = 'P0001';
  end if;
  update public.quotes set status = p_status where id = p_id;
  insert into public.quote_events (quote_id, organization_id, actor_id, from_status, to_status)
  values (p_id, q.organization_id, auth.uid(), q.status, p_status);
  return p_status;
end;
$$;

-- Duplica cualquier presupuesto como borrador nuevo (sin número). Corre con permisos del usuario.
create function public.duplicate_quote(p_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  q public.quotes;
  v_id uuid;
begin
  select * into q from public.quotes where id = p_id;
  if not found then
    raise exception 'No se encontró el presupuesto' using errcode = 'P0002';
  end if;
  insert into public.quotes (organization_id, customer_id, title, notes, discount_type, discount_value)
  values (q.organization_id, q.customer_id, left(coalesce(q.title, 'Presupuesto') || ' (copia)', 160),
          q.notes, q.discount_type, q.discount_value)
  returning id into v_id;
  insert into public.quote_items (quote_id, organization_id, position, description, unit, qty_milli, unit_price_minor, discount_bp)
  select v_id, organization_id, position, description, unit, qty_milli, unit_price_minor, discount_bp
  from public.quote_items where quote_id = p_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------

alter table public.org_counters   enable row level security;
alter table public.quotes         enable row level security;
alter table public.quote_items    enable row level security;
alter table public.quote_versions enable row level security;
alter table public.quote_events   enable row level security;

revoke all on public.org_counters, public.quotes, public.quote_items, public.quote_versions, public.quote_events from anon, authenticated;

grant select on public.quotes, public.quote_items, public.quote_versions, public.quote_events to authenticated;
-- Cabecera: solo columnas de contenido; estado, número y totales los escribe issue_quote/set_quote_status.
grant insert (organization_id, customer_id, title, valid_until, notes, discount_type, discount_value) on public.quotes to authenticated;
grant update (customer_id, title, valid_until, notes, discount_type, discount_value) on public.quotes to authenticated;
grant delete on public.quotes to authenticated;
grant insert, update, delete on public.quote_items to authenticated;

create policy quotes_select on public.quotes
  for select to authenticated using (public.is_member(organization_id));
create policy quotes_insert on public.quotes
  for insert to authenticated with check (public.is_member(organization_id) and status = 'borrador');
create policy quotes_update_draft on public.quotes
  for update to authenticated
  using (public.is_member(organization_id) and status = 'borrador')
  with check (public.is_member(organization_id) and status = 'borrador');
create policy quotes_delete_draft on public.quotes
  for delete to authenticated using (public.is_member(organization_id) and status = 'borrador');

create policy items_select on public.quote_items
  for select to authenticated using (public.is_member(organization_id));
create policy items_insert on public.quote_items
  for insert to authenticated with check (
    public.quote_is_editable(quote_id)
    and organization_id = (select q.organization_id from public.quotes q where q.id = quote_id)
  );
create policy items_update on public.quote_items
  for update to authenticated
  using (public.quote_is_editable(quote_id))
  with check (
    public.quote_is_editable(quote_id)
    and organization_id = (select q.organization_id from public.quotes q where q.id = quote_id)
  );
create policy items_delete on public.quote_items
  for delete to authenticated using (public.quote_is_editable(quote_id));

create policy versions_select on public.quote_versions
  for select to authenticated using (public.is_member(organization_id));
create policy events_select on public.quote_events
  for select to authenticated using (public.is_member(organization_id));
-- org_counters: sin políticas = sin acceso directo (solo issue_quote, SECURITY DEFINER).

revoke execute on function public.round_div(numeric, numeric), public.quote_is_editable(uuid),
  public.calc_quote(uuid), public.quote_total(public.quotes), public.save_draft(uuid, jsonb),
  public.issue_quote(uuid), public.set_quote_status(uuid, text), public.duplicate_quote(uuid),
  public.quotes_before_write() from public, anon;
grant execute on function public.round_div(numeric, numeric), public.quote_is_editable(uuid),
  public.calc_quote(uuid), public.quote_total(public.quotes), public.save_draft(uuid, jsonb),
  public.issue_quote(uuid), public.set_quote_status(uuid, text), public.duplicate_quote(uuid)
  to authenticated;
revoke execute on function public.quotes_before_write() from authenticated;
