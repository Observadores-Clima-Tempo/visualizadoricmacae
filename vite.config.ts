import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // A V1 embute os CSVs (~780 kB) no bundle único; o limite padrão de 500 kB
    // só geraria ruído. O tamanho real é registrado no README.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      // A meta de cobertura vale para domínio e dados: componentes de layout,
      // estilos e `main.tsx` ficam de fora de propósito.
      include: ['src/domain/**/*.ts', 'src/data/**/*.ts'],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
})
