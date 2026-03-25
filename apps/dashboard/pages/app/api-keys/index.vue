<template>
  <div class="api-keys fade-slide-in">
    <div class="api-keys__header">
      <h2 class="api-keys__count mono">{{ apiKeys.length }} keys</h2>
      <button class="btn-primary" @click="showCreate = true">
        <Plus :size="14" />
        Create Key
      </button>
    </div>

    <DataTable :columns="columns" :rows="apiKeys">
      <template #cell-prefix="{ value }">
        <span class="mono" style="font-size: 0.75rem; color: var(--text-muted)">{{ value }}</span>
      </template>
      <template #cell-vertical="{ value }">
        <span v-if="value" class="api-keys__vertical-badge">{{ value }}</span>
        <span v-else class="text-muted" style="font-size: 0.75rem">&mdash;</span>
      </template>
      <template #cell-lastUsed="{ value }">
        <span class="text-secondary" style="font-size: 0.75rem">{{ value }}</span>
      </template>
      <template #cell-requests30d="{ value }">
        <span class="mono">{{ Number(value).toLocaleString() }}</span>
      </template>
      <template #cell-cost30d="{ value }">
        <span class="mono">&pound;{{ value }}</span>
      </template>
      <template #cell-status="{ row }">
        <span class="api-keys__status" :class="`api-keys__status--${row.status}`">
          <StatusDot :color="row.status === 'active' ? 'success' : row.status === 'expired' ? 'danger' : 'neutral'" />
          {{ row.status }}
        </span>
      </template>
      <template #cell-actions="{ row }">
        <div class="api-keys__actions">
          <button class="btn-ghost api-keys__action-btn" @click="editKey(row.id)">
            <Pencil :size="13" />
            Edit
          </button>
          <button class="btn-ghost api-keys__action-btn api-keys__action-btn--danger" @click="deleteKey(row.id)">
            <Trash2 :size="13" />
            Delete
          </button>
        </div>
      </template>
    </DataTable>

    <!-- Create Key SlideOver -->
    <SlideOver v-model="showCreate" title="Create API Key">
      <div class="api-keys__form">
        <div class="api-keys__field">
          <label class="api-keys__field-label">Name</label>
          <input v-model="form.name" type="text" placeholder="Production Backend" />
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Vertical</label>
          <select v-model="form.vertical">
            <option value="">General</option>
            <option value="ecommerce">Ecommerce</option>
            <option value="hr">HR &amp; Recruitment</option>
            <option value="healthtech">HealthTech</option>
            <option value="fintech">FinTech</option>
          </select>
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Rate Limit (req/min)</label>
          <input v-model="form.rateLimit" type="number" placeholder="1000" />
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Monthly Budget Cap (&pound;)</label>
          <input v-model="form.monthlyBudget" type="number" placeholder="500" />
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Allowed Providers</label>
          <div class="api-keys__checkbox-group">
            <label v-for="p in providerOptions" :key="p" class="api-keys__checkbox-label">
              <input
                type="checkbox"
                :value="p"
                :checked="form.allowedProviders.includes(p)"
                @change="toggleProvider(p)"
              />
              {{ p }}
            </label>
          </div>
        </div>
        <div class="api-keys__field">
          <label class="api-keys__field-label">Expiry</label>
          <select v-model="form.expiry">
            <option value="never">Never</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
            <option value="1y">1 year</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button class="btn-ghost" @click="showCreate = false">Cancel</button>
        <button class="btn-primary" @click="createKey">Create Key</button>
      </template>
    </SlideOver>

    <!-- Key Created SlideOver -->
    <SlideOver v-model="showKeyCreated" title="API Key Created">
      <div class="api-keys__created">
        <p class="text-secondary" style="font-size: 0.8125rem; margin-bottom: 16px; line-height: 1.5">
          Your API key has been created. Copy it now &mdash; you will not be able to see it again.
        </p>
        <div class="api-keys__key-display">
          <span class="mono">{{ createdKey }}</span>
          <button class="api-keys__copy-btn" @click="copyKey">
            <component :is="copied ? Check : ClipboardCopy" :size="14" />
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>
        <button
          v-if="!confirmed"
          class="api-keys__confirm-btn"
          @click="confirmed = true"
        >
          <ShieldCheck :size="14" />
          I've copied this key
        </button>
        <div v-else class="api-keys__confirmed">
          <ShieldCheck :size="14" />
          Key saved &mdash; you're all set
        </div>

        <div class="api-keys__key-warning">
          <AlertTriangle :size="14" />
          Store this key securely. It will only be shown once.
        </div>

        <!-- Integration snippets -->
        <div class="api-keys__snippets">
          <h4 class="api-keys__snippets-title">Integration</h4>
          <CodeBlock
            :code="integrationSnippets"
            :tabs="['Node.js', 'Python', 'curl']"
          />
        </div>
      </div>
      <template #footer>
        <button class="btn-primary" :disabled="!confirmed" @click="showKeyCreated = false">Done</button>
      </template>
    </SlideOver>
  </div>
</template>

<script setup lang="ts">
import { Plus, Pencil, Trash2, ClipboardCopy, Check, ShieldCheck, AlertTriangle } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

const showCreate = ref(false)
const showKeyCreated = ref(false)
const createdKey = ref('')
const copied = ref(false)
const confirmed = ref(false)

const providerOptions = ['OpenAI', 'Anthropic', 'Google', 'Mistral']

const form = reactive({
  name: '',
  vertical: '',
  rateLimit: '',
  monthlyBudget: '',
  allowedProviders: ['OpenAI', 'Anthropic', 'Google', 'Mistral'] as string[],
  expiry: 'never',
})

function toggleProvider(p: string) {
  const idx = form.allowedProviders.indexOf(p)
  if (idx >= 0) form.allowedProviders.splice(idx, 1)
  else form.allowedProviders.push(p)
}

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'prefix', label: 'Prefix', width: '130px' },
  { key: 'vertical', label: 'Vertical', width: '110px' },
  { key: 'lastUsed', label: 'Last Used', width: '120px', sortable: true },
  { key: 'requests30d', label: 'Requests 30d', width: '120px', align: 'right' as const, sortable: true },
  { key: 'cost30d', label: 'Cost 30d', width: '100px', align: 'right' as const, sortable: true },
  { key: 'status', label: 'Status', width: '100px' },
  { key: 'actions', label: '', width: '170px', align: 'right' as const },
]

const apiKeys = ref([
  {
    id: 'key-1',
    name: 'Production Backend',
    prefix: 'ng_live_8f2a\u2026',
    vertical: 'ecommerce',
    lastUsed: '2 minutes ago',
    requests30d: 284729,
    cost30d: '482.30',
    status: 'active',
  },
  {
    id: 'key-2',
    name: 'Staging Environment',
    prefix: 'ng_test_c91b\u2026',
    vertical: null,
    lastUsed: '14 hours ago',
    requests30d: 12483,
    cost30d: '18.40',
    status: 'active',
  },
  {
    id: 'key-3',
    name: 'ML Pipeline',
    prefix: 'ng_live_3d7e\u2026',
    vertical: 'healthtech',
    lastUsed: '3 days ago',
    requests30d: 89201,
    cost30d: '156.80',
    status: 'active',
  },
])

const integrationSnippets = computed<Record<string, string>>(() => ({
  'Node.js': `const neuralgate = require('@neuralgate/sdk')

const client = neuralgate.init({
  apiKey: '${createdKey.value}'
})

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
})`,
  'Python': `import neuralgate

client = neuralgate.Client(
    api_key="${createdKey.value}"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`,
  'curl': `curl -X POST https://api.neuralgate.dev/v1/chat/completions \\
  -H "Authorization: Bearer ${createdKey.value}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
}))

function createKey() {
  const prefix = `ng_live_${Math.random().toString(36).substring(2, 6)}`
  createdKey.value = `${prefix}_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`

  apiKeys.value.unshift({
    id: `key-${Date.now()}`,
    name: form.name || 'Unnamed Key',
    prefix: `${prefix}\u2026`,
    vertical: form.vertical || null,
    lastUsed: 'Just now',
    requests30d: 0,
    cost30d: '0.00',
    status: 'active',
  })

  showCreate.value = false
  showKeyCreated.value = true
  copied.value = false
  confirmed.value = false

  form.name = ''
  form.vertical = ''
  form.rateLimit = ''
  form.monthlyBudget = ''
  form.allowedProviders = ['OpenAI', 'Anthropic', 'Google', 'Mistral']
  form.expiry = 'never'
}

function copyKey() {
  navigator.clipboard.writeText(createdKey.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function editKey(id: string) {
  const key = apiKeys.value.find(k => k.id === id)
  if (!key) return
  form.name = key.name
  form.vertical = key.vertical || ''
  showCreate.value = true
}

function deleteKey(id: string) {
  apiKeys.value = apiKeys.value.filter(k => k.id !== id)
}
</script>

<style scoped>
.api-keys__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.api-keys__count {
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.api-keys__vertical-badge {
  font-size: 0.6875rem;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: capitalize;
}

.api-keys__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.api-keys__status--active { color: var(--success); }
.api-keys__status--expired { color: var(--danger); }
.api-keys__status--revoked { color: var(--text-muted); }

.api-keys__actions {
  display: flex;
  gap: 4px;
}

.api-keys__action-btn {
  font-size: 0.6875rem !important;
  padding: 3px 8px !important;
  height: auto !important;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.api-keys__action-btn--danger:hover {
  color: var(--danger) !important;
}

.api-keys__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.api-keys__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.api-keys__field-label {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.api-keys__field input,
.api-keys__field select {
  width: 100%;
}

.api-keys__checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.api-keys__checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.api-keys__checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--primary);
}

.api-keys__created {
  display: flex;
  flex-direction: column;
}

.api-keys__key-display {
  background: var(--bg-base);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.api-keys__key-display .mono {
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  color: var(--primary);
  word-break: break-all;
  line-height: 1.6;
}

.api-keys__copy-btn {
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: opacity var(--transition-fast);
}

.api-keys__copy-btn:hover {
  opacity: 0.85;
}

.api-keys__confirm-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.api-keys__confirm-btn:hover {
  background: var(--bg-overlay);
  border-color: var(--success);
  color: var(--success);
}

.api-keys__confirmed {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  margin-bottom: 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--success);
  background: rgba(0, 217, 126, 0.08);
  border: 1px solid rgba(0, 217, 126, 0.2);
}

.api-keys__key-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  color: var(--warning);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 20px;
}

.api-keys__snippets {
  margin-top: 4px;
}

.api-keys__snippets-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 10px;
}
</style>
