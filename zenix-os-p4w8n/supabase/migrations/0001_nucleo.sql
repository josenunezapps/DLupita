-- Zenix OS · 0001_nucleo (hito ZOS-H1)
-- Negocio, equipo con roles, invitaciones por código, categorías, productos, stock por movimientos,
-- clientes y auditoría. Toda regla de acceso vive en RLS y en funciones con verificación de rol.

-- ---------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------

create table public.organizations (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(btrim(name)) between 1 and 120),
  phone                text check (phone is null or char_length(phone) <= 40),
  address              text check (address is null or char_length(address) <= 240),
  currency             text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  timezone             text not null default 'America/Argentina/Buenos_Aires' check (char_length(timezone) <= 64),
  allow_negative_stock boolean not null default false,
  created_by           uuid not null default auth.uid() references auth.users (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('owner', 'supervisor', 'vendedor')),
  email           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code            text not null unique,
  role            text not null check (role in ('supervisor', 'vendedor')),
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  used_by         uuid references auth.users (id),
  used_at         timestamptz,
  revoked         boolean not null default false
);
create index invitations_org_idx on public.invitations (organization_id, created_at desc);

create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 60),
  archived        boolean not null default false,
  created_at      timestamptz not null default now()
);
create unique index categories_org_name_idx on public.categories (organization_id, lower(name));

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category_id     uuid references public.categories (id),
  name            text not null check (char_length(btrim(name)) between 1 and 160),
  sku             text check (sku is null or char_length(sku) between 1 and 40),
  unit            text not null default 'unidad' check (char_length(btrim(unit)) between 1 and 20),
  price_minor     bigint not null check (price_minor between 0 and 99999999999999),
  cost_minor      bigint check (cost_minor is null or cost_minor between 0 and 99999999999999),
  track_stock     boolean not null default true,
  min_stock_milli bigint check (min_stock_milli is null or min_stock_milli between 0 and 1000000000),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index products_org_sku_idx on public.products (organization_id, lower(sku)) where sku is not null;
create index products_org_name_idx on public.products (organization_id, lower(name));

-- Movimientos de stock: el stock de un producto es la suma de sus movimientos. Nunca se editan ni borran.
create table public.stock_movements (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  qty_milli       bigint not null check (qty_milli <> 0 and qty_milli between -1000000000 and 1000000000),
  kind            text not null check (kind in ('inicial', 'entrada', 'salida', 'ajuste', 'venta', 'anulacion')),
  reason          text check (reason is null or char_length(reason) <= 200),
  actor_id        uuid default auth.uid(),
  created_at      timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_org_idx on public.stock_movements (organization_id, created_at desc);

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 160),
  tax_id          text check (tax_id is null or char_length(tax_id) <= 20),
  phone           text check (phone is null or char_length(phone) <= 40),
  email           text check (email is null or char_length(email) <= 160),
  address         text check (address is null or char_length(address) <= 240),
  notes           text check (notes is null or char_length(notes) <= 2000),
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index customers_org_name_idx on public.customers (organization_id, lower(name));

create table public.audit_events (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid default auth.uid(),
  action          text not null,
  entity          text not null,
  entity_id       text not null,
  detail          jsonb,
  created_at      timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events (organization_id, created_at desc);

-- ---------------------------------------------------------------
-- Funciones de acceso
-- ---------------------------------------------------------------

-- Miembro ACTIVO del negocio.
create function public.is_member(org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.active
  );
$$;

-- Miembro activo con alguno de los roles indicados.
create function public.has_role(org uuid, roles text[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.active and m.role = any (roles)
  );
$$;

-- Negocio del usuario de la sesión (V1: uno por usuario).
create function public.my_org()
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.organization_id from public.organization_members m
  where m.user_id = (select auth.uid()) and m.active
  limit 1;
$$;

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create function public.forbid_org_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'No se puede cambiar la organización de un registro' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Producto y categoría del mismo negocio.
create function public.check_product_category()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories c where c.id = new.category_id and c.organization_id = new.organization_id
  ) then
    raise exception 'La categoría no pertenece a este negocio' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.write_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  v_org := case when tg_table_name = 'organizations' then new.id else new.organization_id end;
  insert into public.audit_events (organization_id, actor_id, action, entity, entity_id)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, new.id::text);
  return new;
end;
$$;

create trigger organizations_touch before update on public.organizations for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
create trigger products_org_fixed before update on public.products for each row execute function public.forbid_org_change();
create trigger customers_org_fixed before update on public.customers for each row execute function public.forbid_org_change();
create trigger categories_org_fixed before update on public.categories for each row execute function public.forbid_org_change();
create trigger products_category_check before insert or update on public.products for each row execute function public.check_product_category();
create trigger organizations_audit after insert or update on public.organizations for each row execute function public.write_audit();
create trigger products_audit after insert or update on public.products for each row execute function public.write_audit();
create trigger customers_audit after insert or update on public.customers for each row execute function public.write_audit();

-- Stock actual (columna calculada para PostgREST: select=...,stock_milli)
create function public.stock_milli(p public.products)
returns bigint language sql stable set search_path = ''
as $$ select coalesce(sum(qty_milli), 0)::bigint from public.stock_movements where product_id = p.id $$;

-- ---------------------------------------------------------------
-- Operaciones (RPC)
-- ---------------------------------------------------------------

-- Alta del negocio + dueño. Un negocio por usuario en V1.
create function public.create_organization(p_name text, p_currency text default 'ARS', p_timezone text default 'America/Argentina/Buenos_Aires')
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_org uuid;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if exists (select 1 from public.organization_members where user_id = v_uid) then
    raise exception 'Tu cuenta ya pertenece a un negocio' using errcode = 'P0001';
  end if;
  insert into public.organizations (name, currency, timezone, created_by)
  values (btrim(p_name), coalesce(nullif(p_currency, ''), 'ARS'), coalesce(nullif(p_timezone, ''), 'America/Argentina/Buenos_Aires'), v_uid)
  returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role, email)
  values (v_org, v_uid, 'owner', auth.jwt() ->> 'email');
  return v_org;
end;
$$;

-- El dueño genera un código de invitación (8 caracteres, sin letras confusas).
create function public.create_invitation(p_role text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := public.my_org(); v_code text; v_inv public.invitations;
begin
  if v_org is null or not public.has_role(v_org, array['owner']) then
    raise exception 'Solo el dueño puede invitar' using errcode = 'P0001';
  end if;
  if p_role not in ('supervisor', 'vendedor') then
    raise exception 'Rol inválido' using errcode = 'P0001';
  end if;
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.invitations where code = v_code);
  end loop;
  insert into public.invitations (organization_id, code, role, created_by)
  values (v_org, v_code, p_role, auth.uid()) returning * into v_inv;
  insert into public.audit_events (organization_id, action, entity, entity_id, detail)
  values (v_org, 'invite', 'invitations', v_inv.id::text, jsonb_build_object('role', p_role));
  return jsonb_build_object('id', v_inv.id, 'code', v_inv.code, 'role', v_inv.role, 'expires_at', v_inv.expires_at);
end;
$$;

-- Un usuario sin negocio se une con un código válido.
create function public.accept_invitation(p_code text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_inv public.invitations;
begin
  if v_uid is null then raise exception 'No autenticado' using errcode = '28000'; end if;
  if exists (select 1 from public.organization_members where user_id = v_uid) then
    raise exception 'Tu cuenta ya pertenece a un negocio' using errcode = 'P0001';
  end if;
  select * into v_inv from public.invitations where code = upper(btrim(p_code)) for update;
  if not found or v_inv.revoked or v_inv.used_by is not null or v_inv.expires_at < now() then
    raise exception 'El código no es válido o ya venció. Pedile uno nuevo al dueño.' using errcode = 'P0001';
  end if;
  update public.invitations set used_by = v_uid, used_at = now() where id = v_inv.id;
  insert into public.organization_members (organization_id, user_id, role, email)
  values (v_inv.organization_id, v_uid, v_inv.role, auth.jwt() ->> 'email');
  insert into public.audit_events (organization_id, action, entity, entity_id, detail)
  values (v_inv.organization_id, 'join', 'organization_members', v_uid::text, jsonb_build_object('role', v_inv.role));
  return v_inv.organization_id;
end;
$$;

create function public.revoke_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := public.my_org();
begin
  if v_org is null or not public.has_role(v_org, array['owner']) then
    raise exception 'Solo el dueño puede revocar invitaciones' using errcode = 'P0001';
  end if;
  update public.invitations set revoked = true where id = p_id and organization_id = v_org and used_by is null;
  if not found then raise exception 'No se encontró la invitación pendiente' using errcode = 'P0002'; end if;
end;
$$;

-- El dueño cambia el rol o desactiva a un miembro. No puede tocarse a sí mismo (evita quedarse sin dueño).
create function public.update_member(p_user uuid, p_role text, p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := public.my_org();
begin
  if v_org is null or not public.has_role(v_org, array['owner']) then
    raise exception 'Solo el dueño puede cambiar el equipo' using errcode = 'P0001';
  end if;
  if p_user = auth.uid() then
    raise exception 'No podés cambiar tu propio rol ni desactivarte' using errcode = 'P0001';
  end if;
  if p_role not in ('owner', 'supervisor', 'vendedor') then
    raise exception 'Rol inválido' using errcode = 'P0001';
  end if;
  update public.organization_members set role = p_role, active = p_active
  where organization_id = v_org and user_id = p_user;
  if not found then raise exception 'No se encontró el miembro' using errcode = 'P0002'; end if;
  insert into public.audit_events (organization_id, action, entity, entity_id, detail)
  values (v_org, 'member_update', 'organization_members', p_user::text, jsonb_build_object('role', p_role, 'active', p_active));
end;
$$;

-- Movimiento manual de stock (dueño o supervisor). Respeta la política de stock negativo del negocio.
-- Se bloquea la fila del producto para que dos movimientos simultáneos no rompan el control.
create function public.adjust_stock(p_product uuid, p_qty_milli bigint, p_kind text, p_reason text)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare
  pr public.products;
  o public.organizations;
  v_stock bigint;
  v_delta bigint;
begin
  select * into pr from public.products where id = p_product for update;
  if not found or not public.has_role(pr.organization_id, array['owner', 'supervisor']) then
    raise exception 'No tenés permiso para mover stock de este producto' using errcode = 'P0001';
  end if;
  if not pr.track_stock then
    raise exception 'Este producto no controla stock' using errcode = 'P0001';
  end if;
  if p_kind not in ('inicial', 'entrada', 'salida', 'ajuste') then
    raise exception 'Tipo de movimiento inválido' using errcode = 'P0001';
  end if;
  if p_kind in ('salida', 'ajuste') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Indicá el motivo del movimiento' using errcode = 'P0001';
  end if;
  if p_kind = 'inicial' and exists (select 1 from public.stock_movements where product_id = p_product) then
    raise exception 'El stock inicial ya fue cargado: usá entrada o ajuste' using errcode = 'P0001';
  end if;
  select coalesce(sum(qty_milli), 0) into v_stock from public.stock_movements where product_id = p_product;

  -- entrada/inicial suman; salida resta; ajuste fija el stock contado (p_qty_milli = cantidad real)
  v_delta := case p_kind
    when 'salida' then -abs(p_qty_milli)
    when 'ajuste' then p_qty_milli - v_stock
    else abs(p_qty_milli) end;
  if v_delta = 0 then
    raise exception 'El movimiento no cambia el stock' using errcode = 'P0001';
  end if;
  if p_kind = 'ajuste' and p_qty_milli < 0 then
    raise exception 'El stock contado no puede ser negativo' using errcode = 'P0001';
  end if;

  select * into o from public.organizations where id = pr.organization_id;
  if not o.allow_negative_stock and v_stock + v_delta < 0 then
    raise exception 'No hay stock suficiente: quedarían % unidades', ((v_stock + v_delta)::numeric / 1000) using errcode = 'P0001';
  end if;

  insert into public.stock_movements (organization_id, product_id, qty_milli, kind, reason)
  values (pr.organization_id, p_product, v_delta, p_kind, nullif(btrim(p_reason), ''));
  return v_stock + v_delta;
end;
$$;

-- Alta de producto con stock inicial opcional, en una transacción.
create function public.create_product(p_data jsonb, p_initial_milli bigint default 0)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := public.my_org(); v_id uuid;
begin
  if v_org is null or not public.has_role(v_org, array['owner', 'supervisor']) then
    raise exception 'No tenés permiso para cargar productos' using errcode = 'P0001';
  end if;
  insert into public.products (organization_id, category_id, name, sku, unit, price_minor, cost_minor, track_stock, min_stock_milli)
  values (
    v_org,
    nullif(p_data->>'category_id', '')::uuid,
    btrim(p_data->>'name'),
    nullif(btrim(p_data->>'sku'), ''),
    coalesce(nullif(btrim(p_data->>'unit'), ''), 'unidad'),
    (p_data->>'price_minor')::bigint,
    nullif(p_data->>'cost_minor', '')::bigint,
    coalesce((p_data->>'track_stock')::boolean, true),
    nullif(p_data->>'min_stock_milli', '')::bigint
  ) returning id into v_id;
  if coalesce(p_initial_milli, 0) < 0 then
    raise exception 'El stock inicial no puede ser negativo' using errcode = 'P0001';
  end if;
  if coalesce(p_initial_milli, 0) > 0 and coalesce((p_data->>'track_stock')::boolean, true) then
    insert into public.stock_movements (organization_id, product_id, qty_milli, kind, reason)
    values (v_org, v_id, p_initial_milli, 'inicial', 'Stock inicial');
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------

alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.invitations          enable row level security;
alter table public.categories           enable row level security;
alter table public.products             enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.customers            enable row level security;
alter table public.audit_events         enable row level security;

revoke all on public.organizations, public.organization_members, public.invitations, public.categories,
  public.products, public.stock_movements, public.customers, public.audit_events from anon, authenticated;

grant select on public.organizations, public.organization_members, public.invitations, public.categories,
  public.products, public.stock_movements, public.customers, public.audit_events to authenticated;
grant update (name, phone, address, currency, timezone, allow_negative_stock) on public.organizations to authenticated;
grant insert (organization_id, name) on public.categories to authenticated;
grant update (name, archived) on public.categories to authenticated;
grant update (category_id, name, sku, unit, price_minor, cost_minor, track_stock, min_stock_milli, active) on public.products to authenticated;
grant insert (organization_id, name, tax_id, phone, email, address, notes) on public.customers to authenticated;
grant update (name, tax_id, phone, email, address, notes, archived) on public.customers to authenticated;

create policy org_select on public.organizations for select to authenticated using (public.is_member(id));
create policy org_update on public.organizations for update to authenticated
  using (public.has_role(id, array['owner'])) with check (public.has_role(id, array['owner']));

create policy members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_member(organization_id));

create policy invitations_select on public.invitations for select to authenticated
  using (public.has_role(organization_id, array['owner']));

create policy categories_select on public.categories for select to authenticated using (public.is_member(organization_id));
create policy categories_insert on public.categories for insert to authenticated
  with check (public.has_role(organization_id, array['owner', 'supervisor']));
create policy categories_update on public.categories for update to authenticated
  using (public.has_role(organization_id, array['owner', 'supervisor']))
  with check (public.has_role(organization_id, array['owner', 'supervisor']));

create policy products_select on public.products for select to authenticated using (public.is_member(organization_id));
create policy products_update on public.products for update to authenticated
  using (public.has_role(organization_id, array['owner', 'supervisor']))
  with check (public.has_role(organization_id, array['owner', 'supervisor']));

create policy movements_select on public.stock_movements for select to authenticated using (public.is_member(organization_id));

create policy customers_select on public.customers for select to authenticated using (public.is_member(organization_id));
create policy customers_insert on public.customers for insert to authenticated with check (public.is_member(organization_id));
create policy customers_update on public.customers for update to authenticated
  using (public.is_member(organization_id)) with check (public.is_member(organization_id));

create policy audit_select on public.audit_events for select to authenticated
  using (public.has_role(organization_id, array['owner', 'supervisor']));

revoke execute on function public.is_member(uuid), public.has_role(uuid, text[]), public.my_org(),
  public.stock_milli(public.products), public.create_organization(text, text, text), public.create_invitation(text),
  public.accept_invitation(text), public.revoke_invitation(uuid), public.update_member(uuid, text, boolean),
  public.adjust_stock(uuid, bigint, text, text), public.create_product(jsonb, bigint) from public, anon;
grant execute on function public.is_member(uuid), public.has_role(uuid, text[]), public.my_org(),
  public.stock_milli(public.products), public.create_organization(text, text, text), public.create_invitation(text),
  public.accept_invitation(text), public.revoke_invitation(uuid), public.update_member(uuid, text, boolean),
  public.adjust_stock(uuid, bigint, text, text), public.create_product(jsonb, bigint) to authenticated;
revoke execute on function public.touch_updated_at(), public.forbid_org_change(), public.check_product_category(),
  public.write_audit() from public, anon, authenticated;
