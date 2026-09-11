-- FASE 4 — Separar Assignment: la relación traslado-conductor como dominio formal.
-- traslados.conductor_id se conserva como puntero al conductor vigente
-- (compatibilidad total); la historia vive en public.asignaciones.
-- 4.2 — Lógica reutilizada de 0050 (conductor_acepta_viaje: elegibilidad,
-- niveles, update condicional) y de la competencia CONCER (puntaje).
-- Estados del plan en minúsculas (convención repo).

-- Eventos de auditoría del dominio (actor: admin/conductor/usuario/sistema).
alter type public.evento_auditable
  add value if not exists 'oferta_asignacion';
alter type public.evento_auditable
  add value if not exists 'aceptacion_asignacion';
alter type public.evento_auditable
  add value if not exists 'rechazo_asignacion';
alter type public.evento_auditable
  add value if not exists 'cancelacion_asignacion';
alter type public.evento_auditable
  add value if not exists 'reasignacion_conductor';

create type public.estado_asignacion as enum (
  'pendiente',
  'ofrecida',
  'aceptada',
  'rechazada',
  'cancelada',
  'activa',
  'completada'
);

-- 4.3 — entidad Assignment (plan: id/transfer_id/driver_id/status/
-- assigned_at/accepted_at/rejected_at/started_at/completed_at/
-- assignment_source/score/reason)
create table public.asignaciones (
  id                uuid primary key default gen_random_uuid(),
  traslado_id       uuid not null references public.traslados(id) on delete cascade,
  conductor_id      uuid not null references public.conductores(id) on delete restrict,
  estado            public.estado_asignacion not null default 'pendiente',
  origen            text not null default 'manual'
    constraint asignaciones_origen_check
    check (origen in ('manual', 'competencia', 'sistema', 'reasignacion')),
  puntaje           numeric(6,5),
  motivo            text,
  gestionada_por    uuid,
  metadata          jsonb not null default '{}'::jsonb,
  asignada_en       timestamptz not null default now(),
  ofrecida_en       timestamptz,
  aceptada_en       timestamptz,
  rechazada_en      timestamptz,
  iniciada_en       timestamptz,
  completada_en     timestamptz,
  cancelada_en      timestamptz,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);

create trigger asignaciones_actualizado_en
  before update on public.asignaciones
  for each row execute function public.set_actualizado_en();

create index asignaciones_traslado_idx on public.asignaciones (traslado_id, creado_en desc);
create index asignaciones_conductor_idx on public.asignaciones (conductor_id, creado_en desc);

-- 4.14 — a nivel físico no puede haber doble asignación vigente
create unique index asignaciones_vigente_uidx
  on public.asignaciones (traslado_id)
  where estado in ('pendiente', 'ofrecida', 'aceptada', 'activa');

-- 4.10 — liberar un conductor requiere volver a pendiente_de_conductor.
-- Sin este edge, cancelar/reasignar rompería el grafo legacy. No altera
-- cancelabilidad (a1): esa matriz solo evalúa saltos a servicio_cancelado.
insert into public.estado_transiciones_validas (estado_actual, estado_siguiente)
values ('conductor_asignado', 'pendiente_de_conductor')
on conflict do nothing;

-- El salto operativo assigned -> planned que el edge anterior implica.
insert into public.estado_operativo_transiciones_validas (estado_actual, estado_siguiente)
values ('assigned', 'planned')
on conflict do nothing;

-- 4.4 — migrar asignaciones actuales (una fila por conductor vigente)
insert into public.asignaciones (
  traslado_id, conductor_id, estado, origen, motivo,
  asignada_en, aceptada_en, iniciada_en, completada_en, cancelada_en,
  metadata
)
select t.id, t.conductor_id,
  case t.estado_operativo
    when 'assigned' then 'aceptada'::public.estado_asignacion
    when 'pickup_in_progress' then 'activa'
    when 'vehicle_received' then 'activa'
    when 'in_transit' then 'activa'
    when 'delivery_in_progress' then 'activa'
    when 'delivered' then 'completada'
    when 'closed' then 'completada'
    when 'cancelled' then 'cancelada'
    when 'failed' then 'cancelada'
    else 'aceptada'
  end,
  'sistema',
  'Asignación existente al formalizar Assignment (Fase 4).',
  t.creado_en, t.creado_en,
  case when t.estado_operativo in ('pickup_in_progress','vehicle_received','in_transit','delivery_in_progress','delivered','closed') then t.actualizado_en end,
  case when t.estado_operativo in ('delivered','closed') then t.actualizado_en end,
  case when t.estado_operativo in ('cancelled','failed') then t.actualizado_en end,
  jsonb_build_object('fase', '4', 'origen', 'backfill')
from public.traslados t
where t.conductor_id is not null;

-- Autoverificación del backfill: todo conductor vigente tiene su fila.
do $$
declare
  v_traslados int;
  v_filas int;
begin
  select count(*) into v_traslados from public.traslados where conductor_id is not null;
  select count(distinct traslado_id) into v_filas from public.asignaciones;
  if v_traslados <> v_filas then
    raise exception 'Backfill Fase 4 incompleto: % traslados con conductor vs % filas', v_traslados, v_filas;
  end if;
end $$;

-- Funnel único: cualquier escritura legacy de conductor_id (admin_asigna,
-- conductor_acepta_viaje, CONCER automático) genera su fila de auditoría.
-- Las RPC nuevas marcan ruum.asignacion_gestionada='1' y gestionan la fila.
create or replace function public.sincronizar_asignacion_traslado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gestionada boolean := coalesce(nullif(current_setting('ruum.asignacion_gestionada', true), ''), '0') = '1';
  v_op public.estado_operativo_traslado;
  v_vigente record;
  v_origen text := 'sistema';
  v_puntaje numeric(6,5);
  v_meta jsonb := '{}'::jsonb;
  v_nuevo_estado public.estado_asignacion;
begin
  if v_gestionada then return new; end if;
  v_op := new.estado_operativo;

  if old.conductor_id is distinct from new.conductor_id then
    if old.conductor_id is not null then
      update public.asignaciones
      set estado = 'cancelada', cancelada_en = now(),
          motivo = coalesce(motivo || ' | ', '') ||
            case when new.conductor_id is null
              then 'Conductor liberado fuera de RPC.'
              else 'Reemplazado fuera de RPC.' end
      where traslado_id = new.id
        and conductor_id = old.conductor_id
        and estado in ('pendiente', 'ofrecida', 'aceptada', 'activa');
    end if;

    if new.conductor_id is not null
       and not exists (
         select 1 from public.asignaciones
         where traslado_id = new.id
           and conductor_id = new.conductor_id
           and estado in ('pendiente', 'ofrecida', 'aceptada', 'activa')
       ) then
      -- 4.11 — si una competencia CONCER resolvió a este conductor, conserva ranking
      select s.puntualidad_porcentaje,
             jsonb_build_object('categoria_puntualidad', s.categoria_puntualidad,
                                'asignaciones_7d', s.asignaciones_7d,
                                'distancia_origen_km', s.distancia_origen_km,
                                'competencia_id', s.competencia_id)
        into v_puntaje, v_meta
      from public.solicitudes_asignacion s
      join public.competencias_asignacion c on c.id = s.competencia_id
      where s.traslado_id = new.id
        and s.conductor_id = new.conductor_id
        and c.estado = 'resuelta'
        and c.conductor_seleccionado_id = new.conductor_id
      order by s.solicitada_en desc
      limit 1;

      if not found then
        v_puntaje := null;
        v_meta := '{}'::jsonb;
      else
        v_origen := 'competencia';
      end if;

      v_nuevo_estado := case v_op
        when 'assigned' then 'aceptada'
        when 'pickup_in_progress' then 'activa'
        when 'vehicle_received' then 'activa'
        when 'in_transit' then 'activa'
        when 'delivery_in_progress' then 'activa'
        when 'delivered' then 'completada'
        when 'closed' then 'completada'
        when 'cancelled' then 'cancelada'
        when 'failed' then 'cancelada'
        else 'aceptada'
      end;

      insert into public.asignaciones (
        traslado_id, conductor_id, estado, origen, puntaje, motivo, metadata,
        aceptada_en, iniciada_en, completada_en, cancelada_en
      ) values (
        new.id, new.conductor_id, v_nuevo_estado, v_origen, v_puntaje,
        'Sincronizada desde conductor_id (ruta legacy/CONCER).', v_meta,
        now(),
        case when v_nuevo_estado = 'activa' then now() end,
        case when v_nuevo_estado = 'completada' then now() end,
        case when v_nuevo_estado = 'cancelada' then now() end
      );
    end if;
  elsif new.estado is distinct from old.estado then
    select id, estado into v_vigente
    from public.asignaciones
    where traslado_id = new.id
      and estado in ('pendiente', 'ofrecida', 'aceptada', 'activa')
    order by creado_en desc
    limit 1;

    if found then
      if v_op in ('in_transit', 'delivery_in_progress') and v_vigente.estado = 'aceptada' then
        update public.asignaciones set estado = 'activa', iniciada_en = now() where id = v_vigente.id;
      elsif v_op in ('delivered', 'closed') and v_vigente.estado in ('aceptada', 'activa') then
        update public.asignaciones set estado = 'completada', completada_en = now() where id = v_vigente.id;
      elsif v_op in ('cancelled', 'failed') then
        update public.asignaciones
        set estado = 'cancelada', cancelada_en = now(),
            motivo = coalesce(motivo || ' | ', '') || 'Traslado ' || v_op::text || '.'
        where id = v_vigente.id;
      elsif v_op in ('delivered', 'closed', 'cancelled', 'failed') then
        update public.asignaciones
        set estado = 'cancelada', cancelada_en = now(),
            motivo = coalesce(motivo || ' | ', '') || 'Oferta cerrada por fin del traslado.'
        where id = v_vigente.id and estado in ('pendiente', 'ofrecida');
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger traslados_sincronizar_asignacion
  after update of conductor_id, estado on public.traslados
  for each row execute function public.sincronizar_asignacion_traslado();

-- Altas directas con conductor (fixtures, masivos) también generan su fila.
create trigger traslados_sincronizar_asignacion_insert
  after insert on public.traslados
  for each row
  when (new.conductor_id is not null)
  execute function public.sincronizar_asignacion_traslado();

-- 4.5/4.6 — ofrecer (Torre o dispatcher; idempotente por conductor)
create or replace function public.ofrecer_asignacion(
  p_traslado_id uuid, p_conductor_id uuid, p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_traslado record;
  v_vehiculo record;
  v_conductor record;
  v_existente uuid;
  v_empresa uuid;
  v_puntaje numeric(6,5);
  v_meta jsonb := '{}'::jsonb;
  v_nivel_orden int;
  v_nivel_requerido int;
  v_tipo_ruta text;
begin
  perform pg_advisory_xact_lock(hashtext('asignacion:' || p_traslado_id::text));

  select t.* into v_traslado from public.traslados t where t.id = p_traslado_id for update;
  if v_traslado.id is null then raise exception 'Traslado no encontrado.'; end if;

  -- 4.15 — reoferta al mismo conductor: devuelve la vigente (idempotente)
  select id into v_existente from public.asignaciones
  where traslado_id = p_traslado_id and conductor_id = p_conductor_id
    and estado in ('pendiente', 'ofrecida', 'aceptada', 'activa');
  if v_existente is not null then return v_existente; end if;

  -- 4.14 — otro conductor vigente bloquea la oferta
  if exists (select 1 from public.asignaciones
             where traslado_id = p_traslado_id
               and estado in ('pendiente', 'ofrecida', 'aceptada', 'activa')) then
    raise exception 'Ya existe una asignación vigente para este traslado; use reasignación.';
  end if;

  if v_traslado.conductor_id is not null then
    raise exception 'El traslado ya tiene conductor; use reasignación.';
  end if;

  if v_traslado.estado <> 'pendiente_de_conductor' then
    raise exception 'Solo se puede ofrecer en pendiente_de_conductor (actual: %).', v_traslado.estado;
  end if;

  -- autorización: Torre o driver:assign en la empresa del solicitante
  select u.empresa_id into v_empresa from public.usuarios u where u.id = v_traslado.usuario_id;
  if not public.es_admin()
     and (v_empresa is null or not public.empresa_tiene_permiso(v_empresa, 'driver:assign')) then
    raise exception 'Sin permiso driver:assign para ofrecer este traslado.';
  end if;

  -- 4.2/4.11 — elegibilidad CONCER (espejo de conductor_acepta_viaje, 0050)
  select * into v_conductor from public.conductores where id = p_conductor_id;
  if v_conductor.id is null then raise exception 'Conductor no encontrado.'; end if;
  if v_conductor.estado not in ('activo', 'modo_prueba_supervisada')
     or not v_conductor.documentos_vigentes
     or coalesce(v_conductor.suspensiones_activas, 0) <> 0
     or coalesce(v_conductor.incidencias_graves_6m, 0) <> 0 then
    raise exception 'Conductor no elegible para asignación.';
  end if;

  select * into v_vehiculo from public.vehiculos where id = v_traslado.vehiculo_id;
  v_tipo_ruta := case v_traslado.tipo_ruta
    when 'foraneo' then 'interurbana_mas_100km'
    else 'intraurbana'
  end;
  v_nivel_orden := case v_conductor.nivel_operativo_vigente
    when 'basico' then 1 when 'ejecutivo' then 2 when 'luxury' then 3 when 'coleccion' then 4 else 0 end;
  v_nivel_requerido := case
    when v_vehiculo.tipo = 'coleccion' then 4
    when v_vehiculo.tipo = 'luxury' then 3
    when v_tipo_ruta = 'interurbana_mas_100km' then 2
    else 1 end;
  if v_nivel_orden < v_nivel_requerido then
    raise exception 'El nivel operativo del conductor no cubre este viaje.';
  end if;

  select s.puntualidad_porcentaje,
         jsonb_build_object('categoria_puntualidad', s.categoria_puntualidad,
                            'asignaciones_7d', s.asignaciones_7d,
                            'distancia_origen_km', s.distancia_origen_km)
    into v_puntaje, v_meta
  from public.solicitudes_asignacion s
  where s.traslado_id = p_traslado_id and s.conductor_id = p_conductor_id
  order by s.solicitada_en desc
  limit 1;

  if not found then
    v_puntaje := null;
    v_meta := '{}'::jsonb;
  end if;

  -- la oferta no toca traslados: el trigger no dispara, no se necesita flag
  insert into public.asignaciones (
    traslado_id, conductor_id, estado, origen, puntaje, motivo,
    gestionada_por, metadata, ofrecida_en
  ) values (
    p_traslado_id, p_conductor_id, 'ofrecida', 'manual', v_puntaje, p_motivo,
    public.admin_actual_id(), v_meta, now()
  ) returning id into v_existente;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (p_traslado_id, 'oferta_asignacion', 'admin', coalesce(public.admin_actual_id(), v_conductor.id),
    jsonb_build_object('asignacion_id', v_existente, 'conductor_id', p_conductor_id, 'motivo', p_motivo));

  return v_existente;
exception
  when unique_violation then
    raise exception 'Ya existe una asignación vigente para este traslado; use reasignación.';
end;
$$;

-- 4.7 — aceptar (el propio conductor; idempotente)
create or replace function public.aceptar_asignacion(p_asignacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig record;
  v_conductor_id uuid;
  v_estado public.estado_traslado;
  v_actual_conductor uuid;
begin
  select id into v_conductor_id from public.conductores where auth_user_id = auth.uid();
  if v_conductor_id is null then raise exception 'Conductor no autenticado.'; end if;

  select * into v_asig from public.asignaciones where id = p_asignacion_id for update;
  if v_asig.id is null then raise exception 'Asignación no encontrada.'; end if;
  if v_asig.conductor_id <> v_conductor_id and not public.es_admin() then
    raise exception 'Solo el conductor ofertado puede aceptar.';
  end if;
  if v_asig.estado = 'aceptada' then return; end if;
  if v_asig.estado not in ('pendiente', 'ofrecida') then
    raise exception 'La asignación ya no admite aceptación (estado %).', v_asig.estado;
  end if;

  select estado, conductor_id into v_estado, v_actual_conductor
  from public.traslados where id = v_asig.traslado_id for update;
  if v_actual_conductor is not null and v_actual_conductor <> v_asig.conductor_id then
    raise exception 'El traslado ya tiene otro conductor; solicite reasignación.';
  end if;

  perform set_config('ruum.asignacion_gestionada', '1', true);

  update public.asignaciones set estado = 'aceptada', aceptada_en = now() where id = v_asig.id;

  if v_estado = 'pendiente_de_conductor' then
    update public.traslados
    set estado = 'conductor_asignado', conductor_id = v_asig.conductor_id
    where id = v_asig.traslado_id;
  elsif v_actual_conductor is null then
    update public.traslados set conductor_id = v_asig.conductor_id where id = v_asig.traslado_id;
  end if;

  perform set_config('ruum.asignacion_gestionada', '0', true);

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (v_asig.traslado_id, 'aceptacion_asignacion', 'conductor', v_asig.conductor_id,
    jsonb_build_object('asignacion_id', v_asig.id));
end;
$$;

-- 4.8 — rechazar (el propio conductor; idempotente)
create or replace function public.rechazar_asignacion(p_asignacion_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig record;
  v_conductor_id uuid;
begin
  select id into v_conductor_id from public.conductores where auth_user_id = auth.uid();
  if v_conductor_id is null then raise exception 'Conductor no autenticado.'; end if;

  select * into v_asig from public.asignaciones where id = p_asignacion_id for update;
  if v_asig.id is null then raise exception 'Asignación no encontrada.'; end if;
  if v_asig.conductor_id <> v_conductor_id and not public.es_admin() then
    raise exception 'Solo el conductor ofertado puede rechazar.';
  end if;
  if v_asig.estado = 'rechazada' then return; end if;
  if v_asig.estado not in ('pendiente', 'ofrecida') then
    raise exception 'La asignación ya no admite rechazo (estado %).', v_asig.estado;
  end if;

  update public.asignaciones
  set estado = 'rechazada', rechazada_en = now(), motivo = coalesce(p_motivo, motivo)
  where id = v_asig.id;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (v_asig.traslado_id, 'rechazo_asignacion', 'conductor', v_asig.conductor_id,
    jsonb_build_object('asignacion_id', v_asig.id, 'motivo', p_motivo));
end;
$$;

-- 4.9 — cancelar oferta/aceptación (Torre o driver:assign; en curso exige reasignar)
create or replace function public.cancelar_asignacion(p_asignacion_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asig record;
  v_traslado record;
  v_empresa uuid;
begin
  select * into v_asig from public.asignaciones where id = p_asignacion_id for update;
  if v_asig.id is null then raise exception 'Asignación no encontrada.'; end if;
  if v_asig.estado = 'cancelada' then return; end if;
  if v_asig.estado in ('rechazada', 'completada') then
    raise exception 'La asignación ya está cerrada (estado %).', v_asig.estado;
  end if;
  if v_asig.estado = 'activa' then
    raise exception 'Asignación en curso: use reasignación en lugar de cancelación.';
  end if;

  select t.*, u.empresa_id as usuario_empresa into v_traslado
  from public.traslados t
  join public.usuarios u on u.id = t.usuario_id
  where t.id = v_asig.traslado_id for update of t;

  v_empresa := v_traslado.usuario_empresa;
  if not public.es_admin()
     and (v_empresa is null or not public.empresa_tiene_permiso(v_empresa, 'driver:assign')) then
    raise exception 'Sin permiso driver:assign para cancelar.';
  end if;

  perform set_config('ruum.asignacion_gestionada', '1', true);

  update public.asignaciones
  set estado = 'cancelada', cancelada_en = now(),
      motivo = coalesce(p_motivo, motivo, 'Cancelada por operación.')
  where id = v_asig.id;

  -- 4.10 — liberar conductor devuelve el traslado a pendiente (edge Fase 4)
  if v_traslado.conductor_id = v_asig.conductor_id
     and v_traslado.estado = 'conductor_asignado' then
    update public.traslados
    set conductor_id = null, estado = 'pendiente_de_conductor'
    where id = v_asig.traslado_id;
  end if;

  perform set_config('ruum.asignacion_gestionada', '0', true);

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (v_asig.traslado_id, 'cancelacion_asignacion', 'admin',
    coalesce(public.admin_actual_id(), v_asig.conductor_id),
    jsonb_build_object('asignacion_id', v_asig.id, 'motivo', p_motivo));
end;
$$;

-- 4.10 — reasignación con cadena auditable (quién reemplazó a quién)
create or replace function public.reasignar_conductor(
  p_traslado_id uuid, p_nuevo_conductor_id uuid, p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_traslado record;
  v_empresa uuid;
  v_anterior record;
  v_nueva uuid;
  v_estado_nuevo public.estado_asignacion;
begin
  perform pg_advisory_xact_lock(hashtext('asignacion:' || p_traslado_id::text));

  select t.*, u.empresa_id as usuario_empresa into v_traslado
  from public.traslados t
  join public.usuarios u on u.id = t.usuario_id
  where t.id = p_traslado_id for update of t;
  if v_traslado.id is null then raise exception 'Traslado no encontrado.'; end if;

  v_empresa := v_traslado.usuario_empresa;
  if not public.es_admin()
     and (v_empresa is null or not public.empresa_tiene_permiso(v_empresa, 'driver:assign')) then
    raise exception 'Sin permiso driver:assign para reasignar.';
  end if;

  if not exists (select 1 from public.conductores where id = p_nuevo_conductor_id) then
    raise exception 'Conductor no encontrado.';
  end if;

  if v_traslado.conductor_id = p_nuevo_conductor_id then
    raise exception 'El conductor ya está asignado a este traslado.';
  end if;

  perform set_config('ruum.asignacion_gestionada', '1', true);

  select * into v_anterior from public.asignaciones
  where traslado_id = p_traslado_id
    and estado in ('pendiente', 'ofrecida', 'aceptada', 'activa')
  order by creado_en desc
  limit 1 for update;

  if found then
    update public.asignaciones
    set estado = 'cancelada', cancelada_en = now(),
        motivo = 'Reasignada: ' || coalesce(p_motivo, 'cambio operativo')
    where id = v_anterior.id;
  end if;

  v_estado_nuevo := case v_traslado.estado_operativo
    when 'in_transit' then 'activa'
    when 'delivery_in_progress' then 'activa'
    when 'pickup_in_progress' then 'activa'
    when 'vehicle_received' then 'activa'
    else 'aceptada'
  end;

  insert into public.asignaciones (
    traslado_id, conductor_id, estado, origen, motivo, gestionada_por,
    metadata, aceptada_en, iniciada_en
  ) values (
    p_traslado_id, p_nuevo_conductor_id, v_estado_nuevo, 'reasignacion',
    p_motivo, public.admin_actual_id(),
    jsonb_build_object('reemplaza_a', v_traslado.conductor_id,
                       'asignacion_anterior_id', v_anterior.id),
    now(),
    case when v_estado_nuevo = 'activa' then now() end
  ) returning id into v_nueva;

  if v_traslado.estado = 'pendiente_de_conductor' then
    update public.traslados
    set conductor_id = p_nuevo_conductor_id, estado = 'conductor_asignado'
    where id = p_traslado_id;
  else
    update public.traslados set conductor_id = p_nuevo_conductor_id where id = p_traslado_id;
  end if;

  perform set_config('ruum.asignacion_gestionada', '0', true);

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (p_traslado_id, 'reasignacion_conductor', 'admin',
    coalesce(public.admin_actual_id(), p_nuevo_conductor_id),
    jsonb_build_object('asignacion_id', v_nueva, 'anterior_conductor_id', v_traslado.conductor_id,
                       'motivo', p_motivo));

  return v_nueva;
end;
$$;

-- RLS: lectura por rol; escritura solo vía RPC/Torre
alter table public.asignaciones enable row level security;

create policy "admin_acceso_total_asignaciones"
  on public.asignaciones for all using (public.es_admin());

create policy "conductor_ve_sus_asignaciones"
  on public.asignaciones for select
  using (
    conductor_id in (select c.id from public.conductores c where c.auth_user_id = auth.uid())
  );

create policy "usuario_ve_asignaciones_sus_traslados"
  on public.asignaciones for select
  using (
    traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

grant select on public.asignaciones to authenticated;
grant all on public.asignaciones to service_role;
grant execute on function public.ofrecer_asignacion(uuid, uuid, text) to authenticated;
grant execute on function public.aceptar_asignacion(uuid) to authenticated;
grant execute on function public.rechazar_asignacion(uuid, text) to authenticated;
grant execute on function public.cancelar_asignacion(uuid, text) to authenticated;
grant execute on function public.reasignar_conductor(uuid, uuid, text) to authenticated;
