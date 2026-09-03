import { defineConfig } from "vitest/config";
import { sites } from "@openai/sites-vite-plugin";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const hostingPlugins = process.env.VITEST
    ? []
    : [sites(), (await import("@cloudflare/vite-plugin")).cloudflare()];

  return {
    plugins: [react(), tailwindcss(), ...hostingPlugins],
    server: {
      headers: {
        "Origin-Agent-Cluster": "?1",
        "Permissions-Policy": "tools=(self)",
      },
    },
    preview: {
      headers: {
        "Origin-Agent-Cluster": "?1",
        "Permissions-Policy": "tools=(self)",
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
    test: {
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
      restoreMocks: true,
      exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    },
  };
});
