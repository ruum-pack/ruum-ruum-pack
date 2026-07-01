-- Homologa los datos capturados en registro con la sección Cuenta.
alter table public.usuarios
  add column if not exists codigo_postal text,
  add column if not exists ciudad text,
  add column if not exists colonia text,
  add column if not exists calle text,
  add column if not exists numero text,
  add column if not exists referencias text;

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
      pais,
      estado,
      codigo_postal,
      ciudad,
      colonia,
      calle,
      numero,
      referencias,
      direccion_principal,
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
      coalesce(new.raw_user_meta_data->>'pais', 'México'),
      new.raw_user_meta_data->>'estado',
      new.raw_user_meta_data->>'codigo_postal',
      new.raw_user_meta_data->>'ciudad',
      new.raw_user_meta_data->>'colonia',
      new.raw_user_meta_data->>'calle',
      new.raw_user_meta_data->>'numero',
      new.raw_user_meta_data->>'referencias',
      new.raw_user_meta_data->>'direccion_principal',
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
