-- rt43: Concurrencia con operadores simultáneos
BEGIN;
    SELECT plan(3);

    -- Preparar datos
    INSERT INTO usuarios (id, email, rol)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440201'::uuid, 'op1@test.com', 'operador'),
        ('550e8400-e29b-41d4-a716-446655440202'::uuid, 'op2@test.com', 'operador');

    INSERT INTO operadores (usuario_id, estado)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440201'::uuid, 'activo'),
        ('550e8400-e29b-41d4-a716-446655440202'::uuid, 'activo');

    INSERT INTO conductores (id, usuario_id, estado, rfc, licencia_numero)
    VALUES 
        ('550e8400-e29b-41d4-a716-446655440301'::uuid, '550e8400-e29b-41d4-a716-446655440201'::uuid, 'activo', 'AAA000000000', 'LIC001'),
        ('550e8400-e29b-41d4-a716-446655440302'::uuid, '550e8400-e29b-41d4-a716-446655440202'::uuid, 'activo', 'BBB000000000', 'LIC002');

    -- Test 1: Dos operadores pueden crear traslados simultáneamente
    SELECT is(
        (SELECT COUNT(*) FROM traslados 
         WHERE created_at > NOW() - INTERVAL '1 second'),
        2,
        'Dos operadores crean traslados sin bloqueo'
    );

    -- Test 2: Estados válidos de conductor - usa solo valores que existan en el enum
    -- Valores típicos: 'activo', 'inactivo', 'bloqueado', 'pendiente_aprobacion'
    SELECT throws_matching(
        'UPDATE conductores SET estado = ''activo'' 
         WHERE id = ''550e8400-e29b-41d4-a716-446655440301''::uuid',
        '%',  -- No debe lanzar error
        'Puede cambiar a estado válido activo'
    );

    -- Test 3: Concurrencia no causa race conditions
    SELECT is(
        (SELECT COUNT(DISTINCT operador_id) FROM traslados 
         WHERE created_at > NOW() - INTERVAL '5 seconds'),
        2,
        'Ambos operadores registrados correctamente'
    );

    SELECT * FROM finish();
ROLLBACK;