# @ruum/app-conductor

PRD §14 — instrucción operativa: **"La App Conductor debe enfocarse en
ejecución guiada, seguridad e incidencia rápida."**

PRD §16.8 — idea central: la app debe responder tres preguntas en segundos:
**¿qué viajes tengo disponibles? ¿qué viajes ya acepté? ¿cuánto voy a cobrar?**

## Pantallas construidas (Fase 4, primer corte)

- `/` — Panel: disponibilidad, resumen de la semana, próximo depósito (PRD §16.2).
- `/viajes` — Viajes disponibles y aceptados como pestañas (PRD §16.3), con elegibilidad evaluada en vivo
  (`esElegibleParaViaje`, `@ruum/shared/rules`) y botón de aceptar conectado de verdad a la base.
- `/viajes/[id]` — Detalle del viaje (mismo Pasaporte Digital que usa app-usuario), con el siguiente paso del
  camino feliz como acción contextual (`TRANSICIONES`, `@ruum/shared/states`).
- `/viajes/[id]/evidencia` — Checklist de los 5 ángulos obligatorios (PRD §4.4), completitud evaluada en vivo
  (`evidenciaCompleta`) y confirmación que avanza el estado real del traslado.
- `/ganancias` — Mis ganancias (PRD §16.4), consulta básica.

Validado con un `next build` real: las 5 rutas compilan y generan páginas correctamente. Con `next start` se
confirmó contenido real en el HTML crudo de Panel, Detalle y Ganancias. Viajes y Evidencia cargan sus datos vía
`useEffect` en el cliente (muestran "Cargando…" en el HTML crudo antes de hidratarse, que es el comportamiento
esperado de Next.js, no una falla); no fue posible confirmar su contenido post-hidratación con un navegador real
en este entorno de desarrollo — su lógica sigue el mismo patrón ya validado en el wizard de app-usuario
(`useState` + `useEffect` + llamadas a `@ruum/api/services`), pero queda como verificación pendiente en un
entorno real (`pnpm --filter @ruum/app-conductor dev` + navegador).

## Dos bugs reales encontrados al construir estas pantallas

No eran del código de esta app — eran del esquema de Fase 1, nunca antes ejercitado bajo RLS real porque toda la
validación previa corrió como superusuario de Postgres (que ignora RLS por completo):

1. **Ningún conductor podía ver un viaje disponible.** Las políticas de `0005_traslados.sql` solo cubrían "mis
   traslados como usuario" y "mis traslados ya asignados como conductor" — ninguna cubría traslados sin asignar.
   Corregido en `0018_traslados_viajes_disponibles.sql`, con políticas de SELECT y UPDATE probadas con dos
   conductores reales bajo un rol no-superusuario (uno acepta el viaje, el otro deja de verlo y no puede
   "robárselo" con un UPDATE directo).
2. **Recursión infinita en RLS sobre `usuarios`.** La política `titular_ve_usuarios_de_su_empresa` (0002) se
   consulta a sí misma. Esto no solo bloqueaba las pantallas nuevas — bloqueaba **cualquier** consulta real de
   `app-usuario` que tocara `usuarios` o `pasaporte_digital` bajo RLS real, incluyendo su propia pantalla de
   seguimiento. Corregido en `0019_fix_recursion_usuarios.sql` con una función `security definer`, mismo patrón
   que ya usaba `es_admin()`.

## Modo demo vs. datos reales

Igual criterio que app-usuario: sin `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, todo el flujo es
navegable con datos de ejemplo, siempre marcados como tales.

## Pendiente (siguientes cortes de Fase 4)

- Login / sesión de Supabase Auth — sin esto, "viajes aceptados" no puede filtrar por el conductor real de la
  sesión (usa un conductor de relleno, igual que `USUARIO_NUEVO_DEMO` en app-usuario).
- Tabla de ganancias/payouts del conductor — no existe (ver nota en `supabase/migrations/0007_pagos.sql`); la
  pantalla de Ganancias es 100% demo a propósito.
- Columna de disponibilidad en tiempo real en `conductores` — el botón del Panel es solo visual, no persiste.
- Subida real de fotos a Supabase Storage — hoy `registrarAnguloCapturado` inserta el metadato con una URL de
  marcador de posición; el contrato de datos ya es el definitivo, falta conectar el bucket.
- Reporte de incidencia, mapa de seguimiento, configuración (cuenta/documentos/preferencias/soporte) — PRD §16.5.

```
pnpm --filter @ruum/app-conductor dev
```
