-- Fix: Prevenir recursion infinita en politicas RLS de traslados y usuarios (error 42P17)
-- Utiliza funciones PL/PGSQL SECURITY DEFINER con search_path aislado para evitar inlining y evaluaciones recursivas.

-- 1. Helper para obtener usuario_id actual
create or replace function public.usuario_id_actual()
returns uuid
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.usuarios
  where auth_user_id = auth.uid()
  limit 1;
  return v_id;
end;
$$;

-- 2. Helper para obtener conductor_id actual
create or replace function public.conductor_id_actual()
returns uuid
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.conductores
  where auth_user_id = auth.uid()
  limit 1;
  return v_id;
end;
$$;

-- 3. Helper para empresa del titular actual
create or replace function public.empresa_id_del_titular_actual()
returns uuid
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id
  from public.usuarios
  where auth_user_id = auth.uid() and rol = 'titular_empresa'
  limit 1;
  return v_empresa_id;
end;
$$;

-- 4. Helper para verificar si el titular es dueno de la empresa del usuario
create or replace function public.titular_es_dueno_de_empresa_de_usuario(p_usuario_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_match boolean;
begin
  if p_usuario_id is null then
    return false;
  end if;
  select exists (
    select 1
    from public.usuarios titular
    join public.usuarios solicitante on solicitante.empresa_id = titular.empresa_id
    where titular.auth_user_id = auth.uid()
      and titular.rol = 'titular_empresa'
      and titular.empresa_id is not null
      and solicitante.id = p_usuario_id
  ) into v_match;
  return coalesce(v_match, false);
end;
$$;

-- 5. Helper para admin
create or replace function public.es_admin()
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_es_admin boolean;
begin
  select exists (
    select 1 from public.admins a where a.auth_user_id = auth.uid()
  ) into v_es_admin;
  return coalesce(v_es_admin, false);
end;
$$;

-- Otorgar permisos de ejecucion a authenticated
revoke all on function public.usuario_id_actual() from public;
grant execute on function public.usuario_id_actual() to authenticated;

revoke all on function public.conductor_id_actual() from public;
grant execute on function public.conductor_id_actual() to authenticated;

revoke all on function public.empresa_id_del_titular_actual() from public;
grant execute on function public.empresa_id_del_titular_actual() to authenticated;

revoke all on function public.titular_es_dueno_de_empresa_de_usuario(uuid) from public;
grant execute on function public.titular_es_dueno_de_empresa_de_usuario(uuid) to authenticated;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

-- Actualizar politicas de usuarios
drop policy if exists "titular_ve_usuarios_de_su_empresa" on public.usuarios;
create policy "titular_ve_usuarios_de_su_empresa"
  on public.usuarios for select
  to authenticated
  using (
    empresa_id is not null
    and empresa_id = public.empresa_id_del_titular_actual()
  );

-- Actualizar politicas de traslados
drop policy if exists "usuario_ve_sus_traslados" on public.traslados;
create policy "usuario_ve_sus_traslados"
  on public.traslados for select
  to authenticated
  using (usuario_id = public.usuario_id_actual());

drop policy if exists "usuario_crea_sus_traslados" on public.traslados;
create policy "usuario_crea_sus_traslados"
  on public.traslados for insert
  to authenticated
  with check (usuario_id = public.usuario_id_actual());

drop policy if exists "conductor_ve_sus_traslados_asignados" on public.traslados;
create policy "conductor_ve_sus_traslados_asignados"
  on public.traslados for select
  to authenticated
  using (conductor_id = public.conductor_id_actual());

drop policy if exists "conductor_actualiza_sus_traslados_asignados" on public.traslados;
create policy "conductor_actualiza_sus_traslados_asignados"
  on public.traslados for update
  to authenticated
  using (conductor_id = public.conductor_id_actual());

drop policy if exists "titular_ve_traslados_de_empresa" on public.traslados;
create policy "titular_ve_traslados_de_empresa"
  on public.traslados for select
  to authenticated
  using (
    public.titular_es_dueno_de_empresa_de_usuario(traslados.usuario_id)
  );
