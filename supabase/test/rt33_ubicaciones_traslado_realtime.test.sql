-- RT-33 -- Ubicacion en tiempo real: conductor asignado reporta, usuario dueno consulta.

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('93300000-0000-4000-8000-000000000001', 'rt33-usuario@local.test', now(), '{}', '{}', now(), now()),
  ('93300000-0000-4000-8000-000000000002', 'rt33-otro@local.test', now(), '{}', '{}', now(), now()),
  ('93300000-0000-4000-8000-0000000000cd', 'rt33-conductor@local.test', now(), '{}', '{}', now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values
  ('93300000-0000-4000-8000-000000000101', '93300000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true),
  ('93300000-0000-4000-8000-000000000102', '93300000-0000-4000-8000-000000000002', 'personal', 'personal', 'verificado', true);

insert into public.conductores (id, auth_user_id, nombre, estado, documentos_vigentes)
values ('93300000-0000-4000-8000-000000000201', '93300000-0000-4000-8000-0000000000cd', 'Conductor RT33', 'activo', true);

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('93300000-0000-4000-8000-000000000301', '93300000-0000-4000-8000-000000000101', 'sedan', 'RT33', 'Modelo', 2026, 'RT33ABC', true, true, true, true);

insert into public.traslados (
  id, estado, usuario_id, vehiculo_id, conductor_id,
  contacto_entrega_nombre, contacto_entrega_telefono,
  contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, origen_ciudad,
  destino_lat, destino_lng, destino_direccion, destino_ciudad,
  precio_cotizado, tipo_pago, clave_idempotencia
)
values (
  '93300000-0000-4000-8000-000000000401', 'traslado_en_curso',
  '93300000-0000-4000-8000-000000000101', '93300000-0000-4000-8000-000000000301',
  '93300000-0000-4000-8000-000000000201',
  'Entrega RT33', '+525500000001',
  'Recepcion RT33', '+525500000002',
  19.4326, -99.1332, 'Origen RT33', 'CDMX',
  19.5000, -99.2000, 'Destino RT33', 'CDMX',
  1200, 'al_cierre', gen_random_uuid()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '93300000-0000-4000-8000-0000000000cd', true);

insert into public.ubicaciones_traslado (traslado_id, conductor_id, lat, lng, precision_m, velocidad_mps)
values (
  '93300000-0000-4000-8000-000000000401',
  '93300000-0000-4000-8000-000000000201',
  19.4401000,
  -99.1501000,
  12.5,
  8.1
);

select public.registrar_telemetria_lote(
  '93300000-0000-4000-8000-000000000401',
  jsonb_build_array(jsonb_build_object(
    'localId', '93300000-0000-4000-8000-00000000a001',
    'lat', 19.441,
    'lng', -99.151,
    'precisionM', 9.5,
    'velocidadMps', 7.2,
    'deviceTimestamp', now(),
    'fuente', 'android_foreground_service',
    'online', true
  ))
);

select is(
  (select count(*) from public.ubicaciones_traslado where traslado_id = '93300000-0000-4000-8000-000000000401'),
  2::bigint,
  'RT-33.1: el conductor asignado inserta y lee su ubicacion'
);

select is(
  (select precision_m from public.tracking_salud_traslado where traslado_id = '93300000-0000-4000-8000-000000000401'),
  9.5::numeric,
  'RT-33.1b: la ingesta por lote actualiza salud GPS consumida por mapa'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93300000-0000-4000-8000-000000000001', true);
select is(
  (select count(*) from public.ubicaciones_traslado where traslado_id = '93300000-0000-4000-8000-000000000401'),
  2::bigint,
  'RT-33.2: el usuario dueno lee la ubicacion del traslado'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93300000-0000-4000-8000-000000000002', true);
select is(
  (select count(*) from public.ubicaciones_traslado where traslado_id = '93300000-0000-4000-8000-000000000401'),
  0::bigint,
  'RT-33.3: un usuario ajeno no lee ubicaciones de otro traslado'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '93300000-0000-4000-8000-000000000002', true);
select throws_ok(
  $$
    insert into public.ubicaciones_traslado (traslado_id, conductor_id, lat, lng)
    values (
      '93300000-0000-4000-8000-000000000401',
      '93300000-0000-4000-8000-000000000201',
      19.4500000,
      -99.1600000
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "ubicaciones_traslado"',
  'RT-33.4: un usuario ajeno no inserta ubicacion del conductor'
);
reset role;

select * from finish();

rollback;
