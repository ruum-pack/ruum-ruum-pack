-- RT-08 a RT-10 — Inicio idempotente, guardado de borrador y envío atómico.

create or replace function public.solicitud_conductor_datos_completos(p_solicitud_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(btrim(datos_personales->>'nombre'),'') is not null
    and nullif(btrim(datos_personales->>'telefono'),'') is not null
    and nullif(btrim(datos_personales->>'curp'),'') is not null
    and nullif(btrim(domicilio->>'codigo_postal'),'') is not null
    and nullif(btrim(domicilio->>'estado'),'') is not null
    and nullif(btrim(domicilio->>'ciudad_municipio'),'') is not null
    and nullif(btrim(domicilio->>'colonia'),'') is not null
    and nullif(btrim(domicilio->>'calle'),'') is not null
    and nullif(btrim(domicilio->>'numero'),'') is not null
    and nullif(btrim(licencia->>'numero'),'') is not null
    and nullif(btrim(licencia->>'tipo'),'') is not null
    and nullif(btrim(licencia->>'vigencia'),'') is not null
    and nullif(btrim(contacto_emergencia->>'nombre'),'') is not null
    and nullif(btrim(contacto_emergencia->>'telefono'),'') is not null
    and coalesce((datos_personales->>'autoriza_verificacion_antecedentes')::boolean,false)
    and coalesce((datos_personales->>'declara_sin_suspensiones')::boolean,false)
    and coalesce((datos_personales->>'acepta_terminos_privacidad')::boolean,false)
    and coalesce((datos_personales->>'version_terminos_aceptada')::integer,0)>0
    and nullif(datos_personales->>'terminos_aceptados_en','') is not null,
    false
  ) from public.solicitudes_conductor where id=p_solicitud_id;
$$;
revoke all on function public.solicitud_conductor_datos_completos(uuid) from public,anon,authenticated;

create or replace function public.iniciar_solicitud_conductor()
returns table(
  solicitud_id uuid,
  conductor_id uuid,
  estado public.estado_expediente_conductor,
  paso_actual smallint
) language plpgsql security definer set search_path = public,auth as $$
declare v_auth uuid:=auth.uid(); v_solicitud public.solicitudes_conductor; v_conductor uuid; v_confirmado boolean;
begin
  if v_auth is null then raise exception 'Inicia sesión para comenzar tu solicitud.'; end if;
  perform pg_advisory_xact_lock(hashtext('iniciar_solicitud:'||v_auth::text));
  select c.id into v_conductor from public.conductores c where c.auth_user_id=v_auth;
  select s.* into v_solicitud from public.solicitudes_conductor s
    where s.auth_user_id=v_auth and s.estado not in ('aprobado','rechazado')
    order by s.actualizado_en desc limit 1;

  if v_solicitud.id is null and v_conductor is null then
    begin
      insert into public.solicitudes_conductor(
        auth_user_id,estado,paso_actual,version_registro,origen_modelo
      ) values(v_auth,'borrador',0,2,'v2_minimo') returning * into v_solicitud;
    exception when unique_violation then
      select s.* into v_solicitud from public.solicitudes_conductor s
        where s.auth_user_id=v_auth and s.estado not in ('aprobado','rechazado')
        order by s.actualizado_en desc limit 1;
    end;
  end if;

  select u.email_confirmed_at is not null into v_confirmado from auth.users u where u.id=v_auth;
  if v_solicitud.id is not null and coalesce(v_confirmado,false) then
    if v_solicitud.estado='borrador' then
      perform public.cambiar_estado_solicitud_conductor(v_solicitud.id,'correo_pendiente');
      perform public.cambiar_estado_solicitud_conductor(v_solicitud.id,'datos_incompletos');
      v_solicitud.estado:='datos_incompletos';
    elsif v_solicitud.estado='correo_pendiente' then
      perform public.cambiar_estado_solicitud_conductor(v_solicitud.id,'datos_incompletos');
      v_solicitud.estado:='datos_incompletos';
    end if;
  end if;

  if v_solicitud.id is null and v_conductor is not null then
    select s.* into v_solicitud from public.solicitudes_conductor s
      where s.auth_user_id=v_auth order by s.actualizado_en desc limit 1;
  end if;
  return query select v_solicitud.id,v_conductor,v_solicitud.estado,v_solicitud.paso_actual;
end;
$$;
revoke all on function public.iniciar_solicitud_conductor() from public,anon;
grant execute on function public.iniciar_solicitud_conductor() to authenticated;

create or replace function public.guardar_borrador_conductor(
  p_paso_actual smallint,
  p_datos_personales jsonb default null,
  p_domicilio jsonb default null,
  p_licencia jsonb default null,
  p_contacto_emergencia jsonb default null
) returns table(
  solicitud_id uuid,
  conductor_id uuid,
  estado public.estado_expediente_conductor,
  paso_actual smallint
) language plpgsql security definer set search_path = public as $$
declare v_auth uuid:=auth.uid(); s public.solicitudes_conductor;
  v_datos jsonb; v_domicilio jsonb; v_licencia jsonb; v_contacto jsonb;
begin
  if v_auth is null then raise exception 'Inicia sesión para guardar tu solicitud.'; end if;
  if p_paso_actual not between 0 and 5 then raise exception 'paso_actual fuera de rango.'; end if;
  select x.* into s from public.solicitudes_conductor x
    where x.auth_user_id=v_auth and x.estado not in ('aprobado','rechazado') for update;
  if s.id is null then raise exception 'Primero inicia la solicitud.'; end if;
  if s.estado in ('listo_para_enviar','en_revision','aprobado','rechazado','suspendido') then
    raise exception 'La solicitud enviada ya no admite cambios.';
  end if;
  if s.estado in ('borrador','correo_pendiente') then
    raise exception 'Confirma tu correo e inicia la solicitud antes de guardar.';
  end if;
  if p_datos_personales is not null and jsonb_typeof(p_datos_personales)<>'object' then raise exception 'datos_personales inválido.'; end if;
  if p_domicilio is not null and jsonb_typeof(p_domicilio)<>'object' then raise exception 'domicilio inválido.'; end if;
  if p_licencia is not null and jsonb_typeof(p_licencia)<>'object' then raise exception 'licencia inválida.'; end if;
  if p_contacto_emergencia is not null and jsonb_typeof(p_contacto_emergencia)<>'object' then raise exception 'contacto_emergencia inválido.'; end if;

  v_datos:=coalesce(p_datos_personales,s.datos_personales);
  v_domicilio:=coalesce(p_domicilio,s.domicilio);
  v_licencia:=coalesce(p_licencia,s.licencia);
  v_contacto:=coalesce(p_contacto_emergencia,s.contacto_emergencia);
  if nullif(v_datos->>'curp','') is not null and upper(btrim(v_datos->>'curp')) !~ '^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9][0-9]$' then
    raise exception 'CURP inválida.';
  end if;
  if nullif(v_datos->>'telefono','') is not null and length(regexp_replace(v_datos->>'telefono','[^0-9]','','g')) not between 10 and 15 then
    raise exception 'Teléfono inválido.';
  end if;
  if nullif(v_licencia->>'numero','') is not null and length(btrim(v_licencia->>'numero'))<3 then raise exception 'Licencia inválida.'; end if;
  if nullif(v_licencia->>'vigencia','') is not null then perform (v_licencia->>'vigencia')::date; end if;

  update public.solicitudes_conductor set
    datos_personales=v_datos,domicilio=v_domicilio,licencia=v_licencia,contacto_emergencia=v_contacto,
    paso_actual=greatest(s.paso_actual,p_paso_actual),version_registro=2,origen_modelo='v2_minimo'
  where id=s.id returning * into s;
  if s.estado='requiere_correccion' then
    perform public.cambiar_estado_solicitud_conductor(s.id,'datos_incompletos');
    s.estado:='datos_incompletos';
  end if;
  if s.estado='datos_incompletos' and public.solicitud_conductor_datos_completos(s.id) then
    perform public.cambiar_estado_solicitud_conductor(s.id,'documentos_pendientes');
    s.estado:='documentos_pendientes';
  end if;
  return query select s.id,s.conductor_id,s.estado,greatest(s.paso_actual,p_paso_actual)::smallint;
end;
$$;
revoke all on function public.guardar_borrador_conductor(smallint,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.guardar_borrador_conductor(smallint,jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.enviar_solicitud_conductor()
returns table(
  solicitud_id uuid,
  conductor_id uuid,
  estado public.estado_expediente_conductor,
  paso_actual smallint
) language plpgsql security definer set search_path = public as $$
declare v_auth uuid:=auth.uid(); s public.solicitudes_conductor; v_admin_actor uuid;
begin
  if v_auth is null then raise exception 'Inicia sesión para enviar tu solicitud.'; end if;
  select x.* into s from public.solicitudes_conductor x
    where x.auth_user_id=v_auth and x.estado not in ('aprobado','rechazado') for update;
  if s.id is null then raise exception 'No encontramos una solicitud activa.'; end if;
  if s.estado='en_revision' then return query select s.id,s.conductor_id,s.estado,s.paso_actual; return; end if;
  if s.estado not in ('documentos_pendientes','listo_para_enviar','requiere_correccion') then
    raise exception 'La solicitud todavía no está lista para envío.';
  end if;
  if not public.solicitud_conductor_datos_completos(s.id) then raise exception 'La solicitud contiene datos obligatorios incompletos.'; end if;
  if (s.licencia->>'vigencia')::date < current_date then raise exception 'La licencia está vencida.'; end if;
  if exists(
    select 1 from (values('licencia_frente'),('licencia_reverso'),('identificacion_oficial')) r(tipo)
    where not exists(select 1 from public.documentos_conductor d
      where d.solicitud_id=s.id and d.tipo=r.tipo and d.estado in ('en_revision','aprobado'))
  ) then raise exception 'Faltan los tres documentos obligatorios.'; end if;

  if s.estado in ('documentos_pendientes','requiere_correccion') then
    perform public.cambiar_estado_solicitud_conductor(s.id,'listo_para_enviar');
  end if;
  perform public.cambiar_estado_solicitud_conductor(s.id,'en_revision');
  select * into s from public.solicitudes_conductor where id=s.id;
  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('validacion_documentos','conductor',s.id,jsonb_build_object('accion','envio_solicitud_conductor','version_registro',s.version_registro));
  return query select s.id,s.conductor_id,s.estado,s.paso_actual;
end;
$$;
revoke all on function public.enviar_solicitud_conductor() from public,anon;
grant execute on function public.enviar_solicitud_conductor() to authenticated;

-- RT-10: cargar documentos prepara el expediente, pero nunca lo envía.
create or replace function public.preparar_expediente_por_documento()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado public.estado_expediente_conductor;
begin
  perform set_config('ruum.cambio_documento_autorizado','si',true);
  update public.documentos_conductor set estado='reemplazado',actualizado_en=now()
    where id<>new.id and tipo=new.tipo
      and ((new.solicitud_id is not null and solicitud_id=new.solicitud_id) or (new.conductor_id is not null and conductor_id=new.conductor_id))
      and estado in ('en_revision','aprobado','rechazado','vencido');
  perform set_config('ruum.cambio_documento_autorizado','',true);
  if new.solicitud_id is not null then
    select estado into v_estado from public.solicitudes_conductor where id=new.solicitud_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_solicitud_conductor(new.solicitud_id,'documentos_pendientes');
    end if;
  elsif new.conductor_id is not null then
    select estado_expediente into v_estado from public.conductores where id=new.conductor_id;
    if v_estado='requiere_correccion' then
      perform public.cambiar_estado_expediente_conductor(new.conductor_id,'documentos_pendientes');
    end if;
  end if;
  return new;
end;
$$;
