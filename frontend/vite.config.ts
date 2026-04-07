import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const configuredPort = Number.parseInt(env.VITE_PORT || '', 10)
  const devPort = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 5173

  return {
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: devPort,
      strictPort: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        reportsDirectory: './coverage',
        include: [
          'src/lib/**/*.ts',
          'src/services/**/*.ts',
          'src/stores/**/*.ts',
          'src/platform/**/*.ts',
        ],
        exclude: [
          '**/*.test.ts',
          '**/*.test.tsx',
        ],
        thresholds: {
          statements: 30,
          branches: 30,
          functions: 30,
          lines: 30,
        },
      },
    },
  }
})
