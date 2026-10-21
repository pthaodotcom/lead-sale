import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: "127.0.0.1" },
  resolve: {
    dedupe: ["react-router", "react-router-dom"],
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: { sourcemap: false },
});
