# CLOSE-FIX — Cierre obligatorio antes del piloto externo

## Cambios aplicados

- La caché del viaje activo se actualiza automáticamente al refrescar el viaje desde `ViajeActivoProvider`.
- Todos los puntos de logout usan `useCerrarSesion` y respetan evidencia/telemetría pendientes.
- Evidencia y telemetría persistentes incluyen y validan `usuarioId`; la cola nativa usa una clave cifrada por usuario.
- El shell offline muestra tracking, traslado, puntos pendientes, última ubicación, último envío y error nativo.
- Android sólo considera conectividad cuando existe `NET_CAPABILITY_VALIDATED`.
- La URL remota se inyecta mediante `RUUM_REMOTE_URL` o `-PruumRemoteUrl=...` y debe usar HTTPS.

## Variables por ambiente

- Desarrollo/staging: `RUUM_REMOTE_URL=https://staging.example`
- Producción: `RUUM_REMOTE_URL=https://app.example`
- GitHub Actions: variable de repositorio `RUUM_CONDUCTOR_REMOTE_URL_STAGING`.

## Evidencia obligatoria antes de Go

CLOSE-FIX-08, 09 y 10 sólo se cierran con evidencia física. Adjuntar versión APK, modelo/Android, fecha, conductor y traslado de prueba, capturas o video, logs y resultado firmado.

### CLOSE-FIX-08 Ruta

Usar `apps/app-conductor/tests/physical/close-09-ruta-60-min.md`. Debe incluir 60 minutos, pantalla bloqueada, cambio de red, túnel/estacionamiento, reinicio y comparación contra Torre de Control.

### CLOSE-FIX-09 Push

Usar `apps/app-conductor/tests/physical/close-10-push-matrix.md`. Ejecutar abierta, background, cerrada y después de reinicio con navegación profunda.

### CLOSE-FIX-10 TalkBack y batería

Usar `close-15-talkback-critical-flows.md` y `close-16-galaxy-a14-battery.md`. Cualquier bloqueo crítico, pérdida de foco, consumo >15%/hora o detención del tracking es No-Go.

## Go/No-Go

Go únicamente cuando las pruebas físicas estén firmadas, no existan pérdidas de cola entre usuarios, y CI compile el APK con Firebase y URL del ambiente correctos. Ante fallo, detener rollout por feature flag y volver al último APK aprobado conforme al runbook CLOSE-P1.
