-- RT-34 -- El conductor cierra el viaje sin resolver pagos.
--
-- La accion operativa final del conductor es cerrar el viaje desde
-- entrega_confirmada. Los cobros y cambios relacionados con pago siguen en
-- app-usuario / panel-admin / Stripe.

create or replace function public.conductor_avanza_traslado(
  p_traslado_id uuid,
  p_evento text
)
returns public.estado_traslado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_estado_actual public.estado_traslado;
  v_estado_siguiente public.estado_traslado;
  v_evento_auditoria public.evento_auditable;
begin
  select id into v_conductor_id
  from public.conductores
  where auth_user_id = auth.uid();

  if v_conductor_id is null then
    raise exception 'Solo un conductor autenticado puede avanzar el traslado.';
  end if;

  select estado into v_estado_actual
  from public.traslados
  where id = p_traslado_id
    and conductor_id = v_conductor_id
  for update;

  if v_estado_actual is null then
    raise exception 'El traslado no existe o no está asignado al conductor autenticado.';
  end if;

  case p_evento
    when 'conductor_en_camino' then
      if v_estado_actual <> 'conductor_asignado' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'conductor_en_camino_al_origen';
      v_evento_auditoria := 'modificacion_traslado_activo';

    when 'llegada_origen' then
      if v_estado_actual <> 'conductor_en_camino_al_origen' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'conductor_en_punto_de_recoleccion';
      v_evento_auditoria := 'llegada_conductor_origen';

    when 'iniciar_verificacion' then
      if v_estado_actual <> 'conductor_en_punto_de_recoleccion' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'verificacion_vehiculo_en_proceso';
      v_evento_auditoria := 'modificacion_traslado_activo';

    when 'iniciar_evidencia_inicial' then
      if v_estado_actual <> 'verificacion_vehiculo_en_proceso' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'evidencia_inicial_en_proceso';
      v_evento_auditoria := 'captura_evidencia_inicial';

    when 'evidencia_inicial_completada' then
      if v_estado_actual <> 'evidencia_inicial_en_proceso' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      if not public.traslado_tiene_metodo_pago_registrado(p_traslado_id) then
        raise exception 'No se puede completar evidencia inicial: falta pago anticipado completado o método de pago al cierre.';
      end if;
      if (
        select count(distinct angulo)
        from public.evidencia_fotos
        where traslado_id = p_traslado_id
          and tipo = 'inicial'
          and sincronizada = true
          and angulo in ('frente', 'lado_piloto', 'lado_copiloto', 'trasera', 'tablero')
      ) < 5 then
        raise exception 'Evidencia inicial incompleta.';
      end if;
      v_estado_siguiente := 'evidencia_inicial_completada';
      v_evento_auditoria := 'captura_evidencia_inicial';

    when 'vehiculo_recibido' then
      if v_estado_actual <> 'evidencia_inicial_completada' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'vehiculo_recibido';
      v_evento_auditoria := 'confirmacion_vehiculo_recibido';

    when 'iniciar_traslado' then
      if v_estado_actual <> 'vehiculo_recibido' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'traslado_en_curso';
      v_evento_auditoria := 'inicio_traslado';

    when 'llegada_destino' then
      if v_estado_actual <> 'traslado_en_curso' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'llegada_a_destino';
      v_evento_auditoria := 'llegada_destino';

    when 'iniciar_evidencia_final' then
      if v_estado_actual <> 'llegada_a_destino' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'evidencia_final_en_proceso';
      v_evento_auditoria := 'captura_evidencia_final';

    when 'evidencia_final_completada' then
      if v_estado_actual <> 'evidencia_final_en_proceso' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      if (
        select count(distinct angulo)
        from public.evidencia_fotos
        where traslado_id = p_traslado_id
          and tipo = 'final'
          and sincronizada = true
          and angulo in ('frente', 'lado_piloto', 'lado_copiloto', 'trasera', 'tablero')
      ) < 5 then
        raise exception 'Evidencia final incompleta.';
      end if;
      v_estado_siguiente := 'evidencia_final_completada';
      v_evento_auditoria := 'captura_evidencia_final';

    when 'confirmar_entrega' then
      if v_estado_actual <> 'evidencia_final_completada' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'entrega_confirmada';
      v_evento_auditoria := 'confirmacion_entrega';

    when 'cerrar_viaje' then
      if v_estado_actual <> 'entrega_confirmada' then
        raise exception 'Evento no permitido desde estado %', v_estado_actual;
      end if;
      v_estado_siguiente := 'servicio_cerrado';
      v_evento_auditoria := 'cierre_traslado';

    else
      raise exception 'Evento de conductor no soportado: %', p_evento;
  end case;

  update public.traslados
  set estado = v_estado_siguiente
  where id = p_traslado_id
    and conductor_id = v_conductor_id
    and estado = v_estado_actual;

  insert into public.registro_auditoria (
    traslado_id,
    evento,
    actor,
    actor_id,
    datos
  ) values (
    p_traslado_id,
    v_evento_auditoria,
    'conductor',
    v_conductor_id,
    jsonb_build_object(
      'evento_conductor', p_evento,
      'estado_anterior', v_estado_actual,
      'estado_nuevo', v_estado_siguiente
    )
  );

  return v_estado_siguiente;
end;
$$;

revoke all on function public.conductor_avanza_traslado(uuid, text) from public;
grant execute on function public.conductor_avanza_traslado(uuid, text) to authenticated;
