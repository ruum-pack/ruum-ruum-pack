-- A1 — Coherencia entre `usuario_cancela_traslado` y la máquina de estados.
--
-- Bug: la RPC de 0033 permitía cancelar desde CUALQUIER estado que no fuera
-- terminal (v_estado not in servicio_cerrado/servicio_cancelado/traslado_fallido)
-- y hacía `update … set estado='servicio_cancelado'`. Pero el trigger
-- `validar_transicion_traslado` (0005) solo acepta la transición
-- `<estado> -> servicio_cancelado` desde los 8 estados listados en
-- `estado_transiciones_validas`. En estados intermedios como
-- conductor_en_camino_al_origen, verificacion_vehiculo_en_proceso,
-- evidencia_inicial_en_proceso o traslado_en_curso, la RPC pasaba su propio
-- guard pero el trigger abortaba con «Transición de estado inválida»,
-- haciendo rollback de la cancelación Y del cargo ya calculado.
--
-- Decisión de producto (2026-07-09): el usuario puede cancelar hasta
-- `conductor_en_punto_de_recoleccion` inclusive (los 8 estados que la tabla
-- ya contempla). Una vez que arranca la verificación/evidencia del vehículo,
-- ya no es una cancelación: es disputa (servicio_cerrado -> disputa_abierta)
-- o traslado fallido (vía admin_marca_traslado_fallido).
--
-- Por eso NO se amplía `estado_transiciones_validas`: ya es correcta. Lo que
-- se corrige es el guard de la RPC, que deja de tener su propia lista y pasa
-- a consultar la MISMA tabla que usa el trigger — así RPC y trigger comparten
-- una sola fuente de verdad y nunca vuelven a divergir. El mensaje de error
-- deja de ser el críptico del trigger y explica el estado real.

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

  -- Fuente de verdad única: la MISMA tabla que valida el trigger de 0005.
  -- Si no existe el par (estado_actual, 'servicio_cancelado'), este estado no
  -- admite cancelación por el usuario — se responde con un mensaje claro en
  -- vez de dejar que el trigger reviente la transacción más adelante.
  if not exists (
    select 1
    from public.estado_transiciones_validas
    where estado_actual = v_estado
      and estado_siguiente = 'servicio_cancelado'
  ) then
    raise exception
      'Este traslado ya no puede cancelarse en el estado "%". Cuando el vehículo ya está en verificación o en tránsito, usa una disputa o reporta una incidencia.',
      v_estado
      using errcode = 'check_violation';
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

-- Grants sin cambios respecto a 0033 (create or replace conserva permisos,
-- pero se reafirman por claridad e idempotencia).
revoke all on function public.usuario_cancela_traslado(uuid, text, numeric, numeric, text) from public;
grant execute on function public.usuario_cancela_traslado(uuid, text, numeric, numeric, text) to authenticated;
