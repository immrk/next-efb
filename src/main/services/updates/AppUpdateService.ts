import { app, type BrowserWindow } from 'electron'
import electronUpdater, {
  type ProgressInfo,
  type UpdateInfo
} from 'electron-updater'
import { IPC_CHANNELS } from '../../../shared/channels.js'
import type { AppUpdateState } from '../../../shared/update-types.js'

const INITIAL_CHECK_DELAY_MS = 8_000
const { autoUpdater } = electronUpdater

interface AppUpdateServiceOptions {
  beforeInstall: () => void
}

export class AppUpdateService {
  private mainWindow: BrowserWindow | null = null
  private checkPromise: Promise<void> | null = null
  private downloadPromise: Promise<void> | null = null
  private initialCheckTimer: NodeJS.Timeout | null = null
  private installAfterDownload = false
  private isInstalling = false
  private state: AppUpdateState

  constructor(private readonly options: AppUpdateServiceOptions) {
    const supported = app.isPackaged && process.platform === 'win32'
    this.state = {
      supported,
      phase: supported ? 'idle' : 'unsupported',
      currentVersion: app.getVersion(),
      availableVersion: null,
      releaseName: null,
      releaseNotes: null,
      releaseDate: null,
      progressPercent: null,
      transferredBytes: null,
      totalBytes: null,
      bytesPerSecond: null,
      errorMessage: null
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
    autoUpdater.fullChangelog = false
    autoUpdater.logger = console

    autoUpdater.on('checking-for-update', () => {
      this.setState({
        phase: 'checking',
        errorMessage: null
      })
    })

    autoUpdater.on('update-available', (info) => {
      this.setState({
        ...toReleaseState(info),
        phase: 'available',
        progressPercent: null,
        transferredBytes: null,
        totalBytes: null,
        bytesPerSecond: null,
        errorMessage: null
      })
    })

    autoUpdater.on('update-not-available', () => {
      this.setState({
        phase: 'up-to-date',
        availableVersion: null,
        releaseName: null,
        releaseNotes: null,
        releaseDate: null,
        progressPercent: null,
        transferredBytes: null,
        totalBytes: null,
        bytesPerSecond: null,
        errorMessage: null
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.setState(toProgressState(progress))
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.setState({
        ...toReleaseState(info),
        phase: 'ready',
        progressPercent: 100,
        errorMessage: null
      })

      if (this.installAfterDownload) {
        setImmediate(() => this.installDownloadedUpdate())
      }
    })

    autoUpdater.on('error', (error) => {
      this.setState({
        phase: 'error',
        errorMessage: getErrorMessage(error)
      })
    })
  }

  attachWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
  }

  scheduleInitialCheck(): void {
    if (!this.state.supported || this.initialCheckTimer) return

    this.initialCheckTimer = setTimeout(() => {
      this.initialCheckTimer = null
      void this.checkForUpdates()
    }, INITIAL_CHECK_DELAY_MS)
    this.initialCheckTimer.unref()
  }

  getState(): AppUpdateState {
    return { ...this.state }
  }

  async checkForUpdates(): Promise<AppUpdateState> {
    if (!this.state.supported) return this.getState()
    if (this.checkPromise) {
      await this.checkPromise
      return this.getState()
    }

    this.checkPromise = (async () => {
      try {
        await autoUpdater.checkForUpdates()
      } catch (error) {
        if (this.state.phase !== 'error') {
          this.setState({
            phase: 'error',
            errorMessage: getErrorMessage(error)
          })
        }
      } finally {
        this.checkPromise = null
      }
    })()

    await this.checkPromise
    return this.getState()
  }

  async downloadAndInstall(): Promise<AppUpdateState> {
    if (!this.state.supported) return this.getState()
    if (this.state.phase === 'ready') {
      this.installDownloadedUpdate()
      return this.getState()
    }
    if (this.downloadPromise) {
      await this.downloadPromise
      return this.getState()
    }

    if (this.state.phase !== 'available') {
      await this.checkForUpdates()
    }
    if (this.state.phase !== 'available') {
      return this.getState()
    }

    this.installAfterDownload = true
    this.setState({
      phase: 'downloading',
      progressPercent: 0,
      transferredBytes: 0,
      totalBytes: null,
      bytesPerSecond: null,
      errorMessage: null
    })

    this.downloadPromise = (async () => {
      try {
        await autoUpdater.downloadUpdate()
      } catch (error) {
        this.installAfterDownload = false
        if (this.state.phase !== 'error') {
          this.setState({
            phase: 'error',
            errorMessage: getErrorMessage(error)
          })
        }
      } finally {
        this.downloadPromise = null
      }
    })()

    await this.downloadPromise
    return this.getState()
  }

  private installDownloadedUpdate(): void {
    if (this.isInstalling || this.state.phase !== 'ready') return

    this.isInstalling = true
    this.installAfterDownload = false
    this.options.beforeInstall()
    autoUpdater.quitAndInstall(false, true)
  }

  private setState(partial: Partial<AppUpdateState>): void {
    this.state = {
      ...this.state,
      ...partial
    }

    const window = this.mainWindow
    if (!window || window.isDestroyed()) return
    window.webContents.send(IPC_CHANNELS.appUpdateStateChanged, this.getState())
  }
}

function toReleaseState(info: UpdateInfo): Partial<AppUpdateState> {
  return {
    availableVersion: info.version,
    releaseName: info.releaseName ?? null,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    releaseDate: info.releaseDate ?? null
  }
}

function toProgressState(progress: ProgressInfo): Partial<AppUpdateState> {
  return {
    phase: 'downloading',
    progressPercent: clampPercent(progress.percent),
    transferredBytes: progress.transferred,
    totalBytes: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
    errorMessage: null
  }
}

function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string | null {
  if (typeof notes === 'string') {
    return notes.trim() || null
  }
  if (!Array.isArray(notes)) {
    return null
  }

  const value = notes
    .map((item) => [item.version, item.note].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n')
    .trim()
  return value || null
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}
