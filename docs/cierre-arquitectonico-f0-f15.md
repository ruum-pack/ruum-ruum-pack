# Cierre arquitectónico F0–F15

Fecha de cierre: 2026-09-12.

## Objetivos de cierre

1. App Usuario: cero accesos directos PostgREST/RPC/Functions desde `apps/app-usuario/src`.
2. Panel Admin: sólo excepciones de Storage expresamente permitidas; toda lectura/mutación de dominio pasa por `@ruum/api`.
3. App Conductor: separar deuda de excepciones infraestructurales. Sólo se permiten Storage/offline y el health probe documentado.
4. Golden Path Fase 15: gate obligatorio de CI contra un Supabase local reconstruido con `db:reset`.

## Resultado de fronteras

El gate `node scripts/check-fronteras.mjs` ya no compara contra deuda histórica. Usa `scripts/fronteras-allowlist.json` y falla ante cualquier acceso no autorizado.

| App | `.from()` raw | Permitidos | Violaciones | `.rpc()` | `.invoke()` |
|---|---:|---:|---:|---:|---:|
| app-usuario | 0 | 0 | 0 | 0 | 0 |
| app-conductor | 6 | 6 | 0 | 0 | 0 |
| panel-admin | 2 | 2 | 0 | 0 | 0 |

Las excepciones permitidas están declaradas por archivo, tipo, máximo y motivo en `scripts/fronteras-allowlist.json`. Un acceso adicional en esos mismos archivos también rompe CI al superar `max`.

## Excepciones de Conductor

- Uploads directos a Supabase Storage para evidencia/comprobantes: necesarios para binarios, cola offline y reintentos locales.
- `app/api/health/route.ts`: probe de infraestructura PostgREST; no ejecuta lógica de dominio.

La persistencia de metadata/filas (`evidencia_fotos`, inspecciones, gastos, traslados, usuarios y documentos) fue movida a módulos de `@ruum/api`.

## Excepciones de Panel

Sólo permanecen dos accesos `storage.from(...)` para buckets de documentos. No quedan `.from()` PostgREST ni `.rpc()` directos en el panel.

## Gate Golden Path

`.github/workflows/ci.yml` contiene el job `architecture-golden-path`, dependiente de `workspace` y `sql-tests`. El job:

1. instala dependencias con lockfile;
2. levanta Supabase local;
3. ejecuta `pnpm db:reset`;
4. ejecuta `pnpm test:e2e:golden`;
5. detiene Supabase incluso ante fallo.

Esto convierte el recorrido Empresa → Operación → Traslado → Asignación → Conductor → Custodia → Tracking → Entrega → Finanzas → Cierre en una condición de merge, no sólo en una prueba disponible manualmente.

## Regla posterior al cierre

- Nuevas consultas/mutaciones de negocio deben implementarse en el módulo de dominio correspondiente de `@ruum/api`.
- No aumentar la allowlist salvo una excepción infraestructural revisada y documentada.
- Storage directo no autoriza acceso PostgREST directo en el mismo archivo: los máximos del allowlist son estrictos.
- `scripts/fronteras-baseline.json` queda únicamente como registro histórico anterior al cierre; ya no es fuente de autorización.
