-- Bug real encontrado al probar el registro real (app-conductor, sesión de
-- pruebas 2026-06-28): con confirmación de correo activada (default de
-- Supabase), auth.signUp() no devuelve una sesión activa de inmediato —
-- auth.uid() no es nadie todavía en el momento en que el cliente intentaba
-- insertar en usuarios/conductores justo después del signUp(). La política
-- de autoservicio (0021) rechazaba correctamente esa inserción: no era un
-- bug de la política, era un supuesto incorrecto sobre cuándo existe sesión.
--
-- Patrón recomendado por Supabase para este caso exacto: un trigger sobre
-- auth.users que crea la fila correspondiente en el momento en que se crea
-- la cuenta, sin depender de sesión activa, corriendo con privilegios
-- elevados (security definer) — no necesita pasar por RLS porque no pasa
-- por el cliente. Las apps ahora mandan todo el dato necesario dentro de
-- options.data de signUp() (nombre, telefono, tipo_cuenta, y un
-- discriminador tipo_registro para saber a cuál tabla insertar).
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
    insert into public.usuarios (auth_user_id, tipo_cuenta, rol, estado_verificacion, telefono)
    values (
      new.id,
      v_tipo_cuenta,
      (case when v_tipo_cuenta = 'empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
      'pendiente',
      new.raw_user_meta_data->>'telefono'
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.manejar_nuevo_usuario_auth();
