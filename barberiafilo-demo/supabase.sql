-- Barbería Filo: tablas y seguridad para Supabase.
-- Pegalo entero en Supabase > SQL Editor > New query > Run.

create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text not null,
  servicio text not null,
  precio integer,
  nombre text not null check (char_length(nombre) between 1 and 80),
  telefono text not null check (char_length(telefono) between 8 and 20),
  estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','cancelado')),
  creado timestamptz not null default now()
);

create table if not exists public.bloqueos (
  fecha date not null,
  hora text not null,
  primary key (fecha, hora)
);

-- Un solo turno activo por horario: evita turnos dobles.
create unique index if not exists turnos_un_horario on public.turnos (fecha, hora) where estado <> 'cancelado';

-- No dejar reservar un horario bloqueado.
create or replace function public.chequear_bloqueo() returns trigger language plpgsql as $$
begin
  if new.estado <> 'cancelado' and exists (select 1 from public.bloqueos b where b.fecha = new.fecha and b.hora = new.hora) then
    raise exception 'Horario bloqueado';
  end if;
  return new;
end $$;
drop trigger if exists turnos_bloqueo on public.turnos;
create trigger turnos_bloqueo before insert on public.turnos for each row execute function public.chequear_bloqueo();

-- Seguridad: el público solo puede crear turnos y ver qué horarios están ocupados (sin nombres ni teléfonos).
alter table public.turnos enable row level security;
alter table public.bloqueos enable row level security;

drop policy if exists "publico crea turnos" on public.turnos;
create policy "publico crea turnos" on public.turnos for insert to anon
  with check (estado = 'pendiente' and fecha >= current_date);

drop policy if exists "barbero ve y edita turnos" on public.turnos;
create policy "barbero ve y edita turnos" on public.turnos for all to authenticated using (true) with check (true);

drop policy if exists "barbero maneja bloqueos" on public.bloqueos;
create policy "barbero maneja bloqueos" on public.bloqueos for all to authenticated using (true) with check (true);

-- Vista pública de horarios ocupados: solo fecha y hora.
create or replace view public.ocupados as
  select fecha, hora from public.turnos where estado <> 'cancelado'
  union
  select fecha, hora from public.bloqueos;

grant select on public.ocupados to anon, authenticated;
grant insert on public.turnos to anon;
