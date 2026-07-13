-- RT-12 — La vista pasaporte_digital es la única fuente que usa el panel
-- admin para el detalle de un viaje (viajes/[id]/page.tsx). Le faltan las
-- coordenadas de origen/destino y los campos de tarifa -- sin esto, la UI no
-- tiene con qué llamar a Mapbox Directions ni a admin_sugerir_tarifa_traslado.
--
-- Nota: CREATE OR REPLACE VIEW no permite insertar columnas en medio de la
-- lista existente (cambia la posición de columnas ya definidas -> error
-- 42P16 "cannot change name of view column"). Todas las columnas nuevas van
-- al final del select, después de monto_pagado, preservando el orden y
-- nombres de las columnas que ya existían.
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
  -- Columnas nuevas (RT-12) -- deben ir al final.
  t.origen_lat,
  t.origen_lng,
  t.destino_lat,
  t.destino_lng,
  t.distancia_km,
  t.tiempo_estimado_horas,
  v.categoria_tarifa as vehiculo_categoria_tarifa,
  v.gama as vehiculo_gama,
  v.condicion as vehiculo_condicion
from public.traslados t
left join public.vehiculos v on v.id = t.vehiculo_id
left join public.conductores c on c.id = t.conductor_id;

-- Admin necesita poder guardar distancia_km/tiempo_estimado_horas (calculados
-- desde Mapbox Directions) sin abrir escritura general sobre traslados fuera
-- de lo que ya cubre "admin_acceso_total_traslados" -- esa policy ya es
-- for all, así que un update normal desde el cliente (RLS) ya alcanza; no se
-- necesita una función nueva. Se documenta aquí para que quede explícito.
