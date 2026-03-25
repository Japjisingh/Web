<template>
  <div class="onboarding">
    <div class="onboarding__dots">
      <span v-for="i in 4" :key="i" class="onboarding__dot" :class="{ 'onboarding__dot--active': step >= i, 'onboarding__dot--current': step === i }" />
    </div>

    <!-- Step 1: Team info -->
    <div v-if="step === 1" class="onboarding__step fade-slide-in">
      <h1 class="onboarding__title">Tell us about your team</h1>
      <p class="onboarding__subtitle">We'll customise NeuralGate for your industry</p>

      <div class="onboarding__field">
        <label class="onboarding__label">Company name</label>
        <input v-model="orgName" type="text" placeholder="Acme Corp" class="onboarding__input" />
      </div>

      <label class="onboarding__label" style="margin-top: 16px">Industry vertical</label>
      <div class="onboarding__verticals">
        <button
          v-for="v in verticals"
          :key="v.id"
          class="onboarding__vertical-card"
          :class="{ 'onboarding__vertical-card--selected': selectedVertical === v.id }"
          @click="selectedVertical = v.id"
        >
          <span class="onboarding__vertical-emoji">{{ v.emoji }}</span>
          <span class="onboarding__vertical-name">{{ v.name }}</span>
        </button>
      </div>

      <button class="btn-primary onboarding__next" :disabled="!orgName || !selectedVertical" @click="step = 2">
        Continue
      </button>
    </div>

    <!-- Step 2: Connect provider -->
    <div v-if="step === 2" class="onboarding__step fade-slide-in">
      <h1 class="onboarding__title">Connect your first AI provider</h1>
      <p class="onboarding__subtitle">We'll route your requests through NeuralGate</p>

      <div class="onboarding__providers">
        <button
          v-for="p in providers"
          :key="p.id"
          class="onboarding__provider-card"
          :class="{ 'onboarding__provider-card--selected': selectedProvider === p.id }"
          @click="selectedProvider = p.id"
        >
          <span class="onboarding__provider-name">{{ p.name }}</span>
        </button>
      </div>

      <div v-if="selectedProvider" class="onboarding__field" style="margin-top: 16px">
        <label class="onboarding__label">{{ selectedProvider }} API Key</label>
        <input v-model="providerKey" type="password" placeholder="sk-..." class="onboarding__input mono" />
        <button class="btn-ghost" style="margin-top: 8px; align-self: flex-start" @click="testConnection">
          {{ testStatus === 'testing' ? 'Testing...' : testStatus === 'success' ? 'Connected' : 'Test connection' }}
        </button>
        <p v-if="testStatus === 'success'" class="onboarding__success">Connected — gpt-4o available</p>
      </div>

      <button class="btn-primary onboarding__next" :disabled="testStatus !== 'success'" @click="step = 3">
        Continue
      </button>
    </div>

    <!-- Step 3: API Key -->
    <div v-if="step === 3" class="onboarding__step fade-slide-in">
      <h1 class="onboarding__title">Your NeuralGate API key</h1>
      <p class="onboarding__subtitle">Use this key to route requests through NeuralGate</p>

      <div class="onboarding__key-card">
        <code class="mono onboarding__key-value">{{ generatedKey }}</code>
        <button class="btn-ghost" @click="copyKey">
          {{ keyCopied ? 'Copied!' : 'Copy' }}
        </button>
      </div>

      <CodeBlock
        :code="integrationSnippets"
        :tabs="['Node.js', 'Python', 'curl']"
        language="javascript"
      />

      <p class="onboarding__hint">Don't worry — you can create more keys anytime</p>

      <button class="btn-primary onboarding__next" :disabled="!keyCopied" @click="step = 4">
        I've copied this — continue
      </button>
    </div>

    <!-- Step 4: Test request -->
    <div v-if="step === 4" class="onboarding__step fade-slide-in">
      <h1 class="onboarding__title">Send your first request</h1>
      <p class="onboarding__subtitle">Let's make sure everything works</p>

      <div class="onboarding__test-grid">
        <div class="onboarding__test-code">
          <CodeBlock :code="testCurl" language="curl" />
        </div>
        <div class="onboarding__test-result card">
          <div v-if="!testSent" class="onboarding__test-empty">
            <div class="skeleton" style="width: 100%; height: 14px; margin-bottom: 8px" />
            <div class="skeleton" style="width: 80%; height: 14px; margin-bottom: 8px" />
            <div class="skeleton" style="width: 60%; height: 14px" />
          </div>
          <div v-else class="onboarding__test-success fade-slide-in">
            <StatusDot color="success" :pulse="true" />
            <div class="onboarding__test-metrics">
              <span class="mono">Tokens: 24 → 156</span>
              <span class="mono">Cost: £0.0012</span>
              <span class="mono">Latency: 342ms</span>
            </div>
          </div>
        </div>
      </div>

      <button v-if="!testSent" class="btn-primary onboarding__next" @click="sendTestRequest">
        Send test request
      </button>
      <div v-else class="onboarding__complete fade-slide-in">
        <p class="onboarding__success" style="font-size: 1rem">Perfect. NeuralGate is working.</p>
        <NuxtLink to="/app/overview" class="btn-primary onboarding__next">
          Go to Dashboard
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { VERTICALS } from '@neuralgate/shared/constants'

definePageMeta({ layout: 'marketing' })

const step = ref(1)
const orgName = ref('')
const selectedVertical = ref('')
const selectedProvider = ref('')
const providerKey = ref('')
const testStatus = ref<'idle' | 'testing' | 'success' | 'error'>('idle')
const keyCopied = ref(false)
const testSent = ref(false)

const verticals = VERTICALS
const providers = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'google', name: 'Google' },
  { id: 'mistral', name: 'Mistral' },
]

const generatedKey = 'ng_live_a8f2c9d1e3b7f4a6c8d2e5b9f1a3c7d9e2b4f6a8c1d3e5b7f9a2c4'

const integrationSnippets: Record<string, string> = {
  'Node.js': `const openai = new OpenAI({
  apiKey: '${generatedKey}',
  baseURL: 'https://gateway.neuralgate.io/v1'
})`,
  Python: `client = OpenAI(
    api_key="${generatedKey}",
    base_url="https://gateway.neuralgate.io/v1"
)`,
  curl: `curl https://gateway.neuralgate.io/v1/chat/completions \\
  -H "Authorization: Bearer ${generatedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'`,
}

const testCurl = `curl https://gateway.neuralgate.io/v1/chat/completions \\
  -H "Authorization: Bearer ${generatedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "Say hello"}]}'`

function testConnection() {
  testStatus.value = 'testing'
  setTimeout(() => { testStatus.value = 'success' }, 1500)
}

async function copyKey() {
  await navigator.clipboard.writeText(generatedKey)
  keyCopied.value = true
}

function sendTestRequest() {
  setTimeout(() => { testSent.value = true }, 1200)
}
</script>

<style scoped>
.onboarding {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  max-width: 640px;
  margin: 0 auto;
}

.onboarding__dots {
  display: flex;
  gap: 8px;
  margin-bottom: 48px;
}

.onboarding__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
  transition: all var(--transition-fast);
}

.onboarding__dot--active { background: var(--primary); }
.onboarding__dot--current { width: 24px; border-radius: 4px; }

.onboarding__step {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.onboarding__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.onboarding__subtitle {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.onboarding__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.onboarding__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.onboarding__input {
  height: 40px;
  padding: 0 12px;
  width: 100%;
}

.onboarding__verticals {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.onboarding__vertical-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.onboarding__vertical-card:hover { border-color: var(--border-strong); }
.onboarding__vertical-card--selected { border-color: var(--primary); background: var(--primary-muted); }

.onboarding__vertical-emoji { font-size: 1.5rem; }
.onboarding__vertical-name { font-size: 0.6875rem; color: var(--text-secondary); text-align: center; }

.onboarding__providers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.onboarding__provider-card {
  padding: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.onboarding__provider-card:hover { border-color: var(--border-strong); }
.onboarding__provider-card--selected { border-color: var(--primary); background: var(--primary-muted); }

.onboarding__success { color: var(--success); font-size: 0.8125rem; font-weight: 500; }
.onboarding__hint { color: var(--text-muted); font-size: 0.8125rem; }

.onboarding__key-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.onboarding__key-value {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--primary);
  word-break: break-all;
}

.onboarding__next {
  height: 44px;
  width: 100%;
  font-weight: 600;
  margin-top: 16px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.onboarding__test-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.onboarding__test-result {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 150px;
}

.onboarding__test-success {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.onboarding__test-metrics {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.onboarding__complete {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
</style>
