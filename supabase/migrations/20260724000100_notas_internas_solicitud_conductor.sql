-- Notas internas del expediente de conductor para Torre de Control.

create table if not exists public.notas_internas_solicitud_conductor (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_conductor(id) on delete cascade,
  admin_id uuid references public.admins(id) on delete set null,
  mensaje text not null check (length(btrim(mensaje)) between 1 and 1000),
  creado_en timestamptz not null default now()
);

create index if not exists notas_internas_solicitud_conductor_solicitud_idx
  on public.notas_internas_solicitud_conductor(solicitud_id, creado_en asc);

alter table public.notas_internas_solicitud_conductor enable row level security;

drop policy if exists admin_lee_notas_internas_solicitud_conductor on public.notas_internas_solicitud_conductor;
create policy admin_lee_notas_internas_solicitud_conductor
  on public.notas_internas_solicitud_conductor for select to authenticated
  using (public.es_admin());

drop policy if exists admin_crea_notas_internas_solicitud_conductor on public.notas_internas_solicitud_conductor;
create policy admin_crea_notas_internas_solicitud_conductor
  on public.notas_internas_solicitud_conductor for insert to authenticated
  with check (public.es_admin());

revoke all on public.notas_internas_solicitud_conductor from public, anon, authenticated;
grant select, insert on public.notas_internas_solicitud_conductor to authenticated;
grant all on public.notas_internas_solicitud_conductor to service_role;

comment on table public.notas_internas_solicitud_conductor is
  'Notas internas del expediente de conductor. No son visibles para el conductor.';
