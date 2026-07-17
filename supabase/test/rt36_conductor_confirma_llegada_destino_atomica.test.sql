-- RT-36 -- La llegada a destino es una accion atomica de backend.

create extension if not exists pgtap with schema extensions;

begin;

select plan(14);

create or replace function pg_temp.crear_traslado_rt36(
  p_usuario_id uuid,
  p_conductor_id uuid,
  p_estado public.estado_traslado
)
returns uuid
language plpgsql
as $$
declare
  v_vehiculo_id uuid;
  v_traslado_id uuid;
begin
  insert into public.vehiculos (
    usuario_id, tipo, marca, modelo, anio, placas,
    tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando
  )
  values (
    p_usuario_id, 'sedan', 'RT36', 'Modelo', 2026, upper(substr(gen_random_uuid()::text, 1, 8)),
    true, true, true, true
  )
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
    'Entrega RT36', '+525500000001',
    'Recepcion RT36', '+525500000002',
    19.4326, -99.1332, 'Origen RT36', 'CDMX',
    19.5000, -99.2000, 'Destino RT36', 'CDMX',
    1200, 'al_cierre', gen_random_uuid()
  )
  returning id into v_traslado_id;

  return v_traslado_id;
end;
$$;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('93600000-0000-4000-8000-000000000001', 'rt36-usuario@local.test', '{}', '{}', now(), now()),
  ('93600000-0000-4000-8000-000000000002', 'rt36-conductor@local.test', '{}', '{}', now(), now()),
  ('93600000-0000-4000-8000-000000000003', 'rt36-otro-conductor@local.test', '{}', '{}', now(), now());

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, estado_verificacion, metodo_pago_registrado)
values ('93600000-0000-4000-8000-000000000101', '93600000-0000-4000-8000-000000000001', 'personal', 'personal', 'verificado', true);

insert into public.conductores (id, auth_user_id, nombre, estado, documentos_vigentes)
values
  ('93600000-0000-4000-8000-000000000201', '93600000-0000-4000-8000-000000000002', 'Conductor RT36', 'activo', true),
  ('93600000-0000-4000-8000-000000000202', '93600000-0000-4000-8000-000000000003', 'Otro Conductor RT36', 'activo', true);

select pg_temp.crear_traslado_rt36(
  '93600000-0000-4000-8000-000000000101',
  '93600000-0000-4000-8000-000000000201',
  'traslado_en_curso'
) as traslado_atomico
\gset

select set_config('request.jwt.claim.sub', '93600000-0000-4000-8000-000000000002', true);

select is(
  (
    select count(*)::int
    from public.estado_transiciones_validas
    where (estado_actual, estado_siguiente) in (
      ('evidencia_inicial_completada', 'llegada_a_destino'),
      ('vehiculo_recibido', 'llegada_a_destino')
    )
  ),
  0,
  'RT-36.0: la llegada atomica no amplia transiciones globales'
);

select pg_temp.crear_traslado_rt36(
  '93600000-0000-4000-8000-000000000101',
  '93600000-0000-4000-8000-000000000201',
  'evidencia_inicial_completada'
) as traslado_salto_directo
\gset

select throws_like(
  format($sql$ update public.traslados set estado = 'llegada_a_destino' where id = %L $sql$, :'traslado_salto_directo'),
  '%Transición de estado inválida: evidencia_inicial_completada -> llegada_a_destino%',
  'RT-36.0b: un update generico no puede saltar directo a destino'
);

select pg_temp.crear_traslado_rt36(
  '93600000-0000-4000-8000-000000000101',
  '93600000-0000-4000-8000-000000000201',
  'evidencia_inicial_completada'
) as traslado_sin_recepcion
\gset

select throws_like(
  format($sql$ select public.conductor_confirmar_llegada_destino(%L) $sql$, :'traslado_sin_recepcion'),
  '%No se puede confirmar llegada a destino desde estado evidencia_inicial_completada%',
  'RT-36.0c: la RPC no repara silenciosamente evidencia inicial sin recepcion'
);

select pg_temp.crear_traslado_rt36(
  '93600000-0000-4000-8000-000000000101',
  '93600000-0000-4000-8000-000000000201',
  'vehiculo_recibido'
) as traslado_sin_inicio
\gset

select throws_like(
  format($sql$ select public.conductor_confirmar_llegada_destino(%L) $sql$, :'traslado_sin_inicio'),
  '%No se puede confirmar llegada a destino desde estado vehiculo_recibido%',
  'RT-36.0d: la RPC no repara silenciosamente un traslado no iniciado'
);

select is(
  public.conductor_confirmar_llegada_destino(:'traslado_atomico')::text,
  'llegada_a_destino',
  'RT-36.1: el conductor confirma llegada a destino con una sola RPC'
);

select is(
  (
    select count(*)::int
    from public.registro_auditoria
    where traslado_id = :'traslado_atomico'::uuid
      and evento in ('llegada_destino', 'confirmacion_vehiculo_recibido', 'inicio_traslado')
  ),
  1,
  'RT-36.2: no se generan eventos intermedios de vehiculo recibido o inicio de traslado'
);

select ok(
  exists (
    select 1
    from public.registro_auditoria
    where traslado_id = :'traslado_atomico'::uuid
      and evento = 'llegada_destino'
      and actor = 'conductor'
      and datos->>'accion' = 'conductor_confirmar_llegada_destino'
      and datos->>'estado_anterior' = 'traslado_en_curso'
      and datos->>'estado_nuevo' = 'llegada_a_destino'
      and datos->>'fuera_geocerca' = 'false'
  ),
  'RT-36.3: la auditoria conserva estado anterior y accion atomica'
);

select is(
  public.conductor_confirmar_llegada_destino(:'traslado_atomico')::text,
  'llegada_a_destino',
  'RT-36.4: la segunda confirmacion es idempotente'
);

select is(
  (
    select count(*)::int
    from public.registro_auditoria
    where traslado_id = :'traslado_atomico'::uuid
      and evento = 'llegada_destino'
  ),
  1,
  'RT-36.5: la segunda confirmacion no duplica auditoria'
);

select set_config('request.jwt.claim.sub', '93600000-0000-4000-8000-000000000003', true);

select throws_like(
  format($sql$ select public.conductor_confirmar_llegada_destino(%L) $sql$, :'traslado_atomico'),
  '%El traslado no existe o no está asignado al conductor autenticado%',
  'RT-36.6: un conductor no asignado no puede confirmar llegada'
);

select set_config('request.jwt.claim.sub', '93600000-0000-4000-8000-000000000002', true);

select pg_temp.crear_traslado_rt36(
  '93600000-0000-4000-8000-000000000101',
  '93600000-0000-4000-8000-000000000201',
  'traslado_en_curso'
) as traslado_fuera_geocerca
\gset

select is(
  (
    select datos
    from public.registro_auditoria
    where traslado_id = :'traslado_fuera_geocerca'::uuid
      and evento = 'llegada_destino'
    limit 1
  ),
  null::jsonb,
  'RT-36.7: traslado de prueba inicia sin auditoria de llegada'
);

select is(
  public.conductor_confirmar_llegada_destino(:'traslado_fuera_geocerca', true, 742.4)::text,
  'llegada_a_destino',
  'RT-36.8: confirma llegada fuera de geocerca y conserva metadata'
);

select ok(
  exists (
    select 1
    from public.registro_auditoria
    where traslado_id = :'traslado_fuera_geocerca'::uuid
      and evento = 'llegada_destino'
      and datos->>'fuera_geocerca' = 'true'
      and datos->>'distancia_m' = '742'
  ),
  'RT-36.9: auditoria registra fuera_geocerca y distancia_m'
);

select pg_temp.crear_traslado_rt36(
  '93600000-0000-4000-8000-000000000101',
  '93600000-0000-4000-8000-000000000201',
  'conductor_en_camino_al_origen'
) as traslado_invalido
\gset

select throws_like(
  format($sql$ select public.conductor_confirmar_llegada_destino(%L) $sql$, :'traslado_invalido'),
  '%No se puede confirmar llegada a destino desde estado conductor_en_camino_al_origen%',
  'RT-36.10: estados previos a la ruta activa no pueden confirmar destino'
);

select * from finish();

rollback;
