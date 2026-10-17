-- ObraConfirmada: propuesta inicial de base de datos para una instancia DEDICADA.
-- NO EJECUTADO. Revisar y probar en entorno de desarrollo antes de producción.
-- Modelo propietario: las cuentas sólo pueden acceder a sus propias obras.
-- El portal del cliente y la aprobación verificable NO están implementados.
create extension if not exists pgcrypto;

create table if not exists public.oc_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 100),
  client_name text not null check (length(trim(client_name)) between 1 and 90),
  client_phone text not null default '',
  original_amount numeric(14,2) not null check (original_amount >= 0),
  start_date date,
  duration_days integer not null default 0 check (duration_days between 0 and 3650),
  scope text not null check (length(trim(scope)) between 1 and 3000),
  payment_terms text not null default '',
  status text not null default 'Activa' check (status in ('Activa','Pausada','Finalizada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,owner_id)
);

create table if not exists public.oc_changes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '',
  amount_delta numeric(14,2) not null,
  days_delta integer not null default 0 check (days_delta between -3650 and 3650),
  reason text not null default '',
  status text not null default 'Pendiente' check (status in ('Pendiente','Aprobado','Rechazado')),
  -- El estado real requiere decisión vía backend y nunca una actualización directa.
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_notes text not null default '',
  foreign key(project_id, owner_id) references public.oc_projects(id, owner_id) on delete restrict
);

create index if not exists oc_projects_owner_idx on public.oc_projects(owner_id);
create index if not exists oc_changes_project_idx on public.oc_changes(project_id);

alter table public.oc_projects enable row level security;
alter table public.oc_changes enable row level security;

revoke all on public.oc_projects, public.oc_changes from anon;
revoke all on public.oc_changes from authenticated;
grant select, insert, update on public.oc_projects to authenticated;
-- Las modificaciones sólo se pueden crear y consultar desde el cliente.
-- Las decisiones futuras deberán pasar por una operación de servidor auditada.
grant select, insert on public.oc_changes to authenticated;

create policy oc_projects_select on public.oc_projects for select to authenticated
using ((select auth.uid()) = owner_id);
create policy oc_projects_insert on public.oc_projects for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy oc_projects_update on public.oc_projects for update to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy oc_changes_select on public.oc_changes for select to authenticated
using ((select auth.uid()) = owner_id);
create policy oc_changes_insert on public.oc_changes for insert to authenticated
with check ((select auth.uid()) = owner_id and status = 'Pendiente' and decided_at is null);

-- Pendiente ANTES de desplegar:
-- 1) Reglas para prohibir cambios silenciosos en decisiones ya registradas.
-- 2) Flujo de aprobación verificado y su auditoría del lado servidor.
-- 3) Portal con roles de cliente y permisos mínimos.
-- 4) Storage privado, límites, pruebas RLS con dos usuarios diferentes.
-- 5) Crear instancia dedicada, configurar Auth y migración desde JSON.
