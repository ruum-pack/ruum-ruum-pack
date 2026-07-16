-- RT-30 / RT-31 / RT-34 -- El conductor confirma entrega y cierra viaje, pero no resuelve pagos.

create extension if not exists pgtap with schema extensions;

begin;

select plan(5);

create or replace function pg_temp.crear_traslado_rt30(
  p_usuario_id uuid,
  p_conductor_id uuid,
  p_estado public.estado_traslado,
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
    p_estado, p_usuario_id, v_vehiculo_id, p_conductor_id,
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
  ('93000000-0000-4000-8000-0000000000cd', 'rt30-conductor@rt30.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('93000000-0000-4000-8000-000000000101', '93000000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.conductores (id, auth_user_id, nombre, estado, documentos_vigentes)
values ('93000000-0000-4000-8000-000000000201', '93000000-0000-4000-8000-0000000000cd', 'Conductor RT30', 'activo', true);

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-0000000000cd', true);

select pg_temp.crear_traslado_rt30(
  '93000000-0000-4000-8000-000000000101',
  '93000000-0000-4000-8000-000000000201',
  'evidencia_final_completada',
  'al_cierre'
) as traslado_entrega
\gset

select is(
  public.conductor_avanza_traslado(:'traslado_entrega', 'confirmar_entrega')::text,
  'entrega_confirmada',
  'RT-30.1: el conductor solo confirma la entrega'
);

select ok(
  exists (
    select 1
    from public.registro_auditoria
    where traslado_id = :'traslado_entrega'::uuid
      and evento = 'confirmacion_entrega'
      and actor = 'conductor'
  ),
  'RT-30.2: la entrega queda auditada como accion del conductor'
);

select throws_ok(
  format($sql$ select public.conductor_avanza_traslado(%L, 'resolver_pago_entrega') $sql$, :'traslado_entrega'),
  'P0001',
  'Evento de conductor no soportado: resolver_pago_entrega',
  'RT-31.1: el conductor no resuelve pasos de pago'
);

select is(
  public.conductor_avanza_traslado(:'traslado_entrega', 'cerrar_viaje')::text,
  'servicio_cerrado',
  'RT-34.1: el conductor cierra el viaje sin resolver pago'
);

select ok(
  exists (
    select 1
    from public.registro_auditoria
    where traslado_id = :'traslado_entrega'::uuid
      and evento = 'cierre_traslado'
      and actor = 'conductor'
      and datos->>'evento_conductor' = 'cerrar_viaje'
  ),
  'RT-34.2: el cierre operativo queda auditado como accion del conductor'
);

select * from finish();

rollback;
