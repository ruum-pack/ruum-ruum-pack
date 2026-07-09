-- PRD §4.13 — Calificación del conductor (1 a 5 estrellas), con plazo de 72h
-- y promedio móvil sobre los últimos 6 meses (máx. 100 traslados).
create table public.calificaciones_traslado (
  traslado_id    uuid primary key references public.traslados(id) on delete cascade,
  conductor_id   uuid not null references public.conductores(id) on delete cascade,
  estrellas      int not null check (estrellas between 1 and 5),
  comentario     text,
  calificado_en  timestamptz not null default now()
);

create index calificaciones_conductor_idx on public.calificaciones_traslado (conductor_id, calificado_en desc);

-- PRD §4.13 — "Calificación promedio del conductor se calcula sobre los
-- traslados completados en los últimos 6 meses, considerando como máximo
-- los 100 más recientes dentro de esa ventana." Espejo deliberado de
-- rules/calificacion-nivel.ts::calcularCalificacionPromedio (defensa en
-- profundidad: la columna conductores.calificacion_promedio se mantiene
-- correcta aunque una escritura no pase por la capa de aplicación).
create or replace function public.recalcular_calificacion_conductor(p_conductor_id uuid)
returns void
language plpgsql
as $$
declare
  v_promedio numeric(3,2);
begin
  select coalesce(round(avg(estrellas)::numeric, 2), 0)
  into v_promedio
  from (
    select estrellas
    from public.calificaciones_traslado
    where conductor_id = p_conductor_id
      and calificado_en >= now() - interval '6 months'
    order by calificado_en desc
    limit 100
  ) ultimas_100;

  update public.conductores
  set calificacion_promedio = v_promedio
  where id = p_conductor_id;
end;
$$;

create or replace function public.trigger_recalcular_calificacion()
returns trigger
language plpgsql
as $$
begin
  perform public.recalcular_calificacion_conductor(new.conductor_id);
  return new;
end;
$$;

create trigger calificaciones_recalcular_promedio
  after insert or update on public.calificaciones_traslado
  for each row execute function public.trigger_recalcular_calificacion();

alter table public.calificaciones_traslado enable row level security;

create policy "usuario_califica_sus_traslados"
  on public.calificaciones_traslado for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_ve_sus_calificaciones"
  on public.calificaciones_traslado for select
  using (
    conductor_id in (select id from public.conductores where auth_user_id = auth.uid())
  );

create policy "admin_acceso_total_calificaciones"
  on public.calificaciones_traslado for all
  using (public.es_admin());
