import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 15_000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "**/*.spec.ts", "node_modules/**", ".next/**"]
  }
});
