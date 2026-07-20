# CLOSE-FIX-16 — Validación física de rollback

## Precondiciones

- APK actual N y APK anterior N-1 firmadas con la misma clave.
- Backend compatible con ambas versiones.
- Cuenta y traslado de staging.
- Copia de logs y conteos de colas antes de cada paso.

## Procedimiento

1. Instalar N-1 y completar login, push y un viaje de prueba.
2. Actualizar sobre la misma instalación a N; confirmar conservación de sesión y datos permitidos.
3. Generar telemetría y evidencia pendientes controladas.
4. Activar el procedimiento de rollback y detener rollout mediante feature flag.
5. Instalar N-1 mediante el mecanismo de distribución autorizado. Android normalmente impide downgrade directo con `versionCode` menor; usar una build de rollback firmada basada en N-1 con `versionCode` superior, o desinstalación controlada sólo si la política acepta pérdida local.
6. Confirmar login, navegación, push, tracking, lectura del backend y ausencia de payload incompatible.
7. Verificar que no se pierdan datos remotos y documentar cualquier pérdida local esperada.
8. Adjuntar `adb logcat`, capturas, hashes de APK y resultado.

## Criterio de aprobación

- La build de rollback se instala con firma válida.
- El backend acepta sus contratos.
- No hay crash de arranque ni bloqueo por versión mínima.
- Feature flags bloquean funciones incompatibles.
- El procedimiento puede completarse dentro de la ventana operativa definida.

Resultado: [ ] PASS  [ ] FAIL
Ejecutor: __________________  Fecha: __________
