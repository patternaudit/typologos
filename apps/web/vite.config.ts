import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Project-pages deploys set VITE_BASE=/typologos/; custom domains use "/".
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5179",
        changeOrigin: true,
      },
    },
  },
});
