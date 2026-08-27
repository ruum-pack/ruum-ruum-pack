# Fase P2 — madurez operativa

## Implementado

- Capacidades granulares con overrides por administrador (`admin_capacidades`), efectivas en PostgreSQL y en los servicios TypeScript mediante `admin_tiene_permiso`.
- Flujo de aprobación dual para solicitudes financieras y sancionadoras, con bloqueo de autoaprobación, expiración, bloqueo de fila y versión optimista.
- Dashboard `/auditoria` con denegaciones, mutaciones y exportaciones.
- Bandeja `/aprobaciones` para solicitudes duales.
- Exportación CSV de pagos protegida por capacidad, límite de 10 000 filas, neutralización de fórmulas, `no-store`, identificador de correlación, huella SHA-256 y auditoría de éxito/fallo.
- Endpoint sintético de salud y cabeceras de correlación/tiempo en exportaciones.
- Prueba k6 con umbrales de error y latencia.
- Suite Playwright + axe para sesiones administrativas reales mediante `ADMIN_STORAGE_STATE`.

## Despliegue

1. Aplicar `20260720001000_p2_madurez_operativa.sql`.
2. Regenerar tipos Supabase con `pnpm db:types`.
3. Ejecutar `pnpm typecheck`, `pnpm build`, `pnpm test:p2`.
4. En staging, ejecutar prueba de carga con k6.
5. Ejecutar auditoría de accesibilidad con una sesión real por rol. Los archivos de sesión contienen credenciales y nunca deben versionarse.

## Límite deliberado

La migración ofrece el control dual y la cola canónica. Cada nueva mutación financiera o sancionadora debe consumir una solicitud aprobada dentro de su RPC transaccional; no se permite volver a introducir escrituras directas desde la UI.
