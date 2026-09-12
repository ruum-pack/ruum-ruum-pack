-- RT-61 -- FASE 15 gaps puntuales: aislamiento entre empresas, doble cobro,
-- doble pago, evidencia no duplicable, lote offline idempotente y pagos
-- fuera del alcance del conductor.
create extension if not exists pgtap with schema extensions;
begin;
select plan(18);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('96100000-0000-4000-8000-0000000000ad', 'rt61-admin@local.test', now(), '{}', '{}', now(), now()),
  ('96100000-0000-4000-8000-0000000000b1', 'rt61-a@local.test', now(), '{}', '{}', now(), now()),
  ('96100000-0000-4000-8000-0000000000b2', 'rt61-b@local.test', now(), '{}', '{}', now(), now()),
  ('96100000-0000-4000-8000-0000000000b3', 'rt61-conductor@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('96100000-0000-4000-8000-0000000000aa', '96100000-0000-4000-8000-0000000000ad', 'Admin RT-61', 'direccion');

insert into public.empresas (id, nombre)
values
  ('96100000-0000-4000-8000-0000000000e1', 'Empresa A RT-61'),
  ('96100000-0000-4000-8000-0000000000e2', 'Empresa B RT-61');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values
  ('96100000-0000-4000-8000-000000000101', '96100000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '96100000-0000-4000-8000-0000000000e1'),
  ('96100000-0000-4000-8000-000000000102', '96100000-0000-4000-8000-0000000000b2', 'empresa', 'titular_empresa', 'verificado', true, '96100000-0000-4000-8000-0000000000e2');

insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
values
  ('96100000-0000-4000-8000-0000000000e1', '96100000-0000-4000-8000-000000000101', 'owner', 'activo'),
  ('96100000-0000-4000-8000-0000000000e2', '96100000-0000-4000-8000-000000000102', 'owner', 'activo');

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values ('96100000-0000-4000-8000-000000000201', '96100000-0000-4000-8000-0000000000b3', 'Conductor RT-61', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values
  ('96100000-0000-4000-8000-000000000301', '96100000-0000-4000-8000-000000000101', 'sedan', 'RT61', 'A', 2026, 'RT61AAA', true, true, true, true),
  ('96100000-0000-4000-8000-000000000302', '96100000-0000-4000-8000-000000000102', 'sedan', 'RT61', 'B', 2026, 'RT61BBB', true, true, true, true);

insert into public.operaciones (id, folio, empresa_id, nombre, tipo, estado)
values
  ('96100000-0000-4000-8000-000000000001', 'OP-RT61-A', '96100000-0000-4000-8000-0000000000e1', 'Op A', 'flota', 'en_curso'),
  ('96100000-0000-4000-8000-000000000002', 'OP-RT61-B', '96100000-0000-4000-8000-0000000000e2', 'Op B', 'flota', 'en_curso');

alter table public.traslados disable trigger traslados_sincronizar_asignacion_insert;
insert into public.traslados (id, estado, usuario_id, vehiculo_id, conductor_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia, operation_id)
values
  ('96100000-0000-4000-8000-000000000401', 'traslado_en_curso', '96100000-0000-4000-8000-000000000101', '96100000-0000-4000-8000-000000000301', '96100000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '96100000-0000-4000-8000-000000000001'),
  ('96100000-0000-4000-8000-000000000402', 'traslado_en_curso', '96100000-0000-4000-8000-000000000102', '96100000-0000-4000-8000-000000000302', '96100000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '96100000-0000-4000-8000-000000000002');
alter table public.traslados enable trigger traslados_sincronizar_asignacion_insert;

-- Organization: aislamiento entre empresas (traslados y operaciones)
set local role authenticated;
select set_config('request.jwt.claim.sub', '96100000-0000-4000-8000-0000000000b1', true);
select is((select count(*) from public.traslados where id = '96100000-0000-4000-8000-000000000402')::int, 0, 'RT-61.1: A no ve traslados de B');
select is((select count(*) from public.traslados where id = '96100000-0000-4000-8000-000000000401')::int, 1, 'RT-61.2: A ve su traslado');
select is((select count(*) from public.operaciones where id = '96100000-0000-4000-8000-000000000002')::int, 0, 'RT-61.3: A no ve la operación de B');
select is((select count(*) from public.operaciones where id = '96100000-0000-4000-8000-000000000001')::int, 1, 'RT-61.4: A ve su operación');
reset role;

-- Payment: doble cobro bloqueado por unicidad de Stripe
insert into public.pagos (id, traslado_id, monto, momento, estado, metodo, stripe_payment_intent_id, stripe_event_id)
values ('96100000-0000-4000-8000-000000000501', '96100000-0000-4000-8000-000000000401', 1000, 'al_cierre', 'completado', 'tarjeta', 'pi_rt61_1', 'evt_rt61_1');
select throws_ok(
  $$ insert into public.pagos (traslado_id, monto, momento, estado, metodo, stripe_payment_intent_id) values ('96100000-0000-4000-8000-000000000401', 1000, 'al_cierre', 'completado', 'tarjeta', 'pi_rt61_1') $$,
  '23505', null, 'RT-61.5: mismo PaymentIntent no cobra dos veces'
);
select throws_ok(
  $$ insert into public.pagos (traslado_id, monto, momento, estado, metodo, stripe_payment_intent_id, stripe_event_id) values ('96100000-0000-4000-8000-000000000401', 1000, 'al_cierre', 'completado', 'tarjeta', 'pi_rt61_2', 'evt_rt61_1') $$,
  '23505', null, 'RT-61.6: webhook reintentado no duplica el pago'
);
select is((select count(*) from public.pagos where stripe_payment_intent_id = 'pi_rt61_1')::int, 1, 'RT-61.7: un solo cobro persistido');

-- conductor fuera del dinero: sin insert en pagos
set local role authenticated;
select set_config('request.jwt.claim.sub', '96100000-0000-4000-8000-0000000000b3', true);
select throws_ok(
  $$ insert into public.pagos (traslado_id, monto, momento, estado, metodo) values ('96100000-0000-4000-8000-000000000401', 10, 'al_cierre', 'pendiente', 'tarjeta') $$,
  '42501', null, 'RT-61.8: el conductor no registra pagos'
);
reset role;

-- Payout: doble pago bloqueado por transfer único
insert into public.payouts_conductor (id, conductor_id, periodo_inicio, periodo_fin, monto_bruto, monto_neto, estado, referencia_pago)
values ('96100000-0000-4000-8000-000000000502', '96100000-0000-4000-8000-000000000201', current_date - 7, current_date - 1, 5000, 4800, 'pendiente', null);
update public.payouts_conductor set estado = 'procesado', referencia_pago = 'tr_rt61_1', procesado_en = now()
where id = '96100000-0000-4000-8000-000000000502';
select throws_ok(
  $$ insert into public.payouts_conductor (conductor_id, periodo_inicio, periodo_fin, monto_bruto, monto_neto, estado, referencia_pago) values ('96100000-0000-4000-8000-000000000201', current_date - 7, current_date - 1, 5000, 4800, 'procesado', 'tr_rt61_1') $$,
  '23505', null, 'RT-61.9: mismo transfer no paga dos veces'
);
select is((select sum(monto_neto) from public.payouts_conductor where conductor_id = '96100000-0000-4000-8000-000000000201' and estado = 'procesado')::numeric, 4800::numeric, 'RT-61.10: el periodo se pagó una sola vez');

-- Evidence: la inspección operativa no se duplica por traslado+tipo
insert into public.evidencia_inspecciones (traslado_id, tipo, kilometraje)
values ('96100000-0000-4000-8000-000000000401', 'inicial', 100);
select throws_ok(
  $$ insert into public.evidencia_inspecciones (traslado_id, tipo, kilometraje) values ('96100000-0000-4000-8000-000000000401', 'inicial', 101) $$,
  '23505', null, 'RT-61.11: inspección inicial no se duplica'
);
select is((select kilometraje from public.evidencia_inspecciones where traslado_id = '96100000-0000-4000-8000-000000000401' and tipo = 'inicial')::numeric, 100::numeric, 'RT-61.12: conserva la primera inspección');

-- Tracking offline/recovery: reintento del mismo lote no duplica puntos
set local role authenticated;
select set_config('request.jwt.claim.sub', '96100000-0000-4000-8000-0000000000b3', true);
select public.registrar_telemetria_lote('96100000-0000-4000-8000-000000000401'::uuid, ('[{"localId":"96100000-0000-4000-8000-000000000601","lat":19.43,"lng":-99.13,"deviceTimestamp":"' || (now() - interval '2 hours')::text || '"}]')::jsonb) as lote1
\gset
select is((:'lote1'::jsonb->>'insertados')::int, 1, 'RT-61.13: lote offline acepta el punto');
select public.registrar_telemetria_lote('96100000-0000-4000-8000-000000000401'::uuid, ('[{"localId":"96100000-0000-4000-8000-000000000601","lat":19.43,"lng":-99.13,"deviceTimestamp":"' || (now() - interval '2 hours')::text || '"}]')::jsonb) as lote2
\gset
select is((:'lote2'::jsonb->>'duplicados')::int, 1, 'RT-61.14: reintento detecta duplicado');
select is((select count(*) from public.ubicaciones_traslado where traslado_id = '96100000-0000-4000-8000-000000000401')::int, 1, 'RT-61.15: sin puntos duplicados');
reset role;
select ok((select dispositivo_timestamp < servidor_timestamp from public.ubicaciones_traslado where traslado_id = '96100000-0000-4000-8000-000000000401'), 'RT-61.16: recovery conserva el timestamp del dispositivo');

-- RBAC: outsider sin empresa no toca nada ajeno
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('96100000-0000-4000-8000-0000000000b4', 'rt61-out@local.test', now(), '{}', '{}', now(), now());
insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('96100000-0000-4000-8000-000000000103', '96100000-0000-4000-8000-0000000000b4', 'personal', 'personal', 'verificado', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '96100000-0000-4000-8000-0000000000b4', true);
select is((select count(*) from public.traslados where id in ('96100000-0000-4000-8000-000000000401','96100000-0000-4000-8000-000000000402'))::int, 0, 'RT-61.17: outsider no ve traslados ajenos');
select is((select count(*) from public.operaciones where id in ('96100000-0000-4000-8000-000000000001','96100000-0000-4000-8000-000000000002'))::int, 0, 'RT-61.18: outsider no ve operaciones ajenas');
reset role;

select * from finish();
rollback;
