-- La versión de 6 parámetros de usuario_previsualizar_tarifa (20260714000100)
-- se declaró `security invoker`, a diferencia de la original de 5 parámetros
-- que era `security definer`. catalogo_vehiculos_tarifa solo tiene policy de
-- lectura para admins (es_admin()) -- a propósito, según el comentario de
-- 20260713000129, para que la clasificación no pueda ser leída/gameada por
-- el propio usuario, solo consumida a través de una función de confianza.
-- Con security invoker, la función corre con los privilegios de la persona
-- autenticada normal, que no puede leer esa tabla vía RLS: la subconsulta
-- de catalogar_vehiculo_para_tarifa() no ve ninguna fila (no es un error,
-- RLS simplemente filtra todo) y la función concluye "vehículo no
-- catalogado" para CUALQUIER marca/modelo, exista o no en el catálogo.
-- Se regresa a security definer (mismo patrón ya usado por
-- calcular_tarifa_traslado y admin_sugerir_tarifa_traslado) para restaurar
-- el contexto de confianza original.
create or replace function public.usuario_previsualizar_tarifa(
  p_marca text,
  p_modelo text,
  p_distancia_km numeric,
  p_tiempo_estimado_horas numeric,
  p_fecha_hora timestamptz default null,
  p_condicion public.condicion_vehiculo default 'seminueva'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_categoria public.categoria_tarifa_vehiculo;
  v_gama public.gama_vehiculo;
  v_rango public.rango_distancia;
  v_horario public.horario_traslado;
  v_dia public.dia_traslado;
  v_tarifa numeric;
  v_momento timestamptz := coalesce(p_fecha_hora, now());
begin
  if p_distancia_km is null or p_tiempo_estimado_horas is null then
    return jsonb_build_object('disponible', false, 'motivo', 'Falta distancia o tiempo estimado.');
  end if;

  select categoria_tarifa, gama into v_categoria, v_gama
  from public.catalogar_vehiculo_para_tarifa(p_marca, p_modelo);

  if v_categoria is null or v_gama is null then
    return jsonb_build_object(
      'disponible', false,
      'motivo', 'El vehículo no está en el catálogo automático. Torre de Control enviará la cotización.'
    );
  end if;

  v_rango := public.rango_desde_distancia(p_distancia_km);
  v_horario := public.horario_desde_timestamp(v_momento);
  v_dia := public.dia_desde_timestamp(v_momento);
  v_tarifa := public.calcular_tarifa_traslado(
    v_categoria, v_rango, v_gama, p_condicion, v_horario, v_dia, p_distancia_km, p_tiempo_estimado_horas
  );

  return jsonb_build_object(
    'disponible', true,
    'tarifa', v_tarifa,
    'categoria_tarifa', v_categoria,
    'gama', v_gama,
    'condicion', p_condicion,
    'horario', v_horario,
    'dia', v_dia
  );
end;
$$;
