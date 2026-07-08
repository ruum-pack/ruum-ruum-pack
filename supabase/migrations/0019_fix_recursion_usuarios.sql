-- Bug real encontrado al probar RLS bajo un rol no-superusuario por primera
-- vez (toda la validación anterior corrió como "postgres", que ignora RLS
-- por completo — por eso nunca se detectó). La política
-- "titular_ve_usuarios_de_su_empresa" (0002) consulta public.usuarios DENTRO
-- de su propio USING, y esa subconsulta vuelve a evaluar la misma política
-- de RLS sobre usuarios — recursión infinita ("infinite recursion detected
-- in policy for relation usuarios") en cualquier query que toque la tabla
-- usuarios bajo un rol normal, incluyendo joins desde traslados.
--
-- Mismo patrón que ya se usó correctamente en es_admin() (0001): una función
-- security definer corre con los permisos de su dueño, así que su consulta
-- interna NO vuelve a pasar por RLS, rompiendo la recursión.
create or replace function public.empresa_id_del_titular_actual()
returns uuid
language sql
security definer
stable
as $$
  select empresa_id from public.usuarios
  where auth_user_id = auth.uid() and rol = 'titular_empresa'
  limit 1;
$$;

drop policy "titular_ve_usuarios_de_su_empresa" on public.usuarios;

create policy "titular_ve_usuarios_de_su_empresa"
  on public.usuarios for select
  using (
    empresa_id is not null
    and empresa_id = public.empresa_id_del_titular_actual()
  );
