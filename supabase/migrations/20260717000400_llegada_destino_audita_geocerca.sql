-- Autorización administrativa por permisos.
-- Esta migración reemplaza políticas administrativas generales
-- por permisos específicos según el rol operativo.

-- ============================================================
-- 1. FUNCIÓN CENTRAL DE PERMISOS
-- ============================================================
-- ============================================================
-- 0. ASEGURAR ROL OPERATIVO EN ADMINS
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n
      on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'rol_admin_operativo'
  ) then
    create type public.rol_admin_operativo as enum (
      'operador',
      'supervisor',
      'finanzas',
      'compliance',
      'direccion'
    );
  end if;
end
$$;

alter table public.admins
  add column if not exists rol_operativo
  public.rol_admin_operativo
  not null
  default 'operador';

comment on column public.admins.rol_operativo is
  'Rol operativo utilizado para autorización administrativa.';
  create or replace function public.admin_tiene_permiso(
  p_permiso text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admins as a
    where a.auth_user_id = auth.uid()
      and case a.rol_operativo
        when 'operador' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'viajes.leer',
              'viajes.gestionar',
              'masivos.gestionar',
              'conductores.leer',
              'incidencias.leer'
            ]::text[]
          )

        when 'supervisor' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'viajes.leer',
              'viajes.gestionar',
              'masivos.gestionar',
              'conductores.leer',
              'conductores.validar',
              'incidencias.leer',
              'disputas.leer',
              'disputas.resolver'
            ]::text[]
          )

        when 'finanzas' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'viajes.leer',
              'pagos.leer',
              'tarifas.leer',
              'tarifas.editar',
              'disputas.leer',
              'disputas.resolver',
              'reclamos_seguro.leer',
              'reclamos_seguro.gestionar'
            ]::text[]
          )

        when 'compliance' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'conductores.leer',
              'conductores.validar',
              'usuarios.leer',
              'usuarios.validar',
              'empresas.leer',
              'empresas.gestionar',
              'incidencias.leer',
              'reclamos_seguro.leer',
              'reclamos_seguro.gestionar'
            ]::text[]
          )

        when 'direccion' then
          true

        else
          false
      end
  );
$$;

revoke all
  on function public.admin_tiene_permiso(text)
  from public;

grant execute
  on function public.admin_tiene_permiso(text)
  to authenticated;
  
create or replace function public.admin_tiene_permiso(
  p_permiso text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admins as a
    where a.auth_user_id = auth.uid()
      and case a.rol_operativo
        when 'operador' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'viajes.leer',
              'viajes.gestionar',
              'masivos.gestionar',
              'conductores.leer',
              'incidencias.leer'
            ]::text[]
          )

        when 'supervisor' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'viajes.leer',
              'viajes.gestionar',
              'masivos.gestionar',
              'conductores.leer',
              'conductores.validar',
              'incidencias.leer',
              'disputas.leer',
              'disputas.resolver'
            ]::text[]
          )

        when 'finanzas' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'viajes.leer',
              'pagos.leer',
              'tarifas.leer',
              'tarifas.editar',
              'disputas.leer',
              'disputas.resolver',
              'reclamos_seguro.leer',
              'reclamos_seguro.gestionar'
            ]::text[]
          )

        when 'compliance' then
          p_permiso = any (
            array[
              'dashboard.leer',
              'conductores.leer',
              'conductores.validar',
              'usuarios.leer',
              'usuarios.validar',
              'empresas.leer',
              'empresas.gestionar',
              'incidencias.leer',
              'reclamos_seguro.leer',
              'reclamos_seguro.gestionar'
            ]::text[]
          )

        when 'direccion' then
          true

        else
          false
      end
  );
$$;

revoke all
  on function public.admin_tiene_permiso(text)
  from public;

grant execute
  on function public.admin_tiene_permiso(text)
  to authenticated;

comment on function public.admin_tiene_permiso(text) is
  'Comprueba si el administrador autenticado posee un permiso operativo.';


-- ============================================================
-- 2. USUARIOS
-- ============================================================

drop policy if exists
  "admin_acceso_total_usuarios"
  on public.usuarios;

drop policy if exists
  "admin_lee_usuarios_por_permiso"
  on public.usuarios;

drop policy if exists
  "admin_actualiza_usuarios_por_permiso"
  on public.usuarios;

create policy "admin_lee_usuarios_por_permiso"
  on public.usuarios
  for select
  to authenticated
  using (
    public.admin_tiene_permiso('usuarios.leer'::text)
  );

create policy "admin_actualiza_usuarios_por_permiso"
  on public.usuarios
  for update
  to authenticated
  using (
    public.admin_tiene_permiso('usuarios.validar'::text)
  )
  with check (
    public.admin_tiene_permiso('usuarios.validar'::text)
  );


-- ============================================================
-- 3. PAGOS
-- ============================================================

drop policy if exists
  "admin_acceso_total_pagos"
  on public.pagos;

drop policy if exists
  "admin_lee_pagos_por_permiso"
  on public.pagos;

create policy "admin_lee_pagos_por_permiso"
  on public.pagos
  for select
  to authenticated
  using (
    public.admin_tiene_permiso('pagos.leer'::text)
  );


-- ============================================================
-- 4. EMPRESAS
-- ============================================================

drop policy if exists
  "admin_acceso_total_empresas"
  on public.empresas;

drop policy if exists
  "admin_lee_empresas_por_permiso"
  on public.empresas;

drop policy if exists
  "admin_inserta_empresas_por_permiso"
  on public.empresas;

drop policy if exists
  "admin_actualiza_empresas_por_permiso"
  on public.empresas;

create policy "admin_lee_empresas_por_permiso"
  on public.empresas
  for select
  to authenticated
  using (
    public.admin_tiene_permiso('empresas.leer'::text)
  );

create policy "admin_inserta_empresas_por_permiso"
  on public.empresas
  for insert
  to authenticated
  with check (
    public.admin_tiene_permiso('empresas.gestionar'::text)
  );

create policy "admin_actualiza_empresas_por_permiso"
  on public.empresas
  for update
  to authenticated
  using (
    public.admin_tiene_permiso('empresas.gestionar'::text)
  )
  with check (
    public.admin_tiene_permiso('empresas.gestionar'::text)
  );


-- ============================================================
-- 5. DISPUTAS
-- ============================================================

drop policy if exists
  "admin_acceso_total_disputas"
  on public.disputas;

drop policy if exists
  "admin_lee_disputas_por_permiso"
  on public.disputas;

drop policy if exists
  "admin_actualiza_disputas_por_permiso"
  on public.disputas;

create policy "admin_lee_disputas_por_permiso"
  on public.disputas
  for select
  to authenticated
  using (
    public.admin_tiene_permiso('disputas.leer'::text)
  );

create policy "admin_actualiza_disputas_por_permiso"
  on public.disputas
  for update
  to authenticated
  using (
    public.admin_tiene_permiso('disputas.resolver'::text)
  )
  with check (
    public.admin_tiene_permiso('disputas.resolver'::text)
  );


-- ============================================================
-- 6. RECLAMOS DE SEGURO
-- ============================================================

drop policy if exists
  "admin_acceso_total_reclamos_seguro"
  on public.reclamos_seguro;

drop policy if exists
  "admin_lee_reclamos_seguro_por_permiso"
  on public.reclamos_seguro;

drop policy if exists
  "admin_actualiza_reclamos_seguro_por_permiso"
  on public.reclamos_seguro;

create policy "admin_lee_reclamos_seguro_por_permiso"
  on public.reclamos_seguro
  for select
  to authenticated
  using (
    public.admin_tiene_permiso('reclamos_seguro.leer'::text)
  );

create policy "admin_actualiza_reclamos_seguro_por_permiso"
  on public.reclamos_seguro
  for update
  to authenticated
  using (
    public.admin_tiene_permiso(
      'reclamos_seguro.gestionar'::text
    )
  )
  with check (
    public.admin_tiene_permiso(
      'reclamos_seguro.gestionar'::text
    )
  );


-- ============================================================
-- 7. TABLAS TARIFARIAS VIGENTES
-- ============================================================
-- No se usa public.tarifas_admin porque esa tabla fue eliminada
-- por la migración del modelo tarifario v2.

do $$
declare
  nombre_tabla text;
  politica_anterior text;
  politica_lectura text;
  politica_escritura text;
begin
  foreach nombre_tabla in array array[
    'tarifas_vehiculo',
    'tarifas_gama',
    'tarifas_condicion',
    'tarifas_horario',
    'tarifas_dia',
    'tarifas_config',
    'certificacion_pago_conductor'
  ]::text[]
  loop
    if to_regclass(
      format('public.%I', nombre_tabla)
    ) is null then
      raise exception
        'Falta la tabla public.% antes de aplicar permisos administrativos',
        nombre_tabla;
    end if;

    politica_anterior :=
      case
        when nombre_tabla = 'certificacion_pago_conductor'
          then 'admin_acceso_total_certificacion_pago'
        else
          'admin_acceso_total_' || nombre_tabla
      end;

    politica_lectura :=
      'admin_lee_' || nombre_tabla || '_por_permiso';

    politica_escritura :=
      'admin_escribe_' || nombre_tabla || '_por_permiso';

    execute format(
      'drop policy if exists %I on public.%I',
      politica_anterior,
      nombre_tabla
    );

    execute format(
      'drop policy if exists %I on public.%I',
      politica_lectura,
      nombre_tabla
    );

    execute format(
      'drop policy if exists %I on public.%I',
      politica_escritura,
      nombre_tabla
    );

    execute format(
      'create policy %I
       on public.%I
       for select
       to authenticated
       using (
         public.admin_tiene_permiso(%L::text)
       )',
      politica_lectura,
      nombre_tabla,
      'tarifas.leer'
    );

    execute format(
      'create policy %I
       on public.%I
       for all
       to authenticated
       using (
         public.admin_tiene_permiso(%L::text)
       )
       with check (
         public.admin_tiene_permiso(%L::text)
       )',
      politica_escritura,
      nombre_tabla,
      'tarifas.editar',
      'tarifas.editar'
    );
  end loop;
end
$$;


-- ============================================================
-- 8. CONDUCTORES
-- ============================================================

drop policy if exists
  "admin_acceso_total_conductores"
  on public.conductores;

drop policy if exists
  "admin_lee_conductores_por_permiso"
  on public.conductores;

drop policy if exists
  "admin_actualiza_conductores_por_permiso"
  on public.conductores;

create policy "admin_lee_conductores_por_permiso"
  on public.conductores
  for select
  to authenticated
  using (
    public.admin_tiene_permiso('conductores.leer'::text)
  );

create policy "admin_actualiza_conductores_por_permiso"
  on public.conductores
  for update
  to authenticated
  using (
    public.admin_tiene_permiso('conductores.validar'::text)
  )
  with check (
    public.admin_tiene_permiso('conductores.validar'::text)
  );