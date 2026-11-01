-- Zenix Web + Core v0.3 — esquema aislado con prefijo zd_
-- Aplicar SOLO en un proyecto nuevo y dedicado a Zenix Delivery.
-- Tablas multiempresa. No crea administradores ni asigna permisos automáticamente.

create extension if not exists pgcrypto;

create table if not exists public.zd_businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
 name text not null check(length(trim(name)) between 1 and 90),
 headline text not null default '',
 description text not null default '',
 about text not null default '',
 eyebrow text not null default '',
 address text not null default '',
 phone text not null default '',
 hero_image text not null default '',
 accent text not null default '#a92738' check(accent ~ '^#[0-9a-fA-F]{6}$'),
 active boolean not null default false,
 published boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists zd_businesses_owner_idx on public.zd_businesses(owner_id);

create table if not exists public.zd_products (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.zd_businesses(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 category text not null default 'General' check(length(trim(category)) between 1 and 60),
 description text not null default '',
 price_ars bigint not null check(price_ars between 0 and 1000000000),
 image_url text not null default '',
 visible boolean not null default true,
 created_at timestamptz not null default now(),
 unique (business_id,id)
);
create index if not exists zd_products_business_idx on public.zd_products(business_id,created_at);

-- Ya contemplados, pero no habilitados para compras públicas hasta desarrollar
-- un endpoint que calcule importes del lado del servidor y limite el abuso.
create table if not exists public.zd_orders (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.zd_businesses(id),
 order_code text not null,
 customer_name text not null,
 customer_phone text not null,
 address_text text,
 status text not null default 'new' check(status in ('new','accepted','preparing','ready','in_transit','delivered','cancelled')),
 total_ars bigint not null check(total_ars >= 0),
 created_at timestamptz not null default now(),
 unique(business_id,order_code),
 unique(business_id,id)
);
create table if not exists public.zd_order_items (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null,
 order_id uuid not null,
 product_title_snapshot text not null,
 unit_price_ars bigint not null check(unit_price_ars>=0),
 quantity integer not null check(quantity between 1 and 500),
 foreign key(business_id,order_id) references public.zd_orders(business_id,id)
);

alter table public.zd_businesses enable row level security;
alter table public.zd_products enable row level security;
alter table public.zd_orders enable row level security;
alter table public.zd_order_items enable row level security;

revoke all on public.zd_businesses from anon,authenticated;
revoke all on public.zd_products from anon,authenticated;
revoke all on public.zd_orders from anon,authenticated;
revoke all on public.zd_order_items from anon,authenticated;

-- El visitante ve solo comercios activos y publicados.
grant select (id,slug,name,headline,description,about,eyebrow,address,phone,hero_image,accent,active,published)
 on public.zd_businesses to anon;
grant select on public.zd_businesses to authenticated;
grant update (name,headline,description,about,eyebrow,address,phone,hero_image,accent,published)
 on public.zd_businesses to authenticated;

create policy zd_businesses_public_read on public.zd_businesses
 for select to anon,authenticated using (active = true and published = true);
create policy zd_businesses_owner_read on public.zd_businesses
 for select to authenticated using (owner_id = (select auth.uid()));
create policy zd_businesses_owner_update on public.zd_businesses
 for update to authenticated using (owner_id = (select auth.uid()))
 with check (owner_id = (select auth.uid()));

-- Catálogo público visible solo para tiendas publicadas. Dueño puede leer todo.
grant select on public.zd_products to anon,authenticated;
grant insert (business_id,name,category,description,price_ars,image_url,visible)
 on public.zd_products to authenticated;
grant update (name,category,description,price_ars,image_url,visible)
 on public.zd_products to authenticated;

create policy zd_products_public_read on public.zd_products
 for select to anon,authenticated using (
 visible = true and exists (
  select 1 from public.zd_businesses b
  where b.id = zd_products.business_id and b.active = true and b.published = true
 )
 );
create policy zd_products_owner_read on public.zd_products
 for select to authenticated using (
 exists (select 1 from public.zd_businesses b
 where b.id = zd_products.business_id and b.owner_id = (select auth.uid()))
 );
create policy zd_products_owner_insert on public.zd_products
 for insert to authenticated with check (
 exists (select 1 from public.zd_businesses b
 where b.id = zd_products.business_id and b.owner_id = (select auth.uid()))
 );
create policy zd_products_owner_update on public.zd_products
 for update to authenticated using (
 exists (select 1 from public.zd_businesses b
 where b.id = zd_products.business_id and b.owner_id = (select auth.uid()))
 ) with check (
 exists (select 1 from public.zd_businesses b
 where b.id = zd_products.business_id and b.owner_id = (select auth.uid()))
 );

-- Pedidos: aun no reciben INSERT de anon/authenticated; no exponer API de cobros.
grant select on public.zd_orders,public.zd_order_items to authenticated;
create policy zd_orders_owner_read on public.zd_orders
 for select to authenticated using (
 exists (select 1 from public.zd_businesses b
 where b.id = zd_orders.business_id and b.owner_id = (select auth.uid()))
 );
create policy zd_items_owner_read on public.zd_order_items
 for select to authenticated using (
 exists (select 1 from public.zd_businesses b
 where b.id = zd_order_items.business_id and b.owner_id = (select auth.uid()))
 );

-- Dar de alta al dueño: crear el usuario en Authentication > Users,
-- copiar su UUID e insertar SOLO desde el SQL Editor con el ID real.
-- Ejemplo ilustrativo, no ejecutar tal cual:
-- insert into public.zd_businesses (owner_id,slug,name,active,published)
-- values ('UUID_REAL_DEL_USUARIO','dona-lupita-piloto','Doña Lupita',true,true);
