#!/usr/bin/env node
// scripts/dev-multi.js
import 'dotenv/config';
import { spawn, exec as _exec } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { mkdir, stat } from 'fs/promises';
import { promisify } from 'util';

const exec = promisify(_exec);
const __filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(__filename), '..');
const cacheDir = resolve(root, '.cache');
const cacheFile = resolve(cacheDir, 'windowConfig.mjs');

/* ---------- helper ---------- */
const log   = (...args) => console.log('[INFO]', ...args);
const warn  = (...args) => console.warn('[WARN]', ...args);
const error = (...args) => console.error('[ERR ]', ...args);
/* ----------------------------- */

/** 编译 & 读取窗口配置（带缓存） */
async function loadWindowConfig() {
  const src = resolve(root, 'src/config/windowConfig.ts');

  /* 确保 .cache 目录存在 */
  await mkdir(cacheDir, { recursive: true });

  /* 判断是否需要重新编译 */
  let needBuild = true;
  try {
    const [srcStat, cacheStat] = await Promise.all([stat(src), stat(cacheFile)]);
    needBuild = srcStat.mtimeMs > cacheStat.mtimeMs;
  } catch {
    /* 第一次构建或 cache 缺失 */
  }

  if (needBuild) {
    log('Compiling windowConfig.ts...');
    const cmd =
      `npx esbuild "${src}" --bundle --format=esm --platform=node ` +
      `--outfile="${cacheFile}" --log-level=error`;
    await exec(cmd);
    log('windowConfig.ts compilation completed');
  }

  const { WINDOW_LIST } = await import(pathToFileURL(cacheFile));
  return WINDOW_LIST;
}

/** 启动单个窗口Vite 实例 */
function startVite(name, { devPort }) {
  log(`Starting window "${name}" on port ${devPort}`);
  const child = spawn(
    'npx',
    ['vite', '--mode', 'renderer'],
    {
      env: { ...process.env, WINDOW_NAME: name, PORT: devPort },
      stdio: 'inherit',
      shell: true,
    },
  );
  child.on('exit', (code) => warn(`Window "${name}" exited, code=${code}`));
  child.on('error', (err) => error(`Window "${name}" startup failed:`, err));
  return child;
}

/** 启动mock服务器 */
function startMock() {
  log('Starting mock server...');
  const child = spawn(
    'npx',
    ['vite', '--mode', 'mock'],
    {
      stdio: 'inherit',
      shell: true,
    },
  );
  child.on('exit', (code) => warn(`Mock server exited, code=${code}`));
  child.on('error', (err) => error(`Mock server startup failed:`, err));
  return child;
}

/** 退出时清理所有子进程 */
const children = new Set();
function cleanup() {
  warn('Shutting down all development servers...');
  for (const p of children) p.kill('SIGTERM');
  process.exit();
}
['SIGINT', 'SIGTERM', 'exit'].forEach((sig) => process.on(sig, cleanup));

/* ---------------- 主流程 ---------------- */
(async () => {
  const WINDOW_LIST = await loadWindowConfig();

  /* 支持 --only=a,b 仅启动部分窗口 */
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const pick = onlyArg ? onlyArg.split('=')[1].split(',') : null;

  log('Starting multi-window development environment');
  for (const [name, cfg] of Object.entries(WINDOW_LIST)) {
    if (pick && !pick.includes(name)) continue;
    children.add(startVite(name, cfg));
  }
  // 根据环境变量启动mock服务器
  if (process.env.VITE_MOCK === 'true') {
    children.add(startMock());
  }

  log('All windows started:');
  Object.entries(WINDOW_LIST).forEach(([name, { devPort }]) => {
    if (!pick || pick.includes(name))
      console.log(`  • ${name}  →  http://localhost:${devPort}`);
  });
  console.log('Press Ctrl+C to stop');
})();
