-- RT-54 -- FASE 8 operación masiva: preview, v2 ligada a operación, centros,
-- dedup, idempotencia, agregar/retirar; v1 intacto.
create extension if not exists pgtap with schema extensions;
begin;
select plan(18);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95400000-0000-4000-8000-0000000000ad', 'rt54-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95400000-0000-4000-8000-0000000000b1', 'rt54-titular@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('95400000-0000-4000-8000-0000000000aa', '95400000-0000-4000-8000-0000000000ad', 'Admin RT-54', 'direccion');

insert into public.empresas (id, nombre)
values
  ('95400000-0000-4000-8000-0000000000e1', 'Empresa RT-54'),
  ('95400000-0000-4000-8000-0000000000e2', 'Empresa Ajena RT-54');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values ('95400000-0000-4000-8000-000000000101', '95400000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '95400000-0000-4000-8000-0000000000e1');

insert into public.operaciones (id, folio, empresa_id, nombre, tipo, estado)
values
  ('95400000-0000-4000-8000-000000000001', 'OP-RT54', '95400000-0000-4000-8000-0000000000e1', 'Operación RT-54', 'flota', 'planificada'),
  ('95400000-0000-4000-8000-000000000002', 'OP-RT54-CERRADA', '95400000-0000-4000-8000-0000000000e1', 'Cerrada RT-54', 'flota', 'cerrada');

insert into public.empresa_sucursales (id, empresa_id, nombre, ciudad)
values
  ('95400000-0000-4000-8000-0000000000a1', '95400000-0000-4000-8000-0000000000e1', 'CEDIS Norte', 'CDMX'),
  ('95400000-0000-4000-8000-0000000000a2', '95400000-0000-4000-8000-0000000000e1', 'CEDIS Sur', 'CDMX'),
  ('95400000-0000-4000-8000-0000000000a9', '95400000-0000-4000-8000-0000000000e2', 'Ajena', 'MTY');

select set_config('request.jwt.claim.sub', '95400000-0000-4000-8000-0000000000ad', true);
select set_config('role', 'authenticated', true);

-- preview: 1 válida, 1 con error, 1 duplicada intra-archivo
select public.admin_previsualizar_carga_masiva(
  '95400000-0000-4000-8000-0000000000e1',
  '95400000-0000-4000-8000-000000000101',
  jsonb_build_array(
    jsonb_build_object('referencia_externa', 'RT54-001', 'vehiculo_placas', 'RT54001', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2', 'sucursal_origen_id', '95400000-0000-4000-8000-0000000000a1', 'sucursal_destino_id', '95400000-0000-4000-8000-0000000000a2'),
    jsonb_build_object('referencia_externa', 'RT54-002', 'vehiculo_placas', 'RT54002', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2'),
    jsonb_build_object('referencia_externa', 'RT54-001', 'vehiculo_placas', 'RT54003', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2')
  )
) as previa
\gset

select is((:'previa'::jsonb->>'total_filas')::int, 3, 'RT-54.1: preview ve 3 filas');
select is((:'previa'::jsonb->>'validas')::int, 1, 'RT-54.2: solo 1 válida');
select is((:'previa'::jsonb->'filas'->2->>'duplicada_en_archivo')::boolean, true, 'RT-54.3: detecta duplicada intra-archivo');
select ok((:'previa'::jsonb->'filas'->1->'errores')::jsonb ? 'vehiculo_marca es requerido', 'RT-54.4: reporta fila inválida');

-- v2: crea ligada a la operación con centros
select public.admin_crea_carga_masiva_operacion(
  '95400000-0000-4000-8000-000000000001',
  '95400000-0000-4000-8000-0000000000e1',
  '95400000-0000-4000-8000-000000000101',
  'rt54-op.csv',
  jsonb_build_array(
    jsonb_build_object('referencia_externa', 'RT54-001', 'vehiculo_placas', 'RT54001', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2', 'sucursal_origen_id', '95400000-0000-4000-8000-0000000000a1', 'sucursal_destino_id', '95400000-0000-4000-8000-0000000000a2')
  ),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  100,
  'text/csv'
) as creada
\gset

select is((select operation_id from public.cargas_traslados_masivos where id = (:'creada'::jsonb->>'carga_id')::uuid), '95400000-0000-4000-8000-000000000001', 'RT-54.5: carga ligada a operación');
select is((select sucursal_origen_id from public.filas_carga_traslados_masivos where carga_id = (:'creada'::jsonb->>'carga_id')::uuid), '95400000-0000-4000-8000-0000000000a1', 'RT-54.6: fila con centro origen');

-- procesar propaga la operación al traslado (autovinculado)
select public.admin_procesa_carga_traslados_masivos((:'creada'::jsonb->>'carga_id')::uuid, 10) as procesada
\gset
select is((:'procesada'::jsonb->>'filas_creadas')::int, 1, 'RT-54.7: procesa 1 fila');
select is(
  (select operation_id from public.traslados where id = (select traslado_id from public.filas_carga_traslados_masivos where carga_id = (:'creada'::jsonb->>'carga_id')::uuid and estado = 'creada')),
  '95400000-0000-4000-8000-000000000001',
  'RT-54.8: traslado hereda operación'
);

-- idempotencia por archivo: reutiliza
select public.admin_crea_carga_masiva_operacion(
  '95400000-0000-4000-8000-000000000001',
  '95400000-0000-4000-8000-0000000000e1',
  '95400000-0000-4000-8000-000000000101',
  'rt54-op.csv',
  jsonb_build_array(jsonb_build_object('referencia_externa', 'RT54-001', 'vehiculo_placas', 'RT54001', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2')),
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  100,
  'text/csv'
) as reutil
\gset
select ok((:'reutil'::jsonb->>'reutilizada')::boolean, 'RT-54.9: archivo repetido se reutiliza');
select is((:'reutil'::jsonb->>'carga_id'), (:'creada'::jsonb->>'carga_id'), 'RT-54.10: misma carga');

-- intra-dup hace fail-fast
select throws_ok(
  $$
  select public.admin_crea_carga_masiva_operacion(
    '95400000-0000-4000-8000-000000000001',
    '95400000-0000-4000-8000-0000000000e1',
    '95400000-0000-4000-8000-000000000101',
    'rt54-dup.csv',
    jsonb_build_array(
      jsonb_build_object('referencia_externa', 'DUP', 'vehiculo_placas', 'DUP001', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2'),
      jsonb_build_object('referencia_externa', 'DUP', 'vehiculo_placas', 'DUP002', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2')
    ),
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    100,
    'text/csv'
  )
  $$,
  null, null,
  'RT-54.11: duplicados intra-archivo rechazan la carga'
);

-- operación cerrada y sucursal ajena se rechazan
select throws_ok(
  $$
  select public.admin_crea_carga_masiva_operacion(
    '95400000-0000-4000-8000-000000000002',
    '95400000-0000-4000-8000-0000000000e1',
    '95400000-0000-4000-8000-000000000101',
    'rt54-cerrada.csv',
    jsonb_build_array(jsonb_build_object('referencia_externa', 'X', 'vehiculo_placas', 'X001', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2')),
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    100,
    'text/csv'
  )
  $$,
  null, null,
  'RT-54.12: operación cerrada no admite cargas'
);

select throws_ok(
  $$
  select public.admin_crea_carga_masiva_operacion(
    '95400000-0000-4000-8000-000000000001',
    '95400000-0000-4000-8000-0000000000e1',
    '95400000-0000-4000-8000-000000000101',
    'rt54-suc.csv',
    jsonb_build_array(jsonb_build_object('referencia_externa', 'Y', 'vehiculo_placas', 'Y001', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2', 'sucursal_origen_id', '95400000-0000-4000-8000-0000000000a9')),
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    100,
    'text/csv'
  )
  $$,
  null, null,
  'RT-54.13: sucursal ajena se rechaza'
);

-- agregar segunda carga a la misma operación (8.17)
select public.admin_crea_carga_masiva_operacion(
  '95400000-0000-4000-8000-000000000001',
  '95400000-0000-4000-8000-0000000000e1',
  '95400000-0000-4000-8000-000000000101',
  'rt54-segunda.csv',
  jsonb_build_array(jsonb_build_object('referencia_externa', 'RT54-010', 'vehiculo_placas', 'RT54010', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2')),
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  100,
  'text/csv'
) as segunda
\gset
select is(
  (select count(*) from public.cargas_traslados_masivos where operation_id = '95400000-0000-4000-8000-000000000001')::int,
  2, 'RT-54.14: segunda carga se agrega a la operación'
);

-- retirar vehículo: desvincula sin borrar (8.18)
update public.traslados
set operation_id = null
where id = (select traslado_id from public.filas_carga_traslados_masivos where carga_id = (:'creada'::jsonb->>'carga_id')::uuid and estado = 'creada');
select ok(
  (select operation_id from public.traslados where id = (select traslado_id from public.filas_carga_traslados_masivos where carga_id = (:'creada'::jsonb->>'carga_id')::uuid and estado = 'creada')) is null
  and exists (select 1 from public.traslados where id = (select traslado_id from public.filas_carga_traslados_masivos where carga_id = (:'creada'::jsonb->>'carga_id')::uuid and estado = 'creada')),
  'RT-54.15: retirar desvincula sin borrar'
);

-- v1 intacto sin operación (8.1 compat)
select public.admin_crea_traslados_masivos(
  '95400000-0000-4000-8000-0000000000e1',
  '95400000-0000-4000-8000-000000000101',
  'rt54-v1.csv',
  jsonb_build_array(jsonb_build_object('referencia_externa', 'RT54-V1', 'vehiculo_placas', 'RT54V01', 'vehiculo_marca', 'Nissan', 'vehiculo_modelo', 'Versa', 'vehiculo_anio', '2024', 'vehiculo_tipo', 'sedan', 'categoria_tarifa', 'ligero_a', 'gama', 'entrada', 'condicion', 'seminueva', 'origen_lat', '19.4', 'origen_lng', '-99.1', 'destino_lat', '19.5', 'destino_lng', '-99.2')),
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  100,
  'text/csv'
) as v1
\gset
select is((:'v1'::jsonb->>'estado'), 'pendiente', 'RT-54.16: v1 sigue encolando');
select is((select operation_id from public.cargas_traslados_masivos where id = (:'v1'::jsonb->>'carga_id')::uuid), null, 'RT-54.17: v1 sin operación');
select is((select count(*) from public.filas_carga_traslados_masivos where carga_id = (:'v1'::jsonb->>'carga_id')::uuid and sucursal_origen_id is null)::int, 1, 'RT-54.18: v1 sin centros');

select * from finish();
rollback;
