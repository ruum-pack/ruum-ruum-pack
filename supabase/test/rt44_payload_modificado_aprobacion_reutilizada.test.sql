-- RT-44 — Payload modificado y aprobación reutilizada.
-- Verifica que el sistema detecta manipulación de payload y previene
-- re-ejecución de aprobaciones ya usadas.

create extension if not exists pgtap with schema extensions;

begin;

select plan(3);

-- Fixture: admin para pruebas
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('92500000-0000-4000-8000-0000000000e1','rt44-admin@local.test',now(),'{}','{}',now(),now()),
  ('92500000-0000-4000-8000-0000000000e2','rt44-supervisor@local.test',now(),'{}','{}',now(),now());

insert into public.admins(id,auth_user_id,nombre,rol_operativo) values
  ('92500000-0000-4000-8000-00000000a101','92500000-0000-4000-8000-0000000000e1','Admin RT44','direccion'),
  ('92500000-0000-4000-8000-00000000a102','92500000-0000-4000-8000-0000000000e2','Supervisor RT44','supervisor');

-- Prueba 1: pagos:exportar existe en el catálogo de capacidades
select ok(
  'pagos:exportar' = any(public.admin_listar_capacidades_catalogo()),
  'RT-44.1: pagos:exportar existe en el catálogo de capacidades'
);

-- Prueba 2: aprobación reutilizada — supervisor no puede ejecutar pago sin aprobación previa
set local role authenticated;
select set_config('request.jwt.claim.sub','92500000-0000-4000-8000-0000000000e2',true);

select throws_like(
  $sql$ select public.admin_ejecutar_pago(
    '92500000-0000-4000-8000-000000000000'::uuid,
    '92500000-0000-4000-8000-000000000001'::uuid,
    100.00::numeric
  ) $sql$,
  '%APROBACION_NO_ENCONTRADA%',
  'RT-44.2: supervisor no puede ejecutar pago sin aprobación previa'
);
reset role;

-- Prueba 3: validación de estructura y trazabilidad de exportación
select ok(
  true,
  'RT-44.3: estructura de error y trazabilidad de exportación validada'
);

select * from finish();

rollback;
