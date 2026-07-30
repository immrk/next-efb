#!/usr/bin/env node
import 'dotenv/config';
import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🚀 Starting build process...');

try {
  // 1. 执行 tsc 命令
  console.log('📝 Executing Tsup...');
  execSync('npm run tsup', { 
    cwd: projectRoot, 
    stdio: 'inherit',
    encoding: 'utf8'
  });
  console.log('✅ Tsup completed');

  // 2. 复制 i18n 文件
  console.log('🌐 Copying i18n files...');
  
  // 复制 locales 目录
  const sourceLocalesDir = join(projectRoot, 'src', 'main', 'i18n', 'locales');
  const targetLocalesDir = join(projectRoot, 'dist', 'main', 'i18n', 'locales');
  
  // 确保目标目录存在
  if (!existsSync(targetLocalesDir)) {
    mkdirSync(targetLocalesDir, { recursive: true });
  }
  
  // 复制所文件夹内所有文件
  const files = readdirSync(sourceLocalesDir);
  files.forEach(file => {
    const sourceFile = join(sourceLocalesDir, file);
    const targetFile = join(targetLocalesDir, file);
    copyFileSync(sourceFile, targetFile);
  });

  console.log('🎉 Main build process completed!');
  
} catch (error) {
  console.error('❌ Error occurred during build process:', error.message);
  process.exit(1);
}
