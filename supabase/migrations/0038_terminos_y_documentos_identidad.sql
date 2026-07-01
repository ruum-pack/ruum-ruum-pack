-- PRD §5.10 — Registro de aceptación de términos y documentos de identidad.
alter table public.usuarios
  add column if not exists version_terminos_aceptada integer,
  add column if not exists terminos_aceptados_en timestamptz,
  add column if not exists doc_identidad_url text,
  add column if not exists doc_identidad_subido_en timestamptz;

insert into storage.buckets (id, name, public)
values ('documentos-identidad', 'documentos-identidad', false)
on conflict (id) do update set public = false;

create policy "usuario_sube_su_documento_identidad"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documentos-identidad'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "usuario_ve_su_documento_identidad"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documentos-identidad'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "usuario_actualiza_su_documento_identidad"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documentos-identidad'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documentos-identidad'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admin_ve_todos_los_documentos_identidad"
  on storage.objects for select
  using (
    bucket_id = 'documentos-identidad'
    and public.es_admin()
  );

alter type public.evento_auditable add value if not exists 'aceptacion_terminos';
alter type public.evento_auditable add value if not exists 'carga_documento_identidad';

create or replace function public.proteger_verificacion_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() <> old.auth_user_id then
    return new;
  end if;

  if new.auth_user_id is distinct from old.auth_user_id
    or new.tipo_cuenta is distinct from old.tipo_cuenta
    or new.rol is distinct from old.rol
    or new.empresa_id is distinct from old.empresa_id
    or new.traslados_completados_sin_incidencia is distinct from old.traslados_completados_sin_incidencia
    or new.metodo_pago_registrado is distinct from old.metodo_pago_registrado
    or new.creado_en is distinct from old.creado_en then
    raise exception 'No puedes modificar campos administrativos de la cuenta.';
  end if;

  if new.estado_verificacion is distinct from old.estado_verificacion
    and not (
      new.estado_verificacion = 'en_revision'
      and new.doc_identidad_url is not null
      and new.doc_identidad_subido_en is not null
    ) then
    raise exception 'La verificación de cuenta solo puede aprobarla o rechazarla un administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_verificacion_usuario on public.usuarios;
create trigger proteger_verificacion_usuario
  before update on public.usuarios
  for each row execute function public.proteger_verificacion_usuario();

create or replace function public.manejar_nuevo_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo_registro text := new.raw_user_meta_data->>'tipo_registro';
  v_tipo_cuenta text := coalesce(new.raw_user_meta_data->>'tipo_cuenta', 'personal');
  v_actor_id uuid;
  v_actor public.actor_auditoria;
  v_version_terminos integer := nullif(new.raw_user_meta_data->>'version_terminos_aceptada', '')::integer;
  v_terminos_aceptados_en timestamptz := nullif(new.raw_user_meta_data->>'terminos_aceptados_en', '')::timestamptz;
begin
  if v_tipo_registro = 'usuario' then
    insert into public.usuarios (
      auth_user_id,
      nombre,
      tipo_cuenta,
      rol,
      estado_verificacion,
      telefono,
      version_terminos_aceptada,
      terminos_aceptados_en
    )
    values (
      new.id,
      new.raw_user_meta_data->>'nombre',
      v_tipo_cuenta,
      (case when v_tipo_cuenta = 'empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
      'pendiente',
      new.raw_user_meta_data->>'telefono',
      v_version_terminos,
      v_terminos_aceptados_en
    )
    returning id into v_actor_id;
    v_actor := 'usuario';
  elsif v_tipo_registro = 'conductor' then
    insert into public.conductores (auth_user_id, nombre, telefono)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nombre', ''),
      new.raw_user_meta_data->>'telefono'
    )
    returning id into v_actor_id;
    v_actor := 'conductor';
  end if;

  if v_actor_id is not null then
    insert into public.registro_auditoria (evento, actor, actor_id, datos)
    values (
      'creacion_cuenta',
      v_actor,
      v_actor_id,
      jsonb_build_object(
        'auth_user_id', new.id,
        'tipo_registro', v_tipo_registro,
        'tipo_cuenta', v_tipo_cuenta
      )
    );
  end if;

  if v_tipo_registro = 'usuario' and v_actor_id is not null and v_version_terminos is not null then
    insert into public.registro_auditoria (evento, actor, actor_id, datos)
    values (
      'aceptacion_terminos',
      'usuario',
      v_actor_id,
      jsonb_build_object(
        'version_terminos_aceptada', v_version_terminos,
        'terminos_aceptados_en', v_terminos_aceptados_en
      )
    );
  end if;

  return new;
end;
$$;
