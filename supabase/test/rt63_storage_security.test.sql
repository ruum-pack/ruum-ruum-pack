-- RT-63 — Fotos privadas y rate limit declarado.
-- Solo inspección de catálogo; no muta datos ni policies.

select plan(6);

select is(
  (select public::text from storage.buckets where id = 'fotos-perfil'),
  'false',
  'RT-63.1: fotos-perfil es privado'
);

select is(
  (select public::text from storage.buckets where id = 'fotos-perfil-conductor'),
  'false',
  'RT-63.2: fotos-perfil-conductor es privado'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('todos_ven_fotos_perfil', 'todos_ven_fotos_perfil_conductor')
  ),
  'RT-63.3: no existe policy pública de fotos'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'conductor_lee_fotos_perfil_autorizadas'
      and roles = array['authenticated']::name[]
  ),
  'RT-63.4: la lectura de foto de conductor exige authenticated'
);

select ok(
  exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'consumir_rate_limit'
  ),
  'RT-63.5: existe rate limit atómico en Postgres'
);

select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'edge_function_rate_limits'
      and grantee in ('anon', 'authenticated')
  ),
  'RT-63.6: los contadores de rate limit no son legibles por clientes'
);

select * from finish();
