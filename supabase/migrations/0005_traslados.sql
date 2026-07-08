-- PRD §6 — Estados del traslado (32 estados) y diagrama de transiciones.
create type public.estado_traslado as enum (
  'usuario_pendiente_verificacion',
  'usuario_verificado',
  'solicitud_creada',
  'documentacion_pendiente',
  'documentacion_en_revision',
  'documentacion_validada',
  'cotizacion_generada',
  'servicio_confirmado',
  'pendiente_de_conductor',
  'conductor_asignado',
  'conductor_en_camino_al_origen',
  'conductor_en_punto_de_recoleccion',
  'verificacion_vehiculo_en_proceso',
  'evidencia_inicial_en_proceso',
  'evidencia_inicial_completada',
  'vehiculo_recibido',
  'traslado_en_curso',
  'incidencia_reportada',
  'llegada_a_destino',
  'evidencia_final_en_proceso',
  'evidencia_final_completada',
  'entrega_confirmada',
  'pago_pendiente',
  'pago_completado',
  'servicio_cerrado',
  'servicio_cancelado',
  'traslado_fallido',
  'dano_no_reportado_en_revision',
  'reclamo_abierto',
  'reclamo_resuelto',
  'cierre_operativo_con_incidencia_abierta',
  'disputa_abierta',
  'disputa_resuelta'
);

-- PRD §4.11
create type public.causa_fallido as enum (
  'imputable_cliente', 'operativo', 'fuerza_mayor', 'documentacion', 'vehiculo_no_circulable'
);

-- PRD §4.6
create type public.tipo_pago as enum ('anticipado', 'al_cierre');

create table public.traslados (
  id                  uuid primary key default gen_random_uuid(),
  estado              public.estado_traslado not null default 'solicitud_creada',
  usuario_id          uuid not null references public.usuarios(id) on delete restrict,
  vehiculo_id         uuid not null references public.vehiculos(id) on delete restrict,
  conductor_id        uuid references public.conductores(id) on delete set null,
  -- PRD §4.1 — contactos de entrega y recepción, distintos del solicitante
  contacto_entrega_nombre     text not null,
  contacto_entrega_telefono   text not null,
  contacto_recepcion_nombre   text not null,
  contacto_recepcion_telefono text not null,
  origen_lat          numeric(10,7) not null,
  origen_lng          numeric(10,7) not null,
  origen_direccion    text not null,
  origen_ciudad       text not null,
  destino_lat         numeric(10,7) not null,
  destino_lng         numeric(10,7) not null,
  destino_direccion   text not null,
  destino_ciudad      text not null,
  precio_cotizado     numeric(10,2),
  precio_final        numeric(10,2),
  tipo_pago           public.tipo_pago not null default 'anticipado',
  causa_fallido       public.causa_fallido,
  -- PRD §4.4 — "el Pasaporte puede cerrarse operativamente, pero quedará
  -- marcado con incidencia abierta hasta su resolución"
  tiene_incidencia_abierta boolean not null default false,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  constraint causa_fallido_solo_si_estado_fallido
    check (estado = 'traslado_fallido' or causa_fallido is null)
);

create trigger traslados_actualizado_en
  before update on public.traslados
  for each row execute function public.set_actualizado_en();

-- PRD §6 — "Diagrama de transiciones de estados". Tabla espejo de
-- packages/shared/src/states/transiciones.ts::TRANSICIONES. Es deliberadamente
-- redundante con la capa de aplicación (defensa en profundidad, mismo
-- criterio que nivel_operativo_vigente en 0003): la app sigue siendo la
-- fuente de verdad legible, pero la base de datos también rechaza
-- transiciones inválidas aunque el bug esté en la aplicación.
create table public.estado_transiciones_validas (
  estado_actual     public.estado_traslado not null,
  estado_siguiente  public.estado_traslado not null,
  primary key (estado_actual, estado_siguiente)
);

insert into public.estado_transiciones_validas (estado_actual, estado_siguiente) values
  ('usuario_pendiente_verificacion', 'usuario_verificado'),
  ('usuario_verificado', 'solicitud_creada'),
  ('solicitud_creada', 'documentacion_pendiente'),
  ('solicitud_creada', 'servicio_cancelado'),
  ('documentacion_pendiente', 'documentacion_en_revision'),
  ('documentacion_pendiente', 'servicio_cancelado'),
  ('documentacion_en_revision', 'documentacion_validada'),
  ('documentacion_en_revision', 'documentacion_pendiente'),
  ('documentacion_en_revision', 'servicio_cancelado'),
  ('documentacion_validada', 'cotizacion_generada'),
  ('cotizacion_generada', 'servicio_confirmado'),
  ('cotizacion_generada', 'servicio_cancelado'),
  ('servicio_confirmado', 'pendiente_de_conductor'),
  ('servicio_confirmado', 'servicio_cancelado'),
  ('pendiente_de_conductor', 'conductor_asignado'),
  ('pendiente_de_conductor', 'servicio_cancelado'),
  ('conductor_asignado', 'conductor_en_camino_al_origen'),
  ('conductor_asignado', 'servicio_cancelado'),
  ('conductor_asignado', 'traslado_fallido'),
  ('conductor_en_camino_al_origen', 'conductor_en_punto_de_recoleccion'),
  ('conductor_en_camino_al_origen', 'incidencia_reportada'),
  ('conductor_en_punto_de_recoleccion', 'verificacion_vehiculo_en_proceso'),
  ('conductor_en_punto_de_recoleccion', 'incidencia_reportada'),
  ('conductor_en_punto_de_recoleccion', 'traslado_fallido'),
  ('conductor_en_punto_de_recoleccion', 'servicio_cancelado'),
  ('verificacion_vehiculo_en_proceso', 'evidencia_inicial_en_proceso'),
  ('verificacion_vehiculo_en_proceso', 'traslado_fallido'),
  ('evidencia_inicial_en_proceso', 'evidencia_inicial_completada'),
  ('evidencia_inicial_completada', 'vehiculo_recibido'),
  ('vehiculo_recibido', 'traslado_en_curso'),
  ('traslado_en_curso', 'llegada_a_destino'),
  ('traslado_en_curso', 'incidencia_reportada'),
  ('incidencia_reportada', 'traslado_en_curso'),
  ('incidencia_reportada', 'traslado_fallido'),
  ('incidencia_reportada', 'llegada_a_destino'),
  ('llegada_a_destino', 'evidencia_final_en_proceso'),
  ('evidencia_final_en_proceso', 'evidencia_final_completada'),
  ('evidencia_final_completada', 'entrega_confirmada'),
  ('entrega_confirmada', 'pago_pendiente'),
  ('entrega_confirmada', 'pago_completado'),
  ('pago_pendiente', 'pago_completado'),
  ('pago_completado', 'servicio_cerrado'),
  ('servicio_cerrado', 'dano_no_reportado_en_revision'),
  ('servicio_cerrado', 'disputa_abierta'),
  ('dano_no_reportado_en_revision', 'reclamo_abierto'),
  ('dano_no_reportado_en_revision', 'cierre_operativo_con_incidencia_abierta'),
  ('reclamo_abierto', 'reclamo_resuelto'),
  ('reclamo_resuelto', 'disputa_abierta'),
  ('cierre_operativo_con_incidencia_abierta', 'reclamo_resuelto'),
  ('cierre_operativo_con_incidencia_abierta', 'disputa_abierta'),
  ('cierre_operativo_con_incidencia_abierta', 'disputa_resuelta'),
  ('disputa_abierta', 'disputa_resuelta');

create or replace function public.validar_transicion_traslado()
returns trigger
language plpgsql
as $$
begin
  if new.estado = old.estado then
    return new; -- UPDATE que no cambia de estado: siempre permitido
  end if;

  if not exists (
    select 1 from public.estado_transiciones_validas
    where estado_actual = old.estado and estado_siguiente = new.estado
  ) then
    raise exception 'Transición de estado inválida: % -> %', old.estado, new.estado;
  end if;

  return new;
end;
$$;

create trigger traslados_validar_transicion
  before update of estado on public.traslados
  for each row execute function public.validar_transicion_traslado();

alter table public.traslados enable row level security;

create policy "usuario_ve_sus_traslados"
  on public.traslados for select
  using (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()));

create policy "usuario_crea_sus_traslados"
  on public.traslados for insert
  with check (usuario_id in (select id from public.usuarios where auth_user_id = auth.uid()));

-- PRD §3 — "Conductor certificado... No puede modificar precio, modificar
-- ruta/destino/origen". El conductor solo puede ver y actualizar (vía RPC en
-- una fase posterior) los traslados que tiene asignados; esta política RLS
-- de UPDATE es deliberadamente amplia a nivel de fila porque la restricción
-- de QUÉ columnas puede tocar un conductor (no precio/ruta) debe aplicarse
-- en la capa de RPC/servicios, no en RLS (RLS filtra filas, no columnas).
create policy "conductor_ve_sus_traslados_asignados"
  on public.traslados for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "conductor_actualiza_sus_traslados_asignados"
  on public.traslados for update
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

create policy "admin_acceso_total_traslados"
  on public.traslados for all
  using (public.es_admin());
