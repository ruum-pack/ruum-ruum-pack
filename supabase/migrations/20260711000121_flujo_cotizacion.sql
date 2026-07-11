insert into public.estado_transiciones_validas (estado_actual, estado_siguiente) values
  ('solicitud_creada', 'cotizacion_generada'),
  ('documentacion_pendiente', 'cotizacion_generada'),
  ('documentacion_en_revision', 'cotizacion_generada'),
  ('cotizacion_generada', 'cotizacion_aceptada'), ('cotizacion_aceptada', 'servicio_confirmado'),
  ('cotizacion_aceptada', 'servicio_cancelado') on conflict do nothing;

create or replace function public.admin_emite_cotizacion(p_traslado_id uuid, p_precio numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_estado public.estado_traslado;
begin
  if not public.es_admin() then raise exception 'Acceso denegado'; end if;
  if p_precio is null or p_precio <= 0 then raise exception 'La cotización debe ser mayor a cero'; end if;
  select estado into v_estado from public.traslados where id = p_traslado_id for update;
  if v_estado is null then raise exception 'Traslado no encontrado'; end if;
  if v_estado not in ('solicitud_creada', 'documentacion_pendiente', 'documentacion_en_revision', 'documentacion_validada', 'cotizacion_generada') then
    raise exception 'El traslado ya no admite una nueva cotización';
  end if;
  update public.traslados set precio_cotizado = p_precio, precio_final = null,
    cotizacion_expira_en = now() + interval '72 hours', estado = 'cotizacion_generada' where id = p_traslado_id;
end; $$;

create or replace function public.usuario_acepta_cotizacion(p_traslado_id uuid)
returns public.estado_traslado language plpgsql security definer set search_path = public as $$
declare v_traslado public.traslados%rowtype; v_usuario_id uuid; v_siguiente public.estado_traslado;
begin
  select id into v_usuario_id from public.usuarios where auth_user_id = auth.uid();
  if v_usuario_id is null then raise exception 'Usuario no encontrado'; end if;
  select * into v_traslado from public.traslados where id = p_traslado_id and usuario_id = v_usuario_id for update;
  if v_traslado.id is null then raise exception 'Traslado no encontrado'; end if;
  if v_traslado.estado <> 'cotizacion_generada' then raise exception 'La cotización no está disponible para aceptación'; end if;
  if coalesce(v_traslado.precio_cotizado, 0) <= 0 then raise exception 'El traslado todavía no cuenta con una cotización válida'; end if;
  if v_traslado.cotizacion_expira_en is null or v_traslado.cotizacion_expira_en <= now() then raise exception 'La cotización ha vencido'; end if;
  v_siguiente := case when v_traslado.tipo_pago = 'anticipado' then 'cotizacion_aceptada' else 'servicio_confirmado' end;
  update public.traslados set estado = v_siguiente where id = p_traslado_id;
  return v_siguiente;
end; $$;

revoke all on function public.admin_emite_cotizacion(uuid, numeric) from public;
grant execute on function public.admin_emite_cotizacion(uuid, numeric) to authenticated;
revoke all on function public.usuario_acepta_cotizacion(uuid) from public;
grant execute on function public.usuario_acepta_cotizacion(uuid) to authenticated;
