-- Alta auditada de usuarios desde panel-admin.
-- Registra una cuenta pendiente para seguimiento operativo; el envio de correo
-- queda fuera de este RPC hasta que exista una integracion transaccional.

create or replace function public.admin_invitar_usuario(
  p_correo text,
  p_nombre text default null,
  p_tipo_cuenta text default 'personal'
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_id uuid;
  v_usuario_id uuid;
  v_correo text;
  v_tipo_cuenta text;
  v_rol public.rol_usuario;
begin
  if not public.admin_tiene_permiso('usuarios:validar') then
    raise exception using errcode = '42501', message = 'PERMISO_INSUFICIENTE';
  end if;

  v_correo := lower(nullif(btrim(coalesce(p_correo, '')), ''));
  v_tipo_cuenta := coalesce(nullif(btrim(p_tipo_cuenta), ''), 'personal');

  if v_correo is null then
    raise exception using errcode = '22023', message = 'CORREO_REQUERIDO';
  end if;

  if v_correo !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception using errcode = '22023', message = 'CORREO_INVALIDO';
  end if;

  if v_tipo_cuenta not in ('personal', 'empresa') then
    raise exception using errcode = '22023', message = 'TIPO_CUENTA_INVALIDO';
  end if;

  if exists (
    select 1
    from public.usuarios u
    where lower(coalesce(u.correo_facturacion, '')) = v_correo
  ) then
    raise exception using errcode = '23505', message = 'CORREO_YA_REGISTRADO';
  end if;

  select id into v_admin_id
  from public.admins
  where auth_user_id = auth.uid();

  if v_admin_id is null then
    raise exception using errcode = '42501', message = 'ADMIN_NO_ENCONTRADO';
  end if;

  v_rol := case v_tipo_cuenta
    when 'empresa' then 'titular_empresa'::public.rol_usuario
    else 'personal'::public.rol_usuario
  end;

  insert into public.usuarios (
    tipo_cuenta,
    rol,
    estado_verificacion,
    nombre,
    correo_facturacion,
    metodo_pago_registrado
  ) values (
    v_tipo_cuenta,
    v_rol,
    'pendiente',
    nullif(btrim(coalesce(p_nombre, '')), ''),
    v_correo,
    false
  )
  returning id into v_usuario_id;

  insert into public.registro_auditoria (evento, actor, actor_id, datos)
  values (
    'creacion_cuenta',
    'admin',
    v_admin_id,
    jsonb_build_object(
      'usuario_id', v_usuario_id,
      'tipo', 'invitacion_usuario',
      'tipo_cuenta', v_tipo_cuenta,
      'correo', v_correo
    )
  );

  return v_usuario_id;
end;
$$;

revoke all on function public.admin_invitar_usuario(text, text, text) from public;
grant execute on function public.admin_invitar_usuario(text, text, text) to authenticated;

comment on function public.admin_invitar_usuario(text, text, text) is
  'Registra una cuenta de usuario pendiente desde Torre de Control con auditoria.';
