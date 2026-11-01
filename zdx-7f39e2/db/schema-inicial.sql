-- Zenix Delivery · Etapa 1: esquema inicial (diseño, NO aplicado)
-- Ejecutar solo sobre un proyecto nuevo de Supabase después de revisión.
create extension if not exists pgcrypto;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text,
 phone text,
 created_at timestamptz not null default now()
);
create table public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table public.businesses (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
 name text not null,
 status text not null default 'pending' check (status in ('pending','active','suspended','closed')),
 created_at timestamptz not null default now()
);
create table public.business_members (
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','manager','staff','driver')),
 enabled boolean not null default true,
 primary key (business_id,user_id)
);
create index business_members_user_idx on public.business_members(user_id);

create table public.products (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 title text not null,
 description text,
 price_cents bigint not null check (price_cents >= 0),
 currency char(3) not null default 'ARS',
 available boolean not null default true,
 created_at timestamptz not null default now(),
 unique (business_id,id)
);
create table public.customer_accounts (
 business_id uuid not null references public.businesses(id),
 user_id uuid not null references auth.users(id),
 points_balance bigint not null default 0 check (points_balance >= 0),
 primary key (business_id,user_id)
);
create table public.customer_addresses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 label text,
 address_text text not null,
 latitude numeric(9,6) check (latitude between -90 and 90),
 longitude numeric(9,6) check (longitude between -180 and 180),
 created_at timestamptz not null default now(),
 unique(user_id,id)
);
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id),
 customer_id uuid not null references auth.users(id),
 address_id uuid,
 order_type text not null check (order_type in ('delivery','pickup')),
 status text not null default 'placed' check (status in
  ('placed','accepted','preparing','ready','assigned','picked_up','delivered','cancelled','failed')),
 address_snapshot text,
 latitude numeric(9,6),
 longitude numeric(9,6),
 amount_cents bigint not null check (amount_cents >= 0),
 currency char(3) not null default 'ARS',
 created_at timestamptz not null default now(),
 unique (business_id,id),
 foreign key(customer_id,address_id) references public.customer_addresses(user_id,id),
 check (order_type <> 'delivery' or address_snapshot is not null)
);
create index orders_business_status_idx on public.orders(business_id,status,created_at desc);
create index orders_customer_idx on public.orders(customer_id,created_at desc);
create table public.order_items (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 order_id uuid not null,
 product_id uuid,
 title_snapshot text not null,
 unit_price_cents bigint not null check(unit_price_cents >= 0),
 quantity integer not null check(quantity > 0),
 foreign key(business_id,order_id) references public.orders(business_id,id),
 foreign key(business_id,product_id) references public.products(business_id,id)
);
create table public.deliveries (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 order_id uuid not null unique,
 driver_id uuid references auth.users(id),
 status text not null default 'unassigned' check
 (status in ('unassigned','assigned','picked_up','delivered','failed')),
 assigned_at timestamptz,
 picked_up_at timestamptz,
 delivered_at timestamptz,
 unique(business_id,id),
 foreign key(business_id,order_id) references public.orders(business_id,id)
);
create index deliveries_driver_idx on public.deliveries(driver_id,status);
create table public.driver_locations (
 business_id uuid not null,
 delivery_id uuid primary key,
 driver_id uuid not null references auth.users(id),
 latitude numeric(9,6) not null check(latitude between -90 and 90),
 longitude numeric(9,6) not null check(longitude between -180 and 180),
 updated_at timestamptz not null default now(),
 foreign key(business_id,delivery_id) references public.deliveries(business_id,id)
);
create table public.delivery_confirmations (
 id uuid primary key default gen_random_uuid(),
 delivery_id uuid not null references public.deliveries(id),
 confirmed_by uuid not null references auth.users(id),
 actor_type text not null check (actor_type in ('customer','driver','staff')),
 confirmed_at timestamptz not null default now(),
 unique(delivery_id,actor_type)
);
create table public.points_ledger (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 user_id uuid not null,
 order_id uuid,
 delta bigint not null check(delta <> 0),
 reason text not null,
 created_at timestamptz not null default now(),
 foreign key (business_id,user_id) references public.customer_accounts(business_id,user_id),
 foreign key (business_id,order_id) references public.orders(business_id,id)
);
create table public.subscriptions (
 business_id uuid primary key references public.businesses(id),
 plan text not null check(plan in ('comercio','delivery','business')),
 status text not null check(status in ('trial','active','past_due','cancelled')),
 period_ends_at timestamptz,
 provider_reference text unique
);

-- Política de exposición mínima:
-- Lectura directa solo de datos propios; operaciones de negocio mediante backend autenticado.
do $$
declare t text;
begin
 foreach t in array array[
 'profiles','platform_admins','businesses','business_members','products',
 'customer_accounts','customer_addresses','orders','order_items','deliveries',
 'driver_locations','delivery_confirmations','points_ledger','subscriptions'
 ] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 end loop;
end $$;

grant select on public.profiles, public.business_members,
 public.customer_accounts, public.customer_addresses,
 public.orders, public.deliveries to authenticated;

create policy profiles_own_read on public.profiles
 for select to authenticated using (id=(select auth.uid()));
create policy members_self_read on public.business_members
 for select to authenticated using (user_id=(select auth.uid()) and enabled);
create policy customer_account_self_read on public.customer_accounts
 for select to authenticated using (user_id=(select auth.uid()));
create policy addresses_self_read on public.customer_addresses
 for select to authenticated using (user_id=(select auth.uid()));
create policy orders_customer_read on public.orders
 for select to authenticated using (customer_id=(select auth.uid()));
create policy orders_business_staff_read on public.orders
 for select to authenticated using (exists (
 select 1 from public.business_members m
 where m.business_id=orders.business_id
 and m.user_id=(select auth.uid()) and m.enabled
 and m.role in ('owner','manager','staff')
 ));
create policy delivery_driver_read on public.deliveries
 for select to authenticated using (driver_id=(select auth.uid()));
create policy delivery_staff_read on public.deliveries
 for select to authenticated using (exists (
 select 1 from public.business_members m
 where m.business_id=deliveries.business_id
 and m.user_id=(select auth.uid()) and m.enabled
 and m.role in ('owner','manager','staff')
 ));

-- Importante: NO hay políticas de INSERT/UPDATE/DELETE directos.
-- El backend debe validar cada transición, aislamiento, precios,
-- pagos, confirmaciones, ubicación, puntos y suscripciones.
-- Nunca poner service_role en cliente, navegador ni app de repartidor.
