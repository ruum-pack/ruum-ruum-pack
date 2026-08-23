-- Fix: Prevenir recursion infinita en politicas RLS de traslados y usuarios (error 42P17)
-- Utiliza funciones SECURITY DEFINER con search_path aislado para evitar evaluaciones recursivas.

create or replace function public.usuario_id_actual()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select id from public.usuarios where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.conductor_id_actual()
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select id from public.conductores where auth_user_id = auth.uid() limit 1;
$$;

revoke all on function public.usuario_id_actual() from public;
grant execute on function public.usuario_id_actual() to authenticated;

revoke all on function public.conductor_id_actual() from public;
grant execute on function public.conductor_id_actual() to authenticated;

-- Actualizar politicas de traslados para usar las funciones security definer directas
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
