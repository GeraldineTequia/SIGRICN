import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['pruebas/**/*.prueba.ts'],
    // Las pruebas de integración comparten la base aislada SGRICN_pruebas: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
