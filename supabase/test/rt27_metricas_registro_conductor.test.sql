-- RT-27: telemetría mínima, privacidad, inmutabilidad y resumen administrativo.
begin;

insert into auth.users(id,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,aud,role) values
('92700000-0000-4000-8000-000000000001','rt27-conductor@ruum.test','x',now(),'{}','{}','authenticated','authenticated'),
('92700000-0000-4000-8000-0000000000ad','rt27-admin@ruum.test','x',now(),'{}','{}','authenticated','authenticated');

insert into public.admins(id,auth_user_id,nombre) values
('92700000-0000-4000-8000-000000000aad','92700000-0000-4000-8000-0000000000ad','Admin RT27');

insert into public.solicitudes_conductor(
  id,auth_user_id,estado,paso_actual,creado_en,actualizado_en,version_registro,origen_modelo
) values(
  '92700000-0000-4000-8000-000000000010',
  '92700000-0000-4000-8000-000000000001',
  'datos_incompletos',3,now()-interval '72 hours',now()-interval '48 hours',2,'v2_minimo'
);

insert into public.documentos_conductor(
  id,solicitud_id,tipo,nombre_archivo,url,estado,version,es_actual,revisado_por,revisado_en,motivo_rechazo
) values(
  '92700000-0000-4000-8000-000000000020',
  '92700000-0000-4000-8000-000000000010',
  'licencia_frente','licencia.jpg',
  '92700000-0000-4000-8000-000000000001/92700000-0000-4000-8000-000000000010/licencia_frente/licencia.jpg',
  'rechazado',1,true,'92700000-0000-4000-8000-000000000aad',now()-interval '2 hours','Documento ilegible.'
);

insert into public.historial_estados_solicitud_conductor(
  solicitud_id,documento_id,revisado_por,decision,motivo,estado_anterior,estado_nuevo,revisado_en
) values(
  '92700000-0000-4000-8000-000000000010',
  '92700000-0000-4000-8000-000000000020',
  '92700000-0000-4000-8000-000000000aad',
  'rechazar_documento','Documento ilegible.','datos_incompletos','datos_incompletos',now()-interval '2 hours'
);

-- Anónimo: puede registrar un código acotado, pero no leer la tabla.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select public.registrar_evento_registro_conductor(
  '92700000-0000-4000-8000-000000000100','otp_error',1::smallint,'otp_expirado',1200
);
do $$
declare v_leyo boolean:=false;
begin
  begin perform 1 from public.eventos_registro_conductor limit 1; v_leyo:=true;
  exception when insufficient_privilege then v_leyo:=false;
  end;
  if v_leyo then raise exception 'RT-27: anónimo pudo leer telemetría.'; end if;
end $$;
reset role;

-- Conductor: el servidor vincula auth.uid y solicitud; no acepta texto libre/PII.
set local role authenticated;
select set_config('request.jwt.claim.sub','92700000-0000-4000-8000-000000000001',true);
select public.registrar_evento_registro_conductor(
  '92700000-0000-4000-8000-000000000100','rpc_error',3::smallint,'guardar_borrador',800
);
do $$
declare v_rechazado boolean:=false;
begin
  begin
    perform public.registrar_evento_registro_conductor(
      '92700000-0000-4000-8000-000000000100','rpc_error',3::smallint,'correo@personal.test',800
    );
  exception when others then v_rechazado:=true;
  end;
  if not v_rechazado then raise exception 'RT-27: aceptó un código de telemetría no sanitizado.'; end if;
end $$;
reset role;

do $$
declare v_eventos integer; v_vinculados integer; v_inmutable boolean:=false;
begin
  select count(*),count(*) filter (
    where auth_user_id='92700000-0000-4000-8000-000000000001'
      and solicitud_id='92700000-0000-4000-8000-000000000010'
  ) into v_eventos,v_vinculados
  from public.eventos_registro_conductor
  where sesion_id='92700000-0000-4000-8000-000000000100';
  if v_eventos<>2 or v_vinculados<>1 then
    raise exception 'RT-27: vinculación de eventos incorrecta (% / %).',v_eventos,v_vinculados;
  end if;

  begin
    update public.eventos_registro_conductor set codigo='alterado'
    where sesion_id='92700000-0000-4000-8000-000000000100';
  exception when others then v_inmutable:=true;
  end;
  if not v_inmutable then raise exception 'RT-27: la telemetría no es inmutable.'; end if;
end $$;

-- Un conductor no puede consultar el agregado administrativo.
set local role authenticated;
select set_config('request.jwt.claim.sub','92700000-0000-4000-8000-000000000001',true);
do $$
declare v_permitido boolean:=false;
begin
  begin perform public.obtener_metricas_registro_conductor(current_date-7,current_date); v_permitido:=true;
  exception when others then v_permitido:=false;
  end;
  if v_permitido then raise exception 'RT-27: conductor consultó métricas administrativas.'; end if;
end $$;
reset role;

-- Administrador: recibe todos los indicadores requeridos.
set local role authenticated;
select set_config('request.jwt.claim.sub','92700000-0000-4000-8000-0000000000ad',true);
do $$
declare v_metricas jsonb;
begin
  v_metricas:=public.obtener_metricas_registro_conductor(current_date-7,current_date);
  if (v_metricas->>'errores_otp')::integer<>1
    or (v_metricas->>'errores_rpc')::integer<>1
    or not (v_metricas ? 'abandono_por_paso')
    or not (v_metricas ? 'fallos_documentos')
    or not (v_metricas ? 'tiempo_promedio_registro_segundos')
    or not (v_metricas ? 'tiempo_promedio_revision_segundos')
    or jsonb_array_length(v_metricas->'documentos_rechazados_por_tipo')<>1 then
    raise exception 'RT-27: resumen administrativo incompleto: %',v_metricas;
  end if;
end $$;
reset role;

rollback;
select 'RT-27 OK: telemetría privada, inmutable y agregada para administración.' as resultado;
