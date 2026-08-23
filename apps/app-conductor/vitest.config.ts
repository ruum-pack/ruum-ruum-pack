import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Hoja de ruta de escalamiento de cobertura (H4):
      // - Fase 1 (actual): Elevar piso global y asegurar >80% en librerías críticas de sincronización y tracking.
      // - Fase 2: Escalar gate global a 30/25% integrando pruebas de componentes de viajes y evidencia.
      // - Fase 3 (Target Final): 60/50% → 80/70% en todo el código de aplicación.
      thresholds: {
        lines: 5,
        branches: 35,
        functions: 15,
        statements: 5
      },
      exclude: ["test/**", "tests/**", "node_modules/**", ".next/**", "cap-shell/**", "android/**", "storybook-static/**", "**/storybook-static/**"]
    }
  }
});
