import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: ".",
  base: '/',
  server: {
    port: 5173
  },
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  build: {
    outDir: 'dist',
    // Enable source maps for better debugging in production
    sourcemap: true,
    emptyOutDir: true,
    // Explicitly set the entry point for CI/CD builds
    rollupOptions: {
      input: './index.html',
    },
    // Ensure proper module resolution during build
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
});
