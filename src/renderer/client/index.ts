import type { AppClient } from './AppClient'
import { ElectronAppClient } from './ElectronAppClient'
import { WebLanAppClient } from './WebLanAppClient'

const appClient: AppClient =
  typeof window !== 'undefined' && typeof window.msfsApi !== 'undefined'
    ? new ElectronAppClient()
    : new WebLanAppClient()

export function getAppClient(): AppClient {
  return appClient
}
