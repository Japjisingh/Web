<template>
  <div class="settings fade-slide-in">
    <div class="settings__header">
      <h2 class="settings__title">Vertical Intelligence Configuration</h2>
      <p class="text-secondary" style="font-size: 0.8125rem; margin-top: 4px">Fine-tune caching, privacy, routing and prompt engineering for your deployment.</p>
    </div>

    <!-- Caching Section -->
    <div class="card settings__section">
      <h3 class="settings__section-title">Caching</h3>
      <div class="settings__section-grid">
        <div class="settings__field">
          <div class="settings__field-row">
            <div>
              <label class="settings__field-label">Semantic Caching</label>
              <p class="settings__field-desc">Cache responses for semantically similar prompts to reduce cost and latency.</p>
            </div>
            <button
              class="settings__toggle"
              :class="{ 'settings__toggle--active': caching.enabled }"
              @click="caching.enabled = !caching.enabled"
            >
              <span class="settings__toggle-track">
                <span class="settings__toggle-thumb" />
              </span>
            </button>
          </div>
        </div>

        <div class="settings__field">
          <label class="settings__field-label">Similarity Threshold</label>
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
          <p class="settings__field-desc">Higher values require closer matches. Recommended: 0.92-0.95.</p>
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

        <div class="settings__field">
          <label class="settings__field-label">Cache Exceptions</label>
          <textarea
            v-model="caching.exceptions"
            class="settings__textarea"
            rows="3"
            placeholder="/api/chat/completions&#10;/api/generate&#10;One endpoint per line..."
          />
          <p class="settings__field-desc">Endpoints that should bypass caching. One per line.</p>
        </div>
      </div>
    </div>

    <!-- Privacy Section -->
    <div class="card settings__section">
      <h3 class="settings__section-title">Privacy</h3>
      <div class="settings__section-grid">
        <div class="settings__field">
          <div class="settings__field-row">
            <div>
              <label class="settings__field-label">PII Detection</label>
              <p class="settings__field-desc">Automatically detect personally identifiable information in prompts before sending to providers.</p>
            </div>
            <button
              class="settings__toggle"
              :class="{ 'settings__toggle--active': privacy.piiDetection }"
              @click="privacy.piiDetection = !privacy.piiDetection"
            >
              <span class="settings__toggle-track">
                <span class="settings__toggle-thumb" />
              </span>
            </button>
          </div>
        </div>

        <div class="settings__field">
          <label class="settings__field-label">PII Action</label>
          <select v-model="privacy.piiAction">
            <option value="detect">Detect &amp; Log</option>
            <option value="strip">Strip PII</option>
            <option value="block">Block Request</option>
          </select>
          <p class="settings__field-desc">Action to take when PII is detected in a request.</p>
        </div>

        <div class="settings__field">
          <label class="settings__field-label">Data Retention</label>
          <select v-model="privacy.dataRetention">
            <option value="none">No retention</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
          </select>
          <p class="settings__field-desc">How long request/response data is retained for analytics.</p>
        </div>
      </div>
    </div>

    <!-- Model Routing Section -->
    <div class="card settings__section">
      <h3 class="settings__section-title">Model Routing</h3>
      <div class="settings__section-grid">
        <div class="settings__field">
          <div class="settings__field-row">
            <div>
              <label class="settings__field-label">Smart Routing</label>
              <p class="settings__field-desc">Automatically route requests to the optimal model based on prompt complexity.</p>
            </div>
            <button
              class="settings__toggle"
              :class="{ 'settings__toggle--active': routing.smartRouting }"
              @click="routing.smartRouting = !routing.smartRouting"
            >
              <span class="settings__toggle-track">
                <span class="settings__toggle-thumb" />
              </span>
            </button>
          </div>
        </div>

        <div class="settings__field">
          <label class="settings__field-label">Simple Model</label>
          <select v-model="routing.simpleModel">
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="claude-haiku">claude-haiku</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            <option value="mistral-small">mistral-small</option>
          </select>
          <p class="settings__field-desc">Model used for simple, low-complexity prompts.</p>
        </div>

        <div class="settings__field">
          <label class="settings__field-label">Complex Model</label>
          <select v-model="routing.complexModel">
            <option value="gpt-4o">gpt-4o</option>
            <option value="claude-opus">claude-opus</option>
            <option value="claude-sonnet">claude-sonnet</option>
            <option value="gemini-2.0-pro">gemini-2.0-pro</option>
            <option value="mistral-large">mistral-large</option>
          </select>
          <p class="settings__field-desc">Model used for complex, high-stakes prompts.</p>
        </div>

        <div class="settings__field">
          <label class="settings__field-label">Complexity Threshold</label>
          <div class="settings__slider-row">
            <input
              v-model.number="routing.complexityThreshold"
              type="range"
              min="0"
              max="1"
              step="0.05"
              class="settings__slider"
            />
            <span class="mono settings__slider-value">{{ routing.complexityThreshold.toFixed(2) }}</span>
          </div>
          <p class="settings__field-desc">Prompts scoring above this threshold are routed to the complex model.</p>
        </div>

        <div class="settings__field settings__field--full">
          <label class="settings__field-label">Routing Split (last 7d)</label>
          <div class="settings__routing-stats">
            <div class="settings__routing-bar">
              <div class="settings__routing-bar-simple" :style="{ width: routing.splitSimple + '%' }" />
              <div class="settings__routing-bar-complex" :style="{ width: routing.splitComplex + '%' }" />
            </div>
            <div class="settings__routing-legend">
              <span class="settings__routing-legend-item">
                <span class="settings__routing-dot settings__routing-dot--simple" />
                Simple <span class="mono">{{ routing.splitSimple }}%</span>
              </span>
              <span class="settings__routing-legend-item">
                <span class="settings__routing-dot settings__routing-dot--complex" />
                Complex <span class="mono">{{ routing.splitComplex }}%</span>
              </span>
              <span class="text-muted mono" style="font-size: 0.75rem; margin-left: auto">
                Est. savings: &pound;{{ routing.estimatedSavings }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Prompt Engineering Section -->
    <div class="card settings__section">
      <h3 class="settings__section-title">Prompt Engineering</h3>
      <div class="settings__section-grid">
        <div class="settings__field">
          <div class="settings__field-row">
            <div>
              <label class="settings__field-label">Prompt Compression</label>
              <p class="settings__field-desc">Automatically compress prompts to reduce token usage while preserving intent.</p>
            </div>
            <button
              class="settings__toggle"
              :class="{ 'settings__toggle--active': prompts.compression }"
              @click="prompts.compression = !prompts.compression"
            >
              <span class="settings__toggle-track">
                <span class="settings__toggle-thumb" />
              </span>
            </button>
          </div>
        </div>

        <div class="settings__field settings__field--full">
          <label class="settings__field-label">System Prompt Prefix</label>
          <textarea
            v-model="prompts.systemPrefix"
            class="settings__textarea settings__textarea--code"
            rows="5"
            placeholder="You are a helpful assistant for {{vertical}} applications.&#10;Always respond in valid JSON when format=json is specified."
          />
          <p class="settings__field-desc">Prepended to all system prompts. Supports <span class="mono">&#123;&#123;vertical&#125;&#125;</span> and <span class="mono">&#123;&#123;model&#125;&#125;</span> template variables.</p>
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
definePageMeta({ layout: 'default' })

// --- Caching ---
const caching = reactive({
  enabled: true,
  similarityThreshold: 0.93,
  ttl: '24h',
  exceptions: '/api/chat/stream',
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
  complexityThreshold: 0.65,
  splitSimple: 68,
  splitComplex: 32,
  estimatedSavings: '412.50',
})

// --- Prompt Engineering ---
const prompts = reactive({
  compression: true,
  systemPrefix: 'You are a helpful AI assistant. Be concise and accurate.',
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
  font-weight: 600;
  color: var(--text-primary);
}

/* --- Sections --- */
.settings__section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings__section-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--text-primary);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-base);
}

.settings__section-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
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

.settings__field-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
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

/* --- Toggle --- */
.settings__toggle {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.settings__toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 10px;
  transition: all var(--transition-fast);
}

.settings__toggle--active .settings__toggle-track {
  background: var(--success);
  border-color: var(--success);
}

.settings__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.settings__toggle--active .settings__toggle-thumb {
  transform: translateX(16px);
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
}

.settings__routing-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.settings__routing-bar-simple {
  background: var(--success);
  transition: width var(--transition-fast);
}

.settings__routing-bar-complex {
  background: var(--primary);
  transition: width var(--transition-fast);
}

.settings__routing-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.settings__routing-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings__routing-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
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
