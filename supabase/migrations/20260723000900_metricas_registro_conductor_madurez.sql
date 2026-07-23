-- Metricas oficiales de registro de conductores.
-- Amplia RT-27 sin romper la RPC legacy: formulas documentadas, comparacion
-- contra periodo anterior, segmentos, calidad de datos, metas/alertas y
-- exportacion controlada.

alter table public.eventos_registro_conductor
  add column if not exists zona text,
  add column if not exists fuente text,
  add column if not exists empresa_id uuid references public.empresas(id) on delete set null,
  add column if not exists recibido_en timestamptz not null default now();

alter table public.eventos_registro_conductor
  drop constraint if exists eventos_registro_conductor_zona_check;
alter table public.eventos_registro_conductor
  add constraint eventos_registro_conductor_zona_check
  check (zona is null or zona ~ '^[a-zA-Z0-9_.: -]{1,80}$');

alter table public.eventos_registro_conductor
  drop constraint if exists eventos_registro_conductor_fuente_check;
alter table public.eventos_registro_conductor
  add constraint eventos_registro_conductor_fuente_check
  check (fuente is null or fuente ~ '^[a-z0-9_.:-]{1,80}$');

create index if not exists eventos_registro_segmentos_idx
  on public.eventos_registro_conductor(zona, fuente, empresa_id, creado_en desc);

create table if not exists public.metas_registro_conductor (
  clave text primary key,
  nombre text not null,
  operador text not null check (operador in ('max','min')),
  objetivo numeric(12,2) not null,
  severidad text not null default 'media' check (severidad in ('critica','alta','media')),
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

insert into public.metas_registro_conductor(clave,nombre,operador,objetivo,severidad)
values
  ('conversion_envio_pct','Conversion a envio','min',65,'alta'),
  ('errores_otp','Errores OTP','max',20,'media'),
  ('errores_rpc','Errores RPC','max',10,'alta'),
  ('fallos_documentos','Fallos de documentos','max',15,'media'),
  ('tiempo_promedio_revision_segundos','Revision promedio','max',86400,'alta')
on conflict (clave) do update set
  nombre=excluded.nombre,
  operador=excluded.operador,
  objetivo=excluded.objetivo,
  severidad=excluded.severidad,
  activo=true,
  actualizado_en=now();

alter table public.metas_registro_conductor enable row level security;
drop policy if exists admin_lee_metas_registro_conductor on public.metas_registro_conductor;
create policy admin_lee_metas_registro_conductor
  on public.metas_registro_conductor for select to authenticated
  using (public.admin_tiene_permiso('conductores:leer'));
grant select on public.metas_registro_conductor to authenticated;

create or replace function public.registrar_evento_registro_conductor_v2(
  p_sesion_id uuid,
  p_evento text,
  p_paso smallint default null,
  p_codigo text default null,
  p_duracion_ms integer default null,
  p_zona text default null,
  p_fuente text default null,
  p_empresa_id uuid default null,
  p_creado_en timestamptz default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_auth uuid:=auth.uid();
  v_solicitud uuid;
  v_id uuid;
  v_codigo text:=nullif(lower(btrim(p_codigo)), '');
  v_zona text:=nullif(btrim(p_zona), '');
  v_fuente text:=nullif(lower(btrim(p_fuente)), '');
begin
  if p_sesion_id is null then raise exception 'La sesión de telemetría es obligatoria.'; end if;
  if p_evento not in ('registro_iniciado','paso_visto','paso_completado','otp_error','rpc_error','documento_fallo','solicitud_enviada') then
    raise exception 'Evento de registro no permitido.';
  end if;
  if p_paso is not null and p_paso not between 1 and 5 then raise exception 'Paso de registro no permitido.'; end if;
  if v_codigo is not null and v_codigo !~ '^[a-z0-9_.:-]{1,64}$' then raise exception 'Código de telemetría no permitido.'; end if;
  if v_zona is not null and v_zona !~ '^[a-zA-Z0-9_.: -]{1,80}$' then raise exception 'Zona de telemetría no permitida.'; end if;
  if v_fuente is not null and v_fuente !~ '^[a-z0-9_.:-]{1,80}$' then raise exception 'Fuente de telemetría no permitida.'; end if;
  if p_duracion_ms is not null and p_duracion_ms not between 0 and 2678400000 then raise exception 'Duración de telemetría no permitida.'; end if;

  if v_auth is not null then
    select id into v_solicitud
    from public.solicitudes_conductor
    where auth_user_id=v_auth
    order by (estado not in ('aprobado','rechazado')) desc, actualizado_en desc
    limit 1;
  end if;

  insert into public.eventos_registro_conductor(
    sesion_id,auth_user_id,solicitud_id,evento,paso,codigo,duracion_ms,zona,fuente,empresa_id,creado_en,recibido_en
  ) values(
    p_sesion_id,v_auth,v_solicitud,p_evento,p_paso,v_codigo,p_duracion_ms,v_zona,v_fuente,p_empresa_id,coalesce(p_creado_en,now()),now()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.metricas_registro_conductor_segmento(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_dimension text,
  p_zona text default null,
  p_fuente text default null,
  p_empresa_id uuid default null
) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with base as (
    select
      case
        when p_dimension='zona' then coalesce(e.zona, s.domicilio->>'estado', 'sin_zona')
        when p_dimension='fuente' then coalesce(e.fuente, s.origen_modelo, 'sin_fuente')
        when p_dimension='empresa' then coalesce(e.empresa_id::text, 'sin_empresa')
        else 'total'
      end as segmento,
      e.sesion_id,
      e.evento
    from public.eventos_registro_conductor e
    left join public.solicitudes_conductor s on s.id=e.solicitud_id
    where e.creado_en>=p_desde and e.creado_en<p_hasta
      and (p_zona is null or coalesce(e.zona, s.domicilio->>'estado', 'sin_zona')=p_zona)
      and (p_fuente is null or coalesce(e.fuente, s.origen_modelo, 'sin_fuente')=p_fuente)
      and (p_empresa_id is null or e.empresa_id=p_empresa_id)
  ), agg as (
    select segmento,
      count(distinct sesion_id) filter (where evento='registro_iniciado')::int as iniciadas,
      count(distinct sesion_id) filter (where evento='solicitud_enviada')::int as enviadas,
      count(*) filter (where evento='otp_error')::int as errores_otp,
      count(*) filter (where evento='rpc_error')::int as errores_rpc,
      count(*) filter (where evento='documento_fallo')::int as fallos_documentos
    from base group by segmento
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'segmento',segmento,
    'iniciadas',iniciadas,
    'enviadas',enviadas,
    'conversion_envio_pct',case when iniciadas=0 then 0 else round((enviadas::numeric/iniciadas)*100,2) end,
    'errores_otp',errores_otp,
    'errores_rpc',errores_rpc,
    'fallos_documentos',fallos_documentos
  ) order by iniciadas desc, segmento),'[]'::jsonb)
  from agg;
$$;

create or replace function public.obtener_metricas_registro_conductor_v2(
  p_desde date default (current_date - 30),
  p_hasta date default current_date,
  p_zona text default null,
  p_fuente text default null,
  p_empresa_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_desde timestamptz:=p_desde::timestamptz;
  v_hasta timestamptz:=(p_hasta + 1)::timestamptz;
  v_dias integer:=greatest((p_hasta-p_desde)+1,1);
  v_desde_anterior timestamptz:=(p_desde - v_dias)::timestamptz;
  v_hasta_anterior timestamptz:=p_desde::timestamptz;
  v_actual jsonb;
  v_anterior jsonb;
  v_abandonos jsonb;
  v_rechazados jsonb;
  v_resultado jsonb;
begin
  if not public.admin_tiene_permiso('conductores:leer') then
    raise exception using errcode='42501', message='PERMISO_INSUFICIENTE';
  end if;
  if p_desde is null or p_hasta is null or p_desde>p_hasta or p_hasta-p_desde>366 then
    raise exception 'El periodo solicitado no es válido.';
  end if;

  with params as (select v_desde desde, v_hasta hasta),
  eventos as (
    select e.*, s.domicilio, s.origen_modelo
    from public.eventos_registro_conductor e
    left join public.solicitudes_conductor s on s.id=e.solicitud_id
    where e.creado_en>=v_desde and e.creado_en<v_hasta
      and (p_zona is null or coalesce(e.zona, s.domicilio->>'estado', 'sin_zona')=p_zona)
      and (p_fuente is null or coalesce(e.fuente, s.origen_modelo, 'sin_fuente')=p_fuente)
      and (p_empresa_id is null or e.empresa_id=p_empresa_id)
  ),
  solicitudes as (
    select s.*
    from public.solicitudes_conductor s
    where s.creado_en<v_hasta and coalesce(s.enviado_en,s.actualizado_en,s.creado_en)>=v_desde
      and (p_zona is null or coalesce(s.domicilio->>'estado','sin_zona')=p_zona)
      and (p_fuente is null or coalesce(s.origen_modelo,'sin_fuente')=p_fuente)
  ),
  abandonos as (
    select paso_actual as paso,count(*)::integer as total
    from solicitudes
    where actualizado_en<least(now(),v_hasta)-interval '24 hours'
      and estado in ('borrador','correo_pendiente','datos_incompletos','documentos_pendientes','listo_para_enviar','requiere_correccion')
    group by paso_actual
  ),
  documentos_rechazados as (
    select d.tipo,count(*)::integer as total
    from public.historial_estados_solicitud_conductor h
    join public.documentos_conductor d on d.id=h.documento_id
    join public.solicitudes_conductor s on s.id=h.solicitud_id
    where h.decision='rechazar_documento'
      and h.revisado_en>=v_desde and h.revisado_en<v_hasta
      and (p_zona is null or coalesce(s.domicilio->>'estado','sin_zona')=p_zona)
      and (p_fuente is null or coalesce(s.origen_modelo,'sin_fuente')=p_fuente)
    group by d.tipo
  ),
  revisiones as (
    select s.id,
      min(h.revisado_en) filter (where h.estado_nuevo='en_revision') as inicio,
      min(h.revisado_en) filter (where h.estado_nuevo in ('requiere_correccion','aprobado','rechazado')) as fin
    from solicitudes s
    join public.historial_estados_solicitud_conductor h on h.solicitud_id=s.id
    where s.enviado_en>=v_desde and s.enviado_en<v_hasta
    group by s.id
  ),
  base as (
    select
      count(distinct sesion_id) filter (where evento='registro_iniciado')::int as solicitudes_iniciadas,
      count(distinct sesion_id) filter (where evento='solicitud_enviada')::int as solicitudes_enviadas_evento,
      count(*) filter (where evento='otp_error')::int as errores_otp,
      count(*) filter (where evento='rpc_error')::int as errores_rpc,
      count(*) filter (where evento='documento_fallo')::int as fallos_documentos,
      count(*) filter (where recibido_en > creado_en + interval '6 hours')::int as eventos_tardios,
      count(*)::int as eventos_totales
    from eventos
  ),
  duplicados as (
    select coalesce(sum(total-1),0)::int as eventos_duplicados
    from (
      select sesion_id,evento,coalesce(paso,0) paso,coalesce(codigo,'') codigo,date_trunc('minute',creado_en) minuto,count(*) total
      from eventos
      group by sesion_id,evento,coalesce(paso,0),coalesce(codigo,''),date_trunc('minute',creado_en)
      having count(*)>1
    ) d
  )
  select jsonb_build_object(
    'solicitudes_iniciadas',base.solicitudes_iniciadas,
    'solicitudes_enviadas',(select count(*) from solicitudes where enviado_en>=v_desde and enviado_en<v_hasta),
    'conversion_envio_pct',case when base.solicitudes_iniciadas=0 then 0 else round(((select count(*) from solicitudes where enviado_en>=v_desde and enviado_en<v_hasta)::numeric/base.solicitudes_iniciadas)*100,2) end,
    'errores_otp',base.errores_otp,
    'errores_rpc',base.errores_rpc,
    'fallos_documentos',base.fallos_documentos,
    'tiempo_promedio_registro_segundos',(select round(avg(extract(epoch from (enviado_en-creado_en)))) from solicitudes where enviado_en>=v_desde and enviado_en<v_hasta),
    'tiempo_promedio_revision_segundos',(select round(avg(extract(epoch from (fin-inicio)))) from revisiones where inicio is not null and fin is not null and fin>=inicio),
    'eventos_tardios',base.eventos_tardios,
    'eventos_duplicados',duplicados.eventos_duplicados,
    'eventos_totales',base.eventos_totales
  ) into v_actual from base, duplicados;

  with eventos_previos as (
    select e.*, s.domicilio, s.origen_modelo
    from public.eventos_registro_conductor e
    left join public.solicitudes_conductor s on s.id=e.solicitud_id
    where e.creado_en>=v_desde_anterior and e.creado_en<v_hasta_anterior
      and (p_zona is null or coalesce(e.zona, s.domicilio->>'estado', 'sin_zona')=p_zona)
      and (p_fuente is null or coalesce(e.fuente, s.origen_modelo, 'sin_fuente')=p_fuente)
      and (p_empresa_id is null or e.empresa_id=p_empresa_id)
  ),
  solicitudes_previas as (
    select s.*
    from public.solicitudes_conductor s
    where s.creado_en<v_hasta_anterior and coalesce(s.enviado_en,s.actualizado_en,s.creado_en)>=v_desde_anterior
      and (p_zona is null or coalesce(s.domicilio->>'estado','sin_zona')=p_zona)
      and (p_fuente is null or coalesce(s.origen_modelo,'sin_fuente')=p_fuente)
  ),
  base_previa as (
    select
      count(distinct sesion_id) filter (where evento='registro_iniciado')::int as solicitudes_iniciadas,
      count(*) filter (where evento='otp_error')::int as errores_otp,
      count(*) filter (where evento='rpc_error')::int as errores_rpc,
      count(*) filter (where evento='documento_fallo')::int as fallos_documentos
    from eventos_previos
  )
  select jsonb_build_object(
    'solicitudes_iniciadas',base_previa.solicitudes_iniciadas,
    'solicitudes_enviadas',(select count(*) from solicitudes_previas where enviado_en>=v_desde_anterior and enviado_en<v_hasta_anterior),
    'conversion_envio_pct',case when base_previa.solicitudes_iniciadas=0 then 0 else round(((select count(*) from solicitudes_previas where enviado_en>=v_desde_anterior and enviado_en<v_hasta_anterior)::numeric/base_previa.solicitudes_iniciadas)*100,2) end,
    'errores_otp',base_previa.errores_otp,
    'errores_rpc',base_previa.errores_rpc,
    'fallos_documentos',base_previa.fallos_documentos
  ) into v_anterior
  from base_previa;

  select coalesce(jsonb_agg(jsonb_build_object('paso',paso,'total',total) order by paso),'[]'::jsonb)
  into v_abandonos
  from (
    select s.paso_actual as paso,count(*)::integer as total
    from public.solicitudes_conductor s
    where s.creado_en<v_hasta and coalesce(s.enviado_en,s.actualizado_en,s.creado_en)>=v_desde
      and s.actualizado_en<least(now(),v_hasta)-interval '24 hours'
      and s.estado in ('borrador','correo_pendiente','datos_incompletos','documentos_pendientes','listo_para_enviar','requiere_correccion')
      and (p_zona is null or coalesce(s.domicilio->>'estado','sin_zona')=p_zona)
      and (p_fuente is null or coalesce(s.origen_modelo,'sin_fuente')=p_fuente)
    group by s.paso_actual
  ) a;

  select coalesce(jsonb_agg(jsonb_build_object('tipo',tipo,'total',total) order by total desc,tipo),'[]'::jsonb)
  into v_rechazados
  from (
    select d.tipo,count(*)::integer as total
    from public.historial_estados_solicitud_conductor h
    join public.documentos_conductor d on d.id=h.documento_id
    join public.solicitudes_conductor s on s.id=h.solicitud_id
    where h.decision='rechazar_documento'
      and h.revisado_en>=v_desde and h.revisado_en<v_hasta
      and (p_zona is null or coalesce(s.domicilio->>'estado','sin_zona')=p_zona)
      and (p_fuente is null or coalesce(s.origen_modelo,'sin_fuente')=p_fuente)
    group by d.tipo
  ) r;

  with detalle as (
    select * from (values
      ('solicitudes_iniciadas','Solicitudes iniciadas','count(distinct sesion_id) where evento=registro_iniciado','eventos_registro_conductor','Sesiones que iniciaron registro.'),
      ('solicitudes_enviadas','Solicitudes enviadas','count(solicitudes_conductor) where enviado_en in periodo','solicitudes_conductor','Expedientes enviados a revisión.'),
      ('conversion_envio_pct','Conversión a envío','solicitudes_enviadas / solicitudes_iniciadas * 100','eventos_registro_conductor + solicitudes_conductor','Porcentaje de inicios que terminaron en envío.'),
      ('errores_otp','Errores OTP','count(*) where evento=otp_error','eventos_registro_conductor','Errores de validación OTP registrados.'),
      ('errores_rpc','Errores RPC','count(*) where evento=rpc_error','eventos_registro_conductor','Errores de guardado o envío reportados.'),
      ('fallos_documentos','Fallos de documentos','count(*) where evento=documento_fallo','eventos_registro_conductor','Fallos técnicos de carga documental.'),
      ('tiempo_promedio_registro_segundos','Registro promedio','avg(enviado_en - creado_en)','solicitudes_conductor','Tiempo de creación a envío.'),
      ('tiempo_promedio_revision_segundos','Revisión promedio','avg(primera_decision - inicio_revision)','historial_estados_solicitud_conductor','Tiempo administrativo de revisión.')
    ) as d(clave,nombre,formula,consulta_referencia,explicacion)
  ),
  valores as (
    select d.*, (v_actual->>d.clave)::numeric as valor from detalle d
  ),
  metas as (
    select v.*, m.objetivo, m.operador, m.severidad,
      case when m.clave is null then false
        when m.operador='max' then v.valor>m.objetivo
        else v.valor<m.objetivo end as alerta
    from valores v left join public.metas_registro_conductor m on m.clave=v.clave and m.activo
  )
  select jsonb_build_object(
    'periodo',jsonb_build_object('desde',p_desde,'hasta',p_hasta),
    'filtros',jsonb_build_object('zona',p_zona,'fuente',p_fuente,'empresa_id',p_empresa_id),
    'metricas',v_actual,
    'comparacion',jsonb_build_object('periodo_anterior',jsonb_build_object('desde',p_desde-v_dias,'hasta',p_desde-1),'metricas',coalesce(v_anterior,'{}'::jsonb)),
    'detalle',(select jsonb_agg(jsonb_build_object(
      'clave',clave,'nombre',nombre,'valor',valor,'formula',formula,'consulta_referencia',consulta_referencia,'explicacion',explicacion,'meta',objetivo,'operador_meta',operador,'alerta',alerta,'severidad',severidad
    ) order by clave) from metas),
    'alertas',coalesce((select jsonb_agg(jsonb_build_object('clave',clave,'nombre',nombre,'valor',valor,'meta',objetivo,'severidad',severidad) order by severidad, clave) from metas where alerta),'[]'::jsonb),
    'segmentos',jsonb_build_object(
      'zona',public.metricas_registro_conductor_segmento(v_desde,v_hasta,'zona',p_zona,p_fuente,p_empresa_id),
      'fuente',public.metricas_registro_conductor_segmento(v_desde,v_hasta,'fuente',p_zona,p_fuente,p_empresa_id),
      'empresa',public.metricas_registro_conductor_segmento(v_desde,v_hasta,'empresa',p_zona,p_fuente,p_empresa_id)
    ),
    'abandono_por_paso',coalesce(v_abandonos,'[]'::jsonb),
    'documentos_rechazados_por_tipo',coalesce(v_rechazados,'[]'::jsonb),
    'calidad_datos',jsonb_build_object('eventos_tardios',v_actual->'eventos_tardios','eventos_duplicados',v_actual->'eventos_duplicados','nota','Duplicados se detectan por sesión/evento/paso/código en la misma ventana de minuto; tardíos llegan más de 6h después del timestamp del evento.'),
    'exportacion',jsonb_build_object('recurso','metricas_registro_conductor','formato','csv','requiere_permiso','exportaciones:crear')
  ) into v_resultado;

  insert into public.auditoria_admin_seguridad(auth_user_id,admin_id,tipo,recurso,accion,datos)
  select auth.uid(),a.id,'consulta','metricas_registro_conductor','obtener_v2',
    jsonb_build_object('desde',p_desde,'hasta',p_hasta,'zona',p_zona,'fuente',p_fuente,'empresa_id',p_empresa_id)
  from public.admins a where a.auth_user_id=auth.uid();

  return v_resultado;
end;
$$;

revoke all on function public.registrar_evento_registro_conductor_v2(uuid,text,smallint,text,integer,text,text,uuid,timestamptz) from public;
revoke all on function public.metricas_registro_conductor_segmento(timestamptz,timestamptz,text,text,text,uuid) from public;
revoke all on function public.obtener_metricas_registro_conductor_v2(date,date,text,text,uuid) from public;
grant execute on function public.registrar_evento_registro_conductor_v2(uuid,text,smallint,text,integer,text,text,uuid,timestamptz) to anon, authenticated, service_role;
grant execute on function public.obtener_metricas_registro_conductor_v2(date,date,text,text,uuid) to authenticated, service_role;

comment on function public.obtener_metricas_registro_conductor_v2(date,date,text,text,uuid) is
  'Métricas oficiales de registro de conductores con comparación, segmentos, formulas, metas, calidad de datos y auditoría.';
