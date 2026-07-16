-- RT-33 -- Trazabilidad en tiempo real del traslado.
-- El conductor asignado reporta coordenadas; el usuario propietario y Torre de
-- Control solo consultan. La app-usuario recibe los inserts via Supabase Realtime.

create table if not exists public.ubicaciones_traslado (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  conductor_id uuid not null references public.conductores(id) on delete cascade,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  precision_m numeric(10,2),
  velocidad_mps numeric(10,2),
  registrado_en timestamptz not null default now(),
  constraint ubicaciones_lat_valida check (lat between -90 and 90),
  constraint ubicaciones_lng_valida check (lng between -180 and 180),
  constraint ubicaciones_precision_no_negativa check (precision_m is null or precision_m >= 0),
  constraint ubicaciones_velocidad_no_negativa check (velocidad_mps is null or velocidad_mps >= 0)
);

create index if not exists ubicaciones_traslado_traslado_registrado_idx
  on public.ubicaciones_traslado (traslado_id, registrado_en desc);

create index if not exists ubicaciones_traslado_conductor_registrado_idx
  on public.ubicaciones_traslado (conductor_id, registrado_en desc);

alter table public.ubicaciones_traslado enable row level security;

grant select, insert on public.ubicaciones_traslado to authenticated;

create policy "conductor_registra_ubicacion_de_su_traslado"
  on public.ubicaciones_traslado for insert
  with check (
    exists (
      select 1
      from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where t.id = traslado_id
        and c.id = conductor_id
        and c.auth_user_id = auth.uid()
        and t.estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido')
    )
  );

create policy "conductor_lee_ubicaciones_de_su_traslado"
  on public.ubicaciones_traslado for select
  using (
    exists (
      select 1
      from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where t.id = traslado_id
        and c.id = conductor_id
        and c.auth_user_id = auth.uid()
    )
  );

create policy "usuario_lee_ubicaciones_de_sus_traslados"
  on public.ubicaciones_traslado for select
  using (
    exists (
      select 1
      from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where t.id = traslado_id
        and u.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_ubicaciones_traslado"
  on public.ubicaciones_traslado for all
  using (public.es_admin())
  with check (public.es_admin());

do $$
begin
  alter publication supabase_realtime add table public.ubicaciones_traslado;
exception
  when duplicate_object then null;
end $$;
