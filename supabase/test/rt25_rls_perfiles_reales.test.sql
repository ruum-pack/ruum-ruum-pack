-- RT-25 — Matriz RLS con los cinco perfiles operativos reales.
-- Falla en el primer aislamiento o permiso administrativo incorrecto.

create extension if not exists pgtap with schema extensions;

begin;

select plan(11);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('92500000-0000-4000-8000-00000000000a','rt25-a@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-00000000000b','rt25-b@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000ad','rt25-admin@local.test',now(),'{}','{}',now(),now());

insert into public.admins(id,auth_user_id,nombre)
values('92500000-0000-4000-8000-000000000aad','92500000-0000-4000-8000-0000000000ad','Admin RT-25');

insert into public.solicitudes_conductor(id,auth_user_id,estado,enviado_en,datos_personales) values
  ('92500000-0000-4000-8000-00000000001a','92500000-0000-4000-8000-00000000000a','en_revision',now(),'{"nombre":"Conductor A"}'),
  ('92500000-0000-4000-8000-00000000001b','92500000-0000-4000-8000-00000000000b','en_revision',now(),'{"nombre":"Conductor B"}');

insert into public.documentos_conductor(id,solicitud_id,tipo,nombre_archivo,url,estado,version,es_actual) values
  ('92500000-0000-4000-8000-00000000002a','92500000-0000-4000-8000-00000000001a','licencia_frente','a.jpg','rt25/a.jpg','en_revision',1,true),
  ('92500000-0000-4000-8000-00000000002b','92500000-0000-4000-8000-00000000001b','licencia_frente','b.jpg','rt25/b.jpg','en_revision',1,true);

-- 1. Anónimo: una falta de privilegio y cero filas visibles son ambos resultados seguros.
set local role anon;
select set_config('request.jwt.claim.sub','',true);

select ok(
  (select count(*) from public.solicitudes_conductor) = 0,
  'RT-25.1: anónimo no puede ver solicitudes_conductor'
);

select ok(
  (select count(*) from public.documentos_conductor) = 0,
  'RT-25.2: anónimo no puede ver documentos_conductor'
);
reset role;

-- 2. Conductor A: ve sólo lo propio y no puede mutar recursos administrativos.
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-00000000000a',true);

select is(
  (select count(*) from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001a')::int,
  1,
  'RT-25.3: conductor A ve su propia solicitud'
);

select is(
  (select count(*) from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001b')::int,
  0,
  'RT-25.4: conductor A no ve solicitudes ajenas'
);

select throws_ok(
  $sql$ select public.revisar_documento_conductor_admin('92500000-0000-4000-8000-00000000002a','aprobado',null) $sql$,
  'RT-25.5: conductor A no puede aprobar su propio documento'
);

select throws_ok(
  $sql$ update public.solicitudes_conductor set estado='aprobado' where id='92500000-0000-4000-8000-00000000001a' $sql$,
  'RT-25.6: conductor A no puede modificar directamente su estado'
);
reset role;

-- 3. Conductor B: prueba simétrica de lectura.
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-00000000000b',true);

select is(
  (select count(*) from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001b')::int,
  1,
  'RT-25.7: conductor B ve su propia solicitud'
);

select is(
  (select count(*) from public.solicitudes_conductor where id='92500000-0000-4000-8000-00000000001a')::int,
  0,
  'RT-25.8: conductor B no ve solicitudes ajenas'
);
reset role;

-- 4. Administrador: ve ambos expedientes y revisa por la RPC autorizada.
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000ad',true);

select is(
  (select count(*) from public.solicitudes_conductor where id in (
    '92500000-0000-4000-8000-00000000001a','92500000-0000-4000-8000-00000000001b'
  ))::int,
  2,
  'RT-25.9: administrador ve todos los expedientes'
);

select lives_ok(
  $sql$ select public.revisar_documento_conductor_admin('92500000-0000-4000-8000-00000000002a','aprobado','Documento validado por RT-25.') $sql$,
  'RT-25.10: administrador puede revisar documento via RPC'
);
reset role;

-- 5. Atribución correcta
select ok(
  exists(
    select 1 from public.documentos_conductor
    where id='92500000-0000-4000-8000-00000000002a'
      and estado='aprobado' and revisado_por='92500000-0000-4000-8000-000000000aad'
  ),
  'RT-25.11: la revisión administrativa quedó correctamente atribuida'
);

select * from finish();

rollback;
