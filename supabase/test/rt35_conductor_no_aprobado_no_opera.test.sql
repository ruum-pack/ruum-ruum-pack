-- RT-35 — Un conductor no aprobado no ve oportunidades ni puede aceptarlas
-- por llamada directa al RPC.

create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('93500000-0000-4000-8000-000000000001', 'rt35-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('93500000-0000-4000-8000-000000000002', 'rt35-pendiente@local.test', now(), '{}', '{}', now(), now()),
  ('93500000-0000-4000-8000-000000000003', 'rt35-aprobado@local.test', now(), '{}', '{}', now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('93500000-0000-4000-8000-000000000101', '93500000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.vehiculos (
  id, usuario_id, tipo, marca, modelo, anio, placas,
  tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando
)
values (
  '93500000-0000-4000-8000-000000000201', '93500000-0000-4000-8000-000000000101',
  'sedan', 'RT35', 'Modelo', 2026, 'RT35ABC', true, true, true, true
);

insert into public.traslados (
  id, estado, usuario_id, vehiculo_id,
  contacto_entrega_nombre, contacto_entrega_telefono,
  contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, origen_ciudad,
  destino_lat, destino_lng, destino_direccion, destino_ciudad,
  precio_cotizado, tipo_pago, clave_idempotencia
)
values (
  '93500000-0000-4000-8000-000000000301', 'pendiente_de_conductor',
  '93500000-0000-4000-8000-000000000101', '93500000-0000-4000-8000-000000000201',
  'Entrega RT35', '+525500000001',
  'Recepcion RT35', '+525500000002',
  19.4326, -99.1332, 'Origen RT35', 'CDMX',
  19.5000, -99.2000, 'Destino RT35', 'CDMX',
  1200, 'al_cierre', gen_random_uuid()
);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;

insert into public.conductores (
  id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes,
  nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio
)
values
  (
    '93500000-0000-4000-8000-000000000401', '93500000-0000-4000-8000-000000000002',
    'Pendiente RT35', 'activo', 'en_revision', true, 'basico', 'basico', 5.00
  ),
  (
    '93500000-0000-4000-8000-000000000402', '93500000-0000-4000-8000-000000000003',
    'Aprobado RT35', 'activo', 'aprobado', true, 'basico', 'basico', 5.00
  );

alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93500000-0000-4000-8000-000000000002', true);

select is(
  (select count(*) from public.pasaporte_digital where estado = 'pendiente_de_conductor')::int,
  0,
  'RT-35.1: conductor no aprobado no ve oportunidades en pasaporte_digital'
);

select is(
  (select count(*) from public.traslados where estado = 'pendiente_de_conductor')::int,
  0,
  'RT-35.2: conductor no aprobado no ve traslados disponibles por tabla base'
);

select is(
  (select count(*) from public.vehiculos where id = '93500000-0000-4000-8000-000000000201')::int,
  0,
  'RT-35.3: conductor no aprobado no ve el vehículo de una oportunidad'
);

select throws_like(
  $$ select public.conductor_acepta_viaje('93500000-0000-4000-8000-000000000301') $$,
  '%Conductor no elegible%',
  'RT-35.4: conductor no aprobado no acepta por RPC directo'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93500000-0000-4000-8000-000000000003', true);

select is(
  (select count(*) from public.pasaporte_digital where estado = 'pendiente_de_conductor')::int,
  1,
  'RT-35.5: conductor aprobado sí ve oportunidades'
);

select is(
  public.conductor_acepta_viaje('93500000-0000-4000-8000-000000000301'),
  'conductor_asignado'::public.estado_traslado,
  'RT-35.6: conductor aprobado sí acepta por RPC'
);

reset role;

select * from finish();

rollback;
