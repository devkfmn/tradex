import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { Connect } from "vite";
import { handleFuturesEquityHttpRequest } from "./api/_lib/mexc/equityHandler";

function mexcApiDevMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.url !== "/api/mexc/futures-equity") {
      next();
      return;
    }

    void (async () => {
      const { status, payload } = await handleFuturesEquityHttpRequest(
        req.method,
        req
      );
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(payload));
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Internal error";
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: message }));
    });
  };
}

function mexcApiDevPlugin() {
  return {
    name: "mexc-api-dev",
    configureServer(server: { middlewares: { use: (fn: Connect.NextHandleFunction) => void } }) {
      server.middlewares.use(mexcApiDevMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    mexcApiDevPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Tradex - Trading Journal",
        short_name: "Tradex",
        description: "Plan, log, and review your trades.",
        theme_color: "#0e1117",
        background_color: "#0e1117",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
});
