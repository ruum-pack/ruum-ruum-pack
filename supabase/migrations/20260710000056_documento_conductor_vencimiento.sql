-- RT-02 — Permite que la misma RPC administrativa marque como vencido un
-- documento previamente aprobado. La migración 55 permanece inmutable.

create or replace function public.revisar_documento_conductor_admin(
  p_documento_id uuid,
  p_estado text,
  p_notas text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_conductor_id uuid; v_estado_expediente public.estado_expediente_conductor;
begin
  if not public.es_admin() then raise exception 'Acceso exclusivo de administradores.'; end if;
  if p_estado not in ('aprobado', 'rechazado', 'vencido') then
    raise exception 'Estado de revisión no permitido.';
  end if;
  if p_estado <> 'aprobado' and length(trim(coalesce(p_notas, ''))) < 5 then
    raise exception 'Escribe un motivo de al menos 5 caracteres.';
  end if;

  perform set_config('ruum.cambio_documento_autorizado', 'si', true);
  update public.documentos_conductor set
    estado = p_estado,
    notas_admin = case when p_estado = 'aprobado' then null else trim(p_notas) end,
    actualizado_en = now()
    where id = p_documento_id
      and estado = case when p_estado = 'vencido' then 'aprobado' else 'en_revision' end
    returning conductor_id into v_conductor_id;
  perform set_config('ruum.cambio_documento_autorizado', '', true);
  if v_conductor_id is null then raise exception 'Documento no encontrado o transición no permitida.'; end if;

  if p_estado = 'rechazado' then
    select estado_expediente into v_estado_expediente from public.conductores where id = v_conductor_id;
    if v_estado_expediente = 'en_revision' then
      perform public.cambiar_estado_expediente_conductor(v_conductor_id, 'requiere_correccion');
    end if;
  end if;
end;
$$;
