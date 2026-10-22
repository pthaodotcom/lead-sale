import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

const testAccountsPath = path.resolve(import.meta.dirname, ".env.accounts.local");

function localTestAccounts(): Plugin {
  return {
    name: "lead-local-test-accounts",
    apply: "serve",
    configureServer(server) {
      if (server.config.mode !== "development") return;
      server.middlewares.use("/__lead/test-accounts", (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end("[]");
          return;
        }
        try {
          const accounts = existsSync(testAccountsPath)
            ? JSON.parse(readFileSync(testAccountsPath, "utf8"))
            : [];
          res.end(JSON.stringify(accounts));
        } catch {
          res.statusCode = 500;
          res.end("[]");
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_DEMO_MODE": JSON.stringify(
      mode === "demo" ? "true" : "false",
    ),
  },
  plugins: [react(), tailwindcss(), localTestAccounts()],
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  resolve: {
    dedupe: ["react-router", "react-router-dom"],
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  build: { sourcemap: false },
}));
