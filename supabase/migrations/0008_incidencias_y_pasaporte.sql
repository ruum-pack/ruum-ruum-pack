-- PRD §8 — Flujos de incidencia mínimos.
create type public.tipo_incidencia as enum (
  'vehiculo_no_enciende',
  'contacto_no_localizado',
  'documentacion_incompleta',
  'dano_previo_relevante',
  'colision_robo_asalto',
  'emergencia_medica_conductor',
  'descompostura_en_ruta',
  'infraccion_autoridad_vial',
  'conductor_enfermo',
  'perdida_conectividad',
  'dano_no_reportado'
);

create type public.momento_incidencia as enum ('recoleccion', 'durante_traslado', 'entrega', 'post_cierre');
create type public.actor_reporte as enum ('usuario', 'conductor', 'admin', 'sistema');

create table public.incidencias (
  id            uuid primary key default gen_random_uuid(),
  traslado_id   uuid not null references public.traslados(id) on delete cascade,
  tipo          public.tipo_incidencia not null,
  momento       public.momento_incidencia not null,
  reportada_por public.actor_reporte not null,
  descripcion   text not null,
  resuelta      boolean not null default false,
  creada_en     timestamptz not null default now(),
  resuelta_en   timestamptz
);

create index incidencias_traslado_idx on public.incidencias (traslado_id);

alter table public.incidencias enable row level security;

create policy "usuario_ve_incidencias_de_sus_traslados"
  on public.incidencias for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create policy "conductor_administra_incidencias_de_sus_traslados"
  on public.incidencias for all
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.conductores c on c.id = t.conductor_id
      where c.auth_user_id = auth.uid()
    )
  );

create policy "admin_acceso_total_incidencias"
  on public.incidencias for all
  using (public.es_admin());

-- PRD §5.1 — Pasaporte Digital de Traslado: "expediente vivo durante el
-- viaje y expediente cerrado al finalizar... Debe ser visible para Usuario y
-- Admin." Vista de solo lectura que agrega los datos clave; las filas que
-- cada quien puede ver siguen filtradas por las políticas RLS de las tablas
-- subyacentes gracias a security_invoker (sin esto, una vista corre con los
-- permisos de quien la creó y se saltaría RLS por completo).
create view public.pasaporte_digital
with (security_invoker = true)
as
select
  t.id as traslado_id,
  t.usuario_id,
  t.vehiculo_id,
  t.conductor_id,
  t.estado,
  t.tiene_incidencia_abierta,
  t.tipo_pago,
  t.causa_fallido,
  t.precio_cotizado,
  t.precio_final,
  t.creado_en,
  t.actualizado_en,
  v.tipo as vehiculo_tipo,
  v.marca as vehiculo_marca,
  v.modelo as vehiculo_modelo,
  v.anio as vehiculo_anio,
  c.nombre as conductor_nombre,
  c.estado as conductor_estado,
  c.nivel_operativo_vigente as conductor_nivel,
  c.calificacion_promedio as conductor_calificacion,
  (
    select count(*) from public.evidencia_fotos ef
    where ef.traslado_id = t.id and ef.tipo = 'inicial' and ef.sincronizada
  ) as evidencia_inicial_fotos_sincronizadas,
  (
    select count(*) from public.evidencia_fotos ef
    where ef.traslado_id = t.id and ef.tipo = 'final' and ef.sincronizada
  ) as evidencia_final_fotos_sincronizadas,
  (
    select count(*) from public.incidencias i
    where i.traslado_id = t.id and not i.resuelta
  ) as incidencias_abiertas,
  (
    select coalesce(sum(p.monto), 0) from public.pagos p
    where p.traslado_id = t.id and p.estado = 'completado'
  ) as monto_pagado
from public.traslados t
left join public.vehiculos v on v.id = t.vehiculo_id
left join public.conductores c on c.id = t.conductor_id;
