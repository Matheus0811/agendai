import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em desenvolvimento, chamadas para /api são repassadas para o back-end (porta 8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
