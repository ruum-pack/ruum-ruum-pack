-- RT-29 -- La evidencia inicial se desbloquea por garantia economica real.
--
-- El caso que cubre este test: pago anticipado ya completado en `pagos`, pero
-- `usuarios.metodo_pago_registrado = false`. Antes la RPC devolvia false y el
-- conductor quedaba bloqueado al confirmar las 5 fotos.

create extension if not exists pgtap with schema extensions;

begin;

select plan(6);

create or replace function pg_temp.crear_traslado_rt29(
  p_usuario_id uuid,
  p_conductor_id uuid,
  p_tipo_pago public.tipo_pago,
  p_estado public.estado_traslado default 'evidencia_inicial_en_proceso'
)
returns uuid
language plpgsql
as $$
declare
  v_vehiculo_id uuid;
  v_traslado_id uuid;
begin
  insert into public.vehiculos (usuario_id, tipo, marca, modelo, anio, placas, tiene_tarjeta_circulacion, tiene_verificacion, tiene_placas, puede_circular_rodando)
  values (p_usuario_id, 'sedan', 'RT29', 'Modelo', 2024, upper(substr(gen_random_uuid()::text, 1, 8)), true, true, true, true)
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
    'Entrega RT29', '+525500000001',
    'Recepcion RT29', '+525500000002',
    19.4326, -99.1332, 'Origen RT29', 'CDMX',
    19.5000, -99.2000, 'Destino RT29', 'CDMX',
    1200, p_tipo_pago, gen_random_uuid()
  )
  returning id into v_traslado_id;

  return v_traslado_id;
end;
$$;

create or replace function pg_temp.insertar_evidencia_inicial_rt29(p_traslado_id uuid)
returns void
language sql
as $$
  insert into public.evidencia_fotos (traslado_id, tipo, angulo, url, sincronizada)
  values
    (p_traslado_id, 'inicial', 'frente', 'rt29://frente', true),
    (p_traslado_id, 'inicial', 'lado_piloto', 'rt29://lado_piloto', true),
    (p_traslado_id, 'inicial', 'lado_copiloto', 'rt29://lado_copiloto', true),
    (p_traslado_id, 'inicial', 'trasera', 'rt29://trasera', true),
    (p_traslado_id, 'inicial', 'tablero', 'rt29://tablero', true);
$$;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('92900000-0000-4000-8000-000000000001', 'rt29-personal@rt29.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92900000-0000-4000-8000-000000000002', 'rt29-cierre@rt29.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92900000-0000-4000-8000-000000000003', 'rt29-empresa@rt29.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92900000-0000-4000-8000-000000000004', 'rt29-titular@rt29.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('92900000-0000-4000-8000-0000000000cd', 'rt29-conductor@rt29.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.empresas (id, nombre)
values ('92900000-0000-4000-8000-0000000000ee', 'Empresa RT29');

insert into public.usuarios (id, auth_user_id, tipo_cuenta, rol, empresa_id, estado_verificacion, metodo_pago_registrado)
values
  ('92900000-0000-4000-8000-000000000101', '92900000-0000-4000-8000-000000000001', 'personal', 'personal', null, 'verificado', false),
  ('92900000-0000-4000-8000-000000000102', '92900000-0000-4000-8000-000000000002', 'personal', 'personal', null, 'verificado', false),
  ('92900000-0000-4000-8000-000000000103', '92900000-0000-4000-8000-000000000003', 'empresa', 'usuario_autorizado', '92900000-0000-4000-8000-0000000000ee', 'verificado', false),
  ('92900000-0000-4000-8000-000000000104', '92900000-0000-4000-8000-000000000004', 'empresa', 'titular_empresa', '92900000-0000-4000-8000-0000000000ee', 'verificado', true);

insert into public.conductores (id, auth_user_id, nombre, estado, documentos_vigentes)
values ('92900000-0000-4000-8000-000000000201', '92900000-0000-4000-8000-0000000000cd', 'Conductor RT29', 'activo', true);

select pg_temp.crear_traslado_rt29(
  '92900000-0000-4000-8000-000000000101',
  '92900000-0000-4000-8000-000000000201',
  'anticipado'
) as traslado_anticipado
\gset

insert into public.pagos (traslado_id, monto, momento, estado, metodo)
values (:'traslado_anticipado', 1200, 'anticipado', 'completado', 'tarjeta');

select pg_temp.insertar_evidencia_inicial_rt29(:'traslado_anticipado');

select is(
  public.traslado_tiene_metodo_pago_registrado(:'traslado_anticipado'),
  true,
  'RT-29.1: pago anticipado completado habilita evidencia aunque el usuario no tenga metodo guardado'
);

select set_config('request.jwt.claim.sub', '92900000-0000-4000-8000-0000000000cd', true);
select is(
  public.conductor_avanza_traslado(:'traslado_anticipado', 'evidencia_inicial_completada')::text,
  'evidencia_inicial_completada',
  'RT-29.2: el conductor puede confirmar evidencia inicial con pago anticipado completado'
);

select pg_temp.crear_traslado_rt29(
  '92900000-0000-4000-8000-000000000101',
  '92900000-0000-4000-8000-000000000201',
  'anticipado'
) as traslado_anticipado_pendiente
\gset

insert into public.pagos (traslado_id, monto, momento, estado, metodo)
values (:'traslado_anticipado_pendiente', 1200, 'anticipado', 'pendiente', 'tarjeta');

select is(
  public.traslado_tiene_metodo_pago_registrado(:'traslado_anticipado_pendiente'),
  false,
  'RT-29.3: pago anticipado pendiente no habilita evidencia inicial'
);

select pg_temp.crear_traslado_rt29(
  '92900000-0000-4000-8000-000000000102',
  '92900000-0000-4000-8000-000000000201',
  'al_cierre'
) as traslado_cierre_sin_metodo
\gset

select is(
  public.traslado_tiene_metodo_pago_registrado(:'traslado_cierre_sin_metodo'),
  false,
  'RT-29.4: pago al cierre sin metodo registrado sigue bloqueado'
);

update public.usuarios
set metodo_pago_registrado = true
where id = '92900000-0000-4000-8000-000000000102';

select is(
  public.traslado_tiene_metodo_pago_registrado(:'traslado_cierre_sin_metodo'),
  true,
  'RT-29.5: pago al cierre con metodo registrado sigue habilitado'
);

select pg_temp.crear_traslado_rt29(
  '92900000-0000-4000-8000-000000000103',
  '92900000-0000-4000-8000-000000000201',
  'al_cierre'
) as traslado_empresa
\gset

select is(
  public.traslado_tiene_metodo_pago_registrado(:'traslado_empresa'),
  true,
  'RT-29.6: titular de empresa con metodo registrado habilita traslado empresarial al cierre'
);

select * from finish();

rollback;
