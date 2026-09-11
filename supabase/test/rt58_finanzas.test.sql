-- RT-58 -- FASE 12 finanzas: quote persistente, versionado, finanzas por operación.
create extension if not exists pgtap with schema extensions;
begin;
select plan(20);

insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('95800000-0000-4000-8000-0000000000ad', 'rt58-admin@local.test', now(), '{}', '{}', now(), now()),
  ('95800000-0000-4000-8000-0000000000b1', 'rt58-usuario@local.test', now(), '{}', '{}', now(), now());

insert into public.admins (id, auth_user_id, nombre, rol_operativo)
values ('95800000-0000-4000-8000-0000000000aa', '95800000-0000-4000-8000-0000000000ad', 'Admin RT-58', 'direccion');

insert into public.empresas (id, nombre)
values ('95800000-0000-4000-8000-0000000000e1', 'Empresa RT-58');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado, empresa_id)
values ('95800000-0000-4000-8000-000000000101', '95800000-0000-4000-8000-0000000000b1', 'empresa', 'titular_empresa', 'verificado', true, '95800000-0000-4000-8000-0000000000e1');

insert into public.vehiculos (id, usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
values ('95800000-0000-4000-8000-000000000201', '95800000-0000-4000-8000-000000000101', 'sedan', 'RT58', 'Modelo', 2026, 'RT58ABC', true, true, true, true);

insert into public.operaciones (id, folio, empresa_id, nombre, tipo, estado)
values ('95800000-0000-4000-8000-000000000001', 'OP-RT58', '95800000-0000-4000-8000-0000000000e1', 'Operación RT-58', 'flota', 'en_curso');

insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia, operation_id, precio_final, ganancia_conductor_congelada)
values
  ('95800000-0000-4000-8000-000000000301', 'servicio_cerrado', '95800000-0000-4000-8000-000000000101', '95800000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '95800000-0000-4000-8000-000000000001', 1000, 600),
  ('95800000-0000-4000-8000-000000000302', 'traslado_en_curso', '95800000-0000-4000-8000-000000000101', '95800000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'al_cierre', gen_random_uuid(), '95800000-0000-4000-8000-000000000001', 500, 0);

insert into public.pagos (traslado_id, monto, momento, estado, metodo, comision_mxn)
values ('95800000-0000-4000-8000-000000000301', 1000, 'al_cierre', 'completado', 'tarjeta', 36);

insert into public.gastos_traslado (traslado_id, tipo, monto, descripcion)
values ('95800000-0000-4000-8000-000000000301', 'caseta', 100, 'Caseta RT-58');

-- 12.5: emitir precio congela quote con reglas
insert into public.traslados (id, estado, usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono, contacto_recepcion_nombre, contacto_recepcion_telefono, origen_lat, origen_lng, origen_direccion, origen_ciudad, destino_lat, destino_lng, destino_direccion, destino_ciudad, tipo_pago, clave_idempotencia)
values ('95800000-0000-4000-8000-000000000303', 'solicitud_creada', '95800000-0000-4000-8000-000000000101', '95800000-0000-4000-8000-000000000201', 'E', '+525500000001', 'R', '+525500000002', 19.4, -99.1, 'O', 'CDMX', 19.5, -99.2, 'D', 'CDMX', 'anticipado', gen_random_uuid());

update public.traslados set estado = 'cotizacion_generada' where id = '95800000-0000-4000-8000-000000000303';
update public.traslados set precio_cotizado = 1500 where id = '95800000-0000-4000-8000-000000000303';
select is((select count(*) from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303')::int, 1, 'RT-58.1: emitir congela quote');
select is((select precio from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303')::int, 1500, 'RT-58.2: precio congelado');
select ok((select (c.reglas_snapshot->>'precio')::numeric from public.cotizaciones c where c.traslado_id = '95800000-0000-4000-8000-000000000303') = 1500, 'RT-58.3: snapshot con precio');

update public.traslados set precio_cotizado = 1600 where id = '95800000-0000-4000-8000-000000000303';
select is((select count(*) from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303' and estado = 'reemplazada')::int, 1, 'RT-58.4: anterior reemplazada');
select is((select max(version) from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303')::int, 2, 'RT-58.5: versión 2');

update public.traslados set estado = 'cotizacion_aceptada' where id = '95800000-0000-4000-8000-000000000303';
select is((select aceptada_en from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303' and version = 2) is not null, true, 'RT-58.6: aceptación marcada');

-- 12.3/12.4: tocar la política crea versión y la captura la referencia
update public.tarifas_config set tarifa_hora = 100 where id = true;
select is((select count(*) from public.tarifas_politica_versiones)::int, 1, 'RT-58.7: tocar config versiona');
update public.traslados set precio_cotizado = 1700 where id = '95800000-0000-4000-8000-000000000303';
select is((select politica_tarifa_version from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303' and version = 3), (select max(id) from public.tarifas_politica_versiones), 'RT-58.7b: quote referencia última política');

-- 12.12: finanzas por operación (facturado 1000, costo 600, gastos 100, comisión 36)
select set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-0000000000ad', true);
select public.admin_finanzas_operacion('95800000-0000-4000-8000-000000000001') as fin
\gset
select is((:'fin'::jsonb->>'facturado')::numeric, 1000::numeric, 'RT-58.8: facturado');
select is((:'fin'::jsonb->>'costo_conductor')::numeric, 600::numeric, 'RT-58.9: costo conductor');
select is((:'fin'::jsonb->>'gastos_directos')::numeric, 100::numeric, 'RT-58.10: gastos');
select is((:'fin'::jsonb->>'comisiones')::numeric, 36::numeric, 'RT-58.11: comisiones');
select is((:'fin'::jsonb->>'margen_contribucion')::numeric, 264::numeric, 'RT-58.12: margen 1000-600-100-36');
select is((:'fin'::jsonb->>'traslados')::int, 2, 'RT-58.13: dos traslados');

-- 12.13: sin pago detectado (exactamente T2)
select is(jsonb_array_length(:'fin'::jsonb->'traslados_sin_pago'), 1, 'RT-58.14: un traslado sin pago');
select ok((:'fin'::jsonb->'traslados_sin_pago')::jsonb <@ '["95800000-0000-4000-8000-000000000302"]'::jsonb, 'RT-58.14b: es T2');
select ok(not ((:'fin'::jsonb->'traslados_sin_pago')::jsonb <@ '["95800000-0000-4000-8000-000000000301"]'::jsonb), 'RT-58.15: T1 pagado no listado');

-- RLS: dueño ve sus quotes
set local role authenticated;
select set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-0000000000b1', true);
select ok((select count(*) from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000303')::int >= 1, 'RT-58.16: dueño ve quotes');
reset role;

-- inexistente falla claro (como admin con permiso)
reset role;
select set_config('request.jwt.claim.sub', '95800000-0000-4000-8000-0000000000ad', true);
select throws_ok(
  $$ select public.admin_finanzas_operacion('95800000-0000-4000-8000-000000009999') $$,
  '22023', null,
  'RT-58.17: operación inexistente'
);

-- v1 intacto: traslados sin precio no generan quote
select is((select count(*) from public.cotizaciones where traslado_id = '95800000-0000-4000-8000-000000000301')::int, 0, 'RT-58.18: sin precio no hay quote');

select * from finish();
rollback;
