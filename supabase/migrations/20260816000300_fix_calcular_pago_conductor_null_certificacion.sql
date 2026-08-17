-- Corrección: Manejar certificación NULL en calcular_pago_conductor
--
-- Evita errores P0001 (excepción de base de datos) y HTTP 400 Bad Request
-- al invocar listar_viajes_admin_paginados o consultar pasaporte_digital
-- para viajes que aún no tienen conductor asignado o donde la certificación es NULL.

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
  if p_certificacion is null then
    return null; -- evitar error P0001 si no hay certificación asignada
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
