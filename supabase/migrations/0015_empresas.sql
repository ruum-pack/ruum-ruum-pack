-- PRD §3 — "Funciones empresariales: una empresa puede tener máximo dos
-- usuarios internos: titular y usuario autorizado." Las columnas
-- usuarios.empresa_id y usuarios.rol (titular_empresa / usuario_autorizado)
-- ya existían desde 0002/0001 anticipando esta tabla, pero sin FK real
-- (empresa_id era un uuid suelto). Esta migración cierra ese vacío.

create table public.empresas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create trigger empresas_actualizado_en
  before update on public.empresas
  for each row execute function public.set_actualizado_en();

-- Ahora que la tabla existe, la FK que usuarios.empresa_id debió tener desde
-- el principio (PRD §3, §4.1).
alter table public.usuarios
  add constraint usuarios_empresa_id_fkey
  foreign key (empresa_id) references public.empresas(id) on delete set null;

-- PRD §3 — máximo un titular_empresa y un usuario_autorizado por empresa
-- (dos en total). Igual que nivel_operativo_vigente (0003) y el recálculo
-- de calificación (0009): la app sigue siendo la fuente de verdad legible
-- (ver packages/shared/src/rules/limite-empresa.ts), pero la base de datos
-- también rechaza el caso aunque el bug esté en la aplicación. No se puede
-- expresar como CHECK simple porque depende de contar otras filas.
create or replace function public.validar_limite_empresa()
returns trigger
language plpgsql
as $$
declare
  v_conteo int;
begin
  if new.empresa_id is null or new.rol not in ('titular_empresa', 'usuario_autorizado') then
    return new;
  end if;

  select count(*) into v_conteo
  from public.usuarios
  where empresa_id = new.empresa_id
    and rol = new.rol
    and id <> new.id;

  if v_conteo >= 1 then
    raise exception 'La empresa % ya tiene un usuario con rol %', new.empresa_id, new.rol;
  end if;

  return new;
end;
$$;

create trigger usuarios_validar_limite_empresa
  before insert or update of empresa_id, rol on public.usuarios
  for each row execute function public.validar_limite_empresa();

alter table public.empresas enable row level security;

-- PRD §3 — el titular ve los datos de su propia empresa.
create policy "titular_ve_su_empresa"
  on public.empresas for select
  using (
    id in (
      select u.empresa_id from public.usuarios u
      where u.auth_user_id = auth.uid() and u.rol = 'titular_empresa'
    )
  );

create policy "admin_acceso_total_empresas"
  on public.empresas for all
  using (public.es_admin());
