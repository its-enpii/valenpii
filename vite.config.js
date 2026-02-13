import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
    host: true,
    allowedHosts: ["dicrotic-immanuel-subessentially.ngrok-free.dev"],
  },
});
