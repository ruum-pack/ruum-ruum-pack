-- Fase 6 — calificaciones, disputas y pasaporte post-cierre.
-- Los 5 tipos del PRD §4.14 ya existen desde 0011_disputas.sql. Esta
-- migración agrega la descripción operativa que la UI necesita y centraliza
-- la apertura de disputas para usuario/conductor en una función segura.

alter table public.disputas
  add column if not exists descripcion text not null default '',
  add column if not exists resolucion_detalle text;

create or replace function public.abrir_disputa_traslado(
  p_traslado_id uuid,
  p_abierta_por public.abierta_por_actor,
  p_tipo public.tipo_disputa,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_conductor_id uuid;
  v_traslado record;
  v_disputa_id uuid;
begin
  select id into v_usuario_id
  from public.usuarios
  where auth_user_id = auth.uid();

  select id into v_conductor_id
  from public.conductores
  where auth_user_id = auth.uid();

  select id, usuario_id, conductor_id, estado, actualizado_en
  into v_traslado
  from public.traslados
  where id = p_traslado_id
  for update;

  if v_traslado.id is null then
    raise exception 'Traslado no encontrado.';
  end if;

  if p_abierta_por = 'usuario' and (v_usuario_id is null or v_traslado.usuario_id <> v_usuario_id) then
    raise exception 'Solo el usuario del traslado puede abrir esta disputa.';
  end if;

  if p_abierta_por = 'conductor' and (v_conductor_id is null or v_traslado.conductor_id <> v_conductor_id) then
    raise exception 'Solo el conductor asignado puede abrir esta disputa.';
  end if;

  if extract(epoch from (now() - v_traslado.actualizado_en)) / 3600 > 72 then
    raise exception 'El plazo de 72 horas para abrir disputa ya venció.';
  end if;

  if length(trim(coalesce(p_descripcion, ''))) < 10 then
    raise exception 'La descripción de la disputa debe tener al menos 10 caracteres.';
  end if;

  insert into public.disputas (
    traslado_id,
    abierta_por,
    tipo,
    descripcion
  ) values (
    p_traslado_id,
    p_abierta_por,
    p_tipo,
    trim(p_descripcion)
  )
  returning id into v_disputa_id;

  if v_traslado.estado in ('servicio_cerrado', 'reclamo_resuelto', 'cierre_operativo_con_incidencia_abierta') then
    update public.traslados
    set estado = 'disputa_abierta'
    where id = p_traslado_id;
  end if;

  insert into public.registro_auditoria (
    traslado_id,
    evento,
    actor,
    actor_id,
    datos
  ) values (
    p_traslado_id,
    'apertura_disputa',
    p_abierta_por::text::public.actor_auditoria,
    coalesce(v_usuario_id, v_conductor_id),
    jsonb_build_object(
      'disputa_id', v_disputa_id,
      'tipo', p_tipo,
      'estado_anterior', v_traslado.estado,
      'estado_nuevo', case
        when v_traslado.estado in ('servicio_cerrado', 'reclamo_resuelto', 'cierre_operativo_con_incidencia_abierta')
          then 'disputa_abierta'
        else v_traslado.estado::text
      end
    )
  );

  return v_disputa_id;
end;
$$;

revoke all on function public.abrir_disputa_traslado(uuid, public.abierta_por_actor, public.tipo_disputa, text) from public;
grant execute on function public.abrir_disputa_traslado(uuid, public.abierta_por_actor, public.tipo_disputa, text) to authenticated;
