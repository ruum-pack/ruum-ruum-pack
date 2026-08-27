import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Hoja de ruta de escalamiento de cobertura (H4) — P0 ejecutado:
      // FIX gate rojo 6.3% → verde 32% (2026-08-23, user request):
      // Problema: global 6.3% incluía src/app/panel, viajes/[id], ganancias (0% cada una) → gate bloqueaba sin valor.
      // Solución elegida (opción user): excluir vistas sin integración del gate global y fijar threshold por directorio.
      // - Excluidos: src/app/**, src/components/** (re-incluir tras TEST-003++ con tests de integración para panel/viajes/ganancias)
      // - Gate global ahora = src/lib (~64% lines, 66% branches) → threshold 30/60/65/30 verde (actual 32.13% lines)
      // - Target por directorio: src/lib → 80% lines (OFF-001/002 + with-timeout/battery/p-limit ya 66% → falta cubrir battery, p-limit, offline/index)
      // - Fase 3 (2026-11-01): src/lib 80/70 + re-incluir src/app tras integración (panel, viajes, ganancias)
      // Para verificar lib solo: pnpm --filter @ruum/app-conductor test:coverage --run | grep "src/lib"
      thresholds: {
        lines: 30,
        branches: 60,
        functions: 65,
        statements: 30
      },
      // Excluir vistas aún sin tests de integración — no penalizan gate lib; se re-incluirán tras TEST-003++
      exclude: [
        "test/**",
        "tests/**",
        "node_modules/**",
        ".next/**",
        "cap-shell/**",
        "android/**",
        "storybook-static/**",
        "**/storybook-static/**",
        // Vistas aún sin tests de integración — excluidas del gate global para no penalizar lib
        // Re-incluir tras TEST-003++ (panel, viajes/[id], ganancias). Ver ADR 002
        "src/app/**",
        "src/components/**"
      ]
    }
  }
});
