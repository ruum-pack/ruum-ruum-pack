-- UX-01 -- La confirmación manual fuera de geocerca debe quedar visible en
-- auditoría operativa para revisión y prevención de abuso.

drop function if exists public.conductor_confirmar_llegada_destino(uuid);

create or replace function public.conductor_confirmar_llegada_destino(
  p_traslado_id uuid,
  p_fuera_geocerca boolean default false,
  p_distancia_m numeric default null
)
returns public.estado_traslado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_estado_actual public.estado_traslado;
  v_distancia_m numeric;
begin
  select id into v_conductor_id
  from public.conductores
  where auth_user_id = auth.uid();

  if v_conductor_id is null then
    raise exception 'Solo un conductor autenticado puede confirmar la llegada a destino.';
  end if;

  select estado into v_estado_actual
  from public.traslados
  where id = p_traslado_id
    and conductor_id = v_conductor_id
  for update;

  if v_estado_actual is null then
    raise exception 'El traslado no existe o no está asignado al conductor autenticado.';
  end if;

  if v_estado_actual = 'llegada_a_destino' then
    return v_estado_actual;
  end if;

  if v_estado_actual not in ('evidencia_inicial_completada', 'vehiculo_recibido', 'traslado_en_curso') then
    raise exception 'No se puede confirmar llegada a destino desde estado %', v_estado_actual;
  end if;

  if p_distancia_m is not null and p_distancia_m < 0 then
    raise exception 'La distancia de geocerca no puede ser negativa.';
  end if;

  v_distancia_m := case
    when p_distancia_m is null then null
    else round(p_distancia_m)
  end;

  update public.traslados
  set estado = 'llegada_a_destino'
  where id = p_traslado_id
    and conductor_id = v_conductor_id
    and estado = v_estado_actual;

  if not found then
    raise exception 'No se pudo confirmar la llegada a destino. Intenta de nuevo.';
  end if;

  insert into public.registro_auditoria (
    traslado_id,
    evento,
    actor,
    actor_id,
    datos
  ) values (
    p_traslado_id,
    'llegada_destino',
    'conductor',
    v_conductor_id,
    jsonb_build_object(
      'accion', 'conductor_confirmar_llegada_destino',
      'estado_anterior', v_estado_actual,
      'estado_nuevo', 'llegada_a_destino',
      'transicion_atomica', true,
      'fuera_geocerca', coalesce(p_fuera_geocerca, false),
      'distancia_m', v_distancia_m
    )
  );

  return 'llegada_a_destino';
end;
$$;

revoke all on function public.conductor_confirmar_llegada_destino(uuid, boolean, numeric) from public;
grant execute on function public.conductor_confirmar_llegada_destino(uuid, boolean, numeric) to authenticated;
