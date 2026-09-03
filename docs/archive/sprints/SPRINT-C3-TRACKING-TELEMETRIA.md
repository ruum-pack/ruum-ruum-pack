# Sprint C3 — Tracking en segundo plano y telemetría

## Implementación

- `DriverTrackingService`: Foreground Service Android con ubicación Fused Location Provider, notificación persistente, muestreo por estado, cola local y envío por lote.
- `BackgroundTrackingPlugin`: puente Capacitor para iniciar/detener exclusivamente desde un traslado activo y exponer salud a la WebView.
- `TrackingBootReceiver`: recuperación conservadora después de reinicio cuando el viaje quedó marcado activo; registra bloqueo del sistema si Android no permite el reinicio.
- `registrar_telemetria_lote`: RPC `security definer` que autentica al conductor, valida pertenencia, rangos y timestamps, y evita duplicados mediante `local_id`.
- `tracking_salud_traslado`: último estado operativo consultable por Torre de Control.
- `EstadoTrackingGlobal`: estado visible al conductor: compartiendo, pendiente, retrasado, permiso revocado o servicio detenido.

## Permisos progresivos

La ubicación y las notificaciones se solicitan al iniciar un traslado que necesita tracking. `ACCESS_BACKGROUND_LOCATION` queda declarado para escenarios de recuperación/configuración avanzada, pero no debe solicitarse junto con el primer permiso; debe explicarse y solicitarse posteriormente desde una pantalla contextual cuando el fabricante o versión lo requiera.

## Política de muestreo aplicada

- Camino al origen: 20 s / 20 m.
- Traslado: 15 s / 15 m.
- Detenido o sin movimiento: 60 s / 40 m.
- Incidencia/emergencia: 7 s / 5 m.

Android aplica ambas condiciones y además agrupa entregas cuando es posible para reducir consumo.

## Retención

La migración mantiene historial completo. Antes de producción debe fijarse una política jurídica/operativa explícita (por ejemplo, historial granular 90 días y agregado posterior) y automatizarla con una tarea de mantenimiento.
