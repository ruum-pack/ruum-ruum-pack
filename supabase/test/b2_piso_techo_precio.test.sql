-- Test B2 — separación entre presupuesto del usuario y precio cobrable.
create extension if not exists pgtap with schema extensions;

begin;
select plan(11);

create or replace function pg_temp.correr_b2() returns setof text as $$
declare
  v_auth uuid := gen_random_uuid();
  v_respuesta jsonb;
  v_id uuid;
  v_clave uuid := gen_random_uuid();
  v_ok boolean;
  v_traslado jsonb := jsonb_build_object(
    'contacto_entrega_nombre', 'A', 'contacto_entrega_telefono', '+520000000000',
    'contacto_recepcion_nombre', 'B', 'contacto_recepcion_telefono', '+520000000001',
    'origen_lat', null, 'origen_lng', null, 'origen_direccion', 'origen', 'origen_ciudad', 'CDMX',
    'destino_lat', null, 'destino_lng', null, 'destino_direccion', 'destino', 'destino_ciudad', 'CDMX',
    'presupuesto_usuario', 1500, 'precio_cotizado', 99999, 'modalidad_programacion', 'lo_antes_posible'
  );
  v_vehiculo jsonb := jsonb_build_object(
    'tipo', 'sedan', 'transmision', 'automatica', 'marca', 'Nissan', 'modelo', 'Versa',
    'anio', 2022, 'color', 'gris', 'placas', 'TEST-B2', 'vin', 'VINB2',
    'estado_general_declarado', 'Buen estado', 'tiene_tarjeta_circulacion', true,
    'tiene_verificacion', true, 'tiene_placas', true, 'puede_circular_rodando', true
  );
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_auth, v_auth || '@b2.test', '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth, 'personal', 'personal', 'verificado');

  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.usuario_crea_traslado(null, v_vehiculo, v_traslado || jsonb_build_object('modalidad_programacion', 'programado', 'fecha_hora_programada', null), gen_random_uuid());
    v_ok := true; exception when others then v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B2.1: servidor rechaza programado sin fecha');

  perform set_config('role', 'authenticated', true);
  begin
    perform public.usuario_crea_traslado(null, v_vehiculo, v_traslado || jsonb_build_object('modalidad_programacion', 'programado', 'fecha_hora_programada', now() - interval '1 hour'), gen_random_uuid());
    v_ok := true; exception when others then v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B2.2: servidor rechaza fecha pasada');

  perform set_config('role', 'authenticated', true);
  begin
    perform public.usuario_crea_traslado(null, v_vehiculo, v_traslado || jsonb_build_object('modalidad_programacion', 'lo_antes_posible', 'fecha_hora_programada', now() + interval '3 hours'), gen_random_uuid());
    v_ok := true; exception when others then v_ok := false;
  end;
  perform set_config('role', 'postgres', true);
  return next ok(not v_ok, 'B2.3: servidor rechaza fecha en modalidad inmediata');

  perform set_config('role', 'authenticated', true);
  v_respuesta := public.usuario_crea_traslado(null, v_vehiculo, v_traslado, v_clave);
  perform set_config('role', 'postgres', true);
  v_id := (v_respuesta->>'id')::uuid;

  return next is((select presupuesto_usuario from public.traslados where id = v_id), null::numeric, 'B2.1: ignora presupuesto_usuario inyectado por el cliente');
  return next is((select precio_cotizado from public.traslados where id = v_id), null::numeric, 'B2.2: ignora precio_cotizado inyectado por el cliente');
  return next is((select precio_final from public.traslados where id = v_id), null::numeric, 'B2.3: el precio final nace en null');
  return next ok(
    not exists (
      select 1 from information_schema.role_column_grants
      where table_schema = 'public' and table_name = 'traslados'
        and grantee = 'authenticated' and privilege_type = 'INSERT'
    ),
    'B2.4: authenticated no puede insertar directamente para definir precios'
  );
  perform set_config('role', 'authenticated', true);
  v_respuesta := public.usuario_crea_traslado(null, v_vehiculo, v_traslado, v_clave);
  perform set_config('role', 'postgres', true);
  return next is((v_respuesta->>'id')::uuid, v_id, 'B2.5: reintentar con la misma clave devuelve el traslado existente');
  return next is((select count(*) from public.traslados where usuario_id = (select id from public.usuarios where auth_user_id = v_auth)), 1::bigint, 'B2.6: la misma clave no duplica el traslado');
  return next ok((select origen_lat is null and origen_lng is null from public.traslados where id = v_id), 'B2.7: origen desconocido se guarda como NULL');
  return next ok((select destino_lat is null and destino_lng is null from public.traslados where id = v_id), 'B2.8: destino desconocido se guarda como NULL');
end;
$$ language plpgsql;

select * from pg_temp.correr_b2();
select * from finish();
rollback;
