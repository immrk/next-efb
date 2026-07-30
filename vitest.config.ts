import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src/renderer'),
      '~': path.resolve(rootDir, 'src/renderer'),
      '@shared': path.resolve(rootDir, 'src/shared'),
      '@branding': path.resolve(rootDir, 'assets/branding')
    }
  },
  test: {
    passWithNoTests: false,
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: ['tests/unit/main/**/*.test.ts']
        }
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['tests/unit/renderer/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['./tests/setup/renderer.ts']
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/main/services/**/*.ts',
        'src/renderer/client/**/*.ts',
        'src/renderer/composables/**/*.ts',
        'src/renderer/hooks/**/*.ts',
        'src/renderer/runtime.ts',
        'src/renderer/store/**/*.ts',
        'src/renderer/utils/**/*.ts',
        'src/renderer/components/{AircraftArrow,ConnectionBadge,StatusPanel}.tsx'
      ],
      exclude: [
        '**/*.d.ts',
        'src/main/services/simconnect/NodeSimConnectProvider.ts',
        'src/renderer/client/AppClient.ts'
      ]
    }
  }
})
