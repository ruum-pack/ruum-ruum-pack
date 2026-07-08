-- Bug real de producto encontrado en producción (2026-06-29): el nivel
-- Básico exige calificacion_promedio >= 4.0 (PRD §4.13), pero un conductor
-- recién registrado arrancaba en 0 — ningún conductor nuevo podía aceptar
-- jamás su primer viaje, ni siquiera en modo_prueba_supervisada, porque el
-- piso de calificación se evalúa igual sin importar el estado.
--
-- Decisión de producto (confirmada con el usuario): el conductor inicia con
-- la calificación máxima; el reto es mantenerla — decae con el tiempo solo
-- si el desempeño real es malo. recalcular_calificacion_conductor() ya
-- calcula el promedio únicamente sobre calificaciones reales (avg sobre
-- calificaciones_traslado), así que basta con cambiar el valor de partida:
-- en cuanto exista la primera calificación real, el promedio verdadero la
-- sustituye por completo — el decaimiento sale solo, sin tocar esa lógica.
alter table public.conductores alter column calificacion_promedio set default 5.0;

-- Backfill: solo conductores que nunca han completado un traslado Y siguen
-- en el valor por defecto viejo (0) — nunca toca a alguien con historial
-- real, sin importar qué tan bajo sea ese historial real.
update public.conductores
set calificacion_promedio = 5.0
where calificacion_promedio = 0
  and traslados_completados = 0;

-- Mismo ajuste en el fallback de "sin calificaciones en la ventana de 6
-- meses" — antes devolvía 0 (penalizando a alguien sin datos, igual que el
-- bug original); ahora cae a 5.0, consistente con el valor de partida.
create or replace function public.recalcular_calificacion_conductor(p_conductor_id uuid)
returns void
language plpgsql
as $$
declare
  v_promedio numeric(3,2);
begin
  select round(avg(estrellas)::numeric, 2)
  into v_promedio
  from (
    select estrellas
    from public.calificaciones_traslado
    where conductor_id = p_conductor_id
      and calificado_en >= now() - interval '6 months'
    order by calificado_en desc
    limit 100
  ) ultimas_100;

  update public.conductores
  set calificacion_promedio = coalesce(v_promedio, 5.0)
  where id = p_conductor_id;
end;
$$;
