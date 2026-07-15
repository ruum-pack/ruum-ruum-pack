-- Flujo "Iniciar viaje" de app-conductor (pantallas "Dirígete al punto de
-- inicio" y "Contacto y localización del vehículo"): la vista pasaporte_digital
-- no traía la dirección de origen, los contactos de entrega/recepción ni
-- color/placas/vin del vehículo -- datos que ya existen en traslados y
-- vehiculos pero nunca se expusieron aquí. Sin esto, esas pantallas no
-- tenían con qué mostrar a quién contactar ni cómo identificar el vehículo.
--
-- Mismo patrón que 20260713000127: las columnas nuevas van al final del
-- select para no romper el orden de columnas ya existente (CREATE OR REPLACE
-- VIEW no permite insertar en medio de la lista -> error 42P16).
--
-- RLS: no se requiere ninguna policy nueva. La vista es security_invoker, y
-- tanto "conductor_ve_sus_traslados_asignados" (traslados) como
-- "conductor_ve_vehiculos_de_traslados_relevantes" (vehiculos) ya cubren
-- select de fila completa para el conductor asignado -- estas columnas ya
-- eran legibles por el conductor, solo faltaba proyectarlas en la vista.
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
  t.precio_cotizado,
  t.precio_final,
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
    select count(*) from public.evidencia_fotos ef
    where ef.traslado_id = t.id and ef.tipo = 'inicial' and ef.sincronizada
  ) as evidencia_inicial_fotos_sincronizadas,
  (
    select count(*) from public.evidencia_fotos ef
    where ef.traslado_id = t.id and ef.tipo = 'final' and ef.sincronizada
  ) as evidencia_final_fotos_sincronizadas,
  (
    select count(*) from public.incidencias i
    where i.traslado_id = t.id and not i.resuelta
  ) as incidencias_abiertas,
  (
    select coalesce(sum(p.monto), 0) from public.pagos p
    where p.traslado_id = t.id and p.estado = 'completado'
  ) as monto_pagado,
  -- Columnas nuevas (RT-12).
  t.origen_lat,
  t.origen_lng,
  t.destino_lat,
  t.destino_lng,
  t.distancia_km,
  t.tiempo_estimado_horas,
  v.categoria_tarifa as vehiculo_categoria_tarifa,
  v.gama as vehiculo_gama,
  v.condicion as vehiculo_condicion,
  -- Columnas nuevas (flujo "Iniciar viaje" del conductor).
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
  v.vin as vehiculo_vin
from public.traslados t
left join public.vehiculos v on v.id = t.vehiculo_id
left join public.conductores c on c.id = t.conductor_id;
