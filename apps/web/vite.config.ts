import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// CI (GitHub Pages) BASE_PATH=/rota-turkiye/ ile derler; yerelde kök dizin.
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["favicon.svg", "icon.svg", "icon-maskable.svg"],
      manifest: {
        id: base,
        name: "Rota Türkiye",
        short_name: "Rota",
        description: "Türkiye'ye özel, çevrimdışı çalışan açık kaynak gezi planlayıcı.",
        lang: "tr",
        dir: "ltr",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait",
        theme_color: "#C2410C",
        background_color: "#FBF7F1",
        categories: ["travel", "navigation"],
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,svg,webmanifest}"],
        // MapLibre ana paketi ve işçisi ~1 MB; çevrimdışı için önbelleğe alınır.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/packs\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Paket listesi küçük ve değişebilir: önce önbellek, arkada tazele.
            urlPattern: /\/packs\/index\.json(\?.*)?$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "rota-pack-index", expiration: { maxEntries: 4 } },
          },
          {
            // Bölge paketleri ?v=<generatedAt> ile sürümlenir; aynı URL hep aynı içeriktir.
            urlPattern: /\/packs\/[\w-]+\.json(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "rota-packs",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ofm-tiles",
              // Çevrimdışı gezi paketi bu önbelleğe ~3.500 karo yazar; günlük gezinme onları silmesin.
              expiration: { maxEntries: 12000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "open-meteo",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 2 },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    // @rota/core TypeScript kaynağı olarak bağlanır (ön-paketlenmez); onun bağımlılıkları ön-paketlenir.
    include: ["@rota/core > opening_hours", "@rota/core > adhan"],
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1400,
  },
  server: {
    port: 5173,
  },
});
