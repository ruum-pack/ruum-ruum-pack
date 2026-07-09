-- Test de integración A1 — coherencia entre `usuario_cancela_traslado` (RPC)
-- y el trigger `validar_transicion_traslado` sobre `estado_transiciones_validas`.
--
-- Objetivo: garantizar que para CADA estado no-terminal, la RPC de cancelación
-- y la máquina de estados coinciden — o ambas permiten la cancelación, o ambas
-- la rechazan con un mensaje de negocio (no con el error crudo del trigger).
-- Este era exactamente el hueco de A1: la RPC permitía cancelar en estados que
-- el trigger rechazaba, haciendo rollback del cargo ya calculado.
--
-- Cómo correr (sin dependencias extra de Node):
--   supabase db reset          # aplica migraciones + seed en la BD local
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/a1_cancelacion_estados.test.sql
--
-- El script corre dentro de una transacción que hace ROLLBACK al final, así
-- que no deja datos: es seguro re-ejecutarlo. Falla (exit != 0) en el primer
-- assert que no se cumpla.

begin;

-- Estados desde los que el NEGOCIO permite cancelar (debe coincidir con
-- ESTADOS_CANCELABLES_POR_USUARIO en packages/api/src/services/traslados.ts).
create temp table esperado_cancelable (estado public.estado_traslado, cancelable boolean) on commit drop;
insert into esperado_cancelable values
  ('solicitud_creada', true),
  ('documentacion_pendiente', true),
  ('documentacion_en_revision', true),
  ('cotizacion_generada', true),
  ('servicio_confirmado', true),
  ('pendiente_de_conductor', true),
  ('conductor_asignado', true),
  ('conductor_en_punto_de_recoleccion', true),
  -- No cancelables (post-recolección / operativos): la RPC debe rechazarlos
  -- con mensaje de negocio, NO con «Transición de estado inválida».
  ('documentacion_validada', false),
  ('conductor_en_camino_al_origen', false),
  ('verificacion_vehiculo_en_proceso', false),
  ('evidencia_inicial_en_proceso', false),
  ('evidencia_inicial_completada', false),
  ('vehiculo_recibido', false),
  ('traslado_en_curso', false),
  ('llegada_a_destino', false);

do $$
declare
  v_auth_user uuid := gen_random_uuid();
  v_usuario_id uuid;
  v_vehiculo_id uuid;
  v_traslado_id uuid;
  r record;
  v_cancelo boolean;
  v_msg text;
  v_fallos int := 0;
begin
  -- Sembrar un usuario + vehículo mínimos.
  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_user, 'personal', 'personal', 'verificado')
  returning id into v_usuario_id;

  insert into public.vehiculos (usuario_id, tipo, marca, modelo, anio, placas)
  values (v_usuario_id, 'basico', 'Test', 'Modelo', 2020, 'TEST-001')
  returning id into v_vehiculo_id;

  -- Simular la sesión del usuario dueño (auth.uid()) para la RPC security definer.
  perform set_config('request.jwt.claim.sub', v_auth_user::text, true);
  perform set_config('role', 'authenticated', true);

  for r in select estado, cancelable from esperado_cancelable loop
    -- Crear un traslado y forzarlo al estado bajo prueba, saltándose el trigger
    -- de transiciones (deshabilitado solo para el setup del fixture).
    insert into public.traslados (
      estado, usuario_id, vehiculo_id,
      contacto_entrega_nombre, contacto_entrega_telefono,
      contacto_recepcion_nombre, contacto_recepcion_telefono,
      origen_lat, origen_lng, origen_direccion, origen_ciudad,
      destino_lat, destino_lng, destino_direccion, destino_ciudad,
      precio_cotizado, tipo_pago
    ) values (
      'solicitud_creada', v_usuario_id, v_vehiculo_id,
      'A', '+520000000000', 'B', '+520000000001',
      19.0, -99.0, 'origen', 'CDMX',
      19.5, -99.5, 'destino', 'CDMX',
      1000, 'anticipado'
    ) returning id into v_traslado_id;

    alter table public.traslados disable trigger traslados_validar_transicion;
    update public.traslados set estado = r.estado where id = v_traslado_id;
    alter table public.traslados enable trigger traslados_validar_transicion;

    -- Intentar cancelar vía la RPC real y capturar el resultado.
    begin
      perform public.usuario_cancela_traslado(
        v_traslado_id, 'test', 0, 0, 'msg'
      );
      v_cancelo := true;
      v_msg := null;
    exception when others then
      v_cancelo := false;
      v_msg := sqlerrm;
    end;

    -- Assert 1: el resultado (permite/rechaza) coincide con lo esperado.
    if v_cancelo <> r.cancelable then
      raise warning 'FALLO [%]: esperado cancelable=%, obtenido=% (msg=%)',
        r.estado, r.cancelable, v_cancelo, coalesce(v_msg, 'ok');
      v_fallos := v_fallos + 1;
    end if;

    -- Assert 2: si se rechaza, NO debe ser el error crudo del trigger.
    -- Ese mensaje («Transición de estado inválida») es justo el síntoma de A1.
    if not v_cancelo and v_msg ilike '%Transición de estado inválida%' then
      raise warning 'FALLO [%]: rechazo con error crudo del trigger en vez de mensaje de negocio', r.estado;
      v_fallos := v_fallos + 1;
    end if;

    -- Assert 3: si se permitió, el traslado quedó realmente cancelado (no rollback silencioso).
    if v_cancelo then
      if (select estado from public.traslados where id = v_traslado_id) <> 'servicio_cancelado' then
        raise warning 'FALLO [%]: la RPC no lanzó error pero el estado no quedó en servicio_cancelado', r.estado;
        v_fallos := v_fallos + 1;
      end if;
    end if;
  end loop;

  if v_fallos > 0 then
    raise exception 'A1: % assert(s) fallaron — la RPC y el trigger NO son coherentes.', v_fallos;
  end if;

  raise notice 'A1 OK: RPC de cancelación coherente con la máquina de estados en los % estados probados.',
    (select count(*) from esperado_cancelable);
end $$;

rollback;
