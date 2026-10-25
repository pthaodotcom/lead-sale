import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/components/lead-sale/*.test.ts", "tests/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
