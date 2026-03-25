<template>
  <div class="alerts fade-slide-in">
    <div class="alerts__header">
      <h2 class="alerts__count mono">{{ alertRules.length }} alert rules</h2>
      <button class="btn-primary" @click="showCreate = true">Create Alert</button>
    </div>

    <!-- Alert Rules List -->
    <div class="alerts__rules">
      <div v-for="rule in alertRules" :key="rule.id" class="card alerts__rule">
        <div class="alerts__rule-top">
          <div class="alerts__rule-info">
            <div class="alerts__rule-name-row">
              <h3 class="alerts__rule-name">{{ rule.name }}</h3>
              <span class="alerts__type-badge" :class="`alerts__type-badge--${rule.type}`">{{ formatType(rule.type) }}</span>
            </div>
            <p class="alerts__rule-condition">{{ rule.condition }}</p>
          </div>
          <div class="alerts__rule-controls">
            <div class="alerts__channels">
              <span v-for="ch in rule.channels" :key="ch" class="alerts__channel-badge" :class="`alerts__channel-badge--${ch}`">{{ ch }}</span>
            </div>
            <button
              class="alerts__toggle"
              :class="{ 'alerts__toggle--active': rule.active }"
              @click="rule.active = !rule.active"
            >
              <span class="alerts__toggle-track">
                <span class="alerts__toggle-thumb" />
              </span>
              <span class="alerts__toggle-label">{{ rule.active ? 'Active' : 'Paused' }}</span>
            </button>
          </div>
        </div>
        <div class="alerts__rule-meta">
          <span class="text-muted" style="font-size: 0.6875rem">Last triggered: {{ rule.lastTriggered }}</span>
          <span class="mono text-muted" style="font-size: 0.6875rem">{{ rule.triggerCount }} triggers (30d)</span>
        </div>
      </div>
    </div>

    <!-- Alert History -->
    <div class="alerts__history">
      <h3 class="alerts__section-title">Recent Alert History</h3>
      <div class="card alerts__history-list">
        <div v-for="event in alertHistory" :key="event.id" class="alerts__history-item">
          <div class="alerts__history-left">
            <StatusDot :color="event.severity === 'critical' ? 'danger' : event.severity === 'warning' ? 'warning' : 'info'" />
            <div>
              <span class="alerts__history-name">{{ event.ruleName }}</span>
              <span class="alerts__history-detail text-secondary">{{ event.detail }}</span>
            </div>
          </div>
          <div class="alerts__history-right">
            <span class="alerts__severity-badge" :class="`alerts__severity-badge--${event.severity}`">{{ event.severity }}</span>
            <span class="text-muted mono" style="font-size: 0.6875rem">{{ event.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Alert SlideOver -->
    <SlideOver v-model="showCreate" title="Create Alert Rule">
      <div class="alerts__form">
        <div class="alerts__field">
          <label class="alerts__field-label">Alert Name</label>
          <input v-model="form.name" type="text" placeholder="High cost alert" />
        </div>
        <div class="alerts__field">
          <label class="alerts__field-label">Type</label>
          <select v-model="form.type">
            <option value="cost_threshold">Cost Threshold</option>
            <option value="error_rate">Error Rate</option>
            <option value="latency_spike">Latency Spike</option>
          </select>
        </div>
        <div class="alerts__field">
          <label class="alerts__field-label">
            {{ form.type === 'cost_threshold' ? 'Cost Threshold (&pound;)' : form.type === 'error_rate' ? 'Error Rate (%)' : 'Latency Threshold (ms)' }}
          </label>
          <input
            v-model="form.threshold"
            type="number"
            :placeholder="form.type === 'cost_threshold' ? '500' : form.type === 'error_rate' ? '5' : '1000'"
          />
        </div>
        <div class="alerts__field">
          <label class="alerts__field-label">Time Window</label>
          <select v-model="form.window">
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
          </select>
        </div>
        <div class="alerts__field">
          <label class="alerts__field-label">Notification Channels</label>
          <div class="alerts__channel-options">
            <label class="alerts__checkbox-label">
              <input v-model="form.channels" type="checkbox" value="email" />
              <span>Email</span>
            </label>
            <label class="alerts__checkbox-label">
              <input v-model="form.channels" type="checkbox" value="slack" />
              <span>Slack</span>
            </label>
            <label class="alerts__checkbox-label">
              <input v-model="form.channels" type="checkbox" value="webhook" />
              <span>Webhook</span>
            </label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary" @click="createAlert">Create Alert</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const showCreate = ref(false)

const form = reactive({
  name: '',
  type: 'cost_threshold',
  threshold: '',
  window: '1h',
  channels: [] as string[],
})

interface AlertRule {
  id: string
  name: string
  type: 'cost_threshold' | 'error_rate' | 'latency_spike'
  condition: string
  channels: string[]
  active: boolean
  lastTriggered: string
  triggerCount: number
}

interface AlertEvent {
  id: string
  ruleName: string
  detail: string
  severity: 'critical' | 'warning' | 'info'
  time: string
}

const alertRules = ref<AlertRule[]>([
  {
    id: 'alert-1',
    name: 'Daily Spend Limit',
    type: 'cost_threshold',
    condition: 'Daily cost exceeds £500',
    channels: ['email', 'slack'],
    active: true,
    lastTriggered: '2 days ago',
    triggerCount: 3,
  },
  {
    id: 'alert-2',
    name: 'Error Rate Spike',
    type: 'error_rate',
    condition: 'Error rate exceeds 5% over 15 minutes',
    channels: ['slack'],
    active: true,
    lastTriggered: '18 hours ago',
    triggerCount: 7,
  },
  {
    id: 'alert-3',
    name: 'Latency Degradation',
    type: 'latency_spike',
    condition: 'P95 latency exceeds 2000ms over 5 minutes',
    channels: ['email', 'slack'],
    active: true,
    lastTriggered: '5 days ago',
    triggerCount: 1,
  },
  {
    id: 'alert-4',
    name: 'Monthly Budget Warning',
    type: 'cost_threshold',
    condition: 'Monthly cost reaches 80% of £5,000 budget',
    channels: ['email'],
    active: false,
    lastTriggered: 'Never',
    triggerCount: 0,
  },
])

const alertHistory = ref<AlertEvent[]>([
  {
    id: 'evt-1',
    ruleName: 'Error Rate Spike',
    detail: 'Error rate reached 8.2% — OpenAI 429 rate limit errors',
    severity: 'critical',
    time: '18 hours ago',
  },
  {
    id: 'evt-2',
    ruleName: 'Daily Spend Limit',
    detail: 'Daily spend reached £512.40 — exceeded £500 threshold',
    severity: 'warning',
    time: '2 days ago',
  },
  {
    id: 'evt-3',
    ruleName: 'Error Rate Spike',
    detail: 'Error rate reached 5.4% — Anthropic 503 service errors',
    severity: 'warning',
    time: '4 days ago',
  },
  {
    id: 'evt-4',
    ruleName: 'Latency Degradation',
    detail: 'P95 latency reached 2,840ms — gpt-4-turbo slowdown',
    severity: 'critical',
    time: '5 days ago',
  },
  {
    id: 'evt-5',
    ruleName: 'Daily Spend Limit',
    detail: 'Daily spend reached £534.10 — exceeded £500 threshold',
    severity: 'warning',
    time: '8 days ago',
  },
])

function formatType(type: string): string {
  const map: Record<string, string> = {
    cost_threshold: 'Cost',
    error_rate: 'Error Rate',
    latency_spike: 'Latency',
  }
  return map[type] || type
}

function createAlert() {
  if (!form.name || !form.threshold) return

  const conditionMap: Record<string, string> = {
    cost_threshold: `Cost exceeds £${form.threshold} over ${form.window}`,
    error_rate: `Error rate exceeds ${form.threshold}% over ${form.window}`,
    latency_spike: `P95 latency exceeds ${form.threshold}ms over ${form.window}`,
  }

  alertRules.value.unshift({
    id: `alert-${Date.now()}`,
    name: form.name,
    type: form.type as AlertRule['type'],
    condition: conditionMap[form.type],
    channels: [...form.channels],
    active: true,
    lastTriggered: 'Never',
    triggerCount: 0,
  })

  showCreate.value = false
  form.name = ''
  form.type = 'cost_threshold'
  form.threshold = ''
  form.window = '1h'
  form.channels = []
}
</script>

<style scoped>
.alerts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.alerts__count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* --- Rules list --- */
.alerts__rules {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
}

.alerts__rule {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alerts__rule-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.alerts__rule-info {
  flex: 1;
  min-width: 0;
}

.alerts__rule-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.alerts__rule-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.alerts__rule-condition {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.alerts__rule-controls {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.alerts__rule-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid var(--border-base);
}

/* --- Type badge --- */
.alerts__type-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
}

.alerts__type-badge--cost_threshold {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
}

.alerts__type-badge--error_rate {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

.alerts__type-badge--latency_spike {
  color: var(--primary);
  background: rgba(91, 94, 244, 0.1);
}

/* --- Channel badges --- */
.alerts__channels {
  display: flex;
  gap: 4px;
}

.alerts__channel-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
  color: var(--text-secondary);
  background: var(--bg-elevated);
}

.alerts__channel-badge--email {
  color: var(--primary);
  border-color: rgba(91, 94, 244, 0.3);
  background: rgba(91, 94, 244, 0.08);
}

.alerts__channel-badge--slack {
  color: var(--success);
  border-color: rgba(0, 217, 126, 0.3);
  background: rgba(0, 217, 126, 0.08);
}

.alerts__channel-badge--webhook {
  color: var(--warning);
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.08);
}

/* --- Toggle --- */
.alerts__toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.alerts__toggle-track {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 10px;
  transition: all var(--transition-fast);
}

.alerts__toggle--active .alerts__toggle-track {
  background: var(--success);
  border-color: var(--success);
}

.alerts__toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.alerts__toggle--active .alerts__toggle-thumb {
  transform: translateX(16px);
}

.alerts__toggle-label {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-muted);
  min-width: 40px;
}

.alerts__toggle--active .alerts__toggle-label {
  color: var(--success);
}

/* --- History --- */
.alerts__history {
  margin-top: 8px;
}

.alerts__section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 12px;
}

.alerts__history-list {
  padding: 0 !important;
}

.alerts__history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-base);
  transition: background var(--transition-fast);
}

.alerts__history-item:last-child {
  border-bottom: none;
}

.alerts__history-item:hover {
  background: var(--bg-elevated);
}

.alerts__history-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.alerts__history-left > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.alerts__history-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.alerts__history-detail {
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alerts__history-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* --- Severity badge --- */
.alerts__severity-badge {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 4px;
}

.alerts__severity-badge--critical {
  color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
}

.alerts__severity-badge--warning {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.1);
}

.alerts__severity-badge--info {
  color: var(--primary);
  background: rgba(91, 94, 244, 0.1);
}

/* --- Form --- */
.alerts__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.alerts__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alerts__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.alerts__field input[type="text"],
.alerts__field input[type="number"],
.alerts__field select {
  width: 100%;
}

.alerts__channel-options {
  display: flex;
  gap: 16px;
}

.alerts__checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.alerts__checkbox-label input[type="checkbox"] {
  accent-color: var(--primary);
  width: 14px;
  height: 14px;
}
</style>
