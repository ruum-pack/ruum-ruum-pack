# Go/No-Go y rollback — App Conductor CLOSE P1

## Go
- Migraciones C3–C5, CLOSE P0 y `20260720000700` aplicadas.
- CI valida versión y `google-services.json`.
- Telemetría parcial: aceptados/duplicados/rechazados se procesan por `localId`.
- Prueba ruta 60 min aprobada.
- Push en abierta/background/cerrada/reinicio aprobado.
- TalkBack sin bloqueadores.
- Galaxy A14 dentro del umbral de batería.
- Logout no pierde pendientes.
- Crash/error nativo aparece en Logcat y estado de tracking.

## No-Go automático
- Pérdida de evidencia o telemetría al salir.
- Tracking se reinicia tras boot con sesión >12 h.
- Duplicados o cola infinita por respuesta parcial.
- Push crítico sin navegación específica.
- Bloqueador TalkBack en viaje, evidencia o emergencia.
- Consumo >15%/h o calentamiento severo en Galaxy A14.

## Rollback
1. Detener rollout mediante feature flag.
2. Mantener backend compatible con la versión anterior.
3. Revertir APK al último artefacto firmado aprobado.
4. No revertir migraciones destructivamente; desplegar migración compensatoria.
5. Invalidar política mínima sólo si impide volver a la versión estable.
6. Registrar versión, hora, alcance, métricas y causa.
7. Reabrir rollout únicamente con nueva evidencia física y aprobación firmada.
