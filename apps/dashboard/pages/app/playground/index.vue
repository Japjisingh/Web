<template>
  <div class="playground fade-slide-in">
    <div class="playground__layout">
      <!-- Left pane: Input -->
      <div class="playground__input">
        <div class="playground__field">
          <label class="playground__label">Model</label>
          <select v-model="selectedModel" class="playground__select">
            <option v-for="m in models" :key="m.id" :value="m.id">
              {{ m.name }} — ${{ m.inputPrice }}/1M input
            </option>
          </select>
        </div>

        <div class="playground__field">
          <label class="playground__label">System Prompt</label>
          <textarea
            v-model="systemPrompt"
            class="playground__textarea mono"
            rows="4"
            placeholder="You are a helpful assistant..."
          />
        </div>

        <div class="playground__field">
          <label class="playground__label">User Message</label>
          <textarea
            v-model="userMessage"
            class="playground__textarea"
            rows="6"
            placeholder="Type your message..."
          />
        </div>

        <div class="playground__params">
          <div class="playground__param">
            <label class="playground__label">Temperature</label>
            <div class="playground__slider-row">
              <input type="range" v-model.number="temperature" min="0" max="2" step="0.1" class="playground__slider" />
              <span class="mono">{{ temperature.toFixed(1) }}</span>
            </div>
          </div>
          <div class="playground__param">
            <label class="playground__label">Max Tokens</label>
            <input v-model.number="maxTokens" type="number" class="playground__number-input mono" />
          </div>
          <div class="playground__param">
            <label class="playground__label">Stream</label>
            <button
              class="playground__toggle"
              :class="{ 'playground__toggle--on': stream }"
              @click="stream = !stream"
            >
              {{ stream ? 'ON' : 'OFF' }}
            </button>
          </div>
        </div>

        <div class="playground__estimate mono">
          ~£{{ estimatedCost }} estimated
        </div>

        <div class="playground__actions">
          <button class="btn-primary" @click="runPrompt" :disabled="isRunning || !userMessage">
            {{ isRunning ? 'Running...' : 'Run' }}
          </button>
          <button class="btn-ghost" @click="runCompare" :disabled="isRunning || !userMessage">
            Run & Compare
          </button>
        </div>
      </div>

      <!-- Right pane: Output -->
      <div class="playground__output card">
        <template v-if="!hasResponse && !isRunning">
          <EmptyState
            title="Ready to run"
            description="Enter a prompt and click Run to see results"
            icon="activity"
          />
        </template>

        <template v-else-if="isRunning">
          <div class="playground__streaming">
            <div class="skeleton" style="width: 80%; height: 14px; margin-bottom: 8px" />
            <div class="skeleton" style="width: 60%; height: 14px; margin-bottom: 8px" />
            <div class="skeleton" style="width: 70%; height: 14px" />
          </div>
        </template>

        <template v-else>
          <div class="playground__response fade-slide-in">
            <p class="playground__response-text">{{ responseText }}</p>
          </div>
          <div class="playground__metrics">
            <span class="playground__metric mono">
              Tokens: {{ responseMetrics.inputTokens }}→{{ responseMetrics.outputTokens }}
            </span>
            <span class="playground__metric mono">
              Cost: £{{ responseMetrics.cost }}
            </span>
            <span class="playground__metric mono" :style="{ color: responseMetrics.latencyMs < 500 ? 'var(--success)' : 'var(--warning)' }">
              {{ responseMetrics.latencyMs }}ms
            </span>
            <ModelBadge :model="selectedModel" />
            <span class="playground__metric mono" :style="{ color: 'var(--text-muted)' }">
              Not cached
            </span>
          </div>
          <button class="btn-ghost" style="margin-top: 8px; font-size: 0.75rem">
            Save to Library
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const models = [
  { id: 'gpt-4o', name: 'GPT-4o', inputPrice: '2.50', outputPrice: '10.00' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', inputPrice: '0.15', outputPrice: '0.60' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', inputPrice: '3.00', outputPrice: '15.00' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', inputPrice: '0.80', outputPrice: '4.00' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', inputPrice: '0.075', outputPrice: '0.30' },
]

const selectedModel = ref('gpt-4o')
const systemPrompt = ref('')
const userMessage = ref('')
const temperature = ref(0.7)
const maxTokens = ref(2048)
const stream = ref(false)
const isRunning = ref(false)
const hasResponse = ref(false)
const responseText = ref('')
const responseMetrics = reactive({
  inputTokens: 0,
  outputTokens: 0,
  cost: '0.0000',
  latencyMs: 0,
})

const estimatedCost = computed(() => {
  const words = (systemPrompt.value + ' ' + userMessage.value).split(/\s+/).length
  const estimatedTokens = Math.max(words * 1.3, 10)
  const model = models.find((m) => m.id === selectedModel.value)
  if (!model) return '0.0000'
  const cost = (estimatedTokens / 1_000_000) * parseFloat(model.inputPrice) + (maxTokens.value / 1_000_000) * parseFloat(model.outputPrice)
  return cost.toFixed(4)
})

function runPrompt() {
  isRunning.value = true
  hasResponse.value = false

  setTimeout(() => {
    responseText.value = 'Hello! I\'m happy to help you today. NeuralGate is running this request through the AI gateway, tracking costs, latency, and caching automatically. Every request is logged and analysed for potential optimisations.'
    responseMetrics.inputTokens = 24 + (systemPrompt.value.split(/\s+/).length || 0)
    responseMetrics.outputTokens = 42
    responseMetrics.cost = '0.0034'
    responseMetrics.latencyMs = 284
    isRunning.value = false
    hasResponse.value = true
  }, 1500)
}

function runCompare() {
  runPrompt()
}
</script>

<style scoped>
.playground__layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  min-height: calc(100vh - 120px);
}

.playground__input {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.playground__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.playground__label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.playground__select {
  height: 36px;
  padding: 0 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
}

.playground__textarea {
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8125rem;
  resize: vertical;
  font-family: var(--font-ui);
  line-height: 1.5;
}

.playground__textarea.mono {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.playground__params {
  display: flex;
  gap: 16px;
  align-items: flex-end;
}

.playground__param {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.playground__slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.playground__slider {
  flex: 1;
  accent-color: var(--primary);
}

.playground__number-input {
  height: 32px;
  width: 100%;
  padding: 0 8px;
  font-size: 0.8125rem;
}

.playground__toggle {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.playground__toggle--on {
  background: var(--primary-muted);
  border-color: var(--primary);
  color: var(--primary);
}

.playground__estimate {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.playground__actions {
  display: flex;
  gap: 8px;
}

.playground__output {
  display: flex;
  flex-direction: column;
}

.playground__response {
  flex: 1;
}

.playground__response-text {
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--text-primary);
}

.playground__metrics {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-base);
  margin-top: 12px;
  flex-wrap: wrap;
}

.playground__metric {
  font-size: 0.6875rem;
  color: var(--text-secondary);
}
</style>
