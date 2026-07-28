-- Convierte configuracion_admin en un cerebro normativo con defaults completos
-- y validacion de forma por clave antes de persistir cambios.

insert into public.configuracion_admin(clave,nombre,descripcion,categoria,valor) values
('zonas_operacion','Zonas de operacion','Cobertura geografica, bloqueo fuera de cobertura y zonas activas para operar traslados.','operacion',
 '{"zonas":[{"codigo":"mx_cdmx","nombre":"Ciudad de Mexico","activa":true}],"permitir_fuera_cobertura":false}'::jsonb),
('tipos_servicio_vehiculo','Tipos de servicio y vehiculo','Catalogo operativo admitido para solicitudes, asignacion y compatibilidad vehicular.','operacion',
 '{"servicios":["traslado_local","traslado_foraneo"],"vehiculos":["sedan","suv","pickup","van"]}'::jsonb),
('reglas_evidencia','Reglas de evidencia','Evidencia minima obligatoria por etapa del traslado.','operacion',
 '{"inicio":{"fotos_minimas":4,"requiere_odometro":true},"entrega":{"fotos_minimas":4,"requiere_firma":true}}'::jsonb),
('estados_traslado','Estados de traslado','Candados normativos para transiciones, cierres, cancelaciones y reasignaciones.','operacion',
 '{"cancelacion_especial_requiere_supervisor":true,"cierre_con_incidencia_requiere_aprobacion":true,"reasignacion_conductor_requiere_motivo":true,"bloquear_cierre_sin_evidencias":true}'::jsonb),
('plantillas_notificacion','Plantillas de notificacion','Canales y reglas para avisos transaccionales de usuarios, conductores y empresas.','comunicacion',
 '{"canales":["push","email"],"recordatorio_minutos_antes":60,"notificar_cancelacion":true,"notificar_incidencia_critica":true}'::jsonb),
('metodos_pago','Metodos de pago','Metodos aceptados por Ruum Ruum, pasarela principal y reglas de conciliacion/cobro.','finanzas',
 '{"habilitados":["tarjeta_credito","tarjeta_debito","transferencia","spei","credito_corporativo"],"proveedor_pasarela":"stripe","requiere_referencia":true,"conciliacion_automatica":false,"permitir_credito_corporativo":true,"bloquear_sin_pago_confirmado":false}'::jsonb),
('datos_fiscales','Datos fiscales','Datos fiscales de Ruum Ruum como emisor y requisitos fiscales obligatorios para clientes fisicos o morales.','finanzas',
 '{"pais":"MX","moneda":"MXN","iva_porcentaje":16,"ruum":{"rfc":"","razon_social":"","regimen_fiscal":"","codigo_postal_fiscal":"","correo_facturacion":""},"requisitos_cliente":{"persona_fisica":{"rfc_obligatorio":true,"constancia_obligatoria":false},"persona_moral":{"razon_social_obligatoria":true,"constancia_obligatoria":true}},"bloquear_facturacion_sin_datos":true}'::jsonb),
('seguridad','Seguridad','Politicas administrativas de sesion, motivos, aprobacion dual, MFA y cambios criticos.','seguridad',
 '{"sesion_minutos":60,"motivo_minimo_caracteres":10,"intentos_fallidos_maximos":5,"reautenticacion_cambios_criticos_minutos":15,"aprobacion_dual_cambios_criticos":true,"mfa_requerido_direccion":true}'::jsonb)
on conflict (clave) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    categoria = excluded.categoria,
    valor = excluded.valor || public.configuracion_admin.valor;

create or replace function public.admin_validar_configuracion_normativa(p_clave text, p_valor jsonb)
returns void
language plpgsql
stable
set search_path=public,pg_temp
as $$
begin
  if p_valor is null or jsonb_typeof(p_valor) <> 'object' then
    raise exception using errcode='22023', message='CONFIGURACION_DEBE_SER_OBJETO_JSON';
  end if;

  if p_clave = 'zonas_operacion' then
    if jsonb_typeof(p_valor->'zonas') <> 'array' or not (p_valor ? 'permitir_fuera_cobertura') then
      raise exception using errcode='22023', message='ZONAS_OPERACION_INVALIDA';
    end if;
  elsif p_clave = 'tipos_servicio_vehiculo' then
    if jsonb_typeof(p_valor->'servicios') <> 'array' or jsonb_typeof(p_valor->'vehiculos') <> 'array' then
      raise exception using errcode='22023', message='TIPOS_SERVICIO_VEHICULO_INVALIDO';
    end if;
  elsif p_clave = 'reglas_evidencia' then
    if jsonb_typeof(p_valor->'inicio') <> 'object' or jsonb_typeof(p_valor->'entrega') <> 'object' then
      raise exception using errcode='22023', message='REGLAS_EVIDENCIA_INVALIDAS';
    end if;
  elsif p_clave = 'estados_traslado' then
    if not (p_valor ? 'cancelacion_especial_requiere_supervisor') or not (p_valor ? 'cierre_con_incidencia_requiere_aprobacion') then
      raise exception using errcode='22023', message='ESTADOS_TRASLADO_INVALIDOS';
    end if;
  elsif p_clave = 'plantillas_notificacion' then
    if jsonb_typeof(p_valor->'canales') <> 'array' then
      raise exception using errcode='22023', message='PLANTILLAS_NOTIFICACION_INVALIDAS';
    end if;
  elsif p_clave = 'metodos_pago' then
    if jsonb_typeof(p_valor->'habilitados') <> 'array' or coalesce(p_valor->>'proveedor_pasarela','') not in ('stripe','mercado_pago','paypal','manual') then
      raise exception using errcode='22023', message='METODOS_PAGO_INVALIDOS';
    end if;
  elsif p_clave = 'datos_fiscales' then
    if jsonb_typeof(p_valor->'ruum') <> 'object' or jsonb_typeof(p_valor->'requisitos_cliente') <> 'object' then
      raise exception using errcode='22023', message='DATOS_FISCALES_INVALIDOS';
    end if;
  elsif p_clave = 'seguridad' then
    if coalesce((p_valor->>'sesion_minutos')::integer, 0) < 15
      or coalesce((p_valor->>'motivo_minimo_caracteres')::integer, 0) < 10 then
      raise exception using errcode='22023', message='SEGURIDAD_INVALIDA';
    end if;
  end if;
end;
$$;

create or replace function public.admin_actualizar_configuracion(
  p_clave text, p_valor jsonb, p_motivo text, p_version_esperada integer
) returns setof public.configuracion_admin
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_admin_id uuid; v_anterior jsonb;
begin
  if not public.admin_tiene_permiso('configuracion:editar') then
    raise exception using errcode='42501',message='PERMISO_INSUFICIENTE';
  end if;
  if length(trim(coalesce(p_motivo,''))) < 10 then
    raise exception using errcode='22023',message='MOTIVO_MINIMO_10_CARACTERES';
  end if;
  perform public.admin_validar_configuracion_normativa(p_clave, p_valor);
  select id into strict v_admin_id from public.admins where auth_user_id=auth.uid();
  select valor into v_anterior from public.configuracion_admin where clave=p_clave for update;
  if not found then raise exception using errcode='22023',message='CONFIGURACION_NO_ENCONTRADA'; end if;
  update public.configuracion_admin set valor=p_valor, version=version+1, actualizada_en=now(), actualizada_por=v_admin_id
  where clave=p_clave and version=p_version_esperada;
  if not found then raise exception using errcode='40001',message='CONFIGURACION_MODIFICADA_POR_OTRO_USUARIO'; end if;
  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  values(auth.uid(),v_admin_id,'mutacion','configuracion_admin','actualizar',
    jsonb_build_object('clave',p_clave,'motivo',trim(p_motivo),'valor_anterior',v_anterior,'valor_nuevo',p_valor,'version_anterior',p_version_esperada));
  return query select * from public.configuracion_admin where clave=p_clave;
end $$;

revoke all on function public.admin_validar_configuracion_normativa(text,jsonb) from public;
revoke all on function public.admin_actualizar_configuracion(text,jsonb,text,integer) from public;
grant execute on function public.admin_actualizar_configuracion(text,jsonb,text,integer) to authenticated;
