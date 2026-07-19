-- ADM-UX-17 -- Rol operativo para personalizar la Torre de Control.
-- Este dato ordena/filtra la experiencia del panel, pero NO reemplaza RLS,
-- middleware ni validaciones RPC. La autorización real sigue viviendo en
-- public.es_admin(), policies y funciones admin_*.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rol_admin_operativo') then
    create type public.rol_admin_operativo as enum (
      'operador',
      'supervisor',
      'finanzas',
      'compliance',
      'direccion'
    );
  end if;
end $$;

alter table public.admins
  add column if not exists rol_operativo public.rol_admin_operativo not null default 'operador';

comment on column public.admins.rol_operativo is
  'Rol operativo para personalizar dashboard y navegación del panel admin. No sustituye controles backend.';
