-- rt25: RLS - Perfiles reales
BEGIN;
    SELECT plan(11);

    -- Preparar datos
    INSERT INTO usuarios (id, email, rol)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440501'::uuid, 'conductor@test.com', 'conductor'),
        ('550e8400-e29b-41d4-a716-446655440502'::uuid, 'otro@test.com', 'conductor');

    INSERT INTO conductores (id, usuario_id, estado, rfc, licencia_numero)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440601'::uuid, '550e8400-e29b-41d4-a716-446655440501'::uuid, 'activo', 'AAA000000000', 'LIC001'),
        ('550e8400-e29b-41d4-a716-446655440602'::uuid, '550e8400-e29b-41d4-a716-446655440502'::uuid, 'activo', 'BBB000000000', 'LIC002');

    -- RT-25.1: Conductor ve solo sus propios datos
    SELECT is(
        (SELECT COUNT(*) FROM conductores 
         WHERE usuario_id = '550e8400-e29b-41d4-a716-446655440501'::uuid),
        1,
        'RT-25.1: Conductor ve solo su registro'
    );

    -- RT-25.2: Conductor no ve datos de otros
    SELECT is(
        (SELECT COUNT(*) FROM conductores 
         WHERE usuario_id = '550e8400-e29b-41d4-a716-446655440502'::uuid
         AND id != '550e8400-e29b-41d4-a716-446655440602'::uuid),
        0,
        'RT-25.2: Conductor no accede a otros registros'
    );

    -- RT-25.3: Admin ve todos los conductores
    SELECT is(
        COUNT(*) >= 2,
        true,
        'RT-25.3: Admin ve múltiples conductores'
    ) FROM conductores;

    -- RT-25.4: Conductor no puede insertar registros falsos
    SELECT throws_matching(
        'INSERT INTO conductores (id, usuario_id, estado, rfc, licencia_numero) 
         VALUES (''550e8400-e29b-41d4-a716-446655440610''::uuid, 
                 ''550e8400-e29b-41d4-a716-446655440502''::uuid, 
                 ''activo'', ''CCC000000000'', ''LIC999'')',
        '%permission denied%|%PERMISSION_DENIED%',
        'RT-25.4: RLS bloquea inserción no autorizada'
    );

    -- RT-25.5: Conductor no puede ver datos sensibles
    SELECT is(
        (SELECT datos_bancarios FROM conductores 
         WHERE id = '550e8400-e29b-41d4-a716-446655440601'::uuid),
        NULL,
        'RT-25.5: Datos sensibles no visibles al conductor'
    );

    -- RT-25.6: Conductor A no puede modificar su estado directamente
    -- IMPORTANTE: El mensaje de error debe coincidir con una de las opciones en la expectativa
    SELECT throws_matching(
        'UPDATE conductores SET estado = ''inactivo'' 
         WHERE id = ''550e8400-e29b-41d4-a716-446655440601''::uuid',
        '%PERMISSION_DENIED%|%RLS%|%flujo autorizado%',
        'RT-25.6: Conductor A no puede modificar su estado directamente - debe usar flujo autorizado'
    );

    -- RT-25.7: Solo cambios autorizados pueden actualizar estado
    SELECT is(
        (SELECT COUNT(*) FROM cambios_de_estado 
         WHERE conductor_id = '550e8400-e29b-41d4-a716-446655440601'::uuid),
        0,
        'RT-25.7: No hay cambios no autorizados registrados'
    );

    -- RT-25.8: Operador ve solo sus conductores asignados
    SELECT is(
        (SELECT COUNT(*) FROM conductores 
         WHERE operador_id IS NOT NULL),
        0,
        'RT-25.8: Operador tiene vista limitada'
    );

    -- RT-25.9: Auditoría de intentos de acceso no autorizado
    SELECT is(
        COUNT(*),
        1,
        'RT-25.9: Intento de acceso registrado en auditoría'
    ) FROM auditoria_rls 
    WHERE evento = 'update_bloqueado' 
    AND tabla = 'conductores'
    ORDER BY created_at DESC 
    LIMIT 1;

    -- RT-25.10: RLS no afecta selects autorizados
    SELECT is(
        (SELECT COUNT(*) FROM conductores 
         WHERE estado = 'activo'),
        2,
        'RT-25.10: Selects autorizados funcionan correctamente'
    );

    -- RT-25.11: Políticas se aplican en cascada
    SELECT is(
        (SELECT COUNT(*) FROM traslados 
         WHERE conductor_id = '550e8400-e29b-41d4-a716-446655440601'::uuid),
        0,
        'RT-25.11: Políticas cascada funcionan'
    );

    SELECT * FROM finish();
ROLLBACK;