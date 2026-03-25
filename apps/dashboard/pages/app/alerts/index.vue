<template>
  <div class="alerts fade-slide-in">
    <div class="alerts__header">
      <h2 class="alerts__count mono">{{ alertRules.length }} alert rules</h2>
      <button class="btn-primary" @click="showCreate = true">
        <Plus :size="14" />
        Create Alert
      </button>
    </div>

    <!-- Alert Rules List -->
    <div class="alerts__rules">
      <div v-for="rule in alertRules" :key="rule.id" class="card alerts__rule">
        <div class="alerts__rule-top">
          <div class="alerts__rule-info">
            <div class="alerts__rule-name-row">
              <h3 class="alerts__rule-name">{{ rule.name }}</h3>
              <span class="alerts__type-badge" :class="`alerts__type-badge--${rule.type}`">{{ typeLabels[rule.type] }}</span>
            </div>
            <p class="alerts__rule-condition">{{ rule.condition }}</p>
          </div>
          <div class="alerts__rule-controls">
            <div class="alerts__channels">
              <span v-for="ch in rule.channels" :key="ch" class="alerts__channel-badge" :class="`alerts__channel-badge--${ch}`">
                <component :is="channelIcons[ch]" :size="11" />
                {{ ch }}
              </span>
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
          <label class="alerts__field-label">Alert Type</label>
          <select v-model="form.type">
            <option value="">Select type</option>
            <option value="cost_threshold">Cost Threshold</option>
            <option value="error_rate">Error Rate</option>
            <option value="latency_spike">Latency Spike</option>
            <option value="budget_warning">Budget Warning</option>
          </select>
        </div>
        <div class="alerts__field">
          <label class="alerts__field-label">Name</label>
          <input v-model="form.name" type="text" :placeholder="namePlaceholder" />
        </div>

        <!-- Condition builder -->
        <div class="alerts__field">
          <label class="alerts__field-label">Condition</label>
          <div class="alerts__condition-builder">
            <template v-if="form.type === 'cost_threshold'">
              <span class="text-secondary" style="font-size: 0.8125rem">When daily cost exceeds</span>
              <div class="alerts__condition-input-group">
                <span class="alerts__condition-prefix">&pound;</span>
                <input v-model="form.threshold" type="number" placeholder="100" />
              </div>
            </template>
            <template v-else-if="form.type === 'error_rate'">
              <span class="text-secondary" style="font-size: 0.8125rem">When error rate exceeds</span>
              <div class="alerts__condition-input-group">
                <input v-model="form.threshold" type="number" placeholder="5" />
                <span class="alerts__condition-suffix">%</span>
              </div>
              <span class="text-secondary" style="font-size: 0.8125rem">in a 5-minute window</span>
            </template>
            <template v-else-if="form.type === 'latency_spike'">
              <span class="text-secondary" style="font-size: 0.8125rem">When p95 latency exceeds</span>
              <div class="alerts__condition-input-group">
                <input v-model="form.threshold" type="number" placeholder="2000" />
                <span class="alerts__condition-suffix">ms</span>
              </div>
            </template>
            <template v-else-if="form.type === 'budget_warning'">
              <span class="text-secondary" style="font-size: 0.8125rem">When monthly spend reaches</span>
              <div class="alerts__condition-input-group">
                <input v-model="form.threshold" type="number" placeholder="80" />
                <span class="alerts__condition-suffix">%</span>
              </div>
              <span class="text-secondary" style="font-size: 0.8125rem">of budget cap</span>
            </template>
            <template v-else>
              <span class="text-muted" style="font-size: 0.8125rem">Select an alert type first</span>
            </template>
          </div>
        </div>

        <div class="alerts__field">
          <label class="alerts__field-label">Notification Channels</label>
          <div class="alerts__channel-options">
            <label v-for="ch in channelOptionsList" :key="ch" class="alerts__checkbox-label">
              <input
                type="checkbox"
                :value="ch"
                :checked="form.channels.includes(ch)"
                @change="toggleChannel(ch)"
              />
              <component :is="channelIcons[ch]" :size="14" />
              <span>{{ ch }}</span>
            </label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary" :disabled="!form.type || !form.name" @click="createAlert">Create Alert</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
import { Plus, Mail, MessageSquare, Webhook } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const showCreate = ref(false)

const typeLabels: Record<string, string> = {
  cost_threshold: 'Cost',
  error_rate: 'Error Rate',
  latency_spike: 'Latency',
  budget_warning: 'Budget',
}

const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  slack: MessageSquare,
  webhook: Webhook,
}

const channelOptionsList = ['email', 'slack', 'webhook']

const form = reactive({
  type: '',
  name: '',
  threshold: '',
  channels: ['email'] as string[],
})

const namePlaceholder = computed(() => {
  switch (form.type) {
    case 'cost_threshold': return 'Daily cost alert'
    case 'error_rate': return 'High error rate'
    case 'latency_spike': return 'Latency spike alert'
    case 'budget_warning': return 'Budget 80% warning'
    default: return 'My alert rule'
  }
})

function toggleChannel(ch: string) {
  const idx = form.channels.indexOf(ch)
  if (idx >= 0) form.channels.splice(idx, 1)
  else form.channels.push(ch)
}

interface AlertRule {
  id: string
  name: string
  type: string
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
    condition: 'When daily cost exceeds \u00a3500',
    channels: ['email', 'slack'],
    active: true,
    lastTriggered: '2 days ago',
    triggerCount: 3,
  },
  {
    id: 'alert-2',
    name: 'Error Rate Spike',
    type: 'error_rate',
    condition: 'When error rate exceeds 5% in a 5-minute window',
    channels: ['slack', 'webhook'],
    active: true,
    lastTriggered: '18 hours ago',
    triggerCount: 7,
  },
  {
    id: 'alert-3',
    name: 'Latency Degradation',
    type: 'latency_spike',
    condition: 'When p95 latency exceeds 2000ms',
    channels: ['email', 'slack'],
    active: false,
    lastTriggered: '5 days ago',
    triggerCount: 1,
  },
  {
    id: 'alert-4',
    name: 'Monthly Budget Warning',
    type: 'budget_warning',
    condition: 'When monthly spend reaches 80% of \u00a35,000 budget cap',
    channels: ['email'],
    active: true,
    lastTriggered: '5 days ago',
    triggerCount: 2,
  },
])

const alertHistory = ref<AlertEvent[]>([
  {
    id: 'evt-1',
    ruleName: 'Error Rate Spike',
    detail: 'Error rate reached 8.2% \u2014 OpenAI 429 rate limit errors',
    severity: 'critical',
    time: '18 hours ago',
  },
  {
    id: 'evt-2',
    ruleName: 'Daily Spend Limit',
    detail: 'Daily spend reached \u00a3512.40 \u2014 exceeded \u00a3500 threshold',
    severity: 'warning',
    time: '2 days ago',
  },
  {
    id: 'evt-3',
    ruleName: 'Monthly Budget Warning',
    detail: 'Monthly spend at 82% of \u00a35,000 cap (\u00a34,100)',
    severity: 'warning',
    time: '5 days ago',
  },
])

function createAlert() {
  if (!form.type || !form.name) return

  const conditionMap: Record<string, string> = {
    cost_threshold: `When daily cost exceeds \u00a3${form.threshold || '100'}`,
    error_rate: `When error rate exceeds ${form.threshold || '5'}% in a 5-minute window`,
    latency_spike: `When p95 latency exceeds ${form.threshold || '2000'}ms`,
    budget_warning: `When monthly spend reaches ${form.threshold || '80'}% of budget cap`,
  }

  alertRules.value.unshift({
    id: `alert-${Date.now()}`,
    name: form.name,
    type: form.type,
    condition: conditionMap[form.type] || '',
    channels: [...form.channels],
    active: true,
    lastTriggered: 'Never',
    triggerCount: 0,
  })

  showCreate.value = false
  form.type = ''
  form.name = ''
  form.threshold = ''
  form.channels = ['email']
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

.alerts__type-badge--budget_warning {
  color: var(--success);
  background: rgba(0, 217, 126, 0.1);
}

/* --- Channel badges --- */
.alerts__channels {
  display: flex;
  gap: 4px;
}

.alerts__channel-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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

.alerts__condition-builder {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 12px;
}

.alerts__condition-input-group {
  display: flex;
  align-items: center;
  gap: 0;
  max-width: 180px;
}

.alerts__condition-input-group input {
  border-radius: 6px;
}

.alerts__condition-prefix,
.alerts__condition-suffix {
  font-size: 0.8125rem;
  color: var(--text-muted);
  padding: 0 6px;
  flex-shrink: 0;
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
  text-transform: capitalize;
}

.alerts__checkbox-label input[type="checkbox"] {
  accent-color: var(--primary);
  width: 14px;
  height: 14px;
}
</style>
