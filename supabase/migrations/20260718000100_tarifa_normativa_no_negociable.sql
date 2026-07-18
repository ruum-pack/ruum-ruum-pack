-- La operación no negocia tarifas: aplica la política vigente y auditable.
-- Se conserva la firma histórica admin_emite_cotizacion(uuid, numeric) por
-- compatibilidad, pero el monto recibido debe coincidir con la tarifa
-- normativa calculada por el servidor. Para nuevos clientes se expone
-- admin_aplica_tarifa_normativa(uuid), que ni siquiera recibe precio.

create or replace function public.admin_emite_cotizacion(p_traslado_id uuid, p_precio numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado public.estado_traslado;
  v_tarifa_normativa numeric;
begin
  if not public.es_admin() then raise exception 'Acceso denegado'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'La tarifa normativa debe ser mayor a cero'; end if;

  select estado into v_estado
  from public.traslados
  where id = p_traslado_id
  for update;

  if v_estado is null then raise exception 'Traslado no encontrado'; end if;
  if v_estado not in ('solicitud_creada', 'documentacion_pendiente', 'documentacion_en_revision', 'documentacion_validada', 'cotizacion_generada') then
    raise exception 'El traslado ya no admite una nueva cotización';
  end if;

  v_tarifa_normativa := public.admin_sugerir_tarifa_traslado(p_traslado_id);
  if v_tarifa_normativa is null then
    raise exception 'No se pudo calcular la tarifa normativa del traslado';
  end if;

  if round(p_precio, 2) <> round(v_tarifa_normativa, 2) then
    raise exception 'La cotización enviada (%) no coincide con la tarifa normativa vigente (%)', round(p_precio, 2), round(v_tarifa_normativa, 2);
  end if;

  update public.traslados
  set precio_cotizado = round(v_tarifa_normativa, 2),
      precio_final = null,
      cotizacion_expira_en = now() + interval '72 hours',
      estado = 'cotizacion_generada'
  where id = p_traslado_id;
end;
$$;

create or replace function public.admin_aplica_tarifa_normativa(p_traslado_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tarifa_normativa numeric;
begin
  if not public.es_admin() then raise exception 'Acceso denegado'; end if;

  v_tarifa_normativa := public.admin_sugerir_tarifa_traslado(p_traslado_id);
  if v_tarifa_normativa is null then
    raise exception 'No se pudo calcular la tarifa normativa del traslado';
  end if;

  perform public.admin_emite_cotizacion(p_traslado_id, v_tarifa_normativa);
  return round(v_tarifa_normativa, 2);
end;
$$;

revoke all on function public.admin_emite_cotizacion(uuid, numeric) from public;
grant execute on function public.admin_emite_cotizacion(uuid, numeric) to authenticated;

revoke all on function public.admin_aplica_tarifa_normativa(uuid) from public;
grant execute on function public.admin_aplica_tarifa_normativa(uuid) to authenticated;

comment on function public.admin_emite_cotizacion(uuid, numeric) is
  'Compatibilidad histórica: sólo acepta el monto si coincide con la tarifa normativa vigente calculada por servidor.';

comment on function public.admin_aplica_tarifa_normativa(uuid) is
  'Aplica la tarifa normativa vigente a un traslado y emite la cotización sin aceptar precios libres desde operación.';
