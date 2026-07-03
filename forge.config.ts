import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

export default {
  packagerConfig: {
    asar: true,
    name: 'NextEFB',
    executableName: 'NextEFB',
    appBundleId: 'com.nextflight.nextefb',
    icon: './assets/branding/NextEFB',
    extraResource: ['./assets/branding'],
    ignore: [
      '.cache',
      '.vscode',
      '.git',
      '.gitignore',
      '.env',
      '.env.example',
      'src',
      'mock',
      'scripts',
      'tests',
      'docs',
      'official-web',
      'forge.config.ts',
      'tsconfig.base.json',
      'tsconfig.node.json',
      'tsconfig.web.json',
      'tsup.config.ts',
      'vite.config.ts',
      'vite.uat.config.ts',
      'vitest.config.ts',
      'nodemon.json',
      'package-lock.json',
      'README.md'
    ]
  },
  rebuildConfig: {
    onlyModules: ['better-sqlite3']
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'NextEFB',
        authors: 'Keyajian'
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'NextEFB',
        icon: './assets/branding/NextEFB.icns'
      },
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/branding/icon-512.png'
        }
      },
      platforms: ['linux']
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {}
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
}
