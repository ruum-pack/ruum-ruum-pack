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

-- Dataset amplio para QA de listados, filtros y flujos operativos.
-- Crea 10 usuarios "Seed Usuario NN"; cada usuario tiene 2 automóviles y
-- 2 viajes. También crea 10 conductores "Seed Conductor NN".
-- Es idempotente: al volver a ejecutar, elimina solo los registros seed-*.
do $$
declare
  v_usuario_id     uuid;
  v_vehiculo_1_id  uuid;
  v_vehiculo_2_id  uuid;
  v_conductor_ids  uuid[] := '{}';
  v_marcas         text[] := array['Nissan', 'Volkswagen', 'Toyota', 'Honda', 'Mazda', 'Kia', 'Hyundai', 'Chevrolet', 'Ford', 'BMW'];
  v_modelos_a      text[] := array['Versa', 'Jetta', 'Corolla', 'Civic', 'Mazda 3', 'Rio', 'Elantra', 'Aveo', 'Focus', 'Serie 3'];
  v_modelos_b      text[] := array['Kicks', 'Taos', 'RAV4', 'CR-V', 'CX-5', 'Sportage', 'Tucson', 'Tracker', 'Escape', 'X3'];
  v_ciudades       text[] := array['Ciudad de Mexico', 'Puebla', 'Queretaro', 'Toluca', 'Cuernavaca', 'Guadalajara', 'Leon', 'Morelia', 'Veracruz', 'San Luis Potosi'];
  v_estados        text[] := array['Ciudad de Mexico', 'Puebla', 'Queretaro', 'Estado de Mexico', 'Morelos', 'Jalisco', 'Guanajuato', 'Michoacan', 'Veracruz', 'San Luis Potosi'];
  v_estados_viaje  public.estado_traslado[] := array[
    'pendiente_de_conductor',
    'conductor_asignado',
    'conductor_en_camino_al_origen',
    'traslado_en_curso',
    'pago_completado',
    'servicio_cerrado',
    'documentacion_en_revision',
    'cotizacion_generada',
    'servicio_confirmado',
    'entrega_confirmada'
  ]::public.estado_traslado[];
  i int;
  v_conductor_id uuid;
begin
  delete from public.traslados t
  using public.usuarios u
  where t.usuario_id = u.id
    and u.nombre like 'Seed Usuario %';

  delete from public.vehiculos v
  using public.usuarios u
  where v.usuario_id = u.id
    and u.nombre like 'Seed Usuario %';

  delete from public.usuarios
  where nombre like 'Seed Usuario %';

  delete from public.conductores
  where nombre like 'Seed Conductor %';

  for i in 1..10 loop
    insert into public.conductores (
      nombre,
      telefono,
      estado,
      nivel_por_experiencia,
      nivel_por_calificacion,
      calificacion_promedio,
      traslados_completados,
      documentos_vigentes
    )
    values (
      format('Seed Conductor %s', lpad(i::text, 2, '0')),
      format('+52550000%s', lpad(i::text, 4, '0')),
      case when i = 10 then 'modo_prueba_supervisada'::public.estado_conductor else 'activo'::public.estado_conductor end,
      case
        when i in (1, 2) then 'basico'::public.nivel_concer
        when i in (3, 4, 5, 6) then 'ejecutivo'::public.nivel_concer
        when i in (7, 8, 9) then 'luxury'::public.nivel_concer
        else 'coleccion'::public.nivel_concer
      end,
      case
        when i in (1, 2) then 'basico'::public.nivel_concer
        when i in (3, 4, 5, 6) then 'ejecutivo'::public.nivel_concer
        when i in (7, 8, 9) then 'luxury'::public.nivel_concer
        else 'ejecutivo'::public.nivel_concer
      end,
      round((4.10 + (i * 0.08))::numeric, 2),
      6 + (i * 3),
      true
    )
    returning id into v_conductor_id;

    v_conductor_ids := array_append(v_conductor_ids, v_conductor_id);
  end loop;

  for i in 1..10 loop
    insert into public.usuarios (
      nombre,
      telefono,
      tipo_cuenta,
      rol,
      estado_verificacion,
      metodo_pago_registrado,
      traslados_completados_sin_incidencia,
      pais,
      estado,
      codigo_postal,
      ciudad,
      colonia,
      calle,
      numero,
      referencias,
      direccion_principal,
      version_terminos_aceptada,
      terminos_aceptados_en
    )
    values (
      format('Seed Usuario %s', lpad(i::text, 2, '0')),
      format('+52551111%s', lpad(i::text, 4, '0')),
      'personal',
      'personal',
      'verificado',
      true,
      i,
      'Mexico',
      v_estados[i],
      format('0%s', 6000 + i),
      v_ciudades[i],
      format('Colonia Seed %s', lpad(i::text, 2, '0')),
      format('Calle Semilla %s', i),
      (100 + i)::text,
      'Referencia de acceso para QA',
      format('Calle Semilla %s %s, %s', i, 100 + i, v_ciudades[i]),
      1,
      now() - interval '10 days'
    )
    returning id into v_usuario_id;

    insert into public.vehiculos (
      usuario_id,
      tipo,
      marca,
      modelo,
      anio,
      tiene_tarjeta_circulacion,
      tiene_verificacion,
      tiene_placas,
      puede_circular_rodando,
      alias,
      color,
      placas,
      vin,
      transmision,
      estado_general_declarado
    )
    values (
      v_usuario_id,
      'sedan',
      v_marcas[i],
      v_modelos_a[i],
      2018 + (i % 6),
      true,
      true,
      true,
      true,
      'Auto principal',
      case when i % 2 = 0 then 'Blanco' else 'Gris' end,
      format('QA%sA%s', lpad(i::text, 2, '0'), i),
      'SEEDVIN' || lpad(i::text, 10, '0') || 'A',
      case when i % 2 = 0 then 'automatica' else 'manual' end,
      'Operable, sin testigos activos'
    )
    returning id into v_vehiculo_1_id;

    insert into public.vehiculos (
      usuario_id,
      tipo,
      marca,
      modelo,
      anio,
      tiene_tarjeta_circulacion,
      tiene_verificacion,
      tiene_placas,
      puede_circular_rodando,
      alias,
      color,
      placas,
      vin,
      transmision,
      estado_general_declarado
    )
    values (
      v_usuario_id,
      case when i in (7, 8, 9, 10) then 'luxury'::public.tipo_vehiculo else 'suv'::public.tipo_vehiculo end,
      v_marcas[i],
      v_modelos_b[i],
      2019 + (i % 5),
      true,
      true,
      true,
      true,
      'Auto secundario',
      case when i % 2 = 0 then 'Negro' else 'Azul' end,
      format('QA%sB%s', lpad(i::text, 2, '0'), i),
      'SEEDVIN' || lpad(i::text, 10, '0') || 'B',
      'automatica',
      'Operable, documentacion vigente'
    )
    returning id into v_vehiculo_2_id;

    insert into public.traslados (
      estado,
      usuario_id,
      vehiculo_id,
      conductor_id,
      contacto_entrega_nombre,
      contacto_entrega_telefono,
      contacto_recepcion_nombre,
      contacto_recepcion_telefono,
      origen_lat,
      origen_lng,
      origen_direccion,
      origen_ciudad,
      destino_lat,
      destino_lng,
      destino_direccion,
      destino_ciudad,
      precio_cotizado,
      precio_final,
      tipo_pago,
      origen_referencias,
      destino_referencias,
      instrucciones_especiales,
      modalidad_programacion,
      fecha_hora_programada,
      tipo_ruta,
      ventana_recoleccion,
      ventana_entrega,
      tipo_servicio,
      motivo_servicio
    )
    values (
      v_estados_viaje[i],
      v_usuario_id,
      v_vehiculo_1_id,
      case when v_estados_viaje[i] in ('pendiente_de_conductor', 'documentacion_en_revision', 'cotizacion_generada', 'servicio_confirmado') then null else v_conductor_ids[i] end,
      format('Seed Usuario %s', lpad(i::text, 2, '0')),
      format('551111%s', lpad(i::text, 4, '0')),
      format('Recepcion Seed %s', lpad(i::text, 2, '0')),
      format('552222%s', lpad(i::text, 4, '0')),
      19.4326000 + (i * 0.0100),
      -99.1332000 - (i * 0.0100),
      format('Origen Seed %s, %s', i, v_ciudades[i]),
      v_ciudades[i],
      19.5326000 + (i * 0.0100),
      -99.0332000 - (i * 0.0100),
      format('Destino Seed %s, %s', i, v_ciudades[((i % 10) + 1)]),
      v_ciudades[((i % 10) + 1)],
      1200 + (i * 95),
      case when v_estados_viaje[i] in ('pago_completado', 'servicio_cerrado') then 1200 + (i * 95) else null end,
      case when i % 3 = 0 then 'al_cierre'::public.tipo_pago else 'anticipado'::public.tipo_pago end,
      'Caseta de vigilancia',
      'Entregar con contacto en sitio',
      'Llamar 20 minutos antes',
      'programado',
      now() + (i || ' days')::interval,
      case when i % 2 = 0 then 'foraneo' else 'local' end,
      '09:00-11:00',
      '16:00-18:00',
      case when i % 2 = 0 then 'empresarial' else 'personal' end,
      'QA semilla'
    );

    insert into public.traslados (
      estado,
      usuario_id,
      vehiculo_id,
      conductor_id,
      contacto_entrega_nombre,
      contacto_entrega_telefono,
      contacto_recepcion_nombre,
      contacto_recepcion_telefono,
      origen_lat,
      origen_lng,
      origen_direccion,
      origen_ciudad,
      destino_lat,
      destino_lng,
      destino_direccion,
      destino_ciudad,
      precio_cotizado,
      precio_final,
      tipo_pago,
      origen_referencias,
      destino_referencias,
      instrucciones_especiales,
      modalidad_programacion,
      fecha_hora_programada,
      tipo_ruta,
      ventana_recoleccion,
      ventana_entrega,
      tipo_servicio,
      motivo_servicio
    )
    values (
      v_estados_viaje[((i + 4 - 1) % 10) + 1],
      v_usuario_id,
      v_vehiculo_2_id,
      v_conductor_ids[((i + 4 - 1) % 10) + 1],
      format('Seed Usuario %s', lpad(i::text, 2, '0')),
      format('551111%s', lpad(i::text, 4, '0')),
      format('Recepcion Alterna %s', lpad(i::text, 2, '0')),
      format('553333%s', lpad(i::text, 4, '0')),
      20.0000000 + (i * 0.0120),
      -100.0000000 - (i * 0.0120),
      format('Origen Alterno Seed %s, %s', i, v_ciudades[((i + 2 - 1) % 10) + 1]),
      v_ciudades[((i + 2 - 1) % 10) + 1],
      20.1200000 + (i * 0.0120),
      -99.8800000 - (i * 0.0120),
      format('Destino Alterno Seed %s, %s', i, v_ciudades[((i + 5 - 1) % 10) + 1]),
      v_ciudades[((i + 5 - 1) % 10) + 1],
      1600 + (i * 110),
      case when v_estados_viaje[((i + 4 - 1) % 10) + 1] in ('pago_completado', 'servicio_cerrado') then 1600 + (i * 110) else null end,
      'anticipado',
      'Entrada principal',
      'Recibe vigilancia',
      'Revisar kilometraje inicial',
      'programado',
      now() + ((i + 10) || ' days')::interval,
      'foraneo',
      '08:00-10:00',
      '17:00-19:00',
      case when i % 2 = 0 then 'personal' else 'empresarial' end,
      'QA semilla alterna'
    );
  end loop;
end $$;
