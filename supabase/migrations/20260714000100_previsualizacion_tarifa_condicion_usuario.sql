-- Permite que app-usuario previsualice tarifa con la condicion declarada por
-- el usuario. La clasificacion de categoria/gama sigue saliendo del catalogo
-- marca/modelo; Supabase conserva la autoridad del calculo final.

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
security invoker
set search_path = ''
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

revoke all on function public.usuario_previsualizar_tarifa(text, text, numeric, numeric, timestamptz, public.condicion_vehiculo) from public;
grant execute on function public.usuario_previsualizar_tarifa(text, text, numeric, numeric, timestamptz, public.condicion_vehiculo) to authenticated;
