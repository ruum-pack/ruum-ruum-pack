-- Bug real encontrado al revisar panel-admin con datos reales (2026-06-29):
-- ninguna pantalla mostraba el nombre del usuario. Causa: la tabla usuarios
-- nunca tuvo columna `nombre`, a diferencia de conductores (que sí la tiene
-- desde 0003). El formulario de registro de app-usuario siempre mandó
-- `nombre` dentro de options.data de signUp() (igual que app-conductor), pero
-- el trigger de 0024 nunca lo insertaba para la rama "usuario" porque la
-- columna destino no existía.
alter table public.usuarios add column if not exists nombre text;

-- Reescribe el trigger (CREATE OR REPLACE, misma firma) para incluir nombre
-- también en la rama usuario. La rama conductor ya lo hacía correctamente.
create or replace function public.manejar_nuevo_usuario_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo_registro text := new.raw_user_meta_data->>'tipo_registro';
  v_tipo_cuenta text := coalesce(new.raw_user_meta_data->>'tipo_cuenta', 'personal');
begin
  if v_tipo_registro = 'usuario' then
    insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion, telefono, nombre)
    values (
      new.id,
      v_tipo_cuenta,
      (case when v_tipo_cuenta = 'empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
      'pendiente',
      new.raw_user_meta_data->>'telefono',
      new.raw_user_meta_data->>'nombre'
    );
  elsif v_tipo_registro = 'conductor' then
    insert into public.conductores (auth_user_id, nombre, telefono)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'nombre', ''),
      new.raw_user_meta_data->>'telefono'
    );
  end if;
  -- Sin "else": admins nunca se crea por este trigger, a propósito (ver
  -- panel-admin/README.md, "Cómo crear un admin" — sigue siendo manual).
  return new;
end;
$$;

-- Backfill de filas que ya existían antes de este fix. Cubre dos casos
-- reales a la vez:
--  1. usuarios: nombre siempre estaba en null (la columna no existía).
--  2. conductores: cualquier fila creada con nombre = '' por una versión
--     desplegada antes de que el formulario mandara `nombre` correctamente
--     (p. ej. por desfase entre git push y el redeploy de Vercel) — se
--     recupera leyendo la metadata real guardada en auth.users, sin tocar
--     ninguna fila que ya tenga un nombre real.
update public.usuarios u
set nombre = au.raw_user_meta_data->>'nombre'
from auth.users au
where au.id = u.auth_user_id
  and u.nombre is null
  and au.raw_user_meta_data->>'nombre' is not null;

update public.conductores c
set nombre = au.raw_user_meta_data->>'nombre'
from auth.users au
where au.id = c.auth_user_id
  and (c.nombre is null or c.nombre = '')
  and au.raw_user_meta_data->>'nombre' is not null;
