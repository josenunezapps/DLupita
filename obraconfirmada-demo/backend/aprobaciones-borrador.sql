-- ObraConfirmada · extensión de seguridad para aprobaciones
-- BORRADOR NO DESPLEGADO. Requiere instancia dedicada y pruebas de seguridad.
-- Ejecutar DESPUÉS del schema-borrador.sql revisado.
-- La asociación cliente/obra debe hacerla exclusivamente un backend confiable
-- después de comprobar la identidad del cliente y la autorización del contratista.

create table public.oc_client_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.oc_projects(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(project_id, client_user_id)
);

create table public.oc_decision_events (
  id uuid primary key default gen_random_uuid(),
  change_id uuid not null references public.oc_changes(id) on delete restrict,
  client_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check(decision in ('Aprobado','Rechazado')),
  notes text not null default '' check(length(notes) <= 2000),
  decided_at timestamptz not null default now(),
  constraint oc_decision_once_per_change unique(change_id)
);

create index oc_client_access_user_idx on public.oc_client_access(client_user_id, project_id);
create index oc_decision_events_client_idx on public.oc_decision_events(client_user_id);

alter table public.oc_client_access enable row level security;
alter table public.oc_decision_events enable row level security;
revoke all on public.oc_client_access, public.oc_decision_events from anon, authenticated;
grant select on public.oc_client_access, public.oc_decision_events to authenticated;

create policy oc_client_access_self_read on public.oc_client_access
for select to authenticated using (client_user_id=(select auth.uid()) and revoked_at is null);

create policy oc_decision_events_client_read on public.oc_decision_events
for select to authenticated using (client_user_id=(select auth.uid()));

-- Clientes ven sólo los cambios de las obras asignadas.
create policy oc_client_changes_read on public.oc_changes
for select to authenticated using (
  exists (
    select 1 from public.oc_client_access a
    where a.project_id = oc_changes.project_id
      and a.client_user_id=(select auth.uid())
      and a.revoked_at is null
  )
);

-- Los clientes NO reciben INSERT, UPDATE o DELETE para oc_changes,
-- oc_client_access ni oc_decision_events.
-- El backend autenticado debe comprobar el token y la asignación de acceso,
-- y ejecutar una transacción ATÓMICA que:
-- 1. Bloquee el cambio pendiente; confirme obra activa y acceso vigente.
-- 2. Compruebe el saldo actualizado y los plazos, y que no hay decisión previa.
-- 3. Actualice estado/decided_at y cree oc_decision_events en la misma transacción.
-- 4. Rechace las decisiones repetidas y registre fecha del servidor, no del navegador.
-- IMPORTANTE: no se crea todavía función SECURITY DEFINER ni endpoint;
-- exponer uno incorrectamente permitiría falsificar aprobaciones.
-- Antes de activar: pruebas de dos usuarios, revocación, concurrencia,
-- borrado, RLS, permisos del rol de servidor y auditoría inmutable.
