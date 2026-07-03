import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        include: ['better-sqlite3']
      })
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/main.ts')
      },
      outDir: 'dist/electron/main'
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/main/preload/index.ts')
      },
      outDir: 'dist/electron/preload'
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    publicDir: resolve(__dirname, 'assets/branding'),
    base: './',
    plugins: [vue()],
    server: {
      host: '127.0.0.1'
    },
    resolve: {
      alias: {
        '@branding': resolve(__dirname, 'assets/branding'),
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      outDir: resolve(__dirname, 'dist/renderer'),
      emptyOutDir: true
    }
  }
})
