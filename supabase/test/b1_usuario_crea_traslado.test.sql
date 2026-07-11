-- Test B1 — usuario_crea_traslado() (migración 20260711000118).
--
-- Cubre los dos huecos encontrados en el flujo de app-usuario/traslados/nuevo
-- y cerrados por esa migración:
--   1. Un usuario no puede crear un traslado sobre el vehículo de OTRO
--      usuario, ni mandando el vehiculo_id directo por RPC ni por insert
--      directo (el candado de propiedad vive en la RPC, security definer).
--   2. El INSERT directo en `traslados` y `vehiculos` ya no es posible desde
--      el cliente: la única vía es la RPC. Antes, un vehículo huérfano podía
--      quedar si el segundo insert (traslado) fallaba después del primero
--      (vehículo); con todo en una sola función no hay ventana para eso.
-- De paso valida el fix lateral: transmisión 'electrica' ya no revienta el
-- CHECK de vehiculos.
--
-- Cómo correr:
--   supabase db reset
--   supabase test db supabase/test/b1_usuario_crea_traslado.test.sql

create extension if not exists pgtap with schema extensions;

begin;

select plan(10);

create or replace function pg_temp.correr_b1() returns setof text as $$
declare
  v_auth_a uuid := gen_random_uuid();
  v_auth_b uuid := gen_random_uuid();
  v_usuario_a uuid;
  v_usuario_b uuid;
  v_vehiculo_a uuid;
  v_traslado_id uuid;
  v_traslado_generico jsonb := jsonb_build_object(
    'contacto_entrega_nombre', 'A', 'contacto_entrega_telefono', '+520000000000',
    'contacto_recepcion_nombre', 'B', 'contacto_recepcion_telefono', '+520000000001',
    'origen_lat', 19.0, 'origen_lng', -99.0, 'origen_direccion', 'origen', 'origen_ciudad', 'CDMX',
    'destino_lat', 19.5, 'destino_lng', -99.5, 'destino_direccion', 'destino', 'destino_ciudad', 'CDMX',
    'precio_cotizado', 1000, 'tipo_pago', 'anticipado'
  );
  v_vehiculo_nuevo jsonb := jsonb_build_object(
    'tipo', 'sedan', 'transmision', 'electrica', 'marca', 'Nissan', 'modelo', 'Versa',
    'anio', 2022, 'color', 'gris', 'placas', 'TEST-002', 'vin', 'VIN002',
    'estado_general_declarado', 'Buen estado', 'tiene_tarjeta_circulacion', true,
    'tiene_verificacion', true, 'tiene_placas', true, 'puede_circular_rodando', true
  );
  v_ok boolean;
  v_msg text;
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_auth_a, v_auth_a || '@b1.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_auth_b, v_auth_b || '@b1.test', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_a, 'personal', 'personal', 'verificado') returning id into v_usuario_a;
  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_b, 'personal', 'personal', 'verificado') returning id into v_usuario_b;

  insert into public.vehiculos (usuario_id, tipo, marca, modelo, anio, placas)
  values (v_usuario_a, 'sedan', 'Test', 'Modelo', 2020, 'TEST-001')
  returning id into v_vehiculo_a;

  -- 1) B intenta crear un traslado reutilizando el vehículo de A -> rechazado.
  perform set_config('request.jwt.claim.sub', v_auth_b::text, true);
  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(v_vehiculo_a, null, v_traslado_generico);
    v_ok := true;
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B1.1: no se puede crear un traslado con el vehículo de otro usuario');
  return next ok(v_msg ilike '%no existe o no pertenece%', 'B1.2: el rechazo es un mensaje de negocio, no un error crudo');

  return next is(
    (select count(*) from public.traslados),
    0::bigint,
    'B1.3: el intento rechazado no dejó ningún traslado creado'
  );

  -- 2) A crea un traslado con su propio vehículo guardado -> permitido.
  perform set_config('request.jwt.claim.sub', v_auth_a::text, true);
  perform set_config('role', 'authenticated', true);
  v_traslado_id := public.usuario_crea_traslado(v_vehiculo_a, null, v_traslado_generico);
  perform set_config('role', 'postgres', true);

  return next ok(v_traslado_id is not null, 'B1.4: A sí puede crear un traslado con su propio vehículo');
  return next is(
    (select vehiculo_id from public.traslados where id = v_traslado_id),
    v_vehiculo_a,
    'B1.5: el traslado quedó ligado al vehículo correcto'
  );

  -- 3) A crea un traslado con vehículo nuevo (incluye transmisión 'electrica').
  perform set_config('role', 'authenticated', true);
  v_traslado_id := public.usuario_crea_traslado(null, v_vehiculo_nuevo, v_traslado_generico);
  perform set_config('role', 'postgres', true);

  return next ok(v_traslado_id is not null, 'B1.6: se puede crear traslado + vehículo nuevo en un solo llamado');
  return next is(
    (select v.transmision from public.traslados t join public.vehiculos v on v.id = t.vehiculo_id where t.id = v_traslado_id),
    'electrica',
    'B1.7: transmisión "electrica" ya no revienta el CHECK de vehiculos'
  );
  return next is(
    (select v.usuario_id from public.traslados t join public.vehiculos v on v.id = t.vehiculo_id where t.id = v_traslado_id),
    v_usuario_a,
    'B1.8: el vehículo nuevo quedó asignado al usuario autenticado, no a uno inyectado'
  );

  return next ok(
    exists(select 1 from public.registro_auditoria where traslado_id = v_traslado_id and evento = 'creacion_solicitud_traslado'),
    'B1.9: la creación queda en la bitácora de auditoría'
  );

  -- 4) El INSERT directo a traslados ya no es posible (RLS sin política de insert).
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.traslados (
      usuario_id, vehiculo_id, contacto_entrega_nombre, contacto_entrega_telefono,
      contacto_recepcion_nombre, contacto_recepcion_telefono,
      origen_lat, origen_lng, origen_direccion, origen_ciudad,
      destino_lat, destino_lng, destino_direccion, destino_ciudad,
      precio_cotizado, tipo_pago
    ) values (
      v_usuario_a, v_vehiculo_a, 'A', '+520000000000', 'B', '+520000000001',
      19.0, -99.0, 'origen', 'CDMX', 19.5, -99.5, 'destino', 'CDMX', 1000, 'anticipado'
    );
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B1.10: el insert directo a traslados quedó cerrado; solo la RPC puede crear');
end;
$$ language plpgsql;

select * from pg_temp.correr_b1();

select * from finish();

rollback;
