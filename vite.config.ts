import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { vitePluginFakeServer } from 'vite-plugin-fake-server'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function rendererConfig() {
  const currentWindow = process.env.WINDOW_NAME || 'main'
  const windowConfigPath = path.resolve(__dirname, '.cache/windowConfig.mjs')
  const { WINDOW_LIST } = await import(pathToFileURL(windowConfigPath).href)
  const windowConfig = WINDOW_LIST[currentWindow]

  if (!windowConfig) {
    throw new Error(`未找到窗口配置：${currentWindow}`)
  }

  return {
    root: path.resolve(__dirname, `src/renderer/window/${currentWindow}`),
    base: './',
    publicDir: path.resolve(__dirname, 'assets/branding'),
    plugins: [
      vue(),
      AutoImport({
        resolvers: [
          ElementPlusResolver({ importStyle: 'css' }),
          IconsResolver({ prefix: 'Icon' })
        ],
        dts: 'types/auto-imports.d.ts'
      }),
      Components({
        resolvers: [
          ElementPlusResolver({ importStyle: 'css' }),
          IconsResolver({ enabledCollections: ['ep', 'mdi'] })
        ],
        dts: 'types/components.d.ts'
      }),
      Icons({ autoInstall: true })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src/renderer'),
        '~': path.resolve(__dirname, 'src/renderer'),
        '@renderer': path.resolve(__dirname, 'src/renderer'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    },
    server: {
      port: windowConfig.devPort,
      strictPort: true,
      host: 'localhost',
      hmr: { port: windowConfig.devPort }
    },
    build: {
      outDir: path.resolve(__dirname, `dist/renderer/window/${currentWindow}`),
      emptyOutDir: true,
      sourcemap: true
    },
    define: {
      __WINDOW_NAME__: JSON.stringify(currentWindow)
    }
  }
}

function mockConfig() {
  return {
    root: __dirname,
    plugins: [
      vitePluginFakeServer({
        include: ['mock'],
        infixName: false,
        enableProd: false,
        logger: true
      })
    ],
    server: {
      port: 3000,
      strictPort: true,
      host: 'localhost',
      cors: true
    }
  }
}

export default defineConfig(async ({ mode }) => {
  return mode === 'mock' ? mockConfig() : rendererConfig()
})
