-- PR-03 P0/P1 — Hardening de autorizacion de conductores.
--
-- La tabla conductores tiene columnas que afectan operacion, reputacion,
-- certificacion, identidad y asignacion empresarial. La UI no es una frontera
-- de seguridad: el rol authenticated pierde UPDATE directo y la unica ruta
-- de self-service es solicitar_cambio_expediente_conductor(jsonb).

-- 1. Eliminar la via directa de mutacion para clientes.
drop policy if exists "conductor_actualiza_su_registro" on public.conductores;
revoke update on table public.conductores from anon, authenticated;

-- 2. Defensa en profundidad con allowlist de fila, no blacklist historica.
--
-- A (actualizacion normal): telefono, domicilio y contacto de emergencia.
-- B (requiere revision): nombre/identidad, CURP, licencia, vigencia, foto y
-- declaraciones legales.
-- C (nunca desde self-service): empresa_id, estado, niveles, certificacion,
-- reputacion, metricas, flags operativos, campos derivados, version, fechas
-- de auditoria y consentimiento.
create or replace function public.proteger_campos_conductor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_normal text[] := array[
    'telefono',
    'codigo_postal',
    'estado_residencia',
    'ciudad_municipio',
    'colonia',
    'calle',
    'numero',
    'referencias',
    'contacto_emergencia_nombre',
    'contacto_emergencia_telefono'
  ];
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_generada text;
begin
  -- Los administradores y procesos de backend tienen RPCs propias y no
  -- deben quedar bloqueados por la proteccion destinada al conductor.
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.auth_user_id then
    return new;
  end if;

  if current_setting('ruum.cambio_perfil_autorizado', true) <> 'si' then
    raise exception using
      errcode = '42501',
      message = 'Los cambios del perfil deben realizarse mediante la RPC autorizada.';
  end if;

  -- Todo campo fuera de A queda protegido. Se excluyen solamente A, el
  -- timestamp tecnico y columnas generadas por PostgreSQL. Estas ultimas no
  -- deben compararse en un BEFORE trigger: NEW puede exponerlas como NULL
  -- antes de que PostgreSQL las recalcule.
  for v_generada in
    select attname
      from pg_attribute
     where attrelid = 'public.conductores'::regclass
       and attnum > 0
       and not attisdropped
       and attgenerated <> ''
  loop
    v_old := v_old - v_generada;
    v_new := v_new - v_generada;
  end loop;

  if (v_new - v_normal - 'actualizado_en') is distinct from
     (v_old - v_normal - 'actualizado_en') then
    raise exception using
      errcode = '42501',
      message = 'No puedes modificar campos operativos, legales o administrativos de tu perfil de conductor.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_campos_conductor on public.conductores;
create trigger proteger_campos_conductor
  before update on public.conductores
  for each row execute function public.proteger_campos_conductor();

-- 3. RPC unica para cambios de perfil. Los campos B se convierten en una
-- solicitud pendiente; C se rechaza incluso si la UI los envia manualmente.
create or replace function public.solicitar_cambio_expediente_conductor(
  p_cambios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conductor_id uuid;
  v_conductor public.conductores;
  v_normal text[] := array[
    'telefono',
    'codigo_postal',
    'estado_residencia',
    'ciudad_municipio',
    'colonia',
    'calle',
    'numero',
    'referencias',
    'contacto_emergencia_nombre',
    'contacto_emergencia_telefono'
  ];
  v_revision text[] := array[
    'nombre',
    'curp',
    'licencia_numero',
    'licencia_tipo',
    'licencia_vigencia',
    'foto_perfil_url',
    'autoriza_verificacion_antecedentes',
    'declara_sin_suspensiones'
  ];
  v_bloqueados text[] := array[
    'id',
    'auth_user_id',
    'empresa_id',
    'estado',
    'estado_expediente',
    'certificacion_pago',
    'nivel_por_experiencia',
    'nivel_por_calificacion',
    'nivel_operativo_vigente',
    'calificacion_promedio',
    'traslados_completados',
    'suspensiones_activas',
    'no_presentaciones_6m',
    'cancelaciones_sin_justificacion_count',
    'incidencias_graves_6m',
    'incidencias_graves_12m',
    'documentos_vigentes',
    'creado_en',
    'actualizado_en',
    'version',
    'version_terminos_aceptada',
    'terminos_aceptados_en',
    'marca_terminos'
  ];
  v_tiene_revision boolean := false;
  v_payload_anterior jsonb := '{}'::jsonb;
  v_payload_propuesto jsonb := '{}'::jsonb;
  v_cambios_sanitizados jsonb := '{}'::jsonb;
  v_solicitud_id uuid;
  v_tipo public.tipo_solicitud_cambio_conductor := 'perfil';
  v_key text;
  v_val jsonb;
  v_actual text;
  v_propuesto text;
  v_fecha date;
  v_claves text[];
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Se requiere una sesion autenticada.';
  end if;

  select id
    into v_conductor_id
    from public.conductores
   where auth_user_id = auth.uid();

  if v_conductor_id is null then
    raise exception 'No se encontro el conductor autenticado.';
  end if;

  select *
    into v_conductor
    from public.conductores
   where id = v_conductor_id
   for update;

  if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' or p_cambios = '{}'::jsonb then
    raise exception 'No hay cambios para solicitar.';
  end if;

  if exists (
    select 1
      from public.solicitudes_cambio_conductor
     where conductor_id = v_conductor_id
       and estado = 'pendiente'
  ) then
    raise exception 'Ya tienes una solicitud de cambio pendiente de revision.';
  end if;

  v_claves := array(select jsonb_object_keys(p_cambios));

  foreach v_key in array v_claves loop
    if v_key = any(v_bloqueados) then
      if v_key = 'empresa_id' then
        raise exception using
          errcode = '42501',
          message = 'empresa_id solo puede ser asignada o modificada por administracion.';
      end if;
      raise exception using
        errcode = '42501',
        message = format('El campo %s no puede ser modificado por un conductor.', v_key);
    end if;

    if not (v_key = any(v_normal) or v_key = any(v_revision)) then
      raise exception using
        errcode = '22023',
        message = format('Campo no permitido para cambio de perfil: %s', v_key);
    end if;

    v_val := p_cambios -> v_key;

    if v_key in ('autoriza_verificacion_antecedentes', 'declara_sin_suspensiones') then
      if jsonb_typeof(v_val) not in ('boolean', 'null') then
        raise exception 'El campo %s debe ser booleano.', v_key;
      end if;
      if v_val = 'null'::jsonb then
        v_val := 'null'::jsonb;
      else
        v_val := to_jsonb((v_val #>> '{}')::boolean);
      end if;
    elsif v_key = 'licencia_vigencia' then
      if jsonb_typeof(v_val) not in ('string', 'null') then
        raise exception 'La vigencia de licencia debe tener formato YYYY-MM-DD.';
      end if;
      if v_val <> 'null'::jsonb and nullif(trim(v_val #>> '{}'), '') is not null then
        begin
          v_fecha := (trim(v_val #>> '{}'))::date;
        exception when others then
          raise exception 'Formato de vigencia de licencia invalido. Usa YYYY-MM-DD.';
        end;
        if v_fecha < current_date then
          raise exception 'La vigencia de la licencia no debe estar vencida.';
        end if;
      end if;
      v_val := to_jsonb(nullif(trim(v_val #>> '{}'), ''));
    else
      if jsonb_typeof(v_val) not in ('string', 'null') then
        raise exception 'El campo %s debe ser texto.', v_key;
      end if;
      v_val := to_jsonb(nullif(trim(v_val #>> '{}'), ''));
      if v_key = 'curp' and v_val <> 'null'::jsonb then
        v_val := to_jsonb(upper(v_val #>> '{}'));
      end if;
      if v_key in ('nombre', 'telefono', 'foto_perfil_url') and v_val = 'null'::jsonb then
        raise exception 'El campo %s no puede quedar vacio.', v_key;
      end if;
    end if;

    execute format('select ($1).%I::text', v_key)
       using v_conductor
       into v_actual;
    v_propuesto := case when v_val = 'null'::jsonb then null else v_val #>> '{}' end;

    if v_actual is distinct from v_propuesto then
      v_payload_anterior := jsonb_set(
        v_payload_anterior,
        array[v_key],
        coalesce(to_jsonb(v_actual), 'null'::jsonb),
        true
      );
      v_payload_propuesto := jsonb_set(v_payload_propuesto, array[v_key], v_val, true);
      v_cambios_sanitizados := jsonb_set(v_cambios_sanitizados, array[v_key], v_val, true);

      if v_key = any(v_revision) then
        v_tiene_revision := true;
      end if;

      if v_key = 'curp' then
        v_tipo := 'curp';
      elsif v_key in ('licencia_numero', 'licencia_tipo', 'licencia_vigencia') then
        v_tipo := 'licencia';
      elsif v_key = 'foto_perfil_url' then
        v_tipo := 'foto_perfil';
      elsif v_key in ('autoriza_verificacion_antecedentes', 'declara_sin_suspensiones') then
        v_tipo := 'legal';
      elsif v_key = 'nombre' then
        v_tipo := 'identidad';
      end if;
    end if;
  end loop;

  if v_payload_propuesto = '{}'::jsonb then
    raise exception 'No hay cambios reales respecto al perfil actual.';
  end if;

  if not v_tiene_revision then
    perform set_config('ruum.cambio_perfil_autorizado', 'si', true);

    update public.conductores
       set telefono = case when v_cambios_sanitizados ? 'telefono' then nullif(trim(v_cambios_sanitizados->>'telefono'), '') else telefono end,
           codigo_postal = case when v_cambios_sanitizados ? 'codigo_postal' then nullif(trim(v_cambios_sanitizados->>'codigo_postal'), '') else codigo_postal end,
           estado_residencia = case when v_cambios_sanitizados ? 'estado_residencia' then nullif(trim(v_cambios_sanitizados->>'estado_residencia'), '') else estado_residencia end,
           ciudad_municipio = case when v_cambios_sanitizados ? 'ciudad_municipio' then nullif(trim(v_cambios_sanitizados->>'ciudad_municipio'), '') else ciudad_municipio end,
           colonia = case when v_cambios_sanitizados ? 'colonia' then nullif(trim(v_cambios_sanitizados->>'colonia'), '') else colonia end,
           calle = case when v_cambios_sanitizados ? 'calle' then nullif(trim(v_cambios_sanitizados->>'calle'), '') else calle end,
           numero = case when v_cambios_sanitizados ? 'numero' then nullif(trim(v_cambios_sanitizados->>'numero'), '') else numero end,
           referencias = case when v_cambios_sanitizados ? 'referencias' then nullif(trim(v_cambios_sanitizados->>'referencias'), '') else referencias end,
           contacto_emergencia_nombre = case when v_cambios_sanitizados ? 'contacto_emergencia_nombre' then nullif(trim(v_cambios_sanitizados->>'contacto_emergencia_nombre'), '') else contacto_emergencia_nombre end,
           contacto_emergencia_telefono = case when v_cambios_sanitizados ? 'contacto_emergencia_telefono' then nullif(trim(v_cambios_sanitizados->>'contacto_emergencia_telefono'), '') else contacto_emergencia_telefono end
     where id = v_conductor_id;

    perform set_config('ruum.cambio_perfil_autorizado', '', true);

    insert into public.registro_auditoria(evento, actor, actor_id, datos)
    values (
      'actualizacion_perfil_conductor',
      'conductor',
      v_conductor_id,
      jsonb_build_object(
        'conductor_id', v_conductor_id,
        'tipo', 'normal',
        'campos', to_jsonb(array(select jsonb_object_keys(v_payload_propuesto)))
      )
    );

    return jsonb_build_object(
      'solicitud_id', null,
      'estado', 'actualizado',
      'tipo', 'actualizacion_directa',
      'mensaje', 'Cambios guardados'
    );
  end if;

  insert into public.solicitudes_cambio_conductor(
    conductor_id,
    tipo,
    payload_anterior,
    payload_propuesto,
    estado
  )
  values (
    v_conductor_id,
    v_tipo,
    v_payload_anterior,
    v_payload_propuesto,
    'pendiente'
  )
  returning id into v_solicitud_id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values (
    'solicitud_cambio_conductor_creada',
    'conductor',
    v_conductor_id,
    jsonb_build_object(
      'solicitud_id', v_solicitud_id,
      'conductor_id', v_conductor_id,
      'tipo', v_tipo,
      'campos', to_jsonb(array(select jsonb_object_keys(v_payload_propuesto)))
    )
  );

  return jsonb_build_object(
    'solicitud_id', v_solicitud_id,
    'estado', 'pendiente',
    'tipo', v_tipo,
    'mensaje', 'Cambios enviados a revision'
  );
end;
$$;

revoke all on function public.solicitar_cambio_expediente_conductor(jsonb) from public, anon;
grant execute on function public.solicitar_cambio_expediente_conductor(jsonb) to authenticated;

comment on function public.solicitar_cambio_expediente_conductor(jsonb) is
  'PR-03: allowlist de perfil. Actualiza solo A; envia B a revision; rechaza C, incluyendo empresa_id, sin depender de la UI.';

comment on column public.conductores.empresa_id is
  'PR-03 C: relacion empresarial con efectos operativos/financieros; solo administracion puede modificarla.';
