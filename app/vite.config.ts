import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_DEMO_MODE": JSON.stringify(
      mode === "demo" ? "true" : "false",
    ),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: { "/api/": "http://127.0.0.1:5180" },
  },
  resolve: {
    dedupe: ["react-router", "react-router-dom"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: { sourcemap: false },
}));
