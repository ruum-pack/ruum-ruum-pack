-- PR-04 P1 — Revisión real del perfil del conductor
-- Convierte "Guardar y enviar a revisión" de promesa falsa a flujo operativo real.
-- No sobrescribir inmediatamente los datos aprobados para campos sensibles.

-- 1. Enums y auditoría
alter type public.evento_auditable add value if not exists 'solicitud_cambio_conductor_creada';
alter type public.evento_auditable add value if not exists 'solicitud_cambio_conductor_aprobada';
alter type public.evento_auditable add value if not exists 'solicitud_cambio_conductor_rechazada';
alter type public.evento_auditable add value if not exists 'solicitud_cambio_conductor_cancelada';
alter type public.evento_auditable add value if not exists 'actualizacion_perfil_conductor';

do $$ begin
  if not exists (select 1 from pg_type where typname = 'estado_solicitud_cambio_conductor') then
    create type public.estado_solicitud_cambio_conductor as enum ('pendiente','aprobado','rechazado','cancelado');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'tipo_solicitud_cambio_conductor') then
    create type public.tipo_solicitud_cambio_conductor as enum (
      'perfil',
      'curp',
      'licencia',
      'licencia_vigencia',
      'domicilio',
      'contacto_emergencia',
      'identidad',
      'documento',
      'datos_bancarios',
      'empresa',
      'legal',
      'foto_perfil'
    );
  end if;
end $$;

-- 2. Tabla solicitudes_cambio_conductor
create table if not exists public.solicitudes_cambio_conductor (
  id uuid primary key default gen_random_uuid(),
  conductor_id uuid not null references public.conductores(id) on delete cascade,
  tipo public.tipo_solicitud_cambio_conductor not null,
  payload_anterior jsonb not null,
  payload_propuesto jsonb not null,
  estado public.estado_solicitud_cambio_conductor not null default 'pendiente',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  revisado_en timestamptz,
  revisado_por uuid references public.admins(id) on delete set null,
  motivo_rechazo text,
  constraint solicitud_cambio_motivo_rechazo_coherente check (
    estado <> 'rechazado' or length(trim(coalesce(motivo_rechazo,''))) >= 5
  ),
  constraint solicitud_cambio_payloads_no_vacios check (
    payload_propuesto is not null and payload_propuesto <> '{}'::jsonb
  )
);

create index if not exists solicitudes_cambio_conductor_conductor_idx on public.solicitudes_cambio_conductor(conductor_id);
create index if not exists solicitudes_cambio_conductor_estado_idx on public.solicitudes_cambio_conductor(estado);
create index if not exists solicitudes_cambio_conductor_creado_idx on public.solicitudes_cambio_conductor(creado_en desc);
create index if not exists solicitudes_cambio_conductor_pendiente_idx on public.solicitudes_cambio_conductor(conductor_id, estado) where estado = 'pendiente';

create trigger solicitudes_cambio_conductor_actualizado_en
  before update on public.solicitudes_cambio_conductor
  for each row execute function public.set_actualizado_en();

alter table public.solicitudes_cambio_conductor enable row level security;

-- RLS: conductor ve y crea sus propias solicitudes; admin ve todo
drop policy if exists "conductor_ve_sus_solicitudes_cambio" on public.solicitudes_cambio_conductor;
create policy "conductor_ve_sus_solicitudes_cambio"
  on public.solicitudes_cambio_conductor for select
  using (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

drop policy if exists "conductor_crea_solicitud_cambio" on public.solicitudes_cambio_conductor;
create policy "conductor_crea_solicitud_cambio"
  on public.solicitudes_cambio_conductor for insert
  with check (conductor_id in (select id from public.conductores where auth_user_id = auth.uid()));

-- updates/deletes solo via RPC security definer, no policy directa para update/delete por conductor
drop policy if exists "admin_acceso_total_solicitudes_cambio" on public.solicitudes_cambio_conductor;
create policy "admin_acceso_total_solicitudes_cambio"
  on public.solicitudes_cambio_conductor for all
  using (public.es_admin())
  with check (public.es_admin());

grant select, insert on public.solicitudes_cambio_conductor to authenticated;
grant all on public.solicitudes_cambio_conductor to service_role;

comment on table public.solicitudes_cambio_conductor is
  'PR-04: Cambios pendientes de perfil del conductor que requieren revisión operativa. No sobrescribe conductores hasta aprobación.';

-- 3. Actualizar trigger proteger_campos_conductor para bloquear sensibles sin autorización RPC
create or replace function public.proteger_campos_conductor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_autorizado text := nullif(current_setting('ruum.cambio_perfil_autorizado', true), '');
begin
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.auth_user_id then
    return new;
  end if;

  -- Si el cambio viene via RPC autorizado (solicitar/aprobar), permitir sensibles
  if v_autorizado = 'si' then
    return new;
  end if;

  -- Campos operativos/reputacionales siempre bloqueados (H-1)
  if new.auth_user_id                          is distinct from old.auth_user_id
    or new.estado                              is distinct from old.estado
    or new.estado_expediente                   is distinct from old.estado_expediente
    or new.documentos_vigentes                 is distinct from old.documentos_vigentes
    or new.nivel_por_experiencia               is distinct from old.nivel_por_experiencia
    or new.nivel_por_calificacion              is distinct from old.nivel_por_calificacion
    or new.calificacion_promedio               is distinct from old.calificacion_promedio
    or new.traslados_completados               is distinct from old.traslados_completados
    or new.suspensiones_activas                is distinct from old.suspensiones_activas
    or new.no_presentaciones_6m                is distinct from old.no_presentaciones_6m
    or new.cancelaciones_sin_justificacion_count is distinct from old.cancelaciones_sin_justificacion_count
    or new.incidencias_graves_6m               is distinct from old.incidencias_graves_6m
    or new.incidencias_graves_12m              is distinct from old.incidencias_graves_12m
    or new.creado_en                           is distinct from old.creado_en then
    raise exception 'No puedes modificar campos operativos o de reputación de tu perfil de conductor.';
  end if;

  -- PR-04: Bloqueo de campos sensibles — requieren flujo de solicitud de cambio
  -- Si el conductor intenta modificar directamente CURP, licencia, vigencia, contacto emergencia, foto, empresa o declaraciones,
  -- se rechaza y debe usar solicitar_cambio_expediente_conductor().
  if new.curp                              is distinct from old.curp
    or new.licencia_numero                  is distinct from old.licencia_numero
    or new.licencia_tipo                    is distinct from old.licencia_tipo
    or new.licencia_vigencia                is distinct from old.licencia_vigencia
    or new.foto_perfil_url                  is distinct from old.foto_perfil_url
    or new.contacto_emergencia_nombre       is distinct from old.contacto_emergencia_nombre
    or new.contacto_emergencia_telefono     is distinct from old.contacto_emergencia_telefono
    or new.empresa_id                       is distinct from old.empresa_id
    or new.autoriza_verificacion_antecedentes is distinct from old.autoriza_verificacion_antecedentes
    or new.declara_sin_suspensiones         is distinct from old.declara_sin_suspensiones
    or new.codigo_postal                    is distinct from old.codigo_postal
    or new.estado_residencia                is distinct from old.estado_residencia
    or new.ciudad_municipio                 is distinct from old.ciudad_municipio
    or new.colonia                          is distinct from old.colonia
    or new.calle                            is distinct from old.calle
    or new.numero                           is distinct from old.numero
    or new.referencias                      is distinct from old.referencias
  then
    -- Permitir solo si el RPC ha puesto la marca; si no, forzar flujo de solicitud
    -- Mensaje accionable para UI
    raise exception 'Este campo requiere revisión operativa. Usa solicitar_cambio_expediente_conductor para proponer el cambio.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_campos_conductor on public.conductores;
create trigger proteger_campos_conductor
  before update on public.conductores
  for each row execute function public.proteger_campos_conductor();

-- Permitir que el trigger de foto perfil también use la excepción via misma marca
-- (subirFotoPerfilConductor ahora debe ir via RPC, pero mantenemos compat si usa marca)

-- 4. RPC principal: solicitar_cambio_expediente_conductor
create or replace function public.solicitar_cambio_expediente_conductor(
  p_cambios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_conductor public.conductores;
  v_sensibles text[] := array['curp','licencia_numero','licencia_tipo','licencia_vigencia','foto_perfil_url','contacto_emergencia_nombre','contacto_emergencia_telefono','empresa_id','autoriza_verificacion_antecedentes','declara_sin_suspensiones','codigo_postal','estado_residencia','ciudad_municipio','colonia','calle','numero','referencias'];
  v_tiene_sensible boolean := false;
  v_payload_anterior jsonb := '{}'::jsonb;
  v_payload_propuesto jsonb := '{}'::jsonb;
  v_tipo public.tipo_solicitud_cambio_conductor := 'perfil';
  v_cambios_sanitizados jsonb := '{}'::jsonb;
  v_solicitud_id uuid;
  v_key text;
  v_val jsonb;
  v_actual text;
  v_claves text[];
begin
  select id into v_conductor_id from public.conductores where auth_user_id = auth.uid();
  if v_conductor_id is null then
    raise exception 'No se encontró el conductor autenticado.';
  end if;

  select * into v_conductor from public.conductores where id = v_conductor_id for update;
  if v_conductor.id is null then
    raise exception 'Conductor no encontrado.';
  end if;

  if p_cambios is null or p_cambios = '{}'::jsonb then
    raise exception 'No hay cambios para solicitar.';
  end if;

  -- No permitir más de una solicitud pendiente del mismo conductor para evitar spam
  if exists (select 1 from public.solicitudes_cambio_conductor where conductor_id = v_conductor_id and estado = 'pendiente') then
    raise exception 'Ya tienes una solicitud de cambio pendiente de revisión. Espera la resolución antes de enviar otra.';
  end if;

  -- Construir payloads y detectar sensibles
  v_claves := array(select jsonb_object_keys(p_cambios));
  foreach v_key in array v_claves loop
    v_val := p_cambios -> v_key;
    -- Sanitizar: trim y normalización básica
    if v_key in ('curp') then
      v_val := to_jsonb(upper(trim(v_val #>> '{}')));
      if v_val #>> '{}' = '' then v_val := 'null'::jsonb; end if;
    elsif v_key in ('licencia_numero','licencia_tipo') then
      v_val := to_jsonb(trim(v_val #>> '{}'));
      if v_val #>> '{}' = '' then v_val := 'null'::jsonb; end if;
    elsif v_key in ('nombre','telefono','contacto_emergencia_nombre','contacto_emergencia_telefono','codigo_postal','estado_residencia','ciudad_municipio','colonia','calle','numero','referencias','foto_perfil_url','empresa_id') then
      v_val := to_jsonb(trim(v_val #>> '{}'));
      if v_val #>> '{}' = '' and v_key not in ('nombre','telefono') then v_val := 'null'::jsonb; end if;
    elsif v_key = 'licencia_vigencia' then
      -- Validar fecha no vencida si se propone
      if v_val is not null and v_val #>> '{}' <> '' then
        begin
          if (v_val #>> '{}')::date < current_date then
            raise exception 'La vigencia de la licencia no debe estar vencida.';
          end if;
        exception when others then
          raise exception 'Formato de vigencia de licencia inválido. Usa YYYY-MM-DD.';
        end;
      end if;
      v_val := to_jsonb(trim(v_val #>> '{}'));
      if v_val #>> '{}' = '' then v_val := 'null'::jsonb; end if;
    elsif v_key in ('autoriza_verificacion_antecedentes','declara_sin_suspensiones') then
      -- boolean
      v_val := to_jsonb((v_val #>> '{}')::boolean);
    else
      raise exception 'Campo no permitido para cambio: %', v_key;
    end if;

    -- Obtener valor actual
    execute format('select ($1).%I', v_key) using v_conductor into v_actual;
    -- Para comparar, normalizar actual a text
    -- Construir payload_anterior y propuesto solo si hay diferencia real
    if (v_actual is distinct from (case when v_val = 'null'::jsonb then null else v_val #>> '{}' end))
       or (v_actual is null and v_val <> 'null'::jsonb)
       or (v_actual is not null and v_val = 'null'::jsonb) then
      v_payload_anterior := jsonb_set(v_payload_anterior, array[v_key], to_jsonb(v_actual));
      v_payload_propuesto := jsonb_set(v_payload_propuesto, array[v_key], v_val);
      v_cambios_sanitizados := jsonb_set(v_cambios_sanitizados, array[v_key], v_val);
      if v_key = any(v_sensibles) then
        v_tiene_sensible := true;
      end if;
      -- Determinar tipo más específico
      if v_key = 'curp' then v_tipo := 'curp';
      elsif v_key in ('licencia_numero','licencia_tipo','licencia_vigencia') then v_tipo := 'licencia';
      elsif v_key in ('codigo_postal','estado_residencia','ciudad_municipio','colonia','calle','numero','referencias') then v_tipo := 'domicilio';
      elsif v_key in ('contacto_emergencia_nombre','contacto_emergencia_telefono') then v_tipo := 'contacto_emergencia';
      elsif v_key = 'foto_perfil_url' then v_tipo := 'foto_perfil';
      elsif v_key = 'empresa_id' then v_tipo := 'empresa';
      elsif v_key in ('autoriza_verificacion_antecedentes','declara_sin_suspensiones') then v_tipo := 'legal';
      end if;
    end if;
  end loop;

  if v_payload_propuesto = '{}'::jsonb then
    raise exception 'No hay cambios reales respecto al perfil actual.';
  end if;

  -- Si no hay campo sensible, hacer actualización directa atómica + auditoría
  if not v_tiene_sensible then
    perform set_config('ruum.cambio_perfil_autorizado','si',true);
    -- Construir update dinámico solo con campos no sensibles propuestos
    -- Usamos jsonb_populate_record para mapear, pero filtramos sensibles ya garantizado
    update public.conductores set
      nombre = coalesce((v_cambios_sanitizados->>'nombre'), nombre),
      telefono = coalesce((v_cambios_sanitizados->>'telefono'), telefono),
      -- codigo_postal etc ya está en sensibles para PR-04, pero si se considerara no sensible se actualizaría aquí
      actualizado_en = now()
    where id = v_conductor_id;
    perform set_config('ruum.cambio_perfil_autorizado','',true);

    insert into public.registro_auditoria(evento, actor, actor_id, datos)
    values (
      'actualizacion_perfil_conductor',
      'conductor',
      v_conductor_id,
      jsonb_build_object(
        'conductor_id', v_conductor_id,
        'tipo', 'actualizacion_directa',
        'cambios', v_payload_propuesto,
        'anterior', v_payload_anterior
      )
    );

    return jsonb_build_object(
      'solicitud_id', null,
      'estado', 'actualizado',
      'tipo', 'actualizacion_directa',
      'mensaje', 'Cambios guardados'
    );
  end if;

  -- Con sensible: crear solicitud pendiente, no tocar conductores
  insert into public.solicitudes_cambio_conductor(conductor_id, tipo, payload_anterior, payload_propuesto, estado)
  values (v_conductor_id, v_tipo, v_payload_anterior, v_payload_propuesto, 'pendiente')
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
      'payload_anterior', v_payload_anterior,
      'payload_propuesto', v_payload_propuesto
    )
  );

  return jsonb_build_object(
    'solicitud_id', v_solicitud_id,
    'estado', 'pendiente',
    'tipo', v_tipo,
    'mensaje', 'Cambios enviados a revisión'
  );
end;
$$;

revoke all on function public.solicitar_cambio_expediente_conductor(jsonb) from public, anon;
grant execute on function public.solicitar_cambio_expediente_conductor(jsonb) to authenticated;

comment on function public.solicitar_cambio_expediente_conductor(jsonb) is
  'PR-04: Solicita cambio de perfil. Si solo hay campos no sensibles, actualiza directo; si hay sensibles (curp, licencia, vigencia, contacto emergencia, foto, empresa, legal, domicilio), crea solicitud pendiente sin sobrescribir.';

-- 5. RPC aprobar
create or replace function public.aprobar_solicitud_cambio_conductor(
  p_solicitud_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_cambio_conductor;
  v_conductor_id uuid;
  v_admin_id uuid;
  v_payload jsonb;
  v_key text;
  v_val jsonb;
  v_admin_auth uuid := auth.uid();
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select id into v_admin_id from public.admins where auth_user_id = v_admin_auth;
  if v_admin_id is null then raise exception 'No se encontró el administrador autenticado.'; end if;

  select * into v_solicitud from public.solicitudes_cambio_conductor where id = p_solicitud_id for update;
  if v_solicitud.id is null then raise exception 'Solicitud no encontrada.'; end if;
  if v_solicitud.estado <> 'pendiente' then raise exception 'La solicitud no está pendiente.'; end if;

  v_conductor_id := v_solicitud.conductor_id;
  v_payload := v_solicitud.payload_propuesto;

  perform set_config('ruum.cambio_perfil_autorizado','si',true);
  -- Aplicar cada campo del payload propuesto a conductores
  -- Usamos update dinámico con coalesce por campo
  update public.conductores set
    curp = case when v_payload ? 'curp' then case when v_payload->>'curp' = 'null' or v_payload->>'curp' = '' then null else upper(trim(v_payload->>'curp')) end else curp end,
    licencia_numero = case when v_payload ? 'licencia_numero' then nullif(trim(v_payload->>'licencia_numero'),'') else licencia_numero end,
    licencia_tipo = case when v_payload ? 'licencia_tipo' then nullif(trim(v_payload->>'licencia_tipo'),'') else licencia_tipo end,
    licencia_vigencia = case when v_payload ? 'licencia_vigencia' then case when nullif(trim(v_payload->>'licencia_vigencia'),'') is null then null else (trim(v_payload->>'licencia_vigencia'))::date end else licencia_vigencia end,
    foto_perfil_url = case when v_payload ? 'foto_perfil_url' then nullif(trim(v_payload->>'foto_perfil_url'),'') else foto_perfil_url end,
    contacto_emergencia_nombre = case when v_payload ? 'contacto_emergencia_nombre' then nullif(trim(v_payload->>'contacto_emergencia_nombre'),'') else contacto_emergencia_nombre end,
    contacto_emergencia_telefono = case when v_payload ? 'contacto_emergencia_telefono' then nullif(trim(v_payload->>'contacto_emergencia_telefono'),'') else contacto_emergencia_telefono end,
    empresa_id = case when v_payload ? 'empresa_id' then case when v_payload->>'empresa_id' = 'null' or trim(v_payload->>'empresa_id')='' then null else (trim(v_payload->>'empresa_id'))::uuid end else empresa_id end,
    autoriza_verificacion_antecedentes = case when v_payload ? 'autoriza_verificacion_antecedentes' then (v_payload->>'autoriza_verificacion_antecedentes')::boolean else autoriza_verificacion_antecedentes end,
    declara_sin_suspensiones = case when v_payload ? 'declara_sin_suspensiones' then (v_payload->>'declara_sin_suspensiones')::boolean else declara_sin_suspensiones end,
    codigo_postal = case when v_payload ? 'codigo_postal' then nullif(trim(v_payload->>'codigo_postal'),'') else codigo_postal end,
    estado_residencia = case when v_payload ? 'estado_residencia' then nullif(trim(v_payload->>'estado_residencia'),'') else estado_residencia end,
    ciudad_municipio = case when v_payload ? 'ciudad_municipio' then nullif(trim(v_payload->>'ciudad_municipio'),'') else ciudad_municipio end,
    colonia = case when v_payload ? 'colonia' then nullif(trim(v_payload->>'colonia'),'') else colonia end,
    calle = case when v_payload ? 'calle' then nullif(trim(v_payload->>'calle'),'') else calle end,
    numero = case when v_payload ? 'numero' then nullif(trim(v_payload->>'numero'),'') else numero end,
    referencias = case when v_payload ? 'referencias' then nullif(trim(v_payload->>'referencias'),'') else referencias end,
    nombre = case when v_payload ? 'nombre' then nullif(trim(v_payload->>'nombre'),'') else nombre end,
    telefono = case when v_payload ? 'telefono' then nullif(trim(v_payload->>'telefono'),'') else telefono end,
    actualizado_en = now()
  where id = v_conductor_id;
  perform set_config('ruum.cambio_perfil_autorizado','',true);

  update public.solicitudes_cambio_conductor set
    estado = 'aprobado',
    revisado_en = now(),
    revisado_por = v_admin_id,
    actualizado_en = now()
  where id = p_solicitud_id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values (
    'solicitud_cambio_conductor_aprobada',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'solicitud_id', p_solicitud_id,
      'conductor_id', v_conductor_id,
      'tipo', v_solicitud.tipo,
      'payload_anterior', v_solicitud.payload_anterior,
      'payload_propuesto', v_payload
    )
  );

  return jsonb_build_object('solicitud_id', p_solicitud_id, 'estado', 'aprobado');
end;
$$;

revoke all on function public.aprobar_solicitud_cambio_conductor(uuid) from public, anon;
grant execute on function public.aprobar_solicitud_cambio_conductor(uuid) to authenticated;

-- 6. RPC rechazar
create or replace function public.rechazar_solicitud_cambio_conductor(
  p_solicitud_id uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_cambio_conductor;
  v_admin_id uuid;
  v_motivo text := trim(coalesce(p_motivo,''));
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  if length(v_motivo) < 5 then raise exception 'Escribe un motivo de al menos 5 caracteres.'; end if;
  select id into v_admin_id from public.admins where auth_user_id = auth.uid();
  if v_admin_id is null then raise exception 'No se encontró el administrador autenticado.'; end if;

  select * into v_solicitud from public.solicitudes_cambio_conductor where id = p_solicitud_id for update;
  if v_solicitud.id is null then raise exception 'Solicitud no encontrada.'; end if;
  if v_solicitud.estado <> 'pendiente' then raise exception 'La solicitud no está pendiente.'; end if;

  update public.solicitudes_cambio_conductor set
    estado = 'rechazado',
    motivo_rechazo = v_motivo,
    revisado_en = now(),
    revisado_por = v_admin_id,
    actualizado_en = now()
  where id = p_solicitud_id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values (
    'solicitud_cambio_conductor_rechazada',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'solicitud_id', p_solicitud_id,
      'conductor_id', v_solicitud.conductor_id,
      'tipo', v_solicitud.tipo,
      'motivo', v_motivo,
      'payload_propuesto', v_solicitud.payload_propuesto
    )
  );

  return jsonb_build_object('solicitud_id', p_solicitud_id, 'estado', 'rechazado');
end;
$$;

revoke all on function public.rechazar_solicitud_cambio_conductor(uuid,text) from public, anon;
grant execute on function public.rechazar_solicitud_cambio_conductor(uuid,text) to authenticated;

-- 7. RPC cancelar por conductor
create or replace function public.cancelar_solicitud_cambio_conductor(
  p_solicitud_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_cambio_conductor;
  v_conductor_id uuid;
begin
  select id into v_conductor_id from public.conductores where auth_user_id = auth.uid();
  if v_conductor_id is null then raise exception 'No se encontró el conductor autenticado.'; end if;

  select * into v_solicitud from public.solicitudes_cambio_conductor where id = p_solicitud_id for update;
  if v_solicitud.id is null then raise exception 'Solicitud no encontrada.'; end if;
  if v_solicitud.conductor_id <> v_conductor_id then raise exception 'No puedes cancelar la solicitud de otro conductor.'; end if;
  if v_solicitud.estado <> 'pendiente' then raise exception 'Solo se puede cancelar una solicitud pendiente.'; end if;

  update public.solicitudes_cambio_conductor set
    estado = 'cancelado',
    revisado_en = now(),
    actualizado_en = now()
  where id = p_solicitud_id;

  insert into public.registro_auditoria(evento, actor, actor_id, datos)
  values (
    'solicitud_cambio_conductor_cancelada',
    'conductor',
    v_conductor_id,
    jsonb_build_object('solicitud_id', p_solicitud_id, 'conductor_id', v_conductor_id)
  );

  return jsonb_build_object('solicitud_id', p_solicitud_id, 'estado', 'cancelado');
end;
$$;

revoke all on function public.cancelar_solicitud_cambio_conductor(uuid) from public, anon;
grant execute on function public.cancelar_solicitud_cambio_conductor(uuid) to authenticated;

-- 8. Helper para listar pendientes (uso admin)
comment on function public.solicitar_cambio_expediente_conductor(jsonb) is 'PR-04: ver arriba';
comment on function public.aprobar_solicitud_cambio_conductor(uuid) is 'Aprueba y aplica cambios sensibles';
comment on function public.rechazar_solicitud_cambio_conductor(uuid,text) is 'Rechaza cambio sensible';
