import { defineConfig } from 'tsup'
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  entry: [
    'src/main/**/*.ts',
    'src/config/**/*.ts',
    'src/utils/**/*.ts',
  ],
  outDir: 'dist',
  target: 'node20',
  format: ['esm'],
  bundle: true,
  // The LAN server serves the Vite bundle from dist/renderer during development.
  clean: ['!renderer/**/*'],
  dts: false,
  sourcemap: false,
  external: [
    'electron',
    'electron-updater',
    'better-sqlite3',
    'node-simconnect',
  ],
  // 定义环境变量
  define: {
    'process.env.VITE_API_BASE_URL': JSON.stringify(process.env.VITE_API_BASE_URL ?? ''),
    'process.env.VITE_MOCK': JSON.stringify(process.env.VITE_MOCK ?? 'false'),
  },
})
