-- RT-46 -- Alertas y SLA operacionales: sin demo, dedupe, acciones e historial.

create extension if not exists pgtap with schema extensions;

begin;

select plan(9);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('94600000-0000-4000-8000-000000000001', 'rt46-admin@ruum.test', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('94600000-0000-4000-8000-000000000101', '94600000-0000-4000-8000-000000000001', 'Admin RT46', 'supervisor');

insert into public.usuarios (
  id, auth_user_id, tipo_cuenta, rol, estado_verificacion, nombre, correo_facturacion, creado_en
) values (
  '94600000-0000-4000-8000-000000000201',
  null,
  'personal',
  'personal',
  'pendiente',
  'Usuario SLA RT46',
  'usuario-rt46@ruum.test',
  now() - interval '3 days'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '94600000-0000-4000-8000-000000000001', true);

select ok(
  exists(select 1 from public.sla_reglas_operativas where tipo_alerta = 'cuenta_nueva_usuario' and horas_limite = 2),
  'RT-46.1: existen reglas oficiales de SLA'
);

select ok(
  public.sla_horas_operativas_desde(now() - interval '3 days', 'America/Mexico_City', true) > 0,
  'RT-46.2: el calculo server-side usa zona horaria y pausa operativa'
);

select public.admin_sincroniza_alertas_sla_operacionales();

select is(
  (select count(*) from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  1::bigint,
  'RT-46.3: sincroniza una alerta operacional real para el usuario'
);

select public.admin_sincroniza_alertas_sla_operacionales();

select is(
  (select count(*) from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  1::bigint,
  'RT-46.4: el dedupe_key evita alertas duplicadas'
);

select public.admin_actualiza_alerta_sla(
  (select id from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  'asignar',
  'Torre de Control',
  'Asignacion RT46'
);

select is(
  (select responsable from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  'Torre de Control',
  'RT-46.5: la asignacion de responsable queda persistida como dato operacional'
);

select public.admin_actualiza_alerta_sla(
  (select id from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  'escalar',
  null,
  'Escalamiento RT46'
);

select ok(
  exists(select 1 from public.notificaciones_admin_operativas where alerta_id = (select id from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201')),
  'RT-46.6: el escalamiento encola notificacion operacional'
);

select public.admin_actualiza_alerta_sla(
  (select id from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  'resolver',
  null,
  'Resolucion RT46'
);

select public.admin_actualiza_alerta_sla(
  (select id from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  'cerrar',
  null,
  'Cierre RT46'
);

select is(
  (select estado from public.alertas_sla_operacionales where entidad_id = '94600000-0000-4000-8000-000000000201'),
  'cerrada',
  'RT-46.7: resolucion y cierre actualizan el ciclo de vida'
);

select ok(
  exists(select 1 from public.alertas_sla_historial where accion = 'cerrada'),
  'RT-46.8: las acciones quedan en historial'
);

select ok(
  exists(select 1 from public.auditoria_admin_seguridad where recurso = 'alertas_sla' and accion = 'cerrar'),
  'RT-46.9: los cambios sensibles quedan auditados'
);

rollback;
