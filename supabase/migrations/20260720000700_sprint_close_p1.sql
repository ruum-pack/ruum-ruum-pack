-- Sprint CLOSE P1: respuesta parcial explícita para telemetría por lote.
create or replace function public.registrar_telemetria_lote(p_traslado_id uuid, p_puntos jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conductor_id uuid; v_estado text; v_punto jsonb; v_id uuid; v_device_ts timestamptz; v_local_id uuid;
  v_lat numeric; v_lng numeric; v_precision numeric; v_velocidad numeric; v_direccion numeric; v_altitud numeric;
  v_bateria integer; v_online boolean; v_fuente text; v_estado_punto text;
  v_aceptados jsonb := '[]'::jsonb; v_duplicados_ids jsonb := '[]'::jsonb; v_rechazados_perm jsonb := '[]'::jsonb;
  v_insertados int := 0; v_duplicados int := 0; v_rechazados int := 0; v_razon text;
begin
  if jsonb_typeof(p_puntos) <> 'array' or jsonb_array_length(p_puntos) not between 1 and 100 then
    raise exception using errcode='22023', message='El lote debe contener entre 1 y 100 puntos';
  end if;
  select t.conductor_id,t.estado::text into v_conductor_id,v_estado from public.traslados t
  join public.conductores c on c.id=t.conductor_id where t.id=p_traslado_id and c.auth_user_id=auth.uid()
  and t.estado::text not in ('servicio_cerrado','servicio_cancelado','traslado_fallido');
  if v_conductor_id is null then raise exception using errcode='42501', message='El conductor no está autorizado para registrar este traslado'; end if;

  for v_punto in select value from jsonb_array_elements(p_puntos) loop
    v_razon := null;
    begin
      v_local_id := nullif(v_punto->>'localId','')::uuid; v_lat := (v_punto->>'lat')::numeric; v_lng := (v_punto->>'lng')::numeric;
      v_precision := nullif(v_punto->>'precisionM','')::numeric; v_velocidad := nullif(v_punto->>'velocidadMps','')::numeric;
      v_direccion := nullif(v_punto->>'direccionGrados','')::numeric; v_altitud := nullif(v_punto->>'altitudM','')::numeric;
      v_bateria := nullif(v_punto->>'bateriaPct','')::integer; v_online := nullif(v_punto->>'online','')::boolean;
      v_device_ts := (v_punto->>'deviceTimestamp')::timestamptz; v_fuente := left(coalesce(nullif(v_punto->>'fuente',''),'android_foreground_service'),64);
      v_estado_punto := left(coalesce(nullif(v_punto->>'estadoViaje',''),v_estado),64);
      if v_local_id is null then v_razon:='local_id_invalido';
      elsif v_lat not between -90 and 90 or v_lng not between -180 and 180 then v_razon:='coordenadas_fuera_de_rango';
      elsif v_device_ts < now()-interval '24 hours' or v_device_ts > now()+interval '10 minutes' then v_razon:='timestamp_fuera_de_rango';
      elsif v_precision is not null and v_precision not between 0 and 10000 then v_razon:='precision_fuera_de_rango';
      elsif v_velocidad is not null and v_velocidad not between 0 and 120 then v_razon:='velocidad_fuera_de_rango';
      elsif v_direccion is not null and v_direccion not between 0 and 360 then v_razon:='direccion_fuera_de_rango';
      elsif v_bateria is not null and v_bateria not between 0 and 100 then v_razon:='bateria_fuera_de_rango'; end if;
      if v_razon is not null then
        v_rechazados:=v_rechazados+1; v_rechazados_perm:=v_rechazados_perm||jsonb_build_array(jsonb_build_object('localId',v_punto->>'localId','razon',v_razon)); continue;
      end if;
      insert into public.ubicaciones_traslado(traslado_id,conductor_id,local_id,lat,lng,precision_m,velocidad_mps,direccion_grados,altitud_m,dispositivo_timestamp,servidor_timestamp,estado_viaje,fuente,bateria_pct,online,registrado_en)
      values(p_traslado_id,v_conductor_id,v_local_id,v_lat,v_lng,v_precision,v_velocidad,v_direccion,v_altitud,v_device_ts,now(),v_estado_punto,v_fuente,v_bateria,v_online,now())
      on conflict(traslado_id,local_id) where local_id is not null do nothing returning id into v_id;
      if v_id is null then v_duplicados:=v_duplicados+1; v_duplicados_ids:=v_duplicados_ids||to_jsonb(v_local_id::text);
      else v_insertados:=v_insertados+1; v_aceptados:=v_aceptados||to_jsonb(v_local_id::text);
        insert into public.tracking_salud_traslado(traslado_id,conductor_id,ultimo_punto_id,ultima_ubicacion_en,ultimo_envio_en,fuente,online,precision_m,actualizado_en)
        values(p_traslado_id,v_conductor_id,v_id,v_device_ts,now(),v_fuente,v_online,v_precision,now()) on conflict(traslado_id) do update set conductor_id=excluded.conductor_id,ultimo_punto_id=excluded.ultimo_punto_id,ultima_ubicacion_en=excluded.ultima_ubicacion_en,ultimo_envio_en=excluded.ultimo_envio_en,fuente=excluded.fuente,online=excluded.online,precision_m=excluded.precision_m,actualizado_en=now();
      end if; v_id:=null;
    exception when others then
      v_rechazados:=v_rechazados+1; v_rechazados_perm:=v_rechazados_perm||jsonb_build_array(jsonb_build_object('localId',v_punto->>'localId','razon','payload_invalido')); v_id:=null;
    end;
  end loop;
  return jsonb_build_object('insertados',v_insertados,'duplicados',v_duplicados,'rechazados',v_rechazados,'recibidos',jsonb_array_length(p_puntos),'aceptados',v_aceptados,'duplicadosIds',v_duplicados_ids,'rechazadosPermanentes',v_rechazados_perm);
end $$;
revoke all on function public.registrar_telemetria_lote(uuid,jsonb) from public;
grant execute on function public.registrar_telemetria_lote(uuid,jsonb) to authenticated;
