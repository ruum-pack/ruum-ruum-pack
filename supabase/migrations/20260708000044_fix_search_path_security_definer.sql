-- Auditoría H-6 — Endurecimiento de las funciones `security definer` que se
-- crearon SIN `set search_path` fijo (0001, 0019). Una función definer sin
-- search_path explícito es el vector clásico de escalada por "search-path
-- hijacking": un rol con permiso de crear objetos en un esquema que preceda a
-- `public` en el search_path del llamador puede sombrear `public.admins`,
-- `public.usuarios`, etc., y hacer que estas funciones evalúen contra tablas
-- suplantadas. es_admin() es la piedra angular de TODA la autorización de
-- Admin, así que este es el caso más crítico.
--
-- El resto de funciones definer del proyecto (0024, 0030–0039) ya fijan
-- `set search_path = public`; esta migración cierra la inconsistencia. Se usan
-- `create or replace` con el MISMO cuerpo para que sea un cambio puramente
-- defensivo (sin cambio de comportamiento) e idempotente.

-- 0001 — membresía en admins (usada por todas las policies admin_acceso_total_*).
create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.auth_user_id = auth.uid()
  );
$$;

-- 0019 — rompe la recursión de RLS en "titular_ve_usuarios_de_su_empresa".
create or replace function public.empresa_id_del_titular_actual()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select empresa_id from public.usuarios
  where auth_user_id = auth.uid() and rol = 'titular_empresa'
  limit 1;
$$;
