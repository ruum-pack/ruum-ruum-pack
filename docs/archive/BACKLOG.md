# Backlog panel-admin (PRD / remediación oleada 4)

Ítems conscientes **fuera del corte** de estabilidad + auth UX + operación
básica. No bloquean el uso diario de la Torre de Control.

## Producto / PRD

1. **Comparador de evidencia** inicial vs final en detalle de viaje (fotos
   lado a lado, no solo conteos en pasaporte).
2. **Línea de tiempo dedicada** sobre `registro_auditoria` (hoy hay listado
   básico en `/viajes/[id]`).
3. **Métricas de esquema pendiente**
   - “Programados para hoy” requiere fecha de traslado programada distinta de
     `creado_en` (parcialmente hay `fecha_hora_programada` / modalidad; falta
     producto unificado en dashboard).
   - “Conductores disponibles” en tiempo real sin columna/heartbeat propio.
4. **Roles PRD §17.15** más granulares (Super admin, Validador documental,
   Coordinador CONCER, Comercial) vs enum actual
   `operador|supervisor|finanzas|compliance|direccion`.

## Seguridad / backend

5. **RLS / RPC por `rol_operativo`**: hoy cualquier fila en `admins` pasa
   `es_admin()` con acceso total a datos. El guard de app solo personaliza UX.
   Endurecer por rol solo si compliance lo exige (migración + policies + tests
   SQL).

## Operación

6. **Auditoría masiva remota**: las acciones masivas de `/viajes` viven en
   `localStorage` (disclaimer en UI). Conectar a `registro_auditoria` o RPC.
7. **Configuración editable** (`/configuracion` sigue siendo catálogo
   conceptual marcado “Pronto”).
8. **RPC agregado de contadores** del menú (hoy 7 listados con cache 45s).

Ver también `apps/panel-admin/README.md` § Pendiente.
