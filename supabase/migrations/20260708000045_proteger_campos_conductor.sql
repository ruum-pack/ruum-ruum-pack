-- Auditoría H-1 — Escalada de privilegios del conductor sobre su propia fila.
--
-- La policy "conductor_actualiza_su_registro" (0003) es
--   for update using (auth.uid() = auth_user_id)
-- SIN with check y SIN trigger de columnas. Como RLS filtra filas y no
-- columnas, un conductor autenticado puede hacer:
--   update conductores set estado='activo', documentos_vigentes=true,
--     nivel_por_experiencia='coleccion', calificacion_promedio=5,
--     no_presentaciones_6m=0 where auth_user_id = auth.uid();
-- y auto-aprobarse, auto-subir de nivel CONCER y borrar sus sanciones.
--
-- La tabla `usuarios` YA recibió exactamente esta protección en 0038
-- (proteger_verificacion_usuario). Esta migración aplica el trigger espejo a
-- `conductores`, cerrando la inconsistencia entre módulos. El conductor
-- conserva la capacidad de editar SUS campos de contacto (nombre, telefono)
-- vía services/conductores.ts::actualizarPerfilConductor — solo se bloquean
-- los campos operativos/reputacionales, que únicamente Admin (o la lógica de
-- servidor: RPC definer, webhooks) pueden mover.

create or replace function public.proteger_campos_conductor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin (Torre de Control) puede tocar cualquier campo: es su trabajo
  -- suspender, reactivar, validar documentos y ajustar nivel.
  if public.es_admin() then
    return new;
  end if;

  -- Cambios que NO provienen del propio conductor (p. ej. RPC security definer
  -- corriendo con otro owner, o procesos de sistema) no se filtran aquí: esta
  -- guardia solo aplica al auto-UPDATE del conductor sobre su propia fila.
  if auth.uid() is null or auth.uid() is distinct from old.auth_user_id then
    return new;
  end if;

  if new.auth_user_id                          is distinct from old.auth_user_id
    or new.estado                              is distinct from old.estado
    or new.documentos_vigentes                 is distinct from old.documentos_vigentes
    or new.nivel_por_experiencia               is distinct from old.nivel_por_experiencia
    or new.nivel_por_calificacion              is distinct from old.nivel_por_calificacion
    -- nivel_operativo_vigente es GENERATED ALWAYS (0003): Postgres ya rechaza
    -- cualquier escritura directa y deriva su valor de los dos nivel_por_*, que
    -- ya están protegidos arriba. No requiere comprobación aquí.
    or new.calificacion_promedio               is distinct from old.calificacion_promedio
    or new.traslados_completados               is distinct from old.traslados_completados
    or new.suspensiones_activas                is distinct from old.suspensiones_activas
    or new.no_presentaciones_6m                is distinct from old.no_presentaciones_6m
    or new.cancelaciones_sin_justificacion_count is distinct from old.cancelaciones_sin_justificacion_count
    or new.incidencias_graves_6m               is distinct from old.incidencias_graves_6m
    or new.incidencias_graves_12m              is distinct from old.incidencias_graves_12m
    or new.creado_en                           is distinct from old.creado_en then
    raise exception 'No puedes modificar campos operativos o de reputación de tu perfil de conductor.';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_campos_conductor on public.conductores;
create trigger proteger_campos_conductor
  before update on public.conductores
  for each row execute function public.proteger_campos_conductor();
