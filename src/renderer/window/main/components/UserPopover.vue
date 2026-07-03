<template>
  <div class="user-popover">
    <template v-if="isLoggedIn">
      <el-descriptions :column="1" size="small">
        <el-descriptions-item label="Username">{{ user?.username }}</el-descriptions-item>
        <el-descriptions-item label="Email">{{ user?.email }}</el-descriptions-item>
      </el-descriptions>
      <el-button type="primary" @click="logout">退出登录</el-button>
    </template>
    <template v-else>
      <el-text>尚未登录</el-text>
      <el-button type="primary" @click="$emit('login')">前往登录</el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAuth } from '../../../composables/useAuth'

defineEmits<{ login: [] }>()
const { isLoggedIn, user, logout } = useAuth()
</script>

<style scoped>
.user-popover {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--el-component-size-small);
}
</style>
