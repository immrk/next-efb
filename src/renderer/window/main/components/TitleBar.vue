<template>
  <div class="titlebar" data-testid="titlebar">
    <span>{{ APP_NAME }}</span>
    <div v-if="isElectron" class="window-actions">
      <el-button text :icon="Minus" aria-label="Minimize" @click="windowAction('minimize')" />
      <el-button text :icon="isMaximized ? CopyDocument : FullScreen" aria-label="Maximize" @click="windowAction('toggle-maximize')" />
      <el-button text :icon="Close" aria-label="Close" @click="windowAction('close-to-tray')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Close, CopyDocument, FullScreen, Minus } from '@element-plus/icons-vue'
import { APP_NAME } from '@shared/branding'
import type { DesktopWindowAction } from '@shared/types'
import { getAppClient } from '../../../client'

const client = getAppClient()
const isElectron = client.getRuntime().host === 'electron'
const isMaximized = ref(false)
let unsubscribe: () => void = () => undefined

onMounted(async () => {
  if (!isElectron) return
  isMaximized.value = (await client.getWindowState()).isMaximized
  unsubscribe = client.onWindowStateChange((state) => (isMaximized.value = state.isMaximized))
})

onBeforeUnmount(() => unsubscribe())

async function windowAction(action: DesktopWindowAction): Promise<void> {
  isMaximized.value = (await client.performWindowAction(action)).isMaximized
}
</script>

<style scoped>
.titlebar {
  height: 30px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  z-index: 1000;
  app-region: drag;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background-color: var(--el-bg-color);
}

.window-actions {
  position: absolute;
  right: 0;
  height: 100%;
  display: flex;
  align-items: center;
  app-region: no-drag;
}
</style>
