-- RT-38 -- Carga masiva corporativa crea traslados sin aceptar precio desde CSV.

create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('93800000-0000-4000-8000-0000000000ad', 'rt38-admin@rt38.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('93800000-0000-4000-8000-000000000001', 'rt38-usuario@rt38.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.admins (id, auth_user_id, nombre)
values ('93800000-0000-4000-8000-0000000000aa', '93800000-0000-4000-8000-0000000000ad', 'Admin RT-38');

insert into public.empresas (id, nombre, estado_verificacion)
values ('93800000-0000-4000-8000-0000000000ee', 'Empresa RT-38', 'verificado');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, empresa_id, estado_verificacion)
values (
  '93800000-0000-4000-8000-000000000101',
  '93800000-0000-4000-8000-000000000001',
  'empresa',
  'titular_empresa',
  '93800000-0000-4000-8000-0000000000ee',
  'verificado'
);

select set_config('request.jwt.claim.sub', '93800000-0000-4000-8000-0000000000ad', true);
select set_config('role', 'authenticated', true);

select public.admin_crea_traslados_masivos(
  '93800000-0000-4000-8000-0000000000ee',
  '93800000-0000-4000-8000-000000000101',
  'rt38.csv',
  jsonb_build_array(jsonb_build_object(
    'referencia_externa', 'RT38-001',
    'vehiculo_placas', 'RT38001',
    'vehiculo_marca', 'Nissan',
    'vehiculo_modelo', 'Versa',
    'vehiculo_anio', '2024',
    'vehiculo_tipo', 'sedan',
    'categoria_tarifa', 'ligero_a',
    'gama', 'entrada',
    'condicion', 'seminueva',
    'origen_lat', '19.4326',
    'origen_lng', '-99.1332',
    'origen_direccion', 'Origen RT38',
    'origen_ciudad', 'CDMX',
    'destino_lat', '19.5000',
    'destino_lng', '-99.2000',
    'destino_direccion', 'Destino RT38',
    'destino_ciudad', 'CDMX',
    'precio_cotizado', '1'
  ))
) as resultado
\gset

select is((:'resultado'::jsonb->>'filas_creadas')::int, 1, 'RT-38.1: el lote crea una fila valida');
select is((:'resultado'::jsonb->>'filas_error')::int, 0, 'RT-38.2: el lote no reporta errores');

select is(
  (select count(*) from public.cargas_traslados_masivos where nombre_archivo = 'rt38.csv')::int,
  1,
  'RT-38.3: la carga queda registrada'
);

select is(
  (select count(*) from public.filas_carga_traslados_masivos where referencia_externa = 'RT38-001' and estado = 'creada')::int,
  1,
  'RT-38.4: la fila queda trazada como creada'
);

select is(
  (select precio_cotizado from public.traslados where id = (
    select traslado_id from public.filas_carga_traslados_masivos where referencia_externa = 'RT38-001'
  )),
  null::numeric,
  'RT-38.5: el precio cotizado nace nulo aunque el CSV intente enviarlo'
);

select ok(
  exists (
    select 1 from public.vehiculos
    where usuario_id = '93800000-0000-4000-8000-000000000101'
      and placas = 'RT38001'
      and categoria_tarifa = 'ligero_a'
  ),
  'RT-38.6: el vehiculo queda indexado al usuario corporativo con clasificacion tarifaria'
);

select * from finish();

rollback;
