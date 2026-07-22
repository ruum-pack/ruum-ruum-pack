-- Configuración administrativa operativa, versionada y auditada.

create table if not exists public.configuracion_admin (
  clave text primary key check (clave ~ '^[a-z0-9_]+$'),
  nombre text not null,
  descripcion text not null default '',
  categoria text not null,
  valor jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version > 0),
  actualizada_en timestamptz not null default now(),
  actualizada_por uuid references public.admins(id)
);

alter table public.configuracion_admin enable row level security;

insert into public.configuracion_admin(clave,nombre,descripcion,categoria,valor) values
('zonas_operacion','Zonas de operación','Cobertura geográfica y disponibilidad operativa.','operacion',
 '{"zonas":[{"codigo":"mx_cdmx","nombre":"Ciudad de México","activa":true}],"permitir_fuera_cobertura":false}'::jsonb),
('tipos_servicio_vehiculo','Tipos de servicio y vehículo','Catálogo operativo admitido para solicitudes y asignaciones.','operacion',
 '{"servicios":["traslado_local","traslado_foraneo"],"vehiculos":["sedan","suv","pickup","van"]}'::jsonb),
('reglas_evidencia','Reglas de evidencia','Requisitos mínimos de evidencia por etapa del traslado.','operacion',
 '{"inicio":{"fotos_minimas":4,"requiere_odometro":true},"entrega":{"fotos_minimas":4,"requiere_firma":true}}'::jsonb),
('estados_traslado','Estados de traslado','Transiciones y controles operativos de los traslados.','operacion',
 '{"cancelacion_especial_requiere_supervisor":true,"cierre_con_incidencia_requiere_aprobacion":true}'::jsonb),
('plantillas_notificacion','Plantillas de notificación','Textos y canales utilizados para avisos transaccionales.','comunicacion',
 '{"canales":["push","email"],"recordatorio_minutos_antes":60,"notificar_cancelacion":true}'::jsonb),
('metodos_pago','Métodos de pago','Métodos habilitados y reglas de ejecución financiera.','finanzas',
 '{"habilitados":["transferencia","tarjeta"],"requiere_referencia":true,"conciliacion_automatica":false}'::jsonb),
('datos_fiscales','Datos fiscales','Parámetros fiscales generales de la operación.','finanzas',
 '{"pais":"MX","moneda":"MXN","iva_porcentaje":16,"requiere_constancia_fiscal":true}'::jsonb),
('seguridad','Seguridad','Políticas administrativas de sesión y cambios críticos.','seguridad',
 '{"sesion_minutos":60,"motivo_minimo_caracteres":10,"aprobacion_dual_cambios_criticos":true}'::jsonb)
on conflict (clave) do nothing;

create or replace function public.admin_tiene_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  with actual as (
    select a.id, a.rol_operativo from public.admins a where a.auth_user_id=auth.uid()
  ), base as (
    select id, replace(p_permiso,'.',':') permiso,
      replace(p_permiso,'.',':') = any(case rol_operativo
        when 'operador' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','incidencias:leer']
        when 'supervisor' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','incidencias:leer','disputas:leer','disputas:resolver','aprobaciones:aprobar','auditoria:leer','configuracion:leer']
        when 'finanzas' then array['dashboard:leer','viajes:leer','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','exportaciones:crear','configuracion:leer']
        when 'compliance' then array['dashboard:leer','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','incidencias:leer','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear','configuracion:leer']
        when 'direccion' then array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar','conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar','empresas:leer','empresas:gestionar','pagos:leer','pagos:ejecutar','pagos:exportar','tarifas:leer','tarifas:editar','incidencias:leer','disputas:leer','disputas:resolver','reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer','exportaciones:crear','capacidades:administrar','configuracion:leer','configuracion:editar']
        else array[]::text[] end) permitido
    from actual
  )
  select coalesce((select ac.concedida from base b join public.admin_capacidades ac on ac.admin_id=b.id and ac.capacidad=b.permiso),
                  (select permitido from base), false)
$$;

create or replace function public.admin_listar_capacidades_catalogo()
returns text[] language sql stable security definer set search_path=public,pg_temp as $$
  select array['dashboard:leer','viajes:leer','viajes:gestionar','masivos:gestionar',
    'conductores:leer','conductores:validar','conductores:sancionar','usuarios:leer','usuarios:validar',
    'empresas:leer','empresas:gestionar','pagos:leer','pagos:ejecutar','pagos:exportar',
    'tarifas:leer','tarifas:editar','incidencias:leer','disputas:leer','disputas:resolver',
    'reclamos_seguro:leer','reclamos_seguro:gestionar','aprobaciones:aprobar','auditoria:leer',
    'exportaciones:crear','capacidades:administrar','configuracion:leer','configuracion:editar']
$$;

create or replace function public.admin_listar_configuracion()
returns setof public.configuracion_admin
language sql stable security definer set search_path=public,pg_temp as $$
  select c.* from public.configuracion_admin c
  where public.admin_tiene_permiso('configuracion:leer')
  order by c.categoria,c.nombre
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
  if p_valor is null or jsonb_typeof(p_valor) <> 'object' then
    raise exception using errcode='22023',message='CONFIGURACION_DEBE_SER_OBJETO_JSON';
  end if;
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

create policy configuracion_admin_lectura on public.configuracion_admin for select to authenticated
using (public.admin_tiene_permiso('configuracion:leer'));

revoke all on public.configuracion_admin from public,authenticated;
grant select on public.configuracion_admin to authenticated;
revoke all on function public.admin_listar_configuracion() from public;
revoke all on function public.admin_actualizar_configuracion(text,jsonb,text,integer) from public;
grant execute on function public.admin_listar_configuracion() to authenticated;
grant execute on function public.admin_actualizar_configuracion(text,jsonb,text,integer) to authenticated;
