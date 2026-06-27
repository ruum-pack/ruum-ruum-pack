# @ruum/app-usuario

PRD §14 — instrucción operativa: **"La App Usuario debe enfocarse en
confianza, visibilidad y cierre documental."**

## Pantallas construidas (Fase 2, primer corte)

- `/` — landing con los 3 pilares de confianza del producto (PRD §14) y una
  vista previa del Pasaporte Digital con datos de ejemplo.
- `/registro` — alta de cuenta personal/empresa (PRD §3, §4.1).
- `/traslados/nuevo` — wizard de 6 pasos (vehículo → documentos → origen y
  destino → contactos → cotización → confirmación), con las reglas reales de
  `packages/shared` conectadas en vivo: el paso de confirmación muestra el
  momento de pago (`determinarMomentoPago`, PRD §4.6) y el aviso de política
  de cancelación (`calcularCargoCancelacion`, PRD §4.7) calculados de verdad,
  no texto estático.
- `/traslados/[id]` — Pasaporte Digital de Traslado (PRD §5.1): estado,
  stepper de las 7 etapas visibles para el usuario, conductor, evidencia y
  pagos, leyendo de la vista `pasaporte_digital`.

Validado con un `next build` + `next start` reales (no solo "se ve bien en
el código"): las 5 rutas compilan, y se confirmó el contenido en el HTML
real de cada una (incluyendo los valores que vienen de `packages/shared`).

## Modo demo vs. datos reales

Sin `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas
(copia `.env.local.example` a `.env.local`), la app sigue siendo
completamente navegable:
- `/traslados/demo-0001` siempre muestra el mismo escenario que
  `supabase/seed.sql`, claramente marcado como "Datos de ejemplo".
- El wizard simula el envío en vez de fallar.

Esto es intencional: no hay pantalla de login todavía (ver "Pendiente" abajo),
así que aunque conectes Supabase, una lectura protegida por RLS sin sesión
autenticada no devolverá filas — es el comportamiento correcto de RLS, no un bug.

## Pendiente (siguientes cortes de Fase 2)

- Login / sesión de Supabase Auth — sin esto, `usuario_id` en el wizard es
  un valor de relleno (`USUARIO_NUEVO_DEMO`), documentado en el código.
- Pantallas de seguimiento en tiempo real (mapa), chat, calificación y
  disputa (PRD §9).
- Geocodificación real de origen/destino — hoy son campos de texto simples,
  `lat`/`lng` se envían en 0.
- Motor de cotización automática — hoy es un monto manual con nota explícita
  en el wizard.

```
pnpm --filter @ruum/app-usuario dev
```
