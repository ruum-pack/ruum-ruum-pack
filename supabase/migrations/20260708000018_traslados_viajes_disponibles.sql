-- Bug real encontrado al construir las pantallas de app-conductor (PRD §3:
-- "el conductor puede ver viajes disponibles solo si cumple criterios de
-- elegibilidad" / PRD §16.3: "Pestaña 1 — Viajes solicitados"). Las políticas
-- de 0005_traslados.sql solo cubren "mis traslados como usuario" y "mis
-- traslados YA ASIGNADOS como conductor" — ninguna permite ver traslados sin
-- asignar. Tal como estaba, ningún conductor podía ver un solo viaje
-- disponible bajo RLS real, aunque la app lo mostrara en modo demo.
--
-- El filtro de ELEGIBILIDAD (nivel CONCER, tipo de vehículo, ruta) sigue
-- siendo responsabilidad de la aplicación (rules/elegibilidad-conductor.ts),
-- no de esta política: RLS aquí solo resuelve visibilidad mínima por
-- estado, igual que el resto de las políticas de esta tabla.
create policy "conductor_ve_viajes_disponibles"
  on public.traslados for select
  using (estado = 'pendiente_de_conductor' and conductor_id is null);

-- Mismo hallazgo, lado de escritura: la política de UPDATE existente
-- ("conductor_actualiza_sus_traslados_asignados", 0005) solo cubre
-- traslados YA asignados (conductor_id en mis traslados) — no permite el
-- acto mismo de aceptar uno disponible, porque antes de aceptar
-- conductor_id es null y nunca coincide con esa condición. USING valida la
-- fila ANTES del update (debe estar disponible); WITH CHECK valida que el
-- resultado sea exactamente "se la asignó a sí mismo" y no a otro conductor
-- ni a otro estado.
create policy "conductor_acepta_viaje_disponible"
  on public.traslados for update
  using (estado = 'pendiente_de_conductor' and conductor_id is null)
  with check (
    estado = 'conductor_asignado'
    and conductor_id in (select id from public.conductores where auth_user_id = auth.uid())
  );
