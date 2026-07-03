<template>
  <div>
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" autocomplete="email" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          show-password
        />
      </el-form-item>
    </el-form>
    <el-alert
      title="当前为模板 Mock 登录，任意合法邮箱和非空密码均可登录。"
      type="info"
      :closable="false"
    />
    <div class="login-actions">
      <el-button @click="$emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="loading" @click="submit">登录</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { useAuth } from '../../../composables/useAuth'

const emit = defineEmits<{ cancel: []; success: [] }>()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive({ email: 'test@test.com', password: 'password' })
const rules: FormRules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱', trigger: 'blur' }
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}
const { login } = useAuth()

async function submit(): Promise<void> {
  if (!(await formRef.value?.validate().catch(() => false))) return
  loading.value = true
  try {
    await login(form)
    ElMessage.success('登录成功')
    emit('success')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--el-component-size-small);
  margin-top: var(--el-component-size);
}
</style>
