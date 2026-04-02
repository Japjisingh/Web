<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">
        <span class="auth-logo__text mono">NeuralGate</span>
        <StatusDot color="success" :pulse="true" />
      </div>
      <h1 class="auth-title">Welcome back</h1>
      <p class="auth-subtitle">Sign in to your dashboard</p>

      <form class="auth-form" @submit.prevent="handleLogin">
        <div class="auth-field">
          <label class="auth-label">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="you@company.com"
            required
            autocomplete="email"
          />
        </div>

        <div class="auth-field">
          <label class="auth-label">Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn-primary auth-submit" :disabled="isLoading">
          {{ isLoading ? 'Signing in...' : 'Sign in' }}
        </button>
      </form>

      <div v-if="error" class="auth-error">{{ error }}</div>

      <button class="auth-demo-btn" @click="fillDemo">
        Use demo account
      </button>

      <p class="auth-footer-text">
        Don't have an account?
        <NuxtLink to="/auth/register" class="auth-link">Create one</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' })

const DEMO_EMAIL = 'demo@neuralgate.io'
const DEMO_PASSWORD = 'neuralgate2026'

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const error = ref('')

function fillDemo() {
  email.value = DEMO_EMAIL
  password.value = DEMO_PASSWORD
}

async function handleLogin() {
  error.value = ''
  isLoading.value = true
  try {
    // Demo mode: accept demo credentials or any credentials
    if (email.value === DEMO_EMAIL && password.value === DEMO_PASSWORD) {
      await navigateTo('/app/overview')
    } else if (email.value && password.value) {
      // In production: call better-auth signIn
      // For demo, allow any valid-looking credentials
      await navigateTo('/app/overview')
    } else {
      error.value = 'Please enter email and password'
    }
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

.auth-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.auth-logo__text {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: -12px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.auth-field input {
  height: 40px;
  padding: 0 12px;
}

.auth-submit {
  height: 40px;
  width: 100%;
  font-weight: 600;
  margin-top: 4px;
}

.auth-footer-text {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: center;
}

.auth-link {
  color: var(--primary);
  font-weight: 500;
}

.auth-error {
  font-size: 0.8125rem;
  color: var(--danger);
  background: var(--danger-muted);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--danger);
}

.auth-demo-btn {
  width: 100%;
  height: 40px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  transition: all var(--transition-fast);
}

.auth-demo-btn:hover {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-muted);
}
</style>
