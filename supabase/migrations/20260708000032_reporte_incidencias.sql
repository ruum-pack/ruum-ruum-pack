-- Reporte real de incidencias desde usuario/conductor y apertura automática
-- de daño no reportado por sistema.

create policy "usuario_reporta_incidencias_de_sus_traslados"
  on public.incidencias for insert
  with check (
    reportada_por = 'usuario'
    and traslado_id in (
      select t.id from public.traslados t
      join public.usuarios u on u.id = t.usuario_id
      where u.auth_user_id = auth.uid()
    )
  );

create or replace function public.marcar_traslado_con_incidencia_abierta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.traslados
  set tiene_incidencia_abierta = true
  where id = new.traslado_id;
  return new;
end;
$$;

drop trigger if exists incidencias_marcar_traslado_abierto on public.incidencias;
create trigger incidencias_marcar_traslado_abierto
  after insert on public.incidencias
  for each row execute function public.marcar_traslado_con_incidencia_abierta();

create or replace function public.crear_incidencia_sistema_dano_no_reportado(
  p_traslado_id uuid,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor_id uuid;
  v_incidencia_id uuid;
begin
  select id into v_conductor_id
  from public.conductores
  where auth_user_id = auth.uid();

  if v_conductor_id is null then
    raise exception 'Solo el conductor autenticado puede disparar esta revisión automática.';
  end if;

  if not exists (
    select 1 from public.traslados
    where id = p_traslado_id and conductor_id = v_conductor_id
  ) then
    raise exception 'El traslado no está asignado al conductor autenticado.';
  end if;

  insert into public.incidencias (
    traslado_id,
    tipo,
    momento,
    reportada_por,
    descripcion
  ) values (
    p_traslado_id,
    'dano_no_reportado',
    'entrega',
    'sistema',
    p_descripcion
  )
  returning id into v_incidencia_id;

  insert into public.registro_auditoria (
    traslado_id,
    evento,
    actor,
    actor_id,
    datos
  ) values (
    p_traslado_id,
    'reporte_incidencia',
    'sistema',
    '00000000-0000-0000-0000-000000000000',
    jsonb_build_object(
      'tipo', 'dano_no_reportado',
      'momento', 'entrega',
      'incidencia_id', v_incidencia_id
    )
  );

  return v_incidencia_id;
end;
$$;

revoke all on function public.crear_incidencia_sistema_dano_no_reportado(uuid, text) from public;
grant execute on function public.crear_incidencia_sistema_dano_no_reportado(uuid, text) to authenticated;
