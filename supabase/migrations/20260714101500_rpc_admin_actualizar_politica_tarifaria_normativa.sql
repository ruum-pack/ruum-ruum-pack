create or replace function public.admin_actualizar_politica_tarifaria_normativa(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_item jsonb;
  v_actualizadas integer := 0;
  v_row_count integer := 0;
begin
  if not public.es_admin() then
    raise exception 'No autorizado';
  end if;

  select id into v_admin_id
  from public.admins
  where auth_user_id = auth.uid();

  if v_admin_id is null then
    raise exception 'No se encontró el admin actual';
  end if;

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

  return jsonb_build_object('actualizadas', v_actualizadas);
end;
$$;

revoke all on function public.admin_actualizar_politica_tarifaria_normativa(jsonb) from public;
grant execute on function public.admin_actualizar_politica_tarifaria_normativa(jsonb) to authenticated;

notify pgrst, 'reload schema';
