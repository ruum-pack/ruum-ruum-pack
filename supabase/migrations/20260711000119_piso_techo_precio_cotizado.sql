-- Sprint 3 (auditoría 2026-07-11) — pone un piso/techo de cordura al precio
-- cotizado de un traslado.
--
-- Hallazgo: para pago "anticipado" (el que aplica justo a los usuarios sin
-- historial, los de más riesgo), la Edge Function crear-payment-intent cobra
-- con `precio_final ?? precio_cotizado`. precio_final solo lo toca un admin
-- después (ajuste manual desde panel-admin); en el momento del cobro
-- anticipado siempre es null. O sea: hoy el monto real que Stripe le cobra a
-- la tarjeta de un usuario nuevo es el número que ÉL MISMO escribió en el
-- formulario, sin revisión de nadie de por medio.
--
-- Piso: $699 MXN (decisión de producto, 2026-07-11). Techo: $100,000 MXN,
-- anti-typo más que anti-fraude (no hay control de km/ruta real todavía).
--
-- De regalo: ya existía `tarifas_admin` (base/por_km/minima por tipo de
-- vehículo) pero no la usa ni un solo .ts del repo y no tiene datos
-- sembrados en ningún ambiente — así que NO se vuelve el único mecanismo
-- (eso dejaría el candado en cero hasta que operaciones la pueble). Se usa
-- de forma oportunista: si hay una tarifa activa para el tipo de vehículo,
-- su `minima` puede subir el piso por encima de $699, nunca bajarlo.
create or replace function public.usuario_crea_traslado(
  p_vehiculo_id uuid,
  p_vehiculo jsonb,
  p_traslado jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_vehiculo_id uuid;
  v_tipo_vehiculo public.tipo_vehiculo;
  v_traslado_id uuid;
  v_anio int;
  v_anio_maximo int := extract(year from now())::int + 1;
  v_precio numeric;
  v_piso numeric;
  v_piso_base constant numeric := 699;
  v_techo constant numeric := 100000;
  v_tarifa_minima numeric;
begin
  select id into v_usuario_id from public.usuarios where auth_user_id = auth.uid();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario autenticado.';
  end if;

  if p_vehiculo_id is not null then
    -- Reutiliza un vehículo guardado: candado de propiedad. Antes de la
    -- migración 118 esto NO se validaba en ningún lado (ni RLS ni servicio TS).
    select id, tipo into v_vehiculo_id, v_tipo_vehiculo
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

  -- Piso oportunista: si hay una tarifa activa configurada para este tipo
  -- de vehículo, su `minima` puede subir el piso de $699, nunca bajarlo.
  -- Hoy tarifas_admin está vacía en todo ambiente, así que esto no hace
  -- nada todavía — pero en cuanto operaciones la pueble, empieza a proteger
  -- sin tocar código de nuevo.
  select minima into v_tarifa_minima
  from public.tarifas_admin
  where tipo_vehiculo = v_tipo_vehiculo and activa
  order by actualizado_en desc
  limit 1;

  v_piso := greatest(v_piso_base, coalesce(v_tarifa_minima, 0));

  v_precio := (p_traslado->>'precio_cotizado')::numeric;
  if v_precio is null or v_precio < v_piso then
    raise exception 'El precio cotizado debe ser de al menos $% MXN para este tipo de vehículo.', v_piso;
  end if;
  if v_precio > v_techo then
    raise exception 'El precio cotizado no puede superar $% MXN. Si es un traslado real por ese monto, contacta a soporte.', v_techo;
  end if;

  insert into public.traslados (
    usuario_id, vehiculo_id, estado,
    contacto_entrega_nombre, contacto_entrega_telefono,
    contacto_recepcion_nombre, contacto_recepcion_telefono,
    origen_lat, origen_lng, origen_direccion, origen_ciudad, origen_referencias,
    destino_lat, destino_lng, destino_direccion, destino_ciudad, destino_referencias,
    instrucciones_especiales, modalidad_programacion, fecha_hora_programada,
    tipo_ruta, ventana_recoleccion, ventana_entrega, tipo_servicio, motivo_servicio,
    precio_cotizado, tipo_pago
  ) values (
    v_usuario_id, v_vehiculo_id, 'solicitud_creada',
    p_traslado->>'contacto_entrega_nombre',
    p_traslado->>'contacto_entrega_telefono',
    p_traslado->>'contacto_recepcion_nombre',
    p_traslado->>'contacto_recepcion_telefono',
    coalesce((p_traslado->>'origen_lat')::numeric, 0),
    coalesce((p_traslado->>'origen_lng')::numeric, 0),
    p_traslado->>'origen_direccion',
    p_traslado->>'origen_ciudad',
    p_traslado->>'origen_referencias',
    coalesce((p_traslado->>'destino_lat')::numeric, 0),
    coalesce((p_traslado->>'destino_lng')::numeric, 0),
    p_traslado->>'destino_direccion',
    p_traslado->>'destino_ciudad',
    p_traslado->>'destino_referencias',
    p_traslado->>'instrucciones_especiales',
    p_traslado->>'modalidad_programacion',
    nullif(p_traslado->>'fecha_hora_programada', '')::timestamptz,
    p_traslado->>'tipo_ruta',
    p_traslado->>'ventana_recoleccion',
    p_traslado->>'ventana_entrega',
    p_traslado->>'tipo_servicio',
    p_traslado->>'motivo_servicio',
    v_precio,
    (p_traslado->>'tipo_pago')::public.tipo_pago
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
      'tipo_pago', p_traslado->>'tipo_pago',
      'piso_aplicado', v_piso
    )
  );

  return v_traslado_id;
end;
$$;

revoke all on function public.usuario_crea_traslado(uuid, jsonb, jsonb) from public;
grant execute on function public.usuario_crea_traslado(uuid, jsonb, jsonb) to authenticated;
