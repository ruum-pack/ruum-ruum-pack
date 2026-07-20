-- RT-12 seguimiento — el pago al conductor (certificación → porcentaje, ya
-- definido en certificacion_pago_conductor) nunca se conectó con el monto
-- real del traslado: no existía columna que dijera qué certificación de
-- pago tiene cada conductor, ni función que aplicara el porcentaje sobre la
-- tarifa, ni lugar donde congelar el resultado. Esta migración cierra esas
-- tres piezas y blinda la vista compartida para que el conductor deje de
-- poder leer precio_cotizado/precio_final (la tarifa completa del usuario).

-- 1) Certificación de pago del conductor -------------------------------------
-- Deliberadamente separada de nivel_operativo_vigente (CONCER): esa columna
-- decide qué vehículo puede manejar un conductor; esta decide su % de pago y
-- corresponde a una categoría de certificación/licencia distinta (ver
-- docs/RT-12-modelo-de-tarifas.md, sección "Certificación del chofer"). No se
-- deriva de conductores.licencia_tipo porque ese campo es texto libre
-- autodeclarado en el registro (0049_registro_conductor_completo) y NO está
-- protegido por proteger_campos_conductor (0045) -- usarlo directo reabriría
-- el mismo hueco de auto-escalada que esa migración cerró.
alter table public.conductores
  add column certificacion_pago public.certificacion_conductor not null default 'estandar';

comment on column public.conductores.certificacion_pago is
  'Certificación de pago del conductor (RT-12) -- determina su % de pago vía certificacion_pago_conductor. La asigna admin (Torre de Control) al validar el expediente, no el conductor.';

-- Blindaje H-1 (0045_proteger_campos_conductor): certificacion_pago es tan
-- sensible como nivel_por_experiencia -- un conductor que pudiera
-- auto-asignársela subiría su propio pago de 40% a 52% por su cuenta.
create or replace function public.proteger_campos_conductor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin (Torre de Control) puede tocar cualquier campo.
  if public.es_admin() then
    return new;
  end if;

  if auth.uid() is null or auth.uid() is distinct from old.auth_user_id then
    return new;
  end if;

  if new.auth_user_id                          is distinct from old.auth_user_id
    or new.estado                              is distinct from old.estado
    or new.documentos_vigentes                 is distinct from old.documentos_vigentes
    or new.nivel_por_experiencia               is distinct from old.nivel_por_experiencia
    or new.nivel_por_calificacion              is distinct from old.nivel_por_calificacion
    or new.certificacion_pago                  is distinct from old.certificacion_pago
    or new.calificacion_promedio               is distinct from old.calificacion_promedio
    or new.traslados_completados               is distinct from old.traslados_completados
    or new.suspensiones_activas                is distinct from old.suspensiones_activas
    or new.no_presentaciones_6m                is distinct from old.no_presentaciones_6m
    or new.cancelaciones_sin_justificacion_count is distinct from old.cancelaciones_sin_justificacion_count
    or new.incidencias_graves_6m               is distinct from old.incidencias_graves_6m
    or new.incidencias_graves_12m              is distinct from old.incidencias_graves_12m
    or new.creado_en                           is distinct from old.creado_en then
    raise exception 'No puedes modificar campos operativos o de reputación de tu perfil de conductor.';
  end if;

  return new;
end;
$$;

-- 2) Monto congelado del payout ------------------------------------------------
alter table public.traslados
  add column ganancia_conductor_congelada numeric(10,2);

comment on column public.traslados.ganancia_conductor_congelada is
  'Ganancia del conductor para este traslado, congelada por conductor_acepta_viaje en el momento de aceptación. No se recalcula si cambia la política tarifaria después -- mismo principio que tarifa_normativa_no_negociable (20260718000100).';

-- 3) Cálculo del pago al conductor ----------------------------------------------
create or replace function public.calcular_pago_conductor(
  p_certificacion public.certificacion_conductor,
  p_precio numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_porcentaje numeric;
begin
  if p_precio is null then
    return null; -- aún no hay tarifa fijada; nada que calcular todavía
  end if;
  if p_precio < 0 then
    raise exception 'Precio inválido para calcular el pago del conductor';
  end if;

  select porcentaje into v_porcentaje
  from public.certificacion_pago_conductor
  where certificacion = p_certificacion;

  if v_porcentaje is null then
    raise exception 'No hay porcentaje de pago configurado para la certificación %', p_certificacion;
  end if;

  return round(p_precio * v_porcentaje / 100, 2);
end;
$$;

revoke all on function public.calcular_pago_conductor(public.certificacion_conductor, numeric) from public;
grant execute on function public.calcular_pago_conductor(public.certificacion_conductor, numeric) to authenticated;

-- Envuelve lo anterior resolviendo el precio efectivo del traslado (mismo
-- patrón coalesce que 20260708000050: precio_final si ya existe, si no
-- precio_cotizado) y la certificación de un conductor -- el ya asignado al
-- traslado, o uno específico (p_conductor_id) para estimar oportunidades
-- todavía sin asignar.
create or replace function public.calcular_pago_conductor_traslado(
  p_traslado_id uuid,
  p_conductor_id uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_precio numeric;
  v_conductor_id uuid;
  v_certificacion public.certificacion_conductor;
begin
  select coalesce(precio_final, precio_cotizado), coalesce(p_conductor_id, conductor_id)
    into v_precio, v_conductor_id
  from public.traslados
  where id = p_traslado_id;

  if v_conductor_id is null then
    return null;
  end if;

  select certificacion_pago into v_certificacion
  from public.conductores
  where id = v_conductor_id;

  if v_certificacion is null then
    return null;
  end if;

  return public.calcular_pago_conductor(v_certificacion, v_precio);
end;
$$;

revoke all on function public.calcular_pago_conductor_traslado(uuid, uuid) from public;
grant execute on function public.calcular_pago_conductor_traslado(uuid, uuid) to authenticated;

-- 4) Congelar la ganancia al momento de aceptar el viaje ------------------------
-- Mismo cuerpo que 20260717000200_conductor_aprobado_requerido_para_oportunidades,
-- con la escritura de ganancia_conductor_congelada agregada al UPDATE final.
create or replace function public.conductor_acepta_viaje(p_traslado_id uuid)
returns public.estado_traslado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conductor record;
  v_traslado record;
  v_tipo_ruta text;
  v_nivel_orden int;
  v_nivel_requerido int;
  v_ganancia numeric;
begin
  select *
    into v_conductor
  from public.conductores
  where auth_user_id = auth.uid()
    and estado_expediente = 'aprobado'
    and estado in ('activo', 'modo_prueba_supervisada')
    and documentos_vigentes
    and coalesce(suspensiones_activas, 0) = 0
    and coalesce(incidencias_graves_6m, 0) = 0
  limit 1;

  if v_conductor.id is null then
    raise exception 'Conductor no elegible para aceptar viajes.';
  end if;

  select t.id, t.estado, t.conductor_id, t.tipo_ruta, v.tipo as vehiculo_tipo
    into v_traslado
  from public.traslados t
  join public.vehiculos v on v.id = t.vehiculo_id
  where t.id = p_traslado_id
  for update of t;

  if v_traslado.id is null then
    raise exception 'Traslado no encontrado.';
  end if;

  if v_traslado.estado <> 'pendiente_de_conductor' or v_traslado.conductor_id is not null then
    raise exception 'El viaje ya no está disponible para aceptación.';
  end if;

  v_tipo_ruta := case v_traslado.tipo_ruta
    when 'foraneo' then 'interurbana_mas_100km'
    else 'intraurbana'
  end;

  v_nivel_orden := case v_conductor.nivel_operativo_vigente
    when 'basico' then 1
    when 'ejecutivo' then 2
    when 'luxury' then 3
    when 'coleccion' then 4
    else 0
  end;

  v_nivel_requerido := case
    when v_traslado.vehiculo_tipo = 'coleccion' then 4
    when v_traslado.vehiculo_tipo = 'luxury' then 3
    when v_tipo_ruta = 'interurbana_mas_100km' then 2
    else 1
  end;

  if v_nivel_orden < v_nivel_requerido then
    raise exception 'El nivel operativo del conductor no cubre este viaje.';
  end if;

  v_ganancia := public.calcular_pago_conductor_traslado(p_traslado_id, v_conductor.id);

  update public.traslados
    set estado = 'conductor_asignado',
        conductor_id = v_conductor.id,
        ganancia_conductor_congelada = v_ganancia
  where id = p_traslado_id
    and estado = 'pendiente_de_conductor'
    and conductor_id is null;

  if not found then
    raise exception 'El viaje ya no está disponible para aceptación.';
  end if;

  insert into public.registro_auditoria (traslado_id, evento, actor, actor_id, datos)
  values (
    p_traslado_id,
    'aceptacion_traslado_conductor',
    'conductor',
    v_conductor.id,
    jsonb_build_object('estado_nuevo', 'conductor_asignado', 'ganancia_conductor_congelada', v_ganancia)
  );

  return 'conductor_asignado';
end;
$$;

revoke all on function public.conductor_acepta_viaje(uuid) from public;
grant execute on function public.conductor_acepta_viaje(uuid) to authenticated;

-- 5) Blindar precio_final/precio_cotizado en la vista y exponer la ganancia ----
-- RLS filtra filas, no columnas (mismo principio que 0045): un conductor con
-- acceso de fila a un traslado (asignado o disponible) heredaba también
-- precio_final/precio_cotizado en pasaporte_digital, sin importar que el
-- frontend no los usara -- cualquier llamada directa a la vista se los
-- entregaba igual. Esta función centraliza "quién puede ver la tarifa
-- completa del usuario" (el propio usuario, el titular de su empresa, o
-- admin -- mismo criterio que las policies usuario_ve_sus_traslados y
-- titular_ve_traslados_de_empresa de 0005/0034) para poder anularla
-- condicionalmente en la vista según quién pregunta.
create or replace function public.puede_ver_tarifa_traslado(p_usuario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.es_admin()
    or exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid() and u.id = p_usuario_id
    )
    or exists (
      select 1
      from public.usuarios titular
      join public.usuarios solicitante on solicitante.empresa_id = titular.empresa_id
      where titular.auth_user_id = auth.uid()
        and titular.rol = 'titular_empresa'
        and titular.empresa_id is not null
        and solicitante.id = p_usuario_id
    );
$$;

revoke all on function public.puede_ver_tarifa_traslado(uuid) from public;
grant execute on function public.puede_ver_tarifa_traslado(uuid) to authenticated;

-- Mismo patrón que 20260713000127/20260715000100: las columnas nuevas van al
-- final para no romper el orden existente (CREATE OR REPLACE VIEW no permite
-- insertar en medio -> error 42P16). precio_cotizado/precio_final sí cambian
-- de expresión en su misma posición -- válido mientras el tipo no cambie.
-- Corrección del statement 17 de:
-- 20260720000100_pago_conductor_certificacion_y_ganancia_congelada.sql
--
-- Motivo:
-- CREATE OR REPLACE VIEW no permite cambiar el tipo de una columna existente.
-- Las expresiones CASE pierden el typmod numeric(10,2) y PostgreSQL las
-- interpreta como numeric, provocando SQLSTATE 42P16.
--
-- Sustituir el statement original de CREATE OR REPLACE VIEW por este bloque.

create or replace view public.pasaporte_digital
with (security_invoker = true)
as
select
  t.id as traslado_id,
  t.usuario_id,
  t.vehiculo_id,
  t.conductor_id,
  t.estado,
  t.tiene_incidencia_abierta,
  t.tipo_pago,
  t.causa_fallido,

  case
    when public.puede_ver_tarifa_traslado(t.usuario_id)
      then t.precio_cotizado
    else null
  end::numeric(10,2) as precio_cotizado,

  case
    when public.puede_ver_tarifa_traslado(t.usuario_id)
      then t.precio_final
    else null
  end::numeric(10,2) as precio_final,

  t.creado_en,
  t.actualizado_en,
  v.tipo as vehiculo_tipo,
  v.marca as vehiculo_marca,
  v.modelo as vehiculo_modelo,
  v.anio as vehiculo_anio,
  c.nombre as conductor_nombre,
  c.estado as conductor_estado,
  c.nivel_operativo_vigente as conductor_nivel,
  c.calificacion_promedio as conductor_calificacion,

  (
    select count(*)
    from public.evidencia_fotos ef
    where ef.traslado_id = t.id
      and ef.tipo = 'inicial'
      and ef.sincronizada
  ) as evidencia_inicial_fotos_sincronizadas,

  (
    select count(*)
    from public.evidencia_fotos ef
    where ef.traslado_id = t.id
      and ef.tipo = 'final'
      and ef.sincronizada
  ) as evidencia_final_fotos_sincronizadas,

  (
    select count(*)
    from public.incidencias i
    where i.traslado_id = t.id
      and not i.resuelta
  ) as incidencias_abiertas,

  (
    select coalesce(sum(p.monto), 0)
    from public.pagos p
    where p.traslado_id = t.id
      and p.estado = 'completado'
  ) as monto_pagado,

  t.origen_lat,
  t.origen_lng,
  t.destino_lat,
  t.destino_lng,
  t.distancia_km,
  t.tiempo_estimado_horas,
  v.categoria_tarifa as vehiculo_categoria_tarifa,
  v.gama as vehiculo_gama,
  v.condicion as vehiculo_condicion,
  t.origen_direccion,
  t.origen_ciudad,
  t.origen_referencias,
  t.destino_direccion,
  t.destino_ciudad,
  t.destino_referencias,
  t.contacto_entrega_nombre,
  t.contacto_entrega_telefono,
  t.contacto_recepcion_nombre,
  t.contacto_recepcion_telefono,
  v.color as vehiculo_color,
  v.placas as vehiculo_placas,
  v.vin as vehiculo_vin,

  -- Columna nueva (pago al conductor). Tres casos, en orden:
  -- a) Soy el conductor ya asignado a este traslado:
  --    se muestra mi monto congelado.
  --
  -- b) El traslado sigue disponible, sin conductor asignado, y soy un
  --    conductor autenticado:
  --    se calcula una estimación en vivo de mi propio corte usando mi
  --    certificación; nunca se expone la tarifa cruda ni el corte de otro
  --    conductor.
  --
  -- c) Soy administrador:
  --    se muestra el monto congelado, o null si todavía no se ha aceptado.
  case
    when c.auth_user_id = auth.uid()
      then t.ganancia_conductor_congelada

    when t.estado = 'pendiente_de_conductor'
      and t.conductor_id is null
      then (
        select public.calcular_pago_conductor(
          cc.certificacion_pago,
          coalesce(t.precio_final, t.precio_cotizado)
        )
        from public.conductores cc
        where cc.auth_user_id = auth.uid()
      )

    when public.es_admin()
      then t.ganancia_conductor_congelada

    else null
  end as ganancia_conductor

from public.traslados t
left join public.vehiculos v
  on v.id = t.vehiculo_id
left join public.conductores c
  on c.id = t.conductor_id;

