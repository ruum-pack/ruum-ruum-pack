-- Regression test for the user payment flow:
-- creating a transfer must preserve the automatic quote so that Stripe can
-- create a PaymentIntent after the quote is accepted.

create extension if not exists pgtap with schema extensions;

begin;

select plan(9);

create or replace function pg_temp.correr_rt49() returns setof text as $$
declare
  v_auth_id uuid := gen_random_uuid();
  v_clave_id uuid := gen_random_uuid();
  v_traslado_id uuid;
  v_respuesta jsonb;
  v_respuesta_idempotente jsonb;
  v_estado public.estado_traslado;
  v_precio numeric;
  v_traslado jsonb := jsonb_build_object(
    'contacto_entrega_nombre', 'A', 'contacto_entrega_telefono', '+520000000000',
    'contacto_recepcion_nombre', 'B', 'contacto_recepcion_telefono', '+520000000001',
    'origen_lat', 19.0, 'origen_lng', -99.0, 'origen_direccion', 'origen', 'origen_ciudad', 'CDMX',
    'destino_lat', 19.5, 'destino_lng', -99.5, 'destino_direccion', 'destino', 'destino_ciudad', 'CDMX',
    'presupuesto_usuario', 1000, 'tipo_pago', 'anticipado',
    'modalidad_programacion', 'lo_antes_posible',
    'distancia_km', 18.42, 'tiempo_estimado_horas', 0.73
  );
  v_vehiculo jsonb := jsonb_build_object(
    'tipo', 'sedan', 'transmision', 'electrica', 'marca', 'Nissan', 'modelo', 'Versa',
    'condicion', 'nueva',
    'anio', 2022, 'color', 'gris', 'placas', 'RT49-001', 'vin', 'RT49-VIN-001',
    'estado_general_declarado', 'Buen estado', 'tiene_tarjeta_circulacion', true,
    'tiene_verificacion', true, 'tiene_placas', true, 'puede_circular_rodando', true
  );
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_auth_id, v_auth_id || '@rt49.test', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_id, 'personal', 'personal', 'verificado');

  perform set_config('request.jwt.claim.sub', v_auth_id::text, true);
  perform set_config('role', 'authenticated', true);

  v_respuesta := public.usuario_crea_traslado(null, v_vehiculo, v_traslado, v_clave_id, '[]'::jsonb);
  v_traslado_id := (v_respuesta->>'id')::uuid;
  v_precio := (v_respuesta->>'precio_cotizado')::numeric;

  perform set_config('role', 'postgres', true);
  return next ok(v_precio > 0, 'la RPC devuelve una cotización automática');
  return next is(
    (select precio_cotizado from public.traslados where id = v_traslado_id),
    v_precio,
    'la cotización persistida coincide con la respuesta del RPC'
  );
  return next is(
    (select estado::text from public.traslados where id = v_traslado_id),
    'cotizacion_generada',
    'el traslado inicia en cotizacion_generada'
  );
  return next ok(
    (select cotizacion_expira_en > now() from public.traslados where id = v_traslado_id),
    'la cotización tiene una fecha de expiración futura'
  );
  return next ok(
    (select v.categoria_tarifa is not null and v.gama is not null and v.condicion = 'nueva'
     from public.vehiculos v
     join public.traslados t on t.vehiculo_id = v.id
     where t.id = v_traslado_id),
    'el vehículo queda clasificado para calcular la tarifa'
  );
  return next is(
    (select tipo_pago::text from public.traslados where id = v_traslado_id),
    'anticipado',
    'el traslado conserva el tipo de pago anticipado'
  );

  perform set_config('role', 'authenticated', true);
  v_estado := public.usuario_acepta_cotizacion(v_traslado_id);
  perform set_config('role', 'postgres', true);
  return next is(v_estado::text, 'cotizacion_aceptada', 'aceptar la cotización habilita el flujo de pago');
  return next is(
    (select estado::text from public.traslados where id = v_traslado_id),
    'cotizacion_aceptada',
    'el estado persistido queda listo para crear el PaymentIntent'
  );

  perform set_config('role', 'authenticated', true);
  v_respuesta_idempotente := public.usuario_crea_traslado(null, v_vehiculo, v_traslado, v_clave_id, '[]'::jsonb);
  perform set_config('role', 'postgres', true);
  return next is(
    v_respuesta_idempotente->>'id',
    v_traslado_id::text,
    'la clave de idempotencia devuelve el mismo traslado'
  );
end;
$$ language plpgsql;

select * from pg_temp.correr_rt49();

select * from finish();

rollback;
