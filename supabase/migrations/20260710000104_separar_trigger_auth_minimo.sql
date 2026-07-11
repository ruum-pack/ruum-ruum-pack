-- RT-05 — El trigger principal queda estrictamente mínimo. La compatibilidad
-- temporal de app-usuario se aísla en una función distinta y auditable.

create or replace function public.crear_usuario_legacy_desde_auth(p_usuario auth.users)
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb:=p_usuario.raw_user_meta_data; v_id uuid;
begin
  insert into public.usuarios(auth_user_id,nombre,tipo_cuenta,rol,estado_verificacion,telefono,pais,estado,codigo_postal,ciudad,colonia,calle,numero,referencias,direccion_principal,version_terminos_aceptada,terminos_aceptados_en)
  values(
    p_usuario.id,m->>'nombre',coalesce(m->>'tipo_cuenta','personal'),
    (case when m->>'tipo_cuenta'='empresa' then 'titular_empresa' else 'personal' end)::rol_usuario,
    'pendiente',m->>'telefono',coalesce(m->>'pais','México'),m->>'estado',m->>'codigo_postal',m->>'ciudad',
    m->>'colonia',m->>'calle',m->>'numero',m->>'referencias',m->>'direccion_principal',
    nullif(m->>'version_terminos_aceptada','')::integer,nullif(m->>'terminos_aceptados_en','')::timestamptz
  ) returning id into v_id;
  insert into public.registro_auditoria(evento,actor,actor_id,datos)
  values('creacion_cuenta','usuario',v_id,jsonb_build_object('auth_user_id',p_usuario.id,'tipo_registro','usuario'));
  if nullif(m->>'version_terminos_aceptada','') is not null then
    insert into public.registro_auditoria(evento,actor,actor_id,datos)
    values('aceptacion_terminos','usuario',v_id,jsonb_build_object(
      'version_terminos_aceptada',(m->>'version_terminos_aceptada')::integer,
      'terminos_aceptados_en',nullif(m->>'terminos_aceptados_en','')::timestamptz));
  end if;
end;
$$;
revoke all on function public.crear_usuario_legacy_desde_auth(auth.users) from public,anon,authenticated;

create or replace function public.manejar_nuevo_usuario_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo_registro text:=new.raw_user_meta_data->>'tipo_registro';
  v_version_registro integer:=coalesce(nullif(new.raw_user_meta_data->>'version_registro','')::integer,1);
  v_solicitud_id uuid;
begin
  if v_tipo_registro='conductor' then
    insert into public.solicitudes_conductor(
      auth_user_id,estado,paso_actual,datos_personales,domicilio,licencia,contacto_emergencia,version_registro,origen_modelo
    ) values(
      new.id,'borrador',0,'{}','{}','{}','{}',v_version_registro,
      case when v_version_registro=2 then 'v2_minimo' else 'legacy_metadata' end
    ) returning id into v_solicitud_id;
    insert into public.registro_auditoria(evento,actor,actor_id,datos)
    values('creacion_cuenta','conductor',v_solicitud_id,jsonb_build_object(
      'auth_user_id',new.id,'tipo_registro','conductor','version_registro',v_version_registro));
  elsif v_tipo_registro='usuario' then
    perform public.crear_usuario_legacy_desde_auth(new);
  end if;
  return new;
end;
$$;

comment on function public.manejar_nuevo_usuario_auth() is
  'RT-05: trigger mínimo; sólo lee tipo_registro y version_registro.';
