import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import { vitePluginFakeServer } from 'vite-plugin-fake-server'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function rendererConfig() {
  // 渲染进程vite配置
  /* 1. 当前窗口名称（默认为 main） */
  const currentWindow = process.env.WINDOW_NAME || "main";

  /* 2. 读取 .cache/windowConfig.mjs */
  const windowConfigPath = path.resolve(__dirname, ".cache/windowConfig.mjs");
  const { WINDOW_LIST } = await import(`file://${windowConfigPath}`);
  const windowConfig = WINDOW_LIST[currentWindow];
  if (!windowConfig) {
    throw new Error(`未找到窗口配置：${currentWindow}`);
  }

  /* 3. 窗口根目录（含 index.html） */
  const windowRoot = path.resolve(
    __dirname,
    `src/renderer/window/${currentWindow}`
  );

  /* 4. 打包输出路径 */
  const outDir = path.resolve(
    __dirname,
    `dist/renderer/window/${currentWindow}`
  );

  return {
    root: windowRoot,
    publicDir: path.resolve(__dirname, "assets/branding"),
    base: "./",
    // 多窗口开发时会并发启动多个 Vite 实例，必须隔离依赖优化缓存，
    // 否则各窗口会覆盖 node_modules/.vite 并导致 @ 别名解析失败。
    cacheDir: path.resolve(__dirname, `.cache/vite/${currentWindow}`),
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src/renderer"),
        "~": path.resolve(__dirname, "src/renderer"),
        "@shared": path.resolve(__dirname, "src/shared"),
        "@branding": path.resolve(__dirname, "assets/branding"),
      },
    },
    server: {
      port: windowConfig.devPort,
      strictPort: true,
      host: "localhost",
      hmr: { port: windowConfig.devPort },
    },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
    },
    define: {
      __WINDOW_NAME__: JSON.stringify(currentWindow),
    },
  };
}

async function mockConfig() {
  // mock 数据vite配置
  console.log('Mock config - current dir:', __dirname);
  
  return {
    root: __dirname, // 使用项目根目录作为mock服务器的根目录
    cacheDir: path.resolve(__dirname, ".cache/vite/mock"),
    // Mock 实例只提供接口，不应扫描仓库中的 renderer HTML/TSX 入口。
    // 否则它会在缺少 renderer 别名配置时把 @/... 误判为 npm 依赖。
    appType: "custom",
    optimizeDeps: {
      noDiscovery: true,
    },
    plugins: [
      vitePluginFakeServer({
        include: ['mock'], // 使用相对路径
        infixName: false,
        enableProd: false,
        logger: true, // 启用日志
      }),
    ],
    server: {
      port: 3000, // mock服务器端口
      strictPort: true,
      host: "localhost",
      cors: true,
    },
  }
}

export default defineConfig(async ({mode}) => {
  if(mode === "renderer") {
    // 渲染进程
    return rendererConfig();
  } else if (mode === "mock") {
    // mock 数据
    return mockConfig();
  } else {
    // 默认渲染进程
    return rendererConfig();
  }
});
