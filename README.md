# Ruum Ruum by MoviliaX — Monorepo

Con apego estricto al PRD Funcional v1.3. Este repo corresponde a la
**Fase 1** del orden de construcción funcional (PRD §14): reglas de
negocio → roles y permisos → estados del traslado, antes de construir
flujos, pantallas o manejo offline.

## Resumen

- **`packages/shared`** — tipos, reglas de negocio puras, estados/transiciones,
  constantes y utilidades, mapeados 1:1 a las secciones del PRD citadas en
  cada archivo. **107 tests unitarios en verde** (`pnpm test:unit`).
- **`supabase/migrations/0001–0020`** — esquema completo (ver tablas en
  "Fase 1 — COMPLETA", "Fase 1 — Extensión" y "Fase 2" más abajo), validado
  contra una instancia real de Postgres durante el desarrollo, no solo
  escrito.
- **`packages/shared/src/types/supabase.ts`** — tipos TypeScript del esquema
  completo. **Nota:** se escribieron a mano reflejando el esquema validado,
  porque `supabase gen types --db-url` requiere Docker/Podman para el
  contenedor `postgres-meta` y no estaba disponible al generarlos. En cuanto
  tengas Docker corriendo, `pnpm db:reset && pnpm db:types` los regenera con
  el comando oficial (deberían salir equivalentes).
- **Typecheck limpio en los 6 workspaces** (`pnpm typecheck`) y
  **`pnpm install` validado de punta a punta** sobre los 7 workspaces.

## Decisiones de negocio que el PRD deja abiertas (no inventadas en el código)

El PRD es explícito en que ciertos valores quedan pendientes de validación
con Admin, Legal o el proveedor correspondiente. El código respeta eso: en
vez de inventar números, expone el punto de configuración y lo documenta:

- **`rules/traslado-fallido.ts`** — el PRD solo fija el 50% de descuento en
  segundo intento para "vehículo no enciende imputable al cliente" (§4.2).
  El % de cargo en sí para las demás causas NO está en el PRD.
- **`rules/cobertura-seguro.ts`** — el PRD (§4.9, nota al pie) dice
  textualmente que deducible y tiempos de resolución deben validarse con la
  aseguradora; el código solo modela el flujo de estados, sin montos.
- **`rules/modo-prueba-supervisada.ts`** — el número de traslados monitoreados
  lo asigna Admin caso por caso (§4.13); no hay un valor fijo en el PRD.
- **`constants/metodos-pago.ts`** — el PRD prohíbe efectivo pero no enumera
  proveedores de pago específicos.

## Fase 1 — COMPLETA

Todas las reglas y tipos de `packages/shared` ahora tienen su tabla
correspondiente en Supabase. Las 14 migraciones se aplicaron y probaron
contra una instancia real de Postgres (no solo se escribieron):

| Migración | Contenido | PRD |
|---|---|---|
| `0001` | roles, `admins`, helper `es_admin()` | §3 |
| `0002` | `usuarios` | §4.1, §4.6 |
| `0003` | `conductores` CONCER, columna generada `nivel_operativo_vigente` | §4.3, §4.13 |
| `0004` | `vehiculos` | §4.2 |
| `0005` | `traslados`, 32 estados, **trigger que rechaza transiciones inválidas** | §6 |
| `0006` | `evidencia_fotos` | §4.4 |
| `0007` | `pagos`, constraint que rechaza efectivo | §4.6 |
| `0008` | `incidencias` + vista `pasaporte_digital` | §8, §5.1 |
| `0009` | `calificaciones_traslado`, **trigger que recalcula el promedio del conductor** | §4.13 |
| `0010` | `modo_prueba_supervisada`, exclusion constraint (no 2 periodos activos) | §4.13 |
| `0011` | `disputas` | §4.14 |
| `0012` | `reclamos_seguro` (solo flujo de estados, sin montos — ver nota PRD) | §4.9 |
| `0013` | `mensajes_chat`, `llamadas_enmascaradas` | §4.12 |
| `0014` | `registro_auditoria`, 32 eventos auditables | §16 |

Puntos validados con datos reales durante el desarrollo (no solo SQL leído):
- Una transición de estado inválida (`documentacion_pendiente → traslado_en_curso`) se rechaza.
- Un pago en efectivo se rechaza.
- Insertar una calificación recalcula `conductores.calificacion_promedio` automáticamente.
- Insertar un segundo periodo de prueba supervisada activo para el mismo conductor se rechaza.
- `supabase/seed.sql` corre de punta a punta (usuario → vehículo → conductor → traslado → evidencia → pago → calificación) y la vista `pasaporte_digital` agrega todo correctamente.

**`packages/shared/src/types/supabase.ts`** ya incluye las 14 tablas/vista.
Sigue siendo escrito a mano (ver nota arriba sobre Docker); regenéralo con
`pnpm db:types` en cuanto tengas Docker disponible.

### Qué NO está en Fase 1 (a propósito, son fases posteriores del PRD §14)

- Pantallas de `apps/app-usuario`, `apps/app-conductor`, `apps/panel-admin`.
- `packages/ui` (componentes) y `packages/api/services` (capa de servicios).
- RPC functions para flujos compuestos (ej. "aceptar traslado", "cerrar
  servicio") — hoy solo existen las tablas y sus constraints; la
  orquestación de varios pasos en una sola transacción es trabajo de la fase
  de servicios.
- Manejo offline real (PRD §4.15) — la columna `local_path` existe en
  `evidencia_fotos`, pero la cola de sincronización es lógica de cliente, no
  de base de datos.

## Fase 1 — Extensión (sesión de arquitectura, 2026-06-27)

Al revisar el PRD para alinear una propuesta de arquitectura técnica con lo
que ya existía aquí, salieron dos vacíos reales y se llenaron con tres
migraciones nuevas, validadas contra Postgres real igual que las 14
anteriores (no solo escritas):

| Migración | Contenido | Por qué |
|---|---|---|
| `0015` | `empresas`, FK real en `usuarios.empresa_id` (antes un uuid suelto), trigger `validar_limite_empresa()` | El PRD §3 define "máximo dos usuarios internos por empresa" desde el principio; `usuarios.rol`/`empresa_id` ya lo anticipaban desde 0001/0002, pero la tabla nunca se construyó |
| `0016` | `conductores.cancelaciones_sin_justificacion_count` | El PRD §4.8 solo define consecuencias por no presentación (no llegar); cancelación activa de un traslado ya aceptado, sin justificación, quedó sin regla. Resuelto: 1ra = `suspendido_30d`, 2da+ = `bloqueado_permanente` (ver `rules/cancelacion-conductor.ts`) |
| `0017` | `reclamos_seguro.responsable_pago` (`aplicacion` \| `conductor`, nunca `usuario`), con constraint que exige el campo antes de poder marcar `resuelto` | El deducible nunca se carga al usuario, sin distinción de severidad del daño (mayor o menor). No incluye montos — siguen pendientes de validación con la aseguradora, igual que la nota original de esta tabla en `0012` |

Probado con datos reales, no solo SQL leído:
- Intentar agregar un segundo `titular_empresa` a la misma empresa se rechaza.
- Intentar marcar un reclamo como `resuelto` sin `responsable_pago` se rechaza; asignar `'usuario'` como responsable se rechaza (el CHECK solo permite `aplicacion`/`conductor`).
- Las 17 migraciones se aplicaron en orden contra una base nueva, seguidas de `supabase/seed.sql`, sin tocar nada anterior.
- **107 tests unitarios en verde** (99 anteriores + 8 nuevos: `limite-empresa.test.ts`, `cancelacion-conductor.test.ts`).

`packages/shared/src/types/supabase.ts` ya incluye `empresas` y las columnas
nuevas. Sigue escrito a mano por la misma razón de siempre (Docker).



## Fase 2 — Mapa de pantallas (COMPLETA)

Las 3 apps tienen pantallas reales (no scaffold), con Tailwind v4, sistema de diseño compartido en
`packages/ui`, capa de servicios en `packages/api/services`, y las reglas de `packages/shared` conectadas en
vivo (no texto estático).

### `apps/app-usuario` — 5 pantallas (primer corte)

Landing, registro, wizard de nuevo traslado, detalle del Pasaporte Digital. Validado con `next build` real y
contenido confirmado en el HTML de cada ruta. Detalle completo en `apps/app-usuario/README.md`.

### `apps/app-conductor` — 5 pantallas (primer corte)

Panel, Viajes (disponibles/aceptados), Detalle del viaje, Evidencia y Mis ganancias. Reutiliza el mismo
Pasaporte Digital, sistema de diseño y disciplina de modo demo que `app-usuario`. Detalle completo en
`apps/app-conductor/README.md`.

Al construir estas pantallas salieron dos bugs reales del esquema de Fase 1 — ninguno del código nuevo — que
nunca se habían detectado porque toda la validación anterior corrió como superusuario de Postgres, que ignora
RLS por completo:

| Migración | Bug corregido |
|---|---|
| `0018_traslados_viajes_disponibles.sql` | Ningún conductor podía ver ni aceptar un viaje disponible: las políticas de `0005` solo cubrían traslados ya asignados |
| `0019_fix_recursion_usuarios.sql` | Recursión infinita en RLS sobre `usuarios` (política `titular_ve_usuarios_de_su_empresa` de 0002 se consulta a sí misma) — esto bloqueaba **cualquier** query real de `app-usuario` bajo RLS, no solo lo nuevo |

Ambos se probaron con un rol no-superusuario real (`set role authenticated` + `auth.uid()` simulando una
sesión), no solo con SQL leído — incluyendo el caso de "Conductor B intenta robarse el viaje de Conductor A con
un UPDATE directo", que correctamente afecta 0 filas.

### `apps/panel-admin` — 6 pantallas (cierre de la fase)

Dashboard, Viajes (con pestañas de estatus), Detalle administrativo del viaje (asignar conductor, cambiar
estatus, notas internas), Conductores, Usuarios e Incidencias. Layout de consola con barra lateral, distinto al
de las apps móviles (PRD §17.1: plataforma web de pantalla amplia). Detalle completo en
`apps/panel-admin/README.md`.

Gap real encontrado: no existía tabla para "notas internas" (PRD §17.4, bloque 7) — agregada en
`0020_notas_internas_traslado.sql`, solo accesible para Admin, probada con una inserción real bajo RLS.

A diferencia de las otras dos apps, **todas** las pantallas de `panel-admin` cargan datos vía `useEffect` en el
cliente; no fue posible confirmar su contenido post-hidratación con un navegador real en este entorno de
desarrollo (mismo límite que las 2 pantallas equivalentes de `app-conductor` — ver su README). `next build` sí
se validó con éxito para las 6 rutas.

## Termux / Android

Turborepo se distribuye como binario nativo y no tiene build para
`android-arm64` (la plataforma que reporta Termux), así que `pnpm typecheck`,
`pnpm test` y `pnpm test:unit` fallarán ahí con
`Turborepo does not presently support your platform`. Usa estos scripts
alternos, que usan únicamente `pnpm` (sin Turbo) y están validados:

```bash
pnpm run typecheck:android
pnpm run test:unit:android
```

`pnpm db:start` tampoco funciona en Termux (depende de Docker, que Android no
soporta sin root). Usa el Postgres nativo de Termux (`pkg install postgresql`)
y aplica las migraciones directamente con `psql -f supabase/migrations/...`.

## Cómo arrancar en Windows

```powershell
# Descomprime el zip donde quieras el proyecto, luego dentro de esa carpeta:
corepack enable
pnpm install

# Validar que todo sigue en verde en tu máquina:
pnpm typecheck
pnpm test:unit

# Supabase local (requiere Docker Desktop corriendo):
pnpm db:start
pnpm db:reset    # aplica las 3 migraciones + supabase/seed.sql
pnpm db:types    # genera packages/shared/src/types/supabase.ts
```

## Por qué este repo no repite los errores de la sesión anterior

Dos bugs reales causaron horas de retrabajo en PowerShell y quedaron
corregidos aquí:

1. **Filtro de Turbo incorrecto.** `turbo run test --filter=./packages/...`
   usa sintaxis de filtro de **pnpm** (`...` = incluir dependientes) dentro
   de un comando de **Turbo**, que tiene su propia sintaxis (`./packages/*`).
   Turbo lo aceptaba sin error pero matcheaba 0 paquetes ("Packages in
   scope: " vacío). Corregido en `package.json` → `test:unit`.
2. **Columna generada de Postgres rota.** El `CASE ... WHEN 1 THEN ... END`
   para `nivel_operativo_vigente` tenía una elipsis `...` literal en vez de
   repetir la expresión `LEAST(...)`, y nunca se probó contra una base real.
   Aquí se corrigió y se validó insertando filas de prueba (ver tabla de
   resultados en el desarrollo de esta sesión).

## Estructura

```
apps/
  app-usuario/  app-conductor/  panel-admin/  ← 5-6 pantallas reales cada una (Fase 2, COMPLETA)
packages/
  shared/         ← núcleo de la Fase 1 (types, rules, states, constants, utils)
  ui/             ← sistema de diseño compartido (carbon/paper/signal-orange)
  api/            ← cliente Supabase + services
supabase/
  migrations/     ← 0001 a 0020 (ver tablas en "Fase 1 — COMPLETA", "Fase 1 — Extensión" y "Fase 2")
  seed.sql        ← datos de ejemplo, ciclo completo de un traslado
  config.toml
```
