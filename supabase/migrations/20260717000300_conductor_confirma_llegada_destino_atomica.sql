-- UX-01 -- La acción "He llegado" en destino no debe encadenar varias
-- transiciones desde la UI. Esta RPC concentra la intención operativa en el
-- backend, valida conductor/estado y deja un solo evento auditable.

insert into public.estado_transiciones_validas (estado_actual, estado_siguiente)
values
  ('evidencia_inicial_completada', 'llegada_a_destino'),
  ('vehiculo_recibido', 'llegada_a_destino')
on conflict do nothing;

create or replace function public.conductor_confirmar_llegada_destino(
  p_traslado_id uuid
)
returns public.estado_traslado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_estado_actual public.estado_traslado;
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
      'transicion_atomica', true
    )
  );

  return 'llegada_a_destino';
end;
$$;

revoke all on function public.conductor_confirmar_llegada_destino(uuid) from public;
grant execute on function public.conductor_confirmar_llegada_destino(uuid) to authenticated;
