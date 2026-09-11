-- RT-53 -- FASE 4 Assignment: oferta/aceptación/rechazo/cancelación/reasignación,
-- doble asignación bloqueada, idempotencia, score CONCER, auditoría y RLS.
create extension if not exists pgtap with schema extensions;
begin;
select plan(20);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95300000-0000-4000-8000-0000000000ad', 'rt53-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95300000-0000-4000-8000-0000000000b1', 'rt53-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('95300000-0000-4000-8000-0000000000b2', 'rt53-conductor-a@local.test', now(), '{}', '{}', now(), now()),
  ('95300000-0000-4000-8000-0000000000b3', 'rt53-conductor-b@local.test', now(), '{}', '{}', now(), now()),
  ('95300000-0000-4000-8000-0000000000b4', 'rt53-outsider@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95300000-0000-4000-8000-0000000000aa', '95300000-0000-4000-8000-0000000000ad', 'Admin RT-53');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values
  ('95300000-0000-4000-8000-000000000101', '95300000-0000-4000-8000-0000000000b1', 'personal', 'personal', 'verificado', true),
  ('95300000-0000-4000-8000-000000000102', '95300000-0000-4000-8000-0000000000b4', 'personal', 'personal', 'verificado', false);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values
  ('95300000-0000-4000-8000-000000000201', '95300000-0000-4000-8000-0000000000b2', 'Conductor A RT-53', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'),
  ('95300000-0000-4000-8000-000000000202', '95300000-0000-4000-8000-0000000000b3', 'Conductor B RT-53', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95300000-0000-4000-8000-000000000301', '95300000-0000-4000-8000-000000000101', 'sedan', 'RT53', 'Modelo', 2026, 'RT53ABC', true, true, true, true);

insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia)
values
  ('95300000-0000-4000-8000-000000000401', 'pendiente_de_conductor', '95300000-0000-4000-8000-000000000101', '95300000-0000-4000-8000-000000000301', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid()),
  ('95300000-0000-4000-8000-000000000402', 'pendiente_de_conductor', '95300000-0000-4000-8000-000000000101', '95300000-0000-4000-8000-000000000301', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid());

-- 4.5/4.6: ofrecer como admin (el traslado queda intacto hasta aceptar)
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000ad', true);
select public.ofrecer_asignacion('95300000-0000-4000-8000-000000000401', '95300000-0000-4000-8000-000000000201', 'Cobertura norte') as oferta
\gset
select is((select estado::text from public.asignaciones where id = :'oferta'), 'ofrecida', 'RT-53.1: oferta creada');
select is((select conductor_id from public.traslados where id = '95300000-0000-4000-8000-000000000401'), null, 'RT-53.2: traslado intacto hasta aceptar');

-- 4.15: reoferta idempotente devuelve la misma fila
select is(public.ofrecer_asignacion('95300000-0000-4000-8000-000000000401', '95300000-0000-4000-8000-000000000201', 'otra vez')::text, :'oferta', 'RT-53.3: reoferta idempotente');

-- 4.14: segundo conductor bloqueado mientras hay vigente
select throws_ok(
  $$ select public.ofrecer_asignacion('95300000-0000-4000-8000-000000000401', '95300000-0000-4000-8000-000000000202', 'otro') $$,
  null, null, 'RT-53.4: doble asignación bloqueada'
);
reset role;

-- 4.7: aceptar como el propio conductor
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000b2', true);
select public.aceptar_asignacion(:'oferta');
select is((select estado::text from public.asignaciones where id = :'oferta'), 'aceptada', 'RT-53.5: oferta aceptada');
select is((select estado::text from public.traslados where id = '95300000-0000-4000-8000-000000000401'), 'conductor_asignado', 'RT-53.6: traslado asignado');
select public.aceptar_asignacion(:'oferta');
select ok(true, 'RT-53.7: aceptar dos veces es no-op');
reset role;

-- 4.8: rechazar con motivo en el segundo traslado
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000ad', true);
select public.ofrecer_asignacion('95300000-0000-4000-8000-000000000402', '95300000-0000-4000-8000-000000000202', 'Cobertura sur') as oferta2
\gset
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000b3', true);
select public.rechazar_asignacion(:'oferta2', 'Fuera de zona');
select is((select motivo from public.asignaciones where id = :'oferta2'), 'Fuera de zona', 'RT-53.8: rechazo guarda motivo');
select is((select conductor_id from public.traslados where id = '95300000-0000-4000-8000-000000000402'), null, 'RT-53.9: rechazo no toca el traslado');
reset role;

-- 4.10: reasignar A -> B con cadena auditable
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000ad', true);
select public.reasignar_conductor('95300000-0000-4000-8000-000000000401', '95300000-0000-4000-8000-000000000202', 'A pide descanso') as reasig
\gset
select is((select estado::text from public.asignaciones where id = :'oferta'), 'cancelada', 'RT-53.10: anterior cancelada');
select is((select metadata->>'reemplaza_a' from public.asignaciones where id = :'reasig'), '95300000-0000-4000-8000-000000000201', 'RT-53.11: cadena quién reemplazó a quién');
select is((select conductor_id from public.traslados where id = '95300000-0000-4000-8000-000000000401'), '95300000-0000-4000-8000-000000000202', 'RT-53.12: conductor vigente es B');

-- 4.9: cancelar libera el traslado (edge Fase 4 a pendiente)
select public.cancelar_asignacion(:'reasig', 'Cliente reagenda');
select is((select estado::text from public.asignaciones where id = :'reasig'), 'cancelada', 'RT-53.13: cancelada');
select is((select estado::text from public.traslados where id = '95300000-0000-4000-8000-000000000401'), 'pendiente_de_conductor', 'RT-53.14: traslado vuelve a pendiente');
select public.ofrecer_asignacion('95300000-0000-4000-8000-000000000401', '95300000-0000-4000-8000-000000000201', 'Reoferta') as oferta3
\gset
select ok((select :'oferta3') is not null, 'RT-53.15: reoferta tras liberar funciona');
reset role;

-- ruta legacy: set directo de conductor genera su fila (funnel único)
insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia, conductor_id)
values ('95300000-0000-4000-8000-000000000403', 'pendiente_de_conductor', '95300000-0000-4000-8000-000000000101', '95300000-0000-4000-8000-000000000301', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '95300000-0000-4000-8000-000000000201');
select is((select count(*) from public.asignaciones where traslado_id = '95300000-0000-4000-8000-000000000403')::int, 1, 'RT-53.16: insert legacy genera fila');

-- 4.11: score CONCER conservado al ofrecer con competencia resuelta
insert into public.competencias_asignacion (id, traslado_id, estado, politica_version, abierta_en, cierra_en, resuelta_en, conductor_seleccionado_id)
values ('95300000-0000-4000-8000-000000000501', '95300000-0000-4000-8000-000000000402', 'resuelta', 1, now() - interval '1 hour', now() - interval '50 minutes', now() - interval '40 minutes', '95300000-0000-4000-8000-000000000202');
insert into public.solicitudes_asignacion (competencia_id, traslado_id, conductor_id, estado, categoria_puntualidad, puntualidad_porcentaje, puntualidad_muestra, asignaciones_7d, clave_desempate, viabilidad, elegibilidad_snapshot)
values ('95300000-0000-4000-8000-000000000501', '95300000-0000-4000-8000-000000000402', '95300000-0000-4000-8000-000000000202', 'seleccionada', 'a', 0.95000, 10, 2, 'rt53', 'confirmada', '{}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000ad', true);
select public.ofrecer_asignacion('95300000-0000-4000-8000-000000000402', '95300000-0000-4000-8000-000000000202', 'Ganador CONCER') as oferta4
\gset
select is((select puntaje from public.asignaciones where id = :'oferta4'), 0.95000, 'RT-53.17: puntaje CONCER conservado');
reset role;

-- 4.12: auditoría del dominio
select ok((select count(*) from public.registro_auditoria where evento = 'oferta_asignacion' and traslado_id = '95300000-0000-4000-8000-000000000401')::int >= 1, 'RT-53.18: auditoría de oferta');

-- RLS: conductor ve las suyas, outsider nada
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000b3', true);
select ok((select count(*) from public.asignaciones where conductor_id = '95300000-0000-4000-8000-000000000202')::int >= 1, 'RT-53.19: conductor ve sus asignaciones');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '95300000-0000-4000-8000-0000000000b4', true);
select is((select count(*) from public.asignaciones)::int, 0, 'RT-53.20: outsider no ve asignaciones');
reset role;

select * from finish();
rollback;
