export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'unsupported'

export interface AppUpdateState {
  supported: boolean
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion: string | null
  releaseName: string | null
  releaseNotes: string | null
  releaseDate: string | null
  progressPercent: number | null
  transferredBytes: number | null
  totalBytes: number | null
  bytesPerSecond: number | null
  errorMessage: string | null
}
