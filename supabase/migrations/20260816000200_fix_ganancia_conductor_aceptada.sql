-- Corrección de visualización de ganancias para conductores en viajes aceptados
--
-- Evita que la ganancia aparezca como NULL ($0.00 en frontend) si el viaje
-- fue asignado por administración o en cualquier flujo donde
-- ganancia_conductor_congelada no se haya establecido todavía.
--
-- Redefine la vista public.pasaporte_digital para incorporar cálculo dinámico alternativo (fallback).

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

  -- Columna de ganancia del conductor.
  -- Si soy el conductor asignado y la ganancia congelada es nula, calculamos en vivo su estimación.
  case
    when c.auth_user_id = auth.uid()
      then coalesce(
        t.ganancia_conductor_congelada,
        public.calcular_pago_conductor(
          c.certificacion_pago,
          coalesce(t.precio_final, t.precio_cotizado)
        )
      )

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
      then coalesce(
        t.ganancia_conductor_congelada,
        public.calcular_pago_conductor(
          c.certificacion_pago,
          coalesce(t.precio_final, t.precio_cotizado)
        )
      )

    else null
  end as ganancia_conductor

from public.traslados t
left join public.vehiculos v
  on v.id = t.vehiculo_id
left join public.conductores c
  on c.id = t.conductor_id;

grant select on public.pasaporte_digital to authenticated;
