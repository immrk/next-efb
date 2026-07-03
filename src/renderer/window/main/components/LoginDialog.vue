<template>
  <el-dialog v-model="visible" title="登录" width="420" destroy-on-close>
    <LoginBox @cancel="visible = false" @success="visible = false" />
  </el-dialog>
</template>

<script setup lang="ts">
import LoginBox from '../../login/components/LoginBox.vue'

const visible = defineModel<boolean>({ required: true })
</script>
