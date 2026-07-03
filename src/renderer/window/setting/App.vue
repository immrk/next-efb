<template>
  <TitleBar />
  <main class="setting-window">
    <SettingsView />
  </main>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppState } from '../../composables/useAppState'
import TitleBar from '../main/components/TitleBar.vue'
import SettingsView from '../main/views/SettingsView.vue'

const { initialize } = useAppState()

onMounted(() => {
  void initialize().catch(() => ElMessage.error('应用数据加载失败'))
})
</script>

<style scoped>
.setting-window {
  height: 100%;
  padding-top: 30px;
  overflow: auto;
}
</style>
