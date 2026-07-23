-- =============================================================================
-- Vehículos: versión para concurrencia optimista + actualizado_en + auditoría
-- =============================================================================

-- 1. Agregar columnas de control concurrente
alter table public.vehiculos
  add column if not exists version bigint not null default 0,
  add column if not exists actualizado_en timestamptz not null default now();

create trigger vehiculos_actualizado_en
  before update on public.vehiculos
  for each row execute function public.set_actualizado_en();

-- 2. Agregar evento de auditoría para operaciones sobre vehículos
alter type public.evento_auditable add value if not exists 'modificacion_vehiculo';
alter type public.evento_auditable add value if not exists 'consulta_evidencia_vehiculo';

-- 3. Función RPC: admin_actualizar_vehiculo — actualización con optimistic locking
-- y auditoría en una sola transacción
create or replace function public.admin_actualizar_vehiculo(
  p_vehiculo_id uuid,
  p_datos jsonb,
  p_version_esperada bigint
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_version_actual bigint;
  v_campos_actualizados text[];
  v_key text;
begin
  if not public.admin_tiene_permiso('conductores:gestionar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select id into strict v_admin_id from public.admins where auth_user_id = auth.uid();

  select version into v_version_actual
  from public.vehiculos where id = p_vehiculo_id
  for update;

  if not found then
    raise exception using errcode='42501', message='VEHICULO_NO_ENCONTRADO';
  end if;

  if v_version_actual != p_version_esperada then
    raise exception using errcode='P0001',
      message='CONCURRENCY_CONFLICT: el vehículo fue modificado por otro operador. Versión actual: ' || v_version_actual || ', esperada: ' || p_version_esperada;
  end if;

  -- Construir SET dinámico solo con campos permitidos
  for v_key in select jsonb_object_keys(p_datos)
  loop
    if v_key in ('tiene_tarjeta_circulacion', 'tiene_verificacion', 'tiene_placas',
                 'permiso_especial_vigente', 'puede_circular_rodando',
                 'transmision', 'color', 'placas', 'vin',
                 'estado_general_declarado', 'categoria_tarifa', 'gama', 'condicion',
                 'tipo', 'marca', 'modelo', 'anio') then
      v_campos_actualizados := array_append(v_campos_actualizados, v_key);
    end if;
  end loop;

  if array_length(v_campos_actualizados, 1) is null then
    raise exception using errcode='P0001', message='SIN_CAMPOS_VALIDOS: no hay campos actualizables en los datos enviados';
  end if;

  execute format(
    'update public.vehiculos set %s, version = %s where id = %L',
    (
      select string_agg(format('%I = %L', v_key, p_datos ->> v_key), ', ')
      from unnest(v_campos_actualizados) as v_key
    ),
    v_version_actual + 1,
    p_vehiculo_id
  );

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, tipo, recurso, accion, datos)
  values (auth.uid(), v_admin_id, 'mutacion', 'vehiculos', 'actualizar',
    jsonb_build_object(
      'vehiculo_id', p_vehiculo_id,
      'campos_actualizados', to_jsonb(v_campos_actualizados),
      'version_anterior', v_version_actual,
      'version_nueva', v_version_actual + 1
    ));

  return jsonb_build_object('ejecutado', true, 'vehiculo_id', p_vehiculo_id, 'version', v_version_actual + 1);
end;
$$;

revoke all on function public.admin_actualizar_vehiculo(uuid,jsonb,bigint) from public;
grant execute on function public.admin_actualizar_vehiculo(uuid,jsonb,bigint) to authenticated;

-- 4. Función RPC: admin_obtener_evidencia_vehiculo — obtiene fotos de evidencia
-- para un vehículo a través de sus traslados
create or replace function public.admin_obtener_evidencia_vehiculo(
  p_vehiculo_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_evidencia jsonb;
begin
  if not public.admin_tiene_permiso('viajes:leer') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'traslado_id', t.id,
      'traslado_estado', t.estado,
      'fotos', (
        select jsonb_agg(
          jsonb_build_object(
            'id', ef.id,
            'tipo', ef.tipo,
            'angulo', ef.angulo,
            'url', ef.url,
            'capturada_en', ef.capturada_en,
            'sincronizada', ef.sincronizada
          ) order by ef.capturada_en desc
        )
        from public.evidencia_fotos ef
        where ef.traslado_id = t.id
      )
    ) order by t.creado_en desc
  ) into v_evidencia
  from public.traslados t
  where t.vehiculo_id = p_vehiculo_id;

  return coalesce(v_evidencia, '[]'::jsonb);
end;
$$;

revoke all on function public.admin_obtener_evidencia_vehiculo(uuid) from public;
grant execute on function public.admin_obtener_evidencia_vehiculo(uuid) to authenticated;

-- 5. Índice para búsqueda eficiente de traslados por vehículo
create index if not exists traslados_vehiculo_id_idx on public.traslados (vehiculo_id);
