-- RT-34 -- El estado del traslado se publica para suscripcion Realtime.

create extension if not exists pgtap with schema extensions;

begin;

select plan(2);

select ok(
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'traslados'
  ),
  'RT-34.1: traslados esta en la publicacion supabase_realtime'
);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('93400000-0000-4000-8000-000000000001', 'rt34-usuario@local.test', now(), '{}', '{}', now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('93400000-0000-4000-8000-000000000101', '93400000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('93400000-0000-4000-8000-000000000301', '93400000-0000-4000-8000-000000000101', 'sedan', 'RT34', 'Modelo', 2026, 'RT34ABC', true, true, true, true);

insert into public.traslados (
  id, estado, usuario_id, vehiculo_id,
  contacto_entrega_nombre, contacto_entrega_telefono,
  contacto_recepcion_nombre, contacto_recepcion_telefono,
  origen_lat, origen_lng, origen_direccion, origen_ciudad,
  destino_lat, destino_lng, destino_direccion, destino_ciudad,
  precio_cotizado, tipo_pago, clave_idempotencia
)
values (
  '93400000-0000-4000-8000-000000000401', 'conductor_asignado',
  '93400000-0000-4000-8000-000000000101', '93400000-0000-4000-8000-000000000301',
  'Entrega RT34', '+525500000001',
  'Recepcion RT34', '+525500000002',
  19.4326, -99.1332, 'Origen RT34', 'CDMX',
  19.5000, -99.2000, 'Destino RT34', 'CDMX',
  1200, 'al_cierre', gen_random_uuid()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '93400000-0000-4000-8000-000000000001', true);

select is(
  (
    select estado
    from public.traslados
    where id = '93400000-0000-4000-8000-000000000401'
  ),
  'conductor_asignado'::public.estado_traslado,
  'RT-34.2: el usuario propietario puede leer el estado que recibira Realtime'
);

reset role;

select * from finish();

rollback;
