<template>
  <TitleBar />
  <div class="main-layout">
    <LeftBar @login="openLogin" />
    <main class="main-content">
      <router-view />
    </main>
  </div>
  <LoginDialog v-model="loginVisible" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppState } from '../../composables/useAppState'
import LeftBar from './components/LeftBar.vue'
import LoginDialog from './components/LoginDialog.vue'
import TitleBar from './components/TitleBar.vue'

const loginVisible = ref(false)
const { initialize } = useAppState()

onMounted(() => {
  void initialize().catch(() => ElMessage.error('应用数据加载失败'))
})

function openLogin(): void {
  if (window.windowManager) {
    void window.windowManager.createWindow('login')
    return
  }
  loginVisible.value = true
}
</script>

<style scoped>
.main-layout {
  height: 100%;
  display: flex;
}

.main-content {
  height: 100%;
  width: calc(100% - 70px);
  padding-top: 30px;
  box-sizing: border-box;
  overflow: auto;
  background-color: var(--el-bg-color);
}
</style>
