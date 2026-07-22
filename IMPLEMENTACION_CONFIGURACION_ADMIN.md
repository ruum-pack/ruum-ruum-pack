# Implementación del módulo de Configuración Admin

## Incluido
- Persistencia real en `public.configuracion_admin`.
- Parámetros iniciales de operación, comunicación, finanzas y seguridad.
- Lectura y edición mediante RPC con permisos efectivos.
- Versionado optimista para impedir sobrescrituras concurrentes.
- Auditoría con motivo, valor anterior, valor nuevo y versión.
- Permisos `configuracion:leer` y `configuracion:editar`.
- Acceso de lectura para supervisor, finanzas, compliance y dirección.
- Edición base para dirección, con posibilidad de overrides mediante Capacidades.
- Integración visual con Capacidades, Auditoría y Tarifas.
- Matriz de roles generada desde la definición efectiva del panel.
- Validación mínima de 10 caracteres y espera de recarga en Capacidades.

## Despliegue requerido
Aplicar la migración:
`supabase/migrations/20260722001500_configuracion_admin_operativa.sql`

Luego desplegar `packages/api` y `apps/panel-admin` de forma conjunta.

## Verificación pendiente del entorno
No fue posible instalar pnpm ni dependencias porque el entorno no tiene acceso al registro npm. El `tsc` global no puede resolver React/Next ni sus tipos sin `node_modules`; por ello no constituye una validación compilada del workspace.
