-- RT-56 -- FASE 10 tracking: sesiones, heartbeat, salud, detenido vs sin señal.
create extension if not exists pgtap with schema extensions;
begin;
select plan(16);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95600000-0000-4000-8000-0000000000ad', 'rt56-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95600000-0000-4000-8000-0000000000b1', 'rt56-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('95600000-0000-4000-8000-0000000000b2', 'rt56-conductor@local.test', now(), '{}', '{}', now(), now()),
  ('95600000-0000-4000-8000-0000000000b3', 'rt56-outsider@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95600000-0000-4000-8000-0000000000aa', '95600000-0000-4000-8000-0000000000ad', 'Admin RT-56');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values
  ('95600000-0000-4000-8000-000000000101', '95600000-0000-4000-8000-0000000000b1', 'personal', 'personal', 'verificado', true),
  ('95600000-0000-4000-8000-000000000102', '95600000-0000-4000-8000-0000000000b3', 'personal', 'personal', 'verificado', false);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values ('95600000-0000-4000-8000-000000000201', '95600000-0000-4000-8000-0000000000b2', 'Conductor RT-56', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95600000-0000-4000-8000-000000000301', '95600000-0000-4000-8000-000000000101', 'sedan', 'RT56', 'Modelo', 2026, 'RT56ABC', true, true, true, true);

insert into public.traslados (id, estado, usuario_id, vehiculo_id, conductor_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia)
values
  ('95600000-0000-4000-8000-000000000401', 'conductor_asignado', '95600000-0000-4000-8000-000000000101', '95600000-0000-4000-8000-000000000301', '95600000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4000, -99.1000, 'O', 'CDMX', 19.5000, -99.2000, 'D', 'CDMX', 'al_cierre', gen_random_uuid()),
  ('95600000-0000-4000-8000-000000000402', 'conductor_asignado', '95600000-0000-4000-8000-000000000101', '95600000-0000-4000-8000-000000000301', '95600000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4000, -99.1000, 'O', 'CDMX', 19.5000, -99.2000, 'D', 'CDMX', 'al_cierre', gen_random_uuid());

-- 10.2: inicio explícito e idempotente (como conductor asignado)
set local role authenticated;
select set_config('request.jwt.claim.sub', '95600000-0000-4000-8000-0000000000b2', true);
select public.iniciar_sesion_tracking('95600000-0000-4000-8000-000000000401') as sesion
\gset
select ok((select :'sesion' is not null), 'RT-56.1: inicia sesión');
select is(public.iniciar_sesion_tracking('95600000-0000-4000-8000-000000000401')::text, :'sesion', 'RT-56.2: iniciar es idempotente');

-- 10.4/10.5/10.6/10.7: heartbeat registra punto, salud y sesión
select public.registrar_heartbeat_tracking('95600000-0000-4000-8000-000000000401', 19.4300, -99.1300, 12.5, 8.0, 80, true, 'android') as hb
\gset
select is((:'hb'::jsonb->'salud'->>'estado'), 'HEALTHY', 'RT-56.3: señal fresca es HEALTHY');
select is((:'hb'::jsonb->>'sesion_id'), :'sesion', 'RT-56.4: heartbeat usa la sesión');
select is((select count(*) from public.ubicaciones_traslado where traslado_id = '95600000-0000-4000-8000-000000000401')::int, 1, 'RT-56.5: punto registrado');

-- detenido: velocidad ~0 con señal fresca
select public.registrar_heartbeat_tracking('95600000-0000-4000-8000-000000000401', 19.4301, -99.1301, 10.0, 0.0, 79, true, 'android') as hb2
\gset
select is((:'hb2'::jsonb->'salud'->>'detenido'), 'true', 'RT-56.6: detecta vehículo detenido');
select is((:'hb2'::jsonb->'salud'->>'estado'), 'HEALTHY', 'RT-56.7: detenido sigue HEALTHY (hay señal)');

-- coordenadas inválidas y ajenos se rechazan
select throws_ok(
  $$ select public.registrar_heartbeat_tracking('95600000-0000-4000-8000-000000000401', 200.0, -99.13) $$,
  null, null, 'RT-56.8: latitud inválida bloqueada'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '95600000-0000-4000-8000-0000000000b3', true);
select throws_ok(
  $$ select public.registrar_heartbeat_tracking('95600000-0000-4000-8000-000000000401', 19.43, -99.13) $$,
  null, null, 'RT-56.9: outsider bloqueado'
);
reset role;

-- 10.8: STALE y OFFLINE por antigüedad
update public.tracking_salud_traslado set ultimo_envio_en = now() - interval '10 minutes' where traslado_id = '95600000-0000-4000-8000-000000000401';
select is((public.evaluar_salud_tracking('95600000-0000-4000-8000-000000000401')->>'estado'), 'STALE', 'RT-56.10: 10 min es STALE');
update public.tracking_salud_traslado set ultimo_envio_en = now() - interval '20 minutes' where traslado_id = '95600000-0000-4000-8000-000000000401';
select is((public.evaluar_salud_tracking('95600000-0000-4000-8000-000000000401')->>'estado'), 'OFFLINE', 'RT-56.11: 20 min es OFFLINE');

-- 10.10: alejamiento con velocidad marca desviación
set local role authenticated;
select set_config('request.jwt.claim.sub', '95600000-0000-4000-8000-0000000000b2', true);
select public.registrar_heartbeat_tracking('95600000-0000-4000-8000-000000000402', 19.5000, -99.2000, 10.0, 5.0, 70, true, 'android');
select public.registrar_heartbeat_tracking('95600000-0000-4000-8000-000000000402', 19.4000, -99.1000, 10.0, 10.0, 69, true, 'android');
select is((select desviacion_sospechosa from public.tracking_sesiones where traslado_id = '95600000-0000-4000-8000-000000000402' and estado = 'activa'), true, 'RT-56.12: alejamiento marca desviación');
reset role;

-- 10.3: cierre explícito + automático al terminar
set local role authenticated;
select set_config('request.jwt.claim.sub', '95600000-0000-4000-8000-0000000000b2', true);
select public.finalizar_sesion_tracking('95600000-0000-4000-8000-000000000402');
select is((select estado from public.tracking_sesiones where traslado_id = '95600000-0000-4000-8000-000000000402' order by creado_en desc limit 1), 'cerrada', 'RT-56.13: cierre explícito');
select throws_ok(
  $$ select public.finalizar_sesion_tracking('95600000-0000-4000-8000-000000000402') $$,
  null, null, 'RT-56.14: sin sesión activa falla claro'
);
reset role;

update public.traslados set estado = 'servicio_cancelado' where id = '95600000-0000-4000-8000-000000000401';
select is((select estado from public.tracking_sesiones where traslado_id = '95600000-0000-4000-8000-000000000401' order by creado_en desc limit 1), 'cerrada', 'RT-56.15: terminal cierra solo');

-- RLS
set local role authenticated;
select set_config('request.jwt.claim.sub', '95600000-0000-4000-8000-0000000000b1', true);
select ok((select count(*) from public.tracking_sesiones where traslado_id = '95600000-0000-4000-8000-000000000401')::int >= 1, 'RT-56.16: usuario ve sesiones');
reset role;

select * from finish();
rollback;
