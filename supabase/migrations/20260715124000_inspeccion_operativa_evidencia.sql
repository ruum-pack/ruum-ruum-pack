-- RT-32 -- Datos operativos capturados junto con evidencia fotografica.

create table if not exists public.evidencia_inspecciones (
  id uuid primary key default gen_random_uuid(),
  traslado_id uuid not null references public.traslados(id) on delete cascade,
  tipo public.tipo_evidencia not null,
  combustible text,
  kilometraje numeric(12,1),
  llaves_recibidas text,
  holograma_verificacion boolean,
  talon_verificacion text,
  tarjeta_circulacion text,
  placa_delantera text,
  placa_trasera text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint evidencia_inspecciones_traslado_tipo_uidx unique (traslado_id, tipo),
  constraint kilometraje_no_negativo check (kilometraje is null or kilometraje >= 0)
);

create trigger evidencia_inspecciones_actualizado_en
  before update on public.evidencia_inspecciones
  for each row execute function public.set_actualizado_en();

alter table public.evidencia_inspecciones enable row level security;

create policy "conductor_administra_inspeccion_de_sus_traslados"
  on public.evidencia_inspecciones for all
  using (
    traslado_id in (
      select t.id
      from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  )
  with check (
    traslado_id in (
      select t.id
      from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "usuario_ve_inspeccion_de_sus_traslados"
  on public.evidencia_inspecciones for select
  using (
    traslado_id in (
      select t.id
      from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_inspecciones_evidencia"
  on public.evidencia_inspecciones for all
  using (public.es_admin())
  with check (public.es_admin());
