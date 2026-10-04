import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * - El alias @dominio reutiliza las reglas puras del backend (catálogos, validador, regla de magnitud),
 *   para que frontend y backend validen exactamente igual sin duplicar código.
 * - En desarrollo, /api se redirige al backend (mismo origen: cookies de sesión sin CORS).
 */
export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, process.cwd(), 'VITE_');
  const destino_api = entorno.VITE_PROXY_API ?? 'http://localhost:5000';
  return {
    plugins: [react()],
    resolve: { alias: { '@dominio': path.resolve(__dirname, '../backend/src/dominio') } },
    server: {
      port: 5173,
      fs: { allow: [path.resolve(__dirname, '..')] },
      proxy: { '/api': { target: destino_api, changeOrigin: false } },
    },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
    test: { environment: 'jsdom', globals: true, setupFiles: ['./src/pruebas/configuracion.ts'], css: false },
  };
});
