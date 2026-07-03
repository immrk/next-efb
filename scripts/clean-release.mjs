import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

rmSync(resolve('artifacts'), { recursive: true, force: true })
