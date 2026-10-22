import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  define: { "import.meta.env.VITE_DEMO_MODE": JSON.stringify("false") },
  plugins: [react(), tailwindcss()],
  publicDir: false,
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  build: {
    outDir: ".playwright-mcp/driver-intake-build",
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "driver-intake.html"),
    },
    sourcemap: false,
  },
});
