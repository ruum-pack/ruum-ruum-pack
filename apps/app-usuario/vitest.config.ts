import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    globals: true,
    testTimeout: 15_000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts", "test/**/*.test.tsx"],
    exclude: ["tests/**", "**/*.spec.ts", "node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
  }
});
