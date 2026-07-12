-- Bug encontrado en /viajes de app-conductor: "No se pudo validar
-- elegibilidad: el viaje no tiene tipo de vehículo" aparecía siempre, aunque
-- el vehículo del traslado sí tuviera tipo definido.
--
-- Causa: public.pasaporte_digital (20260708000008) es `security_invoker`,
-- así que su LEFT JOIN a public.vehiculos corre con las políticas RLS de
-- quien consulta. La migración de vehiculos (20260708000004) documentaba
-- en un comentario que el conductor recibiría acceso "vía join desde
-- traslados (migración 0005)", pero esa política nunca se creó: vehiculos
-- solo tenía policies para el usuario dueño y para admin. Para cualquier
-- conductor, v.tipo/marca/modelo siempre volvía null.
--
-- Se otorga SELECT sobre vehiculos al conductor autenticado solo para los
-- vehículos de traslados relevantes para él: los que están disponibles para
-- aceptar (pendiente_de_conductor, sin importar quién) y los que ya tiene
-- asignados (conductor_id = el suyo). No se expone el resto de vehículos de
-- otros usuarios/traslados.
create policy "conductor_ve_vehiculos_de_traslados_relevantes"
  on public.vehiculos for select
  using (
    exists (select 1 from public.conductores c where c.auth_user_id = auth.uid())
    and id in (
      select t.vehiculo_id
      from public.traslados t
      where t.estado = 'pendiente_de_conductor'
         or t.conductor_id in (
           select c.id from public.conductores c where c.auth_user_id = auth.uid()
         )
    )
  );
