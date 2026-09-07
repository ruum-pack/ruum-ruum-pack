-- p2: Sistema de aprobación dual
BEGIN;
    SELECT plan(16);

    -- Preparar datos
    INSERT INTO usuarios (id, email, rol)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440401'::uuid, 'admin1@test.com', 'administrador'),
        ('550e8400-e29b-41d4-a716-446655440402'::uuid, 'admin2@test.com', 'administrador');

    INSERT INTO administradores (usuario_id, estado)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440401'::uuid, 'activo'),
        ('550e8400-e29b-41d4-a716-446655440402'::uuid, 'activo');

    -- S1-T1: Admin puede solicitar aprobación
    SELECT is(
        (admin_solicitar_aprobacion(
            '550e8400-e29b-41d4-a716-446655440401'::text,
            '550e8400-e29b-41d4-a716-446655440402'::text,
            'cambio_tarifa',
            '550e8400-e29b-41d4-a716-446655440501'::uuid,
            'Aumentar tarifa 10%',
            '{"nueva_tarifa": 900}'::jsonb
        )).id IS NOT NULL,
        true,
        'S1-T1: Admin solicita aprobación correctamente'
    );

    -- S1-T2: Aprobador diferente recibe solicitud
    SELECT is(
        (SELECT estado FROM aprobaciones_pendientes 
         WHERE admin_solicitante = '550e8400-e29b-41d4-a716-446655440401'::uuid 
         LIMIT 1),
        'pendiente',
        'S1-T2: Solicitud en estado pendiente'
    );

    -- S1-T3: Aprobador puede rechazar
    SELECT is(
        (admin_rechazar_aprobacion(
            '550e8400-e29b-41d4-a716-446655440402'::uuid,
            (SELECT id FROM aprobaciones_pendientes 
             WHERE admin_solicitante = '550e8400-e29b-41d4-a716-446655440401'::uuid 
             LIMIT 1),
            'Tarifa muy alta'
        )).id IS NOT NULL,
        true,
        'S1-T3: Aprobador puede rechazar solicitud'
    );

    -- S1-T4: Nueva solicitud para tests posteriores
    INSERT INTO aprobaciones_pendientes (
        id, admin_solicitante, admin_aprobador, tipo_cambio, 
        recurso_id, descripcion, payload, estado
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440601'::uuid,
        '550e8400-e29b-41d4-a716-446655440401'::uuid,
        '550e8400-e29b-41d4-a716-446655440402'::uuid,
        'cambio_estado',
        '550e8400-e29b-41d4-a716-446655440501'::uuid,
        'Cambiar a estado crítico',
        '{"nuevo_estado": "critico"}'::jsonb,
        'pendiente'
    );

    -- S1-T5: Aprobador puede aprobar
    SELECT is(
        (admin_aprobar_aprobacion(
            '550e8400-e29b-41d4-a716-446655440402'::uuid,
            '550e8400-e29b-41d4-a716-446655440601'::uuid
        )).id IS NOT NULL,
        true,
        'S1-T5: Aprobador puede aprobar solicitud'
    );

    -- S1-T6: Cambio se ejecuta después de aprobación
    SELECT is(
        (SELECT estado FROM aprobaciones_pendientes 
         WHERE id = '550e8400-e29b-41d4-a716-446655440601'::uuid),
        'aprobada',
        'S1-T6: Solicitud marcada como aprobada'
    );

    -- S1-T7: Auditoría registra aprobación
    SELECT is(
        COUNT(*),
        1,
        'S1-T7: Auditoría registra aprobación'
    ) FROM auditoria_aprobaciones 
    WHERE aprobacion_id = '550e8400-e29b-41d4-a716-446655440601'::uuid;

    -- S1-T8: Solo admin aprobador puede ejecutar
    INSERT INTO aprobaciones_pendientes (
        id, admin_solicitante, admin_aprobador, tipo_cambio, 
        recurso_id, descripcion, payload, estado
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440602'::uuid,
        '550e8400-e29b-41d4-a716-446655440401'::uuid,
        '550e8400-e29b-41d4-a716-446655440402'::uuid,
        'cambio_salario',
        '550e8400-e29b-41d4-a716-446655440501'::uuid,
        'Aumentar salario',
        '{"monto": 5000}'::jsonb,
        'pendiente'
    );

    SELECT throws_matching(
        'SELECT admin_aprobar_aprobacion(
            ''550e8400-e29b-41d4-a716-446655440401''::uuid,
            ''550e8400-e29b-41d4-a716-446655440602''::uuid
        )',
        '%ADMIN_NO_AUTORIZADO%|%aprobador%',
        'S1-T8: Otro admin no puede aprobar'
    );

    -- S1-T9: Solicitud expirada no se puede aprobar
    INSERT INTO aprobaciones_pendientes (
        id, admin_solicitante, admin_aprobador, tipo_cambio, 
        recurso_id, descripcion, payload, estado, created_at
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440603'::uuid,
        '550e8400-e29b-41d4-a716-446655440401'::uuid,
        '550e8400-e29b-41d4-a716-446655440402'::uuid,
        'cambio_otros',
        '550e8400-e29b-41d4-a716-446655440501'::uuid,
        'Cambio expirado',
        '{"data": "test"}'::jsonb,
        'pendiente',
        NOW() - INTERVAL '48 hours'
    );

    SELECT throws_matching(
        'SELECT admin_aprobar_aprobacion(
            ''550e8400-e29b-41d4-a716-446655440402''::uuid,
            ''550e8400-e29b-41d4-a716-446655440603''::uuid
        )',
        '%APROBACION_EXPIRADA%|%vencida%',
        'S1-T9: No se puede aprobar solicitud expirada'
    );

    -- S1-T10: No se puede aprobar dos veces
    SELECT throws_matching(
        'SELECT admin_aprobar_aprobacion(
            ''550e8400-e29b-41d4-a716-446655440402''::uuid,
            ''550e8400-e29b-41d4-a716-446655440601''::uuid
        )',
        '%APROBACION_YA_PROCESADA%|%ya fue%',
        'S1-T10: No se puede aprobar dos veces'
    );

    -- S1-T11: El mismo admin no puede aprobar su propia solicitud
    -- IMPORTANTE: Actualizar la función admin_solicitar_aprobacion para lanzar este error
    INSERT INTO aprobaciones_pendientes (
        id, admin_solicitante, admin_aprobador, tipo_cambio, 
        recurso_id, descripcion, payload, estado
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440604'::uuid,
        '550e8400-e29b-41d4-a716-446655440401'::uuid,
        '550e8400-e29b-41d4-a716-446655440401'::uuid,
        'cambio_prueba',
        '550e8400-e29b-41d4-a716-446655440501'::uuid,
        'Solicitud propia',
        '{"test": true}'::jsonb,
        'pendiente'
    );

    SELECT throws_matching(
        'SELECT admin_solicitar_aprobacion(
            ''550e8400-e29b-41d4-a716-446655440401''::text,
            ''550e8400-e29b-41d4-a716-446655440401''::text,
            ''cambio_prueba'',
            ''550e8400-e29b-41d4-a716-446655440501''::uuid,
            ''Intento de auto-aprobación'',
            ''{}'::jsonb
        )',
        '%APROBADOR_DEBE_SER_DISTINTO%',
        'S1-T11: El mismo admin no puede aprobar su propia solicitud'
    );

    -- S1-T12: Rechaza cambio a estado crítico sin aprobación
    SELECT throws_matching(
        'UPDATE traslados SET estado = ''critico'' 
         WHERE id = ''550e8400-e29b-41d4-a716-446655440501''::uuid',
        '%APROBACION_REQUERIDA%|%crítico%',
        'S1-T12: Rechaza cambio a estado crítico sin aprobación'
    );

    -- S1-T13: Validar que se registran todos los cambios
    SELECT is(
        COUNT(*),
        1,
        'S1-T13: Auditoría registra solicitud rechazada'
    ) FROM auditoria_aprobaciones 
    WHERE estado = 'rechazada' 
    AND admin_solicitante = '550e8400-e29b-41d4-a716-446655440401'::uuid;

    -- S1-T14: Notificación al aprobador
    SELECT is(
        COUNT(*),
        1,
        'S1-T14: Notificación enviada al aprobador'
    ) FROM notificaciones 
    WHERE usuario_id = '550e8400-e29b-41d4-a716-446655440402'::uuid
    AND tipo = 'aprobacion_pendiente';

    -- S1-T15: Historial de aprobaciones
    SELECT is(
        COUNT(*),
        3,
        'S1-T15: Historial registra 3 eventos de aprobación'
    ) FROM historial_aprobaciones 
    WHERE admin_solicitante = '550e8400-e29b-41d4-a716-446655440401'::uuid;

    -- S1-T16: Estados permitidos
    SELECT is(
        COUNT(DISTINCT estado),
        4,
        'S1-T16: Existen 4 estados de aprobación válidos'
    ) FROM aprobaciones_pendientes;

    SELECT * FROM finish();
ROLLBACK;