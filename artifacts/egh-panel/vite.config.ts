import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT is only used by the dev/preview server.  It is not needed during
// `vite build`, so we must never throw when it is absent (e.g. Docker
// build stages).  Default to 3000 for plain local development.
const port = Number(process.env.PORT ?? "3000");

// BASE_PATH sets the Vite `base` option (asset URL prefix) and the React
// Router base.  "/" is correct for the standard Docker / self-hosted setup.
const basePath = process.env.BASE_PATH ?? "/";

// Only load Replit-specific plugins when running inside the Replit IDE.
const isReplit = process.env.REPL_ID !== undefined;

export default defineConfig(async () => {
  const replitPlugins = isReplit
    ? [
        (await import("@replit/vite-plugin-runtime-error-modal")).default(),
        ...(process.env.NODE_ENV !== "production"
          ? [
              (
                await import("@replit/vite-plugin-cartographer")
              ).cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
              (await import("@replit/vite-plugin-dev-banner")).devBanner(),
            ]
          : []),
      ]
    : [];

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
