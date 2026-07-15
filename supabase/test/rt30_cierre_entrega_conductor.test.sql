-- RT-30 -- El conductor puede continuar despues de entrega_confirmada.

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

create or replace function pg_temp.crear_traslado_rt30(
  p_usuario_id uuid,
  p_conductor_id uuid,
  p_tipo_pago public.tipo_pago
)
returns uuid
language plpgsql
as $$
declare
  v_vehiculo_id uuid;
  v_traslado_id uuid;
begin
  insert into public.vehiculos (usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
  values (p_usuario_id, 'sedan', 'RT30', 'Modelo', 2024, upper(substr(gen_random_uuid()::text, 1, 8)), true, true, true, true)
  returning id into v_vehiculo_id;

  insert into public.traslados (
    estado, usuario_id, vehiculo_id, conductor_id,
    contacto_entrega_nombre, contacto_entrega_telefono,
    contacto_recepcion_nombre, contacto_recepcion_telefono,
    origen_lat, origen_lng, origen_direccion, origen_ciudad,
    destino_lat, destino_lng, destino_direccion, destino_ciudad,
    precio_cotizado, tipo_pago, clave_idempotencia
  )
  values (
    'entrega_confirmada', p_usuario_id, v_vehiculo_id, p_conductor_id,
    'Entrega RT30', '+525500000001',
    'Recepcion RT30', '+525500000002',
    19.4326, -99.1332, 'Origen RT30', 'CDMX',
    19.5000, -99.2000, 'Destino RT30', 'CDMX',
    1200, p_tipo_pago, gen_random_uuid()
  )
  returning id into v_traslado_id;

  return v_traslado_id;
end;
$$;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('93000000-0000-4000-8000-000000000001', 'rt30-usuario@rt30.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('93000000-0000-4000-8000-000000000002', 'rt30-cierre@rt30.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('93000000-0000-4000-8000-0000000000cd', 'rt30-conductor@rt30.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values
  ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', false),
  ('93000000-0000-4000-8000-000000000102', '93000000-0000-4000-8000-000000000002', 'personal', 'personal', 'verificado', true);

insert into public.conductores (id, auth_user_id, nombre, estado, documentos_vigentes)
values ('93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-0000000000cd', 'Conductor RT30', 'activo', true);

select pg_temp.crear_traslado_rt30(
  '93000000-0000-4000-8000-000000000101',
  '93000000-0000-4000-8000-000000000201',
  'anticipado'
) as traslado_anticipado
\gset

insert into public.pagos (traslado_id, monto, momento, estado, metodo)
values (:'traslado_anticipado', 1200, 'anticipado', 'completado', 'tarjeta');

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-0000000000cd', true);

select is(
  public.conductor_avanza_traslado(:'traslado_anticipado', 'resolver_pago_entrega')::text,
  'pago_completado',
  'RT-30.1: entrega confirmada con pago anticipado completado avanza a pago_completado'
);

select is(
  public.conductor_avanza_traslado(:'traslado_anticipado', 'cerrar_servicio')::text,
  'servicio_cerrado',
  'RT-30.2: pago_completado permite cerrar el servicio'
);

select ok(
  exists (
    select 1
    from public.registro_auditoria
    where traslado_id = :'traslado_anticipado'::uuid
      and evento = 'cierre_traslado'
      and actor = 'conductor'
  ),
  'RT-30.3: el cierre queda auditado como accion del conductor'
);

select pg_temp.crear_traslado_rt30(
  '93000000-0000-4000-8000-000000000102',
  '93000000-0000-4000-8000-000000000201',
  'al_cierre'
) as traslado_cierre
\gset

select is(
  public.conductor_avanza_traslado(:'traslado_cierre', 'resolver_pago_entrega')::text,
  'pago_pendiente',
  'RT-30.4: entrega confirmada con pago al cierre avanza a pago_pendiente'
);

select pg_temp.crear_traslado_rt30(
  '93000000-0000-4000-8000-000000000101',
  '93000000-0000-4000-8000-000000000201',
  'anticipado'
) as traslado_sin_pago
\gset

select throws_ok(
  format($sql$ select public.conductor_avanza_traslado(%L, 'resolver_pago_entrega') $sql$, :'traslado_sin_pago'),
  'P0001',
  'No se puede cerrar la entrega: falta pago anticipado completado.',
  'RT-30.5: anticipado sin pago completado no puede cerrarse'
);

select * from finish();

rollback;
