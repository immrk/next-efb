<template>
  <aside class="left-bar" data-testid="left-bar">
    <el-popover placement="right-start" :width="220" trigger="hover" :hide-after="100" :show-arrow="false">
      <template #reference>
        <el-avatar
          shape="square"
          :size="50"
          :src="user?.avatar"
          data-testid="user-avatar"
          @click="handleAvatarClick"
        >
          <el-icon><UserFilled /></el-icon>
        </el-avatar>
      </template>
      <UserPopover @login="$emit('login')" />
    </el-popover>

    <el-menu :default-active="activePath" :collapse="true" router class="menu-list">
      <el-menu-item index="/map" data-testid="nav-map" :aria-label="t('nav.map')">
        <el-icon><Location /></el-icon>
        <template #title>{{ t('nav.map') }}</template>
      </el-menu-item>
      <el-menu-item index="/charts" data-testid="nav-charts" :aria-label="t('nav.charts')">
        <el-icon><Files /></el-icon>
        <template #title>{{ t('nav.charts') }}</template>
      </el-menu-item>
    </el-menu>

    <el-menu :default-active="activePath" :collapse="true" router class="bottom-menu">
      <el-menu-item index="/settings" data-testid="nav-settings" :aria-label="t('nav.settings')">
        <el-icon><Setting /></el-icon>
        <template #title>{{ t('nav.settings') }}</template>
      </el-menu-item>
    </el-menu>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Files, Location, Setting, UserFilled } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../../../composables/useAuth'
import UserPopover from './UserPopover.vue'

const emit = defineEmits<{ login: [] }>()
const route = useRoute()
const { t } = useI18n()
const { user, isLoggedIn } = useAuth()
const activePath = computed(() => (route.path.startsWith('/charts') ? '/charts' : route.path))

function handleAvatarClick(): void {
  if (!isLoggedIn.value) emit('login')
}
</script>

<style scoped>
.left-bar {
  width: 70px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
  box-sizing: border-box;
  background-color: var(--el-fill-color-light);
  border-right: 1px solid var(--el-border-color-lighter);
}

.menu-list,
.bottom-menu {
  width: 100%;
  border-right: 0;
}

.menu-list {
  flex: 1;
  margin-top: var(--el-component-size-small);
}
</style>
