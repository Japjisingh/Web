<template>
  <div class="providers fade-slide-in">
    <div class="providers__header">
      <h2 class="providers__count mono">{{ providers.length }} providers</h2>
      <button class="btn-primary" @click="showAdd = true">
        <Plus :size="14" />
        Add Provider
      </button>
    </div>

    <div class="providers__grid">
      <div v-for="provider in providers" :key="provider.id" class="card providers__card">
        <div class="providers__card-header">
          <div>
            <h3 class="providers__card-name">{{ provider.name }}</h3>
            <span class="text-muted" style="font-size: 0.6875rem">{{ provider.endpoint }}</span>
          </div>
          <span
            class="providers__status-badge"
            :class="provider.connected ? 'providers__status-badge--connected' : 'providers__status-badge--disconnected'"
          >
            <StatusDot :color="provider.connected ? 'success' : 'danger'" :pulse="provider.connected" />
            {{ provider.connected ? 'Connected' : 'Not Connected' }}
          </span>
        </div>

        <div class="providers__models">
          <span class="providers__models-label">
            <Cpu :size="12" />
            <span class="mono">{{ provider.models.length }}</span> models available
          </span>
          <div class="providers__model-list">
            <span
              v-for="model in provider.models"
              :key="model"
              class="providers__model-badge mono"
            >
              {{ model }}
            </span>
          </div>
        </div>

        <div class="providers__card-stats">
          <div class="providers__stat">
            <span class="providers__stat-label">Uptime</span>
            <span class="providers__stat-value mono">{{ provider.uptime }}</span>
          </div>
          <div class="providers__stat">
            <span class="providers__stat-label">Avg Latency</span>
            <span class="providers__stat-value mono" :style="{ color: getLatencyColor(provider.avgLatency) }">{{ provider.avgLatency }}ms</span>
          </div>
          <div class="providers__stat">
            <span class="providers__stat-label">Last Tested</span>
            <span class="providers__stat-value" style="font-size: 0.75rem; color: var(--text-secondary)">{{ provider.lastTested }}</span>
          </div>
          <div class="providers__stat">
            <span class="providers__stat-label">Test Status</span>
            <span class="providers__stat-value">
              <StatusDot
                :color="provider.testStatus === 'pass' ? 'success' : provider.testStatus === 'fail' ? 'danger' : 'neutral'"
              />
              <span
                class="mono"
                :style="{
                  fontSize: '0.75rem',
                  color: provider.testStatus === 'pass' ? 'var(--success)' : provider.testStatus === 'fail' ? 'var(--danger)' : 'var(--text-muted)'
                }"
              >
                {{ provider.testStatus === 'pass' ? 'Passed' : provider.testStatus === 'fail' ? 'Failed' : 'Untested' }}
              </span>
            </span>
          </div>
        </div>

        <div class="providers__card-actions">
          <button
            class="btn-primary"
            style="flex: 1; height: 32px; font-size: 0.75rem"
            :disabled="provider.testing"
            @click="testConnection(provider.id)"
          >
            <Loader2 v-if="provider.testing" :size="13" class="spin" />
            {{ provider.testing ? 'Testing...' : 'Test Connection' }}
          </button>
          <button class="btn-ghost" style="flex: 1; height: 32px; font-size: 0.75rem" @click="editProvider(provider.id)">
            <Settings :size="13" />
            Configure
          </button>
        </div>
      </div>
    </div>

    <!-- Add Provider SlideOver -->
    <SlideOver v-model="showAdd" title="Add Provider">
      <div class="providers__form">
        <div class="providers__field">
          <label class="providers__field-label">Provider</label>
          <select v-model="addForm.provider">
            <option value="">Select a provider</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google AI</option>
            <option value="mistral">Mistral AI</option>
            <option value="cohere">Cohere</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </div>
        <div class="providers__field">
          <label class="providers__field-label">API Key</label>
          <input v-model="addForm.apiKey" type="password" placeholder="sk-..." />
        </div>
        <div v-if="addForm.provider === 'custom'" class="providers__field">
          <label class="providers__field-label">Base URL</label>
          <input v-model="addForm.baseUrl" type="text" placeholder="https://api.example.com/v1" />
        </div>
        <div class="providers__field">
          <label class="providers__field-label">Organization ID (optional)</label>
          <input v-model="addForm.orgId" type="text" placeholder="org-..." />
        </div>
        <div class="providers__field">
          <label class="providers__field-label">Priority</label>
          <select v-model="addForm.priority">
            <option value="primary">Primary</option>
            <option value="fallback">Fallback</option>
          </select>
        </div>

        <button
          class="providers__test-btn"
          :class="{ 'providers__test-btn--pass': testResult === 'pass', 'providers__test-btn--fail': testResult === 'fail' }"
          :disabled="!addForm.apiKey || testingNew"
          @click="testNewConnection"
        >
          <Loader2 v-if="testingNew" :size="14" class="spin" />
          <Zap v-else :size="14" />
          {{ testingNew ? 'Testing...' : testResult === 'pass' ? 'Connection Successful' : testResult === 'fail' ? 'Connection Failed &mdash; Retry' : 'Test Connection' }}
        </button>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showAdd = false">Cancel</button>
        <button class="btn-primary" @click="addProvider">Add Provider</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
import { Plus, Cpu, Settings, Loader2, Zap } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const showAdd = ref(false)
const testingNew = ref(false)
const testResult = ref<'pass' | 'fail' | null>(null)

const addForm = reactive({
  provider: '',
  apiKey: '',
  baseUrl: '',
  orgId: '',
  priority: 'primary',
})

interface Provider {
  id: string
  name: string
  endpoint: string
  connected: boolean
  models: string[]
  uptime: string
  avgLatency: number
  lastTested: string
  testStatus: 'pass' | 'fail' | 'untested'
  testing: boolean
}

const providers = ref<Provider[]>([
  {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'api.openai.com/v1',
    connected: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'text-embedding-3-large'],
    uptime: '99.98%',
    avgLatency: 42,
    lastTested: '12 seconds ago',
    testStatus: 'pass',
    testing: false,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    endpoint: 'api.anthropic.com/v1',
    connected: true,
    models: ['claude-opus', 'claude-sonnet', 'claude-haiku'],
    uptime: '99.95%',
    avgLatency: 67,
    lastTested: '12 seconds ago',
    testStatus: 'pass',
    testing: false,
  },
  {
    id: 'google',
    name: 'Google AI',
    endpoint: 'generativelanguage.googleapis.com/v1',
    connected: false,
    models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'text-embedding-004'],
    uptime: '\u2014',
    avgLatency: 0,
    lastTested: 'Never',
    testStatus: 'untested',
    testing: false,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    endpoint: 'api.mistral.ai/v1',
    connected: false,
    models: ['mistral-large', 'mistral-medium', 'mistral-small'],
    uptime: '\u2014',
    avgLatency: 0,
    lastTested: 'Never',
    testStatus: 'untested',
    testing: false,
  },
])

function getLatencyColor(ms: number): string {
  if (ms === 0) return 'var(--text-muted)'
  if (ms < 100) return 'var(--success)'
  if (ms < 500) return 'var(--warning)'
  return 'var(--danger)'
}

function testConnection(id: string) {
  const provider = providers.value.find(p => p.id === id)
  if (!provider) return

  provider.testing = true
  setTimeout(() => {
    provider.testing = false
    provider.connected = true
    provider.lastTested = 'Just now'
    provider.testStatus = 'pass'
    if (provider.avgLatency === 0) provider.avgLatency = 89
    if (provider.uptime === '\u2014') provider.uptime = '99.90%'
  }, 1500)
}

function testNewConnection() {
  testingNew.value = true
  testResult.value = null
  setTimeout(() => {
    testingNew.value = false
    testResult.value = 'pass'
  }, 1200)
}

function editProvider(id: string) {
  const provider = providers.value.find(p => p.id === id)
  if (!provider) return
  addForm.provider = id
  showAdd.value = true
}

function addProvider() {
  if (!addForm.provider) return

  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google AI',
    mistral: 'Mistral AI',
    cohere: 'Cohere',
    custom: 'Custom Provider',
  }

  const existing = providers.value.find(p => p.id === addForm.provider)
  if (existing) {
    existing.connected = true
    existing.lastTested = 'Just now'
    existing.testStatus = 'pass'
  } else {
    providers.value.push({
      id: addForm.provider,
      name: names[addForm.provider] || addForm.provider,
      endpoint: addForm.baseUrl || `api.${addForm.provider}.com/v1`,
      connected: true,
      models: [],
      uptime: '\u2014',
      avgLatency: 0,
      lastTested: 'Just now',
      testStatus: 'pass',
      testing: false,
    })
  }

  showAdd.value = false
  addForm.provider = ''
  addForm.apiKey = ''
  addForm.baseUrl = ''
  addForm.orgId = ''
  addForm.priority = 'primary'
  testResult.value = null
}
</script>

<style scoped>
.providers__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.providers__count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.providers__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.providers__card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.providers__card-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.providers__card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.providers__status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 9999px;
  white-space: nowrap;
  height: fit-content;
}

.providers__status-badge--connected {
  color: var(--success);
  background: rgba(0, 217, 126, 0.1);
}

.providers__status-badge--disconnected {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

.providers__models {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.providers__models-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.providers__model-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.providers__model-badge {
  font-size: 0.6875rem;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
}

.providers__card-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.providers__stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.providers__stat-label {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.providers__stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 5px;
}

.providers__card-actions {
  display: flex;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
}

.providers__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.providers__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.providers__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.providers__field input,
.providers__field select {
  width: 100%;
}

.providers__test-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.providers__test-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.providers__test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.providers__test-btn--pass {
  color: var(--success);
  border-color: rgba(0, 217, 126, 0.3);
  background: rgba(0, 217, 126, 0.08);
}

.providers__test-btn--fail {
  color: var(--danger);
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
