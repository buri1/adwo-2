import { defineConfig } from "vitest/config";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    globals: true,
    setupFiles: ["./tests/setup.ts"],
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
