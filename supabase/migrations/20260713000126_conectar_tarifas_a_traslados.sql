-- RT-12 — Conecta el modelo de tarifas v2 con los datos reales de vehiculos/traslados.
--
-- vehiculos.tipo (sedan/suv/pick_up/van/luxury/coleccion) es un eje distinto
-- (carrocería) al que usa la fórmula de tarifas (peso/complejidad operativa:
-- ligero_a/ligero_b/mediano/camion). Se agrega categoria_tarifa como columna
-- independiente en vez de reutilizar/renombrar el enum existente, para no
-- romper el resto del código que ya depende de tipo_vehiculo.

alter table public.vehiculos
  add column categoria_tarifa public.categoria_tarifa_vehiculo,
  add column gama public.gama_vehiculo,
  add column condicion public.condicion_vehiculo;

comment on column public.vehiculos.categoria_tarifa is
  'Categoría de tarifa (peso/complejidad operativa). La asigna Torre de Control al validar el vehículo -- no la declara el usuario, para evitar que se autoclasifique en una categoría más barata.';
comment on column public.vehiculos.gama is
  'Gama del vehículo para efectos de tarifa. La asigna Torre de Control al validar el vehículo.';
comment on column public.vehiculos.condicion is
  'Condición mecánica del vehículo para efectos de tarifa. Reemplaza en el cálculo al campo libre estado_general_declarado (que el usuario sí puede escribir y por tanto no es confiable para precio).';

alter table public.traslados
  add column distancia_km numeric(8,2),
  add column tiempo_estimado_horas numeric(6,2);

comment on column public.traslados.distancia_km is
  'Distancia de ruta (no línea recta). La captura Torre de Control al generar la cotización.';
comment on column public.traslados.tiempo_estimado_horas is
  'Tiempo estimado de ruta. La captura Torre de Control al generar la cotización.';

-- Rango de distancia, horario y día se derivan -- no se guardan como choice
-- editable, para que no puedan quedar desincronizados de los datos reales
-- del traslado.
create or replace function public.rango_desde_distancia(p_km numeric)
returns public.rango_distancia language sql immutable as $$
  select case
    when p_km <= 15 then 'rango_1'::public.rango_distancia
    when p_km <= 45 then 'rango_2'::public.rango_distancia
    when p_km <= 75 then 'rango_3'::public.rango_distancia
    else 'rango_4'::public.rango_distancia
  end;
$$;

create or replace function public.horario_desde_timestamp(p_ts timestamptz)
returns public.horario_traslado language sql immutable as $$
  select case
    when extract(hour from p_ts at time zone 'America/Mexico_City') between 6 and 19
      then 'diurno'::public.horario_traslado
    else 'nocturno'::public.horario_traslado
  end;
$$;

create or replace function public.dia_desde_timestamp(p_ts timestamptz)
returns public.dia_traslado language sql immutable as $$
  select case
    when extract(isodow from p_ts at time zone 'America/Mexico_City') in (6, 7)
      then 'fin_semana'::public.dia_traslado
    else 'entre_semana'::public.dia_traslado
  end;
$$;

-- Sugerencia de tarifa para un traslado ya existente: toma distancia/tiempo
-- capturados y categoria/gama/condicion del vehículo asignado, deriva
-- rango/horario/dia, y llama a calcular_tarifa_traslado. El horario/día usan
-- fecha_hora_programada si el traslado es programado; si es "lo antes
-- posible" se usa el momento en que se pide la sugerencia (now()).
--
-- Devuelve el número sugerido -- NO escribe precio_cotizado. Emitir la
-- cotización sigue siendo un acto explícito del admin vía admin_emite_cotizacion,
-- que puede usar este número tal cual o ajustarlo antes de confirmar.
create or replace function public.admin_sugerir_tarifa_traslado(p_traslado_id uuid)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_categoria public.categoria_tarifa_vehiculo;
  v_gama public.gama_vehiculo;
  v_condicion public.condicion_vehiculo;
  v_distancia_km numeric;
  v_tiempo_horas numeric;
  v_momento timestamptz;
begin
  if not public.es_admin() then raise exception 'Acceso denegado'; end if;

  select v.categoria_tarifa, v.gama, v.condicion, t.distancia_km, t.tiempo_estimado_horas,
         coalesce(t.fecha_hora_programada, now())
  into v_categoria, v_gama, v_condicion, v_distancia_km, v_tiempo_horas, v_momento
  from public.traslados t
  join public.vehiculos v on v.id = t.vehiculo_id
  where t.id = p_traslado_id;

  if v_categoria is null then raise exception 'Traslado no encontrado o el vehículo aún no tiene categoría de tarifa asignada'; end if;
  if v_gama is null then raise exception 'El vehículo del traslado aún no tiene gama asignada'; end if;
  if v_condicion is null then raise exception 'El vehículo del traslado aún no tiene condición asignada'; end if;
  if v_distancia_km is null or v_tiempo_horas is null then
    raise exception 'El traslado aún no tiene distancia_km / tiempo_estimado_horas capturados';
  end if;

  return public.calcular_tarifa_traslado(
    v_categoria, public.rango_desde_distancia(v_distancia_km), v_gama, v_condicion,
    public.horario_desde_timestamp(v_momento), public.dia_desde_timestamp(v_momento),
    v_distancia_km, v_tiempo_horas
  );
end; $$;

revoke all on function public.admin_sugerir_tarifa_traslado(uuid) from public;
grant execute on function public.admin_sugerir_tarifa_traslado(uuid) to authenticated;
