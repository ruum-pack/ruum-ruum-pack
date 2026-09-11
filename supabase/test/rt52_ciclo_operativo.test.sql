-- RT-52 -- FASE 3 ciclo operativo: traducción, transiciones válida/inválida,
-- historial con actor y motivo, compat legacy intacto.
create extension if not exists pgtap with schema extensions;
begin;
select plan(15);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95200000-0000-4000-8000-0000000000ad', 'rt52-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95200000-0000-4000-8000-000000000001', 'rt52-usuario@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95200000-0000-4000-8000-0000000000aa', '95200000-0000-4000-8000-0000000000ad', 'Admin RT-52');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('95200000-0000-4000-8000-000000000101', '95200000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95200000-0000-4000-8000-000000000201', '95200000-0000-4000-8000-000000000101', 'sedan', 'RT52', 'Modelo', 2026, 'RT52ABC', true, true, true, true);

-- 3.5: traducción de dominios clave (incluye criterio de salida)
select is(public.traducir_estado_operativo('solicitud_creada')::text, 'requested', 'RT-52.1: solicitud_creada -> requested');
select is(public.traducir_estado_operativo('conductor_asignado')::text, 'assigned', 'RT-52.2: conductor_asignado -> assigned');
select is(public.traducir_estado_operativo('traslado_en_curso')::text, 'in_transit', 'RT-52.3: traslado_en_curso -> in_transit');
select is(public.traducir_estado_operativo('pago_pendiente')::text, 'closed', 'RT-52.4: pago_pendiente -> closed (criterio salida)');
select is(public.traducir_estado_operativo('reclamo_abierto')::text, 'closed', 'RT-52.5: reclamo_abierto -> closed (criterio salida)');
select is(public.traducir_estado_operativo('disputa_resuelta')::text, 'closed', 'RT-52.6: disputa_resuelta -> closed (criterio salida)');

-- alta: el sync deriva el operativo sin tocar el flujo legacy
insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia)
values ('95200000-0000-4000-8000-000000000301', 'solicitud_creada', '95200000-0000-4000-8000-000000000101', '95200000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid());
select is((select estado_operativo::text from public.traslados where id = '95200000-0000-4000-8000-000000000301'), 'requested', 'RT-52.7: insert deriva requested');

-- 3.11: transición válida vía RPC usuario (security definer) avanza ambos
-- estados y deja historial con actor y motivo (los UPDATE directos de
-- estado están reservados a RPC: RLS en estado_transiciones_validas)
set local role authenticated;
select set_config('request.jwt.claim.sub', '95200000-0000-4000-8000-000000000001', true);
select set_config('ruum.motivo_transicion_traslado', 'RT-52 cancela por prueba', true);
select public.usuario_cancela_traslado('95200000-0000-4000-8000-000000000301', 'RT-52 cancela por prueba', 0, 0, 'RT-52');
select is((select estado::text from public.traslados where id = '95200000-0000-4000-8000-000000000301'), 'servicio_cancelado', 'RT-52.8: legacy avanza a cancelado');
select is((select estado_operativo::text from public.traslados where id = '95200000-0000-4000-8000-000000000301'), 'cancelled', 'RT-52.9: operativo avanza a cancelled');
select is(
  (select motivo from public.historial_estados_traslado where traslado_id = '95200000-0000-4000-8000-000000000301' order by creado_en desc limit 1),
  'RT-52 cancela por prueba', 'RT-52.10: historial registra motivo'
);
select is(
  (select actor_tipo from public.historial_estados_traslado where traslado_id = '95200000-0000-4000-8000-000000000301' order by creado_en desc limit 1),
  'usuario', 'RT-52.11: historial registra actor usuario'
);
reset role;

-- 3.12: salto legacy inválido sigue bloqueado por el trigger original
select throws_ok(
  $$ update public.traslados set estado = 'traslado_en_curso' where id = '95200000-0000-4000-8000-000000000301' $$,
  null, null, 'RT-52.12: salto inválido bloqueado'
);

-- 3.12: salto operativo directo inválido también bloqueado
select throws_ok(
  $$ update public.traslados set estado_operativo = 'closed' where id = '95200000-0000-4000-8000-000000000301' $$,
  null, null, 'RT-52.13: operativo cancelled -> closed bloqueado'
);

-- 3.4 compat: columna legacy intacta y operativa derivada en catálogo completo
select is(
  (select count(*) from public.traslados where estado_operativo = public.traducir_estado_operativo(estado))::int,
  (select count(*) from public.traslados)::int,
  'RT-52.14: todo traslado tiene operativo coherente con legacy'
);

-- historial visible para el dueño del traslado
set local role authenticated;
select set_config('request.jwt.claim.sub', '95200000-0000-4000-8000-000000000001', true);
select ok(
  (select count(*) from public.historial_estados_traslado where traslado_id = '95200000-0000-4000-8000-000000000301')::int >= 1,
  'RT-52.15: usuario ve historial de su traslado'
);
reset role;

select * from finish();
rollback;
