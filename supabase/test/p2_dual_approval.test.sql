-- P2 Gate 2 + Sprint 1 — Candado de aprobación dual en operaciones sensibles.
-- Demuestra: rechazo sin aprobación, payload mismatch, rollback, mutación real.

create extension if not exists pgtap with schema extensions;

begin;

select plan(16);

-- ── Setup ──────────────────────────────────────────────────────────────

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('s1a00001-0000-4000-8000-000000000001', 's1-solicitante@s1.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('s1a00001-0000-4000-8000-000000000002', 's1-aprobador@s1.test',   '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('s1a00001-0000-4000-8000-000000000003', 's1-ejecutor@s1.test',    '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo) values
  ('s1b00001-0000-4000-8000-000000000001', 's1a00001-0000-4000-8000-000000000001', 'Solicitante S1', 'finanzas'),
  ('s1b00001-0000-4000-8000-000000000002', 's1a00001-0000-4000-8000-000000000002', 'Aprobador S1',   'compliance'),
  ('s1b00001-0000-4000-8000-000000000003', 's1a00001-0000-4000-8000-000000000003', 'Ejecutor S1',    'finanzas');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion)
values ('s1c00001-0000-4000-8000-000000000001', 's1a00001-0000-4000-8000-000000000001', 'persona', 'titular', 'verificado');

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, categoria_tarifa, gama, condicion)
values ('s1d00001-0000-4000-8000-000000000001', 's1c00001-0000-4000-8000-000000000001', 'sedan', 'S1', 'Test', 2026, 'ligero_a', 'entrada', 'seminueva');

insert into public.traslados (id, usuario_id, vehiculo_id, distancia_km, tiempo_estimado_horas, estado,
  contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, tipo_pago, precio_cotizado)
values ('s1e00001-0000-4000-8000-000000000001', 's1c00001-0000-4000-8000-000000000001',
  's1d00001-0000-4000-8000-000000000001', 10, 1, 'cotizacion_generada',
  'Entrega','+525500000001','Recepcion','+525500000002',
  19.43,-99.13,'Origen',19.50,-99.20,'Destino', 'anticipado', 500.00);

insert into public.conductores (id, auth_user_id, nombre, estado)
values ('s1f00001-0000-4000-8000-000000000001', 's1a00001-0000-4000-8000-000000000001', 'Conductor S1', 'activo');

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);
select set_config('role', 'authenticated', true);

-- ═════════════════════════════════════════════════════════════════════════
-- T1: admin_ejecutar_pago sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    '00000000-0000-0000-0000-000000000000',
    's1e00001-0000-4000-8000-000000000001', 500
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'S1-T1: rechaza pago con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T2: admin_ejecutar_pago con aprobación expirada → rechazo
-- ═════════════════════════════════════════════════════════════════════════
insert into public.solicitudes_aprobacion_admin (
  id, tipo, capacidad_requerida, recurso, recurso_id, accion, payload,
  estado, solicitada_por, aprobada_por, creada_en, expira_en, version
) values (
  's1f00001-0000-4000-8000-000000000001', 'finanzas', 'pagos:ejecutar',
  'traslados', 's1e00001-0000-4000-8000-000000000001', 'ejecutar_pago', '{}'::jsonb,
  'aprobada', 's1b00001-0000-4000-8000-000000000001', 's1b00001-0000-4000-8000-000000000002',
  now() - interval '2 days', now() - interval '1 day', 1
);

select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    's1f00001-0000-4000-8000-000000000001',
    's1e00001-0000-4000-8000-000000000001', 500
  ) $sql$,
  '%APROBACION_EXPIRADA%',
  'S1-T2: rechaza pago con aprobación expirada'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T3: admin_sancionar_conductor sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_sancionar_conductor(
    '00000000-0000-0000-0000-000000000000',
    's1f00001-0000-4000-8000-000000000001', 'Prueba', 7
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'S1-T3: rechaza sanción con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T4: admin_ajustar_precio_final sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_ajustar_precio_final(
    '00000000-0000-0000-0000-000000000000',
    's1e00001-0000-4000-8000-000000000001', 450
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'S1-T4: rechaza ajuste precio con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T5: admin_suspender_conductor sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_suspender_conductor(
    '00000000-0000-0000-0000-000000000000',
    's1f00001-0000-4000-8000-000000000001', 'suspendido_7d', 'Motivo'
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'S1-T5: rechaza suspensión con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T6: admin_registrar_no_presentacion sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_registrar_no_presentacion(
    '00000000-0000-0000-0000-000000000000',
    's1f00001-0000-4000-8000-000000000001', 1, 'activo'
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'S1-T6: rechaza no presentación con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T7: admin_registrar_cancelacion_injustificada sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_registrar_cancelacion_injustificada(
    '00000000-0000-0000-0000-000000000000',
    's1f00001-0000-4000-8000-000000000001', 1, 'suspendido_7d'
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'S1-T7: rechaza cancelación injustificada con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T8: Ciclo completo — pago + payload match → ejecución exitosa
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'pagos:ejecutar',
    'traslados', 's1e00001-0000-4000-8000-000000000001',
    'ejecutar_pago', jsonb_build_object('monto', 500, 'tipo_pago', 'anticipado')
  );
  perform set_config('s1_aprobacion_pago', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_pago')::uuid),
    true, 'Aprobado S1', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);

select is(
  (public.admin_ejecutar_pago(
    (select current_setting('s1_aprobacion_pago')::uuid),
    's1e00001-0000-4000-8000-000000000001', 500
  ))->>'ejecutado',
  'true',
  'S1-T8a: ciclo completo pago — ejecución exitosa'
);

select ok(
  exists(select 1 from public.pagos where traslado_id = 's1e00001-0000-4000-8000-000000000001' and estado = 'completado'),
  'S1-T8b: pago real creado con estado completado'
);

select is(
  (select estado::text from public.traslados where id = 's1e00001-0000-4000-8000-000000000001'),
  'pago_completado',
  'S1-T8c: traslado avanzó a pago_completado'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T9: Aprobación ya ejecutada no puede reutilizarse
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    (select current_setting('s1_aprobacion_pago')::uuid),
    's1e00001-0000-4000-8000-000000000001', 500
  ) $sql$,
  '%APROBACION_NO_APROBADA%',
  'S1-T9: rechaza reutilizar aprobación ya ejecutada'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T10: Payload mismatch → rechazo
-- ═════════════════════════════════════════════════════════════════════════
insert into public.traslados (id, usuario_id, vehiculo_id, distancia_km, tiempo_estimado_horas, estado,
  contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, tipo_pago, precio_cotizado)
values ('s1e00001-0000-4000-8000-000000000002', 's1c00001-0000-4000-8000-000000000001',
  's1d00001-0000-4000-8000-000000000001', 10, 1, 'cotizacion_generada',
  'Entrega2','+525500000003','Recepcion2','+525500000004',
  19.43,-99.13,'Origen2',19.50,-99.20,'Destino2', 'anticipado', 600.00);

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'pagos:ejecutar',
    'traslados', 's1e00001-0000-4000-8000-000000000002',
    'ejecutar_pago', jsonb_build_object('monto', 500, 'tipo_pago', 'anticipado')
  );
  perform set_config('s1_aprobacion_payload_mismatch', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_payload_mismatch')::uuid),
    true, 'Aprobado', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);

select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    (select current_setting('s1_aprobacion_payload_mismatch')::uuid),
    's1e00001-0000-4000-8000-000000000002', 999
  ) $sql$,
  '%APROBACION_PAYLOAD_NO_COINCIDE%',
  'S1-T10: rechaza ejecución cuando el payload no coincide con el aprobado'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T11: Aprobación dual — autoaprobación impedida
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'pagos:ejecutar', 'traslados', null, 'test_auto', '{}'::jsonb
  );
  perform set_config('s1_aprobacion_auto', v_id::text, true);
end $$;

select throws_like(
  $sql$ select public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_auto')::uuid),
    true, 'Autoaprobación', 1
  ) $sql$,
  '%APROBADOR_DEBE_SER_DISTINTO%',
  'S1-T11: el mismo admin no puede aprobar su propia solicitud'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T12: admin_cambiar_estado_traslado estado crítico sin aprobación → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_cambiar_estado_traslado(
    's1e00001-0000-4000-8000-000000000002', 'pago_completado', null, null
  ) $sql$,
  '%APROBACION_REQUERIDA%',
  'S1-T12: rechaza cambio a estado crítico sin aprobación'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T13: admin_suspender_conductor — aplicación real
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'sancion', 'conductores:sancionar',
    'conductores', 's1f00001-0000-4000-8000-000000000001',
    'suspender', jsonb_build_object('nuevo_estado', 'suspendido_7d', 'motivo', 'Prueba S1')
  );
  perform set_config('s1_aprobacion_suspender', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_suspender')::uuid),
    true, 'Aprobado', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);

select is(
  (public.admin_suspender_conductor(
    (select current_setting('s1_aprobacion_suspender')::uuid),
    's1f00001-0000-4000-8000-000000000001', 'suspendido_7d', 'Prueba S1'
  ))->>'ejecutado',
  'true',
  'S1-T13a: suspensión real ejecutada'
);

select is(
  (select estado::text from public.conductores where id = 's1f00001-0000-4000-8000-000000000001'),
  'suspendido_7d',
  'S1-T13b: conductor quedó suspendido_7d'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T14: admin_ajustar_precio_final con aprobación válida
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'tarifas:editar',
    'traslados', 's1e00001-0000-4000-8000-000000000002',
    'ajustar_precio_final', jsonb_build_object('precio_final', 450)
  );
  perform set_config('s1_aprobacion_precio', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_precio')::uuid),
    true, 'Aprobado', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);

select is(
  (public.admin_ajustar_precio_final(
    (select current_setting('s1_aprobacion_precio')::uuid),
    's1e00001-0000-4000-8000-000000000002', 450
  ))->>'ejecutado',
  'true',
  'S1-T14a: ajuste precio final ejecutado'
);

select is(
  (select precio_final from public.traslados where id = 's1e00001-0000-4000-8000-000000000002'),
  450.00,
  'S1-T14b: precio_final actualizado en traslados'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T15: admin_registrar_no_presentacion con aprobación válida
-- ═════════════════════════════════════════════════════════════════════════
insert into public.conductores (id, auth_user_id, nombre, estado, no_presentaciones_6m)
values ('s1f00001-0000-4000-8000-000000000002', 's1a00001-0000-4000-8000-000000000001', 'Conductor NP', 'activo', 0);

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'sancion', 'conductores:sancionar',
    'conductores', 's1f00001-0000-4000-8000-000000000002',
    'no_presentacion', jsonb_build_object('ocurrencias', 1, 'nuevo_estado', 'suspendido_7d')
  );
  perform set_config('s1_aprobacion_np', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_np')::uuid),
    true, 'Aprobado', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);

select is(
  (public.admin_registrar_no_presentacion(
    (select current_setting('s1_aprobacion_np')::uuid),
    's1f00001-0000-4000-8000-000000000002', 1, 'suspendido_7d'
  ))->>'ejecutado',
  'true',
  'S1-T15: no presentación ejecutada con aprobación dual'
);

-- ═════════════════════════════════════════════════════════════════════════
-- T16: admin_registrar_cancelacion_injustificada con aprobación válida
-- ═════════════════════════════════════════════════════════════════════════
insert into public.conductores (id, auth_user_id, nombre, estado, cancelaciones_sin_justificacion_count)
values ('s1f00001-0000-4000-8000-000000000003', 's1a00001-0000-4000-8000-000000000001', 'Conductor CJ', 'activo', 0);

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'sancion', 'conductores:sancionar',
    'conductores', 's1f00001-0000-4000-8000-000000000003',
    'cancelacion_injustificada', jsonb_build_object('cancelaciones', 1, 'nuevo_estado', 'suspendido_7d')
  );
  perform set_config('s1_aprobacion_cj', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('s1_aprobacion_cj')::uuid),
    true, 'Aprobado', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 's1a00001-0000-4000-8000-000000000003', true);

select is(
  (public.admin_registrar_cancelacion_injustificada(
    (select current_setting('s1_aprobacion_cj')::uuid),
    's1f00001-0000-4000-8000-000000000003', 1, 'suspendido_7d'
  ))->>'ejecutado',
  'true',
  'S1-T16: cancelación injustificada ejecutada con aprobación dual'
);

select * from finish();

rollback;
