-- Auditoría de alta de cuenta desde el trigger canónico de auth.users.
-- Se reemplaza la función existente para conservar el flujo autoservicio y
-- registrar `creacion_cuenta` con actor real (usuario o conductor).

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
begin
  if v_tipo_registro = 'usuario' then
    insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion, telefono)
    values (
      new.id,
      v_tipo_cuenta,
      (case when v_tipo_cuenta = 'empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
      'pendiente',
      new.raw_user_meta_data->>'telefono'
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
    insert into public.registro_auditoria (
      evento,
      actor,
      actor_id,
      datos
    ) values (
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

  return new;
end;
$$;
