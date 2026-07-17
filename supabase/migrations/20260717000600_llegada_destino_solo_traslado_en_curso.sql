-- UX-01 -- La confirmacion de llegada a destino por conductor solo es valida
-- cuando el traslado ya esta explicitamente en curso. Los estados incompletos
-- deben resolverse por una recuperacion operativa controlada, no por esta RPC.

delete from public.estado_transiciones_validas
where (estado_actual, estado_siguiente) in (
  ('evidencia_inicial_completada', 'llegada_a_destino'),
  ('vehiculo_recibido', 'llegada_a_destino')
);

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

  if v_estado_actual <> 'traslado_en_curso' then
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
    and estado = 'traslado_en_curso';

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
