-- RT-62 -- FASE 15 golden path: empresa crea operación, 5 vehículos,
-- 5 traslados, asignación, aceptación, recolección, evidencia, tracking,
-- entrega, confirmación, pago, cierre y operación completada.
-- Recorre la máquina de estados con los roles reales (usuario, Torre,
-- conductor) y las RPC de dominio.
create extension if not exists pgtap with schema extensions;
begin;
select plan(30);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('96200000-0000-4000-8000-0000000000ad', 'rt62-torre@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000b1', 'rt62-titular@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000c1', 'rt62-ca@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000c2', 'rt62-cb@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000c3', 'rt62-cc@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000c4', 'rt62-cd@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000c5', 'rt62-ce@local.test', now(), '{}', '{}', now(), now()),
  ('96200000-0000-4000-8000-0000000000b9', 'rt62-out@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('96200000-0000-4000-8000-0000000000aa', '96200000-0000-4000-8000-0000000000ad', 'Torre RT-62', 'direccion');

insert into public.empresas (id, nombre)
values ('96200000-0000-4000-8000-0000000000e1', 'Empresa RT-62');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values
  ('96200000-0000-4000-8000-000000000101', '96200000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '96200000-0000-4000-8000-0000000000e1'),
  ('96200000-0000-4000-8000-000000000109', '96200000-0000-4000-8000-0000000000b9', 'personal', 'personal', 'verificado', true, null);

insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
values ('96200000-0000-4000-8000-0000000000e1', '96200000-0000-4000-8000-000000000101', 'owner', 'activo');

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values
  ('96200000-0000-4000-8000-000000000201', '96200000-0000-4000-8000-0000000000c1', 'Conductor A', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'),
  ('96200000-0000-4000-8000-000000000202', '96200000-0000-4000-8000-0000000000c2', 'Conductor B', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'),
  ('96200000-0000-4000-8000-000000000203', '96200000-0000-4000-8000-0000000000c3', 'Conductor C', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'),
  ('96200000-0000-4000-8000-000000000204', '96200000-0000-4000-8000-0000000000c4', 'Conductor D', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'),
  ('96200000-0000-4000-8000-000000000205', '96200000-0000-4000-8000-0000000000c5', 'Conductor E', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

-- Empresa crea operación (vía Torre para la empresa)
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
insert into public.operaciones (id, folio, empresa_id, nombre, tipo, estado)
values ('96200000-0000-4000-8000-000000000001', 'OP-RT62', '96200000-0000-4000-8000-0000000000e1', 'Operación Golden RT-62', 'flota', 'en_curso')
returning id as op
\gset
select is((select estado::text from public.operaciones where id = :'op'), 'en_curso', 'RT-62.1: operación en curso');
reset role;

-- 5 vehículos + 5 traslados por el titular (RPC real)
create or replace function pg_temp.rt62_crear(
  p_placa text, p_vin text, p_clave uuid
) returns uuid
language plpgsql
as $$
declare
  v_resp jsonb;
begin
  return (public.usuario_crea_traslado(
    null,
    jsonb_build_object('tipo','sedan','transmision','manual','marca','Nissan','modelo','Versa','condicion','nueva','anio',2022,'color','gris','placas',p_placa,'vin',p_vin,'estado_general_declarado','Bien','tiene_tarjeta_circulacion',true,'tiene_verificacion',true,'tiene_placas',true,'puede_circular_rodando',true),
    jsonb_build_object('contacto_entrega_nombre','A','contacto_entrega_telefono','+520000000000','contacto_recepcion_nombre','B','contacto_recepcion_telefono','+520000000001','origen_lat',19.0,'origen_lng',-99.0,'origen_direccion','origen','origen_ciudad','CDMX','destino_lat',19.5,'destino_lng',-99.5,'destino_direccion','destino','destino_ciudad','CDMX','presupuesto_usuario',1000,'tipo_pago','anticipado','modalidad_programacion','lo_antes_posible','distancia_km',18.42,'tiempo_estimado_horas',0.73),
    p_clave, '[]'::jsonb
  )->>'id')::uuid;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000b1', true);
select pg_temp.rt62_crear('RT62-G1', 'VING1', gen_random_uuid()) as t1
\gset
select pg_temp.rt62_crear('RT62-G2', 'VING2', gen_random_uuid()) as t2
\gset
select pg_temp.rt62_crear('RT62-G3', 'VING3', gen_random_uuid()) as t3
\gset
select pg_temp.rt62_crear('RT62-G4', 'VING4', gen_random_uuid()) as t4
\gset
select pg_temp.rt62_crear('RT62-G5', 'VING5', gen_random_uuid()) as t5
\gset
select is((select count(*)::int from public.traslados where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'cotizacion_generada'), 5, 'RT-62.2: 5 traslados cotizados');
reset role;

-- vincular a la operación
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
update public.traslados set operation_id = :'op'::uuid
where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid);
select is((select count(*)::int from public.traslados where operation_id = :'op'::uuid), 5, 'RT-62.3: 5 traslados en la operación');
reset role;

-- aceptar cotizaciones (titular)
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000b1', true);
select public.usuario_acepta_cotizacion(:'t1'::uuid);
select public.usuario_acepta_cotizacion(:'t2'::uuid);
select public.usuario_acepta_cotizacion(:'t3'::uuid);
select public.usuario_acepta_cotizacion(:'t4'::uuid);
select public.usuario_acepta_cotizacion(:'t5'::uuid);
select is((select count(*)::int from public.traslados where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'cotizacion_aceptada'), 5, 'RT-62.4: 5 cotizaciones aceptadas');
reset role;

-- pago anticipado (habilita la evidencia inicial; inserción operativa)
insert into public.pagos (traslado_id, monto, momento, estado, metodo)
select id, precio_cotizado, 'anticipado', 'completado', 'tarjeta'
from public.traslados where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid);
select is((select count(*)::int from public.pagos where traslado_id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'completado'), 5, 'RT-62.4b: 5 pagos anticipados');

-- Torre: confirmar y poner en espera de conductor
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
select public.admin_cambiar_estado_traslado(:'t1'::uuid, 'servicio_confirmado');
select public.admin_cambiar_estado_traslado(:'t2'::uuid, 'servicio_confirmado');
select public.admin_cambiar_estado_traslado(:'t3'::uuid, 'servicio_confirmado');
select public.admin_cambiar_estado_traslado(:'t4'::uuid, 'servicio_confirmado');
select public.admin_cambiar_estado_traslado(:'t5'::uuid, 'servicio_confirmado');
select public.admin_cambiar_estado_traslado(:'t1'::uuid, 'pendiente_de_conductor');
select public.admin_cambiar_estado_traslado(:'t2'::uuid, 'pendiente_de_conductor');
select public.admin_cambiar_estado_traslado(:'t3'::uuid, 'pendiente_de_conductor');
select public.admin_cambiar_estado_traslado(:'t4'::uuid, 'pendiente_de_conductor');
select public.admin_cambiar_estado_traslado(:'t5'::uuid, 'pendiente_de_conductor');
select is((select count(*)::int from public.traslados where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'pendiente_de_conductor'), 5, 'RT-62.5: 5 pendientes de conductor');

-- T1: oferta Torre + aceptación del conductor
select public.ofrecer_asignacion(:'t1'::uuid, '96200000-0000-4000-8000-000000000201', 'Golden T1') as oferta
\gset
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000c1', true);
select public.aceptar_asignacion(:'oferta');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'conductor_asignado', 'RT-62.6: conductor acepta T1');
reset role;

-- T2-T5: asignación directa de Torre (congela ganancia)
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
select public.admin_asigna_conductor(:'t2'::uuid, '96200000-0000-4000-8000-000000000202');
select public.admin_asigna_conductor(:'t3'::uuid, '96200000-0000-4000-8000-000000000203');
select public.admin_asigna_conductor(:'t4'::uuid, '96200000-0000-4000-8000-000000000204');
select public.admin_asigna_conductor(:'t5'::uuid, '96200000-0000-4000-8000-000000000205');
select is((select count(*)::int from public.traslados where id in (:'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'conductor_asignado'), 4, 'RT-62.7: Torre asigna T2-T5');
select ok((select coalesce(sum(ganancia_conductor_congelada), 0) from public.traslados where id in (:'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid)) > 0, 'RT-62.8: ganancia congelada al asignar');
reset role;

-- T1: recolección
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000c1', true);
select public.conductor_avanza_traslado(:'t1'::uuid, 'conductor_en_camino');
select public.conductor_avanza_traslado(:'t1'::uuid, 'llegada_origen');
select public.conductor_avanza_traslado(:'t1'::uuid, 'iniciar_verificacion');
select public.conductor_avanza_traslado(:'t1'::uuid, 'iniciar_evidencia_inicial');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'evidencia_inicial_en_proceso', 'RT-62.9: T1 en evidencia inicial');
reset role;

-- evidencia inicial (5 ángulos sincronizados)
insert into public.evidencia_fotos (traslado_id, tipo, angulo, url, sincronizada)
select  :'t1'::uuid, 'inicial', a::public.angulo_evidencia, 'https://cdn.test/rt62-' || a || '.jpg', true
from unnest(array['frente','lado_piloto','lado_copiloto','trasera','tablero']) as a;
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000c1', true);
select public.conductor_avanza_traslado(:'t1'::uuid, 'evidencia_inicial_completada');
select public.conductor_avanza_traslado(:'t1'::uuid, 'vehiculo_recibido');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'vehiculo_recibido', 'RT-62.10: vehículo recibido');
select public.conductor_avanza_traslado(:'t1'::uuid, 'iniciar_traslado');
select public.registrar_heartbeat_tracking(:'t1'::uuid, 19.43, -99.13, 10.0, 8.0, 80, true, 'android');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'traslado_en_curso', 'RT-62.11: T1 en curso con tracking');
reset role;
select ok((select count(*) from public.ubicaciones_traslado where traslado_id = :'t1'::uuid)::int >= 1, 'RT-62.12: punto GPS registrado');

-- T2-T5 avanzan a en curso (evidencia + tracking por traslado)
create or replace function pg_temp.rt62_avanzar(p_traslado uuid, p_conductor uuid, p_auth text)
returns void
language plpgsql
as $$
declare
  v_ang text;
begin
  perform set_config('request.jwt.claim.sub', p_auth, true);
  perform public.conductor_avanza_traslado(p_traslado, 'conductor_en_camino');
  perform public.conductor_avanza_traslado(p_traslado, 'llegada_origen');
  perform public.conductor_avanza_traslado(p_traslado, 'iniciar_verificacion');
  perform public.conductor_avanza_traslado(p_traslado, 'iniciar_evidencia_inicial');
  foreach v_ang in array array['frente','lado_piloto','lado_copiloto','trasera','tablero'] loop
    insert into public.evidencia_fotos (traslado_id, tipo, angulo, url, sincronizada)
    values (p_traslado, 'inicial', v_ang::public.angulo_evidencia, 'https://cdn.test/rt62-' || v_ang || '.jpg', true);
  end loop;
  perform public.conductor_avanza_traslado(p_traslado, 'evidencia_inicial_completada');
  perform public.conductor_avanza_traslado(p_traslado, 'vehiculo_recibido');
  perform public.conductor_avanza_traslado(p_traslado, 'iniciar_traslado');
  perform public.registrar_heartbeat_tracking(p_traslado, 19.43, -99.13, 10.0, 8.0, 80, true, 'android');
end;
$$;

-- T2-T5 avanzan con su conductor (helper común)
set local role authenticated;
select pg_temp.rt62_avanzar(:'t2'::uuid, '96200000-0000-4000-8000-000000000202', '96200000-0000-4000-8000-0000000000c2');
select pg_temp.rt62_avanzar(:'t3'::uuid, '96200000-0000-4000-8000-000000000203', '96200000-0000-4000-8000-0000000000c3');
select pg_temp.rt62_avanzar(:'t4'::uuid, '96200000-0000-4000-8000-000000000204', '96200000-0000-4000-8000-0000000000c4');
select pg_temp.rt62_avanzar(:'t5'::uuid, '96200000-0000-4000-8000-000000000205', '96200000-0000-4000-8000-0000000000c5');
reset role;
-- conteo como Torre (ve toda la flota)
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
select is((select count(*)::int from public.traslados where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'traslado_en_curso'), 5, 'RT-62.13: flota completa en curso');
reset role;
select is((select count(*)::int from public.traslados where id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'traslado_en_curso'), 5, 'RT-62.13: flota completa en curso');
reset role;

-- T1: entrega
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000c1', true);
select public.conductor_avanza_traslado(:'t1'::uuid, 'llegada_destino');
select public.conductor_avanza_traslado(:'t1'::uuid, 'iniciar_evidencia_final');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'evidencia_final_en_proceso', 'RT-62.14: T1 en evidencia final');
reset role;
insert into public.evidencia_fotos (traslado_id, tipo, angulo, url, sincronizada)
select  :'t1'::uuid, 'final', a::public.angulo_evidencia, 'https://cdn.test/rt62-fin-' || a || '.jpg', true
from unnest(array['frente','lado_piloto','lado_copiloto','trasera','tablero']) as a;
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000c1', true);
select public.conductor_avanza_traslado(:'t1'::uuid, 'evidencia_final_completada');
select public.conductor_avanza_traslado(:'t1'::uuid, 'confirmar_entrega');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'entrega_confirmada', 'RT-62.15: entrega confirmada');
reset role;

-- el pago anticipado ya quedó reflejado; cierre del viaje por el conductor
select is((select monto_pagado from public.pasaporte_digital where traslado_id = :'t1'::uuid)::numeric > 0, true, 'RT-62.16: pasaporte refleja el pago');
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000c1', true);
select public.conductor_avanza_traslado(:'t1'::uuid, 'cerrar_viaje');
select is((select estado::text from public.traslados where id = :'t1'::uuid), 'servicio_cerrado', 'RT-62.17: traslado cerrado');
reset role;

-- historial y auditoría del héroe
select ok((select count(*) from public.historial_estados_traslado where traslado_id = :'t1'::uuid)::int >= 15, 'RT-62.18: historial punta a punta');
select ok((select count(*) from public.registro_auditoria where traslado_id = :'t1'::uuid and actor = 'conductor')::int >= 10, 'RT-62.19: auditoría del conductor');
select ok(exists(select 1 from public.registro_auditoria where traslado_id = :'t1'::uuid and evento = 'cierre_traslado'), 'RT-62.20: cierre auditado');

-- SLA evalúa sin breach (todo fresco) y la operación cierra con finanzas
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
select public.sla_evaluar_traslados(5000);
select ok((select count(*) from public.sla_events where traslado_id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and tipo_evento = 'breach')::int = 0, 'RT-62.21: sin breach en golden fresco');
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000ad', true);
select public.admin_finanzas_operacion(:'op'::uuid) as fin
\gset
select is((:'fin'::jsonb->>'traslados')::int, 5, 'RT-62.22: finanzas ven los 5 traslados');
select is((:'fin'::jsonb->>'facturado')::numeric, (select sum(monto) from public.pagos where traslado_id in (:'t1'::uuid, :'t2'::uuid, :'t3'::uuid, :'t4'::uuid, :'t5'::uuid) and estado = 'completado'), 'RT-62.23: facturado = 5 anticipados');
update public.operaciones set estado = 'cerrada' where id = :'op'::uuid;
select is((select estado::text from public.operaciones where id = :'op'::uuid), 'cerrada', 'RT-62.24: operación completada');
select public.admin_obs_metricas_negocio(now() - interval '1 day', now() + interval '1 hour', '96200000-0000-4000-8000-0000000000e1', :'op'::uuid) as met
\gset
select ok((:'met'::jsonb ?& array['time_to_assign_horas','pickup_on_time_rate','delivery_on_time_rate','average_transfer_duration_horas','tracking_uptime','incident_rate','claim_rate','driver_acceptance_rate','evidence_completion_rate','operation_margin']), 'RT-62.25: las 10 métricas responden');
select is((:'met'::jsonb->'operation_margin'->>'facturado')::numeric, (:'fin'::jsonb->>'facturado')::numeric, 'RT-62.26: margen consistente con finanzas');
reset role;

-- RLS final: titular ve su operación; outsider nada
set local role authenticated;
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from public.traslados where operation_id = :'op'::uuid), 5, 'RT-62.27: titular ve su flota');
select set_config('request.jwt.claim.sub', '96200000-0000-4000-8000-0000000000b9', true);
select is((select count(*)::int from public.traslados where operation_id = :'op'::uuid), 0, 'RT-62.28: outsider no ve la flota');
reset role;

select * from finish();
rollback;
