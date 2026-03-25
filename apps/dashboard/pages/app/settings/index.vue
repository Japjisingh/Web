<template>
  <div class="settings fade-slide-in">
    <div class="settings__header">
      <h2 class="settings__title">Vertical Intelligence</h2>
      <p class="text-secondary" style="font-size: 0.8125rem; margin-top: 4px">Configure caching, privacy, routing, and prompt engineering for your vertical.</p>
    </div>

    <!-- Caching Section -->
    <div class="card settings__section">
      <div class="settings__section-header">
        <div>
          <h3 class="settings__section-title">
            <Database :size="15" />
            Caching
          </h3>
          <p class="settings__field-desc">Semantic cache reduces costs by returning cached responses for similar queries.</p>
        </div>
        <button
          class="settings__toggle-btn"
          :class="{ 'settings__toggle-btn--on': caching.enabled }"
          @click="caching.enabled = !caching.enabled"
        >
          {{ caching.enabled ? 'Enabled' : 'Disabled' }}
        </button>
      </div>

      <div v-if="caching.enabled" class="settings__section-body">
        <div class="settings__section-grid">
          <div class="settings__field">
            <label class="settings__field-label">Similarity Threshold</label>
            <p class="settings__field-desc">How similar a new query must be to a cached query to return the cached result. Higher values require closer matches (more precise), lower values allow broader matches (more cache hits).</p>
            <div class="settings__slider-row">
              <input
                v-model.number="caching.similarityThreshold"
                type="range"
                min="0.85"
                max="0.99"
                step="0.01"
                class="settings__slider"
              />
              <span class="mono settings__slider-value">{{ caching.similarityThreshold.toFixed(2) }}</span>
            </div>
          </div>

          <div class="settings__field">
            <label class="settings__field-label">Cache TTL</label>
            <select v-model="caching.ttl">
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </div>

          <div class="settings__field settings__field--full">
            <label class="settings__field-label">Cache Exceptions</label>
            <p class="settings__field-desc">Endpoints or patterns to exclude from caching. One per line.</p>
            <textarea
              v-model="caching.exceptions"
              class="settings__textarea settings__textarea--code"
              rows="3"
              placeholder="/api/chat/stream&#10;/api/realtime/*"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Privacy Section -->
    <div class="card settings__section">
      <div class="settings__section-header">
        <div>
          <h3 class="settings__section-title">
            <Shield :size="15" />
            Privacy
          </h3>
          <p class="settings__field-desc">PII detection and data retention controls.</p>
        </div>
        <button
          class="settings__toggle-btn"
          :class="{ 'settings__toggle-btn--on': privacy.piiDetection }"
          @click="privacy.piiDetection = !privacy.piiDetection"
        >
          {{ privacy.piiDetection ? 'PII Detection On' : 'PII Detection Off' }}
        </button>
      </div>

      <div class="settings__section-body">
        <div class="settings__section-grid">
          <div v-if="privacy.piiDetection" class="settings__field">
            <label class="settings__field-label">PII Action</label>
            <select v-model="privacy.piiAction">
              <option value="detect">Detect &amp; Flag</option>
              <option value="strip">Detect &amp; Strip</option>
              <option value="block">Detect &amp; Block Request</option>
            </select>
            <p class="settings__field-desc">
              {{ privacy.piiAction === 'detect' ? 'PII will be flagged in logs but requests will proceed.' :
                 privacy.piiAction === 'strip' ? 'PII will be automatically redacted before forwarding to providers.' :
                 'Requests containing PII will be rejected with a 422 error.' }}
            </p>
          </div>

          <div class="settings__field">
            <label class="settings__field-label">Data Retention</label>
            <select v-model="privacy.dataRetention">
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="1y">1 year</option>
              <option value="none">No retention (pass-through only)</option>
            </select>
            <p class="settings__field-desc">How long request/response data is retained for analytics.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Model Routing Section -->
    <div class="card settings__section">
      <div class="settings__section-header">
        <div>
          <h3 class="settings__section-title">
            <GitBranch :size="15" />
            Model Routing
          </h3>
          <p class="settings__field-desc">Route queries to the optimal model based on complexity analysis.</p>
        </div>
        <button
          class="settings__toggle-btn"
          :class="{ 'settings__toggle-btn--on': routing.smartRouting }"
          @click="routing.smartRouting = !routing.smartRouting"
        >
          {{ routing.smartRouting ? 'Smart Routing On' : 'Smart Routing Off' }}
        </button>
      </div>

      <div v-if="routing.smartRouting" class="settings__section-body">
        <div class="settings__section-grid">
          <div class="settings__field">
            <label class="settings__field-label">Simple Query Model</label>
            <select v-model="routing.simpleModel">
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="claude-haiku">claude-haiku</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="mistral-small">mistral-small</option>
            </select>
            <p class="settings__field-desc">Model used for simple, low-complexity prompts.</p>
          </div>

          <div class="settings__field">
            <label class="settings__field-label">Complex Query Model</label>
            <select v-model="routing.complexModel">
              <option value="gpt-4o">gpt-4o</option>
              <option value="claude-sonnet">claude-sonnet</option>
              <option value="gemini-2.0-pro">gemini-2.0-pro</option>
              <option value="mistral-large">mistral-large</option>
            </select>
            <p class="settings__field-desc">Model used for complex, high-stakes prompts.</p>
          </div>

          <div class="settings__field settings__field--full">
            <label class="settings__field-label">Complexity Threshold</label>
            <p class="settings__field-desc">Queries scoring below this threshold are routed to the simple model, above to the complex model.</p>
            <div class="settings__slider-row">
              <input
                v-model.number="routing.complexityThreshold"
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                class="settings__slider"
              />
              <span class="mono settings__slider-value">{{ routing.complexityThreshold.toFixed(2) }}</span>
            </div>
          </div>

          <div class="settings__field settings__field--full">
            <label class="settings__field-label">Routing Split (last 7 days)</label>
            <div class="settings__routing-stats">
              <div class="settings__routing-bar">
                <div class="settings__routing-bar-simple" :style="{ width: routingStats.simple + '%' }">
                  <span class="mono">{{ routingStats.simple }}%</span>
                </div>
                <div class="settings__routing-bar-complex" :style="{ width: routingStats.complex + '%' }">
                  <span class="mono">{{ routingStats.complex }}%</span>
                </div>
              </div>
              <div class="settings__routing-legend">
                <span class="settings__routing-legend-item">
                  <span class="settings__routing-dot settings__routing-dot--simple" />
                  Simple ({{ routing.simpleModel }})
                  <span class="mono text-muted">{{ routingStats.simpleCount.toLocaleString() }} reqs</span>
                </span>
                <span class="settings__routing-legend-item">
                  <span class="settings__routing-dot settings__routing-dot--complex" />
                  Complex ({{ routing.complexModel }})
                  <span class="mono text-muted">{{ routingStats.complexCount.toLocaleString() }} reqs</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Prompt Engineering Section -->
    <div class="card settings__section">
      <div class="settings__section-header">
        <div>
          <h3 class="settings__section-title">
            <Wand2 :size="15" />
            Prompt Engineering
          </h3>
          <p class="settings__field-desc">Automatic prompt compression and system prompt injection.</p>
        </div>
        <button
          class="settings__toggle-btn"
          :class="{ 'settings__toggle-btn--on': prompts.compression }"
          @click="prompts.compression = !prompts.compression"
        >
          {{ prompts.compression ? 'Compression On' : 'Compression Off' }}
        </button>
      </div>

      <div class="settings__section-body">
        <div class="settings__section-grid">
          <div class="settings__field settings__field--full">
            <label class="settings__field-label">System Prompt Prefix</label>
            <p class="settings__field-desc">Prepended to all system prompts sent through NeuralGate. Useful for enforcing tone, format, or safety guidelines.</p>
            <textarea
              v-model="prompts.systemPrefix"
              class="settings__textarea settings__textarea--code"
              rows="4"
              placeholder="You are a helpful assistant for our ecommerce platform. Always respond in a professional tone."
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Save bar -->
    <div class="settings__save-bar">
      <span class="text-muted" style="font-size: 0.75rem">Changes are saved automatically</span>
      <button class="btn-primary" @click="saveSettings">Save Configuration</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Database, Shield, GitBranch, Wand2 } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

// --- Caching ---
const caching = reactive({
  enabled: true,
  similarityThreshold: 0.92,
  ttl: '24h',
  exceptions: '/api/chat/stream\n/api/realtime/*',
})

// --- Privacy ---
const privacy = reactive({
  piiDetection: true,
  piiAction: 'strip',
  dataRetention: '30d',
})

// --- Model Routing ---
const routing = reactive({
  smartRouting: true,
  simpleModel: 'gpt-4o-mini',
  complexModel: 'claude-sonnet',
  complexityThreshold: 0.45,
})

const routingStats = reactive({
  simple: 68,
  complex: 32,
  simpleCount: 194210,
  complexCount: 91320,
})

// --- Prompt Engineering ---
const prompts = reactive({
  compression: true,
  systemPrefix: 'You are a helpful assistant for our ecommerce platform. Always be concise and accurate. Do not hallucinate product information.',
})

function saveSettings() {
  // Demo: in production this would POST to the API
}
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings__header {
  margin-bottom: 4px;
}

.settings__title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* --- Sections --- */
.settings__section {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.settings__section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.settings__section-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.settings__section-body {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--border-base);
}

.settings__section-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

/* --- Toggle button --- */
.settings__toggle-btn {
  padding: 5px 14px;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  flex-shrink: 0;
}

.settings__toggle-btn--on {
  color: var(--success);
  border-color: rgba(0, 217, 126, 0.3);
  background: rgba(0, 217, 126, 0.08);
}

/* --- Fields --- */
.settings__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.settings__field--full {
  grid-column: 1 / -1;
}

.settings__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.settings__field-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.settings__field select {
  width: 100%;
}

/* --- Slider --- */
.settings__slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings__slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 2px;
  outline: none;
}

.settings__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 1px var(--primary);
}

.settings__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: var(--primary);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--bg-surface);
  box-shadow: 0 0 0 1px var(--primary);
}

.settings__slider-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  min-width: 36px;
  text-align: right;
}

/* --- Textarea --- */
.settings__textarea {
  width: 100%;
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 0.8125rem;
  color: var(--text-primary);
  font-family: var(--font-ui);
  resize: vertical;
  line-height: 1.5;
  transition: border-color var(--transition-fast);
}

.settings__textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.settings__textarea--code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

/* --- Routing stats --- */
.settings__routing-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 14px;
}

.settings__routing-bar {
  display: flex;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  gap: 2px;
}

.settings__routing-bar-simple,
.settings__routing-bar-complex {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width var(--transition-fast);
}

.settings__routing-bar-simple span,
.settings__routing-bar-complex span {
  font-size: 0.6875rem;
  font-weight: 600;
}

.settings__routing-bar-simple {
  background: rgba(0, 217, 126, 0.2);
  color: var(--success);
}

.settings__routing-bar-complex {
  background: rgba(91, 94, 244, 0.2);
  color: var(--primary);
}

.settings__routing-legend {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 4px;
}

.settings__routing-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.settings__routing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.settings__routing-dot--simple {
  background: var(--success);
}

.settings__routing-dot--complex {
  background: var(--primary);
}

/* --- Save bar --- */
.settings__save-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

/* --- Responsive --- */
@media (max-width: 768px) {
  .settings__section-grid {
    grid-template-columns: 1fr;
  }
}
</style>
