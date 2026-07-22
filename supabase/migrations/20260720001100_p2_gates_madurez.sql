-- P2 Gates: verificación explícita de capacidades y candado de aprobación dual.

-- =============================================================================
-- GATE 1 — SELECT policy en auditoria_admin_seguridad para admitir consultas
-- del dashboard con verificación explícita de auditoria:leer.
-- =============================================================================

grant select on public.auditoria_admin_seguridad to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='auditoria_admin_seguridad' and policyname='auditoria_lectura') then
    create policy auditoria_lectura on public.auditoria_admin_seguridad
      for select to authenticated
      using (public.admin_tiene_permiso('auditoria:leer'));
  end if;
end $$;

-- =============================================================================
-- GATE 2 — Candado de aprobación dual en operaciones sensibles.
-- Se modifica el CHECK de solicitudes_aprobacion_admin para admitir 'tarifas'.
-- =============================================================================

alter table public.solicitudes_aprobacion_admin
  drop constraint if exists solicitudes_aprobacion_admin_tipo_check;

alter table public.solicitudes_aprobacion_admin
  add constraint solicitudes_aprobacion_admin_tipo_check
  check (tipo in ('finanzas','sancion','tarifas'));

create or replace function public.admin_validar_y_ejecutar_aprobacion(
  p_aprobacion_id uuid,
  p_capacidad_requerida text,
  p_recurso text,
  p_recurso_id uuid,
  p_accion text
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

  update public.solicitudes_aprobacion_admin
  set estado = 'ejecutada', ejecutada_en = now(), version = version + 1
  where id = p_aprobacion_id;

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

-- Pago: necesita aprobación dual tipo 'finanzas', capacidad 'pagos:ejecutar'
create or replace function public.admin_ejecutar_pago(
  p_aprobacion_id uuid,
  p_traslado_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid;
  v_validacion jsonb;
begin
  if not public.admin_tiene_permiso('pagos:ejecutar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin from public.admins where auth_user_id = auth.uid();

  v_validacion := public.admin_validar_y_ejecutar_aprobacion(
    p_aprobacion_id, 'pagos:ejecutar', 'traslados', p_traslado_id, 'ejecutar_pago'
  );

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin, 'mutacion', 'pagos', 'ejecutar',
    jsonb_build_object('traslado_id', p_traslado_id, 'aprobacion_id', p_aprobacion_id));

  return jsonb_build_object('ejecutado', true, 'traslado_id', p_traslado_id, 'aprobacion_id', p_aprobacion_id);
end;
$$;

-- Sanción a conductor: necesita aprobación dual tipo 'sancion', capacidad 'conductores:sancionar'
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
  v_admin uuid;
  v_validacion jsonb;
begin
  if not public.admin_tiene_permiso('conductores:sancionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin from public.admins where auth_user_id = auth.uid();

  v_validacion := public.admin_validar_y_ejecutar_aprobacion(
    p_aprobacion_id, 'conductores:sancionar', 'conductores', p_conductor_id, 'sancionar'
  );

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin, 'mutacion', 'conductores', 'sancionar',
    jsonb_build_object('conductor_id', p_conductor_id, 'motivo', p_motivo,
      'dias_suspension', p_dias_suspension, 'aprobacion_id', p_aprobacion_id));

  return jsonb_build_object('ejecutado', true, 'conductor_id', p_conductor_id,
    'motivo', p_motivo, 'aprobacion_id', p_aprobacion_id);
end;
$$;

-- Edición de tarifas: reemplaza el RPC anterior para exigir aprobación dual tipo 'tarifas'
drop function if exists public.admin_actualizar_politica_tarifaria_normativa(p_payload jsonb);

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
begin
  if not public.admin_tiene_permiso('tarifas:editar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into v_admin_id
  from public.admins
  where auth_user_id = auth.uid();

  if v_admin_id is null then
    raise exception 'No se encontró el admin actual';
  end if;

  v_validacion := public.admin_validar_y_ejecutar_aprobacion(
    p_aprobacion_id, 'tarifas:editar', 'tarifas', null, 'actualizar_politica_tarifaria'
  );

  if p_payload ? 'config' then
    update public.tarifas_config
    set
      tarifa_hora = (p_payload->'config'->>'tarifa_hora')::numeric,
      tope_factor_variable = (p_payload->'config'->>'tope_factor_variable')::numeric,
      actualizado_por_admin_id = v_admin_id
    where id = true;
    get diagnostics v_row_count = row_count;
    v_actualizadas := v_actualizadas + v_row_count;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'vehiculo', '[]'::jsonb)) loop
    update public.tarifas_vehiculo
    set
      base = (v_item->>'base')::numeric,
      por_km = (v_item->>'por_km')::numeric,
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

  return jsonb_build_object('actualizadas', v_actualizadas, 'aprobacion_id', p_aprobacion_id);
end;
$$;

revoke all on function public.admin_validar_y_ejecutar_aprobacion(uuid,text,text,uuid,text) from public;
revoke all on function public.admin_ejecutar_pago(uuid,uuid) from public;
revoke all on function public.admin_sancionar_conductor(uuid,uuid,text,integer) from public;
revoke all on function public.admin_actualizar_politica_tarifaria_normativa(uuid,jsonb) from public;
grant execute on function public.admin_validar_y_ejecutar_aprobacion(uuid,text,text,uuid,text) to authenticated;
grant execute on function public.admin_ejecutar_pago(uuid,uuid) to authenticated;
grant execute on function public.admin_sancionar_conductor(uuid,uuid,text,integer) to authenticated;
grant execute on function public.admin_actualizar_politica_tarifaria_normativa(uuid,jsonb) to authenticated;
