-- Repair idempotente para presentación de módulos admin.
-- Usuarios usa estado_cuenta y expedientes de conductor exponen vigencias.

alter table public.usuarios
  add column if not exists estado_cuenta text not null default 'activa';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'usuarios_estado_cuenta_check'
      and conrelid = 'public.usuarios'::regclass
  ) then
    alter table public.usuarios
      add constraint usuarios_estado_cuenta_check
      check (estado_cuenta in ('activa', 'suspendida', 'cerrada'));
  end if;
end $$;

alter table public.documentos_conductor
  add column if not exists expira_en timestamptz;
