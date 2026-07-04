import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import type { ForgeConfig } from '@electron-forge/shared-types'

const config: ForgeConfig = {
  packagerConfig: {
    name: 'NextEFB',
    executableName: 'NextEFB',
    appBundleId: 'com.nextflight.nextefb',
    appCopyright: 'Copyright © NextFlight',
    asar: {
      unpack: '**/node_modules/{better-sqlite3,node-simconnect}/**/*'
    },
    icon: './assets/branding/NextEFB',
    prune: true,
    ignore: [
      /^\/\.cache/,
      /^\/\.vscode/,
      /^\/\.git/,
      /^\/assets\/branding\/source/,
      /^\/docs/,
      /^\/mock/,
      /^\/scripts/,
      /^\/src/,
      /^\/out/,
      /^\/electron\.vite\.config\.ts$/,
      /^\/tsconfig/,
      /^\/vite/,
      /^\/forge\.config\.ts$/,
      /^\/components\.json$/,
      /^\/README\.md$/
    ]
  },
  rebuildConfig: {
    onlyModules: []
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'NextEFB',
        setupIcon: './assets/branding/NextEFB.ico'
      }
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'NextEFB',
        icon: './assets/branding/app-icon-256.png'
      },
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: './assets/branding/app-icon-256.png'
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

export default config
