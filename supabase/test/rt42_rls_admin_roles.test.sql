-- RT-42 — RLS con los cinco roles administrativos operativos.
-- Verifica aislamiento de permisos y acceso a tablas críticas.

create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('92500000-0000-4000-8000-0000000000a1','rt42-operador@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a2','rt42-supervisor@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a3','rt42-finanzas@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a4','rt42-compliance@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000a5','rt42-direccion@local.test',now(),'{}','{}',now(),now());

insert into public.admins(id,auth_user_id,nombre,rol_operativo) values
  ('92500000-0000-4000-8000-00000000a001','92500000-0000-4000-8000-0000000000a1','Operador RT42','operador'),
  ('92500000-0000-4000-8000-00000000a002','92500000-0000-4000-8000-0000000000a2','Supervisor RT42','supervisor'),
  ('92500000-0000-4000-8000-00000000a003','92500000-0000-4000-8000-0000000000a3','Finanzas RT42','finanzas'),
  ('92500000-0000-4000-8000-00000000a004','92500000-0000-4000-8000-0000000000a4','Compliance RT42','compliance'),
  ('92500000-0000-4000-8000-00000000a005','92500000-0000-4000-8000-0000000000a5','Direccion RT42','direccion');

insert into public.solicitudes_conductor(id,auth_user_id,estado,enviado_en,datos_personales) values
  ('92500000-0000-4000-8000-0000000000c1','92500000-0000-4000-8000-0000000000a1','en_revision',now(),'{"nombre":"Conductor RT42"}');

insert into public.registro_auditoria(traslado_id,evento,actor,actor_id,datos) values
  (null,'creacion_cuenta','admin','92500000-0000-4000-8000-00000000a001','{"prueba":"rt42"}');

-- 1. Operador: solo ve su propio perfil admin
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000a1',true);

select is(
  (select count(*)::int from public.admins),
  1,
  'RT-42.1: operador debe ver solo su propio perfil admin'
);

select is(
  (select count(*)::int from public.solicitudes_conductor),
  1,
  'RT-42.2: operador debe ver solicitudes_conductores'
);

select is(
  (select count(*)::int from public.pagos),
  0,
  'RT-42.3: operador no debe ver pagos'
);
reset role;

-- 2. Finanzas: ve solicitudes_conductor
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000a3',true);

select is(
  (select count(*)::int from public.solicitudes_conductor),
  1,
  'RT-42.4: finanzas debe ver solicitudes_conductor'
);
reset role;

-- 3. Dirección: acceso completo
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000a5',true);

select is(
  (select count(*)::int from public.admins),
  5,
  'RT-42.5: dirección debe ver todos los admins'
);

select is(
  (select count(*)::int from public.solicitudes_conductor),
  1,
  'RT-42.6: dirección debe ver solicitudes_conductores'
);
reset role;

select * from finish();

rollback;
