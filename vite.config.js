import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path matches the GitHub Pages project URL (https://<user>.github.io/meu-saldo/).
export default defineConfig({
  plugins: [react()],
  base: "/meu-saldo/",
  build: {
    rollupOptions: {
      output: {
        // The Firebase SDK is most of the bundle and rarely changes: its own file stays
        // cached across app updates.
        manualChunks: (id) => (id.includes("node_modules/@firebase/") || id.includes("node_modules/firebase/") ? "firebase" : undefined),
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
