-- RT-57 -- FASE 11 familia incidente/reclamo/disputa independiente del lifecycle.
create extension if not exists pgtap with schema extensions;
begin;
select plan(20);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95700000-0000-4000-8000-0000000000ad', 'rt57-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95700000-0000-4000-8000-0000000000b1', 'rt57-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('95700000-0000-4000-8000-0000000000b2', 'rt57-conductor@local.test', now(), '{}', '{}', now(), now()),
  ('95700000-0000-4000-8000-0000000000b3', 'rt57-outsider@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('95700000-0000-4000-8000-0000000000aa', '95700000-0000-4000-8000-0000000000ad', 'Admin RT-57');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values
  ('95700000-0000-4000-8000-000000000101', '95700000-0000-4000-8000-0000000000b1', 'personal', 'personal', 'verificado', true),
  ('95700000-0000-4000-8000-000000000102', '95700000-0000-4000-8000-0000000000b3', 'personal', 'personal', 'verificado', false);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;
insert into public.conductores (id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes, nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago)
values ('95700000-0000-4000-8000-000000000201', '95700000-0000-4000-8000-0000000000b2', 'Conductor RT-57', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar');
alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95700000-0000-4000-8000-000000000301', '95700000-0000-4000-8000-000000000101', 'sedan', 'RT57', 'Modelo', 2026, 'RT57ABC', true, true, true, true);

insert into public.traslados (id, estado, usuario_id, vehiculo_id, conductor_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia)
values
  ('95700000-0000-4000-8000-000000000401', 'traslado_en_curso', '95700000-0000-4000-8000-000000000101', '95700000-0000-4000-8000-000000000301', '95700000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid()),
  ('95700000-0000-4000-8000-000000000402', 'traslado_en_curso', '95700000-0000-4000-8000-000000000101', '95700000-0000-4000-8000-000000000301', '95700000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid());

insert into public.evidencia_fotos (id, traslado_id, tipo, angulo, url)
values ('95700000-0000-4000-8000-000000000501', '95700000-0000-4000-8000-000000000401', 'inicial', 'frente', 'https://cdn.test/e1.jpg');

-- reporte directo (conductor): nace abierta/high con SLA, sin mover estado
set local role authenticated;
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000b2', true);
insert into public.incidencias (traslado_id, tipo, momento, reportada_por, descripcion, severidad)
values ('95700000-0000-4000-8000-000000000401', 'descompostura_en_ruta', 'durante_traslado', 'conductor', 'El vehículo se detuvo con falla mecánica grave', 'high')
returning id as inc
\gset
select is((select estado from public.incidencias where id = :'inc'), 'abierta', 'RT-57.1: nace abierta');
select is((select estado from public.traslados where id = '95700000-0000-4000-8000-000000000401'), 'traslado_en_curso', 'RT-57.2: el traslado no se mueve');
select ok((select sla_vence_en from public.incidencias where id = :'inc') is not null, 'RT-57.3: SLA calculado');
select is((select count(*) from public.incidencia_historial where incidencia_id = :'inc')::int, 1, 'RT-57.4: historial inicial');
reset role;

-- asignar + escalar (Torre)
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000ad', true);
select public.asignar_incidencia(:'inc'::uuid, '95700000-0000-4000-8000-0000000000aa', 'critical');
select is((select estado from public.incidencias where id = :'inc'), 'en_atencion', 'RT-57.5: asignada pasa a atención');
select is((select responsable_admin_id from public.incidencias where id = :'inc'), '95700000-0000-4000-8000-0000000000aa', 'RT-57.6: responsable guardado');
select public.escalar_incidencia(:'inc'::uuid, 'Requiere grúa urgente');
select is((select nivel_escalamiento from public.incidencias where id = :'inc'), 1, 'RT-57.7: nivel sube');
select ok((select count(*) from public.notificaciones_admin_operativas where titulo ilike 'Incidencia escalada%')::int >= 1, 'RT-57.8: Torre notificada');

-- resolver apaga el flag sin tocar el estado (criterio de salida)
select public.resolver_incidencia(:'inc'::uuid, 'Grúa en camino, unidad asegurada', null);
select is((select estado from public.incidencias where id = :'inc'), 'resuelta', 'RT-57.9: resuelta');
select is((select resuelta from public.incidencias where id = :'inc'), true, 'RT-57.10: bandera legacy sincronizada');
select is((select tiene_incidencia_abierta from public.traslados where id = '95700000-0000-4000-8000-000000000401'), false, 'RT-57.11: flag apagado');
select is((select estado from public.traslados where id = '95700000-0000-4000-8000-000000000401'), 'traslado_en_curso', 'RT-57.12: el viaje sigue su curso');

-- evidencia enlazada + RLS
insert into public.incidencia_evidencia_fotos (incidencia_id, foto_id)
values (:'inc'::uuid, '95700000-0000-4000-8000-000000000501');
select is((select count(*) from public.incidencia_evidencia_fotos where incidencia_id = :'inc')::int, 1, 'RT-57.13: evidencia enlazada');
set local role authenticated;
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000b1', true);
select is((select count(*) from public.incidencia_historial where incidencia_id = :'inc')::int >= 3, true, 'RT-57.14: dueño ve historial');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000b3', true);
select throws_ok(
  $$ insert into public.incidencias (traslado_id, tipo, momento, reportada_por, descripcion) values ('95700000-0000-4000-8000-000000000401', 'dano_previo_relevante', 'entrega', 'usuario', 'intento ajeno con texto largo') $$,
  null, null, 'RT-57.15: outsider no reporta'
);
reset role;

-- disputa con estado mantenido (11.9): T2 en servicio_cerrado
update public.traslados set estado = 'llegada_a_destino' where id = '95700000-0000-4000-8000-000000000402';
update public.traslados set estado = 'evidencia_final_en_proceso' where id = '95700000-0000-4000-8000-000000000402';
update public.traslados set estado = 'evidencia_final_completada' where id = '95700000-0000-4000-8000-000000000402';
update public.traslados set estado = 'entrega_confirmada' where id = '95700000-0000-4000-8000-000000000402';
update public.traslados set estado = 'pago_completado' where id = '95700000-0000-4000-8000-000000000402';
update public.traslados set estado = 'servicio_cerrado' where id = '95700000-0000-4000-8000-000000000402';
set local role authenticated;
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000b1', true);
select public.abrir_disputa_traslado('95700000-0000-4000-8000-000000000402', 'usuario', 'cobro_incorrecto', 'Cobro duplicado en mi tarjeta, reclamo formal', true) as disp
\gset
select is((select estado from public.traslados where id = '95700000-0000-4000-8000-000000000402'), 'servicio_cerrado', 'RT-57.16: disputa abre sin mover estado');
reset role;
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000ad', true);
select public.admin_resuelve_disputa(:'disp'::uuid, 'resuelta', 'favor_reclamante', 'Procede reembolso', true);
select is((select estado from public.disputas where id = :'disp'::uuid), 'resuelta', 'RT-57.17: disputa resuelta');
select is((select estado from public.traslados where id = '95700000-0000-4000-8000-000000000402'), 'servicio_cerrado', 'RT-57.18: resolución sin mover estado');

-- compat: default conserva el salto legacy
set local role authenticated;
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000b1', true);
select public.abrir_disputa_traslado('95700000-0000-4000-8000-000000000402', 'usuario', 'no_presentacion', 'Segunda disputa de compatibilidad formal', false) as disp2
\gset
select is((select estado from public.traslados where id = '95700000-0000-4000-8000-000000000402'), 'disputa_abierta', 'RT-57.19: default conserva salto');
select set_config('request.jwt.claim.sub', '95700000-0000-4000-8000-0000000000ad', true);
select public.admin_resuelve_disputa(:'disp2'::uuid, 'resuelta', 'en_contra', 'Sin mérito', false);
select is((select estado from public.traslados where id = '95700000-0000-4000-8000-000000000402'), 'disputa_resuelta', 'RT-57.20: default conserva cierre');

select * from finish();
rollback;
