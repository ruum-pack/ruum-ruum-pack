-- rt37: Tarifa normativa no negociable
BEGIN;
    SELECT plan(5);

    -- Preparar datos de prueba
    INSERT INTO conductores (id, usuario_id, estado, rfc, licencia_numero)
    VALUES (
        '550e8400-e29b-41d4-a716-446655440001'::uuid,  -- UUID válido generado
        '550e8400-e29b-41d4-a716-446655440011'::uuid,
        'activo',
        'ABC000000000',
        'LIC123456789'
    );

    INSERT INTO traslados (id, conductor_id, tarifa_acordada, tarifa_normativa, estado)
    VALUES (
        '550e8400-e29b-41d4-a716-446655440002'::uuid,  -- UUID válido
        '550e8400-e29b-41d4-a716-446655440001'::uuid,
        500.00,
        800.00,
        'completado'
    );

    -- Test 1: No puede cobrar menos de tarifa normativa
    SELECT throws_matching(
        'SELECT validar_tarifa_minima(550e8400-e29b-41d4-a716-446655440002, 500.00)',
        '%TARIFA_MINIMA%',
        'No puede cobrar menos de tarifa normativa'
    );

    -- Test 2: Puede cobrar tarifa normativa
    SELECT is(
        validar_tarifa_minima('550e8400-e29b-41d4-a716-446655440002'::uuid, 800.00),
        true,
        'Acepta tarifa normativa'
    );

    -- Test 3: Puede cobrar más que tarifa normativa
    SELECT is(
        validar_tarifa_minima('550e8400-e29b-41d4-a716-446655440002'::uuid, 900.00),
        true,
        'Acepta tarifa mayor a normativa'
    );

    -- Test 4: Valida traslado inexistente
    SELECT throws_matching(
        'SELECT validar_tarifa_minima(''99999999-9999-9999-9999-999999999999''::uuid, 500.00)',
        '%TRASLADO_NO_ENCONTRADO%',
        'Error si traslado no existe'
    );

    -- Test 5: Log de auditoría
    SELECT is(
        COUNT(*),
        1,
        'Registra en auditoría'
    ) FROM auditoria_tarifas 
    WHERE traslado_id = '550e8400-e29b-41d4-a716-446655440002'::uuid;

    SELECT * FROM finish();
ROLLBACK;