import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Hoja de ruta de escalamiento de cobertura — P0 ejecutado 2026-08-23:
      // - Fase 1 (previo): piso 6% (desactivado — permitía CI verde ficticio)
      // - Fase 2 (ACTUAL P0): gate global 30/30 — bloqueante en CI. Próximo hito: 30→50%.
      // - Fase 3 (Target Final): 60/50% → 80/70% en todo el código de aplicación.
      // Ver AUDITORIA_INTEGRAL_CONDUCTOR.md § TEST-001 — thresholds bajos = riesgo crítico.
      thresholds: {
        lines: 30,
        branches: 40,
        functions: 30,
        statements: 30
      },
      exclude: ["test/**", "tests/**", "node_modules/**", ".next/**", "cap-shell/**", "android/**", "storybook-static/**", "**/storybook-static/**"]
    }
  }
});
