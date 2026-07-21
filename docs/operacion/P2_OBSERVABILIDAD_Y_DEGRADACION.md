# P2 — observabilidad, carga y degradación

## Señales mínimas
- `x-request-id` como correlación por petición y `Server-Timing` en exportaciones.
- Endpoint sin caché `/api/observabilidad` para disponibilidad sintética.
- Auditoría separada para denegaciones, mutaciones, aprobaciones y exportaciones.
- Huella SHA-256 y conteo de filas para cada exportación completada.

## Prueba de carga
Ejecutar `BASE_URL=https://staging.example k6 run tests/load/panel-admin-degradacion.js` contra staging aislado. Los umbrales son error <1%, p95 <800 ms y p99 <1500 ms. Repetir degradando Supabase/red y comprobar respuestas 4xx/5xx normalizadas, ausencia de filtraciones y recuperación al retirar la falla.

## Accesibilidad con sesiones reales
Crear manualmente sesiones de operador, finanzas, compliance y dirección en un entorno de staging; guardar cada `storageState` fuera del repositorio y ejecutar `ADMIN_STORAGE_STATE=/ruta/sesion.json pnpm test:a11y:real`. Complementar axe con teclado, zoom 200%, lector de pantalla y contraste en las rutas críticas. Nunca versionar cookies o tokens.
