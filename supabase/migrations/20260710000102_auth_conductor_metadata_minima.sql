-- RT-05 — El alta Auth v2 de conductor crea únicamente una solicitud base.
-- Los datos sensibles se escriben después de autenticar mediante una RPC.

alter table public.solicitudes_conductor
  add column version_registro integer not null default 1 check (version_registro in (1,2)),
  add column origen_modelo text not null default 'legacy_metadata'
    check (origen_modelo in ('legacy_metadata','v2_minimo'));

create or replace function public.completar_solicitud_conductor_v2(
  p_datos_personales jsonb,
  p_domicilio jsonb,
  p_licencia jsonb,
  p_contacto_emergencia jsonb
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare s public.solicitudes_conductor; v_confirmado boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para completar la solicitud.'; end if;
  if jsonb_typeof(p_datos_personales)<>'object' or jsonb_typeof(p_domicilio)<>'object'
    or jsonb_typeof(p_licencia)<>'object' or jsonb_typeof(p_contacto_emergencia)<>'object' then
    raise exception 'El expediente debe contener objetos JSON válidos.';
  end if;

  select * into s from public.solicitudes_conductor
    where auth_user_id=auth.uid() and estado not in ('aprobado','rechazado') for update;
  if s.id is null then raise exception 'No encontramos una solicitud activa.'; end if;
  select email_confirmed_at is not null into v_confirmado from auth.users where id=auth.uid();
  if not coalesce(v_confirmado,false) then raise exception 'Confirma tu correo antes de guardar el expediente.'; end if;

  if s.estado='borrador' then
    perform public.cambiar_estado_solicitud_conductor(s.id,'correo_pendiente');
    perform public.cambiar_estado_solicitud_conductor(s.id,'datos_incompletos');
    s.estado:='datos_incompletos';
  elsif s.estado='correo_pendiente' then
    perform public.cambiar_estado_solicitud_conductor(s.id,'datos_incompletos');
    s.estado:='datos_incompletos';
  elsif s.estado='requiere_correccion' then
    perform public.cambiar_estado_solicitud_conductor(s.id,'datos_incompletos');
    s.estado:='datos_incompletos';
  end if;
  if s.estado not in ('datos_incompletos','documentos_pendientes') then
    raise exception 'La solicitud no admite edición en estado %.',s.estado;
  end if;

  if nullif(btrim(p_datos_personales->>'nombre'),'') is null
    or nullif(btrim(p_datos_personales->>'telefono'),'') is null
    or nullif(btrim(p_datos_personales->>'curp'),'') is null
    or nullif(btrim(p_domicilio->>'codigo_postal'),'') is null
    or nullif(btrim(p_licencia->>'numero'),'') is null
    or nullif(btrim(p_licencia->>'vigencia'),'') is null
    or nullif(btrim(p_contacto_emergencia->>'nombre'),'') is null
    or nullif(btrim(p_contacto_emergencia->>'telefono'),'') is null
    or not coalesce((p_datos_personales->>'autoriza_verificacion_antecedentes')::boolean,false)
    or not coalesce((p_datos_personales->>'declara_sin_suspensiones')::boolean,false)
    or coalesce((p_datos_personales->>'version_terminos_aceptada')::integer,0)<1 then
    raise exception 'La solicitud contiene datos obligatorios incompletos.';
  end if;

  update public.solicitudes_conductor set
    datos_personales=p_datos_personales,
    domicilio=p_domicilio,
    licencia=p_licencia,
    contacto_emergencia=p_contacto_emergencia,
    paso_actual=5,
    version_registro=2,
    origen_modelo='v2_minimo'
  where id=s.id;
  if s.estado='datos_incompletos' then
    perform public.cambiar_estado_solicitud_conductor(s.id,'documentos_pendientes');
  end if;
  return s.id;
end;
$$;
revoke all on function public.completar_solicitud_conductor_v2(jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.completar_solicitud_conductor_v2(jsonb,jsonb,jsonb,jsonb) to authenticated;

create or replace function public.confirmar_correo_solicitud_conductor()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid; v_estado public.estado_expediente_conductor;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    select id,estado into v_id,v_estado from public.solicitudes_conductor
      where auth_user_id=new.id and estado in ('borrador','correo_pendiente');
    if v_id is not null and v_estado='borrador' then
      perform public.cambiar_estado_solicitud_conductor(v_id,'correo_pendiente');
      perform public.cambiar_estado_solicitud_conductor(v_id,'datos_incompletos');
    elsif v_id is not null then
      perform public.cambiar_estado_solicitud_conductor(v_id,'datos_incompletos');
    end if;
  end if;
  return new;
end;
$$;

-- Rama conductor: sólo lee el discriminador y la versión no sensible.
-- La rama usuario se conserva para no romper app-usuario durante esta fase.
create or replace function public.manejar_nuevo_usuario_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo_registro text := new.raw_user_meta_data->>'tipo_registro';
  v_version_registro integer := coalesce(nullif(new.raw_user_meta_data->>'version_registro','')::integer,1);
  v_actor_id uuid;
begin
  if v_tipo_registro='conductor' then
    insert into public.solicitudes_conductor(
      auth_user_id,estado,paso_actual,datos_personales,domicilio,licencia,contacto_emergencia,version_registro,origen_modelo
    ) values (
      new.id,'borrador',0,'{}','{}','{}','{}',v_version_registro,
      case when v_version_registro=2 then 'v2_minimo' else 'legacy_metadata' end
    ) returning id into v_actor_id;
    insert into public.registro_auditoria(evento,actor,actor_id,datos)
    values('creacion_cuenta','conductor',v_actor_id,jsonb_build_object('auth_user_id',new.id,'tipo_registro','conductor','version_registro',v_version_registro));
  elsif v_tipo_registro='usuario' then
    insert into public.usuarios(auth_user_id,nombre,tipo_cuenta,rol,estado_verificacion,telefono,pais,estado,codigo_postal,ciudad,colonia,calle,numero,referencias,direccion_principal,version_terminos_aceptada,terminos_aceptados_en)
    values(
      new.id,new.raw_user_meta_data->>'nombre',coalesce(new.raw_user_meta_data->>'tipo_cuenta','personal'),
      (case when new.raw_user_meta_data->>'tipo_cuenta'='empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
      'pendiente',new.raw_user_meta_data->>'telefono',coalesce(new.raw_user_meta_data->>'pais','México'),
      new.raw_user_meta_data->>'estado',new.raw_user_meta_data->>'codigo_postal',new.raw_user_meta_data->>'ciudad',
      new.raw_user_meta_data->>'colonia',new.raw_user_meta_data->>'calle',new.raw_user_meta_data->>'numero',
      new.raw_user_meta_data->>'referencias',new.raw_user_meta_data->>'direccion_principal',
      nullif(new.raw_user_meta_data->>'version_terminos_aceptada','')::integer,
      nullif(new.raw_user_meta_data->>'terminos_aceptados_en','')::timestamptz
    ) returning id into v_actor_id;
    insert into public.registro_auditoria(evento,actor,actor_id,datos)
    values('creacion_cuenta','usuario',v_actor_id,jsonb_build_object('auth_user_id',new.id,'tipo_registro','usuario'));
    if nullif(new.raw_user_meta_data->>'version_terminos_aceptada','') is not null then
      insert into public.registro_auditoria(evento,actor,actor_id,datos)
      values('aceptacion_terminos','usuario',v_actor_id,jsonb_build_object(
        'version_terminos_aceptada',(new.raw_user_meta_data->>'version_terminos_aceptada')::integer,
        'terminos_aceptados_en',nullif(new.raw_user_meta_data->>'terminos_aceptados_en','')::timestamptz));
    end if;
  end if;
  return new;
end;
$$;

comment on function public.manejar_nuevo_usuario_auth() is
  'RT-05: para conductores sólo consume tipo_registro y version_registro; nunca PII del expediente.';
