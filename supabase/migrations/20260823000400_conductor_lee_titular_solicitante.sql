-- Permite a los conductores asignados a un traslado leer los datos de contacto y nombre del titular solicitante en la tabla usuarios sin causar recursion infinita

create or replace function public.usuario_ids_de_traslados_asignados_conductor()
returns setof uuid
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
begin
  return query
  select t.usuario_id
  from public.traslados t
  join public.conductores c on c.id = t.conductor_id
  where c.auth_user_id = auth.uid()
    and t.usuario_id is not null;
end;
$$;

revoke all on function public.usuario_ids_de_traslados_asignados_conductor() from public;
grant execute on function public.usuario_ids_de_traslados_asignados_conductor() to authenticated;

drop policy if exists "conductor_asignado_ve_usuario_solicitante" on public.usuarios;

create policy "conductor_asignado_ve_usuario_solicitante"
  on public.usuarios for select
  to authenticated
  using (
    id in (select public.usuario_ids_de_traslados_asignados_conductor())
  );
