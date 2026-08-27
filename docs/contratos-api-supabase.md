# Contratos de API y Supabase

Ruum no debe tratar OpenAPI/Swagger como la fuente principal de contrato para todo el backend. La mayor parte de la autoridad vive en Supabase: tipos generados, RLS, RPC PostgreSQL, triggers, Storage, Realtime y Edge Functions.

OpenAPI puede usarse donde aporte valor, especialmente para endpoints HTTP de Edge Functions consumidos como HTTP puro o por terceros. No sustituye la documentacion de contratos SQL ni las pruebas de Postgres real.

## Fuente de Verdad Por Tipo de Contrato

| Superficie | Fuente primaria | Debe documentar | Validacion esperada |
| --- | --- | --- | --- |
| Tablas, vistas y enums | `packages/shared/src/types/supabase.ts` generado desde Supabase | Columnas, tipos, nulabilidad, enums y vistas expuestas | `pnpm db:reset`, `pnpm db:types`, `pnpm --filter @ruum/shared typecheck` |
| RPC PostgreSQL | Migraciones en `supabase/migrations` + servicios en `packages/api/src/services` | Nombre, actor autorizado, parametros, retorno, errores esperados y auditoria | Tests pgtap en `supabase/test` |
| RLS | Politicas en migraciones + matriz SQL | Quien puede leer/escribir, filas visibles, rutas prohibidas por acceso directo | Tests con roles reales en `supabase/test` |
| Triggers y maquinas de estado | Migraciones, `estado_transiciones_validas`, `packages/shared/src/states` | Transiciones permitidas, bloqueos, excepciones y eventos de auditoria | Tests SQL de estados y typecheck de shared |
| Realtime | Servicios `packages/api/src/services/*` + grants/RLS de tablas publicadas | Tabla/canal, payload esperado, permisos SELECT y eventos observados | Tests SQL de visibilidad y pruebas UI cuando aplique |
| Storage | Migraciones de buckets/policies + Edge Functions | Bucket, rutas permitidas, metadatos, sello/validacion, visibilidad publica/privada | Tests SQL/RLS y tests de Edge Function |
| Edge Functions HTTP | `supabase/functions/*` | Metodo, ruta, auth, cuerpo, respuesta, errores, variables de entorno | `deno task check:functions`, `deno task test:functions`, integracion local |

## Criterio Para Usar OpenAPI

Usar OpenAPI solo cuando el contrato sea HTTP y el esquema sea util para consumidores o herramientas externas:

- Edge Functions llamadas directamente por navegador o integraciones externas.
- Webhooks o endpoints que requieran ejemplos de request/response.
- SDKs generados o colecciones de prueba HTTP.

No usar OpenAPI como sustituto para:

- Reglas RLS.
- RPC SQL `security definer`.
- Triggers.
- Eventos Realtime.
- Contratos de Storage.
- Maquinas de estados.
- Auditoria persistida.

## Plantilla Para Documentar Una RPC

Cada RPC sensible debe poder responder esto en la migracion, test o documento del flujo:

| Campo | Contenido esperado |
| --- | --- |
| Nombre | `public.nombre_rpc(...)` |
| Actor | usuario, conductor, admin, sistema o service role |
| Intencion | Accion de negocio en lenguaje operativo |
| Parametros | Nombre, tipo, opcionalidad y origen de cada valor |
| Retorno | Tipo SQL o JSON, incluyendo campos relevantes |
| Autorizacion | Checks internos, RLS complementaria y uso de `security definer` |
| Transacciones | Si agrupa pasos atomicos o si delega a otras funciones |
| Auditoria | Evento escrito en `registro_auditoria` y datos permitidos |
| Errores esperados | Mensajes/SQLSTATE que la UI puede traducir |
| Pruebas | Archivo pgtap que cubre camino feliz, acceso indebido y edge cases |

## Errores

Los errores operativos deben clasificarse sin exponer informacion sensible:

- Error esperado del usuario.
- Error de conectividad.
- Error de autorizacion.
- Fallo de integracion.
- Evento de seguridad.
- Fallo recuperable offline.
- Excepcion inesperada.

Cuando el origen sea SQL, documentar el mensaje estable o SQLSTATE si la UI o el soporte operativo dependen de el. No depender de texto accidental de Postgres para decisiones criticas sin prueba.

## Artefactos Actuales

- Tipos Supabase: `packages/shared/src/types/supabase.ts`.
- Servicios tipados: `packages/api/src/services`.
- Matriz SQL: `docs/sql-test-matrix.md`.
- Edge Functions: `supabase/functions/README.md`.
- Estados de traslado: `packages/shared/src/states`.
- Migraciones/RLS/RPC/triggers: `supabase/migrations`.

## Regla Practica

Si el contrato depende de Postgres, RLS o Realtime, se documenta y prueba como contrato Supabase. Si depende de HTTP puro, OpenAPI puede ser una capa adicional, no la fuente unica.
