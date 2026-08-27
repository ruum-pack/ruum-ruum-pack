# Cierre P0 antes de producción

## Controles implementados

- Instalación reproducible: Node 24, pnpm 10.0.0, lockfile congelado y verificación `pnpm ci:clean`.
- Configuración: `predev`/`prebuild` validan variables; producción rechaza demo y secretos incompletos.
- Datos demo: solo se habilitan con `NEXT_PUBLIC_PANEL_ADMIN_DEMO=true` fuera de producción; ya no existe fallback por ausencia de Supabase.
- Autorización de rutas: middleware resuelve admin/rol, bloquea rutas y registra denegaciones.
- Autorización de servicios: permisos concretos, error tipado y auditoría de permisos denegados.
- PostgreSQL/RPC: modelo de permisos normalizado, RLS existente reutiliza `admin_tiene_permiso`, RPC sensibles validan permiso.
- Transacciones: validación de documentos de usuario y conductor muta y audita atómicamente en PostgreSQL.
- Auditoría: tabla append-only para accesos denegados, permisos denegados y mutaciones sensibles.
- Pruebas: regresiones P0 de autenticación/autorización, demo, transacciones y CI.

## Comandos de gate

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm ci:clean
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

El despliegue debe ejecutar primero todas las migraciones, incluida
`20260720000800_p0_seguridad_auditoria_transacciones.sql`.
