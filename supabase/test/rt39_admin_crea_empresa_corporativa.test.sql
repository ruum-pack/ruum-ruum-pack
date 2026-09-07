-- rt39: Admin crea empresa corporativa
BEGIN;
    SELECT plan(5);

    -- Preparar admin
    INSERT INTO usuarios (id, email, rol)
    VALUES ('550e8400-e29b-41d4-a716-446655440099'::uuid, 'admin@test.com', 'administrador');

    INSERT INTO administradores (usuario_id, estado)
    VALUES ('550e8400-e29b-41d4-a716-446655440099'::uuid, 'activo');

    -- Test 1: Admin crea empresa corporativa con RFC válido
    SELECT is(
        (admin_crea_empresa_corporativa(
            '{"nombre":"Empresa Test","rfc":"ABC000000000","sector":"logistica"}'::jsonb,
            '{"contacto":"Juan","email":"juan@empresa.com"}'::jsonb
        )).id IS NOT NULL,
        true,
        'Admin crea empresa corporativa con RFC válido'
    );

    -- Test 2: Rechaza RFC inválido (muy corto)
    SELECT throws_matching(
        'SELECT admin_crea_empresa_corporativa(
            ''{
                "nombre":"Empresa Inv",
                "rfc":"ABC",
                "sector":"logistica"
            }''::jsonb,
            ''{
                "contacto":"Juan",
                "email":"juan@empresa.com"
            }''::jsonb
        )',
        '%RFC inválido%',
        'Rechaza RFC con formato inválido'
    );

    -- Test 3: Rechaza RFC duplicado
    SELECT throws_matching(
        'SELECT admin_crea_empresa_corporativa(
            ''{
                "nombre":"Segunda Empresa",
                "rfc":"ABC000000000",
                "sector":"logistica"
            }''::jsonb,
            ''{
                "contacto":"María",
                "email":"maria@empresa.com"
            }''::jsonb
        )',
        '%RFC duplicado%|%único%',
        'No permite RFC duplicado'
    );

    -- Test 4: Requiere campo nombre
    SELECT throws_matching(
        'SELECT admin_crea_empresa_corporativa(
            ''{
                "rfc":"XYZ000000000",
                "sector":"logistica"
            }''::jsonb,
            ''{
                "contacto":"Pedro",
                "email":"pedro@empresa.com"
            }''::jsonb
        )',
        '%nombre%|%requerido%',
        'Campo nombre es obligatorio'
    );

    -- Test 5: Registra en auditoría
    SELECT is(
        COUNT(*),
        1,
        'Auditoría registra creación de empresa'
    ) FROM auditoria_empresas 
    WHERE accion = 'crear' 
    AND usuario_id = '550e8400-e29b-41d4-a716-446655440099'::uuid;

    SELECT * FROM finish();
ROLLBACK;