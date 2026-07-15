begin;

select plan(5);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '92800000-0000-4000-8000-000000000001',
  'conductor-banco@example.test',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.conductores (id, auth_user_id, nombre, estado)
values (
  '92810000-0000-4000-8000-000000000001',
  '92800000-0000-4000-8000-000000000001',
  'Conductor Banco',
  'activo'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '92800000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    select public.conductor_guarda_datos_bancarios(
      'Conductor Banco',
      'BBVA',
      '012345678901234567',
      '4111111111111111'
    )
  $$,
  'el conductor guarda sus datos bancarios desde el RPC'
);

select is(
  (
    select estado::text
    from public.datos_bancarios_conductor
    where conductor_id = '92810000-0000-4000-8000-000000000001'
  ),
  'en_revision',
  'los datos quedan en revisión'
);

reset role;

select is(
  (
    select datos->>'clabe_ultimos4'
    from public.registro_auditoria
    where actor_id = '92810000-0000-4000-8000-000000000001'
      and evento = 'actualizacion_datos_bancarios_conductor'
    order by timestamp desc
    limit 1
  ),
  '4567',
  'auditoria solo conserva últimos 4 de CLABE'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '92800000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$
    select public.conductor_guarda_datos_bancarios(
      'Conductor Banco',
      'BBVA',
      '123',
      '4111111111111111'
    )
  $$,
  '23514',
  'La CLABE debe tener exactamente 18 digitos.',
  'rechaza CLABE inválida desde Postgres'
);

select throws_ok(
  $$
    select public.conductor_guarda_datos_bancarios(
      'Conductor Banco',
      'BBVA',
      '012345678901234567',
      '123'
    )
  $$,
  '23514',
  'El numero de tarjeta debe tener entre 16 y 19 digitos.',
  'rechaza tarjeta inválida desde Postgres'
);

select * from finish();

rollback;
