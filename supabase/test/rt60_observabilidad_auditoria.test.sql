-- RT-60 -- FASE 14 observabilidad y auditoría: logging central, correlation ID,
-- latencias, edge errors, tracking, cola offline, dashboards, auditoría,
-- retención y métricas de negocio.
create extension if not exists pgtap with schema extensions;
begin;
select plan(26);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('96000000-0000-4000-8000-0000000000ad', 'rt60-direccion@local.test', now(), '{}', '{}', now(), now()),
  ('96000000-0000-4000-8000-0000000000b3', 'rt60-supervisor@local.test', now(), '{}', '{}', now(), now()),
  ('96000000-0000-4000-8000-0000000000b1', 'rt60-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('96000000-0000-4000-8000-0000000000b2', 'rt60-conductor@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values
  ('96000000-0000-4000-8000-0000000000aa', '96000000-0000-4000-8000-0000000000ad', 'Dirección RT-60', 'direccion'),
  ('96000000-0000-4000-8000-0000000000ab', '96000000-0000-4000-8000-0000000000b3', 'Supervisor RT-60', 'supervisor');

insert into public.empresas (id, nombre)
values ('96000000-0000-4000-8000-0000000000e1', 'Empresa RT-60');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values ('96000000-0000-4000-8000-000000000101', '96000000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '96000000-0000-4000-8000-0000000000e1');

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values ('96000000-0000-4000-8000-000000000201', '96000000-0000-4000-8000-0000000000b2', 'Conductor RT-60', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('96000000-0000-4000-8000-000000000301', '96000000-0000-4000-8000-000000000101', 'sedan', 'RT60', 'Modelo', 2026, 'RT60ABC', true, true, true, true);

insert into public.operaciones (id, folio, empresa_id, nombre, tipo, estado)
values ('96000000-0000-4000-8000-000000000001', 'OP-RT60', '96000000-0000-4000-8000-0000000000e1', 'Operación RT-60', 'flota', 'en_curso');

-- sin fila sistema de asignación para T1 (métricas manuales deterministas)
alter table public.traslados disable trigger traslados_sincronizar_asignacion_insert;
insert into public.traslados (id, estado, usuario_id, vehiculo_id, conductor_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia, operation_id, ganancia_conductor_congelada)
values
  ('96000000-0000-4000-8000-000000000401', 'traslado_en_curso', '96000000-0000-4000-8000-000000000101', '96000000-0000-4000-8000-000000000301', '96000000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '96000000-0000-4000-8000-000000000001', 0),
  ('96000000-0000-4000-8000-000000000402', 'pendiente_de_conductor', '96000000-0000-4000-8000-000000000101', '96000000-0000-4000-8000-000000000301', null, 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), null, 0),
  ('96000000-0000-4000-8000-000000000403', 'entrega_confirmada', '96000000-0000-4000-8000-000000000101', '96000000-0000-4000-8000-000000000301', null, 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), null, 600),
  ('96000000-0000-4000-8000-000000000404', 'entrega_confirmada', '96000000-0000-4000-8000-000000000101', '96000000-0000-4000-8000-000000000301', null, 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), null, 0);
alter table public.traslados enable trigger traslados_sincronizar_asignacion_insert;

update public.traslados set creado_en = now() - interval '1 hour' where id = '96000000-0000-4000-8000-000000000401';
update public.traslados set creado_en = now() - interval '4 hours' where id = '96000000-0000-4000-8000-000000000402';
update public.traslados set creado_en = now() - interval '2 hours' where id in ('96000000-0000-4000-8000-000000000403', '96000000-0000-4000-8000-000000000404');

-- salud vieja 20 min: T1 OFFLINE
insert into public.tracking_salud_traslado (traslado_id, conductor_id, ultima_ubicacion_en, ultimo_envio_en, fuente, online)
values ('96000000-0000-4000-8000-000000000401', '96000000-0000-4000-8000-000000000201', now() - interval '20 minutes', now() - interval '20 minutes', 'heartbeat', true);

-- punto tardío 7h (cola offline que llegó tarde)
insert into public.ubicaciones_traslado (traslado_id, conductor_id, lat, lng, dispositivo_timestamp, servidor_timestamp, fuente, registrado_en)
values ('96000000-0000-4000-8000-000000000401', '96000000-0000-4000-8000-000000000201', 19.43, -99.13, now() - interval '7 hours', now(), 'lote_offline', now());

-- asignaciones: 1 aceptada (2h tras crear) + 1 rechazada = aceptación 0.5
insert into public.asignaciones (traslado_id, conductor_id, estado, origen, asignada_en, aceptada_en)
values ('96000000-0000-4000-8000-000000000402', '96000000-0000-4000-8000-000000000201', 'aceptada', 'manual', now() - interval '4 hours', now() - interval '2 hours');
insert into public.asignaciones (traslado_id, conductor_id, estado, origen, asignada_en, rechazada_en)
values ('96000000-0000-4000-8000-000000000402', '96000000-0000-4000-8000-000000000201', 'rechazada', 'manual', now() - interval '3 hours', now() - interval '2 hours');

-- incidencia en T1
insert into public.incidencias (traslado_id, tipo, momento, reportada_por, descripcion, severidad)
values ('96000000-0000-4000-8000-000000000401', 'descompostura_en_ruta', 'durante_traslado', 'conductor', 'Falla mecánica en ruta RT-60', 'high');

-- entregas T3/T4 en historial + foto final solo en T3
insert into public.historial_estados_traslado (traslado_id, estado_anterior, estado_nuevo, operativo_anterior, operativo_nuevo, actor_tipo, creado_en)
values
  ('96000000-0000-4000-8000-000000000403', 'traslado_en_curso', 'entrega_confirmada', 'in_transit', 'delivered', 'sistema', now() - interval '30 minutes'),
  ('96000000-0000-4000-8000-000000000404', 'traslado_en_curso', 'entrega_confirmada', 'in_transit', 'delivered', 'sistema', now() - interval '30 minutes');
insert into public.evidencia_fotos (traslado_id, tipo, angulo, url)
values ('96000000-0000-4000-8000-000000000403', 'final', 'frente', 'https://cdn.test/rt60.jpg');

-- margen: facturado 1000, costo 600, gasto 100, comisión 36
insert into public.pagos (traslado_id, monto, momento, estado, metodo, comision_mxn)
values ('96000000-0000-4000-8000-000000000403', 1000, 'al_cierre', 'completado', 'tarjeta', 36);
insert into public.gastos_traslado (traslado_id, tipo, monto, descripcion, registrado_en)
values ('96000000-0000-4000-8000-000000000403', 'caseta', 100, 'Caseta RT-60', now());

-- 14.2 correlation ID
select ok(public.obs_nuevo_correlation_id() ~ '^[0-9a-f-]{36}$', 'RT-60.1: correlation con formato UUID');
select is(public.obs_resolver_correlation('abc-123'), 'abc-123', 'RT-60.2: propaga el dado');
select ok(public.obs_resolver_correlation(null) ~ '^[0-9a-f-]{36}$', 'RT-60.3: genera cuando falta');

-- 14.1/14.3/14.4/14.5 log centralizado con asociaciones
select public.obs_registrar_log('error', 'torre', 'asignacion_fallida', 'corr-rt60-1', '96000000-0000-4000-8000-000000000401', '96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000101', 120, '{"paso":"oferta"}') as logid
\gset
select is((select correlation_id from public.eventos_observabilidad where id = :'logid'), 'corr-rt60-1', 'RT-60.4: log guarda correlation y entidades');
select throws_ok(
  $$ select public.obs_registrar_log('info', 'torre', 'x', null, null, null, null, null, '{"nota":"clabe 123"}') $$,
  '22023', null, 'RT-60.5: log rechaza PII'
);

-- 14.6 latencia RPC
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-0000000000b1', true);
select public.obs_registrar_latencia_rpc('rt60_rpc', 250, true, null, 'corr-rt60-2', null);
select public.obs_registrar_latencia_rpc('rt60_rpc', 500, false, 'TIMEOUT', 'corr-rt60-3', null);
select ok((select p95_ms from public.obs_rpc_latencia_resumen where funcion = 'rt60_rpc')::int >= 250, 'RT-60.6: resumen p95 de latencias');
reset role;

-- 14.7 edge errors (vía servicio o Torre, no usuario final)
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-0000000000ad', true);
select public.obs_registrar_error_edge('stripe-webhook', 'FIRMA_INVALIDA', 'Firma no verificada', 'corr-rt60-4', null, '{"intento":1}') as edgeid
\gset
select is((select codigo from public.obs_edge_errors where id = :'edgeid'), 'FIRMA_INVALIDA', 'RT-60.7: edge error registrado');

-- 14.8 tracking fallos
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-0000000000ad', true);
select ok(exists(
  select 1 from public.admin_obs_tracking_fallos(100)
  where traslado_id = '96000000-0000-4000-8000-000000000401' and salud = 'OFFLINE'
), 'RT-60.8: detecta traslado OFFLINE');
select is((select salud from public.admin_obs_tracking_fallos(1) limit 1), 'OFFLINE', 'RT-60.9: OFFLINE abre la cola');

-- 14.9 cola offline
select public.admin_obs_cola_offline() as cola
\gset
select ok((:'cola'::jsonb->'telemetria_lote'->>'tardios_mas_6h')::int >= 1, 'RT-60.10: cuenta telemetría tardía +6h');
select ok((:'cola'::jsonb->'traslados_tardios')::jsonb @> '[{"traslado_id":"96000000-0000-4000-8000-000000000401"}]'::jsonb, 'RT-60.11: identifica el traslado tardío');

-- 14.10 dashboard
select public.admin_obs_dashboard(now() - interval '1 day', now() + interval '1 hour') as dash
\gset
select ok((:'dash'::jsonb ?& array['logs_por_nivel','rpc_lentas','edge_errores','eventos_app','tracking_fallos_actuales']), 'RT-60.12: dashboard con todas las secciones');
select ok(jsonb_array_length(:'dash'::jsonb->'rpc_lentas') >= 1, 'RT-60.13: dashboard incluye RPC medidas');

-- 14.11 auditoría con alcance completo
select public.obs_registrar_auditoria('acceso_torre', 'admin', '96000000-0000-4000-8000-0000000000aa', '96000000-0000-4000-8000-000000000401', '96000000-0000-4000-8000-000000000001', '96000000-0000-4000-8000-000000000101', 'corr-rt60-5', '{"vista":"torre"}') as auditid
\gset
select is((select correlation_id from public.registro_auditoria where id = :'auditid'), 'corr-rt60-5', 'RT-60.14: auditoría con correlation y alcances');

-- 14.12 retención
select is((select count(*) from public.obs_retencion_politicas)::int, 5, 'RT-60.15: 5 políticas de retención');
insert into public.obs_rpc_latency (funcion, duracion_ms, ok, creado_en)
values ('rt60_vieja', 5, true, now() - interval '100 days');
select public.admin_obs_purgar('obs_rpc_latency', 5000) as purga
\gset
select is((:'purga'::jsonb->>'eliminados')::int, 1, 'RT-60.16: purga elimina lo vencido');
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-0000000000b3', true);
select throws_ok(
  $$ select public.admin_obs_purgar('obs_rpc_latency', 100) $$,
  '42501', null, 'RT-60.17: purga exige dirección'
);
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-0000000000ad', true);
select ok(exists(
  select 1 from public.registro_auditoria where evento = 'purga_observabilidad' and (datos->>'tabla') = 'obs_rpc_latency'
), 'RT-60.18: la purga queda auditada');

-- métricas de negocio (alcance empresa aísla los fixtures)
select public.sla_evaluar_traslados(5000);
select public.admin_obs_metricas_negocio(now() - interval '1 day', now() + interval '1 hour', '96000000-0000-4000-8000-0000000000e1', null) as met
\gset
select is((:'met'::jsonb->>'time_to_assign_horas')::numeric, 2::numeric, 'RT-60.19: time_to_assign 2h');
select is((:'met'::jsonb->>'driver_acceptance_rate')::numeric, 0.5::numeric, 'RT-60.20: aceptación 0.5');
select is((:'met'::jsonb->>'incident_rate')::numeric, 0.25::numeric, 'RT-60.21: incident_rate 0.25');
select is((:'met'::jsonb->>'pickup_on_time_rate')::numeric, 1::numeric, 'RT-60.22: pickup on-time 1');
select is((:'met'::jsonb->>'evidence_completion_rate')::numeric, 0.5::numeric, 'RT-60.23: evidencia 0.5');
select is((:'met'::jsonb->'operation_margin'->>'margen_contribucion')::numeric, 264::numeric, 'RT-60.24: margen 264');
select is((:'met'::jsonb->>'tracking_uptime')::numeric, 0::numeric, 'RT-60.25: uptime 0 con flota sin señal');

-- RLS: usuario sin auditoria:leer no ve latencias
set local role authenticated;
select set_config('request.jwt.claim.sub', '96000000-0000-4000-8000-0000000000b1', true);
select is((select count(*) from public.obs_rpc_latency)::int, 0, 'RT-60.26: sin permiso no hay lectura');
reset role;

select * from finish();
rollback;
