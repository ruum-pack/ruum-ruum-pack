-- rt44: Payload modificado - Aprobación no reutilizable
BEGIN;
    SELECT plan(3);

    -- Preparar datos
    INSERT INTO usuarios (id, email, rol)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440401'::uuid, 'supervisor@test.com', 'supervisor'),
        ('550e8400-e29b-41d4-a716-446655440402'::uuid, 'aprobador@test.com', 'aprobador');

    INSERT INTO supervisores (usuario_id, estado)
    VALUES ('550e8400-e29b-41d4-a716-446655440401'::uuid, 'activo');

    INSERT INTO aprobadores (usuario_id, estado)
    VALUES ('550e8400-e29b-41d4-a716-446655440402'::uuid, 'activo');

    -- RT-44.1: Aprobación con payload original
    INSERT INTO aprobaciones (
        id, supervisor_id, aprobador_id, tipo_transaccion, 
        monto_original, monto_aprobado, payload_hash, estado
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440601'::uuid,
        '550e8400-e29b-41d4-a716-446655440401'::uuid,
        '550e8400-e29b-41d4-a716-446655440402'::uuid,
        'pago_conductor',
        1000.00,
        1000.00,
        md5('{"conductor":"C1","monto":1000,"referencia":"PAGO001"}'::text),
        'aprobada'
    );

    SELECT is(
        (SELECT estado FROM aprobaciones 
         WHERE id = '550e8400-e29b-41d4-a716-446655440601'::uuid),
        'aprobada',
        'RT-44.1: Aprobación creada correctamente'
    );

    -- RT-44.2: Supervisor no puede ejecutar pago sin aprobación previa
    -- El supervisor debe tener una aprobación VÁLIDA para ejecutar
    SELECT throws_matching(
        'SELECT ejecutar_pago(
            ''550e8400-e29b-41d4-a716-446655440601''::uuid,
            NULL::uuid,
            1000.00,
            ''{"conductor":"C2","monto":1000,"referencia":"PAGO002"}''::jsonb
        )',
        '%PERMISO_INSUFICIENTE%|%APROBACION_NO_ENCONTRADA%|%no autorizado%',
        'RT-44.2: Supervisor no puede ejecutar pago sin aprobación previa'
    );

    -- RT-44.3: Intento de reutilizar aprobación con payload modificado falla
    -- Calcular hash del payload modificado
    SELECT throws_matching(
        'SELECT ejecutar_pago(
            ''550e8400-e29b-41d4-a716-446655440601''::uuid,
            ''550e8400-e29b-41d4-a716-446655440601''::uuid,
            1500.00,
            ''{"conductor":"C1","monto":1500,"referencia":"PAGO001"}''::jsonb
        )',
        '%PAYLOAD_MODIFICADO%|%no coincide%|%hash%|%APROBACION_INVALIDA%',
        'RT-44.3: No se permite reutilizar aprobación con payload modificado'
    );

    SELECT * FROM finish();
ROLLBACK;