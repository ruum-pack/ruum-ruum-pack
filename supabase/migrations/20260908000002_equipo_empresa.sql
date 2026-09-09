-- FASE 2 — Nuevo modelo empresarial: sin límite de 2 usuarios por empresa.
-- Organization del plan = empresas. Convención español como Fase 1 (operaciones).
-- 2.6: se elimina el trigger validar_limite_empresa (máximo un titular + un
-- autorizado). Los roles legacy de usuarios (titular_empresa/usuario_autorizado)
-- se conservan por compatibilidad; la autoridad pasa a empresa_miembros.
-- 2.7/2.8: backfill idempotente titular->owner, autorizado->admin.

-- 2.3 — catálogo de roles del plan
create table public.empresa_roles (
  clave       text primary key,
  nombre      text not null,
  descripcion text,
  es_sistema  boolean not null default true
);

insert into public.empresa_roles (clave, nombre, descripcion) values
  ('owner', 'Owner', 'Dueño de la empresa: control total, último responsable.'),
  ('admin', 'Administrador', 'Administra equipo, operaciones y facturación.'),
  ('operations_manager', 'Operations Manager', 'Gestiona operaciones, traslados y sucursales.'),
  ('dispatcher', 'Dispatcher', 'Crea traslados y asigna conductores.'),
  ('finance', 'Finanzas', 'Ve y gestiona facturación y reportes.'),
  ('viewer', 'Viewer', 'Solo lectura operativa.');

-- 2.4 — permisos por rol (fuente de verdad; espejo legible en
-- packages/shared/src/types/empresa-equipo.ts)
create table public.empresa_rol_permisos (
  rol_clave text not null references public.empresa_roles(clave) on delete cascade,
  permiso   text not null,
  primary key (rol_clave, permiso)
);

insert into public.empresa_rol_permisos (rol_clave, permiso) values
  -- owner: todo
  ('owner','operation:create'),('owner','operation:view'),('owner','operation:update'),
  ('owner','transfer:create'),('owner','transfer:view'),('owner','transfer:cancel'),
  ('owner','driver:view'),('owner','driver:assign'),
  ('owner','billing:view'),('owner','billing:manage'),
  ('owner','reports:view'),
  ('owner','team:manage'),
  ('owner','location:view'),('owner','location:manage'),
  -- admin: todo operativo + equipo + facturación
  ('admin','operation:create'),('admin','operation:view'),('admin','operation:update'),
  ('admin','transfer:create'),('admin','transfer:view'),('admin','transfer:cancel'),
  ('admin','driver:view'),('admin','driver:assign'),
  ('admin','billing:view'),('admin','billing:manage'),
  ('admin','reports:view'),
  ('admin','team:manage'),
  ('admin','location:view'),('admin','location:manage'),
  -- operations_manager
  ('operations_manager','operation:create'),('operations_manager','operation:view'),('operations_manager','operation:update'),
  ('operations_manager','transfer:create'),('operations_manager','transfer:view'),('operations_manager','transfer:cancel'),
  ('operations_manager','driver:view'),('operations_manager','driver:assign'),
  ('operations_manager','reports:view'),
  ('operations_manager','location:view'),('operations_manager','location:manage'),
  -- dispatcher
  ('dispatcher','operation:view'),
  ('dispatcher','transfer:create'),('dispatcher','transfer:view'),
  ('dispatcher','driver:view'),('dispatcher','driver:assign'),
  ('dispatcher','location:view'),
  -- finance
  ('finance','operation:view'),('finance','transfer:view'),
  ('finance','billing:view'),('finance','billing:manage'),
  ('finance','reports:view'),
  -- viewer
  ('viewer','operation:view'),('viewer','transfer:view'),
  ('viewer','driver:view'),('viewer','billing:view'),
  ('viewer','reports:view'),('viewer','location:view');

-- 2.2/2.5 — membresías: un usuario puede pertenecer a N empresas con N roles
create table public.empresa_miembros (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  usuario_id    uuid not null references public.usuarios(id) on delete cascade,
  rol_clave     text not null references public.empresa_roles(clave) on delete restrict,
  estado        text not null default 'activo'
    constraint empresa_miembros_estado_check
    check (estado in ('activo','invitado','suspendido')),
  invitado_por  uuid references public.usuarios(id) on delete set null,
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint empresa_miembros_una_por_empresa unique (empresa_id, usuario_id)
);

create trigger empresa_miembros_actualizado_en
  before update on public.empresa_miembros
  for each row execute function public.set_actualizado_en();

create index empresa_miembros_empresa_idx on public.empresa_miembros (empresa_id);
create index empresa_miembros_usuario_idx on public.empresa_miembros (usuario_id);

-- 2.9/2.10 — sucursales / centros operativos
create table public.empresa_sucursales (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nombre          text not null,
  es_principal    boolean not null default false,
  activo          boolean not null default true,
  calle           text,
  numero          text,
  colonia         text,
  codigo_postal   text,
  estado          text,
  ciudad          text,
  direccion       text,
  referencias     text,
  lat             numeric(10,7),
  lng             numeric(10,7),
  contacto_nombre text,
  contacto_telefono text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

create trigger empresa_sucursales_actualizado_en
  before update on public.empresa_sucursales
  for each row execute function public.set_actualizado_en();

create index empresa_sucursales_empresa_idx on public.empresa_sucursales (empresa_id);

-- 2.6 — eliminar el límite de 2 usuarios (trigger + función legacy)
drop trigger if exists usuarios_validar_limite_empresa on public.usuarios;
drop function if exists public.validar_limite_empresa();

-- 2.7/2.8 — backfill idempotente del modelo anterior al nuevo
insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
select u.empresa_id, u.id, 'owner', 'activo'
from public.usuarios u
where u.empresa_id is not null
  and u.rol = 'titular_empresa'
  and not exists (
    select 1 from public.empresa_miembros m
    where m.empresa_id = u.empresa_id and m.usuario_id = u.id
  );

insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
select u.empresa_id, u.id, 'admin', 'activo'
from public.usuarios u
where u.empresa_id is not null
  and u.rol = 'usuario_autorizado'
  and not exists (
    select 1 from public.empresa_miembros m
    where m.empresa_id = u.empresa_id and m.usuario_id = u.id
  );

-- 2.11/2.13 — helpers de autorización (security definer, sin recursión RLS)
create or replace function public.mis_empresas_miembro()
returns setof uuid
language sql
security definer
stable
as $$
  select m.empresa_id
  from public.empresa_miembros m
  join public.usuarios u on u.id = m.usuario_id
  where u.auth_user_id = auth.uid()
    and m.estado = 'activo';
$$;

create or replace function public.empresa_tiene_permiso(p_empresa_id uuid, p_permiso text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.empresa_miembros m
    join public.usuarios u on u.id = m.usuario_id
    join public.empresa_rol_permisos rp on rp.rol_clave = m.rol_clave
    where u.auth_user_id = auth.uid()
      and m.empresa_id = p_empresa_id
      and m.estado = 'activo'
      and rp.permiso = p_permiso
  );
$$;

-- 2.5 — gestión de membresías vía RPC auditable (solo team:manage o Torre)
create or replace function public.empresa_invitar_miembro(
  p_empresa_id uuid, p_usuario_id uuid, p_rol text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.empresa_roles where clave = p_rol) then
    raise exception 'Rol desconocido: %', p_rol;
  end if;

  if not public.es_admin()
     and not public.empresa_tiene_permiso(p_empresa_id, 'team:manage') then
    raise exception 'Sin permiso team:manage en la empresa %', p_empresa_id;
  end if;

  if not exists (select 1 from public.empresas where id = p_empresa_id) then
    raise exception 'Empresa no encontrada: %', p_empresa_id;
  end if;

  if not exists (select 1 from public.usuarios where id = p_usuario_id) then
    raise exception 'Usuario no encontrado: %', p_usuario_id;
  end if;

  insert into public.empresa_miembros (empresa_id, usuario_id, rol_clave, estado)
  values (p_empresa_id, p_usuario_id, p_rol, 'activo')
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'El usuario ya es miembro de la empresa %', p_empresa_id;
end;
$$;

create or replace function public.empresa_cambiar_rol_miembro(p_miembro_id uuid, p_rol text)
returns void
language plpgsql
security definer
as $$
declare
  v_empresa uuid;
  v_rol_actual text;
begin
  if not exists (select 1 from public.empresa_roles where clave = p_rol) then
    raise exception 'Rol desconocido: %', p_rol;
  end if;

  select empresa_id, rol_clave into v_empresa, v_rol_actual
  from public.empresa_miembros where id = p_miembro_id;

  if v_empresa is null then
    raise exception 'Membresía no encontrada: %', p_miembro_id;
  end if;

  if not public.es_admin()
     and not public.empresa_tiene_permiso(v_empresa, 'team:manage') then
    raise exception 'Sin permiso team:manage en la empresa %', v_empresa;
  end if;

  -- protege al último owner: no degradable
  if v_rol_actual = 'owner' and p_rol <> 'owner' then
    if (select count(*) from public.empresa_miembros
        where empresa_id = v_empresa and rol_clave = 'owner' and estado = 'activo') <= 1 then
      raise exception 'No se puede degradar al último owner de la empresa %', v_empresa;
    end if;
  end if;

  update public.empresa_miembros
  set rol_clave = p_rol
  where id = p_miembro_id;
end;
$$;

create or replace function public.empresa_remover_miembro(p_miembro_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_empresa uuid;
  v_rol text;
begin
  select empresa_id, rol_clave into v_empresa, v_rol
  from public.empresa_miembros where id = p_miembro_id;

  if v_empresa is null then
    raise exception 'Membresía no encontrada: %', p_miembro_id;
  end if;

  if not public.es_admin()
     and not public.empresa_tiene_permiso(v_empresa, 'team:manage') then
    raise exception 'Sin permiso team:manage en la empresa %', v_empresa;
  end if;

  if v_rol = 'owner'
     and (select count(*) from public.empresa_miembros
          where empresa_id = v_empresa and rol_clave = 'owner' and estado = 'activo') <= 1 then
    raise exception 'No se puede remover al último owner de la empresa %', v_empresa;
  end if;

  delete from public.empresa_miembros where id = p_miembro_id;
end;
$$;

-- 2.11 — RLS por membership
alter table public.empresa_roles enable row level security;
alter table public.empresa_rol_permisos enable row level security;
alter table public.empresa_miembros enable row level security;
alter table public.empresa_sucursales enable row level security;

-- catálogos legibles por cualquier usuario autenticado; escritura solo Torre
create policy "autenticado_lee_roles"
  on public.empresa_roles for select to authenticated using (true);
create policy "admin_gestiona_roles"
  on public.empresa_roles for all using (public.es_admin());

create policy "autenticado_lee_rol_permisos"
  on public.empresa_rol_permisos for select to authenticated using (true);
create policy "admin_gestiona_rol_permisos"
  on public.empresa_rol_permisos for all using (public.es_admin());

-- miembros: lectura entre compañeros + Torre total; escritura vía RPC/Torre
create policy "admin_acceso_total_miembros"
  on public.empresa_miembros for all using (public.es_admin());
create policy "miembros_ven_companeros"
  on public.empresa_miembros for select
  using (empresa_id in (select public.mis_empresas_miembro()));

-- sucursales: lectura por membresía; gestión con location:manage o Torre
create policy "admin_acceso_total_sucursales"
  on public.empresa_sucursales for all using (public.es_admin());
create policy "miembros_ven_sucursales"
  on public.empresa_sucursales for select
  using (empresa_id in (select public.mis_empresas_miembro()));
create policy "gestores_administran_sucursales"
  on public.empresa_sucursales for insert
  with check (public.empresa_tiene_permiso(empresa_id, 'location:manage'));
create policy "gestores_actualizan_sucursales"
  on public.empresa_sucursales for update
  using (public.empresa_tiene_permiso(empresa_id, 'location:manage'));
create policy "gestores_eliminan_sucursales"
  on public.empresa_sucursales for delete
  using (public.empresa_tiene_permiso(empresa_id, 'location:manage'));

-- empresas: los miembros activos ven su empresa (complementa titular_ve_su_empresa)
create policy "miembros_ven_su_empresa"
  on public.empresas for select
  using (id in (select public.mis_empresas_miembro()));

-- operaciones: los miembros ven las operaciones de su empresa
create policy "miembros_ven_operaciones_empresa"
  on public.operaciones for select
  using (empresa_id in (select public.mis_empresas_miembro()));

grant select on public.empresa_roles to authenticated;
grant select on public.empresa_rol_permisos to authenticated;
grant select, insert, update, delete on public.empresa_miembros to authenticated;
grant select, insert, update, delete on public.empresa_sucursales to authenticated;
grant all on public.empresa_roles to service_role;
grant all on public.empresa_rol_permisos to service_role;
grant all on public.empresa_miembros to service_role;
grant all on public.empresa_sucursales to service_role;
grant execute on function public.mis_empresas_miembro() to authenticated;
grant execute on function public.empresa_tiene_permiso(uuid, text) to authenticated;
grant execute on function public.empresa_invitar_miembro(uuid, uuid, text) to authenticated;
grant execute on function public.empresa_cambiar_rol_miembro(uuid, text) to authenticated;
grant execute on function public.empresa_remover_miembro(uuid) to authenticated;
