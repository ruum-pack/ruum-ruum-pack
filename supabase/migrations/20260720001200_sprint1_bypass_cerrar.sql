-- Sprint 1 — Cerrar bypass y transacciones críticas.
-- Ninguna operación sensible puede saltarse aprobación, auditoría o concurrencia.

-- =============================================================================
-- 1. Refactor: separar validación de aprobación de su marcado como ejecutada.
--    admin_validar_aprobacion → solo valida + lock (FOR UPDATE)
--    admin_ejecutar_aprobacion → marca como ejecutada (solo tras operación exitosa)
-- =============================================================================

drop function if exists public.admin_validar_y_ejecutar_aprobacion(uuid,text,text,uuid,text);

create or replace function public.admin_validar_aprobacion(
  p_aprobacion_id uuid,
  p_capacidad_requerida text,
  p_recurso text,
  p_recurso_id uuid,
  p_accion text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aprobacion public.solicitudes_aprobacion_admin%rowtype;
begin
  select * into strict v_aprobacion
  from public.solicitudes_aprobacion_admin
  where id = p_aprobacion_id
  for update;

  if v_aprobacion.estado <> 'aprobada' then
    raise exception using errcode='42501', message='APROBACION_NO_APROBADA';
  end if;

  if v_aprobacion.expira_en <= now() then
    update public.solicitudes_aprobacion_admin
    set estado = 'expirada', version = version + 1
    where id = p_aprobacion_id;
    raise exception using errcode='22023', message='APROBACION_EXPIRADA';
  end if;

  if replace(p_capacidad_requerida, '.', ':') <> v_aprobacion.capacidad_requerida then
    raise exception using errcode='42501', message='APROBACION_CAPACIDAD_INVALIDA';
  end if;

  if p_recurso <> v_aprobacion.recurso then
    raise exception using errcode='42501', message='APROBACION_RECURSO_INVALIDO';
  end if;

  if p_recurso_id is not null and v_aprobacion.recurso_id is not null
     and p_recurso_id <> v_aprobacion.recurso_id then
    raise exception using errcode='42501', message='APROBACION_RECURSO_ID_INVALIDO';
  end if;

  if p_accion <> v_aprobacion.accion then
    raise exception using errcode='42501', message='APROBACION_ACCION_INVALIDA';
  end if;

  if p_payload is not null and v_aprobacion.payload is not null
     and v_aprobacion.payload <> '{}'::jsonb and p_payload <> '{}'::jsonb
     and v_aprobacion.payload <> p_payload then
    raise exception using errcode='42501', message='APROBACION_PAYLOAD_NO_COINCIDE';
  end if;

  return jsonb_build_object(
    'solicitud_id', v_aprobacion.id,
    'tipo', v_aprobacion.tipo,
    'solicitada_por', v_aprobacion.solicitada_por,
    'aprobada_por', v_aprobacion.aprobada_por
  );
exception
  when no_data_found then
    raise exception using errcode='42501', message='APROBACION_NO_ENCONTRADA';
end;
$$;

create or replace function public.admin_ejecutar_aprobacion(
  p_aprobacion_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.solicitudes_aprobacion_admin
  set estado = 'ejecutada', ejecutada_en = now(), version = version + 1
  where id = p_aprobacion_id;
  if not found then
    raise exception using errcode='42501', message='APROBACION_NO_ENCONTRADA';
  end if;
end;
$$;

-- =============================================================================
-- 2. admin_ajustar_precio_final — RPC transaccional con aprobación dual
-- =============================================================================

create or replace function public.admin_ajustar_precio_final(
  p_aprobacion_id uuid,
  p_traslado_id uuid,
  p_precio_final numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
begin
  if not public.admin_tiene_permiso('tarifas:editar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_precio_final is null or p_precio_final < 0 then
    raise exception using errcode='22023', message='PRECIO_FINAL_INVALIDO';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'tarifas:editar', 'traslados', p_traslado_id,
    'ajustar_precio_final', jsonb_build_object('precio_final', p_precio_final)
  );

  update public.traslados set precio_final = round(p_precio_final, 2)
  where id = p_traslado_id;
  if not found then
    raise exception using errcode='42501', message='TRASLADO_NO_ENCONTRADO';
  end if;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'traslados', 'ajustar_precio_final',
    jsonb_build_object('traslado_id', p_traslado_id, 'precio_final', p_precio_final, 'aprobacion_id', p_aprobacion_id));

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('ejecutado', true, 'traslado_id', p_traslado_id, 'precio_final', p_precio_final);
end;
$$;

-- =============================================================================
-- 3. admin_ejecutar_pago — crea el pago real + avanza estado traslado
-- =============================================================================

drop function if exists public.admin_ejecutar_pago(uuid,uuid);

create or replace function public.admin_ejecutar_pago(
  p_aprobacion_id uuid,
  p_traslado_id uuid,
  p_monto numeric default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
  v_traslado record;
  v_monto numeric;
  v_pago_id uuid;
begin
  if not public.admin_tiene_permiso('pagos:ejecutar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  select estado, precio_final, precio_cotizado, tipo_pago
  into v_traslado
  from public.traslados
  where id = p_traslado_id
  for update;
  if not found then
    raise exception using errcode='42501', message='TRASLADO_NO_ENCONTRADO';
  end if;

  if v_traslado.estado in ('servicio_cerrado','servicio_cancelado','traslado_fallido') then
    raise exception using errcode='42501', message='TRASLADO_EN_ESTADO_TERMINAL';
  end if;

  v_monto := coalesce(p_monto, v_traslado.precio_final, v_traslado.precio_cotizado);
  if v_monto is null or v_monto <= 0 then
    raise exception using errcode='22023', message='MONTO_INVALIDO';
  end if;

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'pagos:ejecutar', 'traslados', p_traslado_id,
    'ejecutar_pago', jsonb_build_object('monto', v_monto, 'tipo_pago', v_traslado.tipo_pago)
  );

  insert into public.pagos(traslado_id, monto, momento, estado, metodo)
  values (p_traslado_id, round(v_monto, 2),
    case when v_traslado.tipo_pago = 'anticipado' then 'anticipado'::public.momento_pago else 'al_cierre'::public.momento_pago end,
    'completado', 'transferencia')
  returning id into v_pago_id;

  update public.traslados set estado = 'pago_completado'
  where id = p_traslado_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'pagos', 'ejecutar',
    jsonb_build_object('pago_id', v_pago_id, 'traslado_id', p_traslado_id, 'monto', v_monto, 'aprobacion_id', p_aprobacion_id));

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('ejecutado', true, 'pago_id', v_pago_id, 'traslado_id', p_traslado_id, 'monto', v_monto);
end;
$$;

-- =============================================================================
-- 4. admin_cambiar_estado_traslado — RPC transaccional para cambios críticos
-- =============================================================================

create or replace function public.admin_cambiar_estado_traslado(
  p_traslado_id uuid,
  p_nuevo_estado text,
  p_version_esperada bigint default null,
  p_aprobacion_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_estado_anterior text;
  v_estados_criticos text[] := array['pago_completado','reembolsado','facturado'];
  v_requiere_aprobacion boolean;
begin
  if not public.admin_tiene_permiso('viajes:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  select estado::text into v_estado_anterior
  from public.traslados where id = p_traslado_id
  for update;
  if not found then
    raise exception using errcode='42501', message='TRASLADO_NO_ENCONTRADO';
  end if;

  v_requiere_aprobacion := p_nuevo_estado = any(v_estados_criticos);

  if v_requiere_aprobacion then
    if p_aprobacion_id is null then
      raise exception using errcode='42501', message='APROBACION_REQUERIDA';
    end if;
    perform public.admin_validar_aprobacion(
      p_aprobacion_id, 'viajes:gestionar', 'traslados', p_traslado_id,
      'cambiar_estado_' || p_nuevo_estado,
      jsonb_build_object('estado_anterior', v_estado_anterior, 'nuevo_estado', p_nuevo_estado)
    );
  end if;

  update public.traslados set estado = p_nuevo_estado::public.estado_traslado
  where id = p_traslado_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'traslados', 'cambiar_estado',
    jsonb_build_object('traslado_id', p_traslado_id, 'estado_anterior', v_estado_anterior, 'nuevo_estado', p_nuevo_estado));

  if v_requiere_aprobacion then
    perform public.admin_ejecutar_aprobacion(p_aprobacion_id);
  end if;

  return jsonb_build_object('ejecutado', true, 'traslado_id', p_traslado_id, 'estado_anterior', v_estado_anterior, 'nuevo_estado', p_nuevo_estado);
end;
$$;

-- =============================================================================
-- 5. admin_suspender_conductor — aplicación real de suspensión/bloqueo
-- =============================================================================

create or replace function public.admin_suspender_conductor(
  p_aprobacion_id uuid,
  p_conductor_id uuid,
  p_nuevo_estado text,
  p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
  v_estado_anterior text;
begin
  if not public.admin_tiene_permiso('conductores:sancionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  select estado::text into v_estado_anterior
  from public.conductores where id = p_conductor_id
  for update;
  if not found then
    raise exception using errcode='42501', message='CONDUCTOR_NO_ENCONTRADO';
  end if;

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'conductores:sancionar', 'conductores', p_conductor_id,
    'suspender', jsonb_build_object('nuevo_estado', p_nuevo_estado, 'motivo', p_motivo)
  );

  update public.conductores set estado = p_nuevo_estado::public.estado_conductor
  where id = p_conductor_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'conductores', 'suspender',
    jsonb_build_object('conductor_id', p_conductor_id, 'estado_anterior', v_estado_anterior,
      'nuevo_estado', p_nuevo_estado, 'motivo', p_motivo, 'aprobacion_id', p_aprobacion_id));

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('ejecutado', true, 'conductor_id', p_conductor_id, 'nuevo_estado', p_nuevo_estado);
end;
$$;

-- =============================================================================
-- 6. admin_sancionar_conductor — reescrito: aplica sanción real + aprobación dual
-- =============================================================================

drop function if exists public.admin_sancionar_conductor(uuid,uuid,text,integer);

create or replace function public.admin_sancionar_conductor(
  p_aprobacion_id uuid,
  p_conductor_id uuid,
  p_motivo text,
  p_dias_suspension integer default 0
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
  v_nuevo_estado text;
  v_estado_anterior text;
begin
  if not public.admin_tiene_permiso('conductores:sancionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  select estado::text into v_estado_anterior
  from public.conductores where id = p_conductor_id
  for update;
  if not found then
    raise exception using errcode='42501', message='CONDUCTOR_NO_ENCONTRADO';
  end if;

  v_nuevo_estado := case
    when p_dias_suspension <= 0 then 'suspendido_indefinido'
    when p_dias_suspension <= 7 then 'suspendido_7d'
    when p_dias_suspension <= 14 then 'suspendido_14d'
    when p_dias_suspension <= 30 then 'suspendido_30d'
    else 'suspendido_indefinido'
  end;

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'conductores:sancionar', 'conductores', p_conductor_id,
    'sancionar', jsonb_build_object('dias_suspension', p_dias_suspension, 'nuevo_estado', v_nuevo_estado, 'motivo', p_motivo)
  );

  update public.conductores set estado = v_nuevo_estado::public.estado_conductor
  where id = p_conductor_id;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'conductores', 'sancionar',
    jsonb_build_object('conductor_id', p_conductor_id, 'estado_anterior', v_estado_anterior,
      'nuevo_estado', v_nuevo_estado, 'dias_suspension', p_dias_suspension, 'motivo', p_motivo,
      'aprobacion_id', p_aprobacion_id));

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('ejecutado', true, 'conductor_id', p_conductor_id,
    'nuevo_estado', v_nuevo_estado, 'motivo', p_motivo);
end;
$$;

-- =============================================================================
-- 7. admin_registrar_no_presentacion — RPC transaccional con aprobación dual
-- =============================================================================

create or replace function public.admin_registrar_no_presentacion(
  p_aprobacion_id uuid,
  p_conductor_id uuid,
  p_ocurrencias integer,
  p_nuevo_estado text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
begin
  if not public.admin_tiene_permiso('conductores:sancionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'conductores:sancionar', 'conductores', p_conductor_id,
    'no_presentacion', jsonb_build_object('ocurrencias', p_ocurrencias, 'nuevo_estado', p_nuevo_estado)
  );

  update public.conductores
  set no_presentaciones_6m = p_ocurrencias, estado = p_nuevo_estado::public.estado_conductor
  where id = p_conductor_id;
  if not found then
    raise exception using errcode='42501', message='CONDUCTOR_NO_ENCONTRADO';
  end if;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'conductores', 'no_presentacion',
    jsonb_build_object('conductor_id', p_conductor_id, 'ocurrencias', p_ocurrencias,
      'nuevo_estado', p_nuevo_estado, 'aprobacion_id', p_aprobacion_id));

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('ejecutado', true, 'conductor_id', p_conductor_id, 'ocurrencias', p_ocurrencias, 'nuevo_estado', p_nuevo_estado);
end;
$$;

-- =============================================================================
-- 8. admin_registrar_cancelacion_injustificada — RPC transaccional con aprobación dual
-- =============================================================================

create or replace function public.admin_registrar_cancelacion_injustificada(
  p_aprobacion_id uuid,
  p_conductor_id uuid,
  p_cancelaciones integer,
  p_nuevo_estado text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
begin
  if not public.admin_tiene_permiso('conductores:sancionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'conductores:sancionar', 'conductores', p_conductor_id,
    'cancelacion_injustificada', jsonb_build_object('cancelaciones', p_cancelaciones, 'nuevo_estado', p_nuevo_estado)
  );

  update public.conductores
  set cancelaciones_sin_justificacion_count = p_cancelaciones, estado = p_nuevo_estado::public.estado_conductor
  where id = p_conductor_id;
  if not found then
    raise exception using errcode='42501', message='CONDUCTOR_NO_ENCONTRADO';
  end if;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'conductores', 'cancelacion_injustificada',
    jsonb_build_object('conductor_id', p_conductor_id, 'cancelaciones', p_cancelaciones,
      'nuevo_estado', p_nuevo_estado, 'aprobacion_id', p_aprobacion_id));

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('ejecutado', true, 'conductor_id', p_conductor_id, 'cancelaciones', p_cancelaciones, 'nuevo_estado', p_nuevo_estado);
end;
$$;

-- =============================================================================
-- 9. Actualizar admin_actualizar_politica_tarifaria_normativa para usar split
-- =============================================================================

drop function if exists public.admin_actualizar_politica_tarifaria_normativa(uuid,jsonb);

create or replace function public.admin_actualizar_politica_tarifaria_normativa(
  p_aprobacion_id uuid,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_validacion jsonb;
  v_item jsonb;
  v_actualizadas integer := 0;
  v_row_count integer := 0;
  v_tarifa_hora numeric;
  v_tope numeric;
begin
  if not public.admin_tiene_permiso('tarifas:editar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into v_admin_id from public.admins where auth_user_id = auth.uid();
  if v_admin_id is null then
    raise exception 'No se encontró el admin actual';
  end if;

  v_validacion := public.admin_validar_aprobacion(
    p_aprobacion_id, 'tarifas:editar', 'tarifas', null,
    'actualizar_politica_tarifaria', p_payload
  );

  if p_payload ? 'config' then
    v_tarifa_hora := (p_payload->'config'->>'tarifa_hora')::numeric;
    v_tope := (p_payload->'config'->>'tope_factor_variable')::numeric;
    update public.tarifas_config
    set tarifa_hora = v_tarifa_hora, tope_factor_variable = v_tope,
        actualizado_por_admin_id = v_admin_id
    where id = true;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'vehiculo', '[]'::jsonb)) loop
    update public.tarifas_vehiculo
    set base = (v_item->>'base')::numeric, por_km = (v_item->>'por_km')::numeric,
        actualizado_por_admin_id = v_admin_id
    where id = (v_item->>'id')::uuid;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'gama', '[]'::jsonb)) loop
    update public.tarifas_gama
    set factor = (v_item->>'factor')::numeric, actualizado_por_admin_id = v_admin_id
    where gama = (v_item->>'gama')::public.gama_vehiculo;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'condicion', '[]'::jsonb)) loop
    update public.tarifas_condicion
    set factor = (v_item->>'factor')::numeric, actualizado_por_admin_id = v_admin_id
    where condicion = (v_item->>'condicion')::public.condicion_vehiculo;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'horario', '[]'::jsonb)) loop
    update public.tarifas_horario
    set factor = (v_item->>'factor')::numeric, actualizado_por_admin_id = v_admin_id
    where horario = (v_item->>'horario')::public.horario_traslado;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'dia', '[]'::jsonb)) loop
    update public.tarifas_dia
    set factor = (v_item->>'factor')::numeric, actualizado_por_admin_id = v_admin_id
    where dia = (v_item->>'dia')::public.dia_traslado;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'certificacion_pago', '[]'::jsonb)) loop
    update public.certificacion_pago_conductor
    set porcentaje = (v_item->>'porcentaje')::numeric, actualizado_por_admin_id = v_admin_id
    where certificacion = (v_item->>'certificacion')::public.certificacion_conductor;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end loop;

  perform public.admin_ejecutar_aprobacion(p_aprobacion_id);

  return jsonb_build_object('actualizadas', v_actualizadas, 'aprobacion_id', p_aprobacion_id);
end;
$$;

-- =============================================================================
-- 10. REVOKE / GRANT
-- =============================================================================

revoke all on function public.admin_validar_aprobacion(uuid,text,text,uuid,text,jsonb) from public;
revoke all on function public.admin_ejecutar_aprobacion(uuid) from public;
revoke all on function public.admin_ajustar_precio_final(uuid,uuid,numeric) from public;
revoke all on function public.admin_ejecutar_pago(uuid,uuid,numeric) from public;
revoke all on function public.admin_cambiar_estado_traslado(uuid,text,bigint,uuid) from public;
revoke all on function public.admin_suspender_conductor(uuid,uuid,text,text) from public;
revoke all on function public.admin_sancionar_conductor(uuid,uuid,text,integer) from public;
revoke all on function public.admin_registrar_no_presentacion(uuid,uuid,integer,text) from public;
revoke all on function public.admin_registrar_cancelacion_injustificada(uuid,uuid,integer,text) from public;
revoke all on function public.admin_actualizar_politica_tarifaria_normativa(uuid,jsonb) from public;

grant execute on function public.admin_validar_aprobacion(uuid,text,text,uuid,text,jsonb) to authenticated;
grant execute on function public.admin_ejecutar_aprobacion(uuid) to authenticated;
grant execute on function public.admin_ajustar_precio_final(uuid,uuid,numeric) to authenticated;
grant execute on function public.admin_ejecutar_pago(uuid,uuid,numeric) to authenticated;
grant execute on function public.admin_cambiar_estado_traslado(uuid,text,bigint,uuid) to authenticated;
grant execute on function public.admin_suspender_conductor(uuid,uuid,text,text) to authenticated;
grant execute on function public.admin_sancionar_conductor(uuid,uuid,text,integer) to authenticated;
grant execute on function public.admin_registrar_no_presentacion(uuid,uuid,integer,text) to authenticated;
grant execute on function public.admin_registrar_cancelacion_injustificada(uuid,uuid,integer,text) to authenticated;
grant execute on function public.admin_actualizar_politica_tarifaria_normativa(uuid,jsonb) to authenticated;
