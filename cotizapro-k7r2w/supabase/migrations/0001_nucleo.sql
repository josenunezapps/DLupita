-- CotizaPro · 0001_nucleo
-- Núcleo multi-organización: negocios, miembros, clientes, conceptos y auditoría.
-- Toda regla de acceso vive en RLS. El navegador nunca decide a qué negocio pertenece.

-- ---------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------

create table public.organizations (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(btrim(name)) between 1 and 120),
  legal_name            text check (legal_name is null or char_length(legal_name) <= 160),
  tax_id                text check (tax_id is null or char_length(tax_id) <= 20),
  phone                 text check (phone is null or char_length(phone) <= 40),
  email                 text check (email is null or char_length(email) <= 160),
  address               text check (address is null or char_length(address) <= 240),
  brand_color           text not null default '#5B3DF5' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Logo como data URL (png/jpeg/webp) de hasta ~300 KB. Ver ADR-002.
  logo_data_url         text check (
                          logo_data_url is null
                          or (char_length(logo_data_url) <= 300000
                              and logo_data_url ~ '^data:image/(png|jpeg|webp);base64,')
                        ),
  currency              text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  default_validity_days integer not null default 15 check (default_validity_days between 1 and 365),
  terms                 text check (terms is null or char_length(terms) <= 4000),
  tax_enabled           boolean not null default false,
  tax_name              text not null default 'IVA' check (char_length(btrim(tax_name)) between 1 and 30),
  tax_rate_bp           integer not null default 2100 check (tax_rate_bp between 0 and 10000), -- puntos básicos: 2100 = 21 %
  created_by            uuid not null default auth.uid() references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null default 'owner' check (role in ('owner')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

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

create table public.catalog_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  description     text not null check (char_length(btrim(description)) between 1 and 300),
  kind            text not null default 'otro' check (kind in ('material', 'mano_de_obra', 'servicio', 'otro')),
  unit            text not null default 'unidad' check (char_length(btrim(unit)) between 1 and 20),
  price_minor     bigint not null check (price_minor >= 0 and price_minor <= 99999999999999), -- centavos
  cost_minor      bigint check (cost_minor is null or (cost_minor >= 0 and cost_minor <= 99999999999999)),
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index catalog_items_org_desc_idx on public.catalog_items (organization_id, lower(description));

create table public.audit_events (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id        uuid default auth.uid(),
  action          text not null check (action in ('insert', 'update')),
  entity          text not null,
  entity_id       uuid not null,
  created_at      timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events (organization_id, created_at desc);

-- ---------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------

-- ¿El usuario de la sesión pertenece a la organización? SECURITY DEFINER para no recursar en RLS.
create function public.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org
      and m.user_id = (select auth.uid())
  );
$$;

-- Alta del negocio y del dueño en una sola transacción. V1: un negocio por usuario.
create function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from public.organization_members where user_id = v_uid) then
    raise exception 'El usuario ya tiene un negocio' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, v_uid, 'owner');

  return v_org;
end;
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Una fila nunca cambia de organización.
create function public.forbid_org_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'No se puede cambiar la organización de un registro' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function public.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if tg_table_name = 'organizations' then
    v_org := new.id;
  else
    v_org := new.organization_id;
  end if;
  insert into public.audit_events (organization_id, actor_id, action, entity, entity_id)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, new.id);
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------

create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger catalog_items_touch before update on public.catalog_items
  for each row execute function public.touch_updated_at();

create trigger customers_org_fixed before update on public.customers
  for each row execute function public.forbid_org_change();
create trigger catalog_items_org_fixed before update on public.catalog_items
  for each row execute function public.forbid_org_change();

create trigger organizations_audit after insert or update on public.organizations
  for each row execute function public.write_audit();
create trigger customers_audit after insert or update on public.customers
  for each row execute function public.write_audit();
create trigger catalog_items_audit after insert or update on public.catalog_items
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------
-- Permisos y RLS
-- ---------------------------------------------------------------

alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers            enable row level security;
alter table public.catalog_items        enable row level security;
alter table public.audit_events         enable row level security;

-- Sin sesión no hay nada que ver ni ejecutar.
revoke all on public.organizations, public.organization_members, public.customers,
              public.catalog_items, public.audit_events from anon;
revoke execute on function public.is_member(uuid), public.create_organization(text) from public, anon;
grant  execute on function public.is_member(uuid), public.create_organization(text) to authenticated;
revoke execute on function public.write_audit(), public.touch_updated_at(), public.forbid_org_change() from public, anon, authenticated;

-- Escrituras directas solo donde corresponde.
revoke insert, delete on public.organizations from authenticated;
revoke insert, update, delete on public.organization_members from authenticated;
revoke delete on public.customers, public.catalog_items from authenticated;
revoke insert, update, delete on public.audit_events from authenticated;
revoke truncate, references, trigger on public.organizations, public.organization_members, public.customers,
                                        public.catalog_items, public.audit_events from authenticated;

-- UPDATE solo sobre columnas editables (id, dueño, organización y fechas quedan fijos).
revoke update on public.organizations, public.customers, public.catalog_items from authenticated;
grant update (name, legal_name, tax_id, phone, email, address, brand_color, logo_data_url, currency,
              default_validity_days, terms, tax_enabled, tax_name, tax_rate_bp)
  on public.organizations to authenticated;
grant update (name, tax_id, phone, email, address, notes, archived)
  on public.customers to authenticated;
grant update (description, kind, unit, price_minor, cost_minor, archived)
  on public.catalog_items to authenticated;

create policy organizations_select on public.organizations
  for select to authenticated using (public.is_member(id));
create policy organizations_update on public.organizations
  for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

create policy members_select_own on public.organization_members
  for select to authenticated using (user_id = (select auth.uid()));

create policy customers_select on public.customers
  for select to authenticated using (public.is_member(organization_id));
create policy customers_insert on public.customers
  for insert to authenticated with check (public.is_member(organization_id));
create policy customers_update on public.customers
  for update to authenticated using (public.is_member(organization_id)) with check (public.is_member(organization_id));

create policy catalog_select on public.catalog_items
  for select to authenticated using (public.is_member(organization_id));
create policy catalog_insert on public.catalog_items
  for insert to authenticated with check (public.is_member(organization_id));
create policy catalog_update on public.catalog_items
  for update to authenticated using (public.is_member(organization_id)) with check (public.is_member(organization_id));

create policy audit_select on public.audit_events
  for select to authenticated using (public.is_member(organization_id));
