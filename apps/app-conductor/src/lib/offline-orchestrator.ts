/**
 * ARQ-002 — Shim de compatibilidad
 * Re-exporta la fachada OfflineOrchestrator desde lib/offline/index.ts
 * para que `import { OfflineOrchestrator } from "@/lib/offline-orchestrator"`
 * y `import { OfflineOrchestrator } from "@/lib/offline"` funcionen.
 */
export * from "./offline/index";
export { default } from "./offline/index";
