-- RT-55 -- FASE 9 custodia: registro, cadena hash, monotonía, append-only, RLS y backfill.
create extension if not exists pgtap with schema extensions;
begin;
select plan(16);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95500000-0000-4000-8000-0000000000ad', 'rt55-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95500000-0000-4000-8000-0000000000b1', 'rt55-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('95500000-0000-4000-8000-0000000000b2', 'rt55-conductor@local.test', now(), '{}', '{}', now(), now()),
  ('95500000-0000-4000-8000-0000000000b3', 'rt55-outsider@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95500000-0000-4000-8000-0000000000aa', '95500000-0000-4000-8000-0000000000ad', 'Admin RT-55');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values
  ('95500000-0000-4000-8000-000000000101', '95500000-0000-4000-8000-0000000000b1', 'personal', 'personal', 'verificado', true),
  ('95500000-0000-4000-8000-000000000102', '95500000-0000-4000-8000-0000000000b3', 'personal', 'personal', 'verificado', false);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values ('95500000-0000-4000-8000-000000000201', '95500000-0000-4000-8000-0000000000b2', 'Conductor RT-55', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95500000-0000-4000-8000-000000000301', '95500000-0000-4000-8000-000000000101', 'sedan', 'RT55', 'Modelo', 2026, 'RT55ABC', true, true, true, true);

insert into public.traslados (id, estado, usuario_id, vehiculo_id, conductor_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia)
values
  ('95500000-0000-4000-8000-000000000401', 'conductor_asignado', '95500000-0000-4000-8000-000000000101', '95500000-0000-4000-8000-000000000301', '95500000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid()),
  ('95500000-0000-4000-8000-000000000402', 'conductor_asignado', '95500000-0000-4000-8000-000000000102', '95500000-0000-4000-8000-000000000301', '95500000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid());

insert into public.evidencia_fotos (id, traslado_id, tipo, angulo, url, lat, lng)
values
  ('95500000-0000-4000-8000-000000000501', '95500000-0000-4000-8000-000000000401', 'inicial', 'frente', 'https://cdn.test/f1.jpg', 19.4326, -99.1332),
  ('95500000-0000-4000-8000-000000000502', '95500000-0000-4000-8000-000000000402', 'inicial', 'frente', 'https://cdn.test/f2.jpg', 19.4326, -99.1332);

-- 9.2/9.7: registro como conductor con foto, odo y firma
set local role authenticated;
select set_config('request.jwt.claim.sub', '95500000-0000-4000-8000-0000000000b2', true);
select public.registrar_evento_custodia(
  '95500000-0000-4000-8000-000000000401', 'vehicle_received',
  19.4326, -99.1332, 100.0, '3/4', null,
  array['95500000-0000-4000-8000-000000000501']::uuid[],
  null, 'pin_conductor', true, 'Recibe conforme', '{}'
) as ev1
\gset
select ok((select :'ev1' is not null), 'RT-55.1: conductor registra evento');
select is((select prev_hash from public.custodia_eventos where id = :'ev1'::uuid), 'GENESIS', 'RT-55.2: primer eslabón GENESIS');
select ok((select hash_cadena from public.custodia_eventos where id = :'ev1'::uuid) ~ '^[0-9a-f]{64}$', 'RT-55.3: sello sha256');
select is((select pin_verificado from public.custodia_eventos where id = :'ev1'::uuid), true, 'RT-55.4: PIN registrado');

select public.registrar_evento_custodia('95500000-0000-4000-8000-000000000401', 'transfer_started', null, null, 150.0, null) as ev2
\gset
select is((select prev_hash from public.custodia_eventos where id = :'ev2'::uuid), (select hash_cadena from public.custodia_eventos where id = :'ev1'::uuid), 'RT-55.5: cadena encadenada');
select ok(public.verificar_cadena_custodia('95500000-0000-4000-8000-000000000401'), 'RT-55.6: verificación íntegra');

-- 9.8: odómetro regresivo se rechaza
select throws_ok(
  $$ select public.registrar_evento_custodia('95500000-0000-4000-8000-000000000401', 'stop_registered', null, null, 120.0, null) $$,
  null, null, 'RT-55.7: kilometraje regresivo bloqueado'
);

-- 9.4: foto ajena se rechaza
select throws_ok(
  $$ select public.registrar_evento_custodia('95500000-0000-4000-8000-000000000401', 'vehicle_inspected', null, null, null, null, null, array['95500000-0000-4000-8000-000000000502']::uuid[]) $$,
  null, null, 'RT-55.8: evidencia ajena bloqueada'
);
reset role;

-- 9.7: ajeno sin relación no registra
set local role authenticated;
select set_config('request.jwt.claim.sub', '95500000-0000-4000-8000-0000000000b3', true);
select throws_ok(
  $$ select public.registrar_evento_custodia('95500000-0000-4000-8000-000000000401', 'stop_registered', null, null, null, null) $$,
  null, null, 'RT-55.9: outsider bloqueado'
);
select is((select count(*) from public.custodia_eventos where traslado_id = '95500000-0000-4000-8000-000000000401')::int, 0, 'RT-55.10: outsider no ve eventos ajenos');
reset role;

-- append-only
select throws_ok(
  format('update public.custodia_eventos set notas = %L where id = %L', 'hack', :'ev1'),
  null, null,
  'RT-55.11: update bloqueado'
);
select throws_ok(
  $$ delete from public.custodia_eventos where traslado_id = '95500000-0000-4000-8000-000000000401' $$,
  null, null,
  'RT-55.12: delete bloqueado'
);

-- RLS: dueño ve su cadena
set local role authenticated;
select set_config('request.jwt.claim.sub', '95500000-0000-4000-8000-0000000000b1', true);
select is((select count(*) from public.custodia_eventos where traslado_id = '95500000-0000-4000-8000-000000000401')::int, 2, 'RT-55.13: dueño ve su cadena');
reset role;

-- 9.12/backfill vivo: avanzar estados genera eventos encadenados
update public.traslados set estado = 'conductor_en_camino_al_origen' where id = '95500000-0000-4000-8000-000000000401';
update public.traslados set estado = 'conductor_en_punto_de_recoleccion' where id = '95500000-0000-4000-8000-000000000401';
update public.traslados set estado = 'verificacion_vehiculo_en_proceso' where id = '95500000-0000-4000-8000-000000000401';
update public.traslados set estado = 'evidencia_inicial_en_proceso' where id = '95500000-0000-4000-8000-000000000401';
update public.traslados set estado = 'evidencia_inicial_completada' where id = '95500000-0000-4000-8000-000000000401';
update public.traslados set estado = 'vehiculo_recibido' where id = '95500000-0000-4000-8000-000000000401';
update public.traslados set estado = 'traslado_en_curso' where id = '95500000-0000-4000-8000-000000000401';
select ok(
  (select count(*) from public.custodia_eventos where traslado_id = '95500000-0000-4000-8000-000000000401' and tipo = 'transfer_started')::int >= 1,
  'RT-55.14: avance genera evento de inicio'
);
select ok(public.verificar_cadena_custodia('95500000-0000-4000-8000-000000000401'), 'RT-55.15: cadena íntegra tras avance');
select is(
  (select count(*) from public.custodia_evento_fotos where evento_id = :'ev1'::uuid)::int,
  1, 'RT-55.16: foto enlazada al evento'
);

select * from finish();
rollback;
