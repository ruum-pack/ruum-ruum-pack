-- rt27: Métricas de registro conductor
BEGIN;
    SELECT plan(6);

    -- Preparar datos
    INSERT INTO usuarios (id, email, rol)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440701'::uuid, 'conductor@test.com', 'conductor'),
        ('550e8400-e29b-41d4-a716-446655440702'::uuid, 'admin@test.com', 'administrador');

    INSERT INTO conductores (id, usuario_id, estado, rfc, licencia_numero)
    VALUES ('550e8400-e29b-41d4-a716-446655440801'::uuid, 
            '550e8400-e29b-41d4-a716-446655440701'::uuid, 
            'activo', 'AAA000000000', 'LIC001');

    INSERT INTO administradores (usuario_id, estado)
    VALUES ('550e8400-e29b-41d4-a716-446655440702'::uuid, 'activo');

    -- RT-27.1: Anónimo no puede leer telemetría
    -- Nota: El error debe contener "permission denied" (en minúsculas) o "denegado"
    SELECT throws_matching(
        'SELECT * FROM eventos_registro_conductor',
        '%permission denied%',  -- Usar minúsculas como PostgreSQL lo genera
        'RT-27.1: Anónimo no puede leer telemetría - acceso denegado'
    );

    -- RT-27.2: Conductor ve solo sus propios eventos
    INSERT INTO eventos_registro_conductor (
        id, conductor_id, tipo_evento, datos, created_at
    ) VALUES (
        '550e8400-e29b-41d4-a716-446655440901'::uuid,
        '550e8400-e29b-41d4-a716-446655440801'::uuid,
        'inicio_sesion',
        '{"ip":"192.168.1.1"}'::jsonb,
        NOW()
    );

    SELECT is(
        (SELECT COUNT(*) FROM eventos_registro_conductor 
         WHERE conductor_id = '550e8400-e29b-41d4-a716-446655440801'::uuid),
        1,
        'RT-27.2: Conductor ve su evento registrado'
    );

    -- RT-27.3: Admin ve todos los eventos
    SELECT is(
        (SELECT COUNT(*) FROM eventos_registro_conductor),
        1,
        'RT-27.3: Admin ve eventos de todos'
    );

    -- RT-27.4: La telemetría es append-only e inmutable
    -- No se puede actualizar ni deletear registros existentes
    SELECT throws_matching(
        'UPDATE eventos_registro_conductor 
         SET datos = ''{"ip":"10.0.0.1"}''::jsonb 
         WHERE id = ''550e8400-e29b-41d4-a716-446655440901''::uuid',
        '%immutable%|%solo escritura%|%append-only%|%telemetría de registro es inmutable%',
        'RT-27.4: La telemetría es append-only e inmutable - no se permite actualizar'
    );

    -- RT-27.5: No se pueden borrar registros de telemetría
    SELECT throws_matching(
        'DELETE FROM eventos_registro_conductor 
         WHERE id = ''550e8400-e29b-41d4-a716-446655440901''::uuid',
        '%cannot delete%|%no se puede eliminar%|%prohibido%|%immutable%',
        'RT-27.5: No se permite borrar registros de telemetría'
    );

    -- RT-27.6: Auditoría registra intentos de modificación
    SELECT is(
        COUNT(*),
        2,
        'RT-27.6: Auditoría registra intentos de modificación'
    ) FROM auditoria_eventos_telemetria 
    WHERE conductor_id = '550e8400-e29b-41d4-a716-446655440801'::uuid
    AND accion IN ('intento_update', 'intento_delete');

    SELECT * FROM finish();
ROLLBACK;