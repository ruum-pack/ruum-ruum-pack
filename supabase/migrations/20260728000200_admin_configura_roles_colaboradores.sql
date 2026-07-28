-- Permite a Direccion/capacidades:administrar configurar el rol operativo
-- de colaboradores de Torre de Control sin exponer UPDATE directo de admins.

create or replace function public.admin_actualizar_rol_colaborador(
  p_admin_id uuid,
  p_rol public.rol_admin_operativo,
  p_motivo text
)
returns table (
  id uuid,
  nombre text,
  rol_operativo public.rol_admin_operativo,
  creado_en timestamptz
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor public.admins%rowtype;
  v_objetivo public.admins%rowtype;
  v_rol_anterior public.rol_admin_operativo;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if not public.admin_tiene_permiso('capacidades:administrar') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;

  if v_motivo is null or length(v_motivo) < 10 then
    raise exception using errcode='22023', message='MOTIVO_OBLIGATORIO';
  end if;

  select * into strict v_actor
  from public.admins
  where auth_user_id = auth.uid();

  select * into strict v_objetivo
  from public.admins
  where admins.id = p_admin_id
  for update;

  if v_actor.id = v_objetivo.id and v_actor.rol_operativo = 'direccion' and p_rol <> 'direccion' then
    raise exception using errcode='42501', message='NO_AUTO_DEGRADACION_DIRECCION';
  end if;

  v_rol_anterior := v_objetivo.rol_operativo;

  update public.admins
  set rol_operativo = p_rol
  where admins.id = p_admin_id
  returning admins.* into v_objetivo;

  insert into public.auditoria_admin_seguridad(auth_user_id, admin_id, rol, tipo, recurso, accion, motivo, datos)
  values(
    auth.uid(),
    v_actor.id,
    v_actor.rol_operativo::text,
    'mutacion',
    'admins',
    'actualizar_rol_operativo',
    v_motivo,
    jsonb_build_object(
      'admin_objetivo_id', p_admin_id,
      'rol_anterior', v_rol_anterior::text,
      'rol_nuevo', p_rol::text
    )
  );

  return query
  select v_objetivo.id, v_objetivo.nombre, v_objetivo.rol_operativo, v_objetivo.creado_en;
exception
  when no_data_found then
    raise exception using errcode='22023', message='ADMIN_NO_ENCONTRADO';
end;
$$;

revoke all on function public.admin_actualizar_rol_colaborador(uuid, public.rol_admin_operativo, text) from public;
grant execute on function public.admin_actualizar_rol_colaborador(uuid, public.rol_admin_operativo, text) to authenticated;
