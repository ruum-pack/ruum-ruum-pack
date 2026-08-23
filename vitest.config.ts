import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/tests/**",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/playwright-report/**",
      "**/test-results/**"
    ]
  }
});
