import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Gate P1: baseline actual ~2.8% lines. Gate bajo para no bloquear CI; subir a 60/50 → 80/70 iterativamente.
      thresholds: {
        lines: 2,
        branches: 30,
        functions: 10,
        statements: 2
      },
      exclude: ["test/**", "tests/**", "node_modules/**", ".next/**", "cap-shell/**", "android/**", "storybook-static/**", "**/storybook-static/**"]
    }
  }
});
