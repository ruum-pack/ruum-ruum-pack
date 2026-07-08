-- Datos de ejemplo para desarrollo local / QA manual en Supabase Studio.
-- No representa datos reales de producción. Cubre el ciclo completo:
-- usuario -> vehículo -> conductor -> traslado -> evidencia -> pago ->
-- calificación, para poder explorar la vista pasaporte_digital de inmediato
-- después de `pnpm db:reset`.

insert into public.admins (auth_user_id, nombre)
values (null, 'Admin Demo (sin auth_user_id — solo para QA visual en Studio local)')
on conflict do nothing;

do $$
declare
  v_usuario_id    uuid;
  v_vehiculo_id   uuid;
  v_conductor_id  uuid;
  v_traslado_id   uuid;
begin
  insert into public.usuarios (tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
  values ('personal', 'personal', 'verificado', true)
  returning id into v_usuario_id;

  insert into public.vehiculos (
    usuario_id, tipo, marca, modelo, anio,
    tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando
  )
  values (v_usuario_id, 'sedan', 'Nissan', 'Versa', 2022, true, true, true, true)
  returning id into v_vehiculo_id;

  insert into public.conductores (
    nombre, estado, nivel_por_experiencia, nivel_por_calificacion,
    calificacion_promedio, traslados_completados, documentos_vigentes
  )
  values ('Conductor Demo', 'activo', 'ejecutivo', 'ejecutivo', 4.6, 12, true)
  returning id into v_conductor_id;

  insert into public.traslados (
    estado, usuario_id, vehiculo_id, conductor_id,
    contacto_entrega_nombre, contacto_entrega_telefono,
    contacto_recepcion_nombre, contacto_recepcion_telefono,
    origen_lat, origen_lng, origen_direccion, origen_ciudad,
    destino_lat, destino_lng, destino_direccion, destino_ciudad,
    precio_cotizado, precio_final, tipo_pago
  )
  values (
    'pago_completado', v_usuario_id, v_vehiculo_id, v_conductor_id,
    'Juan Pérez', '5551234567',
    'Ana López', '5557654321',
    19.4326, -99.1332, 'CDMX Centro', 'Ciudad de México',
    19.0414, -98.2063, 'Puebla Centro', 'Puebla',
    1500.00, 1500.00, 'anticipado'
  )
  returning id into v_traslado_id;

  insert into public.evidencia_fotos (traslado_id, tipo, angulo, url, sincronizada)
  values
    (v_traslado_id, 'inicial', 'frente', 'https://demo.local/inicial-frente.jpg', true),
    (v_traslado_id, 'inicial', 'lado_piloto', 'https://demo.local/inicial-piloto.jpg', true),
    (v_traslado_id, 'inicial', 'lado_copiloto', 'https://demo.local/inicial-copiloto.jpg', true),
    (v_traslado_id, 'inicial', 'trasera', 'https://demo.local/inicial-trasera.jpg', true),
    (v_traslado_id, 'inicial', 'tablero', 'https://demo.local/inicial-tablero.jpg', true);

  insert into public.pagos (traslado_id, monto, momento, estado, metodo)
  values (v_traslado_id, 1500.00, 'anticipado', 'completado', 'tarjeta');

  -- Dispara el trigger de recalcular_calificacion_conductor (migración 0009):
  -- después de este insert, conductores.calificacion_promedio para
  -- v_conductor_id debe quedar en 5.00.
  insert into public.calificaciones_traslado (traslado_id, conductor_id, estrellas, comentario)
  values (v_traslado_id, v_conductor_id, 5, 'Excelente servicio, muy puntual.');
end $$;
