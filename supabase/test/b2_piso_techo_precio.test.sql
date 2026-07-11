-- Test B2 — piso/techo de precio_cotizado en usuario_crea_traslado()
-- (migración 20260711000119).
--
-- Objetivo: el precio cotizado por el usuario ya no puede ser cualquier
-- número. Cubre el piso fijo ($699), el techo fijo ($100,000), los bordes
-- exactos, y que una tarifa activa en `tarifas_admin` puede subir el piso
-- por encima de $699 para ese tipo de vehículo (pero una tarifa inactiva no
-- cuenta).
--
-- Cómo correr:
--   supabase db reset
--   supabase test db supabase/test/b2_piso_techo_precio.test.sql

create extension if not exists pgtap with schema extensions;

begin;

select plan(7);

create or replace function pg_temp.correr_b2() returns setof text as $$
declare
  v_auth uuid := gen_random_uuid();
  v_usuario_id uuid;
  v_ok boolean;
  v_msg text;

  v_traslado_base jsonb := jsonb_build_object(
    'contacto_entrega_nombre', 'A', 'contacto_entrega_telefono', '+520000000000',
    'contacto_recepcion_nombre', 'B', 'contacto_recepcion_telefono', '+520000000001',
    'origen_lat', 19.0, 'origen_lng', -99.0, 'origen_direccion', 'origen', 'origen_ciudad', 'CDMX',
    'destino_lat', 19.5, 'destino_lng', -99.5, 'destino_direccion', 'destino', 'destino_ciudad', 'CDMX',
    'tipo_pago', 'anticipado'
  );
  v_vehiculo_sedan jsonb := jsonb_build_object(
    'tipo', 'sedan', 'transmision', 'automatica', 'marca', 'Nissan', 'modelo', 'Versa',
    'anio', 2022, 'color', 'gris', 'placas', 'TEST-B2-1', 'vin', 'VINB21',
    'estado_general_declarado', 'Buen estado', 'tiene_tarjeta_circulacion', true,
    'tiene_verificacion', true, 'tiene_placas', true, 'puede_circular_rodando', true
  );
  v_vehiculo_luxury jsonb := jsonb_build_object(
    'tipo', 'luxury', 'transmision', 'automatica', 'marca', 'BMW', 'modelo', 'Serie 5',
    'anio', 2022, 'color', 'negro', 'placas', 'TEST-B2-2', 'vin', 'VINB22',
    'estado_general_declarado', 'Buen estado', 'tiene_tarjeta_circulacion', true,
    'tiene_verificacion', true, 'tiene_placas', true, 'puede_circular_rodando', true
  );
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_auth, v_auth || '@b2.test', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth, 'personal', 'personal', 'verificado') returning id into v_usuario_id;

  perform set_config('request.jwt.claim.sub', v_auth::text, true);

  -- 1) Por debajo del piso fijo -> rechazado.
  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(null, v_vehiculo_sedan, v_traslado_base || jsonb_build_object('precio_cotizado', 698));
    v_ok := true;
    v_msg := null;
  exception when others then
    v_ok := false;
    v_msg := sqlerrm;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B2.1: $698 (bajo el piso de $699) se rechaza');
  return next ok(v_msg ilike '%al menos%', 'B2.2: el rechazo explica el piso, no es un error crudo');

  -- 2) Justo en el piso -> aceptado.
  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(null, v_vehiculo_sedan, v_traslado_base || jsonb_build_object('precio_cotizado', 699));
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(v_ok, 'B2.3: $699 (justo el piso) se acepta');

  -- 3) Justo en el techo -> aceptado; por encima del techo -> rechazado.
  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(null, v_vehiculo_sedan, v_traslado_base || jsonb_build_object('precio_cotizado', 100000));
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(v_ok, 'B2.4: $100,000 (justo el techo) se acepta');

  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(null, v_vehiculo_sedan, v_traslado_base || jsonb_build_object('precio_cotizado', 100001));
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B2.5: $100,001 (sobre el techo) se rechaza');

  -- 4) Tarifa activa en tarifas_admin sube el piso por encima de $699 para
  -- ese tipo de vehículo -> $2,000 ya no alcanza si la mínima es $5,000.
  insert into public.tarifas_admin (nombre, tipo_vehiculo, base, por_km, minima, pago_conductor_porcentaje, activa)
  values ('Luxury demo', 'luxury', 1000, 20, 5000, 70, true);

  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(null, v_vehiculo_luxury, v_traslado_base || jsonb_build_object('precio_cotizado', 2000));
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B2.6: $2,000 en luxury con tarifa mínima de $5,000 activa se rechaza (tarifas_admin sube el piso)');

  -- 5) La misma tarifa pero INACTIVA no debe subir el piso: un luxury con
  -- $2,000 vuelve a aceptarse porque cae en el piso base ($699), ya sin la
  -- tarifa desactivada de por medio.
  update public.tarifas_admin set activa = false where tipo_vehiculo = 'luxury';

  begin
    perform set_config('role', 'authenticated', true);
    perform public.usuario_crea_traslado(null, v_vehiculo_luxury, v_traslado_base || jsonb_build_object('precio_cotizado', 2000));
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(v_ok, 'B2.7: con la tarifa de luxury desactivada, $2,000 vuelve a aceptarse (piso base $699)');
end;
$$ language plpgsql;

select * from pg_temp.correr_b2();

select * from finish();

rollback;
