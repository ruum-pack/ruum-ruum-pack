# COND-CLOSE-17 — Logout con pendientes

Casos:

1. Encolar evidencia offline y confirmar que Cerrar sesión queda bloqueado y muestra conteo.
2. Generar telemetría sin red y confirmar bloqueo con conteo.
3. Recuperar conexión, sincronizar y confirmar que el logout procede.
4. Usar `limpiarSesionIntegral({ force: true })` sólo desde soporte/controlado; verificar que detiene tracking, invalida push y limpia credenciales.
5. Confirmar que ningún logout normal descarta evidencia o puntos pendientes silenciosamente.
