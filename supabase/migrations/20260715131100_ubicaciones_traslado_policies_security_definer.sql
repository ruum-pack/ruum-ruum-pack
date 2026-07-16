-- RT-33 ajuste -- Las politicas de ubicacion no deben depender de grants
-- directos sobre traslados/usuarios/conductores para evaluar pertenencia.

create or replace function public.auth_es_conductor_de_traslado(p_traslado_id uuid, p_conductor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.traslados t
    join public.conductores c on c.id = t.conductor_id
    where t.id = p_traslado_id
      and c.id = p_conductor_id
      and c.auth_user_id = auth.uid()
  );
$$;

create or replace function public.auth_es_conductor_de_traslado_activo(p_traslado_id uuid, p_conductor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.traslados t
    join public.conductores c on c.id = t.conductor_id
    where t.id = p_traslado_id
      and c.id = p_conductor_id
      and c.auth_user_id = auth.uid()
      and t.estado not in ('servicio_cerrado', 'servicio_cancelado', 'traslado_fallido')
  );
$$;

create or replace function public.auth_es_usuario_de_traslado(p_traslado_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.traslados t
    join public.usuarios u on u.id = t.usuario_id
    where t.id = p_traslado_id
      and u.auth_user_id = auth.uid()
  );
$$;

drop policy if exists "conductor_registra_ubicacion_de_su_traslado" on public.ubicaciones_traslado;
drop policy if exists "conductor_lee_ubicaciones_de_su_traslado" on public.ubicaciones_traslado;
drop policy if exists "usuario_lee_ubicaciones_de_sus_traslados" on public.ubicaciones_traslado;

create policy "conductor_registra_ubicacion_de_su_traslado"
  on public.ubicaciones_traslado for insert
  with check (public.auth_es_conductor_de_traslado_activo(traslado_id, conductor_id));

create policy "conductor_lee_ubicaciones_de_su_traslado"
  on public.ubicaciones_traslado for select
  using (public.auth_es_conductor_de_traslado(traslado_id, conductor_id));

create policy "usuario_lee_ubicaciones_de_sus_traslados"
  on public.ubicaciones_traslado for select
  using (public.auth_es_usuario_de_traslado(traslado_id));

grant execute on function public.auth_es_conductor_de_traslado(uuid, uuid) to authenticated;
grant execute on function public.auth_es_conductor_de_traslado_activo(uuid, uuid) to authenticated;
grant execute on function public.auth_es_usuario_de_traslado(uuid) to authenticated;
