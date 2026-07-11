-- RT-03 / RT-04 — Separa el proceso de alta de la identidad operativa.

create table public.solicitudes_conductor (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  conductor_id uuid unique references public.conductores(id) on delete set null,
  estado public.estado_expediente_conductor not null default 'borrador',
  paso_actual smallint not null default 0 check (paso_actual between 0 and 5),
  datos_personales jsonb not null default '{}'::jsonb check (jsonb_typeof(datos_personales) = 'object'),
  domicilio jsonb not null default '{}'::jsonb check (jsonb_typeof(domicilio) = 'object'),
  licencia jsonb not null default '{}'::jsonb check (jsonb_typeof(licencia) = 'object'),
  contacto_emergencia jsonb not null default '{}'::jsonb check (jsonb_typeof(contacto_emergencia) = 'object'),
  curp_normalizada text generated always as (nullif(upper(btrim(datos_personales->>'curp')), '')) stored,
  telefono_normalizado text generated always as (nullif(regexp_replace(datos_personales->>'telefono', '[^0-9]', '', 'g'), '')) stored,
  licencia_normalizada text generated always as (nullif(upper(btrim(licencia->>'numero')), '')) stored,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  enviado_en timestamptz,
  check ((estado in ('listo_para_enviar', 'en_revision', 'requiere_correccion', 'aprobado', 'rechazado', 'suspendido')) = (enviado_en is not null))
);

create unique index solicitudes_conductor_auth_activa_unica
  on public.solicitudes_conductor (auth_user_id)
  where estado not in ('aprobado', 'rechazado');
create unique index solicitudes_conductor_curp_unica
  on public.solicitudes_conductor (curp_normalizada) where curp_normalizada is not null;
create unique index solicitudes_conductor_telefono_unico
  on public.solicitudes_conductor (telefono_normalizado) where telefono_normalizado is not null;
create unique index solicitudes_conductor_licencia_unica
  on public.solicitudes_conductor (licencia_normalizada) where licencia_normalizada is not null;
create index solicitudes_conductor_estado_actualizado_idx
  on public.solicitudes_conductor (estado, actualizado_en desc);
create index solicitudes_conductor_auth_idx on public.solicitudes_conductor (auth_user_id);
create index solicitudes_conductor_datos_gin on public.solicitudes_conductor using gin (datos_personales);

create trigger solicitudes_conductor_actualizado_en
  before update on public.solicitudes_conductor
  for each row execute function public.set_actualizado_en();

alter table public.solicitudes_conductor enable row level security;
create policy "solicitante_ve_su_solicitud" on public.solicitudes_conductor
  for select using (auth.uid() = auth_user_id);
create policy "solicitante_edita_su_borrador" on public.solicitudes_conductor
  for update using (auth.uid() = auth_user_id and estado in ('borrador', 'datos_incompletos', 'documentos_pendientes', 'requiere_correccion'))
  with check (auth.uid() = auth_user_id);
create policy "admin_acceso_total_solicitudes_conductor" on public.solicitudes_conductor
  for all using (public.es_admin()) with check (public.es_admin());

create or replace function public.validar_identificadores_solicitud_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_curp text := nullif(upper(btrim(new.datos_personales->>'curp')), '');
  v_telefono text := nullif(regexp_replace(new.datos_personales->>'telefono', '[^0-9]', '', 'g'), '');
  v_licencia text := nullif(upper(btrim(new.licencia->>'numero')), '');
begin
  if v_curp is not null then
    perform pg_advisory_xact_lock(hashtext('curp:' || v_curp));
    if exists (select 1 from public.conductores where upper(btrim(curp)) = v_curp) then
      raise exception 'conductor_duplicado:curp' using errcode = '23505';
    end if;
  end if;
  if v_telefono is not null then
    perform pg_advisory_xact_lock(hashtext('telefono:' || v_telefono));
    if exists (select 1 from public.conductores where regexp_replace(telefono, '[^0-9]', '', 'g') = v_telefono) then
      raise exception 'conductor_duplicado:telefono' using errcode = '23505';
    end if;
  end if;
  if v_licencia is not null then
    perform pg_advisory_xact_lock(hashtext('licencia:' || v_licencia));
    if exists (select 1 from public.conductores where upper(btrim(licencia_numero)) = v_licencia) then
      raise exception 'conductor_duplicado:licencia' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;
create trigger validar_identificadores_solicitud_conductor
  before insert or update of datos_personales, licencia on public.solicitudes_conductor
  for each row execute function public.validar_identificadores_solicitud_conductor();

create or replace function public.validar_identificadores_conductor_con_solicitudes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_curp text := nullif(upper(btrim(new.curp)), '');
  v_telefono text := nullif(regexp_replace(new.telefono, '[^0-9]', '', 'g'), '');
  v_licencia text := nullif(upper(btrim(new.licencia_numero)), '');
begin
  if coalesce(current_setting('ruum.aprobando_solicitud', true), '') = 'si' then return new; end if;
  if v_curp is not null and exists (select 1 from public.solicitudes_conductor where curp_normalizada = v_curp) then
    raise exception 'conductor_duplicado:curp' using errcode = '23505';
  end if;
  if v_telefono is not null and exists (select 1 from public.solicitudes_conductor where telefono_normalizado = v_telefono) then
    raise exception 'conductor_duplicado:telefono' using errcode = '23505';
  end if;
  if v_licencia is not null and exists (select 1 from public.solicitudes_conductor where licencia_normalizada = v_licencia) then
    raise exception 'conductor_duplicado:licencia' using errcode = '23505';
  end if;
  return new;
end;
$$;
create trigger validar_identificadores_conductor_con_solicitudes
  before insert or update of curp, telefono, licencia_numero on public.conductores
  for each row execute function public.validar_identificadores_conductor_con_solicitudes();

create or replace function public.validar_transicion_solicitud_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is not distinct from old.estado then return new; end if;
  if not exists (select 1 from public.expediente_conductor_transiciones where origen = old.estado and destino = new.estado) then
    raise exception 'Transición de solicitud no permitida: % -> %', old.estado, new.estado;
  end if;
  if coalesce(current_setting('ruum.cambio_solicitud_autorizado', true), '') <> 'si' then
    raise exception 'El estado de la solicitud sólo puede cambiar mediante el flujo autorizado.';
  end if;
  return new;
end;
$$;
create trigger validar_transicion_solicitud_conductor
  before update of estado on public.solicitudes_conductor
  for each row execute function public.validar_transicion_solicitud_conductor();

create or replace function public.cambiar_estado_solicitud_conductor(p_solicitud_id uuid, p_destino public.estado_expediente_conductor)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ruum.cambio_solicitud_autorizado', 'si', true);
  update public.solicitudes_conductor set
    estado = p_destino,
    enviado_en = case
      when p_destino in ('listo_para_enviar', 'en_revision', 'requiere_correccion', 'aprobado', 'rechazado', 'suspendido') then coalesce(enviado_en, now())
      else null
    end
  where id = p_solicitud_id;
  perform set_config('ruum.cambio_solicitud_autorizado', '', true);
  if not found then raise exception 'Solicitud no encontrada.'; end if;
end;
$$;
revoke all on function public.cambiar_estado_solicitud_conductor(uuid, public.estado_expediente_conductor) from public, anon, authenticated;

-- Los documentos de una solicitud todavía no pertenecen a una identidad operativa.
alter table public.documentos_conductor add column solicitud_id uuid references public.solicitudes_conductor(id) on delete cascade;
alter table public.documentos_conductor alter column conductor_id drop not null;
alter table public.documentos_conductor add constraint documento_conductor_propietario_check
  check ((conductor_id is not null)::int + (solicitud_id is not null)::int = 1);
create index documentos_conductor_solicitud_idx on public.documentos_conductor (solicitud_id, creado_en desc);

drop policy if exists "conductor_lee_sus_documentos" on public.documentos_conductor;
drop policy if exists "conductor_registra_sus_documentos" on public.documentos_conductor;
create policy "solicitante_o_conductor_lee_documentos" on public.documentos_conductor for select using (
  conductor_id in (select id from public.conductores where auth_user_id = auth.uid())
  or solicitud_id in (select id from public.solicitudes_conductor where auth_user_id = auth.uid())
);
create policy "solicitante_o_conductor_registra_documentos" on public.documentos_conductor for insert with check (
  estado = 'en_revision' and notas_admin is null and (
    conductor_id in (select id from public.conductores where auth_user_id = auth.uid())
    or solicitud_id in (select id from public.solicitudes_conductor where auth_user_id = auth.uid())
  )
);

create or replace function public.proteger_campos_documento_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ruum.cambio_documento_autorizado', true), '') = 'si' then return new; end if;
  if public.es_admin() then return new; end if;
  if auth.uid() is null then return new; end if;
  if new.estado is distinct from old.estado or new.notas_admin is distinct from old.notas_admin
    or new.conductor_id is distinct from old.conductor_id or new.solicitud_id is distinct from old.solicitud_id
    or new.tipo is distinct from old.tipo or new.url is distinct from old.url or new.creado_en is distinct from old.creado_en then
    raise exception 'No puedes modificar el estado ni la propiedad de tus documentos.';
  end if;
  return new;
end;
$$;

-- Las cuentas nuevas de conductor crean una solicitud, no un conductor.
create or replace function public.manejar_nuevo_usuario_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo_registro text := new.raw_user_meta_data->>'tipo_registro';
  v_tipo_cuenta text := coalesce(new.raw_user_meta_data->>'tipo_cuenta', 'personal');
  v_actor_id uuid; v_actor public.actor_auditoria;
  v_version integer := nullif(coalesce(new.raw_user_meta_data->>'version_terminos_aceptada', new.raw_user_meta_data#>>'{legales,version_terminos_aceptada}'), '')::integer;
  v_aceptados timestamptz := nullif(coalesce(new.raw_user_meta_data->>'terminos_aceptados_en', new.raw_user_meta_data#>>'{legales,terminos_aceptados_en}'), '')::timestamptz;
begin
  if v_tipo_registro = 'usuario' then
    insert into public.usuarios (auth_user_id, nombre, tipo_cuenta, rol, estado_verificacion, telefono, pais, estado, codigo_postal, ciudad, colonia, calle, numero, referencias, direccion_principal, version_terminos_aceptada, terminos_aceptados_en)
    values (new.id, new.raw_user_meta_data->>'nombre', v_tipo_cuenta, (case when v_tipo_cuenta='empresa' then 'titular_empresa' else 'personal' end)::rol_usuario, 'pendiente', new.raw_user_meta_data->>'telefono', coalesce(new.raw_user_meta_data->>'pais','México'), new.raw_user_meta_data->>'estado', new.raw_user_meta_data->>'codigo_postal', new.raw_user_meta_data->>'ciudad', new.raw_user_meta_data->>'colonia', new.raw_user_meta_data->>'calle', new.raw_user_meta_data->>'numero', new.raw_user_meta_data->>'referencias', new.raw_user_meta_data->>'direccion_principal', v_version, v_aceptados)
    returning id into v_actor_id;
    v_actor := 'usuario';
  elsif v_tipo_registro = 'conductor' then
    begin
      insert into public.solicitudes_conductor (auth_user_id, estado, paso_actual, datos_personales, domicilio, licencia, contacto_emergencia)
      values (
        new.id,
        case when new.email_confirmed_at is null then 'correo_pendiente' else 'documentos_pendientes' end,
        5,
        jsonb_build_object('nombre', coalesce(new.raw_user_meta_data->>'nombre',''), 'telefono', new.raw_user_meta_data->>'telefono', 'curp', upper(new.raw_user_meta_data->>'curp'), 'autoriza_verificacion_antecedentes', coalesce((new.raw_user_meta_data->>'autoriza_verificacion_antecedentes')::boolean,false), 'declara_sin_suspensiones', coalesce((new.raw_user_meta_data->>'declara_sin_suspensiones')::boolean,false), 'version_terminos_aceptada', v_version, 'terminos_aceptados_en', v_aceptados, 'marca_terminos', new.raw_user_meta_data#>>'{legales,marca}'),
        coalesce(new.raw_user_meta_data->'domicilio', '{}'::jsonb),
        coalesce(new.raw_user_meta_data->'licencia', '{}'::jsonb),
        coalesce(new.raw_user_meta_data->'contacto_emergencia', '{}'::jsonb)
      ) returning id into v_actor_id;
    exception when unique_violation then
      if sqlerrm ilike '%curp%' then raise exception 'conductor_duplicado:curp' using errcode='23505';
      elsif sqlerrm ilike '%telefono%' then raise exception 'conductor_duplicado:telefono' using errcode='23505';
      elsif sqlerrm ilike '%licencia%' then raise exception 'conductor_duplicado:licencia' using errcode='23505';
      elsif sqlerrm ilike '%auth_activa%' then raise exception 'solicitud_duplicada:activa' using errcode='23505';
      else raise; end if;
    end;
    v_actor := 'conductor';
  end if;
  if v_actor_id is not null then
    insert into public.registro_auditoria(evento, actor, actor_id, datos)
    values ('creacion_cuenta', v_actor, v_actor_id, jsonb_build_object('auth_user_id',new.id,'tipo_registro',v_tipo_registro,'tipo_cuenta',v_tipo_cuenta));
  end if;
  if v_actor_id is not null and v_version is not null then
    insert into public.registro_auditoria(evento, actor, actor_id, datos)
    values ('aceptacion_terminos', v_actor, v_actor_id, jsonb_build_object('version_terminos_aceptada',v_version,'terminos_aceptados_en',v_aceptados));
  end if;
  return new;
end;
$$;

create or replace function public.confirmar_correo_solicitud_conductor()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select id into v_id from public.solicitudes_conductor where auth_user_id=new.id and estado='correo_pendiente';
    if v_id is not null then perform public.cambiar_estado_solicitud_conductor(v_id, 'documentos_pendientes'); end if;
  end if;
  return new;
end;
$$;
create trigger confirmar_correo_solicitud_conductor after update of email_confirmed_at on auth.users
  for each row execute function public.confirmar_correo_solicitud_conductor();

create or replace function public.preparar_expediente_por_documento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado public.estado_expediente_conductor;
begin
  perform set_config('ruum.cambio_documento_autorizado', 'si', true);
  update public.documentos_conductor set estado='reemplazado', actualizado_en=now()
    where id<>new.id and tipo=new.tipo
      and ((new.solicitud_id is not null and solicitud_id=new.solicitud_id) or (new.conductor_id is not null and conductor_id=new.conductor_id))
      and estado in ('en_revision','aprobado','rechazado','vencido');
  perform set_config('ruum.cambio_documento_autorizado', '', true);

  if new.solicitud_id is not null then
    select estado into v_estado from public.solicitudes_conductor where id=new.solicitud_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_solicitud_conductor(new.solicitud_id,'documentos_pendientes');
      v_estado:='documentos_pendientes';
    end if;
    if v_estado='documentos_pendientes' and not exists (
      select 1 from (values ('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
      where not exists (select 1 from public.documentos_conductor d where d.solicitud_id=new.solicitud_id and d.tipo=r.tipo and d.estado='en_revision')
    ) then
      perform public.cambiar_estado_solicitud_conductor(new.solicitud_id,'listo_para_enviar');
      perform public.cambiar_estado_solicitud_conductor(new.solicitud_id,'en_revision');
    end if;
  elsif new.conductor_id is not null then
    select estado_expediente into v_estado from public.conductores where id=new.conductor_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'documentos_pendientes');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.revisar_documento_conductor_admin(p_documento_id uuid,p_estado text,p_notas text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_conductor_id uuid; v_solicitud_id uuid; v_estado public.estado_expediente_conductor;
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  if p_estado not in ('aprobado','rechazado','vencido') then raise exception 'Estado de revisión no permitido.'; end if;
  if p_estado<>'aprobado' and length(trim(coalesce(p_notas,'')))<5 then raise exception 'Escribe un motivo de al menos 5 caracteres.'; end if;
  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set estado=p_estado, notas_admin=case when p_estado='aprobado' then null else trim(p_notas) end, actualizado_en=now()
    where id=p_documento_id and estado=case when p_estado='vencido' then 'aprobado' else 'en_revision' end
    returning conductor_id,solicitud_id into v_conductor_id,v_solicitud_id;
  perform set_config('ruum.cambio_documento_autorizado','',true);
  if v_conductor_id is null and v_solicitud_id is null then raise exception 'Documento no encontrado o transición no permitida.'; end if;
  if p_estado='rechazado' and v_solicitud_id is not null then
    select estado into v_estado from public.solicitudes_conductor where id=v_solicitud_id;
    if v_estado='en_revision' then perform public.cambiar_estado_solicitud_conductor(v_solicitud_id,'requiere_correccion'); end if;
  elsif p_estado='rechazado' and v_conductor_id is not null then
    select estado_expediente into v_estado from public.conductores where id=v_conductor_id;
    if v_estado='en_revision' then perform public.cambiar_estado_expediente_conductor(v_conductor_id,'requiere_correccion'); end if;
  end if;
end;
$$;

create or replace function public.aprobar_solicitud_conductor_admin(p_solicitud_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.solicitudes_conductor; v_conductor_id uuid;
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  select * into s from public.solicitudes_conductor where id=p_solicitud_id for update;
  if s.id is null or s.estado<>'en_revision' then raise exception 'La solicitud no está en revisión.'; end if;
  if exists (
    select 1 from (values ('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
    where not exists (select 1 from public.documentos_conductor d where d.solicitud_id=s.id and d.tipo=r.tipo and d.estado='aprobado')
  ) then raise exception 'Faltan documentos obligatorios aprobados.'; end if;

  perform set_config('ruum.aprobando_solicitud','si',true);
  insert into public.conductores (
    auth_user_id,nombre,telefono,curp,codigo_postal,estado_residencia,ciudad_municipio,colonia,calle,numero,referencias,
    licencia_numero,licencia_tipo,licencia_vigencia,autoriza_verificacion_antecedentes,declara_sin_suspensiones,
    contacto_emergencia_nombre,contacto_emergencia_telefono,version_terminos_aceptada,terminos_aceptados_en,marca_terminos
  ) values (
    s.auth_user_id,coalesce(s.datos_personales->>'nombre',''),s.datos_personales->>'telefono',s.curp_normalizada,
    s.domicilio->>'codigo_postal',s.domicilio->>'estado',s.domicilio->>'ciudad_municipio',s.domicilio->>'colonia',s.domicilio->>'calle',s.domicilio->>'numero',s.domicilio->>'referencias',
    s.licencia_normalizada,s.licencia->>'tipo',(s.licencia->>'vigencia')::date,
    coalesce((s.datos_personales->>'autoriza_verificacion_antecedentes')::boolean,false),coalesce((s.datos_personales->>'declara_sin_suspensiones')::boolean,false),
    s.contacto_emergencia->>'nombre',s.contacto_emergencia->>'telefono',(s.datos_personales->>'version_terminos_aceptada')::integer,(s.datos_personales->>'terminos_aceptados_en')::timestamptz,s.datos_personales->>'marca_terminos'
  ) returning id into v_conductor_id;
  perform set_config('ruum.aprobando_solicitud','',true);

  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set conductor_id=v_conductor_id,solicitud_id=null where solicitud_id=s.id;
  perform set_config('ruum.cambio_documento_autorizado','',true);

  -- El trigger de alta inicia el expediente operativo en documentos_pendientes.
  perform public.cambiar_estado_expediente_conductor(v_conductor_id,'listo_para_enviar');
  perform public.cambiar_estado_expediente_conductor(v_conductor_id,'en_revision');
  perform public.cambiar_estado_expediente_conductor(v_conductor_id,'aprobado');
  update public.conductores set estado='activo',documentos_vigentes=true where id=v_conductor_id;
  perform public.cambiar_estado_solicitud_conductor(s.id,'aprobado');
  update public.solicitudes_conductor set conductor_id=v_conductor_id where id=s.id;
  return v_conductor_id;
end;
$$;
revoke all on function public.aprobar_solicitud_conductor_admin(uuid) from public,anon;
grant execute on function public.aprobar_solicitud_conductor_admin(uuid) to authenticated;

comment on table public.solicitudes_conductor is 'Expediente de alta previo a la identidad operativa en conductores.';
