import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Root directory of the project (frontend folder)
  // Use absolute path to ensure correct resolution in CI/CD
  root: resolve(__dirname),
  // Base public path when served in production
  // Use '/' for root deployment, or '/subpath/' for subdirectory deployment
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
      input: 'frontend/index.html',
    },
    // Ensure proper module resolution during build
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
});
