# Sprint C5 — Endurecimiento UX, accesibilidad y salida a producción

## Cobertura
- C5-01: `ConfirmDialog` compartido con consecuencia, datos enmascarados, foco inicial en Cancelar, trap de foco y Escape.
- C5-02: tokens `on-primary`, `on-danger`, `surface-muted`, `overlay` y `focus`; app Conductor sin hex directos.
- C5-03: eliminación de selectores globales basados en `class*="sm:"`; clases responsive opt-in por dominio.
- C5-04: proveedor de regiones vivas y bridge para viaje, evidencia, conexión, errores, rechazo y permisos.
- C5-05: matriz TalkBack con los once flujos obligatorios y campos de defecto.
- C5-06: escenarios Playwright de rutas críticas, diálogo y bloqueo por versión; ampliar con fixtures del entorno staging para geocerca/evidencia real.
- C5-07: RPC y tabla de observabilidad con rechazo explícito de datos sensibles.
- C5-08: política Android de versión vigente, mínima, recomendada, obligatoria e incompatibilidades.
- C5-09: feature flags con rollout determinista y runbook por canales/rollback.

## Aplicación
```powershell
supabase db push
pnpm install
pnpm --filter @ruum/app-conductor typecheck
node apps/app-conductor/tests/android/sprint-c5-static.test.mjs
pnpm --filter @ruum/app-conductor test
pnpm --filter @ruum/app-conductor exec playwright test tests/e2e/sprint-c5-critical-flows.spec.ts
```

## Validación física pendiente
TalkBack, crash nativo, actualización desde canal real y rollback de una versión instalada requieren APK firmado y ambiente staging. No deben considerarse aprobados solamente por pruebas estáticas.
