<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <span class="auth-logo__text mono">NeuralGate</span>
        <StatusDot color="success" :pulse="true" />
      </div>
      <h1 class="auth-title">Start saving on AI costs</h1>
      <p class="auth-subtitle">Free forever. No credit card required.</p>

      <form class="auth-form" @submit.prevent="handleRegister">
        <div class="auth-field">
          <label class="auth-label">Full name</label>
          <input v-model="name" type="text" placeholder="Jane Smith" required />
        </div>

        <div class="auth-field">
          <label class="auth-label">Work email</label>
          <input v-model="email" type="email" placeholder="you@company.com" required />
        </div>

        <div class="auth-field">
          <label class="auth-label">Password</label>
          <input v-model="password" type="password" placeholder="Min 8 characters" required minlength="8" />
        </div>

        <button type="submit" class="btn-primary auth-submit" :disabled="isLoading">
          {{ isLoading ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <p class="auth-footer-text">
        Already have an account?
        <NuxtLink to="/auth/login" class="auth-link">Sign in</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' })

const name = ref('')
const email = ref('')
const password = ref('')
const isLoading = ref(false)

async function handleRegister() {
  isLoading.value = true
  try {
    await navigateTo('/onboarding')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.auth-logo { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.auth-logo__text { font-size: 1.125rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-mono); }
.auth-title { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); }
.auth-subtitle { font-size: 0.875rem; color: var(--text-secondary); margin-top: -12px; }
.auth-form { display: flex; flex-direction: column; gap: 16px; }
.auth-field { display: flex; flex-direction: column; gap: 6px; }
.auth-label { font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); }
.auth-field input { height: 40px; padding: 0 12px; }
.auth-submit { height: 40px; width: 100%; font-weight: 600; margin-top: 4px; }
.auth-footer-text { font-size: 0.8125rem; color: var(--text-secondary); text-align: center; }
.auth-link { color: var(--primary); font-weight: 500; }
</style>
