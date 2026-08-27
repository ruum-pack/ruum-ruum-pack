# Correctiva: autorización real por rol administrativo

## Controles implementados

1. **Middleware:** obtiene `rol_operativo` y bloquea rutas no autorizadas, incluidas subrutas dinámicas. Redirige a `/sin-permiso`.
2. **Servicios:** `assertAdminPermission()` valida sesión, fila de admin, rol y permiso antes de lecturas o mutaciones sensibles.
3. **PostgreSQL:** `admin_tiene_permiso(text)` centraliza la matriz de permisos y reemplaza políticas administrativas amplias en usuarios, conductores, pagos, empresas, disputas, reclamos y tarifas.

## Convención

- TypeScript usa permisos con `:`: `tarifas:editar`.
- PostgreSQL usa permisos con `.`: `tarifas.editar`.

Ambas matrices deben cambiarse juntas al agregar un rol o permiso.

## RPC `security definer`

Toda RPC administrativa nueva debe comenzar con una validación explícita:

```sql
if not public.admin_tiene_permiso('dominio.accion') then
  raise exception 'Acceso denegado' using errcode = '42501';
end if;
```

Las RPC históricas que todavía solo llaman `es_admin()` deben migrarse progresivamente a esta comprobación. La capa de servicios ya bloquea las llamadas del panel, pero la validación dentro de cada RPC sigue siendo necesaria para impedir invocaciones directas fuera del cliente oficial.
