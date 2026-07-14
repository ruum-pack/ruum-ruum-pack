-- Apartado normativo rector de tarifas.
-- La fila única de tarifas_config sigue siendo la fuente vigente que consume
-- calcular_tarifa_traslado(); estos campos agregan estado, vigencia y
-- trazabilidad editorial para el panel admin.

create type public.estado_politica_tarifaria as enum ('borrador', 'vigente', 'archivada');

alter table public.tarifas_config
  add column nombre_version text not null default 'Política tarifaria RT-12',
  add column estado public.estado_politica_tarifaria not null default 'vigente',
  add column vigente_desde timestamptz not null default now(),
  add column notas text;

comment on column public.tarifas_config.nombre_version is
  'Nombre operativo de la versión normativa de tarifas visible en admin.';
comment on column public.tarifas_config.estado is
  'Estado editorial de la política tarifaria: borrador, vigente o archivada.';
comment on column public.tarifas_config.vigente_desde is
  'Fecha a partir de la cual esta política se considera vigente para la fórmula usada por app-usuario.';
comment on column public.tarifas_config.notas is
  'Notas internas del apartado rector; no se muestran al usuario final.';
