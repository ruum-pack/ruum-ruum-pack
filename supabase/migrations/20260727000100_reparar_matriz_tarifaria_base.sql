-- Repara despliegues donde la matriz normativa de tarifas quedó incompleta.
-- La función calcular_tarifa_traslado exige una fila por categoría/rango;
-- si falta, la creación/previsualización puede fallar con P0001:
-- "No hay tarifa configurada para ligero_a / rango_3".
--
-- Es idempotente: no pisa importes editados por Torre de Control, solo inserta
-- filas base cuando no existen.

insert into public.tarifas_vehiculo (categoria, rango, base, por_km) values
  ('ligero_a', 'rango_1', 650, 7.00), ('ligero_a', 'rango_2', 700, 7.00), ('ligero_a', 'rango_3', 720, 7.00), ('ligero_a', 'rango_4', 750, 7.00),
  ('ligero_b', 'rango_1', 700, 7.50), ('ligero_b', 'rango_2', 750, 7.50), ('ligero_b', 'rango_3', 780, 7.50), ('ligero_b', 'rango_4', 820, 7.50),
  ('mediano',  'rango_1', 1100, 11.00), ('mediano', 'rango_2', 1800, 11.00), ('mediano', 'rango_3', 2600, 11.00), ('mediano', 'rango_4', 3800, 11.00),
  ('camion',   'rango_1', 1800, 16.00), ('camion',  'rango_2', 3200, 16.00), ('camion',  'rango_3', 4800, 16.00), ('camion',  'rango_4', 7200, 16.00)
on conflict (categoria, rango) do nothing;

insert into public.tarifas_gama (gama, factor) values
  ('entrada', 1.00), ('media', 1.15), ('alta', 1.40), ('premium', 1.80)
on conflict (gama) do nothing;

insert into public.tarifas_condicion (condicion, factor) values
  ('nueva', 1.10), ('seminueva', 1.00), ('rescate_mecanico', 1.25)
on conflict (condicion) do nothing;

insert into public.tarifas_horario (horario, factor) values
  ('diurno', 1.00), ('nocturno', 1.15)
on conflict (horario) do nothing;

insert into public.tarifas_dia (dia, factor) values
  ('entre_semana', 1.00), ('fin_semana', 1.10)
on conflict (dia) do nothing;

insert into public.tarifas_config (id, tarifa_hora, tope_factor_variable)
values (true, 21.50, 2.00)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
