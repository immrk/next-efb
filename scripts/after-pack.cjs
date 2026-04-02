const { existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return
  }

  const projectDir = context.appDir || context.packager.projectDir
  const executablePath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const iconPath = resolve(projectDir, 'assets/branding/NextEFB.ico')
  const rceditPath = resolve(projectDir, 'node_modules/electron-winstaller/vendor/rcedit.exe')

  if (!existsSync(executablePath)) {
    throw new Error(`Executable not found for icon patching: ${executablePath}`)
  }

  if (!existsSync(iconPath)) {
    throw new Error(`Icon file not found: ${iconPath}`)
  }

  if (!existsSync(rceditPath)) {
    throw new Error(`rcedit not found: ${rceditPath}`)
  }

  const result = spawnSync(rceditPath, [executablePath, '--set-icon', iconPath], {
    cwd: projectDir,
    stdio: 'pipe',
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to patch executable icon')
  }
}
