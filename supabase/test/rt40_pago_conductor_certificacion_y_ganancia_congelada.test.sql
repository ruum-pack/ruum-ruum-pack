-- RT-40 -- El conductor lee exclusivamente su ganancia (nunca la tarifa del
-- usuario), calculada por certificación de pago, y esa ganancia se congela
-- al aceptar el viaje.

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('94000000-0000-4000-8000-0000000000ad', 'rt40-admin@local.test', now(), '{}', '{}', now(), now()),
  ('94000000-0000-4000-8000-000000000001', 'rt40-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('94000000-0000-4000-8000-000000000002', 'rt40-estandar@local.test', now(), '{}', '{}', now(), now()),
  ('94000000-0000-4000-8000-000000000003', 'rt40-premium@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('94000000-0000-4000-8000-0000000aaa', '94000000-0000-4000-8000-0000000000ad', 'Admin RT-40');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.vehiculos (
  id, usuario_id, tipo, marca, modelo, anio, placas,
  tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando
)
values (
  '94000000-0000-4000-8000-000000000201', '94000000-0000-4000-8000-000000000101',
  'sedan', 'RT40', 'Modelo', 2026, 'RT40ABC', true, true, true, true
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
  '94000000-0000-4000-8000-000000000301', 'pendiente_de_conductor',
  '94000000-0000-4000-8000-000000000101', '94000000-0000-4000-8000-000000000201',
  'Entrega RT40', '+525500000001',
  'Recepcion RT40', '+525500000002',
  19.4326, -99.1332, 'Origen RT40', 'CDMX',
  19.5000, -99.2000, 'Destino RT40', 'CDMX',
  1000.00, 'al_cierre', gen_random_uuid()
);

alter table public.conductores disable trigger inicializar_estado_expediente_conductor;

insert into public.conductores (
  id, auth_user_id, nombre, estado, estado_expediente, documentos_vigentes,
  nivel_por_experiencia, nivel_por_calificacion, calificacion_promedio, certificacion_pago
)
values
  (
    '94000000-0000-4000-8000-000000000401', '94000000-0000-4000-8000-000000000002',
    'Estandar RT40', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'estandar'
  ),
  (
    '94000000-0000-4000-8000-000000000402', '94000000-0000-4000-8000-000000000003',
    'Premium RT40', 'activo', 'aprobado', true, 'basico', 'basico', 5.00, 'premium'
  );

alter table public.conductores enable trigger inicializar_estado_expediente_conductor;

-- Conductor estándar (40%) mira la oportunidad disponible.
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);

select is(
  (select ganancia_conductor from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  400.00,
  'RT-40.1: conductor estándar ve estimación de 40% ($400) sobre una tarifa de $1000'
);

select is(
  (select precio_cotizado from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  null::numeric,
  'RT-40.2: conductor no puede leer precio_cotizado del traslado, ni disponible'
);

reset role;

-- Mismo viaje, mismo momento -- conductor premium (52%) ve una estimación distinta.
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000003', true);

select is(
  (select ganancia_conductor from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  520.00,
  'RT-40.3: conductor premium ve estimación de 52% ($520) sobre la misma tarifa -- es por conductor, no por traslado'
);

reset role;

-- El conductor estándar acepta el viaje -- se congela su ganancia.
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000002', true);

select is(
  public.conductor_acepta_viaje('94000000-0000-4000-8000-000000000301'),
  'conductor_asignado'::public.estado_traslado,
  'RT-40.4: conductor estándar acepta el viaje'
);

select is(
  (select ganancia_conductor from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  400.00,
  'RT-40.5: ya asignado, sigue viendo $400 -- ahora es el monto congelado, no la estimación'
);

select is(
  (select precio_final from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  null::numeric,
  'RT-40.6: ya asignado, sigue sin poder leer precio_final'
);

select throws_like(
  $$ update public.conductores set certificacion_pago = 'premium' where id = '94000000-0000-4000-8000-000000000401' $$,
  '%No puedes modificar campos operativos%',
  'RT-40.7: el conductor no puede auto-asignarse una certificación de pago mayor'
);

reset role;

-- El conductor premium ya no ve el viaje (dejó de estar disponible) ni su ganancia.
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000003', true);

select is(
  (select count(*) from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301')::int,
  0,
  'RT-40.8: conductor premium ya no ve el viaje una vez asignado a otro conductor'
);

reset role;

-- Admin sí ve la tarifa completa y el monto congelado.
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-0000000000ad', true);

select is(
  (select precio_cotizado from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  1000.00,
  'RT-40.9: admin sí ve precio_cotizado completo'
);

select is(
  (select ganancia_conductor from public.pasaporte_digital where traslado_id = '94000000-0000-4000-8000-000000000301'),
  400.00,
  'RT-40.10: admin ve el monto congelado del conductor'
);

reset role;

select * from finish();

rollback;
