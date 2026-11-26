create table if not exists public.flama_admins (user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.flama_products (id text primary key check (id ~ '^[a-zA-Z0-9_-]{1,100}$'), product jsonb not null check (jsonb_typeof(product)='object' and product ? 'name' and product ? 'variants' and product ? 'category'), active boolean not null default true, position integer not null default 0);
create table if not exists public.flama_settings (id integer primary key check(id=1), settings jsonb not null check(jsonb_typeof(settings)='object'));
alter table public.flama_admins enable row level security;
alter table public.flama_products enable row level security;
alter table public.flama_settings enable row level security;
revoke all on public.flama_admins, public.flama_products, public.flama_settings from anon, authenticated;
grant select on public.flama_admins to authenticated;
grant select on public.flama_products,public.flama_settings to anon,authenticated;
grant insert,update,delete on public.flama_products to authenticated;
grant update on public.flama_settings to authenticated;
drop policy if exists flama_admin_self on public.flama_admins;
create policy flama_admin_self on public.flama_admins for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists flama_public_products on public.flama_products;
create policy flama_public_products on public.flama_products for select to anon,authenticated using(active);
drop policy if exists flama_manage_products on public.flama_products;
create policy flama_manage_products on public.flama_products for all to authenticated using(exists(select 1 from public.flama_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.flama_admins a where a.user_id=(select auth.uid())));
drop policy if exists flama_public_settings on public.flama_settings;
create policy flama_public_settings on public.flama_settings for select to anon,authenticated using(true);
drop policy if exists flama_manage_settings on public.flama_settings;
create policy flama_manage_settings on public.flama_settings for update to authenticated using(exists(select 1 from public.flama_admins a where a.user_id=(select auth.uid()))) with check(exists(select 1 from public.flama_admins a where a.user_id=(select auth.uid())));
insert into public.flama_settings(id,settings) values(1,'{"phone":"5492901528601","address":"Bet-El 1185","hours":"Martes a domingos · 20:00 a 01:00","scheduleDefault":true}'::jsonb) on conflict do nothing;
insert into public.flama_products(id,product,active,position) values ('cheese','{"id":"cheese","name":"Cheese","description":"Pan de papa, medallón smash, cheddar y salsa BigFlama","category":"Hamburguesas","image":"","active":true,"demo":false,"variants":[{"name":"Simple","price":13000},{"name":"Doble","price":15000},{"name":"Triple","price":17000}]}'::jsonb,true,0),
('bacontodo','{"id":"bacontodo","name":"Bacontodo","description":"Pan de papa, medallón, cheddar, bacon y salsa BigFlama","category":"Hamburguesas","image":"","active":true,"demo":false,"variants":[{"name":"Simple","price":14000},{"name":"Doble","price":16000},{"name":"Triple","price":18000}]}'::jsonb,true,1),
('flamenco','{"id":"flamenco","name":"Flamenco","description":"Pan de papa, medallón, cheddar, bacon, cebolla caramelizada y barbacoa","category":"Hamburguesas","image":"","active":true,"demo":false,"variants":[{"name":"Simple","price":14000},{"name":"Doble","price":16000},{"name":"Triple","price":18000}]}'::jsonb,true,2),
('flamerican','{"id":"flamerican","name":"Flamerican","description":"Pan de papa, lechuga, tomate, medallón, cheddar, cebolla morada, pepinillo y aderezo BigFlama","category":"Hamburguesas","image":"","active":true,"demo":false,"variants":[{"name":"Simple","price":15000},{"name":"Doble","price":17500},{"name":"Triple","price":19000}]}'::jsonb,true,3),
('clasicona','{"id":"clasicona","name":"Clasicona","description":"Pan de papa, lechuga, tomate, medallón, jamón, tybo y huevo","category":"Hamburguesas","image":"","active":true,"demo":false,"variants":[{"name":"Simple","price":15000},{"name":"Doble","price":17500},{"name":"Triple","price":19000}]}'::jsonb,true,4),
('flamaaa','{"id":"flamaaa","name":"Flamaaa","description":"Pan de papa, mayoflama, medallón, cheddar, bacon, cebolla morada y salsa Flama","category":"Hamburguesas","image":"","active":true,"demo":false,"variants":[{"name":"Simple","price":15000},{"name":"Doble","price":17500},{"name":"Triple","price":19000}]}'::jsonb,true,5),
('promo-clasicona','{"id":"promo-clasicona","name":"Clasicona doble x2","description":"Dos hamburguesas dobles con papas. Promoción publicada por el local.","category":"Promos","image":"","active":true,"demo":false,"variants":[{"name":"Promo x2","price":28000}]}'::jsonb,true,6),
('promo-bacontodo','{"id":"promo-bacontodo","name":"Bacontodo doble x2","description":"Dos hamburguesas dobles con papas. Promoción publicada por el local.","category":"Promos","image":"","active":true,"demo":false,"variants":[{"name":"Promo x2","price":25000}]}'::jsonb,true,7),
('cola','{"id":"cola","name":"Gaseosa cola 500 ml","description":"Producto y precio ilustrativos; confirmar con el local.","category":"Bebidas","image":"","active":true,"demo":true,"variants":[{"name":"500 ml","price":2500}]}'::jsonb,true,8),
('lima','{"id":"lima","name":"Gaseosa lima-limón 500 ml","description":"Producto y precio ilustrativos; confirmar con el local.","category":"Bebidas","image":"","active":true,"demo":true,"variants":[{"name":"500 ml","price":2500}]}'::jsonb,true,9),
('agua','{"id":"agua","name":"Agua 500 ml","description":"Producto y precio ilustrativos; confirmar con el local.","category":"Bebidas","image":"","active":true,"demo":true,"variants":[{"name":"500 ml","price":2000}]}'::jsonb,true,10) on conflict do nothing;