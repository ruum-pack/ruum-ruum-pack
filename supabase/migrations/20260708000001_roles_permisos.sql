-- PRD §3 — Roles y permisos. Enums base reutilizados por usuarios y conductores.
create type public.rol_usuario as enum (
  'personal', 'titular_empresa', 'usuario_autorizado'
);

create type public.estado_verificacion as enum (
  'pendiente', 'en_revision', 'verificado', 'rechazado'
);

create type public.nivel_concer as enum (
  'basico', 'ejecutivo', 'luxury', 'coleccion'
);

create type public.estado_conductor as enum (
  'activo',
  'suspendido_7d',
  'suspendido_14d',
  'suspendido_30d',
  'suspendido_indefinido',
  'bloqueado_permanente',
  'modo_prueba_supervisada',
  'pendiente_verificacion'
);

-- PRD §3 — "Admin / Torre de Control": equipo operativo interno, distinto de
-- los roles de usuario/conductor. Se modela como tabla propia (no como un
-- valor de rol_usuario) para que las políticas RLS puedan otorgar acceso
-- total sin depender de un campo de usuario que nunca sería verdadero.
create table public.admins (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  nombre        text not null,
  creado_en     timestamptz not null default now()
);

alter table public.admins enable row level security;

create policy "admin_ve_su_propio_registro"
  on public.admins for select
  using (auth.uid() = auth_user_id);

-- security definer: permite evaluar membresía en admins sin que la propia
-- política RLS de "admins" bloquee la verificación (evita recursión).
create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admins a where a.auth_user_id = auth.uid()
  );
$$;

-- Trigger genérico reutilizado por todas las tablas con columna actualizado_en.
create or replace function public.set_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;
