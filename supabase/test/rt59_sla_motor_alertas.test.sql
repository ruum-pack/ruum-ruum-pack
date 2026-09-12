-- RT-59 -- FASE 13 SLA y motor de alertas: policies, jerarquía
-- empresa/operación, evaluación periódica, warning antes de breach,
-- alertas, prioridades Torre y reportes históricos.
create extension if not exists pgtap with schema extensions;
begin;
select plan(24);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95900000-0000-4000-8000-0000000000ad', 'rt59-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95900000-0000-4000-8000-0000000000b1', 'rt59-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('95900000-0000-4000-8000-0000000000b2', 'rt59-conductor@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('95900000-0000-4000-8000-0000000000aa', '95900000-0000-4000-8000-0000000000ad', 'Admin RT-59', 'supervisor');

insert into public.empresas (id, nombre)
values ('95900000-0000-4000-8000-0000000000e1', 'Empresa RT-59');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values ('95900000-0000-4000-8000-000000000101', '95900000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '95900000-0000-4000-8000-0000000000e1');

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values ('95900000-0000-4000-8000-000000000201', '95900000-0000-4000-8000-0000000000b2', 'Conductor RT-59', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95900000-0000-4000-8000-000000000301', '95900000-0000-4000-8000-000000000101', 'sedan', 'RT59', 'Modelo', 2026, 'RT59ABC', true, true, true, true);

insert into public.operaciones (id, folio, empresa_id, nombre, tipo, estado)
values ('95900000-0000-4000-8000-000000000001', 'OP-RT59', '95900000-0000-4000-8000-0000000000e1', 'Operación RT-59', 'flota', 'en_curso');

-- T1: 1.8h sin conductor -> warning asignación (75%<=90%<100). T2: 5h -> breach.
insert into public.traslados (id, estado, usuario_id, vehiculo_id, conductor_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia, operation_id)
values
  ('95900000-0000-4000-8000-000000000401', 'pendiente_de_conductor', '95900000-0000-4000-8000-000000000101', '95900000-0000-4000-8000-000000000301', null, 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), null),
  ('95900000-0000-4000-8000-000000000402', 'pendiente_de_conductor', '95900000-0000-4000-8000-000000000101', '95900000-0000-4000-8000-000000000301', null, 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '95900000-0000-4000-8000-000000000001'),
  ('95900000-0000-4000-8000-000000000403', 'traslado_en_curso', '95900000-0000-4000-8000-000000000101', '95900000-0000-4000-8000-000000000301', '95900000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), null);

update public.traslados set creado_en = now() - interval '108 minutes' where id = '95900000-0000-4000-8000-000000000401';
update public.traslados set creado_en = now() - interval '5 hours' where id = '95900000-0000-4000-8000-000000000402';
update public.traslados set creado_en = now() - interval '1 hour' where id = '95900000-0000-4000-8000-000000000403';

-- I3: incidencia abierta hace 5h en T3 -> breach respuesta (límite 4h)
insert into public.incidencias (id, traslado_id, tipo, momento, reportada_por, descripcion, severidad, creada_en)
values ('95900000-0000-4000-8000-000000000501', '95900000-0000-4000-8000-000000000403', 'descompostura_en_ruta', 'durante_traslado', 'conductor', 'Falla mecánica grave en ruta RT-59', 'high', now() - interval '5 hours');

-- 13.1 catálogo global
select is((select count(*) from public.sla_policies where activo)::int, 5, 'RT-59.1: catálogo con 5 políticas');
select is((select horas_limite from public.sla_policies where codigo = 'asignacion')::numeric, 2::numeric, 'RT-59.2: asignación 2h global');

-- 13.2 override empresa
insert into public.sla_empresa_politicas (empresa_id, policy_codigo, horas_limite)
values ('95900000-0000-4000-8000-0000000000e1', 'asignacion', 10);
select is((select horas_limite from public.sla_politica_efectiva('asignacion', '95900000-0000-4000-8000-0000000000e1', null))::numeric, 10::numeric, 'RT-59.3: empresa override 10h');

-- 13.3 override operación gana a empresa
insert into public.sla_operacion_politicas (operacion_id, policy_codigo, horas_limite)
values ('95900000-0000-4000-8000-000000000001', 'asignacion', 1);
select is((select horas_limite from public.sla_politica_efectiva('asignacion', '95900000-0000-4000-8000-0000000000e1', '95900000-0000-4000-8000-000000000001'))::numeric, 1::numeric, 'RT-59.4: operación gana a empresa');
select is((select horas_limite from public.sla_politica_efectiva('asignacion', '95900000-0000-4000-8000-0000000000e1', null))::numeric, 10::numeric, 'RT-59.5: sin operación hereda empresa');

-- volver a global para evaluar warning/breach puros
delete from public.sla_operacion_politicas where operacion_id = '95900000-0000-4000-8000-000000000001';
delete from public.sla_empresa_politicas where empresa_id = '95900000-0000-4000-8000-0000000000e1';

-- 13.4 evaluación periódica
select public.sla_evaluar_traslados(5000) as res
\gset
select ok((:'res'::jsonb->>'evaluados')::int >= 3, 'RT-59.6: evalúa al menos los 3 traslados');

-- 13.5 eventos inmutables
select ok((select count(*) from public.sla_events where traslado_id in ('95900000-0000-4000-8000-000000000401','95900000-0000-4000-8000-000000000402','95900000-0000-4000-8000-000000000403'))::int >= 3, 'RT-59.7: eventos para los traslados');

-- 13.6 warning avisa ANTES (T1: 75<=pct<100 y deadline futuro)
select ok(exists(
  select 1 from public.sla_events
  where traslado_id = '95900000-0000-4000-8000-000000000401' and policy_codigo = 'asignacion' and tipo_evento = 'warning'
    and porcentaje >= 75 and porcentaje < 100
), 'RT-59.8: warning con 75-99% consumido');
select ok(exists(
  select 1 from public.sla_events
  where traslado_id = '95900000-0000-4000-8000-000000000401' and policy_codigo = 'asignacion' and tipo_evento = 'warning'
    and deadline > creado_en
), 'RT-59.9: el warning avisa antes de vencer');

-- 13.7 breach (T2 asignación + T3 incidencia)
select ok(exists(
  select 1 from public.sla_events
  where traslado_id = '95900000-0000-4000-8000-000000000402' and policy_codigo = 'asignacion' and tipo_evento = 'breach'
    and porcentaje >= 100
), 'RT-59.10: breach asignación T2');
select ok(exists(
  select 1 from public.sla_events
  where traslado_id = '95900000-0000-4000-8000-000000000403' and policy_codigo = 'respuesta_incidencia' and tipo_evento = 'breach'
), 'RT-59.11: breach respuesta incidencia T3');

-- 13.8 puente a bandeja existente
select ok(exists(
  select 1 from public.alertas_sla_operacionales
  where dedupe_key = 'fase13:95900000-0000-4000-8000-000000000401:asignacion:-' and categoria = 'sla_en_riesgo'
), 'RT-59.12: warning crea alerta en riesgo');
select ok(exists(
  select 1 from public.alertas_sla_operacionales
  where dedupe_key = 'fase13:95900000-0000-4000-8000-000000000402:asignacion:-' and categoria = 'sla_vencido'
), 'RT-59.13: breach escala alerta a vencido');
select ok((select count(*) from public.notificaciones_admin_operativas where titulo ilike 'SLA%')::int >= 2, 'RT-59.14: Torre notificada');

-- 13.9 prioridades Torre: breach primero y con mayor score
select set_config('request.jwt.claim.sub', '95900000-0000-4000-8000-0000000000ad', true);
select ok((select count(*) from public.admin_sla_cola_torre(null, null, 100) where traslado_id in ('95900000-0000-4000-8000-000000000401','95900000-0000-4000-8000-000000000402','95900000-0000-4000-8000-000000000403'))::int >= 3, 'RT-59.15: cola Torre incluye los casos');
select is((select estado from public.admin_sla_cola_torre(null, null, 100) order by case estado when 'breach' then 0 else 1 end, prioridad_torre desc, deadline asc limit 1), 'breach', 'RT-59.16: breach abre la cola');
select ok((select min(prioridad_torre) from public.admin_sla_cola_torre(null, null, 500) where estado = 'breach') > (select max(prioridad_torre) from public.admin_sla_cola_torre(null, null, 500) where estado = 'warning' and policy_codigo = 'asignacion' and traslado_id = '95900000-0000-4000-8000-000000000401'), 'RT-59.17: breach pesa más que warning');

-- 13.10 reportes históricos
select public.admin_sla_reporte_historico(now() - interval '1 day', now() + interval '1 hour', null, null) as rep
\gset
select ok((:'rep'::jsonb->'totales'->>'warnings')::int >= 1, 'RT-59.18: reporte cuenta warnings');
select ok((:'rep'::jsonb->'totales'->>'breaches')::int >= 2, 'RT-59.19: reporte cuenta breaches');

-- recuperado: asignar conductor a T2 limpia su breach
update public.traslados set conductor_id = '95900000-0000-4000-8000-000000000201', estado = 'conductor_asignado' where id = '95900000-0000-4000-8000-000000000402';
select public.sla_evaluar_traslados(5000);
select ok(exists(
  select 1 from public.sla_events
  where traslado_id = '95900000-0000-4000-8000-000000000402' and policy_codigo = 'asignacion' and tipo_evento = 'recuperado'
), 'RT-59.20: asignar recupera el breach');
select is((select estado from public.alertas_sla_operacionales where dedupe_key = 'fase13:95900000-0000-4000-8000-000000000402:asignacion:-'), 'resuelta', 'RT-59.21: recuperado resuelve la alerta');

-- RLS: el dueño ve sus evaluaciones
set local role authenticated;
select set_config('request.jwt.claim.sub', '95900000-0000-4000-8000-0000000000b1', true);
select ok((select count(*) from public.sla_evaluaciones where traslado_id = '95900000-0000-4000-8000-000000000401')::int >= 1, 'RT-59.22: dueño ve evaluaciones');
reset role;

-- inmutabilidad append-only
select throws_ok(
  $$ update public.sla_events set porcentaje = 0 where traslado_id = '95900000-0000-4000-8000-000000000401' $$,
  null, null, 'RT-59.23: events sin update'
);

-- idempotencia: re-evaluar no duplica warning/breach activos
select set_config('request.jwt.claim.sub', '95900000-0000-4000-8000-0000000000ad', true);
select public.sla_evaluar_traslados(5000);
select is((select count(*) from public.sla_events where traslado_id = '95900000-0000-4000-8000-000000000401' and policy_codigo = 'asignacion' and tipo_evento = 'warning')::int, 1, 'RT-59.24: sin duplicados en re-evaluación');

select * from finish();
rollback;
