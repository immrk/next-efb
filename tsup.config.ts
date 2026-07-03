import { defineConfig } from 'tsup'
import dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  entry: ['src/main/**/*.ts', 'src/config/**/*.ts'],
  tsconfig: 'tsconfig.base.json',
  outDir: 'dist',
  target: 'node20',
  format: ['esm'],
  bundle: true,
  clean: true,
  dts: false,
  sourcemap: true,
  external: ['electron', 'better-sqlite3', 'node-simconnect'],
  define: {
    'process.env.VITE_MOCK': JSON.stringify(process.env.VITE_MOCK ?? 'false')
  }
})
