-- P2 Gate 2 — Candado de aprobación dual en operaciones sensibles.
-- Demuestra que el sistema rechaza la ejecución sin aprobación válida.

create extension if not exists pgtap with schema extensions;

begin;

select plan(8);

-- ── Setup: tres admins (solicitante, aprobador, ejecutor) ──────────────

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('p2a00000-0000-4000-8000-000000000001', 'p2-solicitante@p2.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('p2a00000-0000-4000-8000-000000000002', 'p2-aprobador@p2.test',   '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('p2a00000-0000-4000-8000-000000000003', 'p2-ejecutor@p2.test',   '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('p2a00000-0000-4000-8000-000000000004', 'p2-admin@p2.test',      '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo) values
  ('p2b00000-0000-4000-8000-000000000001', 'p2a00000-0000-4000-8000-000000000001', 'Solicitante P2', 'finanzas'),
  ('p2b00000-0000-4000-8000-000000000002', 'p2a00000-0000-4000-8000-000000000002', 'Aprobador P2',   'compliance'),
  ('p2b00000-0000-4000-8000-000000000003', 'p2a00000-0000-4000-8000-000000000003', 'Ejecutor P2',    'finanzas'),
  ('p2b00000-0000-4000-8000-000000000004', 'p2a00000-0000-4000-8000-000000000004', 'Admin Base P2',  'supervisor');

-- Admin de prueba para tarifas (direccion tiene tarifas:editar y aprobaciones:aprobar)
insert into public.admins (id, auth_user_id, nombre, rol_operativo) values
  ('p2b00000-0000-4000-8000-000000000005', 'p2a00000-0000-4000-8000-000000000004', 'Admin Tarifas P2', 'direccion');

-- Datos mínimos: un traslado de prueba
insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion)
values ('p2c00000-0000-4000-8000-000000000001', 'p2a00000-0000-4000-8000-000000000004', 'persona', 'titular', 'verificado');

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, categoria_tarifa, gama, condicion)
values ('p2d00000-0000-4000-8000-000000000001', 'p2c00000-0000-4000-8000-000000000001', 'sedan', 'P2', 'Test', 2026, 'ligero_a', 'entrada', 'seminueva');

insert into public.traslados (id, usuario_id, vehiculo_id, distancia_km, tiempo_estimado_horas,
  contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion)
values ('p2e00000-0000-4000-8000-000000000001', 'p2c00000-0000-4000-8000-000000000001',
  'p2d00000-0000-4000-8000-000000000001', 10, 1,
  'Entrega','+525500000001','Recepcion','+525500000002',
  19.43,-99.13,'Origen',19.50,-99.20,'Destino');

-- ═════════════════════════════════════════════════════════════════════════
-- Test 1: Ejecución sin aprobación (UUID inválido) → APROBACION_NO_ENCONTRADA
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000003', true);
select set_config('role', 'authenticated', true);

select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    '00000000-0000-0000-0000-000000000000',
    'p2e00000-0000-4000-8000-000000000001'
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'G2-T1: rechaza ejecución de pago con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 2: Ejecución con aprobación expirada → rechazo
-- ═════════════════════════════════════════════════════════════════════════
insert into public.solicitudes_aprobacion_admin (
  id, tipo, capacidad_requerida, recurso, recurso_id, accion, payload,
  estado, solicitada_por, aprobada_por, creada_en, expira_en, version
) values (
  'p2f00000-0000-4000-8000-000000000001', 'finanzas', 'pagos:ejecutar',
  'traslados', 'p2e00000-0000-4000-8000-000000000001', 'ejecutar_pago', '{}'::jsonb,
  'aprobada', 'p2b00000-0000-4000-8000-000000000001', 'p2b00000-0000-4000-8000-000000000002',
  now() - interval '2 days', now() - interval '1 day', 1
);

select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    'p2f00000-0000-4000-8000-000000000001',
    'p2e00000-0000-4000-8000-000000000001'
  ) $sql$,
  '%APROBACION_EXPIRADA%',
  'G2-T2: rechaza ejecución de pago con aprobación expirada'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 3: Sanción sin aprobación → APROBACION_NO_ENCONTRADA
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_sancionar_conductor(
    '00000000-0000-0000-0000-000000000000',
    'p2b00000-0000-4000-8000-000000000001',
    'Prueba de rechazo', 0
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'G2-T3: rechaza sanción a conductor con aprobación inexistente'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 4: Ciclo completo de aprobación dual — solicitar, aprobar, ejecutar
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'pagos:ejecutar',
    'traslados', 'p2e00000-0000-4000-8000-000000000001',
    'ejecutar_pago', '{}'::jsonb
  );
  perform set_config('p2_aprobacion_id', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('p2_aprobacion_id')::uuid),
    true, 'Aprobado por P2', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000003', true);

select is(
  (public.admin_ejecutar_pago(
    (select current_setting('p2_aprobacion_id')::uuid),
    'p2e00000-0000-4000-8000-000000000001'
  ))->>'ejecutado',
  'true',
  'G2-T4: ciclo completo de aprobación dual — ejecución exitosa'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 5: Reutilizar misma aprobación → rechazo (ya consumida)
-- ═════════════════════════════════════════════════════════════════════════
select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    (select current_setting('p2_aprobacion_id')::uuid),
    'p2e00000-0000-4000-8000-000000000001'
  ) $sql$,
  '%APROBACION_NO_APROBADA%',
  'G2-T5: rechaza reutilizar aprobación ya ejecutada (estado=ejecutada)'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 6: Aprobación con recurso incorrecto → rechazo
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'pagos:ejecutar',
    'facturas', null,
    'pagar_factura', '{}'::jsonb
  );
  perform set_config('p2_aprobacion_recurso_incorrecto', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('p2_aprobacion_recurso_incorrecto')::uuid),
    true, 'Aprobado', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000003', true);

select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    (select current_setting('p2_aprobacion_recurso_incorrecto')::uuid),
    'p2e00000-0000-4000-8000-000000000001'
  ) $sql$,
  '%APROBACION_RECURSO_INVALIDO%',
  'G2-T6: rechaza ejecución cuando el recurso de la aprobación no coincide'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 7: Aprobación dual — autoaprobación impedida (APROBADOR_DEBE_SER_DISTINTO)
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'finanzas', 'pagos:ejecutar',
    'traslados', null,
    'test_auto', '{}'::jsonb
  );
  perform set_config('p2_aprobacion_auto', v_id::text, true);
end $$;

select throws_like(
  $sql$ select public.admin_decidir_aprobacion(
    (select current_setting('p2_aprobacion_auto')::uuid),
    true, 'Autoaprobación', 1
  ) $sql$,
  '%APROBADOR_DEBE_SER_DISTINTO%',
  'G2-T7: el mismo admin no puede aprobar su propia solicitud'
);

-- ═════════════════════════════════════════════════════════════════════════
-- Test 8: Edición de tarifas exige aprobación dual
-- ═════════════════════════════════════════════════════════════════════════
select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000001', true);

do $$ declare v_id uuid;
begin
  v_id := public.admin_solicitar_aprobacion(
    'tarifas', 'tarifas:editar',
    'tarifas', null,
    'actualizar_politica_tarifaria', '{}'::jsonb
  );
  perform set_config('p2_aprobacion_tarifas', v_id::text, true);
end $$;

select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000002', true);

do $$ begin
  perform public.admin_decidir_aprobacion(
    (select current_setting('p2_aprobacion_tarifas')::uuid),
    true, 'Apruebo ajuste tarifario', 1
  );
end $$;

select set_config('request.jwt.claim.sub', 'p2a00000-0000-4000-8000-000000000004', true);

select is(
  (public.admin_actualizar_politica_tarifaria_normativa(
    (select current_setting('p2_aprobacion_tarifas')::uuid),
    '{}'::jsonb
  ))->>'actualizadas',
  '0',
  'G2-T8: edición de tarifas con aprobación dual válida se ejecuta'
);

select * from finish();

rollback;
