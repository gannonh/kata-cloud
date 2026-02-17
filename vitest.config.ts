import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{ts,tsx}",
        "packages/task-parser/src/**/*.js"
      ],
      exclude: [
        "src/main.tsx",
        "src/main/**",
        "src/preload/**",
        "src/test/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx,js,jsx}",
        "**/*.node.test.{ts,tsx,js,jsx}"
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    }
  }
});
