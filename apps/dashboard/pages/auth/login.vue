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

      <p class="auth-footer-text">
        Don't have an account?
        <NuxtLink to="/auth/register" class="auth-link">Create one</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'marketing' })

const email = ref('')
const password = ref('')
const isLoading = ref(false)
const router = useRouter()

async function handleLogin() {
  isLoading.value = true
  try {
    // In production: call better-auth signIn
    // For demo, navigate directly
    await navigateTo('/app/overview')
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
</style>
