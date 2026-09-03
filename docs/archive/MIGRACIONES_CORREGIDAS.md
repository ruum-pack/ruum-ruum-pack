# Corrección de migraciones — Panel Admin

## Cambio realizado

Se restauró `supabase/migrations/20260717000400_llegada_destino_audita_geocerca.sql` con su contenido original de geocerca.

El archivo había sido sobrescrito accidentalmente con SQL de autorización administrativa, incluyendo:

- creación duplicada de `admin_tiene_permiso`;
- creación anticipada de `rol_operativo`;
- políticas administrativas duplicadas;
- referencias a la tabla eliminada `public.tarifas_admin`.

## Orden administrativo conservado

- `20260719000100_admin_roles_operativos.sql`: crea enum y columna `rol_operativo`.
- `20260720000800_p0_seguridad_auditoria_transacciones.sql`: crea permisos base, auditoría y RPC transaccionales.
- `20260720001000_p2_madurez_operativa.sql`: agrega capacidades individuales, aprobación dual y redefine el permiso efectivo.

## Verificaciones realizadas

- No existen timestamps duplicados de migración.
- No existen referencias a `public.tarifas_admin` después de la migración que elimina esa tabla.
- `rol_operativo` se crea antes de ser utilizado por P0/P2.
- `admin_tiene_permiso` solo se define en P0 y se amplía posteriormente en P2.
- Las pruebas estructurales del panel ejecutan 16/17; la única falla restante corresponde al componente de auditoría, no a las migraciones.

## Comandos recomendados

```bash
supabase stop --no-backup
supabase start
supabase db reset --debug
```

Después de una migración correcta:

```bash
pnpm db:types
pnpm typecheck
pnpm lint
pnpm build
```
