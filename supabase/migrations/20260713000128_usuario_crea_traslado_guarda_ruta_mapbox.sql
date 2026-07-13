-- Guarda la ruta calculada por Mapbox Directions durante la creación del traslado.
--
-- Las columnas ya existen desde RT-12 (20260713000126); esta migración solo
-- conecta el RPC de creación de app-usuario con esos campos para que Torre de
-- Control pueda sugerir tarifa sin capturar distancia/tiempo desde cero.

comment on column public.traslados.distancia_km is
  'Distancia de ruta (no línea recta) estimada con Mapbox Directions al crear el traslado; Torre de Control puede recalcularla antes de cotizar.';
comment on column public.traslados.tiempo_estimado_horas is
  'Tiempo estimado de ruta con Mapbox Directions al crear el traslado; Torre de Control puede recalcularlo antes de cotizar.';

create or replace function public.usuario_crea_traslado(
  p_vehiculo_id uuid,
  p_vehiculo jsonb,
  p_traslado jsonb,
  p_clave_idempotencia uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_estado_verificacion public.estado_verificacion;
  v_tipo_pago public.tipo_pago;
  v_vehiculo_id uuid;
  v_tipo_vehiculo public.tipo_vehiculo;
  v_traslado_id uuid;
  v_anio int;
  v_anio_maximo int := extract(year from now())::int + 1;
  v_presupuesto numeric;
  v_modalidad text;
  v_fecha_programada timestamptz;
  v_tiene_tarjeta boolean;
  v_tiene_verificacion boolean;
  v_tiene_placas boolean;
  v_puede_circular boolean;
  v_distancia_km numeric;
  v_tiempo_estimado_horas numeric;
begin
  select id, estado_verificacion
  into v_usuario_id, v_estado_verificacion
  from public.usuarios
  where auth_user_id = auth.uid();
  if v_usuario_id is null then
    raise exception 'Usuario no encontrado';
  end if;

  if v_estado_verificacion <> 'verificado' then
    raise exception 'Tu cuenta debe estar verificada para solicitar un traslado';
  end if;

  if p_clave_idempotencia is null then raise exception 'La clave de idempotencia es obligatoria'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_usuario_id::text || p_clave_idempotencia::text, 0));
  select id, tipo_pago into v_traslado_id, v_tipo_pago
  from public.traslados where usuario_id = v_usuario_id and clave_idempotencia = p_clave_idempotencia;
  if v_traslado_id is not null then
    return jsonb_build_object('id', v_traslado_id, 'tipo_pago', v_tipo_pago);
  end if;

  v_tipo_pago := public.determinar_tipo_pago_usuario(v_usuario_id);
  v_modalidad := p_traslado->>'modalidad_programacion';
  if v_modalidad not in ('lo_antes_posible', 'programado') then raise exception 'Modalidad de programación inválida'; end if;
  v_fecha_programada := nullif(p_traslado->>'fecha_hora_programada', '')::timestamptz;
  if v_modalidad = 'programado' then
    if v_fecha_programada is null then raise exception 'La fecha programada es obligatoria'; end if;
    if v_fecha_programada < now() + interval '2 hours' then raise exception 'La fecha no cumple con la anticipación mínima de 2 horas'; end if;
  elsif v_fecha_programada is not null then
    raise exception 'La modalidad inmediata no admite fecha programada';
  end if;

  if p_vehiculo_id is not null then
    select id, tipo, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando
    into v_vehiculo_id, v_tipo_vehiculo, v_tiene_tarjeta, v_tiene_verificacion, v_tiene_placas, v_puede_circular
    from public.vehiculos
    where id = p_vehiculo_id
      and usuario_id = v_usuario_id;

    if v_vehiculo_id is null then
      raise exception 'El vehículo indicado no existe o no pertenece al usuario.';
    end if;
  else
    if p_vehiculo is null then
      raise exception 'Debes indicar un vehículo guardado (p_vehiculo_id) o los datos de un vehículo nuevo (p_vehiculo).';
    end if;

    v_anio := (p_vehiculo->>'anio')::int;
    if v_anio is null or v_anio < 1980 or v_anio > v_anio_maximo then
      raise exception 'El año del vehículo debe ser un número entre 1980 y %.', v_anio_maximo;
    end if;

    v_tipo_vehiculo := (p_vehiculo->>'tipo')::public.tipo_vehiculo;
    v_tiene_tarjeta := coalesce((p_vehiculo->>'tiene_tarjeta_circulacion')::boolean, false);
    v_tiene_verificacion := coalesce((p_vehiculo->>'tiene_verificacion')::boolean, false);
    v_tiene_placas := coalesce((p_vehiculo->>'tiene_placas')::boolean, false);
    v_puede_circular := coalesce((p_vehiculo->>'puede_circular_rodando')::boolean, false);

    insert into public.vehiculos (
      usuario_id, tipo, transmision, marca, modelo, anio, color, placas, vin,
      estado_general_declarado, tiene_tarjeta_circulacion, tiene_verificacion,
      tiene_placas, puede_circular_rodando
    ) values (
      v_usuario_id,
      v_tipo_vehiculo,
      p_vehiculo->>'transmision',
      p_vehiculo->>'marca',
      p_vehiculo->>'modelo',
      v_anio,
      p_vehiculo->>'color',
      p_vehiculo->>'placas',
      p_vehiculo->>'vin',
      p_vehiculo->>'estado_general_declarado',
      coalesce((p_vehiculo->>'tiene_tarjeta_circulacion')::boolean, false),
      coalesce((p_vehiculo->>'tiene_verificacion')::boolean, false),
      coalesce((p_vehiculo->>'tiene_placas')::boolean, false),
      coalesce((p_vehiculo->>'puede_circular_rodando')::boolean, false)
    )
    returning id into v_vehiculo_id;
  end if;

  if not (v_tiene_tarjeta and v_tiene_verificacion and v_tiene_placas and v_puede_circular) then
    raise exception 'El MVP solo admite vehículos que encienden, tienen documentación vigente y pueden circular rodando';
  end if;

  v_presupuesto := nullif(p_traslado->>'presupuesto_usuario', '')::numeric;
  if v_presupuesto is not null and v_presupuesto <= 0 then
    raise exception 'El presupuesto aproximado debe ser mayor a cero.';
  end if;

  v_distancia_km := nullif(p_traslado->>'distancia_km', '')::numeric;
  v_tiempo_estimado_horas := nullif(p_traslado->>'tiempo_estimado_horas', '')::numeric;
  if (v_distancia_km is null) <> (v_tiempo_estimado_horas is null) then
    raise exception 'La distancia y el tiempo estimado de ruta deben enviarse juntos.';
  end if;
  if v_distancia_km is not null and (v_distancia_km < 0 or v_distancia_km > 20000) then
    raise exception 'La distancia estimada de ruta es inválida.';
  end if;
  if v_tiempo_estimado_horas is not null and (v_tiempo_estimado_horas < 0 or v_tiempo_estimado_horas > 720) then
    raise exception 'El tiempo estimado de ruta es inválido.';
  end if;

  insert into public.traslados (
    usuario_id, vehiculo_id, estado,
    contacto_entrega_nombre, contacto_entrega_telefono,
    contacto_recepcion_nombre, contacto_recepcion_telefono,
    origen_lat, origen_lng, origen_direccion, origen_ciudad, origen_referencias,
    destino_lat, destino_lng, destino_direccion, destino_ciudad, destino_referencias,
    instrucciones_especiales, modalidad_programacion, fecha_hora_programada,
    tipo_ruta, ventana_recoleccion, ventana_entrega, tipo_servicio, motivo_servicio,
    presupuesto_usuario, precio_cotizado, precio_final, tipo_pago, clave_idempotencia,
    distancia_km, tiempo_estimado_horas
  ) values (
    v_usuario_id, v_vehiculo_id, 'solicitud_creada',
    p_traslado->>'contacto_entrega_nombre',
    p_traslado->>'contacto_entrega_telefono',
    p_traslado->>'contacto_recepcion_nombre',
    p_traslado->>'contacto_recepcion_telefono',
    nullif(p_traslado->>'origen_lat', '')::numeric,
    nullif(p_traslado->>'origen_lng', '')::numeric,
    p_traslado->>'origen_direccion',
    p_traslado->>'origen_ciudad',
    p_traslado->>'origen_referencias',
    nullif(p_traslado->>'destino_lat', '')::numeric,
    nullif(p_traslado->>'destino_lng', '')::numeric,
    p_traslado->>'destino_direccion',
    p_traslado->>'destino_ciudad',
    p_traslado->>'destino_referencias',
    p_traslado->>'instrucciones_especiales',
    p_traslado->>'modalidad_programacion',
    v_fecha_programada,
    p_traslado->>'tipo_ruta',
    p_traslado->>'ventana_recoleccion',
    p_traslado->>'ventana_entrega',
    p_traslado->>'tipo_servicio',
    p_traslado->>'motivo_servicio',
    v_presupuesto, null, null, v_tipo_pago, p_clave_idempotencia,
    v_distancia_km, v_tiempo_estimado_horas
  )
  returning id into v_traslado_id;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    v_traslado_id,
    'creacion_solicitud_traslado',
    'usuario',
    v_usuario_id,
    jsonb_build_object(
      'vehiculo_id', v_vehiculo_id,
      'vehiculo_reutilizado', p_vehiculo_id is not null,
      'tipo_pago', v_tipo_pago,
      'presupuesto_usuario', v_presupuesto,
      'distancia_km', v_distancia_km,
      'tiempo_estimado_horas', v_tiempo_estimado_horas
    )
  );

  return jsonb_build_object('id', v_traslado_id, 'tipo_pago', v_tipo_pago);
end;
$$;

revoke all on function public.usuario_crea_traslado(uuid, jsonb, jsonb, uuid) from public;
grant execute on function public.usuario_crea_traslado(uuid, jsonb, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';
