# ADR 002 — Offline-First con Fachada OfflineOrchestrator

- **Fecha:** 2026-08-23
- **Estado:** Aceptado
- **Contexto:** Sincronización offline dispersa en 6 módulos: `cola-offline` (423 líneas + binarios separados), `cola-telemetria-offline`, `offline-active-trip-cache` (186 líneas, TTL 72h), `offline-sync-status`, `orquestador-sync-offline` (70 líneas), `background-tracking`. UI importaba cada módulo directo; difícil auditar TTL, reintentos, purga.
- **Decisión:** Crear fachada `src/lib/offline/index.ts` → `OfflineOrchestrator` que expone `{ evidencia, telemetria, cache, snapshot, sincronizarTodo, purgarExpirada }` y centraliza `purgarColaExpirada()` (`TTL 7d`, `MAX_REINTENTOS 15`, binarios huérfanos). Módulos internos se mantienen para compatibilidad pero se marcan deprecated. `offline-orchestrator.ts` shim re-exporta fachada.
- **Consecuencias:**
  - `+` Un único import para UI (`import { OfflineOrchestrator } from "@/lib/offline"`), auditable, testeable.
  - `+` Purga automática al iniciar app y antes de `sincronizarTodo`; `SincronizadorEvidenciaOffline` será cliente de la fachada.
  - `+` Permite sustituir `Preferences` por SQLite/IndexedDB sin cambiar contrato (`EvidenceQueueStorage`).
  - `-` Requiere migración progresiva de imports directos.
- **Alternativas descartadas:** Mantener 6 imports (deuda ARQ-002), SQLite inmediato (sobrecoste sin métricas de volumen).
- **Referencias:** `src/lib/offline/index.ts:43-103`, `src/lib/cola-offline.ts:22-23`, `src/lib/offline-active-trip-cache.ts:73`, `tests/e2e/offline-queue.spec.ts`.
