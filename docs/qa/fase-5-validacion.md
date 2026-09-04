# Fase 5 — Acta de validación App Conductor

Estado: pendiente de firma operativa.

Esta acta concentra la evidencia de validación de Fase 5 para App Conductor. No sustituye los reportes
automatizados de CI; registra la decisión operativa sobre dispositivo, ambiente y casos críticos.

## Datos de ejecución

| Campo | Valor |
| --- | --- |
| Commit | Pendiente |
| Fecha | Pendiente |
| Ambiente | Pendiente |
| Build | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Ejecutor | Pendiente |
| Artifacts CI | `playwright-report`, `axe-results.json`, `.lighthouse-ci`, `storybook-static`, `test-results`, capturas |

## Casos críticos

| Caso | Resultado | Evidencia | Incidencias | Decision |
| --- | --- | --- | --- | --- |
| OP-OFF-01 — App abierta y pérdida de red | Pendiente | Pendiente | Pendiente | Pendiente |
| OP-OFF-02 — App en segundo plano y pérdida de red | Pendiente | Pendiente | Pendiente | Pendiente |
| OP-OFF-03 — Arranque sin red | Riesgo aceptado para piloto | `apps/app-conductor/tests/android/offline-startup-validation.md` | Offline de arranque no soportado por shell remoto | Piloto: mantener la app abierta; Producción: iniciativa de shell local operativo |
| OP-OFF-04 — App cerrada con viaje activo y evidencia pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| EV-PRV-01 — Evidencia privada con signed URL tras recargar | Pendiente | Pendiente | Pendiente | Pendiente |
| EV-QUE-01 — Recuperación de evidencia después de reinicio | Pendiente | Pendiente | Pendiente | Pendiente |
| GEO-01 — Confirmación dentro de 500 m | Pendiente | Pendiente | Pendiente | Pendiente |
| GEO-02 — Confirmación fuera de 500 m | Pendiente | Pendiente | Pendiente | Pendiente |
| AND-CAM-01 — Permisos de cámara y retorno desde ajustes | Pendiente | Pendiente | Pendiente | Pendiente |
| AND-BKP-01 — Seguridad de backup Android | PASS técnico | `apps/app-conductor/test/android-backup-security.test.ts` | Gradle nativo requiere validación con `JAVA_HOME` | `allowBackup=false` y exclusiones defensivas |

## Evidencia y política de artifacts

Los artifacts permitidos son `playwright-report/`, `results/axe-results.json`, `.lighthouse-ci/*.html`,
`.lighthouse-ci/*.json`, `storybook-static/`, `artifacts/a11y/`, `test-results/` y capturas sanitizadas.

No deben publicarse sesiones/cookies, tokens, evidencia real de vehículos, URLs firmadas, datos personales,
documentos, VIN, placas completas ni teléfonos reales. La retención esperada es de 14 días en pull requests
y 90 días en `main`/`release`.

## Incidencias abiertas

| ID | Severidad | Descripción | Responsable | Estado |
| --- | --- | --- | --- | --- |
| F5-OFF-BOOT | Alta | No existe arranque offline completo con app cerrada y sin red | Tecnología / Producto / Operación | Riesgo aceptado para piloto; iniciativa requerida para producción |
| F5-ANDROID-DEVICE | Alta | Las matrices Android requieren ejecución en dispositivo real o emulador | QA | Pendiente |

## Decision final

| Area | Responsable | Decision | Fecha |
| --- | --- | --- | --- |
| Producto | Pendiente | Pendiente de validación del alcance V2 | Pendiente |
| Operacion | Pendiente | Pendiente de firma de matrices de campo | Pendiente |
| Tecnologia | Pendiente | Pendiente de cierre técnico y publicación de artifacts | Pendiente |
