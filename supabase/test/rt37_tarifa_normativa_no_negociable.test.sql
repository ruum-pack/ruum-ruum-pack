-- RT-37 -- Torre de Control aplica tarifas normativas; no negocia precios.

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('93700000-0000-4000-8000-0000000000ad', 'rt37-admin@rt37.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('93700000-0000-4000-8000-000000000001', 'rt37-usuario@rt37.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('93700000-0000-4000-8000-0000000000aa', '93700000-0000-4000-8000-0000000000ad', 'Admin RT-37');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion)
values ('93700000-0000-4000-8000-000000000101', '93700000-0000-4000-8000-000000000001', 'empresa', 'titular_empresa', 'verificado');

insert into public.vehiculos (
  id, usuario_id, tipo, marca, modelo, anio,
  tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando,
  categoria_tarifa, gama, condicion
) values (
  '93700000-0000-4000-8000-000000000201', '93700000-0000-4000-8000-000000000101',
  'sedan', 'RT37', 'Normativo', 2026,
  true, true, true, true,
  'ligero_a', 'entrada', 'seminueva'
);

insert into public.traslados (
  id, usuario_id, vehiculo_id,
  contacto_entrega_nombre, contacto_entrega_telefono,
  contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, origen_ciudad,
  destino_lat, destino_lng, destino_direccion, destino_ciudad,
  distancia_km, tiempo_estimado_horas, modalidad_programacion, fecha_hora_programada, tipo_pago
) values (
  '93700000-0000-4000-8000-000000000301',
  '93700000-0000-4000-8000-000000000101',
  '93700000-0000-4000-8000-000000000201',
  'Entrega RT37', '+525500000037',
  'Recepcion RT37', '+525500000038',
  19.4326000, -99.1332000, 'Origen RT37', 'CDMX',
  19.5000000, -99.2000000, 'Destino RT37', 'CDMX',
  10.00, 1.00, 'programado', '2026-07-20 12:00:00-06'::timestamptz, 'anticipado'
);

select set_config('request.jwt.claim.sub', '93700000-0000-4000-8000-0000000000ad', true);
select set_config('role', 'authenticated', true);

select is(
  public.admin_sugerir_tarifa_traslado('93700000-0000-4000-8000-000000000301'),
  public.calcular_tarifa_traslado(
    'ligero_a', 'rango_1', 'entrada', 'seminueva',
    public.horario_desde_timestamp('2026-07-20 12:00:00-06'::timestamptz),
    public.dia_desde_timestamp('2026-07-20 12:00:00-06'::timestamptz),
    10.00, 1.00
  ),
  'RT-37.1: la tarifa normativa viene de la formula vigente'
);

select throws_like(
  $sql$ select public.admin_emite_cotizacion('93700000-0000-4000-8000-000000000301', 99999) $sql$,
  '%no coincide con la tarifa normativa vigente%',
  'RT-37.2: una cotizacion alterada desde operacion se rechaza'
);

select ok(
  public.admin_aplica_tarifa_normativa('93700000-0000-4000-8000-000000000301') > 0,
  'RT-37.3: la RPC normativa emite cotizacion sin recibir precio libre'
);

select is(
  (select estado::text from public.traslados where id = '93700000-0000-4000-8000-000000000301'),
  'cotizacion_generada',
  'RT-37.4: aplicar tarifa normativa deja el traslado en cotizacion generada'
);

select is(
  (select precio_cotizado from public.traslados where id = '93700000-0000-4000-8000-000000000301'),
  public.admin_sugerir_tarifa_traslado('93700000-0000-4000-8000-000000000301'),
  'RT-37.5: precio_cotizado queda igual a la tarifa normativa vigente'
);

select * from finish();

rollback;
