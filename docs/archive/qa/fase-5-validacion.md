# Fase 5 - Acta de validacion App Conductor

Estado: pendiente de firma operativa.

Esta acta concentra la evidencia de validacion de Fase 5 para App Conductor. No sustituye los reportes
automatizados de CI; registra la decision operativa sobre dispositivo, ambiente y casos criticos.

## Datos de ejecucion

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

## Politica de artifacts

Se pueden publicar:

- `playwright-report/`
- `results/axe-results.json`
- `.lighthouse-ci/*.html`
- `.lighthouse-ci/*.json`
- `storybook-static/`
- `artifacts/a11y/`
- `test-results/`
- capturas de pantalla sanitizadas

No se deben publicar:

- sesiones Playwright o cookies;
- tokens;
- evidencia real de vehiculos;
- URLs firmadas;
- datos personales;
- documentos;
- VIN, placas completas o telefonos reales.

Retencion esperada:

- Pull request: 14 dias.
- `main` / `release`: 90 dias.

## Casos

### OP-OFF-01

| Campo | Valor |
| --- | --- |
| ID | OP-OFF-01 |
| Caso | App ya abierta y luego pierde red |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Debe conservar la pantalla actual y no borrar el viaje activo por error temporal de red |

### OP-OFF-02

| Campo | Valor |
| --- | --- |
| ID | OP-OFF-02 |
| Caso | App en segundo plano y pierde red |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Al volver a primer plano debe conservar ultimo estado conocido si el proceso sigue vivo |

### OP-OFF-03

| Campo | Valor |
| --- | --- |
| ID | OP-OFF-03 |
| Caso | App cerrada y se intenta abrir sin red |
| Resultado | RIESGO ACEPTADO PARA PILOTO |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | `apps/app-conductor/tests/android/offline-startup-validation.md` |
| Incidencias | Offline de arranque no soportado por shell remoto |
| Decision | Piloto: app debe permanecer abierta durante el traslado; Produccion: abrir iniciativa de shell local operativo |
| Observaciones | No debe comunicarse como offline completo |

### OP-OFF-04

| Campo | Valor |
| --- | --- |
| ID | OP-OFF-04 |
| Caso | App cerrada con viaje activo y evidencia pendiente |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Verificar que la cola local conserve evidencia y que la app no prometa recuperar viaje activo sin red |

### EV-PRV-01

| Campo | Valor |
| --- | --- |
| ID | EV-PRV-01 |
| Caso | Evidencia privada visible con signed URL despues de recargar |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Confirmar que `evidencia_fotos.url` guarda path relativo y la UI resuelve URL temporal |

### EV-QUE-01

| Campo | Valor |
| --- | --- |
| ID | EV-QUE-01 |
| Caso | Recuperacion de evidencia despues de reinicio |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Ejemplo esperado: sincronizacion en menos de 30 segundos despues de recuperar red |

### GEO-01

| Campo | Valor |
| --- | --- |
| ID | GEO-01 |
| Caso | Confirmacion dentro de 500 m |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Debe avanzar sin confirmacion excepcional |

### GEO-02

| Campo | Valor |
| --- | --- |
| ID | GEO-02 |
| Caso | Confirmacion fuera de 500 m |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | Debe pedir doble confirmacion y auditar distancia |

### AND-CAM-01

| Campo | Valor |
| --- | --- |
| ID | AND-CAM-01 |
| Caso | Permisos de camara: concedido, denegado, denegado permanente y retorno desde ajustes |
| Resultado | Pendiente |
| Dispositivo | Pendiente |
| Version Android | Pendiente |
| Commit | Pendiente |
| Evidencia | Pendiente |
| Incidencias | Pendiente |
| Decision | Pendiente |
| Observaciones | No debe entrar en bucle de solicitud y debe permitir repetir captura |

### AND-BKP-01

| Campo | Valor |
| --- | --- |
| ID | AND-BKP-01 |
| Caso | Seguridad de backup Android |
| Resultado | PASS tecnico |
| Dispositivo | No aplica |
| Version Android | No aplica |
| Commit | Pendiente |
| Evidencia | `apps/app-conductor/test/android-backup-security.test.ts` |
| Incidencias | Validacion nativa Gradle pendiente por falta de `JAVA_HOME` en el entorno local |
| Decision | `allowBackup=false` y reglas defensivas de exclusion |
| Observaciones | Los datos operativos sensibles no deben incluirse en backups de dispositivo |

## Incidencias abiertas

| ID | Severidad | Descripcion | Responsable | Estado |
| --- | --- | --- | --- | --- |
| F5-OFF-BOOT | Alta | No existe arranque offline completo con app cerrada y sin red | Tecnologia / Producto / Operacion | Riesgo aceptado para piloto, iniciativa requerida para produccion |
| F5-ANDROID-DEVICE | Alta | Matrices Android requieren ejecucion en dispositivo real/emulador | QA | Pendiente |

## Decision final

| Area | Responsable | Decision | Fecha |
| --- | --- | --- | --- |
| Producto | Pendiente | Pendiente | Pendiente |
| Operacion | Pendiente | Pendiente | Pendiente |
| Tecnologia | Pendiente | Pendiente | Pendiente |

