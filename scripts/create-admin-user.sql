-- Crear usuario en auth.users si no existe y asignar rol direccion en admins
do $$
declare
  v_user_id uuid;
  v_admin_id uuid;
begin
  -- Verificar si el usuario ya existe
  select id into v_user_id from auth.users where email = 'lomelinhectorm@gmail.com';

  if v_user_id is null then
    -- Crear usuario en auth.users
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, aud, role, is_sso_user, is_anonymous
    ) values (
      v_user_id,
      'lomelinhectorm@gmail.com',
      now(),
      '{"provider":"email"}',
      '{"nombre":"Hector Lomelin"}',
      now(), now(),
      'authenticated',
      'authenticated',
      false, false
    );
    raise notice 'Usuario auth creado: %', v_user_id;
  else
    raise notice 'Usuario auth ya existe: %', v_user_id;
  end if;

  -- Verificar si ya es admin
  select id into v_admin_id from public.admins where auth_user_id = v_user_id;

  if v_admin_id is null then
    -- Insertar como admin con rol direccion (máximos permisos)
    insert into public.admins (auth_user_id, nombre, rol_operativo)
    values (v_user_id, 'Hector Lomelin', 'direccion')
    returning id into v_admin_id;
    raise notice 'Admin creado: % con rol direccion', v_admin_id;
  else
    -- Actualizar rol a direccion por si acaso
    update public.admins set rol_operativo = 'direccion' where id = v_admin_id;
    raise notice 'Admin actualizado: % a rol direccion', v_admin_id;
  end if;
end $$;
