<template>
  <TitleBar />
  <main class="login-window">
    <LoginBox @cancel="closeWindow" @success="closeWindow" />
  </main>
</template>

<script setup lang="ts">
import LoginBox from './components/LoginBox.vue'
import TitleBar from '../main/components/TitleBar.vue'

function closeWindow(): void {
  void window.windowManager?.closeWindow('login')
}
</script>

<style scoped>
.login-window {
  height: 100%;
  padding: calc(30px + var(--el-component-size)) var(--el-component-size)
    var(--el-component-size);
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
