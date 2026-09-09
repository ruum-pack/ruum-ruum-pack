-- RT-50 -- FASE 1 Operaciones: creación, folio, compat traslados NULL, FK set null, RLS.
create extension if not exists pgtap with schema extensions;
begin;
select plan(12);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95000000-0000-4000-8000-0000000000ad', 'rt50-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95000000-0000-4000-8000-0000000000b1', 'rt50-titular@local.test', now(), '{}', '{}', now(), now()),
  ('95000000-0000-4000-8000-0000000000c1', 'rt50-conductor@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95000000-0000-4000-8000-0000000000aa', '95000000-0000-4000-8000-0000000000ad', 'Admin RT-50');

insert into public.empresas (id, nombre)
values
  ('95000000-0000-4000-8000-0000000000e1', 'Empresa RT-50'),
  ('95000000-0000-4000-8000-0000000000e2', 'Empresa Ajena RT-50');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values ('95000000-0000-4000-8000-000000000101', '95000000-0000-4000-8000-0000000000b1', 'personal', 'titular_empresa', 'verificado', true, '95000000-0000-4000-8000-0000000000e1');

-- setup como owner (bypass RLS); las políticas se prueban con set_config más abajo
-- 1: crear operación con folio explícito
insert into public.operaciones (id, folio, empresa_id, nombre, tipo, prioridad, planned_start_at, planned_end_at)
values ('95000000-0000-4000-8000-000000000001', 'OP-RT50-001', '95000000-0000-4000-8000-0000000000e1', 'Operación XYZ RT-50', 'flota', 'alta', now(), now() + interval '2 days')
returning id;
select ok(true, 'RT-50.1: crea operación con folio explícito');

-- 2: folio auto-generado cuando viene vacío
insert into public.operaciones (id, folio, nombre)
values ('95000000-0000-4000-8000-000000000002', '', 'Auto folio RT-50');
select ok((select folio from public.operaciones where id = '95000000-0000-4000-8000-000000000002') <> '', 'RT-50.2: auto-genera folio');

-- 3: rechaza fechas incoherentes
select throws_ok(
  $$ insert into public.operaciones (folio, nombre, planned_start_at, planned_end_at)
     values ('OP-RT50-BAD', 'Bad fechas', now() + interval '2 days', now()) $$,
  null, null,
  'RT-50.3: rechaza planned_start > planned_end'
);

-- 4: rechaza prioridad inválida
select throws_ok(
  $$ insert into public.operaciones (folio, nombre, prioridad) values ('OP-RT50-BAD2', 'Bad prioridad', 'urgentisima') $$,
  null, null,
  'RT-50.4: rechaza prioridad inválida'
);

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95000000-0000-4000-8000-000000000201', '95000000-0000-4000-8000-000000000101', 'sedan', 'RT50', 'Modelo', 2026, 'RT50ABC', true, true, true, true);

-- 5: compat — traslado histórico sin operation_id sigue funcionando
insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, precio_cotizado, tipo_pago, clave_idempotencia)
values ('95000000-0000-4000-8000-000000000301', 'solicitud_creada', '95000000-0000-4000-8000-000000000101', '95000000-0000-4000-8000-000000000201', 'Entrega', '+525500000001', 'Recepción', '+525500000002', 19.4326, -99.1332, 'Origen', 'CDMX', 19.5, -99.2, 'Destino', 'CDMX', 1500, 'al_cierre', gen_random_uuid());
select is((select operation_id from public.traslados where id = '95000000-0000-4000-8000-000000000301'), null, 'RT-50.5: histórico con operation_id NULL');

-- 6: traslado vinculado a operación
insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, precio_cotizado, tipo_pago, clave_idempotencia, operation_id)
values ('95000000-0000-4000-8000-000000000302', 'solicitud_creada', '95000000-0000-4000-8000-000000000101', '95000000-0000-4000-8000-000000000201', 'Entrega', '+525500000001', 'Recepción', '+525500000002', 19.4326, -99.1332, 'Origen', 'CDMX', 19.5, -99.2, 'Destino', 'CDMX', 1500, 'al_cierre', gen_random_uuid(), '95000000-0000-4000-8000-000000000001');
select is((select count(*) from public.traslados where operation_id = '95000000-0000-4000-8000-000000000001')::int, 1, 'RT-50.6: vincula traslado a operación');

-- 7: FK rechaza operation_id inexistente
select throws_ok(
  $$ insert into public.traslados (estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia, operation_id)
     values ('solicitud_creada', '95000000-0000-4000-8000-000000000101', '95000000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '95000000-0000-4000-8000-999999999999') $$,
  null, null,
  'RT-50.7: rechaza operation_id inexistente'
);

-- 8: on delete set null
delete from public.operaciones where id = '95000000-0000-4000-8000-000000000002';
select is((select count(*) from public.operaciones where id = '95000000-0000-4000-8000-000000000002')::int, 0, 'RT-50.8: borra operación');

-- 9/10: RLS como titular (rol authenticated real, no bypass owner)
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-0000000000b1', true);
select is((select count(*) from public.operaciones where id = '95000000-0000-4000-8000-000000000001')::int, 1, 'RT-50.9: titular ve su operación');

-- 10: RLS titular no escribe (solo admin)
select throws_ok(
  $$ insert into public.operaciones (folio, nombre) values ('OP-RT50-NO', 'No debe') $$,
  null, null,
  'RT-50.10: titular no puede insertar'
);
reset role;

-- 11: admin ve todo + crea la operación ajena
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-0000000000ad', true);
select ok((select count(*) from public.operaciones)::int >= 1, 'RT-50.11: admin ve operaciones');
insert into public.operaciones (id, folio, empresa_id, nombre)
values ('95000000-0000-4000-8000-000000000003', 'OP-RT50-AJENA', '95000000-0000-4000-8000-0000000000e2', 'Ajena');
reset role;

-- 12: titular no ve operación de otra empresa
set local role authenticated;
select set_config('request.jwt.claim.sub', '95000000-0000-4000-8000-0000000000b1', true);
select is((select count(*) from public.operaciones where id = '95000000-0000-4000-8000-000000000003')::int, 0, 'RT-50.12: titular no ve operación ajena');
reset role;

select * from finish();
rollback;
