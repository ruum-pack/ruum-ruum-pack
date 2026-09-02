-- Test U1 — Traslados masivos para usuarios (migración 20260902000100_traslados_masivos_usuario.sql).
-- Valida:
--   1. Rechazo de usuarios no verificados.
--   2. Creación de lote masivo con RPC usuario_crea_traslados_masivos.
--   3. Aislamiento RLS (Usuario B no puede consultar la carga de Usuario A).
--   4. Procesamiento de filas con usuario_procesa_carga_traslados_masivos.
--   5. Alta de vehículos y traslados con tarifa automática e idempotencia.

create extension if not exists pgtap with schema extensions;

begin;

select plan(8);

create or replace function pg_temp.correr_u1() returns setof text as $$
declare
  v_auth_a uuid := gen_random_uuid();
  v_auth_b uuid := gen_random_uuid();
  v_usuario_a uuid;
  v_usuario_b uuid;
  v_carga_id uuid;
  v_respuesta jsonb;
  v_respuesta_proc jsonb;
  v_traslado_count int;
  v_precio numeric;
  v_hash text := 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  v_filas jsonb := jsonb_build_array(
    jsonb_build_object(
      'referencia_externa', 'LOTE-001',
      'vehiculo_marca', 'Nissan',
      'vehiculo_modelo', 'Versa',
      'vehiculo_anio', '2024',
      'vehiculo_tipo', 'sedan',
      'vehiculo_placas', 'MAS-001',
      'categoria_tarifa', 'ligero_a',
      'gama', 'entrada',
      'condicion', 'seminueva',
      'contacto_entrega_nombre', 'Juan Entrega',
      'contacto_entrega_telefono', '+525500000001',
      'contacto_recepcion_nombre', 'Pedro Recepcion',
      'contacto_recepcion_telefono', '+525500000002',
      'origen_direccion', 'Av. Insurgentes 100, Roma Norte, Cuauhtemoc, 06700, CDMX',
      'origen_ciudad', 'CDMX',
      'origen_lat', '19.4200',
      'origen_lng', '-99.1600',
      'destino_direccion', 'Av. Universidad 300, Copilco, Coyoacan, 04360, CDMX',
      'destino_ciudad', 'CDMX',
      'destino_lat', '19.3300',
      'destino_lng', '-99.1800',
      'distancia_km', '15.5',
      'tiempo_estimado_horas', '0.75',
      'modalidad_programacion', 'lo_antes_posible'
    )
  );
  v_ok boolean;
  v_msg text;
begin
  -- Usuarios de prueba
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (v_auth_a, v_auth_a || '@u1.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_auth_b, v_auth_b || '@u1.test', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_a, 'personal', 'personal', 'verificado') returning id into v_usuario_a;

  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_b, 'personal', 'personal', 'pendiente') returning id into v_usuario_b;

  -- Test 1: Rechaza usuario no verificado
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_auth_b::text, true);

  v_ok := false;
  begin
    perform public.usuario_crea_traslados_masivos('traslados.csv', v_filas, v_hash, 1024, 'text/csv');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'USUARIO_NO_VERIFICADO' then v_ok := true; end if;
  end;
  return next ok(v_ok, 'U1-T1: Rechaza carga masiva si usuario no está verificado');

  -- Test 2: Usuario A verificado crea lote masivo
  perform set_config('request.jwt.claim.sub', v_auth_a::text, true);

  v_respuesta := public.usuario_crea_traslados_masivos('traslados.csv', v_filas, v_hash, 1024, 'text/csv');
  v_carga_id := (v_respuesta->>'carga_id')::uuid;

  return next ok(v_carga_id is not null, 'U1-T2: Usuario verificado crea carga masiva exitosamente');
  return next is((v_respuesta->>'total_filas')::int, 1, 'U1-T3: Registra 1 fila en total');

  -- Test 3: RLS — Usuario B no puede ver la carga de Usuario A
  perform set_config('request.jwt.claim.sub', v_auth_b::text, true);
  return next is(
    (select count(*)::int from public.cargas_traslados_masivos where id = v_carga_id),
    0,
    'U1-T4: RLS impide que usuario B vea la carga de usuario A'
  );

  -- Test 4: Procesamiento de carga por Usuario A
  perform set_config('request.jwt.claim.sub', v_auth_a::text, true);
  v_respuesta_proc := public.usuario_procesa_carga_traslados_masivos(v_carga_id, 50);

  return next is((v_respuesta_proc->>'filas_creadas')::int, 1, 'U1-T5: Procesa 1 fila exitosamente');

  -- Test 5: Verifica que el traslado fue creado con vehículo y precio cotizado
  select count(*), max(precio_cotizado) into v_traslado_count, v_precio
  from public.traslados
  where usuario_id = v_usuario_a;

  return next is(v_traslado_count, 1, 'U1-T6: Traslado registrado en tabla traslados');
  return next ok(v_precio is not null and v_precio > 0, 'U1-T7: Tarifa automática calculada server-side');

  -- Test 6: Idempotencia — reintentar procesamiento no duplica el traslado
  perform public.usuario_procesa_carga_traslados_masivos(v_carga_id, 50);
  select count(*) into v_traslado_count from public.traslados where usuario_id = v_usuario_a;

  return next is(v_traslado_count, 1, 'U1-T8: Idempotencia previene duplicar traslados en reprocesamiento');

end;
$$ language plpgsql;

select * from pg_temp.correr_u1();

rollback;
