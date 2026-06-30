-- Cancelación de usuario controlada: el cliente no tiene UPDATE libre sobre
-- traslados ni INSERT sobre pagos. Esta RPC solo permite cancelar traslados
-- propios y registra el cargo calculado por la capa de reglas compartidas.

create or replace function public.usuario_cancela_traslado(
  p_traslado_id uuid,
  p_motivo text,
  p_porcentaje_cargo numeric,
  p_monto_cargo numeric,
  p_mensaje text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_estado public.estado_traslado;
begin
  select id into v_usuario_id
  from public.usuarios
  where auth_user_id = auth.uid();

  if v_usuario_id is null then
    raise exception 'Solo un usuario autenticado puede cancelar su traslado.';
  end if;

  select estado into v_estado
  from public.traslados
  where id = p_traslado_id
    and usuario_id = v_usuario_id
  for update;

  if v_estado is null then
    raise exception 'El traslado no existe o no pertenece al usuario autenticado.';
  end if;

  if v_estado in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido') then
    raise exception 'El traslado ya no puede cancelarse desde el estado %', v_estado;
  end if;

  update public.traslados
  set estado = 'servicio_cancelado'
  where id = p_traslado_id
    and usuario_id = v_usuario_id
    and estado = v_estado;

  if coalesce(p_monto_cargo, 0) > 0 then
    insert into public.pagos (
      traslado_id,
      monto,
      momento,
      estado,
      metodo
    ) values (
      p_traslado_id,
      p_monto_cargo,
      'al_cierre',
      'pendiente',
      'cargo_cancelacion'
    );
  end if;

  insert into public.registro_auditoria (
    traslado_id,
    evento,
    actor,
    actor_id,
    datos
  ) values (
    p_traslado_id,
    'cancelacion_traslado',
    'usuario',
    v_usuario_id,
    jsonb_build_object(
      'motivo', p_motivo,
      'estado_anterior', v_estado,
      'estado_nuevo', 'servicio_cancelado',
      'porcentaje_cargo', p_porcentaje_cargo,
      'monto_cargo', p_monto_cargo,
      'mensaje_confirmacion', p_mensaje
    )
  );
end;
$$;

revoke all on function public.usuario_cancela_traslado(uuid, text, numeric, numeric, text) from public;
grant execute on function public.usuario_cancela_traslado(uuid, text, numeric, numeric, text) to authenticated;
