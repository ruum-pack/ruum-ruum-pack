import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "**/*.spec.ts", "node_modules/**", ".next/**"]
  }
});
