-- Test de integración A1 — coherencia entre `usuario_cancela_traslado` (RPC)
-- y el trigger `validar_transicion_traslado` sobre `estado_transiciones_validas`.
--
-- Objetivo: garantizar que para CADA estado no-terminal, la RPC de cancelación
-- y la máquina de estados coinciden — o ambas permiten la cancelación, o ambas
-- la rechazan con un mensaje de negocio (no con el error crudo del trigger).
-- Este era exactamente el hueco de A1: la RPC permitía cancelar en estados que
-- el trigger rechazaba, haciendo rollback del cargo ya calculado.
--
-- Cómo correr:
--   supabase db reset
--   supabase test db supabase/test/a1_cancelacion_estados.test.sql
--
-- pgTAP: corre dentro de una transacción con ROLLBACK final, así que no deja
-- datos y es seguro re-ejecutarlo.

create extension if not exists pgtap with schema extensions;

begin;

select plan(48);

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

-- El recorrido por los 16 estados, con captura de excepción por intento,
-- sólo es expresable en PL/pgSQL. Cada iteración emite 3 líneas TAP vía
-- RETURN NEXT; RAISE EXCEPTION aquí sólo protegería contra un fallo de
-- preparación (no aplica: no hay pasos de setup que puedan fallar de forma
-- inesperada dentro del loop).
create or replace function pg_temp.correr_a1() returns setof text as $$
declare
  v_auth_user uuid := gen_random_uuid();
  v_usuario_id uuid;
  v_vehiculo_id uuid;
  v_traslado_id uuid;
  r record;
  v_cancelo boolean;
  v_msg text;
begin
  insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_auth_user, v_auth_user || '@a1.test', '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion)
  values (v_auth_user, 'personal', 'personal', 'verificado')
  returning id into v_usuario_id;

  insert into public.vehiculos (usuario_id, tipo, marca, modelo, anio, placas)
  values (v_usuario_id, 'sedan', 'Test', 'Modelo', 2020, 'TEST-001')
  returning id into v_vehiculo_id;

  perform set_config('request.jwt.claim.sub', v_auth_user::text, true);

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

    -- Intentar cancelar vía la RPC real, simulando la sesión del usuario
    -- dueño (auth.uid()) solo para esta llamada, y capturar el resultado.
    begin
      perform set_config('role', 'authenticated', true);
      perform public.usuario_cancela_traslado(
        v_traslado_id, 'test', 0, 0, 'msg'
      );
      v_cancelo := true;
      v_msg := null;
    exception when others then
      v_cancelo := false;
      v_msg := sqlerrm;
    end;
    perform set_config('role', 'postgres', true);

    return next is(
      v_cancelo, r.cancelable,
      format('A1 [%s]: cancelable esperado=%s', r.estado, r.cancelable)
    );

    return next ok(
      v_cancelo or v_msg not ilike '%Transición de estado inválida%',
      format('A1 [%s]: si se rechaza, no expone el error crudo del trigger', r.estado)
    );

    return next ok(
      not v_cancelo or (select estado from public.traslados where id = v_traslado_id) = 'servicio_cancelado',
      format('A1 [%s]: si se permite, el traslado queda en servicio_cancelado', r.estado)
    );
  end loop;
end;
$$ language plpgsql;

select * from pg_temp.correr_a1();

select * from finish();

rollback;
