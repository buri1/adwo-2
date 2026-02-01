import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    environmentMatchGlobs: [
      // Use jsdom for hook and component tests
      ["tests/hooks/**", "jsdom"],
      ["tests/components/**", "jsdom"],
      ["tests/stores/**", "node"],
    ],
  },
  resolve: {
    alias: {
      "@adwo/shared": resolve(__dirname, "../../packages/shared/src"),
      "@": resolve(__dirname, "./src"),
    },
  },
});
