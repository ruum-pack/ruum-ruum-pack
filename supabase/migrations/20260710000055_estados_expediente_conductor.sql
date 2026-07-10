-- RT-02 — Máquina de estados única para el expediente del conductor.
-- Esta migración es aditiva: conserva `conductores.estado` como estado
-- operativo y agrega `estado_expediente` para el onboarding/revisión.

create type public.estado_expediente_conductor as enum (
  'borrador',
  'correo_pendiente',
  'datos_incompletos',
  'documentos_pendientes',
  'listo_para_enviar',
  'en_revision',
  'requiere_correccion',
  'aprobado',
  'rechazado',
  'suspendido'
);

alter table public.conductores
  add column estado_expediente public.estado_expediente_conductor not null default 'borrador';

create table public.expediente_conductor_transiciones (
  origen public.estado_expediente_conductor not null,
  destino public.estado_expediente_conductor not null,
  primary key (origen, destino),
  check (origen <> destino)
);

insert into public.expediente_conductor_transiciones (origen, destino) values
  ('borrador', 'correo_pendiente'),
  ('correo_pendiente', 'datos_incompletos'),
  ('correo_pendiente', 'documentos_pendientes'),
  ('datos_incompletos', 'documentos_pendientes'),
  ('documentos_pendientes', 'listo_para_enviar'),
  ('listo_para_enviar', 'en_revision'),
  ('en_revision', 'requiere_correccion'),
  ('en_revision', 'aprobado'),
  ('en_revision', 'rechazado'),
  ('requiere_correccion', 'datos_incompletos'),
  ('requiere_correccion', 'documentos_pendientes'),
  ('requiere_correccion', 'listo_para_enviar'),
  ('aprobado', 'suspendido'),
  ('suspendido', 'aprobado'),
  ('suspendido', 'rechazado');

alter table public.expediente_conductor_transiciones enable row level security;
create policy "transiciones_expediente_lectura"
  on public.expediente_conductor_transiciones for select using (true);

create table public.documento_conductor_transiciones (
  origen text not null,
  destino text not null,
  primary key (origen, destino),
  check (origen in ('en_revision', 'aprobado', 'rechazado', 'reemplazado', 'vencido')),
  check (destino in ('en_revision', 'aprobado', 'rechazado', 'reemplazado', 'vencido')),
  check (origen <> destino)
);

insert into public.documento_conductor_transiciones (origen, destino) values
  ('en_revision', 'aprobado'),
  ('en_revision', 'rechazado'),
  ('en_revision', 'reemplazado'),
  ('aprobado', 'vencido'),
  ('aprobado', 'reemplazado'),
  ('rechazado', 'reemplazado'),
  ('vencido', 'reemplazado');

alter table public.documento_conductor_transiciones enable row level security;
create policy "transiciones_documento_lectura"
  on public.documento_conductor_transiciones for select using (true);

-- Normaliza valores heredados antes de endurecer la restricción.
update public.documentos_conductor set estado = 'en_revision'
where estado in ('pendiente', 'actualizacion');

alter table public.documentos_conductor
  drop constraint if exists documentos_conductor_estado_check;
alter table public.documentos_conductor
  add constraint documentos_conductor_estado_check
  check (estado in ('en_revision', 'aprobado', 'rechazado', 'reemplazado', 'vencido'));

create or replace function public.validar_transicion_expediente_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado_expediente is not distinct from old.estado_expediente then return new; end if;
  if not exists (
    select 1 from public.expediente_conductor_transiciones
    where origen = old.estado_expediente and destino = new.estado_expediente
  ) then
    raise exception 'Transición de expediente no permitida: % -> %', old.estado_expediente, new.estado_expediente;
  end if;
  return new;
end;
$$;

create trigger validar_transicion_expediente_conductor
  before update of estado_expediente on public.conductores
  for each row execute function public.validar_transicion_expediente_conductor();

create or replace function public.bloquear_estado_expediente_directo()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.estado_expediente is distinct from old.estado_expediente
    and coalesce(current_setting('ruum.cambio_expediente_autorizado', true), '') <> 'si' then
    raise exception 'El estado administrativo del expediente sólo puede cambiar mediante el flujo autorizado.';
  end if;
  return new;
end;
$$;

create trigger bloquear_estado_expediente_directo
  before update of estado_expediente on public.conductores
  for each row execute function public.bloquear_estado_expediente_directo();

create or replace function public.cambiar_estado_expediente_conductor(
  p_conductor_id uuid,
  p_destino public.estado_expediente_conductor
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('ruum.cambio_expediente_autorizado', 'si', true);
  update public.conductores set estado_expediente = p_destino where id = p_conductor_id;
  perform set_config('ruum.cambio_expediente_autorizado', '', true);
  if not found then raise exception 'Conductor no encontrado.'; end if;
end;
$$;
revoke all on function public.cambiar_estado_expediente_conductor(uuid, public.estado_expediente_conductor) from public, anon, authenticated;

create or replace function public.validar_transicion_documento_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estado is not distinct from old.estado then return new; end if;
  if not exists (
    select 1 from public.documento_conductor_transiciones
    where origen = old.estado and destino = new.estado
  ) then
    raise exception 'Transición de documento no permitida: % -> %', old.estado, new.estado;
  end if;
  if coalesce(current_setting('ruum.cambio_documento_autorizado', true), '') <> 'si' then
    raise exception 'El estado administrativo del documento sólo puede cambiar mediante el flujo autorizado.';
  end if;
  return new;
end;
$$;

create trigger validar_transicion_documento_conductor
  before update of estado on public.documentos_conductor
  for each row execute function public.validar_transicion_documento_conductor();

-- Conserva el blindaje de la migración 54 y permite exclusivamente los
-- cambios internos marcados por las funciones de esta máquina de estados.
create or replace function public.proteger_campos_documento_conductor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('ruum.cambio_documento_autorizado', true), '') = 'si' then return new; end if;
  if public.es_admin() then return new; end if;
  if auth.uid() is null then return new; end if;
  if new.estado is distinct from old.estado
    or new.notas_admin is distinct from old.notas_admin
    or new.conductor_id is distinct from old.conductor_id
    or new.tipo is distinct from old.tipo
    or new.url is distinct from old.url
    or new.creado_en is distinct from old.creado_en then
    raise exception 'No puedes modificar el estado ni las notas de revisión de tus documentos.';
  end if;
  return new;
end;
$$;

create or replace function public.expediente_conductor_tiene_datos(p_conductor_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    nombre <> '' and telefono is not null and curp is not null and codigo_postal is not null
    and estado_residencia is not null and ciudad_municipio is not null and colonia is not null
    and calle is not null and numero is not null and licencia_numero is not null
    and licencia_tipo is not null and licencia_vigencia is not null
    and contacto_emergencia_nombre is not null and contacto_emergencia_telefono is not null
    and autoriza_verificacion_antecedentes and declara_sin_suspensiones
    and version_terminos_aceptada is not null and terminos_aceptados_en is not null,
    false
  ) from public.conductores where id = p_conductor_id;
$$;

create or replace function public.preparar_expediente_por_documento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado public.estado_expediente_conductor;
begin
  -- Cada carga crea una versión; la versión anterior nunca se sobrescribe.
  perform set_config('ruum.cambio_documento_autorizado', 'si', true);
  update public.documentos_conductor
    set estado = 'reemplazado', actualizado_en = now()
    where conductor_id = new.conductor_id and tipo = new.tipo and id <> new.id
      and estado in ('en_revision', 'aprobado', 'rechazado', 'vencido');
  perform set_config('ruum.cambio_documento_autorizado', '', true);

  select estado_expediente into v_estado from public.conductores where id = new.conductor_id;
  if v_estado = 'requiere_correccion' then
    perform public.cambiar_estado_expediente_conductor(new.conductor_id, 'documentos_pendientes');
    v_estado := 'documentos_pendientes';
  end if;

  if v_estado = 'documentos_pendientes'
    and public.expediente_conductor_tiene_datos(new.conductor_id)
    and not exists (
      select 1 from (values ('licencia_frente'), ('licencia_reverso'), ('identificacion_oficial')) requerido(tipo)
      where not exists (
        select 1 from public.documentos_conductor d
        where d.conductor_id = new.conductor_id and d.tipo = requerido.tipo
          and d.estado = 'en_revision'
      )
    ) then
    perform public.cambiar_estado_expediente_conductor(new.conductor_id, 'listo_para_enviar');
    perform public.cambiar_estado_expediente_conductor(new.conductor_id, 'en_revision');
  end if;
  return new;
end;
$$;

create trigger preparar_expediente_por_documento
  after insert on public.documentos_conductor
  for each row execute function public.preparar_expediente_por_documento();

create or replace function public.inicializar_estado_expediente_conductor()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.auth_user_id is null then new.estado_expediente := 'borrador';
  elsif exists (select 1 from auth.users where id = new.auth_user_id and email_confirmed_at is not null) then
    new.estado_expediente := 'documentos_pendientes';
  else new.estado_expediente := 'correo_pendiente';
  end if;
  return new;
end;
$$;

create trigger inicializar_estado_expediente_conductor
  before insert on public.conductores
  for each row execute function public.inicializar_estado_expediente_conductor();

create or replace function public.confirmar_correo_expediente_conductor()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_conductor_id uuid; v_estado public.estado_expediente_conductor;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select id, estado_expediente into v_conductor_id, v_estado
      from public.conductores where auth_user_id = new.id;
    if v_conductor_id is not null and v_estado = 'correo_pendiente' then
      if public.expediente_conductor_tiene_datos(v_conductor_id) then
        perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'documentos_pendientes');
      else
        perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'datos_incompletos');
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger confirmar_correo_expediente_conductor
  after update of email_confirmed_at on auth.users
  for each row execute function public.confirmar_correo_expediente_conductor();

-- Migra expedientes existentes conforme a su estado operativo y documentos.
alter table public.conductores disable trigger validar_transicion_expediente_conductor;
alter table public.conductores disable trigger bloquear_estado_expediente_directo;
update public.conductores c set estado_expediente = case
  when c.estado in ('suspendido_7d', 'suspendido_14d', 'suspendido_30d', 'suspendido_indefinido', 'bloqueado_permanente') then 'suspendido'
  when c.estado in ('activo', 'modo_prueba_supervisada') then 'aprobado'
  when exists (select 1 from public.documentos_conductor d where d.conductor_id = c.id) then 'en_revision'
  else 'documentos_pendientes'
end::public.estado_expediente_conductor;
alter table public.conductores enable trigger validar_transicion_expediente_conductor;
alter table public.conductores enable trigger bloquear_estado_expediente_directo;

create or replace function public.revisar_documento_conductor_admin(
  p_documento_id uuid,
  p_estado text,
  p_notas text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_conductor_id uuid; v_estado_expediente public.estado_expediente_conductor;
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  if p_estado not in ('aprobado', 'rechazado', 'vencido') then
    raise exception 'Estado de revisión no permitido.';
  end if;
  if p_estado <> 'aprobado' and length(trim(coalesce(p_notas, ''))) < 5 then
    raise exception 'Escribe un motivo de al menos 5 caracteres.';
  end if;

  perform set_config('ruum.cambio_documento_autorizado', 'si', true);
  update public.documentos_conductor set
    estado = p_estado,
    notas_admin = case when p_estado = 'aprobado' then null else trim(p_notas) end,
    actualizado_en = now()
    where id = p_documento_id and estado = 'en_revision'
    returning conductor_id into v_conductor_id;
  perform set_config('ruum.cambio_documento_autorizado', '', true);
  if v_conductor_id is null then raise exception 'Documento no encontrado o ya revisado.'; end if;

  if p_estado = 'rechazado' then
    select estado_expediente into v_estado_expediente from public.conductores where id = v_conductor_id;
    if v_estado_expediente = 'en_revision' then
      perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'requiere_correccion');
    end if;
  end if;
end;
$$;
revoke all on function public.revisar_documento_conductor_admin(uuid, text, text) from public, anon;
grant execute on function public.revisar_documento_conductor_admin(uuid, text, text) to authenticated;

create or replace function public.aprobar_expediente_conductor_admin(p_conductor_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  if not exists (
    select 1 from public.conductores where id = p_conductor_id and estado_expediente = 'en_revision'
  ) then raise exception 'El expediente no está en revisión.'; end if;
  if exists (
    select 1 from (values ('licencia_frente'), ('licencia_reverso'), ('identificacion_oficial')) requerido(tipo)
    where not exists (
      select 1 from public.documentos_conductor d where d.conductor_id = p_conductor_id
        and d.tipo = requerido.tipo and d.estado = 'aprobado'
    )
  ) then raise exception 'Faltan documentos obligatorios aprobados.'; end if;

  perform public.cambiar_estado_expediente_conductor(p_conductor_id, 'aprobado');
  update public.conductores set estado = 'activo', documentos_vigentes = true where id = p_conductor_id;
end;
$$;
revoke all on function public.aprobar_expediente_conductor_admin(uuid) from public, anon;
grant execute on function public.aprobar_expediente_conductor_admin(uuid) to authenticated;

comment on column public.conductores.estado_expediente is
  'Estado único del onboarding y revisión. Sólo cambia mediante funciones autorizadas; conductores.estado conserva el estado operativo.';
